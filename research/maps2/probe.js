// maps2 telemetry, paired: the same dealt boards, player-like full-spend teams (default formation) and seeds, with and
// without cfg.maps2. Per fight: score, how it ended, first hit, longest stretch with no damage either way, idle share per
// side (audit.js's states), stuck animals, time spent outside the closing arena once it has closed, hazard deaths.
// Stuck = an animal that wants to move (closing on a target > 3 m out of reach, fleeing, or outside the safe box) and has
// moved < 1 m over the last 4 s (crocs and walruses, which wait in the water on purpose,
// aren't counted); "beside a feature" = within 3 m of where this map's maps2 features are (or would be, without the flag).
// Usage: node research/maps2/probe.js [fightsPerMap=150] [workers=4]
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path');
const A = require(process.env.SIM || path.join(__dirname, '..', '..', 'sim.js'));
function stateOf(u){
  if (u.heatstroke || u.state === 'cool') return 'heat';
  if (u.state === 'flee' || u.state === 'withdraw') return 'flee';
  if (u.state === 'feed' || u.state === 'rest') return 'feed';
  if (u.state === 'carry') return 'carry';
  if (u.latchOn || u.latchedBy) return 'fight';
  if (u.target && u.state === 'engage'){ const t = u.target, d = Math.hypot(u.x - t.x, u.y - t.y); return d < u.r + t.r + u.s.reach + 1.5 ? 'fight' : 'close'; }
  return 'idle';
}
const act = u => u.state !== 'dead' && !u.escaped && !u.penned;
function run(j){
  const w = A.setup(j.cfg), hist = new Map();
  const O2 = A.mapVariant(j.cfg.terrain, j.cfg.seed, {maps2: true}).obst; // where the features are (or would be, without the flag)
  let stuckO = 0, dmg = 0, last = 0, gap = 0, first = null, stuck = 0, stuckUnits = new Set(), outT = 0, idle = {P: 0, E: 0}, alive = {P: 0, E: 0}, n = 0;
  while (!w.over){
    A.step(w); n++;
    const d = w.units.reduce((s, u) => s + u.st.dealt, 0);
    if (d > dmg + 1e-9){ if (first === null) first = w.t; dmg = d; gap = Math.max(gap, w.t - last); last = w.t; }
    for (const u of w.units){ if (u.side === 'H' || !act(u)) continue; alive[u.side] += A.DT; if (stateOf(u) === 'idle') idle[u.side] += A.DT; }
    if (w.zb && w.zb.p >= 1) for (const u of w.units) if (act(u) && !u.routing && !u.riding && (u.x < w.zb.x0 || u.x > w.zb.x1 || u.y < w.zb.y0 || u.y > w.zb.y1)) outT += A.DT;
    if (n % 10 === 0) for (const u of w.units){
      if (u.side === 'H' || !act(u) || u.riding || u.onTree || u.latchOn || u.latchedBy || u.stun > 0 || u.s.tags.includes('waterbound') || u.s.tags.includes('shoreGuard')) { hist.delete(u); continue; } // (crocs and walruses lie in wait by design)
      const t = u.target, z = w.zb, out = z && z.p > 0 && (u.x < z.x0 || u.x > z.x1 || u.y < z.y0 || u.y > z.y1);
      const wants = out || u.state === 'flee' || (u.state === 'engage' && t && act(t) && Math.hypot(u.x - t.x, u.y - t.y) > u.r + t.r + u.s.reach + 3);
      if (!wants){ hist.delete(u); continue; }
      const h = hist.get(u) || []; h.push([u.x, u.y]); if (h.length > 5) h.shift(); hist.set(u, h);
      if (h.length === 5 && Math.hypot(h[4][0] - h[0][0], h[4][1] - h[0][1]) < 1){ stuck += 1; stuckUnits.add(u); if (!(u.mv && u.mv.k === 'wheel') && O2.some(o => Math.hypot(o.x - u.x, o.y - u.y) < o.r + u.r + 3)) stuckO += 1; }
    }
  }
  if (w.result.t - last > gap) gap = w.result.t - last;
  const nU = w.units.filter(u => u.side !== 'H').length;
  return {k: j.k, m2: j.m2, tr: j.cfg.terrain, score: w.result.score, why: w.result.why || (w.result.survived ? 'time' : 'dead'), t: w.result.t, killer: w.result.killer || null,
    first: first === null ? w.result.t : first, gap, stuck, stuckO, stuckFrac: stuckUnits.size / nU, outT, idleP: idle.P / Math.max(1e-9, alive.P), idleE: idle.E / Math.max(1e-9, alive.E),
    hazardDeath: !w.result.survived && !A.BY_ID[w.result.killer]};
}
if (!isMainThread){ parentPort.postMessage(workerData.jobs.map(run)); return; }
const NPM = +process.argv[2] || 150, NW = +process.argv[3] || 4, TERR = Object.keys(A.TERRAINS), R = A.rng(777);
const jobs = [];
for (let i = 0; i < NPM * 4; i++){
  const terrain = TERR[i % 4], board = A.dealBoard(1 + Math.floor(R() * 1e9), {board: 12, total: 2600, tol: 100, rareP: .3, terrain});
  const order = board.slice(); for (let k = order.length - 1; k > 0; k--){ const j = Math.floor(R() * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; }
  const team = []; let left = 1200; for (const id of order) if (A.BY_ID[id].price <= left){ team.push(id); left -= A.BY_ID[id].price; }
  const cfg = {board, team, terrain, mode: 'wild', mount: A.defaultMount(team), seed: 1 + Math.floor(R() * 1e9)};
  for (const m2 of [false, true]) jobs.push({k: i, m2, cfg: Object.assign({maps2: m2}, cfg)});
}
const par = jobs => Promise.all([...Array(NW).keys()].map(wi => new Promise((res, rej) => { const w = new Worker(__filename, {workerData: {jobs: jobs.filter((_, i) => i % NW === wi)}}); w.on('message', res); w.on('error', rej); }))).then(p => p.flat());
const mean = a => a.reduce((p, q) => p + q, 0) / Math.max(1, a.length);
const se = a => { const m = mean(a); return Math.sqrt(a.reduce((p, q) => p + (q - m) ** 2, 0) / Math.max(1, a.length - 1) / Math.max(1, a.length)); };
const med = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const pct = (a, b) => (100 * a / Math.max(1, b)).toFixed(1) + '%';
const t0 = Date.now();
par(jobs).then(r => {
  console.log(`maps2 probe: ${NPM} fights per map x 2 (off / on), paired (same board, team, seed), ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  const by = {}; for (const x of r) (by[x.k] = by[x.k] || {})[x.m2 ? 'on' : 'off'] = x;
  for (const tr of [...TERR, 'all']){
    const ps = Object.values(by).filter(p => tr === 'all' || p.off.tr === tr);
    const line = (k, f) => { const off = ps.map(p => f(p.off)), on = ps.map(p => f(p.on)), dd = ps.map(p => f(p.on) - f(p.off)); return `${k} ${mean(off).toFixed(2)} -> ${mean(on).toFixed(2)} (diff ${mean(dd) >= 0 ? '+' : ''}${mean(dd).toFixed(2)} ± ${se(dd).toFixed(2)})`; };
    const ends = s => ['dead', 'time', 'cleared', 'quiet'].map(e => e + ' ' + pct(ps.filter(p => p[s].why === e).length, ps.length)).join(', ');
    console.log(`\n${tr} (${ps.length} pairs)`);
    console.log('  ' + line('score s', x => x.score) + '; win% ' + pct(ps.filter(p => p.off.score >= 300).length, ps.length) + ' -> ' + pct(ps.filter(p => p.on.score >= 300).length, ps.length));
    console.log('  ends off: ' + ends('off') + ' | on: ' + ends('on'));
    console.log('  ' + line('fight length s', x => x.t) + '; ' + line('first hit s', x => x.first));
    console.log(`  longest no-damage stretch median ${med(ps.map(p => p.off.gap)).toFixed(1)} -> ${med(ps.map(p => p.on.gap)).toFixed(1)} s, p90 ${med(ps.map(p => p.off.gap).sort((a, b) => a - b).slice(Math.floor(ps.length * .8)))?.toFixed(1)} -> ${med(ps.map(p => p.on.gap).sort((a, b) => a - b).slice(Math.floor(ps.length * .8)))?.toFixed(1)}`);
    console.log('  ' + line('idle share yours', x => x.idleP) + '; ' + line('idle share theirs', x => x.idleE));
    console.log('  ' + line('stuck animal-s per fight', x => x.stuck) + '; ' + line('of which beside a feature (not wheeling)', x => x.stuckO) + '; ' + line('share of animals ever stuck', x => x.stuckFrac));
    console.log('  ' + line('animal-s outside the closed arena', x => x.outT) + `; hazard deaths ${ps.filter(p => p.off.hazardDeath).length} -> ${ps.filter(p => p.on.hazardDeath).length}`);
  }
}).catch(e => { console.error(e); process.exit(1); });
