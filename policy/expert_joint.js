// Milestone 4, joint training (research/network_components.md §8, research/speciation_strategy.md §3): every class learns
// in the same fights. Each round: (1) collect: fights played by every class's accepted ("incumbent") target net; a budgeted
// sample of decisions of EVERY class is labelled by the fair lookahead (copy the fight, hold each option H s, CRN rolls; the
// copies are played by the incumbents too, so a class learns against the opponents and teammates it will meet); (2) train:
// each class's student (target-mlp over rich inputs + species traits v2, gain regression, warm from its last student);
// (3) validate each class alone: student vs incumbent with every other class on its incumbent, paired fresh fights; a student
// replaces the incumbent only at >= 2 SE with no gate failures (no disengaging; species realism, bent only for the objective).
// Labelling only observes: the real fight's choices are the incumbents', so labels come from the game as played.
//   node policy/expert_joint.js init <state.json> [--classes=cat,harrier,brawler,charger,guard --rounds=4 --fights=600 --H=12
//        --rolls=2 --max=3 --every=3 --nh=32 --epochs=8 --lr=.002 --val=800 --seed=1 --Hg=20 (guards' horizon) --warm=true --real=0.5 (disengagement cost in labels)
//        (students start from rich-feature incumbents, widened) --inc=cls:weights.json,...]
//   node policy/expert_joint.js run <state.json> [--threads=N --hours=H]      (WA_DIST: spread batches over helper VMs)
//   node policy/expert_joint.js report <state.json>
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const fs = require('fs'), path = require('path'), os = require('os'), zlib = require('zlib');
const R = require('./move_run.js'), RW = require('./move_reward.js'), BC = require('./bc_target.js'), L = require('./lookahead.js'), PL = require('./plan.js');
const LIVE = require('./live.js'); require('./policy.js');
const A = R.A, I = A._internals, F = require('./features.js'), FR = require('./features_rich.js'), G = require('./guard_features.js'), TR = require('./traits.js');
const ZERO = {kind: 'target-lin', v: 1, nin: 200, margin: .25, wt: new Array(200).fill(0)}; // today's targets, through the hook
const clsOf = u => u.side === 'P' ? (u.rider ? null : 'guard') : I.archetypeOf(u);
function setInc(inc){ for (const k of Object.keys(I.LIVE_TARGET)) delete I.LIVE_TARGET[k]; Object.assign(I.LIVE_TARGET, inc); }

