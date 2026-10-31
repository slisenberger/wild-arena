// Milestone 3: movement-intent policy. Logits over an archetype's intents (harrier: A._internals.INTENTS = commit, wait,
// flank, regroup, disengage; guard: GUARD_INTENTS = hold, screen, intercept, space, help, fallback; intent 0 = heuristic):  logit[a] = margin·[a = commit] + bl[a] + Wl[a]·x + W2[a]·tanh(W1·x + b1);  action = argmax, ties to
// the earlier intent. With bl = Wl = W2 = 0 every logit except commit's is 0, so the policy always commits = the
// heuristic, whatever W1/b1 hold (skip/linear parameterisation). `margin` (>= 0) acts as a trust region: a perturbation
// has to outweigh it before behaviour changes at all. Weights are plain JSON:
//   {kind:'move-mlp', v:1, nin, nout, nh, margin, bl:[nout], Wl:[nout*nin], W1:[nh*nin], b1:[nh], W2:[nout*nh]}
// Probe policies: {fixed: k} always picks intent k (no features computed).
const NOUT = 5; // harrier default; zeros(nin, nh, margin, nout) for other archetypes (guard: 6)
function zeros(nin, nh, margin, nout){
  nh = nh || 0; const no = nout || NOUT;
  return {kind: 'move-mlp', v: 1, nin, nout: no, nh, margin: margin === undefined ? 1 : margin,
    bl: new Array(no).fill(0), Wl: new Array(no * nin).fill(0), W1: new Array(nh * nin).fill(0), b1: new Array(nh).fill(0), W2: new Array(no * nh).fill(0)};
}
// a fixed random hidden layer (W1, b1) so the MLP path is live once W2 moves; W2 stays 0 = still the heuristic
function withHidden(P, R, scale){
  const g = () => { let u = 0; while (!u) u = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * R()); };
  const s = (scale || 1) / Math.sqrt(P.nin);
  P.W1 = P.W1.map(() => g() * s); P.b1 = P.b1.map(() => g() * .5); return P;
}
function logits(P, x){
  const {nin, nout, nh} = P, out = new Array(nout);
  let h = null;
  if (nh){ h = new Array(nh); for (let j = 0; j < nh; j++){ let a = P.b1[j]; const o = j * nin; for (let i = 0; i < nin; i++) a += P.W1[o + i] * x[i]; h[j] = Math.tanh(a); } }
  for (let k = 0; k < nout; k++){
    let s = P.bl[k] + (k === 0 ? P.margin : 0); const o = k * nin;
    for (let i = 0; i < nin; i++) s += P.Wl[o + i] * x[i];
    if (h){ const q = k * nh; for (let j = 0; j < nh; j++) s += P.W2[q + j] * h[j]; }
    out[k] = s;
  }
  return out;
}
function act(P, x){
  if (P.fixed !== undefined) return P.fixed;
  const l = logits(P, x); let b = 0; for (let k = 1; k < l.length; k++) if (l[k] > l[b]) b = k; return b;
}
// the trainable vector: mode 'linear' = [bl, Wl]; mode 'full' = [bl, Wl, W2] (W1/b1 stay fixed random features);
// mode 'deep' = [bl, Wl, W2, W1, b1] (the hidden layer trains too). [bl, Wl] always lead, so warm-start rules index the same.
function zerosTarget(nin, margin){ return {kind: 'target-lin', v: 1, nin, margin: margin === undefined ? 1 : margin, wt: new Array(nin).fill(0)}; } // milestone-4 target scorer (policy/policy.js)
function flat(P, mode){ if (P.kind === 'target-lin') return P.wt.slice(); if (P.kind === 'target-mlp') return P.theta.slice(); return mode === 'deep' ? [...P.bl, ...P.Wl, ...P.W2, ...P.W1, ...P.b1] : mode === 'full' ? [...P.bl, ...P.Wl, ...P.W2] : [...P.bl, ...P.Wl]; }
function unflat(P, v, mode){
  if (P.kind === 'target-lin') return Object.assign({}, P, {wt: v.slice(0, P.nin)});
  if (P.kind === 'target-mlp') return Object.assign({}, P, {theta: v.slice()});
  const Q = JSON.parse(JSON.stringify(P)), a = P.nout, b = a + P.nout * P.nin, c = b + P.nout * P.nh, d = c + P.nh * P.nin;
  Q.bl = v.slice(0, a); Q.Wl = v.slice(a, b); if (mode === 'full' || mode === 'deep') Q.W2 = v.slice(b, c);
  if (mode === 'deep'){ Q.W1 = v.slice(c, d); Q.b1 = v.slice(d, d + P.nh); }
  return Q;
}
function isZero(P){ if (P.kind === 'target-lin') return P.wt.every(v => v === 0); return P.fixed === undefined && [...P.bl, ...P.Wl, ...P.W2].every(v => v === 0); }
module.exports = { NOUT, zeros, zerosTarget, withHidden, logits, act, flat, unflat, isZero };
