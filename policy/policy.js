// Learned target selection for enemy predators. Requiring this file registers the chooser with the engine
// (A._internals.choose); a fight then uses it when its cfg.policy is set:
//   cfg.policy = weights (from model.js / bc_train.js)  -> the net picks (argmax over options)
//   cfg.policy = {teacher: true}                          -> the hand-tuned heuristic picks (for logging; same result as no policy)
// Optional sinks on the cfg (never change the fight):
//   cfg.policyLog = []    -> each decision with 2+ options is pushed as {X, y: heuristic choice, a: action taken, sp: species}
//   cfg.policyStats = {}  -> counts decisions and agreement with the heuristic: {n, agree}
const F = require('./features.js');
const G = require('./guard_features.js');
const TM = require('./target_model.js');
const FP = require('./features_plus.js'); // P.feat === 'plus': + the guard situation around each target
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
// 'target-mlp' adds a hidden layer (policy/target_model.js has both scorers)
function scoresLin(P, X, teach){ return TM.scores(P, X, teach); }
function scoreLin(P, X, teach){ const s = scoresLin(P, X, teach); let b = 0; for (let i = 1; i < s.length; i++) if (s[i] > s[b]) b = i; return b; }
// training only (P.sample, policy/ppo_target.js): sample from softmax(score / tau) with a private generator seeded by the fight
// and the decision count (the engine's own RNG is untouched), and log {X, teach, a, p} into cfg.policyTrace
function pickLin(w, P, X, teach, u){
  X = TM.inputs(P, X, u);
  if (!P.sample) return scoreLin(P, X, teach);
  const s = scoresLin(P, X, teach), m = Math.max(...s), e = s.map(v => Math.exp((v - m) / (P.tau || 1))), z = e.reduce((a, b) => a + b, 0), p = e.map(v => v / z);
  const k = w.cfg.policyTrace ? w.cfg.policyTrace.length : 0; let r = A.rng(((w.cfg.seed || 1) * 7919 + k * 104729 + 17) >>> 0)(), a = 0;
  while (a < p.length - 1 && r >= p[a]){ r -= p[a]; a++; }
  if (w.cfg.policyTrace) w.cfg.policyTrace.push({X, teach, a, p: p[a]});
  return a;
}
function choose(w, u, policy){
  const cfg = w.cfg, log = cfg.policyLog, stats = cfg.policyStats;
  if (policy.byArch) policy = policy.byArch[A._internals.archetypeOf(u)];
  const {opts, X} = (policy.feat === 'plus' ? FP : F).extract(w, u);
  const lin = policy.kind === 'target-lin' || policy.kind === 'target-mlp';
  const teach = policy.teacher || log || stats || lin ? F.heuristicIndex(w, u, opts) : -1;
  const a = policy.teacher ? teach : lin ? pickLin(w, policy, X, teach, u) : M.argmax(policy, X);
  if (stats){ stats.n = (stats.n || 0) + 1; if (a === teach) stats.agree = (stats.agree || 0) + 1; }
  if (log && opts.length > 1) log.push({X, y: teach, a, sp: u.s.id});
  apply(u, opts[a]);
}
// herbivores (bulldozer, charger, kicker): same scorer; the heuristic's pick is herbivoreTarget's, and if that isn't one
// of the candidates the heuristic stands (so zero weights = the engine exactly)
function chooseHerb(w, u, policy){
  const P = policy.byArch[A._internals.archetypeOf(u)], stats = w.cfg.policyStats;
  const {opts, X} = (P.feat === 'plus' ? FP : F).extract(w, u, true), h = F.herbHeuristic(w, u, opts);
  const a = h.i < 0 ? -1 : pickLin(w, P, X, h.i, u);
  if (stats){ stats.n = (stats.n || 0) + 1; if (a === h.i) stats.agree = (stats.agree || 0) + 1; }
  u.target = a < 0 ? h.t : (opts[a].kind === 'target' ? opts[a].t : null); u.state = u.target ? 'engage' : 'roam';
}
// guards (your side, not carrying you): the heuristic's pick is allyTarget's (computed by the engine, passed as h); the
// guard's features (policy/guard_features.js) differ from the predators'. Riders keep the heuristic. Zero weights = the engine
function chooseGuard(w, u, policy, h){
  const P = policy.byArch.guard, stats = w.cfg.policyStats;
  if (u.rider) return;
  const {opts, X} = G.extract(w, u), i = G.heuristic(opts, h);
  const a = i < 0 ? -1 : pickLin(w, P, X, i, u);
  if (stats){ stats.n = (stats.n || 0) + 1; if (a === i) stats.agree = (stats.agree || 0) + 1; }
  if (a >= 0) u.target = opts[a].kind === 'target' ? opts[a].t : null;
}
A._internals.choose = choose;
A._internals.chooseGuard = chooseGuard;
A._internals.chooseHerb = chooseHerb;

module.exports = { choose, chooseHerb, chooseGuard, scoresLin, apply, load: f => JSON.parse(require('fs').readFileSync(f, 'utf8')) };
