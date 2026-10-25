// Realism gates for a learned predator policy, from paired fights (same jobs) of the heuristic (H) and the policy (N),
// each row from run.js fight(..., prof = true):
//  1. per-species time profile: share of predator-seconds on you / on your animals / feeding / no target stays within
//     ±PROFILE_PTS points of the heuristic's (species with at least MIN_SEC predator-seconds in the heuristic arm). Fails
//     when the deviation exceeds PROFILE_PTS by more than one paired standard error (shareSE); a deviation beyond
//     PROFILE_PTS but within that noise is reported as a warning. (Even the behavior-cloned net, 99% agreement, can
//     show an 11-point swing on one species' feeding share in 400 fights: a different kill early = a different carcass.)
//  2. appetite for people stays ordered by species: for every pair whose prey.human appetites differ 2x or more and whose
//     "time on you" shares the heuristic orders that way by at least ORDER_MARGIN points (smaller gaps are noise, e.g. a
//     croc's share is set by the water rule more than by appetite), the policy keeps the order;
//  3. predator deaths per fight do not rise: paired increase below 2 SE and below 10% of the heuristic's rate.
const { A, CATS } = require('./run.js');
const PROFILE_PTS = 10, MIN_SEC = 1500, ORDER_MARGIN = 5;
const GATED = ['you', 'animals', 'feed', 'none'];
const mean = a => a.length ? a.reduce((p, q) => p + q, 0) / a.length : 0;
const se = a => a.length > 1 ? Math.sqrt(a.reduce((p, q) => p + (q - mean(a)) ** 2, 0) / (a.length - 1) / a.length) : 0;

function profile(rows){ // species -> {sec, share: {cat: %}}
  const S = {};
  for (const r of rows) for (const [sp, t] of Object.entries(r.T)){ const s = S[sp] || (S[sp] = Object.fromEntries(CATS.map(k => [k, 0]))); for (const k of CATS) s[k] += t[k]; }
  const out = {};
  for (const [sp, s] of Object.entries(S)){ const tot = CATS.reduce((a, k) => a + s[k], 0); out[sp] = {sec: tot, share: Object.fromEntries(CATS.map(k => [k, tot ? 100 * s[k] / tot : 0]))}; }
  return out;
}
// paired standard error of a pooled share difference (ratio estimator, linearized per fight): fights are the
// independent units, and one long fight can move a species' pooled share a lot
function shareSE(H, N, sp, k, ph, pn){
  const n = H.length, TH = ph.sec, TN = pn.sec, sH = ph.share[k] / 100, sN = pn.share[k] / 100, z = [];
  const tot = t => t ? CATS.reduce((a, c) => a + t[c], 0) : 0;
  for (let i = 0; i < n; i++){ const th = H[i].T[sp], tn = N[i].T[sp];
    z.push(100 * n * (((tn ? tn[k] : 0) - sN * tot(tn)) / TN - ((th ? th[k] : 0) - sH * tot(th)) / TH)); }
  return se(z);
}
function check(H, N){
  const fails = [], warns = [], pH = profile(H), pN = profile(N);
  for (const sp of Object.keys(pH)){
    if (pH[sp].sec < MIN_SEC || !pN[sp]) continue;
    for (const k of GATED){ const d = pN[sp].share[k] - pH[sp].share[k], s = shareSE(H, N, sp, k, pH[sp], pN[sp]);
      if (Math.abs(d) > PROFILE_PTS + s) fails.push(`${sp} ${k} ${d > 0 ? '+' : ''}${d.toFixed(1)} ± ${s.toFixed(1)} pts`);
      else if (Math.abs(d) > PROFILE_PTS) warns.push(`${sp} ${k} ${d > 0 ? '+' : ''}${d.toFixed(1)} ± ${s.toFixed(1)} pts (within noise)`); }
  }
  const app = sp => (A.BY_ID[sp].prey && A.BY_ID[sp].prey.human) || 1;
  const sps = Object.keys(pH).filter(sp => pH[sp].sec >= MIN_SEC && pN[sp]);
  for (const a of sps) for (const b of sps) if (app(a) >= 2 * app(b) && pH[a].share.you >= pH[b].share.you + ORDER_MARGIN && !(pN[a].share.you > pN[b].share.you))
    fails.push(`appetite order ${a} (${pN[a].share.you.toFixed(1)}%) <= ${b} (${pN[b].share.you.toFixed(1)}%) on you`);
  const dd = H.map((h, i) => N[i].deaths - h.deaths), md = mean(dd), sd = se(dd), base = mean(H.map(h => h.deaths));
  if (md > 0 && (md >= 2 * sd || md > .1 * base)) fails.push(`predator deaths +${md.toFixed(3)} ± ${sd.toFixed(3)} / fight (heuristic ${base.toFixed(2)})`);
  return {pass: !fails.length, fails, warns, pH, pN};
}
module.exports = { check, profile, GATED, PROFILE_PTS, MIN_SEC, mean, se };
