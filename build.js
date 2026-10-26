// Assemble the single-file game: template.html + faces.json + sim.js + ui.js -> index.html
const fs = require('fs'), path = require('path');
const r = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
let t = r('template.html');
// image credits come straight from the table in CREDITS.md: | `id` | Animal | [file](url) | author | license |
const credits = r('CREDITS.md').split('\n').map(l => l.match(/^\| `([^`]+)` \| ([^|]+) \| \[([^\]]+)\]\((.+?)\) \| ([^|]+) \| ([^|]+) \|/)).filter(Boolean)
  .map(m => ({id: m[1], animal: m[2].trim(), file: m[3], url: m[4], author: m[5].trim(), license: m[6].trim()}));
t = t.replace('/*CREDITS*/', () => JSON.stringify(credits));
// the learned policies (policy/live.js + its modules + weights), wrapped as tiny CommonJS modules after the engine:
// require('path')/process.env/__dirname are shimmed and any require of sim.js resolves to window.Arena
const POLICY = ['move_model.js', 'move_features.js', 'move_guard_features.js', 'move_arch_features.js', 'move_arch.js', 'move_policy.js', 'live.js'];
const policyBundle = `;(function(){ var A = window.Arena, M = {}, C = {}, process = {env: {}}, path = {join: function(){ return arguments[arguments.length - 1]; }, resolve: function(x){ return x; }};
  function req(n){ n = String(n).split('/').pop(); if (n === 'path') return path; if (n === 'sim.js') return A; if (!(n in C)){ var m = {exports: {}}; C[n] = m.exports; M[n](m, m.exports); C[n] = m.exports; } return C[n]; }
  M['harrier_v1.json'] = function(module){ module.exports = ${r('policy/weights/harrier_v1.json')}; };
  M['guard_v1.json'] = function(module){ module.exports = ${r('policy/weights/guard_v1.json')}; };
${POLICY.map(f => `  M['${f}'] = function(module, exports){ var require = req, __dirname = ''; ${r('policy/' + f)}\n  };`).join('\n')}
  req('live.js'); })();`;
t = t.replace('/*FACES*/', () => r('faces.json')).replace('/*SIM*/', () => r('sim.js') + '\n' + policyBundle).replace('/*UI*/', () => r('ui.js'));
const html = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n' + t.replace('<div class="wrap">', '</head><body>\n<div class="wrap">') + '\n</body></html>';
// refuse to write a page whose scripts don't parse (a broken ui.js once slipped through to the playtest page)
for (const [, code] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)){ try { new Function(code); } catch (e){ console.error('build.js: a page script does not parse: ' + e.message); process.exit(1); } }
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('wrote index.html', html.length, 'bytes');
