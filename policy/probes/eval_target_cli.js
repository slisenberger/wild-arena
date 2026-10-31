// Run eval_target.js (or another probe) as a VM probe run: --base=<weights|none> sets env BASE, the remaining plain arguments
// go to the probe in order, and its output is written to --out (the probe runner uploads it as result.json).
//   node policy/probes/eval_target_cli.js <weights.json> <arch> <N> <probeIndex> [seed goal spec] [--base=...] [--probe=eval_target.js] --out=f
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
const a = process.argv.slice(2), opt = Object.fromEntries(a.filter(x => x.startsWith('--')).map(x => { const [k, v] = x.slice(2).split('='); return [k, v]; }));
const env = Object.assign({}, process.env); if (opt.base) env.BASE = opt.base;
const out = execFileSync('node', [path.join(__dirname, opt.probe || 'eval_target.js'), ...a.filter(x => !x.startsWith('--'))], {env, maxBuffer: 1 << 26}).toString();
process.stdout.write(out); if (opt.out) fs.writeFileSync(opt.out, out);
