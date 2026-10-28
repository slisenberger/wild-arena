// Milestone 4 state encoder ('target-set'): a target scorer that sees every animal on the field, not just per-option
// summaries. For a deciding unit u and a candidate target t, each other active unit j (the 16 nearest to u) becomes a row:
// its fixed part U_j (relative to u: side, distances to u and to you, closing speeds, size, HP, strength, kind, whom it is
// after) and its t part T_j (distance to t, closing on t, is t, is after t, t is after it). A shared layer encodes each row,
// phi_j = tanh(Wp [U_j, T_j] + bp), the rows are averaged (pool), and the option scorer is the target-mlp form over
// z = [option features x, the unit's traits, pool]: f = wl.z + v.tanh(W1 z + b1); score = margin*[heuristic's pick] + f.
// Output weights start at zero, so a fresh model plays today's game. Deterministic, no rng, no side effects.
const path = require('path');
const A = require(process.env.SIM ? path.resolve(process.env.SIM) : path.join(__dirname, '..', 'sim.js'));
const TR = require('./traits.js'), I = A._internals;
const UN = ['ally', 'enemy', 'human', 'dU', 'dH', 'closeU', 'closeH', 'logMass', 'hp', 'logStr', 'pred', 'giant', 'charge', 'latch',
  'onU', 'onH', 'onAllyOfU', 'locked', 'fleeing', 'stunned'];
const TN = ['dT', 'closeT', 'isT', 'onT', 'tOnIt'];
const NU = UN.length, NT = TN.length, NR = NU + NT, MAXU = 16;
const lg = x => Math.log(Math.max(1e-6, x));
function closing(j, o){ const d = I.dist(j, o) || 1; return ((o.x - j.x) * j.vx + (o.y - j.y) * j.vy) / d / 20; } // m/s toward o, /20
// the fixed rows: [{j, row}] for the 16 active units nearest to u (you included), u's side as 'ally'
function unitRows(w, u){
  const H = w.human, su = I.strength(u), mine = x => x.side === u.side || (u.side === 'P' && x.side === 'H') || (u.side === 'H' && x.side === 'P');
  const js = w.units.filter(j => j !== u && I.active(j)).sort((a, b) => I.dist(u, a) - I.dist(u, b)).slice(0, MAXU);
  return js.map(j => { const tt = j.target && I.active(j.target) ? j.target : null;
    return {j, row: [+(mine(j) && j.side !== 'H'), +!mine(j), +(j.side === 'H'), Math.min(2, I.dist(u, j) / 50), Math.min(2, I.dist(j, H) / 50), closing(j, u), closing(j, H),
      lg(j.s.mass / u.s.mass) / 3, j.hp / j.maxhp, lg(I.strength(j) / su) / 2, +!!j.s.pred, +(j.s.id === 'elephant' || I.has(j, 'giant')), +!!j.s.charge, +!!j.s.latch,
      +(tt === u), +(tt === H), +(!!tt && tt !== u && mine(tt)), +I.locked(j), +(j.state === 'flee'), +(j.stun > 0)]}; });
}
function tRows(U, t){ return U.map(({j}) => { const tt = j.target && I.active(j.target) ? j.target : null, ut = t.target && I.active(t.target) ? t.target : null;
  return [Math.min(2, I.dist(j, t) / 50), closing(j, t), +(j === t), +(tt === t), +(ut === j)]; }); }
// per decision: the shared fixed rows (U) and each option's t rows (null for 'none' / 'feed'): what plan.js logs and the model reads
function setInputs(w, u, opts){ const U = unitRows(w, u); return {U: U.map(x => x.row), T: opts.map(o => o.kind === 'target' ? tRows(U, o.t) : null)}; }

