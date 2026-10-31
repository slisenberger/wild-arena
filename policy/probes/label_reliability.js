// Milestone 4, research/speciation_strategy.md Stage 1: how reliable are the lookahead's labels? For one class, play fights
// where the lookahead labels every decision with 2+ targets using 2K rolls per option, then split the rolls in half and compare:
//   - split-half reliability r = corr over (decision, option) of the gain vs today's pick, half A vs half B; a net trained on
//     K-roll labels can predict at most about r of their variance (Spearman-Brown 2r/(1+r) for the full 2K);
//   - best-option agreement between halves (vs chance), and the mean SE of a gain from K rolls;
// with fair dice (own dice per option) and with common random numbers (same dice per roll across options).
//   node policy/probes/label_reliability.js --arch=charger [--fights=150 --K=3 --H=8 --max=3 --index=1 --threads=N --out=f.json]
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path'), os = require('os'), fs = require('fs');
const R = require(path.join(__dirname, '..', 'move_run.js')), PL = require(path.join(__dirname, '..', 'plan.js'));
require(path.join(__dirname, '..', 'live.js')); require(path.join(__dirname, '..', 'policy.js'));
if (!isMainThread){
  const {fights, o} = workerData, out = [];
  for (const f of fights) for (const crn of [false, true]){ const data = [], g = o.arch === 'guard';
    const W = PL.makePlanner({H: o.H, max: o.max, cool: 0, rolls: 2 * o.K, data, arch: o.arch, side: g ? 'P' : 'E', only: g ? (o.only || null) : null, wide: g, crn, keepRolls: true});
    R.runFight(f, W, o.arch); out.push({crn, i: f.i, data: data.map(d => ({sp: d.sp, teach: d.teach, r: d.r}))}); }
  parentPort.postMessage(out); return;
}
const opt = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, isNaN(+v) ? v : +v]; }));
const o = {arch: opt.arch || 'charger', K: opt.K || 3, H: opt.H || 8, max: opt.max || 3, only: opt.only || null}, N = opt.fights || 150, T = opt.threads || os.cpus().length;
const fights = R.fightSet('probe', opt.index || 1, N, {arch: o.arch, seed: 77, withLive: true, withCat: o.arch === 'guard' && o.only === 'cat'});
const mean = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
function corr(x, y){ const mx = mean(x), my = mean(y); let a = 0, b = 0, c = 0; for (let i = 0; i < x.length; i++){ a += (x[i] - mx) * (y[i] - my); b += (x[i] - mx) ** 2; c += (y[i] - my) ** 2; } return a / Math.sqrt(b * c || 1); }
function stats(recs, K){
  const gA = [], gB = [], se = []; let agree = 0, nd = 0, chance = 0;
  for (const d of recs){ if (d.teach < 0 || d.r.length < 2) continue;
    const mA = d.r.map(x => mean(x.slice(0, K))), mB = d.r.map(x => mean(x.slice(K, 2 * K)));
    for (let j = 0; j < d.r.length; j++){ if (j === d.teach) continue; gA.push(mA[j] - mA[d.teach]); gB.push(mB[j] - mB[d.teach]);
      const dif = d.r[j].slice(0, K).map((v, k) => v - d.r[d.teach][k]), m = mean(dif); se.push(Math.sqrt(mean(dif.map(v => (v - m) ** 2)) * K / Math.max(1, K - 1) / K)); }
    const aA = mA.indexOf(Math.max(...mA)), aB = mB.indexOf(Math.max(...mB)); nd++; if (aA === aB) agree++; chance += 1 / d.r.length; }
  const r = corr(gA, gB);
  return {decisions: nd, pairs: gA.length, r: +r.toFixed(3), rFull: +(2 * r / (1 + r)).toFixed(3), bestAgree: +(agree / nd).toFixed(3), chance: +(chance / nd).toFixed(3),
    meanAbsGain: +mean(gA.map(Math.abs)).toFixed(4), meanSE: +mean(se).toFixed(4)};
}
const t0 = Date.now();
Promise.all([...Array(T).keys()].map(k => new Promise((res, rej) => { const w = new Worker(__filename, {workerData: {fights: fights.filter((_, q) => q % T === k), o}}); w.on('message', res); w.on('error', rej); }))).then(p => {
  const all = p.flat(), res = {arch: o.arch, only: o.only, fights: N, K: o.K, H: o.H, seconds: Math.round((Date.now() - t0) / 1000)};
  for (const crn of [false, true]) res[crn ? 'crn' : 'fair'] = stats(all.filter(x => x.crn === crn).flatMap(x => x.data), o.K);
  // per species (fair dice), species with 100+ decision pairs
  const bySp = {}; for (const x of all.filter(x => !x.crn)) for (const d of x.data) (bySp[d.sp] = bySp[d.sp] || []).push(d);
  res.species = Object.fromEntries(Object.entries(bySp).map(([s, v]) => [s, stats(v, o.K)]).filter(([, v]) => v.pairs >= 100));
  console.log(JSON.stringify(res, null, 1)); if (opt.out) fs.writeFileSync(opt.out, JSON.stringify(res, null, 1));
});
