// Milestone 3 training on GCP spot VMs, built to survive failures. Commands:
//   node policy/gcp/gcp.js launch  <sweep.json> [--name=ID] [--machine=c2d-highcpu-112] [--threads=8] [--hours=5.5] [--yes] [--dry-run]
//   node policy/gcp/gcp.js status  <ID>             per-run state; a 'running' run whose heartbeat is stale is 'lost'
//   node policy/gcp/gcp.js resume  <ID> [--yes] [--only=a,b] [--commit[=sha]]  relaunch every run that isn't done (they continue from their saved state)
//   node policy/gcp/gcp.js stop    <ID> [--yes]     delete every VM of the sweep (states stay in the bucket)
//   node policy/gcp/gcp.js collect <ID>             download states/logs/reports to policy/runs/gcp/<ID>/ + print a summary
//   node policy/gcp/gcp.js helpers <ID> --n=K [--only=a,b] [--yes]   top each unfinished run up to K helper VMs
// Helpers (expert_iter runs): a run entry {helpers: K} (or launch --helpers=K) adds K helper VMs that run chunks of the run's
// fights (policy/dist.js; the leader sets WA_DIST); results are identical to a one-VM run, only faster. Resume re-adds them.
// Env: GCP_PROJECT, GCP_SA_KEY (service-account JSON), GCP_REGION (default us-central1), GCP_BUCKET (default
// gs://<project>-wild-arena-runs), GCP_VM_SA (service account the VMs run as; default: the project's compute default,
// which needs storage access and permission to delete its own instance). Tests: --bucket=<local folder> --local runs the VM script locally instead of on VMs.
// Failure handling: spot preemption / VM death -> stale heartbeat -> 'lost' -> resume (exact, from checkpoints);
// capacity or quota errors -> next zone, then smaller machines; partial launches leave runs 'pending' for resume;
// a crashing run is 'failed' with its log tail and retried by resume up to --maxRetries; every VM has a hard
// max-run-duration (auto-delete), deletes itself when done, and VMs are labelled by sweep so nothing is double-launched.
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync, spawn } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const args = process.argv.slice(2), pos = args.filter(a => !a.startsWith('--')), opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v === undefined ? true : v]; }));
const PROJECT = process.env.GCP_PROJECT, REGIONS = (process.env.GCP_REGION || 'us-central1').split(','), REGION = REGIONS[0]; // a list spills VMs into the next region (e.g. 8 external IPs per region)
const BUCKET = opt.bucket || process.env.GCP_BUCKET || (PROJECT ? `gs://${PROJECT}-wild-arena-runs` : null);
const LOCAL = !!opt.local || (BUCKET && !BUCKET.startsWith('gs://'));
let MACHINES = (opt.machines || opt.machine || 'c2d-highcpu-112,c2d-highcpu-56,n2d-highcpu-64,n2d-highcpu-32').split(',');
const CORES = m => +(m.match(/-(\d+)$/) || [0, 8])[1];
const PRICE_PER_CORE_H = {c2d: .0072, n2d: .0062, c3d: .0080, e2: .0050}; // rough spot $/vCPU-hour (estimate only; check your region)
const STALE_S = +(opt.staleMinutes || 20) * 60;
const sh = (cmd, a, o) => execFileSync(cmd, a, Object.assign({stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26}, o)).toString();
const log = (...m) => console.log(...m);

