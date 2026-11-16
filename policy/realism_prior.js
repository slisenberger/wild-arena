// Per-species realism priors for target choice (research/speciation_strategy.md §2; owner: everyone engages as it realistically
// would, as part of a hunting team against the human). policy/registry/realism_targets.json holds sourced tendencies per
// species: {id, claim, source, confidence, when: {feature: cond}, prefer: {feature: weight in [-1, 1]}, except: [feature...]}.
// prior(w, u, t) = sum over the deciding species' entries of confidence x sum(weight x feature value), with the entry off
// outside its context or when an 'except' feature holds. The human is never penalised (the objective outranks realism): an
// option on the human gets max(0, prior). Training adds lambda x prior to each option's lookahead score (plan.js / expert_iter
// --prior), so the student learns what wins *as that species would do it*. Deterministic, no rng, no side effects.
const fs = require('fs'), path = require('path');
const DEF = path.join(__dirname, 'registry', 'realism_targets.json');
let REG = null, REG_PATH = null;
function registry(p){ p = p || DEF; if (REG && REG_PATH === p) return REG; REG = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {}; REG_PATH = p; return REG; }
// the measurable features of target t for deciding unit u (values scaled to about [-1, 1])
function features(w, u, t){
  const I = require(process.env.SIM ? path.resolve(process.env.SIM) : path.join(__dirname, '..', 'sim.js'))._internals;
  let pack = 0; for (const o of w.units) if (o !== u && o.side === u.side && I.active(o) && I.packMate(u, o) && I.dist(u, o) < 15) pack++;
  const g = (u.s.group || 1) - 1; // a pack item (lionpack, wolfpack) is one unit standing for its group
  return {logMass: Math.max(-3, Math.min(3, Math.log(t.s.mass / u.s.mass))) / 1.5, hurt: +(t.hp / t.maxhp < .5), fleeing: +(t.state === 'flee'),
    isPred: +!!t.s.pred, isHuman: +(t === w.human), busy: +I.locked(t), dist: Math.min(60, I.dist(u, t)) / 30, packSupport: pack + g};
}
function holds(v, cond){ cond = String(cond).trim();
  if (cond === 'true') return !!v; if (cond === 'false') return !v;
  const m = cond.match(/^(>=|<=|>|<|==)?\s*(-?[\d.]+)$/); if (!m) return false; const x = +m[2];
  switch (m[1]){ case '>=': return v >= x; case '<=': return v <= x; case '>': return v > x; case '<': return v < x; default: return v === x; } }
function prior(w, u, t, reg){
  const E = (reg || registry())[u.s.id]; if (!E || !t || !t.s) return 0;
  const f = features(w, u, t); let p = 0;
  for (const e of E){
    if (e.when && !Object.entries(e.when).every(([k, c]) => holds(f[k], c))) continue;
    if (e.except && e.except.some(k => f[k])) continue;
    let s = 0; for (const [k, wt] of Object.entries(e.prefer || {})) s += wt * (f[k] || 0);
    p += (e.confidence == null ? .5 : e.confidence) * s;
  }
  return f.isHuman ? Math.max(0, p) : p;
}
module.exports = { registry, features, prior, holds };
