// Progressive mode, round 1: does it need real choices? Deals round-1 boards exactly as a run does, simulates every
// affordable full-spend team on each (common seeds), and reports how many teams win, the best team per board, and how
// often each animal is in the boards' top teams. node progressive_r1.js [boards=16] [seeds=4]
const {Worker, isMainThread, parentPort, workerData} = require('worker_threads');
const P = require('./progressive.js'), A = require('./sim.js');
if (!isMainThread){
  parentPort.postMessage(workerData.jobs.map(j => ({b: j.b, key: j.team.join('+'), s: A.simulate({board: j.board, team: j.team, terrain: j.terrain, mode: 'wild', seed: j.seed, mount: A.defaultMount(j.team)}).result})));
  return;
}
const NB = +process.argv[2] || 16, NS = +process.argv[3] || 4, NW = 4, jobs = [], boards = [];
const combos = (a, k) => k === 0 ? [[]] : a.flatMap((x, i) => combos(a.slice(i + 1), k - 1).map(c => [x].concat(c)));
for (let b = 0; b < NB; b++){
  const run = P.newRun(9000 + b), n = Math.floor(run.money / 100);
  boards.push(run);
  for (const team of combos(run.board, n)) for (let s = 0; s < NS; s++) jobs.push({b, board: run.board, team, terrain: run.terrain, seed: P.hash('r1:' + b + ':' + s)});
}
const t0 = Date.now();
Promise.all([...Array(NW).keys()].map(i => new Promise(res => { const w = new Worker(__filename, {workerData: {jobs: jobs.filter((_, k) => k % NW === i)}}); w.on('message', res); }))).then(p => {
  const R = {}; for (const o of p.flat()){ const k = o.b + '|' + o.key; (R[k] = R[k] || []).push(o.s.survived ? 1 : 0); }
  console.log(`${jobs.length} fights in ${((Date.now() - t0) / 1000).toFixed(0)} s; ${NB} round-1 boards, ${NS} seeds per team`);
  const top = {}, bestKeys = {}; let allW = [];
  for (let b = 0; b < NB; b++){
    const rows = Object.entries(R).filter(([k]) => k.startsWith(b + '|')).map(([k, v]) => [k.split('|')[1], v.reduce((x, y) => x + y, 0) / v.length]).sort((x, y) => y[1] - x[1]);
    allW = allW.concat(rows.map(r => r[1]));
    const best = rows[0], always = rows.filter(r => r[1] === 1).length, half = rows.filter(r => r[1] >= .5).length;
    bestKeys[best[0]] = (bestKeys[best[0]] || 0) + 1;
    for (const [k] of rows.slice(0, 5)) for (const id of k.split('+')) top[id] = (top[id] || 0) + 1;
    console.log(`board ${b + 1} (${boards[b].terrain}): ${rows.length} teams, mean win ${(100 * rows.reduce((s, r) => s + r[1], 0) / rows.length).toFixed(0)}%, ${half} win ≥ 50%, ${always} won every seed; worst ${(100 * rows[rows.length - 1][1]).toFixed(0)}%; best ${best[0]} ${(100 * best[1]).toFixed(0)}%`);
  }
  console.log(`all teams: mean win ${(100 * allW.reduce((a, b) => a + b, 0) / allW.length).toFixed(0)}%`);
  console.log(`distinct best teams: ${Object.keys(bestKeys).length} over ${NB} boards`);
  console.log('appearances in a board\'s top 5 teams: ' + Object.entries(top).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${id} ${n}`).join(', '));
});
