// Byte-identity check for shipping learned target scorers (policy/weights/live.json "target"): the same board fights in this
// tree and in a reference engine (a git worktree of origin/main), with the live policies on and with livePolicy:false.
// livePolicy:false must always match; with the live policies on, fights whose other side has none of the archetypes named in
// ARCHS must match (pass 'guard' among them when your guards' scorer changed: then every live fight may differ).
// Optionally the bundle (index.html run in a vm) must give the same fights as the Node modules (BUNDLE=n fights).
// Usage: [BUNDLE=40] node policy/ship_ident.js <reference repo dir> [configs=400] [archs=cat,brawler]
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
function configs(A, N){
  const R = A.rng(515151), TERR = Object.keys(A.TERRAINS), out = [];
  for (let i = 0; i < N; i++){
    const terrain = TERR[i % 4], board = A.dealBoard(1 + Math.floor(R() * 1e9), {board: 12, total: 2600, tol: 100, rareP: .3, terrain});
    const order = board.slice(); for (let k = order.length - 1; k > 0; k--){ const j = Math.floor(R() * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; }
    const team = []; let left = 1200; for (const id of order) if (A.BY_ID[id].price <= left){ team.push(id); left -= A.BY_ID[id].price; }
    out.push({board, team, terrain, mode: 'wild', mount: A.defaultMount(team), seed: 1 + Math.floor(R() * 1e9)});
  }
  return out;
}
const line = (i, live, w, arch) => JSON.stringify([i, live, +w.t.toFixed(6), w.result, w.units.map(u => [u.s.id, u.hp, +u.x.toFixed(6), +u.y.toFixed(6)])]);
if (process.argv[2] === 'run'){
  const simPath = path.resolve(process.argv[3]), N = +process.argv[4];
  process.env.SIM = simPath; const A = require(simPath), out = [];
  configs(A, N).forEach((cfg, i) => { for (const live of [true, false]){
    const w = A.simulate(Object.assign({}, cfg, live ? {} : {livePolicy: false}));
    const archs = [...new Set(w.units.filter(u => u.side === 'E').map(u => A._internals.archetypeOf(u)))];
    out.push(JSON.stringify({l: line(i, live, w), archs})); } });
  process.stdout.write(out.join('\n')); return;
}
if (process.argv[2] === 'bundle'){ // the built page in a vm: window.Arena with the bundled policies
  const vm = require('vm'), html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'), N = +process.argv[3];
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const ctx = {console, Math, JSON, Date, setTimeout: () => 0, clearTimeout: () => 0}; ctx.window = ctx; ctx.self = ctx; vm.createContext(ctx);
  for (const s of scripts){ try { vm.runInContext(s, ctx); } catch (e){ if (ctx.Arena && ctx.Arena._internals.LIVE_TARGET && Object.keys(ctx.Arena._internals.LIVE_TARGET).length) break; } } // ui.js needs a DOM: the engine and policies are loaded by then
  const A = ctx.Arena, out = [];
  configs(A, N).forEach((cfg, i) => { const w = A.simulate(Object.assign({}, cfg)); out.push(line(i, true, w)); });
  process.stdout.write(JSON.stringify({live: Object.keys(A._internals.LIVE_TARGET), lines: out})); return;
}
const ref = path.resolve(process.argv[2]), N = +process.argv[3] || 400, ARCHS = (process.argv[4] || 'cat,brawler').split(',');
const run = dir => execFileSync(process.execPath, [__filename, 'run', path.join(dir, 'sim.js'), String(N)], {maxBuffer: 1 << 30, env: Object.assign({}, process.env, {SIM: ''})}).toString().split('\n').map(s => JSON.parse(s));
const a = run(path.join(__dirname, '..')), b = run(ref);
let offSame = 0, offN = 0, unSame = 0, unN = 0, affSame = 0, affN = 0;
a.forEach((x, k) => { const live = JSON.parse(x.l)[1], same = x.l === b[k].l, aff = ARCHS.includes('guard') || x.archs.some(q => ARCHS.includes(q));
  if (!live){ offN++; offSame += same; } else if (aff){ affN++; affSame += same; } else { unN++; unSame += same; } });
console.log(`${N} configs vs ${ref}: livePolicy:false identical ${offSame}/${offN}; live, other side without ${ARCHS.join('/')}: identical ${unSame}/${unN}; live with them: identical ${affSame}/${affN} (expected to differ)`);
let bad = offSame !== offN || unSame !== unN;
if (+process.env.BUNDLE){
  const nb = +process.env.BUNDLE, B = JSON.parse(execFileSync(process.execPath, [__filename, 'bundle', String(nb)], {maxBuffer: 1 << 30}).toString());
  const node = a.filter(x => JSON.parse(x.l)[1]).slice(0, nb).map(x => x.l), same = B.lines.filter((l, i) => l === node[i]).length;
  console.log(`bundle (index.html in a vm, live targets ${B.live.join('/')}): ${same}/${nb} fights identical to the Node modules`);
  if (same !== nb) bad = true;
}
process.exit(bad ? 1 : 0);
