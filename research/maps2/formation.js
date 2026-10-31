// Does formation matter? Paired test of the maps2 prototype (terrain features) against the plain maps.
// Cases: dealt boards (12 animals, total $2,600, rares 30%, the game's dealBoard) with a player-like full-spend team ($1,200:
// shuffle the board, take what fits), each on a fixed map (cfg.mapSeed) so the terrain stays put while fight seeds vary.
// Per case and arm (maps2 off / on), candidates: the default formation, the default formation moved as a whole to 14 spots on
// your side (a 3 x 5 grid; camp.js style), and K random formations (you anywhere on your side; each animal an escort near
// you or a guard post anywhere on your side). All are made legal with the arm's own clampPlace; same candidates in both arms.
// Successive halving: every candidate on S common fight seeds, the top 6 (the default always kept) on 3S more, then the best
// of those and the default re-run on V fresh common seeds. Gain = best - default (s); 0 when the default itself comes out
// best. The re-run removes the screening luck, so a positive mean gain means some formation really beats the default.
// Usage: node research/maps2/formation.js [casesPerMap=10] [K=9] [S=4] [V=40] [workers=4]
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path');
const A = require(process.env.SIM || path.join(__dirname, '..', '..', 'sim.js'));
if (!isMainThread){ parentPort.postMessage(workerData.jobs.map(j => { const w = A.simulate(j.cfg); return {k: j.k, s: w.result.score, why: w.result.why || (w.result.survived ? 'time' : 'dead')}; })); return; }
const NC = +process.argv[2] || 10, K = +process.argv[3] || 9, NS = +process.argv[4] || 4, NV = +process.argv[5] || 40, NW = +process.argv[6] || 4;
const TERR = Object.keys(A.TERRAINS), R = A.rng(20261028);
const par = jobs => Promise.all([...Array(NW).keys()].map(wi => new Promise((res, rej) => { const w = new Worker(__filename, {workerData: {jobs: jobs.filter((_, i) => i % NW === wi)}}); w.on('message', res); w.on('error', rej); }))).then(p => p.flat());
const mean = a => a.reduce((p, q) => p + q, 0) / Math.max(1, a.length);
const se = a => { const m = mean(a); return Math.sqrt(a.reduce((p, q) => p + (q - m) ** 2, 0) / Math.max(1, a.length - 1) / Math.max(1, a.length)); };
const cases = [];
for (let c = 0; c < NC * 4; c++){
  const terrain = TERR[c % 4], board = A.dealBoard(1 + Math.floor(R() * 1e9), {board: 12, total: 2600, tol: 100, rareP: .3, terrain});
  const order = board.slice(); for (let k = order.length - 1; k > 0; k--){ const j = Math.floor(R() * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; }
  const team = []; let left = 1200; for (const id of order) if (A.BY_ID[id].price <= left){ team.push(id); left -= A.BY_ID[id].price; }
  const mapSeed = 1 + Math.floor(R() * 1e9);
  // random formations as fractions of your side (u, v in [0, 1]) so each arm maps them onto its own legal zone
  const forms = [null]; for (const gu of [.15, .5, .85]) for (const gv of [.1, .3, .5, .7, .9]) if (!(gu === .5 && gv === .5)) forms.push({shift: [gu, gv]});
  for (let f = 0; f < K; f++){ const fm = {you: [R(), R()], an: {}}; for (const id of team) fm.an[id] = R() < .5 ? {esc: [(R() - .5) * 14, (R() - .5) * 14]} : {post: [R(), R()]}; forms.push(fm); }
  cases.push({c, terrain, board, team, mapSeed, forms});
}
function cfgOf(cs, f, m2, seed){
  const cfg = {board: cs.board, team: cs.team, terrain: cs.terrain, mode: 'wild', mount: A.defaultMount(cs.team), seed, mapSeed: cs.mapSeed};
  if (m2) cfg.maps2 = true;
  const fm = cs.forms[f]; if (!fm) return cfg;
  const V = A.mapVariant(cs.terrain, cs.mapSeed, {maps2: !!m2}), z = A.zoneFor(cs.terrain, V);
  if (fm.shift){ cfg.human = A.clampPlace(cs.terrain, A.HUMAN, z.x0 + fm.shift[0] * (z.x1 - z.x0), z.y0 + fm.shift[1] * (z.y1 - z.y0), V); return cfg; } // default offsets around you (setup makes each legal)
  const you = A.clampPlace(cs.terrain, A.HUMAN, z.x0 + fm.you[0] * (z.x1 - z.x0), z.y0 + fm.you[1] * (z.y1 - z.y0), V);
  cfg.human = you; cfg.placements = {};
  for (const id of cs.team){ const a = fm.an[id], s = A.BY_ID[id];
    const p = a.esc ? A.clampPlace(cs.terrain, s, you.x + a.esc[0], you.y + a.esc[1], V) : A.clampPlace(cs.terrain, s, z.x0 + a.post[0] * (z.x1 - z.x0), z.y0 + a.post[1] * (z.y1 - z.y0), V);
    cfg.placements[id] = {dx: p.x - you.x, dy: p.y - you.y}; }
  return cfg;
}
const t0 = Date.now();
(async () => {
  const jobs = [], NF = cases[0].forms.length;
  for (const cs of cases) for (const m2 of [false, true]) for (let f = 0; f < NF; f++) for (let s = 0; s < NS; s++) jobs.push({k: `${cs.c}|${+m2}|${f}`, cfg: cfgOf(cs, f, m2, 1000 + s * 7919 + cs.c * 31)});
  const r1 = await par(jobs), S = {}; for (const x of r1) (S[x.k] = S[x.k] || []).push(x.s);
  const j2 = [], top = {};
  for (const cs of cases) for (const m2 of [false, true]){
    const ord = [...Array(NF).keys()].sort((a, b) => mean(S[`${cs.c}|${+m2}|${b}`]) - mean(S[`${cs.c}|${+m2}|${a}`])), t = [0, ...ord.filter(f => f).slice(0, 5)];
    top[`${cs.c}|${+m2}`] = t;
    for (const f of t) for (let s = NS; s < 4 * NS; s++) j2.push({k: `${cs.c}|${+m2}|${f}`, cfg: cfgOf(cs, f, m2, 1000 + s * 7919 + cs.c * 31)});
  }
  for (const x of await par(j2)) S[x.k].push(x.s);
  const vj = [], best = {};
  for (const cs of cases) for (const m2 of [false, true]){
    let bf = 0, bm = -1; for (const f of top[`${cs.c}|${+m2}`]){ const m = mean(S[`${cs.c}|${+m2}|${f}`]); if (m > bm){ bm = m; bf = f; } }
    best[`${cs.c}|${+m2}`] = bf;
    for (let s = 0; s < NV; s++) for (const f of bf ? [0, bf] : [0]) vj.push({k: `${cs.c}|${+m2}|${f === 0 ? 'D' : 'B'}|${s}`, cfg: cfgOf(cs, f, m2, 900001 + s * 104729 + cs.c * 17)});
  }
  const r2 = await par(vj), V = {}; for (const x of r2) V[x.k] = x;
  for (const k in V) if (k.includes('|D|')){ const kb = k.replace('|D|', '|B|'); if (!V[kb]) V[kb] = V[k]; } // the default came out best: gain 0
  if (process.env.DEBUG) for (const cs of cases) for (const m2 of [0, 1]){ const bf = best[`${cs.c}|${m2}`]; console.log(cs.c, cs.terrain, m2, 'screen', [...Array(NF).keys()].map(f => mean(S[`${cs.c}|${m2}|${f}`]).toFixed(0)).join(' '), 'best', bf, 'verify D', mean([...Array(NV).keys()].map(s => V[`${cs.c}|${m2}|D|${s}`].s)).toFixed(0), 'B', mean([...Array(NV).keys()].map(s => V[`${cs.c}|${m2}|B|${s}`].s)).toFixed(0)); }
  console.log(`formation test: ${cases.length} cases (${NC}/map), default + 14 moved + ${K} random formations, screen ${NS} seeds, top 6 on ${3 * NS} more, best vs default re-run on ${NV} fresh seeds; ${jobs.length + j2.length + vj.length} fights, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  const rows = {};
  for (const cs of cases) for (const m2 of [0, 1]){
    const d = [], b = [], df = [];
    for (let s = 0; s < NV; s++){ const D = V[`${cs.c}|${m2}|D|${s}`].s, B = V[`${cs.c}|${m2}|B|${s}`].s; d.push(D); b.push(B); df.push(B - D); }
    const scr = []; for (let f = 0; f < NF; f++) scr.push(mean(S[`${cs.c}|${m2}|${f}`].slice(0, NS)));
    (rows[cs.terrain + '|' + m2] = rows[cs.terrain + '|' + m2] || []).push({kept: !best[`${cs.c}|${m2}`], def: mean(d), best: mean(b), gain: mean(df), gse: se(df), defWin: d.filter(x => x >= 300).length / NV, bestWin: b.filter(x => x >= 300).length / NV, spread: Math.max(...scr) - Math.min(...scr), sd: Math.sqrt(mean(scr.map(x => (x - mean(scr)) ** 2)))});
  }
  const line = (lbl, rs) => `${lbl.padEnd(14)} default ${mean(rs.map(r => r.def)).toFixed(0).padStart(3)} s (win ${(100 * mean(rs.map(r => r.defWin))).toFixed(0)}%)  best ${mean(rs.map(r => r.best)).toFixed(0).padStart(3)} s (win ${(100 * mean(rs.map(r => r.bestWin))).toFixed(0)}%)  gain ${mean(rs.map(r => r.gain)).toFixed(1).padStart(5)} ± ${se(rs.map(r => r.gain)).toFixed(1)} s  cases with gain > 2 SE ${rs.filter(r => r.gain > 2 * r.gse).length}/${rs.length}, default kept ${rs.filter(r => r.kept).length}  screen SD across formations ${mean(rs.map(r => r.sd)).toFixed(0)} s`;
  for (const tr of [...TERR, 'all']) for (const m2 of [0, 1]){
    const rs = tr === 'all' ? TERR.flatMap(t => rows[t + '|' + m2]) : rows[tr + '|' + m2];
    console.log(line(`${tr} ${m2 ? 'maps2' : 'plain'}`, rs));
  }
  // paired difference of the gains (same cases, same random formations)
  for (const tr of [...TERR, 'all']){
    const off = tr === 'all' ? TERR.flatMap(t => rows[t + '|0']) : rows[tr + '|0'], on = tr === 'all' ? TERR.flatMap(t => rows[t + '|1']) : rows[tr + '|1'];
    const dd = on.map((r, i) => r.gain - off[i].gain), dsd = on.map((r, i) => r.sd - off[i].sd);
    console.log(`${tr.padEnd(8)} maps2 - plain: formation gain ${mean(dd) >= 0 ? '+' : ''}${mean(dd).toFixed(1)} ± ${se(dd).toFixed(1)} s; screen SD ${mean(dsd) >= 0 ? '+' : ''}${mean(dsd).toFixed(1)} ± ${se(dsd).toFixed(1)} s; default ${mean(on.map((r, i) => r.def - off[i].def)).toFixed(1)} ± ${se(on.map((r, i) => r.def - off[i].def)).toFixed(1)} s`);
  }
})().catch(e => { console.error(e); process.exit(1); });
