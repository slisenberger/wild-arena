// Migration: the roguelike mode. A run of 7 fights; your team, wounds and money carry over between them.
// Pure JS, no DOM: the game UI (ui.js) and the balance bot (migration_bot.js) share these rules.
// Engine hooks it uses (sim.js setup, all opt-in): cfg.startHp, cfg.humanHp, cfg.boons; dealBoard's rules.exclude.
(function(root){
'use strict';
const A = root.Arena || require('./sim.js');

const MIG = {
  FIGHTS: 7, START: 600,
  PER_MIN: 80, PER_KILL: 25, BONUS: 50,    // earned after a fight you survive: $80 per minute alive, $25 per enemy down, + a $50 survival bonus (rounded to $50)
  HEAL: .4, HUMAN_HEAL: .3, DRESSING: .2,  // share of missing health healed between fights (field dressing adds .2 to both)
  BOARD0: 8, BOARD_STEP: 1.5,              // the trading post grows by 1-2 animals per fight...
  TOTAL0: 1100, TOTAL_STEP: 550,           // ...and the board (everything you don't buy is against you) gets richer
  RARE0: .1, RARE_STEP: .1,                // rares get likelier later
  MEGA: 3, HERD: 6,                        // fight 4 (index 3): megafauna; fight 7: the herd (elephant, mammoth)
};
const BOON_IDS = Object.keys(A.BOONS);

function hash(s){ let h = 2166136261; for (const c of String(s)){ h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) % 1e6 + 1; }
const groupOf = id => A.BY_ID[id].group || 1;
const round50 = x => Math.max(0, Math.round(x / 50) * 50);

// the map rotates through all four terrains (a seeded order, then round again)
function terrainOrder(seed){
  const t = Object.keys(A.TERRAINS), R = A.rng(hash('terr:' + seed));
  for (let i = t.length - 1; i > 0; i--){ const j = Math.floor(R() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; }
  return t;
}
function fightKind(k){ return k === MIG.HERD ? 'herd' : k === MIG.MEGA ? 'mega' : 'plain'; }
const KIND_NAME = {plain: '', mega: 'Megafauna', herd: 'The herd'};

function newRun(seed, daily){
  const run = {v: 1, seed, daily: daily || null, k: 0, money: MIG.START, hp: 1, team: [], boons: [], boonOffer: null,
    log: [], total: 0, survived: 0, over: false, won: false, phase: 'shop'};
  dealFight(run);
  return run;
}
// deal the trading post for fight run.k: everything on it that you don't buy fights you
function dealFight(run){
  const k = run.k, kind = fightKind(k);
  run.terrain = terrainOrder(run.seed)[k % 4];
  run.boardSeed = hash('board:' + run.seed + ':' + k); run.fightSeed = hash('fight:' + run.seed + ':' + k);
  const owned = run.team.map(e => e.id);
  const rules = {terrain: run.terrain, board: Math.round(MIG.BOARD0 + MIG.BOARD_STEP * k), total: MIG.TOTAL0 + MIG.TOTAL_STEP * k, rareP: Math.min(1, MIG.RARE0 + MIG.RARE_STEP * k), exclude: owned.slice()};
  if (kind === 'mega'){ rules.rareP = 1; rules.exclude.push('giantkangaroo'); } // a rare giant or sabre-tooth, guaranteed
  let board;
  if (kind === 'herd'){
    const big = ['elephant', 'mammoth'].filter(id => !owned.includes(id));
    const cost = big.reduce((s, id) => s + A.BY_ID[id].price, 0);
    rules.board -= big.length; rules.total -= cost; rules.rareP = 0; rules.exclude.push('elephant', 'mammoth');
    const b = A.dealBoard(run.boardSeed, rules).concat(big);
    board = A.ANIMALS.map(a => a.id).filter(id => b.includes(id));
  } else board = A.dealBoard(run.boardSeed, rules);
  run.board = board; run.kind = kind;
  return board;
}
const teamIds = run => run.team.map(e => e.id);
// the engine cfg for the coming fight (deploy and fight screens add placements, mount, human spot)
function cfgFor(run){
  const ids = teamIds(run), startHp = {};
  for (const e of run.team) startHp[e.id] = e.hp.slice();
  return {board: run.board.slice(), team: ids, terrain: run.terrain, mode: 'wild', seed: run.fightSeed, mount: A.defaultMount(ids), startHp, humanHp: run.hp, boons: run.boons.slice()};
}
// trading post: buy from the board, undo a buy made this visit, sell a carried animal for half its price
const onTeam = (run, id) => run.team.some(e => e.id === id);
function canBuy(run, id){ return run.phase === 'shop' && run.board.includes(id) && !onTeam(run, id) && A.BY_ID[id].price <= run.money; }
function buy(run, id){ if (!canBuy(run, id)) return false; run.money -= A.BY_ID[id].price; run.team.push({id, hp: Array(groupOf(id)).fill(1), fresh: true}); return true; }
function unbuy(run, id){ const i = run.team.findIndex(e => e.id === id && e.fresh); if (i < 0) return false; run.money += A.BY_ID[id].price; run.team.splice(i, 1); return true; }
const sellPrice = id => Math.floor(A.BY_ID[id].price / 2);
function sell(run, id){ const i = run.team.findIndex(e => e.id === id && !e.fresh); if (i < 0 || run.phase !== 'shop') return false; run.money += sellPrice(id); run.team.splice(i, 1); return true; }
function offerBoons(run){
  const left = BOON_IDS.filter(b => !run.boons.includes(b)), R = A.rng(hash('boon:' + run.seed + ':' + run.k));
  for (let i = left.length - 1; i > 0; i--){ const j = Math.floor(R() * (i + 1)); [left[i], left[j]] = [left[j], left[i]]; }
  run.boonOffer = left.slice(0, 3);
}
function pickBoon(run, id){ if (!run.boonOffer || !run.boonOffer.includes(id)) return false; run.boons.push(id); run.boonOffer = null; return true; }

// after the fight: survivors keep their wounds (partly healed), the dead are gone, you earn money; dying ends the run
function applyResult(run, w){
  const res = w.result, score = res.score, k = run.k;
  const enemies = w.units.filter(u => u.side === 'E'), down = enemies.filter(u => u.state === 'dead').length, routed = enemies.filter(u => u.escaped).length;
  const heal = MIG.HEAL + (run.boons.includes('dressing') ? MIG.DRESSING : 0), hheal = MIG.HUMAN_HEAL + (run.boons.includes('dressing') ? MIG.DRESSING : 0);
  const entry = {k, terrain: run.terrain, kind: run.kind, t: score, survived: res.survived, why: res.why || null, killer: res.killer || null, down, routed, lost: [], earned: 0, team: teamIds(run)};
  const team = [];
  for (const e of run.team){
    const us = w.units.filter(u => u.side === 'P' && u.s.id === e.id); // a pick's units are contiguous and in team order: leader first
    const alive = us.filter(u => u.state !== 'dead' && !u.escaped).map(u => Math.max(.01, u.hp / u.maxhp));
    const lostN = us.length - alive.length;
    if (lostN) entry.lost.push({id: e.id, n: lostN, all: !alive.length});
    if (alive.length) team.push({id: e.id, hp: alive.map(f => Math.min(1, f + (1 - f) * heal)), was: alive});
  }
  run.total += score;
  if (!res.survived){
    run.over = true; run.phase = 'over'; run.hp = 0; run.team = team.map(e => ({id: e.id, hp: e.was})); run.log.push(entry); return entry;
  }
  const hf = Math.max(.01, w.human.hp / w.human.maxhp);
  entry.hpWas = hf; run.hp = Math.min(1, hf + (1 - hf) * hheal);
  entry.earned = round50(MIG.PER_MIN * score / 60 + MIG.PER_KILL * down + MIG.BONUS);
  run.money += entry.earned;
  run.team = team.map(e => ({id: e.id, hp: e.hp}));
  run.survived++; run.k++; run.log.push(entry);
  if (run.k >= MIG.FIGHTS){ run.over = true; run.won = true; run.phase = 'over'; return entry; }
  offerBoons(run); dealFight(run); run.phase = 'shop';
  return entry;
}
// runs compare by fights survived, then total time alive
const better = (a, b) => !b || a.survived > b.survived || (a.survived === b.survived && a.total > b.total + .05);

const API = {MIG, BOON_IDS, KIND_NAME, hash, newRun, dealFight, cfgFor, teamIds, canBuy, buy, unbuy, sell, sellPrice, offerBoons, pickBoon, applyResult, better, terrainOrder, fightKind, groupOf};
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.Migration = API;
})(typeof window !== 'undefined' ? window : globalThis);
