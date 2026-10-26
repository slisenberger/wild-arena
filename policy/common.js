// Shared helpers for the policy tools: board fights with player-like teams, and a 4-worker pool.
// A player-like team = shuffle the dealt board and take whatever still fits the budget (same as audit.js).
const { Worker } = require('worker_threads');
const path = require('path');
const SIM = process.env.SIM ? path.resolve(process.env.SIM) : path.join(__dirname, '..', 'sim.js');
const A = require(SIM);
const TERR = Object.keys(A.TERRAINS);

// nBoards boards per map, nSeeds fight seeds per board; seedBase keeps different tools/rounds on different streams
function boardJobs(nBoards, nSeeds, seedBase){
  const R = A.rng(seedBase), jobs = [];
  for (const tr of TERR) for (let b = 0; b < nBoards; b++){
    const board = A.dealBoard(Math.floor(R() * 1e9) + 1, {terrain: tr});
    const order = board.slice(); for (let k = order.length - 1; k > 0; k--){ const q = Math.floor(R() * (k + 1)); [order[k], order[q]] = [order[q], order[k]]; }
    const team = []; let left = A.RULES.budget; for (const id of order) if (A.BY_ID[id].price <= left){ team.push(id); left -= A.BY_ID[id].price; }
    for (let s = 0; s < nSeeds; s++) jobs.push({board, team, tr, mount: A.defaultMount(team), seed: seedBase * 1000 + 17 + s * 7919 + b * 104729 + TERR.indexOf(tr) * 31});
  }
  return jobs;
}
function cfgOf(j){ return {team: j.team, board: j.board, terrain: j.tr, mode: 'wild', mount: j.mount, seed: j.seed, livePolicy: false}; }

// run jobs on NW workers: the worker script gets workerData {jobs, ...extra} and posts back an array
function pool(script, jobs, extra, NW){
  NW = NW || 4;
  return Promise.all([...Array(NW).keys()].map(wi => new Promise((res, rej) => {
    const w = new Worker(script, {workerData: Object.assign({jobs: jobs.filter((_, i) => i % NW === wi)}, extra || {}), env: process.env});
    w.on('message', res); w.on('error', rej);
  }))).then(p => p.flat());
}
const mean = a => a.length ? a.reduce((p, q) => p + q, 0) / a.length : 0;
const se = a => a.length > 1 ? Math.sqrt(a.reduce((p, q) => p + (q - mean(a)) ** 2, 0) / (a.length - 1) / a.length) : 0;
module.exports = { A, SIM, TERR, boardJobs, cfgOf, pool, mean, se };
