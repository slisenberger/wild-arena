// Milestone 3: one board fight with an optional movement policy, plus per-fight telemetry for one archetype's units on
// the other side. Also the seed pools (train / validation / test / calibration fight sets). Pure and deterministic:
// the record depends only on (fight, weights), never on which process or shard ran it.
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const SIM = process.env.SIM ? path.resolve(process.env.SIM) : path.join(__dirname, '..', 'sim.js');
const A = require(SIM);
require('./move_policy.js');
const I = A._internals;
const TERR = Object.keys(A.TERRAINS);
const DT = A.DT;

// audit.js's state classifier (kept identical)
function stateOf(u){
  if (u.heatstroke || u.state === 'cool') return 'heat';
  if (u.state === 'flee' || u.state === 'withdraw') return 'flee';
  if (u.state === 'feed' || u.state === 'rest') return 'feed';
  if (u.state === 'carry') return 'carry';
  if (u.latchOn || u.latchedBy) return 'fight';
  if (u.target && u.state === 'engage'){ const t = u.target, d = Math.hypot(u.x - t.x, u.y - t.y); return d < u.r + t.r + u.s.reach + 1.5 ? 'fight' : 'close'; }
  return 'idle';
}
// thresholds for the telemetry (seconds)
const TEL = {contactWindow: 10, longIdle: 30, faceOn: 3, near: 10};

// ---------- fight sets (seed pools) ----------
// Each pool is its own stream; a set is (pool, index). Fights: boards dealt with A.dealBoard per map, a player-like
// team (shuffle the board, take what fits the budget), kept only when the archetype is on the other side.
const POOL = {train: 1, val: 2, test: 3, calib: 4, probe: 5};
function hasArch(board, team, arch){ return board.some(id => !team.includes(id) && arch === 'harrier' && A.BY_ID[id].gait === 'orbit'); }
function fightSet(pool, index, n, opts){
  opts = opts || {};
  const arch = opts.arch || 'harrier', base = opts.seed || 1;
  const maps = TERR.filter(t => pool === 'test' ? true : t !== opts.holdMap);
  const R = A.rng((base * 7919 + POOL[pool] * 1000003 + index * 104729) >>> 0), out = [];
  let tries = 0;
  for (let k = 0; out.length < n && tries < n * 200; tries++){
    const tr = maps[k % maps.length];
    const bseed = Math.floor(R() * 1e9) + 1, board = A.dealBoard(bseed, {terrain: tr});
    const order = board.slice(); for (let q = order.length - 1; q > 0; q--){ const r = Math.floor(R() * (q + 1)); [order[q], order[r]] = [order[r], order[q]]; }
    const team = []; let left = A.RULES.budget; for (const id of order) if (A.BY_ID[id].price <= left){ team.push(id); left -= A.BY_ID[id].price; }
    const seed = Math.floor(R() * 2e9) + 1;
    if (!hasArch(board, team, arch)) continue;
    out.push({pool, index, i: out.length, tr, bseed, board, team, mount: A.defaultMount(team), seed}); k++;
  }
  return out;
}
function cfgOf(f){ return {team: f.team, board: f.board, terrain: f.tr, mode: 'wild', mount: f.mount, seed: f.seed}; }

