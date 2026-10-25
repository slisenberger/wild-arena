// Random-board feasibility probe. Each game offers a random board of K animals; the other side is every board
// animal you don't pick. For random boards: screen every affordable team on the board (cheap), re-run the best
// few on fresh seeds, and report how winnable boards are by board size and budget.
// Usage: node board.js [boardsPerSize] [screenSeeds] [verifySeeds] [sizes e.g. 8,10,12] [budget]
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const SIM = process.env.SIM || './sim.js';
const A = require(SIM);
function tallest(t){ let b = null, h = 0; for (const id of t){ const m = A.BY_ID[id].mountH; if (m > h){ h = m; b = id; } } return b; }
if (!isMainThread){ parentPort.postMessage(workerData.jobs.map(j => ({k: j.k, s: A.simulate({team: j.team, board: j.board, terrain: j.tr, mode: 'wild', mount: tallest(j.team), seed: j.seed}).result.score}))); return; }
const NB = +process.argv[2] || 20, NS = +process.argv[3] || 2, NV = +process.argv[4] || 24, SIZES = (process.argv[5] || '8,10,12').split(',').map(Number), BUD = +process.argv[6] || 1000;
const TERR = Object.keys(A.TERRAINS), NW = 4, R = A.rng(2026);
const par = jobs => Promise.all([...Array(NW).keys()].map(wi => new Promise(res => { const w = new Worker(__filename, {workerData: {jobs: jobs.filter((_, i) => i % NW === wi)}}); w.on('message', res); }))).then(p => p.flat());
const mean = a => a.reduce((p, q) => p + q, 0) / a.length;
const boards = [];
for (const K of SIZES) for (let b = 0; b < NB; b++){
  const ids = A.ANIMALS.map(a => a.id); for (let i = ids.length - 1; i > 0; i--){ const j = Math.floor(R() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  const board = ids.slice(0, K), tr = TERR[Math.floor(R() * 4)], teams = [];
  for (let m = 1; m < (1 << K); m++){ let c = 0; const t = []; for (let i = 0; i < K; i++) if (m >> i & 1){ c += A.BY_ID[board[i]].price; t.push(board[i]); } if (c <= BUD && c > BUD - 200) teams.push(t); }
  boards.push({K, b, board, tr, teams});
}
const t0 = Date.now();
(async () => {
  const jobs = [];
  boards.forEach((B, bi) => B.teams.forEach((t, ti) => { for (let s = 0; s < NS; s++) jobs.push({k: bi + '|' + ti, team: t, board: B.board, tr: B.tr, seed: 11 + s * 7919 + bi * 31}); }));
  const r = await par(jobs), M = {}; r.forEach(x => (M[x.k] = M[x.k] || []).push(x.s));
  const vj = [];
  boards.forEach((B, bi) => { B.top = B.teams.map((t, ti) => ({t, ti, m: mean(M[bi + '|' + ti])})).sort((a, b) => b.m - a.m).slice(0, 3);
    B.top.forEach(c => { for (let s = 0; s < NV; s++) vj.push({k: bi + '|' + c.ti, team: c.t, board: B.board, tr: B.tr, seed: 900001 + s * 104729}); }); });
  const rv = await par(vj), V = {}; rv.forEach(x => (V[x.k] = V[x.k] || []).push(x.s));
  console.log(`board probe: budget $${BUD}, ${NB} boards per size, screen ${NS} seeds, top 3 re-run on ${NV} fresh seeds; ${jobs.length + vj.length} fights, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  for (const K of SIZES){
    const bs = boards.filter(B => B.K === K).map(B => { const w = B.top.map(c => ({c, win: 100 * V[boards.indexOf(B) + '|' + c.ti].filter(x => x >= 300).length / NV})).sort((a, b) => b.win - a.win); return {B, best: w[0]}; });
    const wins = bs.map(x => x.best.win).sort((a, b) => a - b);
    const ele = bs.filter(x => x.B.board.includes('elephant')), noEle = bs.filter(x => !x.B.board.includes('elephant'));
    console.log(`\nboard of ${K} (other side = the other ${K}-minus-picks): best-team win% — min ${wins[0].toFixed(0)}, p25 ${wins[Math.floor(wins.length * .25)].toFixed(0)}, median ${wins[wins.length >> 1].toFixed(0)}, max ${wins[wins.length - 1].toFixed(0)}; boards with a ≥50% team: ${wins.filter(x => x >= 50).length}/${wins.length}; teams/board ~${Math.round(mean(bs.map(x => x.B.teams.length)))}`);
    console.log(`  elephant on board: median best ${ele.length ? ele.map(x => x.best.win).sort((a, b) => a - b)[ele.length >> 1].toFixed(0) : '-'}% (${ele.length})   no elephant on board: median best ${noEle.length ? noEle.map(x => x.best.win).sort((a, b) => a - b)[noEle.length >> 1].toFixed(0) : '-'}% (${noEle.length})`);
    bs.slice(0, 6).forEach(x => console.log(`  ${x.B.tr.padEnd(8)} board ${x.B.board.map(id => A.BY_ID[id].abbr).join(' ')}  → best ${x.best.c.t.map(id => A.BY_ID[id].abbr).join('+')} ${x.best.win.toFixed(0)}%`));
  }
})();
