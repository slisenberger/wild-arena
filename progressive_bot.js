// Progressive-mode balance probe: a greedy bot plays N seeded runs. Each shop visit it pays for a full heal on any pick
// below 60% health (most valuable first), then buys by MEASURED swing (mine − theirs) with seeded noise (env NOISE, ±50%),
// and 1 buy in 4 is a random affordable animal (env RAND), so its teams vary like a player's; it never sells. Reports how far runs get, round-by-round loss rates, money, levels,
// kills by species in rounds 1–2, and how often a honey badger is still on the team in round 4.
// node progressive_bot.js [runs=500] [workers=4] [seed0=1]   (env PROG='{"TOPUP":350}' overrides constants)
const {Worker, isMainThread, parentPort, workerData} = require('worker_threads');
if (isMainThread){
  const N = +process.argv[2] || 500, NW = +process.argv[3] || 4, S0 = +process.argv[4] || 1;
  const out = []; let done = 0; const t0 = Date.now();
  for (let k = 0; k < NW; k++){
    const seeds = []; for (let i = k; i < N; i += NW) seeds.push(S0 + i);
    const wk = new Worker(__filename, {workerData: {seeds, prog: process.env.PROG || '{}', noise: +(process.env.NOISE || .5), rand: +(process.env.RAND || .25)}});
    wk.on('message', m => out.push(m));
    wk.on('exit', () => { if (++done === NW) report(out, t0); });
  }
} else {
  const P = require('./progressive.js'), A = require('./sim.js');
  Object.assign(P.PROG, JSON.parse(workerData.prog));
  const val = id => { const m = A.MEASURED[id]; return Math.max(1, m ? m.mine - m.theirs : 0); };
  for (const seed of workerData.seeds){
    const run = P.newRun(seed), R = A.rng(seed * 7 + 3), fights = [];
    while (!run.over){
      const hurt = run.team.filter(e => e.hp.reduce((a, b) => a + b, 0) / e.hp.length < .6).sort((a, b) => val(b.id) - val(a.id));
      for (const e of hurt) P.heal(run, e.id);
      const noise = {}; for (const id of run.board) noise[id] = 1 + workerData.noise * (R() - .5) * 2;
      for (;;){
        const c = run.board.filter(id => P.canBuy(run, id)).sort((a, b) => val(b) * noise[b] - val(a) * noise[a]);
        if (!c.length) break; P.buy(run, R() < workerData.rand ? c[Math.floor(R() * c.length)] : c[0]); // sometimes a favourite instead of the best

      }
      const team0 = P.teamIds(run).slice(), lv = run.team.map(e => e.lv);
      const w = A.simulate(P.cfgFor(run));
      const kills = {}; for (const u of w.units) if (u.side === 'P' && u.st.kills) kills[u.s.id] = (kills[u.s.id] || 0) + u.st.kills;
      const e = P.applyResult(run, w);
      fights.push({k: e.k, att: e.attempt, t: e.t, survived: e.survived, money: run.money, team: team0, lv, kills, down: e.down, premium: e.premium, terrain: e.terrain});
    }
    parentPort.postMessage({seed, won: run.won, losses: run.losses, total: run.total, complete: run.complete, endK: run.complete ? 7 : run.k, fights});
  }
}
function report(out, t0){
  const N = out.length, pct = x => (100 * x / N).toFixed(1) + '%', avg = (a, g) => a.length ? a.reduce((s, x) => s + g(x), 0) / a.length : 0;
  console.log(`${N} runs in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  const hist = Array(8).fill(0); for (const r of out) hist[r.won]++;
  console.log('rounds won: ' + hist.map((n, i) => `${i}:${n}`).join('  ') + `   complete: ${pct(hist[7])}`);
  const end = out.map(r => r.complete ? 8 : r.endK + 1).sort((a, b) => a - b);
  console.log(`run ends in round (8 = complete): median ${end[N >> 1]}, p25 ${end[Math.floor(N * .25)]}, p75 ${end[Math.floor(N * .75)]}, mean ${avg(end, x => x).toFixed(2)}`);
  for (let k = 0; k < 7; k++){
    const f = [].concat(...out.map(r => r.fights.filter(x => x.k === k))); if (!f.length) continue;
    const first = f.filter(x => x.att === 0), reached = out.filter(r => r.fights.some(x => x.k === k)).length;
    console.log(`round ${k + 1}: reached ${pct(reached)}, first-try win ${(100 * avg(first, x => x.survived ? 1 : 0)).toFixed(0)}%, all fights win ${(100 * avg(f, x => x.survived ? 1 : 0)).toFixed(0)}% (${f.length}), time ${avg(f, x => x.t).toFixed(0)} s, team ${avg(f, x => x.team.length).toFixed(1)}, money after $${avg(f, x => x.money).toFixed(0)}, levels ≥1 ${(100 * avg(f, x => x.lv.length ? x.lv.filter(l => l > 0).length / x.lv.length : 0)).toFixed(0)}% / L3 ${(100 * avg(f, x => x.lv.length ? x.lv.filter(l => l >= 3).length / x.lv.length : 0)).toFixed(0)}%, kills ${avg(f, x => x.down).toFixed(1)}`);
  }
  // round 1: team variety and how each team did (first try)
  const r1 = out.map(r => r.fights[0]), teams = {};
  for (const f of r1){ const key = f.team.slice().sort().join('+'); (teams[key] = teams[key] || []).push(f.survived ? 1 : 0); }
  const tl = Object.entries(teams).sort((a, b) => b[1].length - a[1].length);
  console.log(`round 1: ${tl.length} distinct teams over ${N} runs; most common:`);
  for (const [k, v] of tl.slice(0, 8)) console.log(`  ${k}: ${v.length} runs, won ${(100 * avg(v, x => x)).toFixed(0)}%`);
  const inc = {}; for (const f of r1) for (const id of f.team) (inc[id] = inc[id] || []).push(f.survived ? 1 : 0);
  console.log('round 1 win rate by animal on the team: ' + Object.entries(inc).sort((a, b) => b[1].length - a[1].length).map(([id, v]) => `${id} ${(100 * avg(v, x => x)).toFixed(0)}% (${v.length})`).join(', '));
  // kills by species in rounds 1-2 (per fight the species was on the team)
  const K = {}, on = {};
  for (const r of out) for (const f of r.fights) if (f.k <= 1){ for (const id of f.team) on[id] = (on[id] || 0) + 1; for (const [id, n] of Object.entries(f.kills)) K[id] = (K[id] || 0) + n; }
  console.log('rounds 1-2 kills per fight on the team: ' + Object.keys(on).sort((a, b) => (K[b] || 0) / on[b] - (K[a] || 0) / on[a]).map(id => `${id} ${((K[id] || 0) / on[id]).toFixed(2)} (${K[id] || 0}/${on[id]})`).join(', '));
  const badger4 = out.filter(r => r.fights.some(f => f.k === 3 && f.team.includes('honeybadger'))).length;
  const badgerAny = out.filter(r => r.fights.some(f => f.k <= 1 && f.team.includes('honeybadger'))).length;
  console.log(`honey badger on the team in round 4: ${pct(badger4)} of runs (${badger4} of the ${badgerAny} runs that had one in rounds 1-2)`);
  const prem = {}; for (const r of out) for (const f of r.fights) if (f.premium){ const p = prem[f.premium] = prem[f.premium] || [0, 0]; p[0]++; p[1] += f.survived ? 1 : 0; }
  console.log('premium enemies: ' + Object.entries(prem).map(([id, p]) => `${id} ${p[0]} fights, you won ${(100 * p[1] / p[0]).toFixed(0)}%`).join(', '));
}