// ---------- the model ----------
// theta = [wl (nz), v (nh), b1 (nh), W1 (nh x nz), Wp (K x NR), bp (K)], nz = nx + K
function make(nx, K, nh, margin, seed){
  const nz = nx + K, n = nz + 2 * nh + nh * nz + K * NR + K, th = new Array(n).fill(0); let s = (seed >>> 0) || 1;
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 * 2 - 1; };
  for (let i = nz + 2 * nh; i < nz + 2 * nh + nh * nz; i++) th[i] = r() / Math.sqrt(nz);
  for (let i = nz + 2 * nh + nh * nz; i < nz + 2 * nh + nh * nz + K * NR; i++) th[i] = r() / Math.sqrt(NR);
  return {kind: 'target-set', v: 1, nx, K, nh, nz, nr: NR, margin, self: true, theta: th};
}
const off = P => { const {nz, nh, K} = P; const o = {wl: 0, v: nz, b1: nz + nh, W1: nz + 2 * nh}; o.Wp = o.W1 + nh * nz; o.bp = o.Wp + K * NR; return o; };
// pooled encoding of one option's rows (U shared, T this option's); empty set -> zeros
function pool(P, th, U, T){
  const {K} = P, o = off(P), p = new Array(K).fill(0), phis = [];
  if (!T || !U.length) return {p, phis, rows: []};
  const rows = U.map((u, j) => u.concat(T[j]));
  for (const r of rows){ const ph = new Array(K); for (let k = 0; k < K; k++){ let a = th[o.bp + k]; const b = o.Wp + k * NR; for (let q = 0; q < NR; q++) a += th[b + q] * r[q]; ph[k] = Math.tanh(a); p[k] += ph[k] / rows.length; } phis.push(ph); }
  return {p, phis, rows};
}
function fwd(P, th, x, pl){ // f(z) and its pieces
  const {nz, nh} = P, o = off(P), z = x.concat(pl.p), h = new Array(nh); let f = 0;
  for (let k = 0; k < nz; k++) f += th[o.wl + k] * z[k];
  for (let j = 0; j < nh; j++){ let a = th[o.b1 + j]; const b = o.W1 + j * nz; for (let k = 0; k < nz; k++) a += th[b + k] * z[k]; h[j] = Math.tanh(a); f += th[o.v + j] * h[j]; }
  return {f, z, h};
}
// one decision: inputs per option {x: option features + traits, T}, shared U. scores(P, D, teach, th) -> array
function scores(P, D, teach, th){ th = th || P.theta; return D.x.map((x, i) => (i === teach ? P.margin : 0) + fwd(P, th, x, pool(P, th, D.U, D.T[i])).f); }
// adds c * d f(option i) / d theta into g
function addGrad(g, th, P, D, i, c){
  const {nz, nh, K, nx} = P, o = off(P), pl = pool(P, th, D.U, D.T[i]), {z, h} = fwd(P, th, D.x[i], pl);
  const dz = new Array(nz).fill(0);
  for (let k = 0; k < nz; k++){ g[o.wl + k] += c * z[k]; dz[k] += th[o.wl + k]; }
  for (let j = 0; j < nh; j++){
    g[o.v + j] += c * h[j]; const dj = th[o.v + j] * (1 - h[j] * h[j]); if (!dj) continue;
    g[o.b1 + j] += c * dj; const b = o.W1 + j * nz; for (let k = 0; k < nz; k++){ g[b + k] += c * dj * z[k]; dz[k] += dj * th[b + k]; }
  }
  if (!pl.rows.length) return;
  const n = pl.rows.length;
  for (let k = 0; k < K; k++){ const dp = dz[nx + k]; if (!dp) continue;
    for (let r = 0; r < n; r++){ const ph = pl.phis[r][k], e = c * dp * (1 - ph * ph) / n; g[o.bp + k] += e; const b = o.Wp + k * NR, row = pl.rows[r]; for (let q = 0; q < NR; q++) g[b + q] += e * row[q]; } }
}
// the game hook's view of a decision: option features X (rows), plus the set; traits appended to every option's x
function decision(w, u, opts, X){ const s = setInputs(w, u, opts), t = TR.traits(u.s); return {x: X.map(x => x.concat(t)), U: s.U, T: s.T}; }
module.exports = { UN, TN, NU, NT, NR, MAXU, unitRows, tRows, setInputs, make, scores, addGrad, decision, npar: P => P.theta.length };