// ---------- worker ----------
if (!isMainThread){
  const {jobs, o, inc} = workerData; setInc(inc);
  let CTX = null;
  const label = (kind, w, u, h) => { // one sampled decision: branch each tried target, record rich features + branch scores
    const cls = clsOf(u); if (!cls || !CTX.classes.includes(cls)) return;
    if (((CTX.cnt[cls] = (CTX.cnt[cls] || 0) + 1) - 1) % (o.every * (cls === 'guard' ? 4 : 1))) return; // guards decide far more often: sampled 4x less
    const herb = kind === 'herb', g = kind === 'guard', ex = FR.extract(w, u, g ? {wide: true} : {herb}), opts = ex.opts;
    const teach = g ? G.heuristic(opts, h) : herb ? F.herbHeuristic(w, u, opts).i : F.heuristicIndex(w, u, opts);
    const tg = opts.map((x, i) => i).filter(i => opts[i].kind === 'target'); if (tg.length < 2) return;
    const others = tg.filter(i => i !== teach).sort((i, j) => I.dist(u, opts[i].t) - I.dist(u, opts[j].t)).slice(0, o.max);
    const tries = (teach >= 0 && opts[teach].kind === 'target' ? [teach] : []).concat(others), ui = w.units.indexOf(u), n = CTX.n++, sc = [];
    for (const i of tries){ let v = 0;
      for (let k = 0; k < o.rolls; k++){
        const c = L.cloneWorld(w, {noLabel: true}), cu = c.units[ui];
        c.R.seek((w.R.state() ^ Math.imul(n * 97 + 1 + 7919 * k, 0x9e3779b9)) >>> 0); // common random numbers across options
        const H = g && o.Hg ? o.Hg : o.H; // guards: a longer horizon (a 12-s look rewards leaving you for a fight you pay for later)
        cu.forceT = c.units[w.units.indexOf(opts[i].t)]; cu.forceUntil = c.t + H; cu.target = cu.forceT; cu.state = 'engage'; cu.carcass = null;
        // o.real (realism inside the label, research §2.2): the branch loses real x the share of its H s this animal spent
        // disengaged (slow and > 10 m from its target, or no target), so a teacher can't pay for holding off
        const t1 = c.t + H; let bad = 0; while (!c.over && c.t < t1){ A.step(c); if (o.real && I.active(cu)){ const tt = cu.target && I.active(cu.target) ? cu.target : null; if (!tt || (Math.hypot(cu.vx, cu.vy) < 1 && I.dist(cu, tt) > 10)) bad += .1; } }
        v += ((g ? -PL.score(c) : PL.score(c)) - (o.real || 0) * bad / H) / o.rolls; }
      sc.push(v); }
    const r4 = x => Math.round(x * 1e4) / 1e4;
    CTX.data.push({cls, sp: u.s.id, tr: TR.traitsV(u.s, 2), X: tries.map(i => ex.X[i].map(r4)), s: sc.map(r4), teach: tries.indexOf(teach)});
  };
  const wrap = (name, kind) => { const orig = I[name]; I[name] = function(w, u, policy, h){ if (CTX && !w.cfg.noLabel) label(kind, w, u, h); return orig(w, u, policy, h); }; };
  wrap('choose', 'pred'); wrap('chooseHerb', 'herb'); wrap('chooseGuard', 'guard');
  const out = [];
  for (const j of jobs){
    if (j.k === 'collect'){ CTX = {classes: o.classes, cnt: {}, n: 0, data: []}; R.runFight(j.f, null, 'cat'); out.push({k: j.k, i: j.i, data: CTX.data}); CTX = null; }
    else out.push({k: j.k, i: j.i, rec: R.runFight(j.f, j.W || null, j.cls)});
  }
  parentPort.postMessage(out); return;
}

// ---------- main ----------
const CMDS = ['init', 'run', 'report'], av = process.argv.slice(2), cmd = CMDS.includes(av[0]) ? av.shift() : 'run', [file, ...rest] = av;
const opt = Object.fromEntries(rest.filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v === undefined ? true : isNaN(+v) ? (v === 'true' ? true : v === 'false' ? false : v) : +v]; }));
const DEF = {classes: 'cat,harrier,brawler,charger,guard', rounds: 4, fights: 600, H: 12, rolls: 2, max: 3, every: 3, nh: 32, epochs: 8, lr: .002, val: 800, seed: 1, styleThr: .9, threads: Math.min(8, os.cpus().length)};
const DATA = file + '.data.jsonl.gz', log = m => { console.log(m); fs.appendFileSync(file + '.log', m + '\n'); };
const save = s => { fs.writeFileSync(file + '.tmp', JSON.stringify(s)); fs.renameSync(file + '.tmp', file); };
const readData = () => { if (!fs.existsSync(DATA)) return []; const B = zlib.gunzipSync(fs.readFileSync(DATA)), out = [];
  for (let i = 0; i < B.length;){ let j = B.indexOf(10, i); if (j < 0) j = B.length; if (j > i) out.push(JSON.parse(B.toString('utf8', i, j))); i = j + 1; } return out; };
const appendData = recs => { if (recs.length) fs.appendFileSync(DATA, zlib.gzipSync(recs.map(d => JSON.stringify(d)).join('\n') + '\n')); }; // gzip members concatenate
let s = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
if (cmd === 'report'){ if (!s) process.exit(1); const acc = Object.entries(s.incFrom).map(([k, v]) => `${k} ${v}`).join(', ');
  console.log(`[round ${s.round}/${s.config.rounds} ${s.phase}] incumbents: ${acc} | joint expert iteration, ${s.dataN || 0} decisions`); process.exit(0); }
