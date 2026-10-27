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

// 'target-lin' (milestone 4 pilot): score(option i) = margin*[i = the heuristic's pick] + wt.x_i, argmax; zero wt = the
// heuristic exactly, so training learns only where to deviate from it
function scoreLin(P, X, teach){ let b = 0, bs = -Infinity; X.forEach((x, i) => { let s = i === teach ? P.margin : 0; for (let k = 0; k < x.length; k++) s += P.wt[k] * x[k]; if (s > bs){ bs = s; b = i; } }); return b; }
function choose(w, u, policy){
  const cfg = w.cfg, log = cfg.policyLog, stats = cfg.policyStats;
  if (policy.byArch) policy = policy.byArch[A._internals.archetypeOf(u)];
  const {opts, X} = F.extract(w, u);
  const lin = policy.kind === 'target-lin';
  const teach = policy.teacher || log || stats || lin ? F.heuristicIndex(w, u, opts) : -1;
  const a = policy.teacher ? teach : lin ? scoreLin(policy, X, teach) : M.argmax(policy, X);
  if (stats){ stats.n = (stats.n || 0) + 1; if (a === teach) stats.agree = (stats.agree || 0) + 1; }
  if (log && opts.length > 1) log.push({X, y: teach, a, sp: u.s.id});
  apply(u, opts[a]);
}
A._internals.choose = choose;

module.exports = { choose, apply, load: f => JSON.parse(require('fs').readFileSync(f, 'utf8')) };
