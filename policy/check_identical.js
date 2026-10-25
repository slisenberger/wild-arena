// No-policy regression check: fingerprints of board fights (result.t, why, killer, event count, and a hash of the
// full event log) so the engine with the policy hook can be compared to the engine without it.
// Usage: [SIM=path/to/sim.js] [TEACHER=1] node policy/check_identical.js out.json [boards=2] [seeds=40]
//        node policy/check_identical.js --compare a.json b.json
const { isMainThread, parentPort, workerData } = require('worker_threads');
const fs = require('fs');
if (!isMainThread){
  const { A, cfgOf } = require('./common.js');
  const h = s => { let x = 2166136261; for (let i = 0; i < s.length; i++){ x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(16); };
  if (process.env.TEACHER) require('./policy.js'); // TEACHER=1: run through the policy hook with the heuristic as teacher
  parentPort.postMessage(workerData.jobs.map(j => { const c = cfgOf(j); if (process.env.TEACHER) c.policy = {teacher: true};
    const w = A.simulate(c), r = w.result;
    return {k: j.tr + '|' + j.seed, t: r.t, why: r.why || null, killer: r.killer || null, ne: w.events.length, eh: h(JSON.stringify(w.events))}; }));
  return;
}
if (process.argv[2] === '--compare'){
  const a = JSON.parse(fs.readFileSync(process.argv[3])), b = JSON.parse(fs.readFileSync(process.argv[4]));
  const B = Object.fromEntries(b.map(x => [x.k, x])); let diff = 0;
  for (const x of a){ const y = B[x.k]; if (!y || ['t', 'why', 'killer', 'ne', 'eh'].some(f => x[f] !== y[f])){ diff++; if (diff <= 5) console.log('DIFF', x, y); } }
  console.log(`${a.length} fights compared, ${diff} differ${a.length !== b.length ? ' (count mismatch ' + a.length + ' vs ' + b.length + ')' : ''}`);
  process.exit(diff ? 1 : 0);
}
const { boardJobs, pool } = require('./common.js');
const jobs = boardJobs(+process.argv[3] || 2, +process.argv[4] || 40, 31337);
pool(__filename, jobs).then(r => { r.sort((x, y) => x.k < y.k ? -1 : 1); fs.writeFileSync(process.argv[2], JSON.stringify(r)); console.log(`${r.length} fights fingerprinted -> ${process.argv[2]}`); });
