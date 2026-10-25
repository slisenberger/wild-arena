// Random-board feasibility probe. Each game offers a random board of K animals; the other side is every board
// animal you don't pick. For random boards: screen every affordable team on the board (cheap), re-run the best
// few on fresh seeds, and report how winnable boards are by board size and budget.
// Usage: node board.js [boardsPerSize] [screenSeeds] [verifySeeds] [sizes e.g. 8,10,12] [budget] [total T, 0 = any]
// Env: PRICES=prices.json (an {id: $} map, or a price_board.js output with .proposed) to test candidate prices;
//      RAREP=0.1 chance of a rare animal per board. Boards are dealt with the game's own A.dealBoard.
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const SIM = process.env.SIM || './sim.js';
const A = require(SIM);
function tallest(t){ let b = null, h = 0; for (const id of t){ const m = A.BY_ID[id].mountH; if (m > h){ h = m; b = id; } } return b; }
if (!isMainThread){ parentPort.postMessage(workerData.jobs.map(j => ({k: j.k, s: A.simulate({team: j.team, board: j.board, groups: A.RULES.groups, terrain: j.tr, mode: 'wild', mount: tallest(j.team), seed: j.seed}).result.score}))); return; }
const NB = +process.argv[2] || 20, NS = +process.argv[3] || 2, NV = +process.argv[4] || 24, SIZES = (process.argv[5] || '8,10,12').split(',').map(Number), BUD = +process.argv[6] || 1000, TOT = +process.argv[7] || 0;
const PJ = process.env.PRICES ? JSON.parse(require('fs').readFileSync(process.env.PRICES, 'utf8')) : {}, PR = Object.assign({}, ...A.ANIMALS.map(a => ({[a.id]: a.price})), PJ.proposed || PJ);
const RAREP = process.env.RAREP !== undefined ? +process.env.RAREP : 0.1;
const TERR = Object.keys(A.TERRAINS), NW = 4, R = A.rng(2026);
const par = jobs => Promise.all([...Array(NW).keys()].map(wi => new Promise(res => { const w = new Worker(__filename, {workerData: {jobs: jobs.filter((_, i) => i % NW === wi)}}); w.on('message', res); }))).then(p => p.flat());
const mean = a => a.reduce((p, q) => p + q, 0) / a.length;
const boards = [];
for (const K of SIZES) for (let b = 0; b < NB; b++){
  const tr = TERR[Math.floor(R() * 4)], board = A.dealBoard(Math.floor(R() * 1e9) + 1, {board: K, total: TOT || null, tol: 100, rareP: RAREP, terrain: tr}, PR), teams = [];
  const minP = Math.min(...board.map(id => PR[id]));
  // every team that spends the budget down to less than the cheapest board animal
  for (let m = 1; m < (1 << K); m++){ let c = 0; const t = []; for (let i = 0; i < K; i++) if (m >> i & 1){ c += PR[board[i]]; t.push(board[i]); } if (c <= BUD && c > BUD - minP) teams.push(t); }
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
  console.log(`board probe: budget $${BUD}${TOT ? ', board total $' + TOT : ''}${process.env.PRICES ? ', prices ' + process.env.PRICES.split('/').pop() : ''}, ${NB} boards per size, screen ${NS} seeds, top 3 re-run on ${NV} fresh seeds; ${jobs.length + vj.length} fights, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  for (const K of SIZES){
    const bs = boards.filter(B => B.K === K).map(B => { const w = B.top.map(c => ({c, win: 100 * V[boards.indexOf(B) + '|' + c.ti].filter(x => x >= 300).length / NV})).sort((a, b) => b.win - a.win); return {B, best: w[0]}; });
    const wins = bs.map(x => x.best.win).sort((a, b) => a - b);
    const ele = bs.filter(x => x.B.board.includes('elephant')), noEle = bs.filter(x => !x.B.board.includes('elephant'));
    console.log(`\nboard of ${K} (other side = the other ${K}-minus-picks): best-team win% — min ${wins[0].toFixed(0)}, p25 ${wins[Math.floor(wins.length * .25)].toFixed(0)}, median ${wins[wins.length >> 1].toFixed(0)}, max ${wins[wins.length - 1].toFixed(0)}; boards with a ≥50% team: ${wins.filter(x => x >= 50).length}/${wins.length}; teams/board ~${Math.round(mean(bs.map(x => x.B.teams.length)))}`);
    console.log(`  elephant on board: median best ${ele.length ? ele.map(x => x.best.win).sort((a, b) => a - b)[ele.length >> 1].toFixed(0) : '-'}% (${ele.length})   no elephant on board: median best ${noEle.length ? noEle.map(x => x.best.win).sort((a, b) => a - b)[noEle.length >> 1].toFixed(0) : '-'}% (${noEle.length})`);
    // what a typical player gets: the median full-spend team's screen score, and the share of teams that won a screen run
    const typ = bs.map(x => { const bi = boards.indexOf(x.B), sc = x.B.teams.map((_, ti) => mean(M[bi + '|' + ti])).sort((a, b) => a - b); return {med: sc[sc.length >> 1], anyWin: x.B.teams.filter((_, ti) => M[bi + '|' + ti].some(v => v >= 300)).length / x.B.teams.length}; });
    const se = w => Math.sqrt(w * (100 - w) / NV);
    const champs = new Set(bs.map(x => x.best.c.t.slice().sort().join('+'))), eleBest = bs.filter(x => x.best.c.t.includes('elephant')).length;
    console.log(`  typical full-spend team: median score ${typ.map(t => t.med).sort((a, b) => a - b)[typ.length >> 1].toFixed(0)} s; teams with at least one screen win ${(100 * mean(typ.map(t => t.anyWin))).toFixed(0)}%; mean team size ${mean(bs.flatMap(x => x.B.teams.map(t => t.length))).toFixed(1)}`);
    console.log(`  ${champs.size} distinct best teams over ${bs.length} boards; elephant in ${eleBest} of them; best-team SE ±${se(wins[wins.length >> 1]).toFixed(0)} pts at the median`);
    bs.slice(0, 8).forEach(x => console.log(`  ${x.B.tr.padEnd(8)} board ${x.B.board.map(id => A.BY_ID[id].abbr).join(' ')}  → best ${x.best.c.t.map(id => A.BY_ID[id].abbr).join('+')} ${x.best.win.toFixed(0)}%`));
  }
})();
