// Daily Safari run check: is each day's run winnable? For each date, the bot (same play as progressive_bot.js: heal below 60%,
// buy by MEASURED swing with noise, 1 buy in 4 random) plays the day's run K times with different buying noise. A day whose
// completion rate is below MIN gets the next salt ('wild-arena:progressive:<date>:1', ':2', ...) until one passes.
// Writes the dates that need a salt to daily_salt.json (ui.js bundles it as DAILY_SALT).
// node research/daily_check.js <first date YYYY-MM-DD> <days=60> [K=40] [MIN=.08]     (4 workers)
const {Worker, isMainThread, parentPort, workerData} = require('worker_threads');
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
function dateSeed(s){ let h = 2166136261; for (const c of s){ h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) % 1e6 + 1; } // = ui.js
const seedFor = (d, salt) => dateSeed('wild-arena:progressive:' + d + (salt ? ':' + salt : ''));
if (isMainThread){
  const [d0, days = 60, K = 40, MIN = .08] = [process.argv[2], +process.argv[3] || 60, +process.argv[4] || 40, +process.argv[5] || .08];
  if (!d0) throw new Error('usage: node research/daily_check.js YYYY-MM-DD [days] [K] [MIN]');
  const dates = Array.from({length: days}, (_, i) => { const t = new Date(d0 + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + i); return t.toISOString().slice(0, 10); });
  const play = jobs => new Promise(res => { const out = []; let done = 0; const NW = 4;
    for (let k = 0; k < NW; k++){ const w = new Worker(__filename, {workerData: {jobs: jobs.filter((_, i) => i % NW === k)}}); w.on('message', m => out.push(m)); w.on('exit', () => { if (++done === NW) res(out); }); } });
  (async () => {
    const salt = {}, rows = []; let todo = dates.map(d => ({d, s: 0}));
    while (todo.length){
      const jobs = []; for (const t of todo) for (let i = 0; i < K; i++) jobs.push({d: t.d, s: t.s, seed: seedFor(t.d, t.s), bot: 1000 + i});
      const res = await play(jobs), next = [];
      for (const t of todo){
        const r = res.filter(x => x.d === t.d && x.s === t.s), c = r.filter(x => x.complete).length / r.length, won = r.reduce((a, x) => a + x.won, 0) / r.length;
        rows.push({date: t.d, salt: t.s, complete: c, won}); console.log(`${t.d} salt ${t.s}: complete ${(c * 100).toFixed(0)}%, rounds won ${won.toFixed(1)}`);
        if (c < MIN && t.s < 5) next.push({d: t.d, s: t.s + 1}); else if (t.s) salt[t.d] = t.s;
      }
      todo = next;
    }
    const firstTry = rows.filter(r => r.salt === 0), cs = firstTry.map(r => r.complete).sort((a, b) => a - b);
    console.log(`\n${dates.length} days; first deal: median completion ${(cs[cs.length >> 1] * 100).toFixed(0)}%, min ${(cs[0] * 100).toFixed(0)}%, max ${(cs[cs.length - 1] * 100).toFixed(0)}%; re-dealt: ${Object.keys(salt).length}`);
    fs.writeFileSync(path.join(ROOT, 'daily_salt.json'), JSON.stringify(salt) + '\n');
  })();
} else {
  const P = require(path.join(ROOT, 'progressive.js')), A = require(path.join(ROOT, 'sim.js'));
  const val = id => { const m = A.MEASURED[id]; return Math.max(1, m ? m.mine - m.theirs : 0); };
  for (const j of workerData.jobs){
    const run = P.newRun(j.seed), R = A.rng(j.bot * 7919 + j.seed);
    while (!run.over){
      for (const e of run.team.filter(e => e.hp.reduce((a, b) => a + b, 0) / e.hp.length < .6).sort((a, b) => val(b.id) - val(a.id))) P.heal(run, e.id);
      const noise = {}; for (const id of run.board) noise[id] = 1 + .5 * (R() - .5) * 2;
      for (;;){ const c = run.board.filter(id => P.canBuy(run, id)).sort((a, b) => val(b) * noise[b] - val(a) * noise[a]); if (!c.length) break; P.buy(run, R() < .25 ? c[Math.floor(R() * c.length)] : c[0]); }
      P.applyResult(run, A.simulate(P.cfgFor(run)));
    }
    parentPort.postMessage({d: j.d, s: j.s, complete: !!run.complete, won: run.won});
  }
}
