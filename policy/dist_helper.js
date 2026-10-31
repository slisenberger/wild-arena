// Helper VM side of policy/dist.js: run queued chunks of one training run until it is done (or the time budget / an hour idle).
//   node policy/dist_helper.js <root: gs://.../runs/<run>/dist or a folder> [--threads=N --hours=H --idle=S]
const D = require('./dist.js');
const a = process.argv.slice(2), root = a.find(x => !x.startsWith('--')), opt = Object.fromEntries(a.filter(x => x.startsWith('--')).map(x => { const [k, v] = x.slice(2).split('='); return [k, +v]; }));
if (!root) throw new Error('usage: dist_helper.js <root> [--threads=N --hours=H --idle=S]');
D.helper(root, {threads: opt.threads, hours: opt.hours, idleS: opt.idle, log: m => console.log(new Date().toISOString(), m)}).then(() => console.log('helper done'));