// ---------- storage (gs:// via gcloud, or a local folder for tests) ----------
const S = {
  put(local, key){ if (LOCAL) { const f = path.join(BUCKET, key); fs.mkdirSync(path.dirname(f), {recursive: true}); fs.copyFileSync(local, f); } else if (process.env.GCS_XML_READ) sh('curl', ['-sSf', '-m', '60', '-X', 'POST', '--data-binary', '@' + local, '-H', 'Content-Type: application/octet-stream', `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET.slice(5)}/o?uploadType=media&name=${encodeURIComponent(key)}`]); else sh('gcloud', ['storage', 'cp', '-q', local, `${BUCKET}/${key}`]); }, // GCS_XML_READ: also write over plain HTTPS (gcloud storage cp hung once behind the proxy)
  putText(key, text){ const t = path.join(os.tmpdir(), 'wa_' + process.pid + '_' + path.basename(key)); fs.writeFileSync(t, text); try { S.put(t, key); } finally { fs.unlinkSync(t); } },
  get(key){ try { return LOCAL ? fs.readFileSync(path.join(BUCKET, key), 'utf8') : process.env.GCS_XML_READ ? sh('curl', ['-sSf', `https://storage.googleapis.com/${BUCKET.slice(5)}/${key}`]) : sh('gcloud', ['storage', 'cat', `${BUCKET}/${key}`]); } catch (e){ return null; } }, // GCS_XML_READ: proxies that decode %2F break gcloud's JSON-API reads
  list(prefix){ try { if (LOCAL){ const d = path.join(BUCKET, prefix); return fs.existsSync(d) ? fs.readdirSync(d).map(f => prefix + f) : []; } return sh('gcloud', ['storage', 'ls', `${BUCKET}/${prefix}`]).split('\n').filter(Boolean).map(u => u.replace(BUCKET + '/', '')); } catch (e){ return []; } },
  ensureBucket(){ if (LOCAL){ fs.mkdirSync(BUCKET, {recursive: true}); return; } try { sh('gcloud', ['storage', 'buckets', 'describe', BUCKET]); } catch (e){ log(`creating ${BUCKET} in ${REGION}`); sh('gcloud', ['storage', 'buckets', 'create', BUCKET, '--location', REGION, '--uniform-bucket-level-access']); } },
};
function auth(){
  if (LOCAL) return;
  if (!PROJECT) throw new Error('GCP_PROJECT is not set (add it in the environment settings)');
  if (process.env.GCP_SA_KEY){ const k = path.join(os.tmpdir(), 'wa_sa.json'); fs.writeFileSync(k, process.env.GCP_SA_KEY, {mode: 0o600}); sh('gcloud', ['auth', 'activate-service-account', '--key-file', k, '--quiet']); fs.unlinkSync(k); }
  sh('gcloud', ['config', 'set', 'project', PROJECT, '--quiet']);
}
// ---------- state ----------
function manifest(id){ const m = S.get(`sweeps/${id}/manifest.json`); if (!m) throw new Error('no such sweep: ' + id); return JSON.parse(m); }
function statuses(id){ const out = {}; for (const k of S.list(`sweeps/${id}/status/`)){ const t = S.get(k); if (t) try { const s = JSON.parse(t); out[s.run] = s; } catch (e){} } return out; }
function view(id, vms){ // vms (optional, from vmsOf): a 'running' run whose VM is gone (preempted) is lost at once, not after STALE_S
  const m = manifest(id), st = statuses(id), now = Date.now() / 1000, up = vms && new Set(vms.filter(x => x.status !== 'TERMINATED').map(x => x.name));
  return m.runs.map(r => { const s = st[r.name], tries = (m.tries || {})[r.name] || 0;
    let state = s ? s.state : 'pending'; if (state === 'running' && (now - s.t > STALE_S || (up && s.host && !up.has(s.host)))) state = 'lost';
    if (state === 'running' && /time budget used/.test(s.note || '')) state = 'paused';
    return {name: r.name, state, tries, age: s ? Math.round(now - s.t) : null, host: s && s.host, note: s ? s.note : ''}; });
}
// ---------- VMs ----------
function vmsOf(id){ if (LOCAL) return []; try { return JSON.parse(sh('gcloud', ['compute', 'instances', 'list', '--filter', `labels.wa-sweep=${id}`, '--format', 'json(name,zone,status,labels)'])); } catch (e){ return []; } }
function zones(){ if (opt.zones) return opt.zones.split(','); return REGIONS.flatMap(R => { try { return sh('gcloud', ['compute', 'zones', 'list', '--filter', `region:${R} AND status:UP`, '--format', 'value(name)']).split('\n').filter(Boolean); } catch (e){ return ['b', 'c', 'a', 'f'].map(z => `${R}-${z}`); } }); }
const RETRYABLE = /ZONE_RESOURCE_POOL_EXHAUSTED|RESOURCE_EXHAUSTED|QUOTA_EXCEEDED|Quota .* exceeded|does not have enough resources|not available in zone|UNSUPPORTED_OPERATION|was not found/i;
function createVM(id, idx, runs, m, hours, role){
  const name = `wa-${id}-${idx}-${Date.now().toString(36).slice(-4)}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 62);
  const meta = {bucket: BUCKET, sweep: id, runs: runs.join('+'), commit: m.commit, hours: String(hours), threads: String(m.threads), repo: m.repo, role: role || 'leader'};
  const startup = path.join(__dirname, 'vm_runner.sh'), errors = [];
  for (const machine of MACHINES.filter(x => CORES(x) >= m.threads)) for (const zone of zones()){
    const a = ['compute', 'instances', 'create', name, '--zone', zone, '--machine-type', machine, '--provisioning-model', 'SPOT', '--instance-termination-action', 'DELETE',
      '--max-run-duration', `${Math.ceil((hours + .75) * 60)}m`, '--image-family', 'debian-12', '--image-project', 'debian-cloud', '--boot-disk-size', '20GB',
      '--scopes', 'cloud-platform', ...(process.env.GCP_VM_SA ? ['--service-account', process.env.GCP_VM_SA] : []), '--labels', `wa-sweep=${id},wa-role=${role || 'leader'}${role === 'helper' ? ',wa-run=' + runs[0].toLowerCase().replace(/[^a-z0-9_-]/g, '-') : ''}`, '--metadata', Object.entries(meta).map(([k, v]) => `${k}=${v}`).join(','), '--metadata-from-file', `startup-script=${startup}`, '--quiet'];
    if (opt['dry-run']){ log('  [dry-run] gcloud ' + a.join(' ')); return {name, zone, machine}; }
    try { sh('gcloud', a); log(`  ${name}: ${machine} in ${zone}, runs ${runs.join(', ')}`); return {name, zone, machine}; }
    catch (e){ const msg = String(e.stderr || e.message); errors.push(`${machine}@${zone}: ${msg.split('\n').find(l => /ERROR/.test(l)) || msg.slice(0, 200)}`);
      if (/CPUS_ALL_REGIONS/.test(msg)){ log(`  project-wide CPU quota full: runs ${runs.join(', ')} left pending`); return 'quota'; } // no zone or region can help
      if (!RETRYABLE.test(msg)) break; }
  }
  log(`  could not create a VM for runs ${runs.join(', ')} (left pending; 'resume' retries):\n    ` + errors.slice(-4).join('\n    ')); return null;
}
function launchRuns(id, m, names){
  const per = Math.max(1, Math.floor(CORES(MACHINES[0]) / m.threads)), groups = []; for (let i = 0; i < names.length; i += per) groups.push(names.slice(i, i + per));
  const cost = groups.length * CORES(MACHINES[0]) * m.hours * (PRICE_PER_CORE_H[MACHINES[0].split('-')[0]] || .008);
  log(`${names.length} runs on ${groups.length} × ${MACHINES[0]} (${per} runs × ${m.threads} threads each), up to ${m.hours} h: worst case ≈ $${cost.toFixed(2)} (spot estimate)`);
  if (LOCAL){ // tests: run the VM script locally, one process per group
    groups.forEach((g, i) => { const p = spawn('bash', [path.join(__dirname, 'vm_runner.sh')], {env: Object.assign({}, process.env, {LOCAL: '1', BUCKET, SWEEP: id, RUNS: g.join('+'), REPO_DIR: ROOT, HOURS: String(m.hours), THREADS: String(m.threads), SYNC_S: String(opt.sync || 3)}), stdio: 'inherit', detached: !!opt.detach}); if (opt.detach) p.unref(); log(`  local runner ${i}: ${g.join(', ')}`); });
    return;
  }
  if (!opt.yes && !opt['dry-run']){ log('not launched: add --yes to launch (or --dry-run to see the commands)'); return; }
  const launched = []; let full = false; groups.forEach((g, i) => { if (full) return; const v = createVM(id, i, g, m, m.hours); if (v === 'quota') full = true; else if (v) launched.push(...g); });
  log(`${groups.filter(g => launched.includes(g[0])).length}/${groups.length} VMs created`); return launched;
}
const helpersOf = (m, name) => { const r = m.runs.find(x => x.name === name); return +((r && r.helpers) != null ? r.helpers : (m.helpers || 0)); };
function launchHelpers(id, m, names, want){ // top each run up to its helper count (want overrides), counting helper VMs still up
  const vms = vmsOf(id).filter(v => v.status !== 'TERMINATED' && v.labels && v.labels['wa-role'] === 'helper'), plan = [];
  for (const n of names){ const k = want != null ? want : helpersOf(m, n), have = vms.filter(v => v.labels['wa-run'] === n.toLowerCase().replace(/[^a-z0-9_-]/g, '-')).length; for (let i = have; i < k; i++) plan.push(n); }
  if (!plan.length) return 0;
  const cost = plan.length * CORES(MACHINES[0]) * m.hours * (PRICE_PER_CORE_H[MACHINES[0].split('-')[0]] || .008);
  log(`${plan.length} helper VMs (${MACHINES[0]}) for ${[...new Set(plan)].join(', ')}: worst case ≈ $${cost.toFixed(2)} (spot estimate)`);
  if (LOCAL){ plan.forEach(n => { const p = spawn('node', [path.join(ROOT, 'policy', 'dist_helper.js'), path.join(BUCKET, 'sweeps', id, 'runs', n, 'dist'), '--threads=' + m.threads, '--hours=' + m.hours], {stdio: 'inherit', detached: !!opt.detach}); if (opt.detach) p.unref(); }); return plan.length; }
  if (!opt.yes && !opt['dry-run']) return 0;
  let made = 0; for (let i = 0; i < plan.length; i++){ const v = createVM(id, 'h' + i, [plan[i]], m, m.hours, 'helper'); if (v === 'quota') break; if (v) made++; }
  log(`${made}/${plan.length} helper VMs created`); return made;
}
// ---------- check: is the GCP setup usable? (each step says what to fix) ----------
function check(){
  const ok = m => log('  OK    ' + m), bad = (m, fix) => { log('  FAIL  ' + m + (fix ? '\n        fix: ' + fix : '')); fails++; };
  let fails = 0;
  log('environment');
  PROJECT ? ok('GCP_PROJECT = ' + PROJECT) : bad('GCP_PROJECT not set', 'add it in the environment settings, then start a new session');
  let key = null; if (!process.env.GCP_SA_KEY) log("  note  GCP_SA_KEY not set: using gcloud's current login (e.g. a proxy-injected token)");
  else { try { key = JSON.parse(process.env.GCP_SA_KEY); key.type === 'service_account' && key.client_email && key.private_key ? ok(`key parses: ${key.client_email} (project ${key.project_id})`) : bad('GCP_SA_KEY is JSON but not a service-account key'); } catch (e){ bad('GCP_SA_KEY is not valid JSON', 'paste the whole key file contents (it starts with {"type": "service_account")'); } }
  if (key && PROJECT && key.project_id !== PROJECT) log(`  note  the key is from project ${key.project_id}, GCP_PROJECT is ${PROJECT} (fine if the account has roles there)`);
  if (fails) return log(`\n${fails} problem(s); fix them and run 'node policy/gcp/gcp.js check' again`);
  log('auth and project');
  try { auth(); ok(process.env.GCP_SA_KEY ? 'activated the service account and set the project' : 'set the project'); } catch (e){ return bad('gcloud auth failed: ' + String(e.stderr || e.message).split('\n')[0], 'check the key; a deleted or disabled key fails here'); }
  try { sh('gcloud', ['projects', 'describe', PROJECT, '--format', 'value(projectId)']); ok('project is visible'); } catch (e){ bad('cannot see project ' + PROJECT, 'grant the service account a role on this project (e.g. Compute Instance Admin)'); }
  log('APIs');
  for (const api of ['compute.googleapis.com', 'storage.googleapis.com']){
    try { const on = sh('gcloud', ['services', 'list', '--enabled', '--filter', 'config.name=' + api, '--format', 'value(config.name)']).trim(); on ? ok(api + ' enabled') : bad(api + ' not enabled', 'gcloud services enable ' + api + ' (or APIs & Services in the console)'); }
    catch (e){ log(`  ?     could not list services (${String(e.stderr || e.message).split('\n').find(l => /ERROR/.test(l)) || 'permission'}); checking by use instead`); break; }
  }
  try { const z = zones(); z.length ? ok(`compute works: ${z.length} zones up in ${REGION}`) : bad('no zones listed in ' + REGION, 'check GCP_REGION'); } catch (e){ bad('compute call failed: ' + String(e.stderr || e.message).split('\n')[0]); }
  log('quota (' + REGION + ')');
  try { const q = JSON.parse(sh('gcloud', ['compute', 'regions', 'describe', REGION, '--format', 'json(quotas)'])).quotas || [];
    for (const name of ['PREEMPTIBLE_CPUS', 'CPUS', 'C2D_CPUS', 'N2D_CPUS']){ const x = q.find(y => y.metric === name); if (x) log(`  ${x.limit >= 112 ? 'OK  ' : 'LOW '}  ${name}: ${x.usage}/${x.limit}${x.limit < 112 ? '  (a 112-core VM needs 112; request more in IAM & Admin > Quotas, or use --machine=n2d-highcpu-32)' : ''}`); } }
  catch (e){ bad('could not read quotas: ' + String(e.stderr || e.message).split('\n')[0]); }
  log('bucket ' + BUCKET);
  try { S.ensureBucket(); const k = 'check/' + Date.now() + '.txt'; S.putText(k, 'hello'); S.get(k) === 'hello' ? ok('created/used the bucket; write + read work') : bad('wrote but could not read back'); try { sh('gcloud', ['storage', 'rm', '-q', `${BUCKET}/${k}`]); } catch (e){} }
  catch (e){ bad('bucket write failed: ' + String(e.stderr || e.message).split('\n').find(l => /ERROR/.test(l)) || e.message, 'grant Storage Admin (or set GCP_BUCKET to a bucket the account can write)'); }
  if (opt.vm){ // optional: create and delete a tiny spot VM (cost: ~a cent)
    log('tiny VM (--vm)'); const name = 'wa-check-' + Date.now().toString(36), zone = zones()[0];
    try { sh('gcloud', ['compute', 'instances', 'create', name, '--zone', zone, '--machine-type', 'e2-micro', '--provisioning-model', 'SPOT', '--instance-termination-action', 'DELETE', '--max-run-duration', '10m', '--image-family', 'debian-12', '--image-project', 'debian-cloud', '--scopes', 'cloud-platform', ...(process.env.GCP_VM_SA ? ['--service-account', process.env.GCP_VM_SA] : []), '--quiet']); ok('created ' + name + ' in ' + zone);
      sh('gcloud', ['compute', 'instances', 'delete', name, '--zone', zone, '--quiet']); ok('deleted it'); }
    catch (e){ bad('VM create/delete failed: ' + (String(e.stderr || e.message).split('\n').find(l => /ERROR/.test(l)) || ''), 'needs Compute Instance Admin (v1) + Service Account User'); }
  }
  log(fails ? `\n${fails} problem(s) above` : `\nall good${opt.vm ? '' : " (add --vm to also create and delete a tiny spot VM, ~1 cent)"}`);
}
// ---------- commands ----------
const [cmd, arg] = pos;
(async () => {
  if (cmd === 'check') return check();
  if (!opt['dry-run']){ auth(); S.ensureBucket(); }
  if (cmd === 'launch'){
    const sweep = JSON.parse(fs.readFileSync(arg, 'utf8')), id = (opt.name || path.basename(arg, '.json') + '-' + Date.now().toString(36)).toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (S.get(`sweeps/${id}/manifest.json`)) throw new Error(`sweep ${id} exists: use 'resume ${id}'`);
    const commit = opt.commit || sh('git', ['rev-parse', 'HEAD'], {cwd: ROOT}).trim();
    if (!LOCAL){ try { sh('git', ['branch', '-r', '--contains', commit], {cwd: ROOT}).trim() || (() => { throw 0; })(); } catch (e){ throw new Error(`commit ${commit} isn't on the remote: push first (VMs clone it)`); } }
    const m = {id, created: new Date().toISOString(), sweepFile: arg, note: sweep.note, commit, repo: opt.repo || 'https://github.com/slisenberger/wild-arena.git', threads: +(opt.threads || 8), hours: +(opt.hours || 5.5), machines: MACHINES, runs: sweep.runs, tries: {}, helpers: +(opt.helpers || sweep.helpers || 0)};
    sweep.runs.forEach(r => m.tries[r.name] = 1);
    if (!opt['dry-run']) S.putText(`sweeps/${id}/manifest.json`, JSON.stringify(m, null, 1));
    log(`sweep ${id} @ ${commit.slice(0, 10)} -> ${BUCKET}/sweeps/${id}/`); launchRuns(id, m, sweep.runs.map(r => r.name)); launchHelpers(id, m, sweep.runs.map(r => r.name));
  } else if (cmd === 'status'){
    const vms = vmsOf(arg), v = view(arg, vms), c = {};
    for (const r of v){ c[r.state] = (c[r.state] || 0) + 1; log(`${r.name.padEnd(18)} ${r.state.padEnd(8)} tries ${r.tries}  ${r.age == null ? '' : r.age + ' s ago'}  ${String(r.note || '').split('\n')[0].slice(0, 110)}`); }
    log(`summary: ${Object.entries(c).map(([k, n]) => k + ' ' + n).join(', ')} | VMs alive: ${LOCAL ? 'n/a (local)' : vms.map(x => x.name + ':' + x.status).join(' ') || 'none'}`);
  } else if (cmd === 'resume'){
    const m = manifest(arg), vms = vmsOf(arg), v = view(arg, LOCAL ? null : vms), max = +(opt.maxRetries || 3), up = new Set(vms.filter(x => x.status !== 'TERMINATED').map(x => x.name)),
      alive = new Set(vms.length ? Object.values(statuses(arg)).filter(s => Date.now() / 1000 - s.t < STALE_S && (!s.host || up.has(s.host))).map(s => s.run) : []); // fresh heartbeat on a VM that still exists
    const todo = v.filter(r => r.state !== 'done' && !alive.has(r.name) && (r.state !== 'failed' || r.tries < max) && (!opt.only || String(opt.only).split(',').includes(r.name))).map(r => r.name);
    const skipped = v.filter(r => r.state === 'failed' && r.tries >= max).map(r => r.name);
    if (skipped.length) log(`not retried (failed ${max}×): ${skipped.join(', ')}`);
    if (!todo.length){ log('nothing to resume'); return; }
    if (opt.hours) m.hours = +opt.hours;
    if (opt.commit){ const c = opt.commit === true ? sh('git', ['rev-parse', 'HEAD'], {cwd: ROOT}).trim() : String(opt.commit); // --commit[=sha]: resume on newer code (a fix), from the same saved state
      if (!LOCAL){ try { sh('git', ['branch', '-r', '--contains', c], {cwd: ROOT}).trim() || (() => { throw 0; })(); } catch (e){ throw new Error(`commit ${c} isn't on the remote: push first (VMs clone it)`); } }
      log(`code: ${m.commit.slice(0, 8)} -> ${c.slice(0, 8)}`); m.commit = c; }
    if (opt.machine || opt.machines) m.machines = MACHINES; else if (m.machines) MACHINES = m.machines; // resume keeps the launch's machine choice
    log(`resuming ${todo.length}: ${todo.join(', ')}`); const launched = launchRuns(arg, m, todo) || (LOCAL ? todo : []);
    launched.forEach(n => m.tries[n] = (m.tries[n] || 0) + 1); // count an attempt only when a VM was created (a full quota isn't a failure)
    launchHelpers(arg, m, todo);
    if (!opt['dry-run'] && (opt.yes || LOCAL)) S.putText(`sweeps/${arg}/manifest.json`, JSON.stringify(m, null, 1));
  } else if (cmd === 'helpers'){ // add helper VMs to unfinished runs (e.g. after a quota increase)
    const m = manifest(arg), v = view(arg, LOCAL ? null : vmsOf(arg)), names = v.filter(r => r.state !== 'done' && r.state !== 'failed' && (!opt.only || String(opt.only).split(',').includes(r.name))).map(r => r.name);
    if (m.machines) MACHINES = m.machines; launchHelpers(arg, m, names, opt.n != null ? +opt.n : null);
  } else if (cmd === 'stop'){
    const vms = vmsOf(arg); if (!vms.length){ log('no VMs alive for ' + arg); return; }
    if (!opt.yes){ log(`would delete ${vms.length} VMs: ${vms.map(x => x.name).join(' ')} (add --yes)`); return; }
    for (const x of vms){ try { sh('gcloud', ['compute', 'instances', 'delete', x.name, '--zone', x.zone.split('/').pop(), '--quiet']); log('deleted ' + x.name); } catch (e){ log('could not delete ' + x.name + ': ' + String(e.stderr || e).slice(0, 200)); } }
  } else if (cmd === 'collect'){
    const m = manifest(arg), out = path.join(ROOT, 'policy', 'runs', 'gcp', arg), lines = [];
    for (const r of m.runs){ const d = path.join(out, r.name); fs.mkdirSync(d, {recursive: true});
      for (const f of ['state.json', 'state.json.log', 'report.txt', 'run.out']){ const t = S.get(`sweeps/${arg}/runs/${r.name}/${f}`); if (t != null) fs.writeFileSync(path.join(d, f), t); }
      const rep = fs.existsSync(path.join(d, 'state.json.log')) ? fs.readFileSync(path.join(d, 'state.json.log'), 'utf8').split('\n').filter(l => l.startsWith('[test]')).pop() : null;
      lines.push(`${r.name.padEnd(18)} ${rep || '(no test yet)'}`); }
    fs.writeFileSync(path.join(out, 'summary.txt'), lines.join('\n') + '\n'); log(lines.join('\n')); log(`-> ${out}`);
  } else { log(fs.readFileSync(__filename, 'utf8').split('\n').slice(0, 16).join('\n')); }
})().catch(e => { console.error('gcp.js: ' + e.message); process.exit(1); });
