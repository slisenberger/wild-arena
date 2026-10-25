// Behavior audit: how every animal actually behaves in board games, on your side and on theirs.
// Random boards (the game's dealer), player-like random teams (shuffle the board, take what fits), one fight each.
// Per animal and side: damage dealt / its own health, kills, survival, share of its time fighting (in contact),
// closing in, idle/roaming, fleeing, feeding/resting, overheated; for the other side, damage to you and kills of you.
// Flags animals that rarely engage or barely matter. Usage: node audit.js [fightsPerMap] [budget]
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const SIM = process.env.SIM || './sim.js';
const A = require(SIM);
function tallest(t){ return A.defaultMount(t); } // ride a giant, else on foot
const STATES = ['fight', 'close', 'idle', 'flee', 'feed', 'heat', 'carry'];
function stateOf(u){
  if (u.heatstroke || u.state === 'cool') return 'heat';
  if (u.state === 'flee' || u.state === 'withdraw') return 'flee';
  if (u.state === 'feed' || u.state === 'rest') return 'feed';
  if (u.state === 'carry') return 'carry'; // evasive mount carrying you (a heavy mount that fights counts as fighting)
  if (u.latchOn || u.latchedBy) return 'fight';
  if (u.target && u.state === 'engage'){ const t = u.target, d = Math.hypot(u.x - t.x, u.y - t.y); return d < u.r + t.r + u.s.reach + 1.5 ? 'fight' : 'close'; }
  return 'idle';
}
if (!isMainThread){
  const out = [];
  for (const j of workerData.jobs){
    const w = A.setup({team: j.team, board: j.board, terrain: j.tr, mode: 'wild', mount: tallest(j.team), seed: j.seed});
    const T = w.units.map(() => Object.fromEntries(STATES.map(s => [s, 0]))), toYou = w.units.map(() => 0);
    let lastHp = w.human.hp;
    while (!w.over){
      A.step(w);
      w.units.forEach((u, i) => { if (u.side !== 'H' && u.state !== 'dead' && !u.escaped) T[i][stateOf(u)] += A.DT; });
      if (w.human.hp < lastHp && w.human.lastHitBy){ const k = w.units.indexOf(w.human.lastHitBy); if (k >= 0) toYou[k] += lastHp - Math.max(0, w.human.hp); }
      lastHp = w.human.hp;
    }
    w.units.forEach((u, i) => { if (u.side === 'H') return;
      out.push({id: u.s.id, side: u.side, tr: j.tr, dealt: u.st.dealt, hp: u.maxhp, kills: u.st.kills, alive: u.state !== 'dead' && !u.escaped ? 1 : 0, escaped: u.escaped ? 1 : 0,
        t: T[i], life: u.st.alive, toYou: toYou[i], killedYou: !w.result.survived && w.result.killer === u.s.id ? 1 : 0, fightT: w.result.t, won: w.result.survived ? 1 : 0}); });
  }
  parentPort.postMessage(out); return;
}
const NPM = +process.argv[2] || 400, BUD = +process.argv[3] || 1000, TERR = Object.keys(A.TERRAINS), NW = 4, R = A.rng(4242);
const jobs = [];
for (const tr of TERR) for (let i = 0; i < NPM; i++){
  const board = A.dealBoard(Math.floor(R() * 1e9) + 1, {terrain: tr});
  const order = board.slice(); for (let k = order.length - 1; k > 0; k--){ const q = Math.floor(R() * (k + 1)); [order[k], order[q]] = [order[q], order[k]]; }
  const team = []; let left = BUD; for (const id of order) if (A.BY_ID[id].price <= left){ team.push(id); left -= A.BY_ID[id].price; }
  jobs.push({board, team, tr, seed: 77 + i * 7919 + TERR.indexOf(tr)});
}
const t0 = Date.now();
Promise.all([...Array(NW).keys()].map(wi => new Promise(res => { const w = new Worker(__filename, {workerData: {jobs: jobs.filter((_, i) => i % NW === wi)}}); w.on('message', res); }))).then(parts => {
  const rows = parts.flat(), mean = a => a.length ? a.reduce((p, q) => p + q, 0) / a.length : 0, pct = v => (100 * v).toFixed(0).padStart(3) + '%';
  console.log(`behavior audit: ${jobs.length} board fights (${NPM}/map), budget $${BUD}, ${((Date.now() - t0) / 1000).toFixed(0)}s. Per animal-unit; time shares are of its own time alive.`);
  const flags = [];
  for (const side of ['P', 'E']){
    console.log(`\n${side === 'P' ? 'YOUR SIDE' : 'THEIR SIDE'}   n    dmg  dmg/hp kills alive  fled | fight close  idle  flee  feed  heat carry | ${side === 'P' ? 'team win%' : 'hurt you  kills you'} | dmg per map sav/riv/for/tun`);
    const ids = [...new Set(rows.map(r => r.id))].sort();
    for (const id of ids){
      const r = rows.filter(x => x.id === id && x.side === side); if (!r.length) continue;
      const life = mean(r.map(x => x.life)) || 1, sh = s => mean(r.map(x => x.t[s] / Math.max(.1, x.life)));
      const perMap = TERR.map(tr => mean(r.filter(x => x.tr === tr).map(x => x.dealt)).toFixed(0).padStart(5)).join('');
      const tail = side === 'P' ? pct(mean(r.map(x => x.won))) + '     ' : `${mean(r.map(x => x.toYou)).toFixed(0).padStart(6)}  ${pct(mean(r.map(x => x.killedYou)))}   `;
      console.log(`${id.padEnd(12)} ${String(r.length).padStart(5)} ${mean(r.map(x => x.dealt)).toFixed(0).padStart(6)} ${mean(r.map(x => x.dealt / x.hp)).toFixed(2).padStart(6)} ${mean(r.map(x => x.kills)).toFixed(2).padStart(5)} ${pct(mean(r.map(x => x.alive)))} ${pct(mean(r.map(x => x.escaped)))} | ${STATES.map(s => pct(sh(s))).join('  ')} | ${tail} |${perMap}`);
      if (sh('idle') > .5) flags.push(`${id} (${side === 'P' ? 'yours' : 'theirs'}): idle ${pct(sh('idle'))} of its time`);
      if (mean(r.map(x => x.dealt / x.hp)) < .15) flags.push(`${id} (${side === 'P' ? 'yours' : 'theirs'}): deals only ${mean(r.map(x => x.dealt / x.hp)).toFixed(2)}× its own health`);
      if (sh('heat') > .25) flags.push(`${id} (${side === 'P' ? 'yours' : 'theirs'}): overheated ${pct(sh('heat'))} of its time`);
    }
  }
  console.log('\nflags:\n  ' + (flags.length ? flags.join('\n  ') : 'none'));
});
