// Milestone 3: one board fight with an optional movement policy, plus per-fight telemetry for one archetype's units on
// the other side. Also the seed pools (train / validation / test / calibration fight sets). Pure and deterministic:
// the record depends only on (fight, weights), never on which process or shard ran it.
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const SIM = process.env.SIM ? path.resolve(process.env.SIM) : path.join(__dirname, '..', 'sim.js');
const A = require(SIM);
require('./move_policy.js');
require('./policy.js'); // target choice (cfg.policy), for the milestone-4 --target pilot
const { arch: archOf } = require('./move_arch.js');
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
// the other archetypes' gate telemetry: a long chase = closing in above 60% of top speed for > 8 s; far = > 20 m away
const XTEL = {chaseSpd: .6, longChase: 8, far: 20};
// cats: a pounce counts as stalked if the cat was creeping (moving below 45% of its top speed, the tall-grass cover
// limit) within the 3 s before it; lying still (< 1 m/s) on a target for > 12 s on end is a long hold
const CTEL = {stalkSpd: .45, stalkWin: 3, stillV: 1, stillT: 12};
// spec telemetry (behavior-spec doc, reviewed Oct 26): a cat's rush starts within ~15-30 m (Laundre & Hernandez 2003;
// Schaller 1967); pack kills follow the prey running (Mech 1966: 0 of 36 moose that stood were killed, 5 of 41 that ran)
const STEL = {farRush: 30, sprint: .85, moving: 1.5};

// ---------- fight sets (seed pools) ----------
// Each pool is its own stream; a set is (pool, index). Fights: boards dealt with A.dealBoard per map, a player-like
// team (shuffle the board, take what fits the budget), kept only when the archetype is on the other side.
const POOL = {train: 1, val: 2, test: 3, calib: 4, probe: 5};
function hasArch(board, team, arch){ return archOf(arch).has(board, team, A.defaultMount(team)); }
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
    if (opts.withCat && !team.some(id => A.BY_ID[id].pred && A.BY_ID[id].latch)) continue; // only fights where your team has a big cat
    out.push({pool, index, i: out.length, tr, bseed, board, team, mount: A.defaultMount(team), seed, live: !!opts.withLive, goal: opts.goal || null, spec: !!opts.spec}); k++;
  }
  return out;
}
function cfgOf(f){ return {team: f.team, board: f.board, terrain: f.tr, mode: 'wild', mount: f.mount, seed: f.seed, livePolicy: false}; } // livePolicy:false: the baseline is the heuristic, not the shipped policy

