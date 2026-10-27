// Progressive mode: a run of 7 rounds up a price ladder (replaces the switched-off Migration mode).
// Round 1 is dealt only from $100 animals; each round raises the per-animal cap and the board total, giants only near
// the end (the last round guarantees one). The other side is everything on the board you don't buy, plus from round 3
// one premium enemy from that round's top price band that can't be bought. Survivors keep their wounds (a free rest
// heals 30% of what's missing; a full heal costs 55% of the price times the share of health missing; selling pays half the price times health), a fight below 25% health leaves a scar (-10% max
// health for the run, up to -30%), and animals earn XP for what they do and level up (experience, not superpowers).
// A loss uses one of two retries: back to the round's shop as it opened (the lost fight is undone except the time
// alive), refight on a new fight seed; the third loss ends the run.
// Pure JS, no DOM: the game UI (ui.js) and the balance bot (progressive_bot.js) share these rules.
// Engine hooks (sim.js setup, all opt-in): cfg.startHp (wounds), cfg.maxHp (scars), cfg.levels; dealBoard rules.exclude / maxPrice.
(function(root){
'use strict';
const A = root.Arena || require('./sim.js');

const PROG = {
  ROUNDS: 7, RETRIES: 2,
  // the price ladder: round k (0-based) deals CAP[k] or cheaper (0 = no cap), BOARD[k] animals worth TOTAL[k] (± $100)
  CAP:   [100, 200, 300, 400, 400, 700, 0],
  BOARD: [10, 10, 10, 10, 11, 11, 12],
  TOTAL: [1000, 1200, 1500, 1800, 2100, 2300, 2600], // retuned on the final engine (abs_r16 prices, Oct 27): see CLAUDE.md
  RARE:  [.1, .15, .2, .25, .3, .3, .3],
  R1_OUT: [],                      // species kept out of round 1 (e.g. the $100 big cats, so it's the small fry's round)
  PREMIUM_FROM: 2,                 // round 3 on: one premium enemy from the round's top price band, not for sale
  START: 400, TOPUP: [0, 450, 500, 500, 500, 600, 800], // round 1 is all $100 animals, so it starts on a whole $100 (owner); money: $START for round 1, then a fixed top-up for each later round you reach
  PER_KILL: 25, KILL_CAP: 150,     // + $25 per enemy killed, at most $150 a fight (owner may change these)
  REST: .3,                        // free rest between fights: heals 30% of the missing health
  HEAL_RATE: .55, HEAL_MIN: 10,    // full heal: price × HEAL_RATE × the share of the pick's health that's missing ($5 steps, rounded up, at least $10)
  SELL_SHARE: .5, SELL_MIN: .25,   // sell: price × SELL_SHARE × its condition ($5 steps, rounded down); below 25% condition it can't be sold
  STEP: 5,
  // condition = the pick's health summed over its members ÷ the group size (a pack with dead members is worth less).
  // HEAL_RATE ≥ SELL_SHARE, so healing then selling never makes money (UX pass, Oct 27; the old rule was a flat 25% heal, half-price sale; .55 kept the bot's completion rate where it was)
  SCAR_AT: .25, SCAR: .1, SCAR_MAX: 3, // below 25% health in a fight: -10% max health for the run, at most 3 scars
  XP: {dmg: 50, kill: 10, survive: 5, sig: 5, sigMax: 2, mvp: 10}, // 1 XP per 50 damage (double vs things attacking you)
  LEVELS: [25, 60, 110],           // XP for Seasoned, Cunning, Veteran
};
const LEVEL_NAME = ['Rookie', 'Seasoned', 'Cunning', 'Veteran'];
const LEVEL_DESC = ['', 'Morale breaks later; a fallen packmate shakes it less.', 'Spots threats 15% farther away.', '+10% damage and +10% max health.'];
const GIANTS = ['elephant', 'mammoth', 'triceratops']; // the last round guarantees one of these on the board

function hash(s){ let h = 2166136261; for (const c of String(s)){ h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) % 1e6 + 1; }
const groupOf = id => A.BY_ID[id].group || 1;
const spOf = id => A.BY_ID[id].species || id;
const levelOf = xp => PROG.LEVELS.filter(t => xp >= t).length;
// a team entry's condition (0..1): health summed over its members ÷ group size; missing = what a full heal restores
const condition = e => e.hp.reduce((s, f) => s + f, 0) / groupOf(e.id);
const missing = e => e.hp.reduce((s, f) => s + Math.max(0, 1 - f), 0) / groupOf(e.id);
const healCost = e => Math.max(PROG.HEAL_MIN, Math.ceil(A.BY_ID[e.id].price * PROG.HEAL_RATE * missing(e) / PROG.STEP - 1e-9) * PROG.STEP);
const sellPrice = e => Math.floor(A.BY_ID[e.id].price * PROG.SELL_SHARE * Math.min(1, condition(e)) / PROG.STEP + 1e-9) * PROG.STEP;
const tooHurtToSell = e => condition(e) < PROG.SELL_MIN;

function terrainOrder(seed){
  const t = Object.keys(A.TERRAINS), R = A.rng(hash('terr:' + seed));
  for (let i = t.length - 1; i > 0; i--){ const j = Math.floor(R() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; }
  return t;
}
function newRun(seed, daily){
  const run = {v: 1, mode: 'progressive', seed, daily: daily || null, k: 0, attempt: 0, losses: 0, money: PROG.START, team: [], log: [],
    total: 0, won: 0, kills: 0, over: false, complete: false, phase: 'shop', mvp: {}, hist: [], uidN: 0};
  dealRound(run);
  return run;
}
// deal round run.k: a board up the ladder (everything you don't buy fights you) and, from round 3, the premium enemy
function dealRound(run){
  const k = run.k, cap = PROG.CAP[k], last = k === PROG.ROUNDS - 1;
  run.terrain = terrainOrder(run.seed)[k % 4]; run.attempt = 0;
  run.boardSeed = hash('board:' + run.seed + ':' + k); run.fightSeed = hash('fight:' + run.seed + ':' + k);
  const ownedSp = run.team.map(e => spOf(e.id)), cold = A.TERRAINS[run.terrain].cold;
  const formsOf = s => A.ANIMALS.filter(a => spOf(a.id) === s).map(a => a.id);
  const exclude = [].concat(...ownedSp.map(formsOf));
  if (k === 0) for (const sp of PROG.R1_OUT) exclude.push(...formsOf(sp));
  const ok = a => !(cold && a.cold < .3) && !exclude.includes(a.id) && (!cap || a.price <= cap);
  // the premium enemy: the round's top price band, non-rare if there is one, chosen by the seed
  let premium = null;
  if (k >= PROG.PREMIUM_FROM){
    const pool = A.ANIMALS.filter(a => ok(a) && !(last && GIANTS.includes(a.id))), top = Math.max(...pool.map(a => a.price)); // the last round's giant is for sale, not the premium
    let band = pool.filter(a => a.price === top && !a.rare);
    if (!band.length) band = pool.filter(a => a.price === top);
    if (band.length){ premium = band[Math.floor(A.rng(hash('prem:' + run.seed + ':' + k))() * band.length)].id; exclude.push(...formsOf(spOf(premium))); }
  }
  const rules = {terrain: run.terrain, board: PROG.BOARD[k], total: PROG.TOTAL[k], rareP: PROG.RARE[k], exclude, maxPrice: cap};
  let board;
  if (last){ // the herd: one giant guaranteed on the board (for sale)
    const gs = GIANTS.filter(id => !exclude.includes(id) && !(cold && A.BY_ID[id].cold < .3));
    const g = gs.length ? gs[Math.floor(A.rng(hash('giant:' + run.seed))() * gs.length)] : null;
    if (g){ rules.board -= 1; rules.total -= A.BY_ID[g].price; rules.exclude = exclude.concat(GIANTS); rules.rareP = Math.min(rules.rareP, .15); }
    const b = A.dealBoard(run.boardSeed, rules).concat(g ? [g] : []);
    board = A.ANIMALS.map(a => a.id).filter(id => b.includes(id));
  } else board = A.dealBoard(run.boardSeed, rules);
  run.board = board; run.premium = premium;
  snapshot(run);
  return board;
}
// the shop as it stood when the round opened: a lost fight goes back to it (a retry is a second go at the round)
function snapshot(run){ run.pre = JSON.stringify({money: run.money, team: run.team, board: run.board}); }
const teamIds = run => run.team.map(e => e.id);
const onTeam = (run, id) => run.team.some(e => e.id === id);
// the engine cfg for the coming fight (deploy and fight screens add placements, mount, human spot)
function cfgFor(run){
  const ids = teamIds(run), startHp = {}, maxHp = {}, levels = {};
  for (const e of run.team){
    startHp[e.id] = e.hp.slice();
    if (e.scar.some(s => s > 0)) maxHp[e.id] = e.scar.map(s => 1 - PROG.SCAR * s);
    if (e.lv) levels[e.id] = e.lv;
  }
  const c = {board: run.board.concat(run.premium ? [run.premium] : []), team: ids, terrain: run.terrain, mode: 'wild', seed: run.fightSeed, mount: A.defaultMount(ids), startHp};
  if (Object.keys(maxHp).length) c.maxHp = maxHp;
  if (Object.keys(levels).length) c.levels = levels;
  return c;
}
// the shop: buy from the board, return a buy made this visit (full refund), sell a carried animal (half price × condition), pay for a full heal
function canBuy(run, id){ return run.phase === 'shop' && run.board.includes(id) && id !== run.premium && !onTeam(run, id) && A.BY_ID[id].price <= run.money; }
function buy(run, id){ if (!canBuy(run, id)) return false; run.money -= A.BY_ID[id].price; const n = groupOf(id); run.team.push({id, uid: ++run.uidN, hp: Array(n).fill(1), scar: Array(n).fill(0), xp: 0, lv: 0, kills: 0, fresh: true}); return true; }
// the run's history of every animal that fought for you (the end screen's table): one record per buy, found by uid
function histOf(run, e){
  if (!run.hist) run.hist = [];
  if (e.uid == null) e.uid = run.uidN = (run.uidN || 0) + 1; // a run saved before histories existed
  let h = run.hist.find(x => x.uid === e.uid);
  if (!h){ h = {uid: e.uid, id: e.id, from: run.k, fights: 0, rounds: [], kills: 0, dealt: 0, protect: 0, mvp: 0, xp: 0, lv: 0, scars: 0, out: null}; run.hist.push(h); }
  return h;
}
function unbuy(run, id){ const i = run.team.findIndex(e => e.id === id && e.fresh); if (i < 0) return false; run.money += A.BY_ID[id].price; run.team.splice(i, 1); return true; }
function canSell(run, id){ const e = run.team.find(x => x.id === id && !x.fresh); return !!e && run.phase === 'shop' && !tooHurtToSell(e); }
function sell(run, id){ if (!canSell(run, id)) return false; const i = run.team.findIndex(e => e.id === id && !e.fresh), e = run.team[i], sp = sellPrice(e); run.money += sp; histOf(run, e).out = {how: 'sold', k: run.k, price: sp}; run.team.splice(i, 1); return true; }
const needsHeal = e => e.hp.some(f => f < .995);
function canHeal(run, id){ const e = run.team.find(x => x.id === id); return !!e && run.phase === 'shop' && needsHeal(e) && healCost(e) <= run.money; }
function heal(run, id){ if (!canHeal(run, id)) return false; const e = run.team.find(x => x.id === id); run.money -= healCost(e); e.hp = e.hp.map(() => 1); return true; }

// after the fight: XP and levels, scars, wounds (plus a free rest), money; a loss uses a retry
function applyResult(run, w){
  const res = w.result, score = res.score, k = run.k, X = PROG.XP;
  const enemies = w.units.filter(u => u.side === 'E'), down = enemies.filter(u => u.state === 'dead').length, routed = enemies.filter(u => u.escaped).length;
  const entry = {k, attempt: run.attempt, terrain: run.terrain, premium: run.premium, t: score, survived: res.survived, why: res.why || null, killer: res.killer || null,
    down, routed, lost: [], xp: {}, ups: [], scars: [], kills: {}, earned: 0, team: teamIds(run)};
  // per pick: a pick's units are contiguous and in team order (leader first), so hp/scar arrays stay aligned with the members
  const per = run.team.map(e => {
    const us = w.units.filter(u => u.side === 'P' && u.s.id === e.id);
    const dealt = us.reduce((s, u) => s + u.st.dealt + u.st.protect, 0); // damage to something attacking you counts double
    return {e, us, dealt, kills: us.reduce((s, u) => s + u.st.kills, 0), sig: us.reduce((s, u) => s + (u.st.sig || 0), 0)};
  });
  const top = per.reduce((b, p) => p.dealt > (b ? b.dealt : 0) ? p : b, null);
  if (top){ entry.mvp = top.e.id; run.mvp[top.e.id] = (run.mvp[top.e.id] || 0) + 1; }
  const team = [];
  for (const p of per){
    const {e, us} = p, alive = [];
    us.forEach((u, i) => { if (u.state !== 'dead' && !u.escaped) alive.push({f: Math.max(.01, u.hp / u.maxhp), scar: (e.scar[i] || 0) + ((u.st.low != null && u.st.low < PROG.SCAR_AT) ? 1 : 0), was: e.scar[i] || 0}); });
    const lostN = us.length - alive.length;
    if (lostN) entry.lost.push({id: e.id, n: lostN, all: !alive.length});
    const why = {fight: Math.round(p.dealt / X.dmg), kills: X.kill * p.kills, survive: alive.length ? X.survive : 0, sig: X.sig * Math.min(X.sigMax, p.sig), mvp: top === p && p.dealt > 0 ? X.mvp : 0};
    const xp = why.fight + why.kills + why.survive + why.sig + why.mvp; // what it earned the XP for (the recap lists it)
    entry.xp[e.id] = xp; (entry.xpWhy = entry.xpWhy || {})[e.id] = why; if (p.kills) entry.kills[e.id] = p.kills;
    e.kills = (e.kills || 0) + p.kills; e.xp += xp;
    const lv = levelOf(e.xp); if (lv > e.lv){ entry.ups.push({id: e.id, lv}); e.lv = lv; }
    const h = histOf(run, e); h.fights++; if (!h.rounds.includes(k)) h.rounds.push(k);
    h.kills += p.kills; h.dealt += Math.round(us.reduce((s, u) => s + u.st.dealt, 0)); h.protect += Math.round(us.reduce((s, u) => s + u.st.protect, 0)); if (top === p) h.mvp++;
    h.xp = e.xp; h.lv = e.lv; h.scars = Math.max(h.scars, alive.reduce((s, a) => s + Math.min(PROG.SCAR_MAX, a.scar), 0));
    if (!alive.length){ const dead = us.filter(u => u.state === 'dead'), last = dead.sort((a, b) => (b.deathT || 0) - (a.deathT || 0))[0]; h.out = dead.length ? {how: 'died', k, by: last.killedBy || null} : {how: 'fled', k}; continue; }
    const scarred = alive.filter(a => a.scar > a.was && a.was < PROG.SCAR_MAX).length;
    if (scarred) entry.scars.push({id: e.id, n: scarred});
    team.push(Object.assign({}, e, {hp: alive.map(a => Math.min(1, a.f + (1 - a.f) * PROG.REST)), was: alive.map(a => a.f), scar: alive.map(a => Math.min(PROG.SCAR_MAX, a.scar)), fresh: false}));
  }
  run.total += score; run.kills += down;
  run.team = team; run.log.push(entry);
  if (!res.survived){
    run.losses++;
    if (run.losses > PROG.RETRIES){ run.over = true; run.phase = 'over'; return entry; }
    // a retry: back to the shop as the round opened (money, team, wounds and XP as they were), a new fight seed
    entry.ups = []; entry.scars = []; entry.xp = {}; entry.xpWhy = {};
    const pre = JSON.parse(run.pre); run.money = pre.money; run.team = pre.team; run.board = pre.board;
    // the history follows the undo: the restored team is back (not dead, not sold), this visit's buys went back to the board
    for (const h of run.hist || []){ const e = run.team.find(x => x.uid === h.uid);
      if (e){ h.out = null; h.xp = e.xp; h.lv = e.lv; } else if (h.rounds.includes(k) && (!h.out || h.out.k === k) && h.from === k) h.out = {how: 'undone', k}; }
    run.attempt++; run.fightSeed = hash('fight:' + run.seed + ':' + k + ':' + run.attempt);
    run.phase = 'shop'; entry.retry = true;
    return entry;
  }
  run.won++; run.k++;
  if (run.k >= PROG.ROUNDS){ run.over = true; run.complete = true; run.phase = 'over'; return entry; } // the last round pays nothing: there's nothing left to buy
  entry.earned = Math.min(PROG.KILL_CAP, PROG.PER_KILL * down); run.money += entry.earned;
  entry.topup = PROG.TOPUP[run.k]; run.money += entry.topup;
  dealRound(run); run.phase = 'shop';
  return entry;
}
// runs compare by rounds won, then total time alive
const better = (a, b) => !b || a.won > b.won || (a.won === b.won && a.total > b.total + .05);

const API = {histOf, PROG, LEVEL_NAME, LEVEL_DESC, GIANTS, hash, newRun, dealRound, cfgFor, teamIds, canBuy, buy, unbuy, sell, canSell, sellPrice, tooHurtToSell, condition, missing, canHeal, heal, healCost, needsHeal,
  applyResult, better, terrainOrder, groupOf, levelOf};
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.Progressive = API;
})(typeof window !== 'undefined' ? window : globalThis);
