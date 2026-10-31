// Spread one training run's fights over many VMs (owner, Oct 31: compress the timeline). A run's leader (expert_iter.js with
// WA_DIST set) splits a batch of jobs into chunks in a shared store; helper VMs (policy/dist_helper.js) and the leader itself
// claim chunks, run them with worker threads and write the results back; the leader waits for every result. Jobs are
// deterministic, so a chunk that two machines both run (a stale claim retaken after preemption) gives identical results, and a
// resumed leader finds the chunks it already wrote (names hash the batch). Store: a local folder (tests) or gs://... via gcloud.
const fs = require('fs'), path = require('path'), os = require('os'), zlib = require('zlib'), crypto = require('crypto');
const { execFileSync } = require('child_process');
const { Worker } = require('worker_threads');

// ---------- store ----------
function store(root){
  if (!root.startsWith('gs://')){
    const p = k => path.join(root, k);
    return {
      put(k, buf){ fs.mkdirSync(path.dirname(p(k)), {recursive: true}); const t = p(k) + '.tmp' + process.pid; fs.writeFileSync(t, buf); fs.renameSync(t, p(k)); },
      putIfAbsent(k, buf){ fs.mkdirSync(path.dirname(p(k)), {recursive: true}); try { fs.writeFileSync(p(k), buf, {flag: 'wx'}); return true; } catch (e){ if (e.code === 'EEXIST') return false; throw e; } },
      get(k){ try { return fs.readFileSync(p(k)); } catch (e){ return null; } },
      list(prefix){ const d = p(prefix); try { return fs.readdirSync(d).filter(f => !/\.tmp\d+$/.test(f)).map(f => prefix + f); } catch (e){ return []; } },
      del(k){ try { fs.unlinkSync(p(k)); } catch (e){} },
    };
  }
  const sh = a => execFileSync('gcloud', a, {stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 30});
  const tmp = buf => { const t = path.join(os.tmpdir(), 'wad_' + process.pid + '_' + crypto.randomBytes(4).toString('hex')); fs.writeFileSync(t, buf); return t; };
  const retry = f => { for (let n = 0; ; n++){ try { return f(); } catch (e){ if (n >= 4) throw e; execFileSync('sleep', [String(2 << n)]); } } };
  return {
    put(k, buf){ const t = tmp(buf); try { retry(() => sh(['storage', 'cp', '-q', t, `${root}/${k}`])); } finally { fs.unlinkSync(t); } },
    putIfAbsent(k, buf){ const t = tmp(buf); try { sh(['storage', 'cp', '-q', '--if-generation-match=0', t, `${root}/${k}`]); return true; } // atomic create
      catch (e){ if (/412|precondition|PreconditionFailed/i.test(String(e.stderr || e.message))) return false; throw e; } finally { fs.unlinkSync(t); } },
    get(k){ try { return sh(['storage', 'cat', `${root}/${k}`]); } catch (e){ return null; } },
    list(prefix){ try { return sh(['storage', 'ls', `${root}/${prefix}`]).toString().split('\n').filter(Boolean).map(u => u.slice(root.length + 1)); } catch (e){ return []; } },
    del(k){ try { sh(['storage', 'rm', '-q', `${root}/${k}`]); } catch (e){} },
  };
}
const pack = o => zlib.gzipSync(JSON.stringify(o)), unpack = b => JSON.parse(zlib.gunzipSync(b).toString('utf8'));
const now = () => Date.now() / 1000;

// ---------- running a chunk here: worker threads on `script` (its !isMainThread branch takes {jobs, ...ctx} and posts results) ----------
function runLocal(script, jobs, ctx, threads){
  const T = Math.max(1, Math.min(threads, jobs.length));
  return Promise.all([...Array(T).keys()].map(k => new Promise((res, rej) => { const w = new Worker(script, {workerData: Object.assign({jobs: jobs.filter((_, q) => q % T === k)}, ctx)}); w.on('message', res); w.on('error', rej); }))).then(p => p.flat());
}