// ---------- one fight ----------
// weights: null = no policy at all (engine untouched); otherwise cfg.movePolicy = {[arch]: weights}
// with f.live, the OTHER archetypes use the shipped policies (policy/live.js), so v2 trains against the live game
function setPolicy(cfg, f, arch, weights){
  const mp = {};
  if (f.live) for (const [k, v] of Object.entries(I.LIVE || {})) if (v && (k !== arch || (weights && /^target-/.test(weights.kind)))) mp[k] = v;
  const by = {}; // target choice: with f.live the shipped target scorers (policy/weights/live.json "target") too, except the one being trained/evaluated
  if (f.live) for (const [k, v] of Object.entries(I.LIVE_TARGET || {})) if (v && !(k === arch && weights && /^target-/.test(weights.kind))) by[k] = v;
  if (weights && weights.kind === 'target-none'){ /* the arch keeps its shipped movement and the heuristic's targets (no target scorer) */ }
  else if (weights && /^target-/.test(weights.kind)){ by[arch] = weights; cfg.policyStats = {}; if (weights.sample) cfg.policyTrace = []; } // target scorer: the arch keeps its shipped movement policy; sample = PPO training
  else if (weights) mp[arch] = weights;
  if (Object.keys(by).length) cfg.policy = {byArch: by};
  if (Object.keys(mp).length){ cfg.movePolicy = mp; cfg.moveStats = {}; }
}
function runFight(f, weights, arch){
  arch = arch || 'harrier';
  if (arch === 'guard') return runGuardFight(f, weights);
  const cfg = cfgOf(f);
  setPolicy(cfg, f, arch, weights);
  const w = A.setup(cfg), H = w.human;
  const us = w.units.filter(u => I.archetypeOf(u) === arch);
  const S = us.map(u => ({foe: 0, dealt: 0, st: null, dart: false, lastC: 0, nc: 0, face: 0, appr: null}));
  const r = {n: us.length, life: 0, fight: 0, close: 0, idle: 0, flee: 0, feed: 0, heat: 0, carry: 0, engT: 0, nearT: 0, distSum: 0,
    darts: 0, hits: 0, dmgHuman: 0, dmgFoe: 0, noContactT: 0, longIdleT: 0, faceOnT: 0, faceOnStints: 0, appr: 0, fruitless: 0, dmgHumanAll: 0,
    farSprintT: 0, closeT: 0, hitsOnMoving: 0, rearHits: 0, fleeContactT: 0};
  if (f.spec) r.spec = true;
  if (f.goal) r.goalMode = f.goal;
  // the other non-harrier archetypes (records tagged with arch): signature-move starts and the realism-gate telemetry
  const X = arch !== 'harrier';
  if (X) Object.assign(r, {arch, charges: 0, pounces: 0, longChaseT: 0, farHuntT: 0, badgerLife: 0, badgerBackT: 0, mobLife: 0, mobExpT: 0, mobT: 0});
  // cats: stalk-then-pounce, lion (rush) vs stalker profiles, long holds in cover, sprint distance
  const CAT = arch === 'cat';
  if (CAT) Object.assign(r, {stalkPounces: 0, pRush: 0, pStalk: 0, engRush: 0, engStalk: 0, nearRush: 0, nearStalk: 0, stillLongT: 0, sprintM: 0});
  let hp0 = H.hp;
  while (!w.over){
    A.step(w);
    const hDrop = Math.max(0, hp0 - H.hp); hp0 = H.hp; r.dmgHumanAll += hDrop; // from anyone: the side-level goal
    us.forEach((u, i) => {
      const s = S[i];
      const df = u.st.foe - s.foe, dd = u.st.dealt - s.dealt; s.foe = u.st.foe; s.dealt = u.st.dealt;
      if (df > 0){ r.dmgFoe += df; if (H.lastHitBy === u && hDrop > 0) r.dmgHuman += Math.min(hDrop, df); }
      if (!I.active(u)) return;
      const st = stateOf(u); r.life += DT; r[st] += DT;
      const t = u.target, eng = (st === 'fight' || st === 'close') && t;
      if (eng){ const d = I.dist(u, t); r.engT += DT; r.distSum += d * DT; if (d <= TEL.near) r.nearT += DT; }
      const dart = !!(u.mv && u.mv.k === 'dart'); if (dart && !s.dart) r.darts++; s.dart = dart;
      if (X){
        const mk = u.mv ? u.mv.k : null; if (mk !== s.mk){ if (mk === 'charge') r.charges++; else if (mk === 'pounce'){ r.pounces++; if (CAT){ if (w.t - (s.slowAt || -99) <= CTEL.stalkWin) r.stalkPounces++; r[u.s.gait === 'rush' ? 'pRush' : 'pStalk']++; } } s.mk = mk; }
        if (CAT){
          const v = Math.hypot(u.vx, u.vy), rush = u.s.gait === 'rush';
          if (st === 'close' && v > .5 && v < CTEL.stalkSpd * u.s.spd) s.slowAt = w.t;            // creeping in (cover holds)
          if (eng){ r[rush ? 'engRush' : 'engStalk'] += DT; if (I.dist(u, t) <= TEL.near) r[rush ? 'nearRush' : 'nearStalk'] += DT; }
          if (eng && st === 'close' && v < CTEL.stillV){ s.still = (s.still || 0) + DT; if (s.still > CTEL.stillT) r.stillLongT += DT; } else s.still = 0; // lying still on a target
          if (st === 'close' && v > XTEL.chaseSpd * u.s.spd) r.sprintM += v * DT;              // metres run down at speed
        }
        // long chase: closing in at > 60% of its top speed for > 8 s on end
        if (st === 'close' && Math.hypot(u.vx, u.vy) > XTEL.chaseSpd * u.s.spd){ s.chase = (s.chase || 0) + DT; if (s.chase > XTEL.longChase) r.longChaseT += DT; } else s.chase = 0;
        if (st === 'close' && I.dist(u, t) > XTEL.far) r.farHuntT += DT;   // hunting something far across the field
        // realism (research/speciation_strategy.md §2.3, buffalo): a lion-killer (Cape buffalo, solo or herd) turns on predators
        // near it: exposure = time with one of your predators within 15 m, mob = of that, time spent targeting a predator
        if (I.has(u, 'lionKiller')){ r.mobLife += DT; if (w.units.some(o => o.side === 'P' && o.s.pred && I.active(o) && I.dist(u, o) < 15)){ r.mobExpT += DT; if (t && t.s && t.s.pred) r.mobT += DT; } }
        if (u.s.id === 'honeybadger'){ r.badgerLife += DT; if (eng && (u.intent === 1 || u.intent === 3 || u.intent === 4)) r.badgerBackT += DT; } // fearless: never waits, regroups or backs off
      }
      if (dd > 0) r.hits++;
      // spec telemetry: sprinting at a target > 30 m off; hits from behind a moving target; contact while it flees
      if (st === 'close' && t){ r.closeT += DT; if (I.dist(u, t) > STEL.farRush && Math.hypot(u.vx, u.vy) > STEL.sprint * u.s.spd) r.farSprintT += DT; }
      if (dd > 0 && t){ const tv = Math.hypot(t.vx, t.vy); if (tv > STEL.moving){ r.hitsOnMoving++; if (t.vx * (u.x - t.x) + t.vy * (u.y - t.y) < 0) r.rearHits++; } }
      if (st === 'fight' && t && stateOf(t) === 'flee') r.fleeContactT += DT;
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
  r.intents = weights && /^target-/.test(weights.kind) ? (s => [s.agree || 0, (s.n || 0) - (s.agree || 0), 0, 0, 0])(cfg.policyStats || {}) : weights && cfg.moveStats && cfg.moveStats[arch] ? cfg.moveStats[arch] : null; // target scorer: [kept the heuristic's pick, deviated]
  r.fp = fingerprint(w);
  if (cfg.policyTrace) r.trace = cfg.policyTrace; // PPO training: each sampled target decision
  return r;
}
// ---------- guard archetype telemetry ----------
// species classes for the per-class style profile
function guardClass(s){ return s.pred && s.latch ? 'cat' : s.gait === 'orbit' ? 'canid' : s.gait === 'charge' ? 'charger' : s.mass >= 2000 ? 'big' : 'other'; }
const GCLASS = ['cat', 'canid', 'charger', 'big', 'other'];
const GSIG = {hold: 'hold', knock: 'knockback', dodge: 'dodge', sweep: 'sweep', pounce: 'pounce'};
const GTEL = {near: 8, glued: 4, gluedT: 2, blockT: 3};
function runGuardFight(f, weights){
  const arch = 'guard', cfg = cfgOf(f);
  setPolicy(cfg, f, arch, weights);
  const w = A.setup(cfg), H = w.human;
  const us = w.units.filter(u => I.archetypeOf(u) === arch), ids = new Set(us.map(u => u.s.id));
  const S = us.map(u => ({c: guardClass(u.s), cat: !!(u.s.pred && u.s.latch), block: 0, glue: 0, dealt: 0, lastC: 0}));
  const r = {arch, n: us.length, life: 0, fight: 0, close: 0, idle: 0, flee: 0, feed: 0, heat: 0, carry: 0, distH: 0,
    standbyT: 0, catLife: 0, catBlockT: 0, gluedT: 0, dmgHuman: 0, dmgCollateral: 0, far24: 0, far40: 0, aloneT: 0, contactT: 0}; // far24/far40: guard-seconds that far from you; aloneT: seconds something is on you with no guard within 10 m
  for (const c of GCLASS){ r[c + 'Life'] = 0; r[c + 'Fight'] = 0; r[c + 'Idle'] = 0; r[c + 'Near'] = 0; }
  let hp0 = H.hp;
  while (!w.over){
    A.step(w);
    const hDrop = Math.max(0, hp0 - H.hp); hp0 = H.hp;
    if (hDrop > 0){ r.dmgHuman += hDrop; const a = H.lastHitBy; if (a && a.side === 'E' && a.target !== H && a.latchOn !== H) r.dmgCollateral += hDrop; }
    let fightOn = false, hContact = !!H.latchedBy;
    for (const e of w.units) if (e.side === 'E' && I.active(e)){ if (I.locked(e) || e.target === H) fightOn = true; if (e.target === H && I.dist(e, H) <= e.r + H.r + e.s.reach + .5) hContact = true; }
    if (hContact){ r.contactT += DT; if (!us.some(u => I.active(u) && !u.rider && I.dist(u, H) < 10)) r.aloneT += DT; }
    us.forEach((u, i) => {
      if (!I.active(u) || u.rider) return;
      const s = S[i], st = stateOf(u), dH = I.dist(u, H);
      r.life += DT; r[st] += DT; r.distH += dH * DT; if (dH > 24) r.far24 += DT; if (dH > 40) r.far40 += DT;
      r[s.c + 'Life'] += DT; if (st === 'fight') r[s.c + 'Fight'] += DT; if (st === 'idle') r[s.c + 'Idle'] += DT; if (dH < GTEL.near) r[s.c + 'Near'] += DT;
      const dd = u.st.dealt - s.dealt; s.dealt = u.st.dealt; if (st === 'fight' || dd > 0 || u.latchedBy || u.latchOn) s.lastC = w.t;
      // standing by while the fight goes on: idle, or 'closing in' without touching anything for > 10 s (holding a spot)
      if (fightOn && (st === 'idle' || (st === 'close' && w.t - s.lastC > TEL.contactWindow))) r.standbyT += DT;
      // a cat body-blocking a big herbivore that is fighting it back, face to face (not holding on, not held) for > 3 s
      if (s.cat){
        r.catLife += DT; const t = u.target;
        const blk = st === 'fight' && t && !t.s.pred && t.s.mass > 3 * u.s.mass && t.target === u && !u.latchOn && !u.latchedBy;
        if (blk){ s.block += DT; if (s.block > GTEL.blockT) r.catBlockT += DT; } else s.block = 0;
      }
      // glued to you, not fighting, while something is on you (> 2 s)
      const glue = hContact && dH < GTEL.glued && st !== 'fight';
      if (glue){ s.glue += DT; if (s.glue > GTEL.gluedT) r.gluedT += DT; } else s.glue = 0;
    });
  }
  r.deaths = us.filter(u => u.state === 'dead').length; r.withdrawn = us.filter(u => u.withdrawn).length;
  { const cats = us.filter((u, i) => S[i].cat); r.catN = cats.length; r.catDeaths = cats.filter(u => u.state === 'dead').length; r.catDealt = cats.reduce((x, u) => x + u.st.dealt, 0); } // your big cats (telemetry)
  r.dealt = us.reduce((a, u) => a + u.st.dealt, 0); r.protect = us.reduce((a, u) => a + u.st.protect, 0);
  for (const [k, name] of Object.entries(GSIG)){ let n = 0; for (const id of ids) n += w.sig[id + ':' + name] || 0; r['sig_' + k] = n; }
  r.hmax = H.maxhp; r.t = +w.result.t.toFixed(1); r.survived = w.result.survived ? 1 : 0; r.why = w.result.why || null; r.killer = w.result.killer || null;
  r.intents = weights && /^target-/.test(weights.kind) ? (s => [s.agree || 0, (s.n || 0) - (s.agree || 0), 0, 0, 0, 0])(cfg.policyStats || {}) : weights && cfg.moveStats[arch] ? cfg.moveStats[arch] : null; // target scorer: [kept allyTarget's pick, deviated]
  r.fp = fingerprint(w);
  if (cfg.policyTrace) r.trace = cfg.policyTrace;
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
const HARNESS_FILES = ['features.js', 'policy.js', 'move_features.js', 'move_guard_features.js', 'move_arch_features.js', 'move_cat_features.js', 'move_arch.js', 'move_model.js', 'move_policy.js', 'move_run.js', 'move_reward.js'].map(f => path.join(__dirname, f));
const simHash = () => fileHash([SIM]);
const harnessHash = () => fileHash(HARNESS_FILES);
module.exports = { A, SIM, TERR, TEL, XTEL, CTEL, GTEL, GCLASS, GSIG, guardClass, POOL, stateOf, fightSet, cfgOf, runFight, runTasks, fingerprint, simHash, harnessHash };
