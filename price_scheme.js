// Build a price scheme from a price_board.js measurement: prices ∝ swing value for ordinary animals
// ($100 steps, minimum $100), with the giants capped so they stay affordable (a price strictly proportional
// to the elephant's measured value would put it out of reach, and that's no fun).
// Usage: node price_scheme.js <price_board out.json> <secPer100> <giantCap> <out.json> [K]
// Writes {prices, total, giantCap, secPer100} where total = K × mean common price (rounded to $100), the board
// total every board is dealt to.
const fs = require('fs');
const A = require(process.env.SIM || './sim.js');
const [inp, sec, cap, out, Kin] = process.argv.slice(2), K = +Kin || A.RULES.board;
const m = JSON.parse(fs.readFileSync(inp, 'utf8')), SEC = +sec, CAP = +cap;
const giants = A.ANIMALS.filter(a => a.mass >= 5000).map(a => a.id);
const prices = {};
for (const a of A.ANIMALS){
  const v = Math.max(0, m.swing[a.id] || 0);
  let p = Math.max(100, Math.round(v / SEC) * 100);
  if (giants.includes(a.id) || (a.group || 1) >= 3) p = Math.min(p, CAP + (a.id === 'triceratops' ? 100 : 0)); // giants and big herds/packs share the cap
  else p = Math.min(p, CAP - 100); // nothing ordinary costs as much as a giant
  prices[a.id] = p;
}
const common = A.ANIMALS.filter(a => !a.rare && (a.dealWeight ?? 1) > 0).map(a => a.id); // (a form that is never dealt, like the lone musk ox, doesn't count)
const total = Math.round(K * common.reduce((s, id) => s + prices[id], 0) / common.length / 100) * 100;
fs.writeFileSync(out, JSON.stringify({prices, total, giantCap: CAP, secPer100: SEC}, null, 1));
console.log(`scheme: ${SEC} s per $100, giants capped at $${CAP}; board total $${total} for ${K} animals`);
console.log(A.ANIMALS.map(a => a.id).sort((x, y) => prices[y] - prices[x] || x.localeCompare(y)).map(id => `${id} $${prices[id]}`).join(', '));
