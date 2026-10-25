// Learned target selection for enemy predators. Requiring this file registers the chooser with the engine
// (A._internals.choose); a fight then uses it when its cfg.policy is set:
//   cfg.policy = weights (from model.js / bc_train.js)  -> the net picks (argmax over options)
//   cfg.policy = {teacher: true}                          -> the hand-tuned heuristic picks (for logging; same result as no policy)
// Optional sinks on the cfg (never change the fight):
//   cfg.policyLog = []    -> each decision with 2+ options is pushed as {X, y: heuristic choice, a: action taken, sp: species}
//   cfg.policyStats = {}  -> counts decisions and agreement with the heuristic: {n, agree}
const F = require('./features.js');
const M = require('./model.js');
const path = require('path');
const A = require(process.env.SIM ? path.resolve(process.env.SIM) : path.join(__dirname, '..', 'sim.js'));

function apply(u, o){
  if (o.kind === 'feed'){ u.target = null; u.carcass = o.c; u.state = 'feed'; return; }
  u.carcass = null;
  u.target = o.kind === 'target' ? o.t : null;
  u.state = u.target ? 'engage' : 'roam';
}

function choose(w, u, policy){
  const cfg = w.cfg, log = cfg.policyLog, stats = cfg.policyStats;
  const {opts, X} = F.extract(w, u);
  const teach = policy.teacher || log || stats ? F.heuristicIndex(w, u, opts) : -1;
  const a = policy.teacher ? teach : M.argmax(policy, X);
  if (stats){ stats.n = (stats.n || 0) + 1; if (a === teach) stats.agree = (stats.agree || 0) + 1; }
  if (log && opts.length > 1) log.push({X, y: teach, a, sp: u.s.id});
  apply(u, opts[a]);
}
A._internals.choose = choose;

module.exports = { choose, apply, load: f => JSON.parse(require('fs').readFileSync(f, 'utf8')) };
