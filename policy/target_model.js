// Milestone 4 target scorers (policy/policy.js), forward pass and gradient over a flat parameter vector, shared by the game
// hook and the PPO trainer (policy/ppo_target.js). Both add margin * [option = the heuristic's pick], so zero output = today's game.
//   'target-lin' {nin, margin, wt[nin]}:              score_i = margin*teach_i + wt . x_i
//   'target-mlp' {nin, nh, margin, theta, self: true}: score_i = margin*teach_i + wl . x_i + v . tanh(W1 x_i + b1)
//     theta = [wl (nin), v (nh), b1 (nh), W1 (nh x nin, row-major)]; v = 0 gives zero output whatever W1 is. With self, the
//     unit's own species trait vector (policy/traits.js) is appended to every option's features: constant across options, it
//     only matters through the hidden layer, where it can change how a species weighs a candidate (speciation).
const TR = require('./traits.js');
const npar = P => P.kind === 'target-mlp' ? P.nin * (P.nh + 1) + 2 * P.nh : P.nin;
const thetaOf = P => P.kind === 'target-mlp' ? P.theta : P.wt;
function withTheta(P, th){ return P.kind === 'target-mlp' ? Object.assign({}, P, {theta: th.slice()}) : Object.assign({}, P, {wt: th.slice(0, P.nin)}); }
// the option features the scorer sees (adds the unit's traits for a 'self' MLP)
function inputs(P, X, u){ if (P.kind !== 'target-mlp' || !P.self) return X; const t = TR.traitsV(u.s, P.traitsV); return X.map(x => x.concat(t)); }
function hidden(th, P, x){
  const {nin, nh} = P, h = new Array(nh), o = nin + 2 * nh;
  for (let j = 0; j < nh; j++){ let a = th[nin + nh + j]; const r = o + j * nin; for (let k = 0; k < nin; k++) a += th[r + k] * x[k]; h[j] = Math.tanh(a); }
  return h;
}
function scoreOne(th, P, x){
  let s = 0; for (let k = 0; k < x.length; k++) s += th[k] * x[k];
  if (P.kind === 'target-mlp'){ const h = hidden(th, P, x); for (let j = 0; j < P.nh; j++) s += th[P.nin + j] * h[j]; }
  return s;
}
function scores(P, X, teach, th){ th = th || thetaOf(P); return X.map((x, i) => (i === teach ? P.margin : 0) + scoreOne(th, P, x)); }
// adds c * d score(x) / d theta into g
function addGrad(g, th, P, x, c){
  for (let k = 0; k < x.length; k++) g[k] += c * x[k];
  if (P.kind !== 'target-mlp') return;
  const {nin, nh} = P, h = hidden(th, P, x), o = nin + 2 * nh;
  for (let j = 0; j < nh; j++){
    g[nin + j] += c * h[j];
    const dj = c * th[nin + j] * (1 - h[j] * h[j]); if (!dj) continue;
    g[nin + nh + j] += dj; const r = o + j * nin; for (let k = 0; k < nin; k++) g[r + k] += dj * x[k];
  }
}
// a new MLP: output layers zero (= the heuristic), hidden weights small random (deterministic from seed)
function mlp(nin, nh, margin, seed, self){
  const th = new Array(nin * (nh + 1) + 2 * nh).fill(0); let s = (seed >>> 0) || 1;
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const sc = 1 / Math.sqrt(nin);
  for (let i = nin + 2 * nh; i < th.length; i++) th[i] = (r() * 2 - 1) * sc;
  return {kind: 'target-mlp', v: 1, nin, nh, margin, self: !!self, theta: th};
}
module.exports = { npar, thetaOf, withTheta, inputs, scores, addGrad, mlp, TRAITS: TR.DIM };
