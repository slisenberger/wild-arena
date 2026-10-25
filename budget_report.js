const D = require('./deep.json'); const A = require('./sim.js');
const T = Object.keys(A.TERRAINS), BASE = Object.fromEntries(A.ANIMALS.map(a => [a.id, a.price]));
const ab = id => A.BY_ID[id].name.replace(/^(African|American|Saltwater|Silverback|Bengal|Spotted|Gray|White|Cape) /, '');
const f = s => Math.floor(s / 60) + ':' + String(Math.round(s % 60) % 60).padStart(2, '0');
const R = {}; for (const r of D.r2){ const [t, tr] = r.k.split('|'); (R[t] = R[t] || {})[tr] = r; }
const stat = t => { const all = T.flatMap(tr => R[t][tr].s), wins = T.reduce((a, tr) => a + R[t][tr].wins, 0); return {win: wins / all.length, m: all.reduce((a, b) => a + b, 0) / all.length, per: T.map(tr => R[t][tr].wins), se: Math.sqrt((wins / all.length) * (1 - wins / all.length) / all.length)}; };
for (const [nm, sc] of Object.entries(D.schemes)){
  const cost = t => t.split('+').reduce((s, id) => s + (sc.price[id] || BASE[id]), 0);
  const rows = D.tops[nm].map(t => ({t, ...stat(t)})).sort((a, b) => b.win - a.win || b.m - a.m);
  console.log(`\n=== ${nm} (${D.sets[nm]} full-spend teams; top 25 from screen, 100 runs/map each) ===`);
  rows.slice(0, 10).forEach((r, i) => console.log(`${String(i + 1).padStart(2)}. ${(100 * r.win).toFixed(0).padStart(3)}% ±${(100 * r.se).toFixed(0)}  avg ${f(r.m)}  [${r.per.join('/')}]  $${cost(r.t)}  ${r.t.split('+').map(ab).join(', ')}`));
  const withE = rows.filter(r => r.t.includes('elephant')).length;
  const noE = rows.filter(r => !r.t.includes('elephant'));
  console.log(`   ${withE}/25 contenders include the elephant; median contender win ${(100 * rows[12].win).toFixed(0)}%; ` + (noE.length ? `best without elephant: ${(100 * noE[0].win).toFixed(0)}% ${noE[0].t.split('+').map(ab).join(', ')}` : 'no elephant-free team made the top 25'));
  const champ = T.map((tr, k) => { const b = rows.slice().sort((x, y) => R[y.t][tr].wins - R[x.t][tr].wins || (R[y.t][tr].s.reduce((p, q) => p + q, 0) - R[x.t][tr].s.reduce((p, q) => p + q, 0)))[0]; return `${tr}: ${b.t.split('+').map(ab).join(', ')} (${R[b.t][tr].wins}%)`; });
  console.log('   map champions: ' + champ.join(' | '));
}
