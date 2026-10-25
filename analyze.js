const fs = require('fs'), A = require('./sim.js');
const TERR = Object.keys(A.TERRAINS);
const s1 = JSON.parse(fs.readFileSync(__dirname + '/stage1.json'));
const s2 = JSON.parse(fs.readFileSync(__dirname + '/stage2.json'));
const s3 = fs.existsSync(__dirname + '/stage3.json') ? JSON.parse(fs.readFileSync(__dirname + '/stage3.json')) : {};
const ab = id => A.BY_ID[id].name.replace('African ', '').replace('American ', '').replace('Saltwater ', '').replace('Silverback ', '').replace('Bengal ', '').replace('Spotted ', '').replace('Gray ', '').replace('White ', '').replace('Cape ', '');
const tn = t => t.split('+').map(ab).join(', ');
const cost = t => t.split('+').reduce((s, id) => s + A.BY_ID[id].price, 0);
const fmt = s => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');

for (const tr of TERR){
  console.log(`\n=== ${tr.toUpperCase()} (stage 3: 200 runs per team x mount) ===`);
  const rows = Object.entries(s3).filter(([k]) => k.startsWith(tr + '|')).map(([k, v]) => { const [, team, mount] = k.split('|'); return {team, mount, ...v}; });
  const best = {}; for (const r of rows) if (!best[r.team] || r.m > best[r.team].m) best[r.team] = r;
  const byMount = {}; for (const r of rows){ (byMount[r.team] = byMount[r.team] || []).push(r); }
  Object.values(best).sort((a, b) => b.m - a.m).forEach((r, i) => {
    const alts = byMount[r.team].sort((a, b) => b.m - a.m).map(x => `${x.mount === 'null' ? 'foot' : ab(x.mount)} ${fmt(x.m)}`).join(' | ');
    console.log(`${String(i + 1).padStart(2)}. ${fmt(r.m)} ±${r.se.toFixed(0)}s  full ${Math.round(r.full * 100)}%  $${cost(r.team)}  ${tn(r.team)}  [${alts}]`);
  });
  // reference teams from stage 2
  const ref = ['elephant+grizzly+tiger+jaguar+cougar', 'elephant+hippo+grizzly', 'elephant+tiger+lion+jaguar+cougar', 'tiger+lion+jaguar+cougar'];
  for (const t of ref){ const e = Object.entries(s2).find(([k]) => k.startsWith(tr + '|' + t + '|')); if (e) console.log(`   ref ${fmt(e[1].m)} ±${e[1].se.toFixed(0)}  ${tn(t)}  rank ${1 + Object.entries(s2).filter(([k, v]) => k.startsWith(tr + '|') && v.m > e[1].m).length} of ${Object.keys(s2).filter(k => k.startsWith(tr + '|')).length}`); }
}

// overall: teams in stage 2 for all four terrains
const per = {};
for (const [k, v] of Object.entries(s2)){ const [tr, team] = k.split('|'); (per[team] = per[team] || {})[tr] = v; }
const overall = Object.entries(per).filter(([, v]) => TERR.every(t => v[t])).map(([team, v]) => ({team, m: TERR.reduce((s, t) => s + v[t].m, 0) / 4, by: TERR.map(t => fmt(v[t].m)).join(' / ')})).sort((a, b) => b.m - a.m);
console.log(`\n=== OVERALL (stage 2, teams that made the cut on all 4 maps; sav/riv/for/tun) ===`);
overall.slice(0, 12).forEach((r, i) => console.log(`${String(i + 1).padStart(2)}. ${fmt(r.m)}  ${r.by}  $${cost(r.team)}  ${tn(r.team)}`));

// stage 1 over all teams: animal frequency in top 50 per terrain, and worst teams
for (const tr of TERR){
  const ranked = Object.entries(s1).filter(([k]) => k.startsWith(tr + '|')).sort((a, b) => b[1] - a[1]);
  const freq = {}; ranked.slice(0, 50).forEach(([k]) => k.split('|')[1].split('+').forEach(id => freq[id] = (freq[id] || 0) + 1));
  console.log(`\n${tr} top-50 animal frequency: ` + Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${ab(id)} ${n}`).join(', '));
  const noEle = ranked.find(([k]) => !k.split('|')[1].split('+').includes('elephant'));
  console.log(`${tr} best team without the elephant (stage 1): ${tn(noEle[0].split('|')[1])} ${fmt(noEle[1])}; rank ${ranked.indexOf(noEle) + 1}`);
}
const all = {}; for (const [k, v] of Object.entries(s1)){ const t = k.split('|')[1]; (all[t] = all[t] || []).push(v); }
const allR = Object.entries(all).map(([t, v]) => ({t, m: v.reduce((a, b) => a + b, 0) / v.length})).sort((a, b) => b.m - a.m);
console.log(`\nworst full-budget teams (stage 1, avg of 4 maps):`);
allR.filter(r => r.t !== '(nobody)' && cost(r.t) === 1000).slice(-5).forEach(r => console.log(`  ${fmt(r.m)}  ${tn(r.t)}`));
const nb = allR.find(r => r.t === '(nobody)'); console.log(`alone: ${fmt(nb.m)}`);
