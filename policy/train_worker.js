// Milestone 3 worker: runs any shard of a generation's jobs file and writes plain JSON results.
//   node policy/train_worker.js jobs.json out.json [i/n] [--threads=k]
// Task k of the jobs file (sets × their candidates × their fights, in that order; see tasksOf) belongs to shard i when
// k % n === i. Each record depends only on (fight, weights), so any split, machine or thread count gives the same merge.
// The worker refuses a jobs file built for a different sim.js / harness (hash mismatch) unless ALLOW_ENGINE_MISMATCH=1.
const { isMainThread, parentPort, workerData, Worker } = require('worker_threads');
const fs = require('fs');
const os = require('os');
const R = require('./move_run.js');

const JOBS_FORMAT = 'wild-arena/move-jobs', OUT_FORMAT = 'wild-arena/move-results', VERSION = 1;
function tasksOf(jobs){
  const out = []; let k = 0;
  jobs.sets.forEach((s, si) => { for (const c of s.cands) for (let f = 0; f < s.fights.length; f++) out.push({k: k++, s: si, c, f}); });
  return out;
}
function shardTasks(jobs, i, n){ return tasksOf(jobs).filter(t => t.k % n === i); }
function runShardTasks(jobs, tasks){
  return tasks.map(t => ({k: t.k, rec: R.runFight(jobs.sets[t.s].fights[t.f], jobs.cands[t.c], jobs.arch)}));
}
function checkJobs(jobs){
  if (jobs.format !== JOBS_FORMAT || jobs.version !== VERSION) throw new Error(`not a v${VERSION} ${JOBS_FORMAT} file`);
  const sh = R.simHash(), hh = R.harnessHash();
  if ((jobs.simHash !== sh || jobs.harnessHash !== hh) && !process.env.ALLOW_ENGINE_MISMATCH)
    throw new Error(`jobs were built for sim ${jobs.simHash} / harness ${jobs.harnessHash}, this checkout has ${sh} / ${hh}`);
}
// run shard i/n of the jobs in this process with `threads` worker threads (threads <= 1: in-process, serial)
function runShard(jobs, i, n, threads){
  checkJobs(jobs);
  const tasks = shardTasks(jobs, i, n);
  if (!threads || threads <= 1) return Promise.resolve(runShardTasks(jobs, tasks));
  return Promise.all([...Array(threads).keys()].map(wi => new Promise((res, rej) => {
    const wk = new Worker(__filename, {workerData: {jobs, tasks: tasks.filter((_, q) => q % threads === wi)}, env: process.env});
    wk.on('message', res); wk.on('error', rej);
  }))).then(p => p.flat().sort((a, b) => a.k - b.k));
}
function resultsFile(jobs, i, n, results, wall){
  return {format: OUT_FORMAT, version: VERSION, jobsId: jobs.id, simHash: jobs.simHash, harnessHash: jobs.harnessHash, gen: jobs.gen, phase: jobs.phase,
    shard: [i, n], nTasks: tasksOf(jobs).length, wall, host: os.hostname(), results};
}
module.exports = { JOBS_FORMAT, OUT_FORMAT, VERSION, tasksOf, shardTasks, runShard, runShardTasks, resultsFile, checkJobs };

if (!isMainThread){ parentPort.postMessage(runShardTasks(workerData.jobs, workerData.tasks)); }
else if (require.main === module){
  const args = process.argv.slice(2), pos = args.filter(a => !a.startsWith('--')), opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')));
  if (pos.length < 2){ console.error('usage: node policy/train_worker.js jobs.json out.json [i/n] [--threads=k]'); process.exit(2); }
  const jobs = JSON.parse(fs.readFileSync(pos[0], 'utf8'));
  const [i, n] = (pos[2] || '0/1').split('/').map(Number);
  if (!(n >= 1 && i >= 0 && i < n)) { console.error('bad shard ' + pos[2]); process.exit(2); }
  const t0 = Date.now();
  runShard(jobs, i, n, +(opt.threads || 1)).then(res => {
    const wall = (Date.now() - t0) / 1000;
    const tmp = pos[1] + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(resultsFile(jobs, i, n, res, wall))); fs.renameSync(tmp, pos[1]);
    console.log(`shard ${i}/${n}: ${res.length} fights in ${wall.toFixed(1)} s (${(res.length / wall).toFixed(1)}/s) -> ${pos[1]}`);
  }).catch(e => { console.error(e.message); process.exit(1); });
}