// ---------- one fight ----------
// weights: null = no policy at all (engine untouched); otherwise cfg.movePolicy = {[arch]: weights}
function runFight(f, weights, arch){
  arch = arch || 'harrier';
  const cfg = cfgOf(f);
  if (weights){ cfg.movePolicy = {[arch]: weights}; cfg.moveStats = {}; }
  const w = A.setup(cfg), H = w.human;
  const us = w.units.filter(u => I.archetypeOf(u) === arch);
  const S = us.map(u => ({foe: 0, dealt: 0, st: null, dart: false, lastC: 0, nc: 0, face: 0, appr: null}));
  const r = {n: us.length, life: 0, fight: 0, close: 0, idle: 0, flee: 0, feed: 0, heat: 0, carry: 0, engT: 0, nearT: 0, distSum: 0,
    darts: 0, hits: 0, dmgHuman: 0, dmgFoe: 0, noContactT: 0, longIdleT: 0, faceOnT: 0, faceOnStints: 0, appr: 0, fruitless: 0};
  let hp0 = H.hp;
  while (!w.over){
    A.step(w);
    const hDrop = Math.max(0, hp0 - H.hp); hp0 = H.hp;
    us.forEach((u, i) => {
      const s = S[i];
      const df = u.st.foe - s.foe, dd = u.st.dealt - s.dealt; s.foe = u.st.foe; s.dealt = u.st.dealt;
      if (df > 0){ r.dmgFoe += df; if (H.lastHitBy === u && hDrop > 0) r.dmgHuman += Math.min(hDrop, df); }
      if (!I.active(u)) return;
      const st = stateOf(u); r.life += DT; r[st] += DT;
      const t = u.target, eng = (st === 'fight' || st === 'close') && t;
      if (eng){ const d = I.dist(u, t); r.engT += DT; r.distSum += d * DT; if (d <= TEL.near) r.nearT += DT; }
      const dart = !!(u.mv && u.mv.k === 'dart'); if (dart && !s.dart) r.darts++; s.dart = dart;
      if (dd > 0) r.hits++;
      if (st === 'fight' || dd > 0 || u.latchedBy) s.lastC = w.t;
      // no contact: hunting (idle or closing in) without touching anything for > contactWindow s; pointless motion counts too
      if ((st === 'idle' || st === 'close') && w.t - s.lastC > TEL.contactWindow){ r.noContactT += DT; s.nc += DT; if (s.nc > TEL.longIdle) r.longIdleT += DT; } else s.nc = 0;
      // face-on: in reach of something that is fighting it back, not darting, not held
      const face = st === 'fight' && t && t.target === u && !dart && !u.latchedBy && !u.latchOn;
      if (face){ s.face += DT; if (s.face > TEL.faceOn){ r.faceOnT += DT; if (s.face - DT <= TEL.faceOn) r.faceOnStints++; } } else s.face = 0;
      // approaches: a closing-in stint either reaches contact or ends without it (fruitless)
      if (st === 'close'){ if (!s.appr || s.appr !== t){ if (s.appr) r.fruitless++; s.appr = t; r.appr++; } }
      else if (s.appr){ if (st !== 'fight') r.fruitless++; s.appr = null; }
    });
  }
  r.deaths = us.filter(u => u.state === 'dead').length; r.escaped = us.filter(u => u.escaped).length;
  r.hmax = H.maxhp; r.killedYou = !w.result.survived && H.state === 'dead' && us.includes(H.lastHitBy) ? 1 : 0;
  r.t = +w.result.t.toFixed(1); r.survived = w.result.survived ? 1 : 0; r.why = w.result.why || null; r.killer = w.result.killer || null;
  r.intents = weights && cfg.moveStats[arch] ? cfg.moveStats[arch] : null;
  r.fp = fingerprint(w);
  return r;
}
// a compact fingerprint of the whole fight (event log + final positions) for identity checks
function fingerprint(w){
  const h = crypto.createHash('sha1');
  h.update(JSON.stringify(w.events)); h.update(JSON.stringify(w.units.map(u => [u.x, u.y, u.hp, u.state])));
  return h.digest('hex').slice(0, 16);
}
// run a list of tasks [{c, f}] against candidate weights (index -> weights)
function runTasks(tasks, cands, fights, arch){ return tasks.map(k => ({k: k.k, rec: runFight(fights[k.f], cands[k.c], arch)})); }

function fileHash(files){ const h = crypto.createHash('sha256'); for (const f of files) h.update(fs.readFileSync(f)); return h.digest('hex').slice(0, 16); }
const HARNESS_FILES = ['move_features.js', 'move_model.js', 'move_policy.js', 'move_run.js', 'move_reward.js'].map(f => path.join(__dirname, f));
const simHash = () => fileHash([SIM]);
const harnessHash = () => fileHash(HARNESS_FILES);
module.exports = { A, SIM, TERR, TEL, POOL, stateOf, fightSet, cfgOf, runFight, runTasks, fingerprint, simHash, harnessHash };
