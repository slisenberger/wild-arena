// Exhaustive team tournament with successive halving. Wild mode, default formation.
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path');
const A = require('./sim.js');

function tallest(t){ let b = null, h = 0; for (const id of t){ const m = A.BY_ID[id].mountH; if (m > h){ h = m; b = id; } } return b; }

if (!isMainThread){
  const out = [];
  for (const j of workerData.jobs){
    const s = [];
    let dead = 0; const killers = {};
    for (const seed of j.seeds){
      const w = A.simulate({team: j.team, terrain: j.terrain, mode: 'wild', mount: j.mount, seed});
      s.push(w.result.score);
      if (!w.result.survived){ dead++; killers[w.result.killer] = (killers[w.result.killer] || 0) + 1; }
    }
    out.push({key: j.key, scores: s, dead, killers});
  }
  parentPort.postMessage(out);
  return;
}

const fs = require('fs');
const LOG = path.join(__dirname, 'tourney.log');
const log = m => { fs.appendFileSync(LOG, `[${new Date().toISOString().slice(11,19)}] ${m}\n`); };
fs.writeFileSync(LOG, '');
const NW = 2, TERR = Object.keys(A.TERRAINS);
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1)); };

function runJobs(jobs){
  return new Promise(res => {
    const chunks = Array.from({length: NW}, () => []);
    jobs.forEach((j, i) => chunks[i % NW].push(j));
    let done = 0; const all = [];
    chunks.forEach(c => {
      const w = new Worker(__filename, {workerData: {jobs: c}});
      w.on('message', m => { all.push(...m); if (++done === NW) res(all); });
      w.on('error', e => { log('worker error ' + e.stack); process.exit(1); });
    });
  });
}
async function runBatched(jobs, label){
  const res = []; const B = 400; const t0 = Date.now();
  for (let i = 0; i < jobs.length; i += B){
    res.push(...await runJobs(jobs.slice(i, i + B)));
    const el = (Date.now() - t0) / 1000, frac = Math.min(1, (i + B) / jobs.length);
    log(`${label}: ${Math.min(jobs.length, i + B)}/${jobs.length} jobs, ${el.toFixed(0)}s elapsed, ~${(el / frac - el).toFixed(0)}s left`);
  }
  return res;
}
const seeds = (base, n) => Array.from({length: n}, (_, i) => base + i * 7919);

(async () => {
  // all legal teams
  const n = A.ANIMALS.length, teams = [];
  for (let m = 0; m < (1 << n); m++){ let c = 0; const t = []; for (let i = 0; i < n; i++) if (m >> i & 1){ c += A.ANIMALS[i].price; t.push(A.ANIMALS[i].id); } if (c <= 1000) teams.push(t); }
  const tkey = t => t.join('+') || '(nobody)';
  log(`legal teams: ${teams.length}`);

  // stage 1
  const j1 = [];
  for (const t of teams) for (const tr of TERR) j1.push({key: tr + '|' + tkey(t) + '|' + tallest(t), team: t, terrain: tr, mount: tallest(t), seeds: seeds(11, 6)});
  const r1 = await runBatched(j1, 'stage1');
  const s1 = {}; r1.forEach(r => s1[r.key] = mean(r.scores));
  fs.writeFileSync(path.join(__dirname, 'stage1.json'), JSON.stringify(s1));

  // stage 2: top 80 per terrain + reference teams
  const REF = [['elephant','grizzly','tiger','jaguar','cougar'], ['elephant','hippo','grizzly'], ['elephant','tiger','lion','jaguar','cougar'], ['tiger','lion','jaguar','cougar']].map(t => A.ANIMALS.map(a => a.id).filter(id => t.includes(id)));
  const j2 = [];
  for (const tr of TERR){
    const ranked = teams.map(t => ({t, m: s1[tr + '|' + tkey(t) + '|' + tallest(t)]})).sort((a, b) => b.m - a.m).slice(0, 80).map(x => x.t);
    for (const rt of REF) if (!ranked.some(t => tkey(t) === tkey(rt))) ranked.push(rt);
    for (const t of ranked) j2.push({key: tr + '|' + tkey(t) + '|' + tallest(t), team: t, terrain: tr, mount: tallest(t), seeds: seeds(100003, 100)});
  }
  const r2 = await runBatched(j2, 'stage2');
  const s2 = {}; r2.forEach(r => s2[r.key] = {m: mean(r.scores), se: sd(r.scores) / Math.sqrt(r.scores.length), full: r.scores.filter(x => x >= A.MATCH_T).length / r.scores.length, killers: r.killers});
  fs.writeFileSync(path.join(__dirname, 'stage2.json'), JSON.stringify(s2));

  // stage 3: top 10 per terrain, every mount option, 200 fresh runs
  const j3 = [];
  for (const tr of TERR){
    const top = Object.entries(s2).filter(([k]) => k.startsWith(tr + '|')).sort((a, b) => b[1].m - a[1].m).slice(0, 10);
    for (const [k] of top){
      const team = k.split('|')[1].split('+');
      const opts = [null, ...team.filter(id => A.BY_ID[id].mountH > 0)];
      for (const mnt of opts) j3.push({key: tr + '|' + team.join('+') + '|' + mnt, team, terrain: tr, mount: mnt, seeds: seeds(900001, 200)});
    }
  }
  const r3 = await runBatched(j3, 'stage3');
  const s3 = {}; r3.forEach(r => s3[r.key] = {m: mean(r.scores), se: sd(r.scores) / Math.sqrt(r.scores.length), full: r.scores.filter(x => x >= A.MATCH_T).length / r.scores.length, killers: r.killers, n: r.scores.length});
  fs.writeFileSync(path.join(__dirname, 'stage3.json'), JSON.stringify(s3));
  log('DONE');
})();