if (cmd === 'init'){
  if (s) throw new Error(file + ' exists');
  const c = Object.assign({}, DEF, opt, {trainer: 'joint'}); c.classes = String(c.classes).split(',');
  const inc = {}, incFrom = {}; for (const k of c.classes){ const live = I.LIVE_TARGET[k]; inc[k] = live || ZERO; incFrom[k] = live ? 'live' : 'heuristic'; }
  if (c.inc) for (const e of String(c.inc).split(',')){ const [k, f] = e.split(':'); const W = JSON.parse(fs.readFileSync(path.join(__dirname, 'weights', f), 'utf8')); delete W.meta; inc[k] = W; incFrom[k] = f; } // --inc=harrier:harrier_target_e2.json: start a class from a candidate
  s = {format: 'wild-arena/expert-joint', simHash: R.simHash(), harnessHash: R.harnessHash(), config: c, inc, incFrom, stu: {}, spIds: {}, round: 0, phase: 'collect', dataN: 0, history: []};
  save(s); log(`[init] ${file}: ${JSON.stringify(c)} | incumbents ${JSON.stringify(incFrom)}`); process.exit(0);
}
if (!s) throw new Error('no state ' + file);
if (s.simHash !== R.simHash() && !process.env.ALLOW_ENGINE_MISMATCH) throw new Error(`${file} was made with sim ${s.simHash}; this checkout has ${R.simHash()}`);
const c = s.config, T = +opt.threads || c.threads, HOURS = +opt.hours || 0, T0 = Date.now(), timeUp = () => HOURS && Date.now() - T0 > HOURS * 3600e3;
const DIST = process.env.WA_DIST, Dm = DIST ? require('./dist.js') : null;
function pool(jobs){
  const ctx = {o: c, inc: s.inc};
  const p = DIST && jobs.length >= 48 ? Dm.distPool(DIST, __filename, jobs, ctx, {threads: T, chunk: jobs[0].k === 'collect' ? 16 : 200})
    : Promise.all([...Array(T).keys()].map(k => new Promise((res, rej) => { const w = new Worker(__filename, {workerData: Object.assign({jobs: jobs.filter((_, q) => q % T === k)}, ctx)}); w.on('message', res); w.on('error', rej); }))).then(x => x.flat());
  return p.then(r => r.sort((a, b) => a.i - b.i || (a.k < b.k ? -1 : a.k > b.k ? 1 : 0)));
}
const goalOf = k => k === 'guard' ? {goal: null, spec: false} : {goal: 'checkmate', spec: true};
async function validate(k, W, r){ // the student for class k vs its incumbent, everyone else on theirs
  const fights = R.fightSet('val', 1000 + 10 * r + c.classes.indexOf(k), c.val, Object.assign({arch: k, seed: c.seed + 7, withLive: true}, goalOf(k))), jobs = [];
  fights.forEach((f, i) => { jobs.push({k: 'inc', i, f, cls: k, W: null}, {k: 'stu', i, f, cls: k, W}); });
  const X = {}; (await pool(jobs)).forEach(x => { (X[x.k] = X[x.k] || [])[x.i] = x.rec; });
  const q = RW.paired(X.inc, X.stu, RW.reference(X.inc));
  return {diff: q.diff, se: q.se, style: q.styleB.style, gates: q.styleB.failed, drift: q.driftB, surv: RW.mean(X.stu.map(x => x.survived)) - RW.mean(X.inc.map(x => x.survived)), n: c.val};
}
(async () => {
  while (s.round < c.rounds){
    if (timeUp()){ log(`[time] ${HOURS} h used in round ${s.round} (${s.phase}); resume to continue`); return; }
    const r = s.round;
    if (s.phase === 'collect'){
      const t0 = Date.now(), fights = R.fightSet('train', 500 + r, c.fights, {arch: 'guard', seed: c.seed, withLive: true}); // any fight: your guards are always there
      const recs = (await pool(fights.map((f, i) => ({k: 'collect', i, f})))).flatMap(x => x.data);
      appendData(recs); s.dataN += recs.length; s.phase = 'train'; save(s);
      const by = {}; recs.forEach(d => by[d.cls] = (by[d.cls] || 0) + 1);
      log(`[round ${r} collect] ${recs.length} labelled decisions from ${fights.length} fights (${Object.entries(by).map(([k, v]) => k + ' ' + v).join(', ')}), ${s.dataN} total, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
    if (s.phase === 'train'){
      const D = readData();
      for (const k of c.classes){
        const Dk = D.filter(d => d.cls === k); if (Dk.length < 200){ log(`[round ${r} train ${k}] only ${Dk.length} decisions: skipped`); continue; }
        // species code: traits v2 + a one-hot over the class's species (fixed list, so warm starts keep their shape)
        const spIds = s.spIds[k] || (s.spIds[k] = A.ANIMALS.filter(a => k === 'guard' || I.archetypeOf({side: 'E', s: a}) === k).map(a => a.id)), TM = require('./target_model.js');
        const Dx = Dk.map(d => Object.assign({}, d, {tr: d.tr.concat(TM.spCode({spIds}, d.sp))}));
        // warm start: a rich-feature incumbent (an earlier winner) widened to traits v2 + the species one-hot (new inputs at 0)
        if (!s.stu[k] && s.inc[k] && s.inc[k].kind === 'target-mlp' && s.inc[k].feat === 'rich' && !s.inc[k].spIds && c.warm){ const TRm = require('./traits.js'), Wd = TM.widen(s.inc[k], (TRm.DIM2 - TRm.DIM) + spIds.length);
          s.stu[k] = Object.assign({}, Wd, {traitsV: 2, spIds}); log(`[round ${r} train ${k}] warm start from the incumbent (${s.incFrom[k]}), widened to ${Wd.nin} inputs`); }
        const st = s.stu[k], res = BC.trainAdv(Dx, {nh: c.nh, epochs: c.epochs, lr: c.lr, seed: c.seed + r, feat: 'rich', wide: k === 'guard'}, () => {}, st ? {theta: st.theta} : null);
        const P = Object.assign({}, res.P, {traitsV: 2, spIds, targetsOnly: true, feat: 'rich'}, k === 'guard' ? {wide: true} : {});
        s.stu[k] = P; log(`[round ${r} train ${k}] ${Dk.length} decisions: held-out gain ${res.best.gain.toFixed(4)} of ${res.oracle.toFixed(4)}, threshold ${res.P.margin}`);
      }
      s.phase = 'val'; save(s);
    }
    if (s.phase === 'val'){
      const acc = [];
      for (const k of c.classes){ const P = s.stu[k]; if (!P || P.margin >= 1000) continue;
        const v = await validate(k, P, r), ok = !v.gates.length && v.style >= c.styleThr && v.diff > 2 * v.se;
        s.history.push(Object.assign({round: r, cls: k}, v));
        if (ok){ s.inc[k] = P; s.incFrom[k] = `student r${r}`; acc.push(k); }
        log(`[round ${r} val ${k}] student vs incumbent (${s.incFrom[k]}${ok ? ', now replaced' : ''}) on ${v.n} fresh fights: ${v.diff >= 0 ? '+' : ''}${v.diff.toFixed(3)} ± ${v.se.toFixed(3)} | style ${v.style.toFixed(3)} gates [${v.gates}] drift [${v.drift.join('; ')}] | your survival ${(100 * v.surv).toFixed(1)} pts${ok ? '  -> accepted' : ''}`);
        save(s);
      }
      log(`[round ${r}] accepted: ${acc.join(', ') || 'none'} | incumbents ${JSON.stringify(s.incFrom)}`);
      s.round++; s.phase = 'collect'; save(s);
    }
  }
  if (s.phase !== 'done'){ s.phase = 'done'; save(s); if (DIST) Dm.markDone(DIST); log(`[done] incumbents ${JSON.stringify(s.incFrom)}`); }
})().catch(e => { console.error(e); process.exit(1); });
