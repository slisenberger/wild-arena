// Byte-identity check for the maps2 prototype: without cfg.maps2, every fight must match a reference engine exactly.
// Usage: node research/maps2/ident.js <reference repo dir, e.g. a git worktree of origin/main> [fights=240]
// Runs the same board fights (all 4 maps, dealt boards, random full-spend teams, random start spots for you and the team)
// with the live policies on and with livePolicy:false in each engine, in separate processes, and compares w.t, w.result
// and every unit's hp and position.
const path = require('path'), { execFileSync } = require('child_process');
if (process.argv[2] === 'run'){
  const simPath = path.resolve(process.argv[3]), N = +process.argv[4];
  process.env.SIM = simPath; const A = require(simPath), out = [];
  const R = A.rng(424242), TERR = Object.keys(A.TERRAINS);
  for (let i = 0; i < N; i++){
    const terrain = TERR[i % 4], board = A.dealBoard(1 + Math.floor(R() * 1e9), {board: 12, total: 2600, tol: 100, rareP: .3, terrain});
    const order = board.slice(); for (let k = order.length - 1; k > 0; k--){ const j = Math.floor(R() * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; }
    const team = []; let left = 1200; for (const id of order) if (A.BY_ID[id].price <= left){ team.push(id); left -= A.BY_ID[id].price; }
    const cfg = {board, team, terrain, mode: 'wild', mount: A.defaultMount(team), seed: 1 + Math.floor(R() * 1e9)};
    if (i % 2){ cfg.human = {x: 4 + R() * 40, y: 4 + R() * 58}; cfg.placements = {}; for (const id of team) cfg.placements[id] = {dx: (R() - .5) * 30, dy: (R() - .5) * 30}; }
    for (const live of [true, false]){
      const w = A.simulate(Object.assign({}, cfg, live ? {} : {livePolicy: false}));
      out.push(JSON.stringify([i, live, +w.t.toFixed(6), w.result, w.units.map(u => [u.s.id, u.hp, +u.x.toFixed(6), +u.y.toFixed(6)])]));
    }
  }
  process.stdout.write(out.join('\n')); return;
}
const ref = path.resolve(process.argv[2]), N = +process.argv[3] || 240;
const run = dir => execFileSync(process.execPath, [__filename, 'run', path.join(dir, 'sim.js'), String(N)], {maxBuffer: 1 << 30, env: Object.assign({}, process.env, {SIM: ''})}).toString().split('\n');
const a = run(path.join(__dirname, '..', '..')), b = run(ref);
let diff = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]){ if (diff < 3) console.log('DIFF', a[i].slice(0, 200), '\n vs ', (b[i] || '').slice(0, 200)); diff++; }
console.log(`${a.length} fights (${N} configs x live on/off): ${diff ? diff + ' differ' : 'all identical'} (w.t, result, every unit's hp and position)`);
process.exit(diff ? 1 : 0);
