// Independent check of a trained other-side archetype policy (cat / charger / bulldozer / brawler / kicker) on a fresh probe
// draw: paired fights, the trained weights vs no policy for that archetype, with the shipped policies (policy/live.js) on for
// everything else, as in the live game. Usage: node policy/probes/eval_arch.js <state.json> [N=1200] [probeIndex=41]
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path');
const M = require(path.join(__dirname, '..', 'move_model.js')), R = require(path.join(__dirname, '..', 'move_run.js')), RW = require(path.join(__dirname, '..', 'move_reward.js'));
if (!isMainThread){ parentPort.postMessage(workerData.jobs.map(j => ({k: j.k, i: j.i, rec: R.runFight(j.f, j.W, workerData.arch)}))); return; }
const [file, n, idx] = process.argv.slice(2), N = +n || 1200, s = require(path.resolve(file)), arch = s.config.arch;
const W = M.unflat(s.P0, s.best.theta, s.config.mode), fights = R.fightSet('probe', +idx || 41, N, {arch, seed: 77, withLive: true}), jobs = [];
fights.forEach((f, i) => { jobs.push({k: 'base', i, f, W: null}, {k: 'learned', i, f, W}); });
Promise.all([0, 1, 2, 3].map(k => new Promise(res => { const w = new Worker(__filename, {workerData: {arch, jobs: jobs.filter((_, q) => q % 4 === k)}}); w.on('message', res); }))).then(p => {
  const X = {}; p.flat().forEach(o => { (X[o.k] = X[o.k] || [])[o.i] = o.rec; });
  const ref = RW.reference(X.base), q = RW.paired(X.base, X.learned, ref), d = f => RW.mean(X.learned.map((r, i) => (f(r) || 0) - (f(X.base[i]) || 0)));
  console.log(`${file} (${arch}): ${N} fresh probe fights (index ${+idx || 41}), shipped policies on for the rest`);
  console.log(`learned vs none  goal ${q.diff >= 0 ? '+' : ''}${q.diff.toFixed(3)} ± ${q.se.toFixed(3)} | style ${q.styleB.style.toFixed(2)} gates [${q.styleB.failed}] drift [${q.driftB.join('; ')}] | kills of you ${(100 * d(r => r.killedYou)).toFixed(1)} pts, dmg to you ${d(r => r.dmgHuman).toFixed(1)}, dmg to your side ${d(r => r.dmgFoe).toFixed(0)}, own deaths ${d(r => r.deaths).toFixed(2)}`);
  const AR = require(path.join(__dirname, '..', 'move_arch.js')).arch(arch), names = AR.intents || R.A._internals.MOVE_INTENTS || [], c = [];
  for (const r of X.learned) (r.intents || []).forEach((v, k) => c[k] = (c[k] || 0) + v);
  const tot = c.reduce((a, b) => a + (b || 0), 0);
  if (tot) console.log('intent shares: ' + c.map((v, k) => `${names[k] || k} ${(100 * (v || 0) / tot).toFixed(1)}%`).join(', '));
});