// ---------- leader: one batch ----------
// script: absolute path of the worker script; jobs: [...]; ctx: the rest of workerData; o: {threads, chunk, staleS}
// Returns the flat results in chunk order (the same as runLocal would give for the whole batch, up to order inside a chunk;
// callers key results by job, as expert_iter does).
async function distPool(root, script, jobs, ctx, o){
  const S = store(root), CH = o.chunk || 32, stale = o.staleS || 1800, threads = o.threads || os.cpus().length;
  const tag = crypto.createHash('sha1').update(JSON.stringify({jobs, ctx})).digest('hex').slice(0, 16);
  const rel = path.relative(path.join(__dirname, '..'), script), n = Math.ceil(jobs.length / CH), base = `batch/${tag}/`;
  for (let k = 0; k < n; k++) if (!S.get(base + `job-${k}`)) S.put(base + `job-${k}`, pack({script: rel, ctx, jobs: jobs.slice(k * CH, (k + 1) * CH)}));
  S.put(`queue/${tag}`, Buffer.from(JSON.stringify({n, t: now()})));
  const out = new Array(n).fill(null);
  for (;;){
    const have = new Set(S.list(base).map(x => x.slice(base.length)));
    for (let k = 0; k < n; k++) if (!out[k] && have.has(`res-${k}`)){ const b = S.get(base + `res-${k}`); if (b) out[k] = unpack(b); }
    if (out.every(Boolean)) break;
    // claim one unfinished chunk (free, or claimed long ago without a result) and run it here
    let mine = -1;
    for (let k = 0; k < n && mine < 0; k++){
      if (out[k] || have.has(`res-${k}`)) continue;
      const claim = base + `claim-${k}`, body = Buffer.from(JSON.stringify({host: os.hostname(), t: now()}));
      if (!have.has(`claim-${k}`)){ if (S.putIfAbsent(claim, body)) mine = k; }
      else { const c = S.get(claim); const t = c ? JSON.parse(c.toString()).t : 0; if (now() - t > stale){ S.put(claim, body); mine = k; } }
    }
    if (mine >= 0){ const res = await runLocal(script, jobs.slice(mine * CH, (mine + 1) * CH), ctx, threads); S.put(base + `res-${mine}`, pack(res)); out[mine] = res; }
    else await new Promise(r => setTimeout(r, 10000));
  }
  S.del(`queue/${tag}`);
  return out.flat();
}
// the run is over: helpers on this root exit
function markDone(root){ store(root).put('done', Buffer.from(String(now()))); }

// ---------- helper: run chunks of whatever batch is queued, until the run is done ----------
async function helper(root, o){
  const S = store(root), threads = o.threads || os.cpus().length, t0 = now(), hours = o.hours || 5, idleMax = o.idleS || 3600, repo = path.join(__dirname, '..');
  let idleSince = now();
  while (!S.get('done') && now() - t0 < hours * 3600 && now() - idleSince < idleMax){
    let did = false;
    for (const q of S.list('queue/')){
      const tag = q.slice('queue/'.length), base = `batch/${tag}/`, have = new Set(S.list(base).map(x => x.slice(base.length)));
      const n = have.size ? Math.max(...[...have].filter(x => x.startsWith('job-')).map(x => +x.slice(4)), -1) + 1 : 0;
      for (let k = 0; k < n; k++){
        if (have.has(`res-${k}`) || have.has(`claim-${k}`)) continue;
        if (!S.putIfAbsent(base + `claim-${k}`, Buffer.from(JSON.stringify({host: os.hostname(), t: now()})))) continue;
        const job = S.get(base + `job-${k}`); if (!job) continue;
        const {script, ctx, jobs} = unpack(job);
        const res = await runLocal(path.join(repo, script), jobs, ctx, threads);
        S.put(base + `res-${k}`, pack(res)); did = true;
        if (o.log) o.log(`chunk ${tag}/${k}: ${jobs.length} jobs`);
        break; // re-list: the leader may have moved on
      }
      if (did) break;
    }
    if (did) idleSince = now(); else await new Promise(r => setTimeout(r, 15000));
  }
}
module.exports = { store, distPool, markDone, helper, runLocal };
