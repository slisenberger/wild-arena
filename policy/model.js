// Tiny shared MLP scorer: score(option) = W2 · tanh(W1 · x + b1) + b2, softmax over a decision's options.
// Pure JS, no dependencies. Weights are plain JSON: {nin, nh, W1:[nh*nin], b1:[nh], W2:[nh], b2, names?}.
// Inference is deterministic: argmax, ties broken by option order (first wins).
function init(nin, nh, R){
  R = R || Math.random;
  const g = () => { let u = 0, v = 0; while (!u) u = R(); v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const W1 = new Array(nh * nin), s1 = 1 / Math.sqrt(nin), s2 = 1 / Math.sqrt(nh);
  for (let i = 0; i < W1.length; i++) W1[i] = g() * s1;
  return {nin, nh, W1, b1: new Array(nh).fill(0), W2: Array.from({length: nh}, () => g() * s2), b2: 0};
}
function score(P, x, hbuf){
  const {nin, nh, W1, b1, W2} = P; let s = P.b2;
  for (let j = 0; j < nh; j++){
    let a = b1[j]; const o = j * nin;
    for (let i = 0; i < nin; i++) a += W1[o + i] * x[i];
    const h = Math.tanh(a); if (hbuf) hbuf[j] = h; s += W2[j] * h;
  }
  return s;
}
function argmax(P, X){ let b = 0, bs = -Infinity; for (let i = 0; i < X.length; i++){ const s = score(P, X[i]); if (s > bs){ bs = s; b = i; } } return b; }
function probs(P, X){ const s = X.map(x => score(P, x)), m = Math.max(...s), e = s.map(v => Math.exp(v - m)), z = e.reduce((a, b) => a + b, 0); return e.map(v => v / z); }
// flat parameter vector <-> weights (for optimizers that treat the net as one vector, e.g. evolution strategies)
function flat(P){ return [...P.W1, ...P.b1, ...P.W2, P.b2]; }
function unflat(v, nin, nh){ const a = nh * nin; return {nin, nh, W1: v.slice(0, a), b1: v.slice(a, a + nh), W2: v.slice(a + nh, a + 2 * nh), b2: v[a + 2 * nh]}; }
module.exports = { init, score, argmax, probs, flat, unflat };
