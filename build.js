// Assemble the single-file game: template.html + faces.json + sim.js + ui.js -> index.html
const fs = require('fs'), path = require('path');
const r = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
let t = r('template.html');
// image credits come straight from the table in CREDITS.md: | `id` | Animal | [file](url) | author | license |
const credits = r('CREDITS.md').split('\n').map(l => l.match(/^\| `([^`]+)` \| ([^|]+) \| \[([^\]]+)\]\((.+?)\) \| ([^|]+) \| ([^|]+) \|/)).filter(Boolean)
  .map(m => ({id: m[1], animal: m[2].trim(), file: m[3], url: m[4], author: m[5].trim(), license: m[6].trim()}));
t = t.replace('/*CREDITS*/', () => JSON.stringify(credits));
t = t.replace('/*FACES*/', () => r('faces.json')).replace('/*SIM*/', () => r('sim.js')).replace('/*UI*/', () => r('ui.js'));
const html = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n' + t.replace('<div class="wrap">', '</head><body>\n<div class="wrap">') + '\n</body></html>';
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('wrote index.html', html.length, 'bytes');
