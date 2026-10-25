// Write measured values (price_abs.js output) into sim.js's MEASURED table, and optionally new prices.
// Usage: node apply_values.js <price_abs out.json> [scheme.json]
//   The scheme (price_scheme.js output) sets every item's price, including pack items, and RULES.total.
const fs = require('fs');
const [abs, scheme] = process.argv.slice(2);
const m = JSON.parse(fs.readFileSync(abs, 'utf8')).detail;
let s = fs.readFileSync('sim.js', 'utf8');
const table = Object.entries(m).map(([id, r]) => `${id}:{mine:${Math.round(r.mine)},theirs:${Math.round(r.theirs)}}`).join(', ');
s = s.replace(/const MEASURED = \{[^\n]*\};/, `const MEASURED = {/*MEASURED*/${table}};`);
if (scheme){
  const sc = JSON.parse(fs.readFileSync(scheme, 'utf8'));
  for (const [id, price] of Object.entries(sc.prices)){
    const line = s.match(new RegExp(`\\{id:'${id}',[^\\n]*`));
    if (line){ s = s.replace(line[0], line[0].replace(/ price:\d+,/, ` price:${price},`)); continue; }
    // pack items are built from a table: ['wolf', 4, 'Wolf pack', <price>, ...] keyed by their id suffix
    const A = require('./sim.js'), it = A.BY_ID[id]; if (!it || !it.species) continue;
    const re = new RegExp(`\\['${it.species}', ${it.group}, '${it.groupName}', \\d+`);
    s = s.replace(re, `['${it.species}', ${it.group}, '${it.groupName}', ${price}`);
  }
  if (sc.total) s = s.replace(/total: \d+, tol:/, `total: ${sc.total}, tol:`);
}
fs.writeFileSync('sim.js', s);
console.log('wrote MEASURED for', Object.keys(m).length, 'items' + (scheme ? ' and prices from ' + scheme : ''));
