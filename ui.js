(function(){
'use strict';
const A = window.Arena;
const M = window.Migration; // the roguelike run's rules (migration.js)
const $ = id => document.getElementById(id);
// price-tier colors: $100 slate, $200 red, $300 orange, $400 gold, $500+ violet
const tierHex = p => p >= 500 ? '#b48cf2' : p >= 400 ? '#f0b429' : p >= 300 ? '#ec7a2c' : p >= 200 ? '#d8473b' : '#8297aa';
const C = {you:'#4fd1bd', foe:'#ef6b4b', bone:'#d9cfb4', fg:'#ece6d3', muted:'#949d8c', gold:'#f0b429', orange:'#ec7a2c', red:'#d8473b', slate:'#8297aa'};
const BUDGET = A.RULES.budget;
const newBoardSeed = () => (Math.random() * 1e6 | 0) + 1;
const maxStr = Math.max(...A.ANIMALS.map(a => Math.sqrt(A.hpOf(a) * a.dmg / a.cd)));
const MAXV = {mine: Math.max(1, ...Object.values(A.MEASURED).map(m => m.mine)), threat: Math.max(1, ...Object.values(A.MEASURED).map(m => -m.theirs))};

const S = window.__wa = {
  team: new Set(), boardSeed: newBoardSeed(), board: [], focus:'elephant', terrain:'savanna', mode:'wild', mount:'', pos:{}, youPos:null, seed: (Math.random()*1e6|0) + 1,
  draft:'budget', pickN:3, daily:null, dailyKind:null, shared:null, played:null, screen:'draft', world:null, playT:0, playing:true, speed:2, sel:0, lastTs:0, dur:120,
  mig:null, migKey:null // mig: the active migration run (null outside the mode)
};

// ---------- helpers ----------
const spent = () => [...S.team].reduce((s, id) => s + A.BY_ID[id].price, 0);
const fmtT = t => { t = Math.max(0, t); const m = Math.floor(t/60), s = Math.floor(t%60); return m + ':' + String(s).padStart(2,'0'); };
const kmh = v => Math.round(v * 3.6);
// draft modes: 'budget' (spend up to the budget) or 'pick' (exactly S.pickN animals, prices ignored); the engine doesn't care
const isPick = () => S.draft === 'pick';
const canAdd = a => S.mig ? M.canBuy(S.mig, a.id) : isPick() ? S.team.size < S.pickN : a.price <= BUDGET - spent();
const draftReady = () => !isPick() || S.team.size === S.pickN;
function strengthOf(a){ return Math.sqrt(A.hpOf(a) * a.dmg / a.cd); }
function tok(a, size){ const d = document.createElement('span'); d.className = 'tok'; d.style.cssText = tokStyle(a); d.title = a.name; if (size) { d.style.width = d.style.height = size + 'px'; } if (!faceOf(a)) d.textContent = a.abbr; return d; }
const faceOf = a => FACES[a.species || a.id]; // pack items share their species' portrait
function tokStyle(a){ return faceOf(a) ? `background:#222 url(${faceOf(a)}) center/cover;border:2px solid ${tierHex(a.price)}` : `background:${tierHex(a.price)};color:#14130f;font-weight:700`; }
function tokHTML(a, px){ return `<span class="tok" title="${esc(a.name)}" style="${tokStyle(a)};width:${px}px;height:${px}px;font-size:${Math.round(px*.4)}px">${faceOf(a) ? '' : a.abbr}</span>`; }
const FACEIMG = {}; for (const id in FACES){ const im = new Image(); im.src = FACES[id]; FACEIMG[id] = im; }
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function terrainFit(a, tid){
  const out = [], load = A.heatLoad(a), snow = A.snowFactor(a), charger = a.gait === 'charge';
  if (tid === 'savanna'){ if (load >= 2.5) out.push(['bad', 'Cooks in the heat']); else if (load < 1) out.push(['good', 'Built for heat']); }
  if (tid === 'river'){ if (a.water >= .8) out.push(['good', 'Rules the river']); else if (load >= 6) out.push(['bad', 'Runs hot']); if (charger && a.water < .8) out.push(['bad', 'Charge founders in water']); }
  if (tid !== 'river' && a.tags.includes('waterbound')) out.push(['bad', 'No water: slow on land']);
  if (tid === 'forest'){ if (a.tags.includes('ambush')) out.push(['good', 'Ambush ×2']); if (charger) out.push(['bad', 'Crashes into trees']); else if (a.mass > 800) out.push(['bad', 'Slowed by trees']); }
  if (tid === 'tundra'){ if (snow >= .92) out.push(['good', 'At home in snow']); else if (snow < .7) out.push(['bad', `Bogged down (${Math.round(snow*100)}% speed)`]); if (a.cold < .5) out.push(['bad', 'Stiff in the cold']); }
  return out;
}
function badgesHTML(a){ return terrainFit(a, S.terrain).map(([k, t]) => `<span class="bdg ${k}">${t}</span>`).join(''); }
// ---------- board ----------
// a pick of a pack animal brings its whole group when the rules use groups
const groupOf = a => a.group || 1;
const itemName = a => groupOf(a) > 1 ? `${a.groupName} (${groupOf(a)})` : a.name;
const boardTotal = () => S.board.reduce((t, id) => t + A.BY_ID[id].price, 0);
function dealNewBoard(seed){
  S.daily = null; S.dailyKind = null; S.shared = null; hideNotice(); // a fresh board (or a different map) is no longer today's challenge or a shared game
  S.boardSeed = seed || newBoardSeed(); S.board = A.dealBoard(S.boardSeed, {terrain: S.terrain});
  S.team.clear(); S.pos = {}; S.youPos = null; S.mount = ''; S.world = null; S.focus = S.board[0];
}
// ---------- navigation ----------
function go(screen){
  if (S.mig && (screen === 'draft' || screen === 'deploy') && (S.mig.over || S.mig.boonOffer)) screen = 'mig'; // a boon to pick (or a finished run) comes first
  if (!S.mig && screen === 'mig') screen = 'arena';
  if (S.mig && (screen === 'draft' || screen === 'deploy' || screen === 'mig')) migSync();
  S.screen = screen;
  for (const id of ['arena','draft','deploy','fight','lab','mig']) $('s-' + id).hidden = id !== screen;
  if (screen === 'mig') renderMig();
  $('newSeed').hidden = !!S.mig; // a migration's fights have fixed seeds
  renderHud(); renderBudget();
  document.querySelectorAll('#steps button[data-s]').forEach(b => b.setAttribute('aria-current', b.dataset.s === screen ? 'true' : 'false'));
  if (screen === 'deploy') { renderMounts(); sizeCanvas($('deployCanvas')); drawDeploy(); }
  if (screen === 'draft') { renderBudget(); renderDraft(); }
  if (screen === 'fight') { sizeCanvas($('fightCanvas')); }
  if (screen === 'lab') renderLabDesc();
  window.scrollTo({top:0});
}
document.querySelectorAll('#steps button[data-s]').forEach(b => b.addEventListener('click', () => {
  if ((b.dataset.s === 'deploy' || b.dataset.s === 'fight') && !draftReady()) { go('draft'); return; } // Pick N: the team must be full first
  if (b.dataset.s === 'fight' && !S.world) { startBattle(); return; }
  go(b.dataset.s);
}));

// ---------- draft ----------
function renderBudget(){
  if (S.mig){ const f = S.screen === 'fight'; $('spent').textContent = f ? '' : '$' + S.mig.money.toLocaleString(); $('meter').innerHTML = ''; $('budgetMax').textContent = f ? 'Migration' : 'to spend'; return; } // no spoilers during a fight
  if (isPick()){ // picks left instead of dollars
    const n = S.team.size, left = S.pickN - n;
    $('spent').textContent = left > 0 ? `${left} pick${left === 1 ? '' : 's'} left` : 'Team full';
    const m = $('meter'); m.innerHTML = '';
    for (let i = 0; i < S.pickN; i++){ const x = document.createElement('i'); if (i < n) x.className = 'on'; m.appendChild(x); }
    $('budgetMax').textContent = 'Pick ' + S.pickN; return;
  }
  const sp = spent();
  $('spent').textContent = '$' + sp.toLocaleString();
  const m = $('meter'); m.innerHTML = '';
  for (let i = 0; i < BUDGET / 100; i++){ const x = document.createElement('i'); if (i < sp/100) x.className = sp > BUDGET ? 'over' : 'on'; m.appendChild(x); }
  $('budgetMax').textContent = '/ $' + BUDGET.toLocaleString();
}
function renderDraft(){
  const tiers = $('tiers'); tiers.innerHTML = '';
  const left = BUDGET - spent();
  const onBoard = S.board.map(id => A.BY_ID[id]);
  const daily = S.daily ? `${S.dailyKind === 'pick3' ? 'Daily Pick-3' : 'Daily challenge'} ${S.daily} (${A.TERRAINS[S.terrain].name}): the same board, map and fight seed for everyone today. ` : '';
  const R = S.mig;
  $('draftTitle').textContent = R ? `Trading post · fight ${R.k + 1} of ${M.MIG.FIGHTS}` : 'Build a team to protect you from the rest';
  for (const id of ['clearTeam', 'newBoard', 'copyDraft', 'copyDraftOut']) $(id).hidden = !!R;
  $('boardLede').textContent = R ? `${R.kind !== 'plain' ? M.KIND_NAME[R.kind] + '! ' : ''}Next stop: the ${A.TERRAINS[R.terrain].name.toLowerCase()}. ${onBoard.length} animals on the board, worth $${boardTotal().toLocaleString()}. Buy what your $${R.money.toLocaleString()} covers; whatever you don't buy is against you. Your team carries its wounds; sell an animal for half its price.`
    : daily + (isPick()
    ? `This game's board: ${onBoard.length} animals. Pick exactly ${S.pickN}, whatever they cost; every board animal you don't pick ends up on the other side. Tap a card to draft it; the panel below shows the full stat line.`
    : `This game's board: ${onBoard.length} animals worth $${boardTotal().toLocaleString()}. Spend up to $${BUDGET.toLocaleString()}; every board animal you don't pick ends up on the other side. Tap a card to draft it; the panel below shows the full stat line.`);
  // budget mode groups the cards by price; Pick N ignores prices, so it's one grid (pricier first)
  const groups = isPick() ? [[null, onBoard.slice().sort((x, y) => y.price - x.price)]]
    : [...new Set(onBoard.map(a => a.price))].sort((x, y) => y - x).map(p => [p, onBoard.filter(x => x.price === p)]);
  for (const [p, items] of groups){
    const row = document.createElement('div'); row.className = 'tier' + (p == null ? ' flat' : '');
    if (p != null){ const tag = document.createElement('div'); tag.className = 'tierTag'; tag.style.background = tierHex(p); tag.textContent = '$' + p; row.appendChild(tag); }
    const cards = document.createElement('div'); cards.className = 'cards';
    for (const a of items){
      const picked = S.team.has(a.id);
      const c = document.createElement('button'); c.className = 'card' + (picked ? ' picked' : '') + (!picked && !canAdd(a) ? ' cant' : '');
      c.setAttribute('aria-pressed', picked);
      const r1 = document.createElement('div'); r1.className = 'row1'; r1.appendChild(tok(a, 46));
      const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = itemName(a); r1.appendChild(nm);
      c.appendChild(r1);
      const st = document.createElement('div'); st.className = 'styleTag'; st.textContent = a.style; c.appendChild(st);
      const fit = (a.rare ? '<span class="bdg good">Rare</span>' : '') + (groupOf(a) > 1 ? `<span class="bdg good">×${groupOf(a)}, hunt together</span>` : '') + badgesHTML(a); if (fit){ const bd = document.createElement('div'); bd.className = 'badges'; bd.innerHTML = fit; c.appendChild(bd); }
      const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = `${a.mass.toLocaleString()} kg · ${kmh(a.spd)} km/h`; c.appendChild(meta);
      const bars = document.createElement('div'); bars.className = 'bars';
      const rows = [['Power', strengthOf(a)/maxStr], ['Armor', a.armor/.6], ['Speed', a.spd/20], ['Stamina', Math.min(1, a.stam/60)]];
      // measured: how much it helps on your side, and how dangerous it is if you leave it to the other side
      const mv = A.MEASURED[a.id]; if (mv){ rows.push(['Helps', Math.max(0, mv.mine) / MAXV.mine, C.you], ['Threat', Math.max(0, -mv.theirs) / MAXV.threat, C.foe]); } // full wording in the detail panel
      for (const [k,v,col] of rows){ const l = document.createElement('span'); l.textContent = k; const b = document.createElement('div'); b.className = 'bar'; const f = document.createElement('b'); f.style.width = Math.round(Math.min(1,v)*100) + '%'; if (col) f.style.background = col; b.appendChild(f); bars.append(l, b); }
      c.appendChild(bars);
      const ck = document.createElement('span'); ck.className = 'check'; ck.textContent = '✓'; c.appendChild(ck);
      c.addEventListener('click', () => {
        S.focus = a.id;
        if (S.mig){ if (picked) M.unbuy(S.mig, a.id); else M.buy(S.mig, a.id); saveRun(); migSync(); S.world = null; renderAll(); renderHud(); return; }
        if (S.team.has(a.id)) S.team.delete(a.id);
        else if (canAdd(a)) S.team.add(a.id);
        S.world = null;
        if (S.mount && !S.team.has(S.mount)) S.mount = bestMount();
        if (!S.mount) S.mount = bestMount();
        renderAll();
      });
      cards.appendChild(c);
    }
    row.appendChild(cards); tiers.appendChild(row);
  }
  // team line
  const tl = $('teamline'); tl.innerHTML = '';
  if (R){
    const foes = S.board.filter(id => !S.team.has(id));
    tl.innerHTML = migTeamHTML(R, true) + `<span class="label" style="margin-left:6px">Against you: ${foes.length} animals, $${foes.reduce((t, id) => t + A.BY_ID[id].price, 0).toLocaleString()}</span>`;
    const btn = $('toDeployD'); btn.disabled = false; btn.textContent = 'Set formation';
    renderDetail(); return;
  }
  if (!S.team.size){ const s = document.createElement('span'); s.className = 'label'; s.textContent = 'No animals drafted yet. You can fight alone, but you will not like it.'; tl.appendChild(s); }
  for (const id of S.team){ const a = A.BY_ID[id]; const ch = document.createElement('span'); ch.className = 'chip'; ch.appendChild(tok(a)); ch.append(itemName(a) + (isPick() ? '' : ' $' + a.price)); tl.appendChild(ch); }
  const foes = S.board.filter(id => !S.team.has(id));
  const fl = document.createElement('span'); fl.className = 'label'; fl.style.marginLeft = '6px';
  fl.textContent = `Against you: ${foes.length} animals` + (isPick() ? '' : `, $${foes.reduce((t, id) => t + A.BY_ID[id].price, 0).toLocaleString()}`); tl.appendChild(fl);
  const need = S.pickN - S.team.size, btn = $('toDeployD');
  btn.disabled = !draftReady(); btn.textContent = draftReady() ? 'Set formation' : need > 0 ? `Pick ${need} more` : `Drop ${-need}`;
  renderDetail();
}
function renderDetail(){
  const a = A.BY_ID[S.focus]; const d = $('detail');
  const hp = A.hpOf(a);
  const stats = [
    ...(isPick() ? [] : [['Price', '$' + a.price + (S.mig && M.teamIds(S.mig).includes(a.id) && !S.board.includes(a.id) ? ' (sells for $' + M.sellPrice(a.id) + ')' : '')]]), ...(A.MEASURED[a.id] ? [['Helps you', '+' + Math.max(0, Math.round(A.MEASURED[a.id].mine)) + ' s'], ['Threat if left', Math.max(0, Math.round(-A.MEASURED[a.id].theirs)) + ' s']] : []), ['Mass', a.mass.toLocaleString() + ' kg'], ['Top speed', kmh(a.spd) + ' km/h'],
    ['Durability', hp.toLocaleString() + ' hp'], ['Strike', a.dmg + ' / ' + a.cd + ' s'], ['Armor', Math.round(a.armor*100) + '%'],
    ['Reach', a.reach + ' m'], ['Sprint', a.stam + ' s'], ['Breaks at', Math.round(a.flee*100) + '% morale'],
    ['Heat tolerance', a.heat.toFixed(2)], ['Cold tolerance', a.cold.toFixed(2)], ['Strikes up to', a.strikeH + ' m'], ['Carries you at', a.mountH ? a.mountH + ' m' : 'too small'],
  ];
  d.innerHTML = `<div><div style="display:flex;gap:10px;align-items:center;margin-bottom:10px">${tokHTML(a, 64)}<h3 style="font-size:22px">${esc(itemName(a))}</h3></div>${groupOf(a) > 1 ? `<p class="notes" style="margin:-4px 0 8px">One pick brings ${groupOf(a)} of them; they keep each other's nerve and go for the same target. Left on the board, all ${groupOf(a)} come at you.</p>` : ''}
    <div class="stats">${stats.map(([k,v]) => `<div class="stat"><div class="v">${esc(v)}</div><div class="k">${k}</div></div>`).join('')}</div></div>
    <div><div class="styleTag" style="font-size:15px">${esc(a.style)}</div><p style="margin:4px 0 10px">${esc(a.how)}</p>${badgesHTML(a) ? `<div class="badges" style="margin-bottom:10px">${badgesHTML(a)} <span class="notes" style="font-size:12px">in the ${esc(A.TERRAINS[S.terrain].name.toLowerCase())}</span></div>` : ''}<div class="label" style="margin-bottom:6px">Traits</div><ul class="traits">${a.traits.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    <p class="notes" style="margin-top:10px">${a.pred ? 'Predator: hunts by weighing meat against risk, and gets hungrier as the fight goes on.' : 'Herbivore: fights intruders, predators and anything that wounds it.'}</p></div>`;
}
$('toDeployD').addEventListener('click', () => { if (draftReady()) go('deploy'); });
$('clearTeam').addEventListener('click', () => { S.team.clear(); S.world = null; S.pos = {}; renderAll(); });
$('newBoard').addEventListener('click', () => { dealNewBoard(); renderAll(); });
// image credits panel (rows built from CREDITS.md at build time)
$('creditsBtn').addEventListener('click', () => {
  $('creditsTbl').tBodies[0].innerHTML = CREDITS.map(c => `<tr><td>${esc(c.animal)}</td><td><a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.file)}</a></td><td>${esc(c.author)}</td><td>${esc(c.license)}</td></tr>`).join('');
  $('creditsDlg').showModal();
});
$('creditsClose').addEventListener('click', () => $('creditsDlg').close());
// start over: fresh board and fight seed, empty team, default formation, back to the map screen
$('copyDraft').addEventListener('click', () => copyLink(gameLink(currentGame()), $('copyDraftOut')));
$('startOver').addEventListener('click', () => { exitMig(); S.seed = newBoardSeed(); $('seedLbl').textContent = S.seed; dealNewBoard(); S.playing = false; renderAll(); go('arena'); });

// ---------- arena setup ----------
const TCOL = {savanna:'radial-gradient(circle at 70% 35%,#3d4a1f 0 14%,transparent 15%),linear-gradient(135deg,#5a4a1d,#2c2614)', river:'linear-gradient(90deg,#26341f 0 44%,#1f5165 44% 56%,#26341f 56%)', forest:'radial-gradient(circle at 30% 40%,#244a2c 0 18%,transparent 19%),radial-gradient(circle at 70% 60%,#244a2c 0 22%,transparent 23%),#17241a', tundra:'linear-gradient(135deg,#55606a,#2f363d)'};
function renderArenaOpts(){
  const to = $('terrainOpts'); to.innerHTML = '';
  for (const T of Object.values(A.TERRAINS)){
    const b = document.createElement('button'); b.className = 'opt'; b.setAttribute('aria-pressed', S.terrain === T.id);
    b.innerHTML = `<div class="sw" style="background:${TCOL[T.id]}"></div><h3>${T.name}</h3><p>${esc(T.desc)}</p>`;
    b.addEventListener('click', () => { if (S.terrain !== T.id){ S.terrain = T.id; dealNewBoard(S.boardSeed); } S.world = null; S.pos = {}; S.youPos = null; renderArenaOpts(); renderDraft(); renderBudget(); }); // water-only animals depend on the map
    to.appendChild(b);
  }
  const mo = $('modeOpts'); mo.innerHTML = '';
  const modes = [
    ['wild','Wild', 'The other side is one team and the pressure builds over time. Predators hunt you and your guards; herbivores charge intruders. Their only infighting is a rare flare-up between natural rivals (lion and hyena, buffalo and lion). Break their morale and animals bolt out of the arena. You score by how long you stay alive, up to five minutes.'],
  ];
  for (const [id, nm, desc] of modes){
    const b = document.createElement('button'); b.className = 'opt'; b.setAttribute('aria-pressed', S.mode === id);
    b.innerHTML = `<h3>${nm}</h3><p>${desc}</p>`;
    b.addEventListener('click', () => { S.mode = id; S.world = null; renderArenaOpts(); });
    mo.appendChild(b);
  }
  const dopt = $('draftOpts'); dopt.innerHTML = '';
  for (const [id, nm, desc] of [['budget', 'Budget', `Spend up to $${BUDGET.toLocaleString()} on the board. Big animals cost big money.`], ['pick', 'Pick N', 'Pick exactly N animals from the board, whatever they cost. A different puzzle: which few do you want on your side?']]){
    const b = document.createElement('button'); b.className = 'opt'; b.setAttribute('aria-pressed', S.draft === id); b.dataset.draft = id;
    b.innerHTML = `<h3>${nm}</h3><p>${esc(desc)}</p>`;
    b.addEventListener('click', () => setDraft(id, S.pickN));
    dopt.appendChild(b);
  }
  $('pickRow').hidden = !isPick();
  document.querySelectorAll('#pickSeg button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.n === S.pickN));
  renderStreak(); renderMigEntry();
}
// switch draft mode (or N): a team that no longer fits is trimmed, and it's no longer today's daily
function setDraft(mode, n){
  if (S.draft === mode && S.pickN === n) return;
  S.draft = mode; S.pickN = n; S.daily = null; S.dailyKind = null; S.world = null;
  const team = [...S.team]; S.team.clear();
  for (const id of team) if (canAdd(A.BY_ID[id])) S.team.add(id);
  if (S.mount && !S.team.has(S.mount)) S.mount = bestMount();
  renderAll();
}
document.querySelectorAll('#pickSeg button').forEach(b => b.addEventListener('click', () => setDraft('pick', +b.dataset.n)));
$('toDraft').addEventListener('click', () => { exitMig(); go('draft'); });
// daily challenge: today's date (UTC) picks the map, the board and the fight seed, so everyone plays the same game
const todayUTC = () => new Date().toISOString().slice(0, 10);
function dateSeed(s){ let h = 2166136261; for (const c of s){ h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) % 1e6 + 1; }
// kind 'budget' (the original daily, unchanged) or 'pick3' (Daily Pick-3: its own map, board and seed)
const dailySeed = (kind, d) => dateSeed(kind === 'pick3' ? 'wild-arena:pick3:' + d : 'wild-arena:' + d);
const dailyKey = (kind, d) => (kind === 'pick3' ? 'wa-daily-pick3:' : 'wa-daily:') + d;
function startDaily(kind){
  exitMig();
  const d = todayUTC(), h = dailySeed(kind, d), terr = Object.keys(A.TERRAINS);
  S.draft = kind === 'pick3' ? 'pick' : 'budget'; if (kind === 'pick3') S.pickN = 3;
  S.terrain = terr[h % terr.length]; S.seed = h; $('seedLbl').textContent = S.seed;
  dealNewBoard(h); S.daily = d; S.dailyKind = kind; renderAll(); go('draft');
}
$('daily').addEventListener('click', () => startDaily('budget'));
$('dailyPick').addEventListener('click', () => startDaily('pick3'));
// daily streak: consecutive UTC days with at least one daily run (either kind)
function prevDay(d){ const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - 1); return t.toISOString().slice(0, 10); }
function readStreak(){ try { const s = JSON.parse(localStorage.getItem('wa-streak') || 'null'); if (s && typeof s.last === 'string' && s.n >= 1) return s; } catch(e){} return null; }
function bumpStreak(day){
  const s = readStreak(); if (s && s.last === day) return;
  const n = s && s.last === prevDay(day) ? s.n + 1 : 1;
  try { localStorage.setItem('wa-streak', JSON.stringify({last: day, n})); } catch(e){}
  renderStreak();
}
function renderStreak(){
  const s = readStreak(), d = todayUTC(), live = s && (s.last === d || s.last === prevDay(d)), el = $('streak');
  el.hidden = !live; el.textContent = live ? `Streak: ${s.n} day${s.n === 1 ? '' : 's'}${s.last === d ? '' : ' (play today to keep it)'}` : '';
}

// ---------- notices and shareable game links ----------
function showNotice(html, warn){ $('noticeText').innerHTML = html; $('notice').className = 'notice' + (warn ? ' warn' : ''); $('notice').hidden = false; }
function hideNotice(){ $('notice').hidden = true; }
$('noticeClose').addEventListener('click', hideNotice);
// #g=1,m:<map>,b:<board seed>,s:<fight seed>,d:<b|p2..p5>[,t:<id+id>,r:<mount|->,p:you=x_y;id=x_y][,sc:<score s>]
// Version first; fields are key:value, so old links with fields missing (or newer links with unknown keys) still load.
const LINK_V = 1;
function currentGame(){ return {terrain:S.terrain, boardSeed:S.boardSeed, seed:S.seed, draft:S.draft, pickN:S.pickN, team:[...S.team], mount:(S.mount && S.team.has(S.mount)) ? S.mount : '', pos:S.pos, you:S.youPos}; }
function gameLink(o, score){
  const f = [LINK_V, 'm:' + o.terrain, 'b:' + o.boardSeed, 's:' + o.seed, 'd:' + (o.draft === 'pick' ? 'p' + o.pickN : 'b')];
  if (o.team.length){
    f.push('t:' + o.team.join('+'), 'r:' + (o.mount || '-'));
    const ps = o.team.filter(id => o.pos && o.pos[id]).map(id => id + '=' + o.pos[id].x + '_' + o.pos[id].y); // String(number) round-trips exactly
    if (o.you) ps.unshift('you=' + o.you.x + '_' + o.you.y);
    if (ps.length) f.push('p:' + ps.join(';'));
  }
  if (score != null) f.push('sc:' + score.toFixed(1));
  return location.href.split('#')[0] + '#g=' + f.join(',');
}
// returns null (no hash), {bad:true} (unreadable) or the game; lenient about anything missing
function parseLink(hash){
  if (!hash || hash === '#') return null;
  const m = /^#g=([\s\S]*)$/.exec(hash); if (!m) return {bad:true};
  let raw; try { raw = decodeURIComponent(m[1]); } catch(e){ return {bad:true}; }
  const parts = raw.split(','), v = parseInt(parts[0], 10); if (!(v >= 1)) return {bad:true};
  const kv = {}; for (const p of parts.slice(1)){ const i = p.indexOf(':'); if (i > 0) kv[p.slice(0, i)] = p.slice(i + 1); }
  const seedOf = x => { const n = Number(x); return Number.isInteger(n) && n >= 1 && n < 2 ** 32 ? n : null; };
  const num = x => { const n = Number(x); return x !== '' && isFinite(n) ? n : null; };
  if ('m' in kv && !Object.prototype.hasOwnProperty.call(A.TERRAINS, kv.m)) return {bad:true, why:'map'};
  if (('b' in kv && !seedOf(kv.b)) || ('s' in kv && !seedOf(kv.s))) return {bad:true};
  const d = /^p([2-5])$/.exec(kv.d || ''), g = {v, terrain: kv.m || 'savanna', boardSeed: seedOf(kv.b), seed: seedOf(kv.s), draft: d ? 'pick' : 'budget', pickN: d ? +d[1] : 3};
  const known = id => Object.prototype.hasOwnProperty.call(A.BY_ID, id);
  g.team = [...new Set((kv.t || '').split('+'))].filter(known);
  g.mount = 'r' in kv ? (known(kv.r) ? kv.r : '') : null; // null: not in the link, ride the default
  g.pos = {}; g.you = null;
  for (const e of (kv.p || '').split(';')){
    const q = /^([a-z0-9]+)=([^_]+)_(.+)$/.exec(e); if (!q) continue;
    const x = num(q[2]), y = num(q[3]); if (x == null || y == null) continue;
    if (q[1] === 'you') g.you = {x, y}; else if (known(q[1])) g.pos[q[1]] = {x, y};
  }
  const sc = num(kv.sc); g.score = sc != null && sc >= 0 && sc <= A.MATCH_T ? sc : null;
  return g;
}
function applyLink(g){
  S.terrain = g.terrain; S.draft = g.draft; S.pickN = g.pickN;
  S.seed = g.seed || newBoardSeed(); $('seedLbl').textContent = S.seed;
  dealNewBoard(g.boardSeed || undefined);
  for (const id of g.team) if (S.board.includes(id) && canAdd(A.BY_ID[id])) S.team.add(id); // drop anything not on this board or over the limit
  const team = [...S.team];
  S.mount = g.mount === null ? bestMount() : (g.mount && S.team.has(g.mount) && A.BY_ID[g.mount].mountH ? g.mount : '');
  for (const id of team) if (g.pos[id]) S.pos[id] = A.clampPlace(S.terrain, A.BY_ID[id], g.pos[id].x, g.pos[id].y, curVar());
  if (g.you) S.youPos = A.clampPlace(S.terrain, A.HUMAN, g.you.x, g.you.y, curVar());
  S.shared = g.score;
  const what = `Same map, board${g.seed ? ' and fight seed' : ''}${team.length ? ', with their team loaded' : ''}${isPick() ? ` (Pick-${S.pickN})` : ''}.`;
  showNotice(g.score == null ? `<b>Shared game</b> <span>${what}</span>` : g.score >= A.MATCH_T - .05 ? `<b>Shared game: they survived the full ${fmtT(A.MATCH_T)}. Can you?</b> <span>${what}</span>` : `<b>Shared game: can you beat ${fmtT(g.score)}?</b> <span>${what}</span>`);
}
// load a game link from the URL (on start, or pasted into this tab); anything unreadable gets a fresh board and a short note
function loadHash(){
  const g = parseLink(location.hash);
  if (!g) return false;
  exitMig();
  try { history.replaceState(null, '', location.href.split('#')[0]); } catch(e){}
  if (g.bad){ dealNewBoard(); renderAll(); go('arena'); showNotice(g.why === 'map' ? "That game link names a map this version doesn't have, so here's a fresh board." : "That game link couldn't be read, so here's a fresh board.", true); return true; }
  applyLink(g); renderAll(); go('draft'); return true;
}
window.addEventListener('hashchange', loadHash);
// copy: the Clipboard API where allowed; otherwise (or if it fails) the link selected in a field, to copy by hand
function copyLink(url, out, what){
  what = what || 'Link';
  out.dataset.link = url; out.innerHTML = '';
  const say = t => { const s = document.createElement('span'); s.className = 'label'; s.textContent = t; out.appendChild(s); };
  const fallback = () => {
    out.innerHTML = ''; const i = document.createElement('input'); i.readOnly = true; i.value = url; i.setAttribute('aria-label', what === 'Link' ? 'Game link' : what); out.appendChild(i);
    i.focus(); i.select(); let ok = false; try { ok = document.execCommand('copy'); } catch(e){}
    say(ok ? 'Copied' : what === 'Link' ? 'Copy this link' : 'Copy this');
  };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(() => say(what + ' copied'), fallback); else fallback();
}

// ---------- mount picker ----------
function bestMount(team){ return A.defaultMount(team || [...S.team]) || ''; } // ride a giant if you have one; otherwise on foot
function reachersOf(h, team){ return S.board.map(id => A.BY_ID[id]).filter(a => !team.includes(a.id) && a.strikeH >= h).map(a => a.name); }
function renderMounts(){
  const box = $('mountOpts'); box.innerHTML = '';
  const team = [...S.team];
  if (S.mount && !S.team.has(S.mount)) S.mount = '';
  const foot = document.createElement('button'); foot.className = 'foot'; foot.textContent = 'On foot'; foot.setAttribute('aria-pressed', !S.mount);
  foot.addEventListener('click', () => { S.mount = ''; S.world = null; renderMounts(); drawDeploy(); }); box.appendChild(foot);
  for (const id of team){
    const a = A.BY_ID[id]; if (!a.mountH) continue;
    const b = document.createElement('button'); b.setAttribute('aria-pressed', S.mount === id);
    b.appendChild(tok(a, 30)); b.append(`${a.name} · ${a.mountH} m`);
    b.addEventListener('click', () => { S.mount = id; S.world = null; renderMounts(); drawDeploy(); });
    box.appendChild(b);
  }
  const small = team.filter(id => !A.BY_ID[id].mountH).map(id => A.BY_ID[id].name);
  let note;
  if (!S.mount) note = 'On foot you run at 6.5 m/s and anything can reach you. In the forest you can climb a tree.';
  else {
    const a = A.BY_ID[S.mount], r = reachersOf(a.mountH, team);
    note = `You sit ${a.mountH} m up. ${r.length ? 'Still able to reach you there: ' + r.join(', ') + '.' : 'Nothing on the other side can reach you there.'} ` +
      (a.mass < 700 || a.gait === 'keepaway' ? `A ${a.mass < 700 ? 'small' : 'skittish'} mount doesn't fight while carrying you: it runs from threats at ${Math.round(a.spd * Math.max(.6, 1 - .6 * 75 / a.mass) * 3.6)} km/h and only bites back if grabbed.` : 'A heavy mount holds its ground near you and fights anything within 9 m.') +
      ` Hard rams by anything heavy relative to your mount can throw you off; you climb back on when it's close.`;
  }
  if (small.length) note += ` Too small to ride: ${small.join(', ')}.`;
  $('mountNote').textContent = note;
}

// ---------- canvas & terrain painting ----------
const groundCache = {};
function sizeCanvas(cv){
  const w = cv.parentElement.clientWidth || 600;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(w * dpr); cv.height = Math.round(w * A.H / A.W * dpr);
  cv.style.height = Math.round(w * A.H / A.W) + 'px';
  cv._dpr = dpr; cv._scale = cv.width / A.W;
}
function groundFor(terrain, trees, w, h, shade, variant){
  shade = shade || [];
  const V = variant || A.baseVariant(terrain);
  const key = terrain + w + 'x' + h + ':' + V.key + ':' + trees.map(t => t.x.toFixed(1)).join(',') + ':' + shade.map(t => t.x.toFixed(1)).join(',');
  if (groundCache[key]) return groundCache[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  const sc = w / A.W;
  const base = {savanna:'#2f2915', river:'#25321f', forest:'#18251b', tundra:'#3a434b'}[terrain];
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  const R = A.rng(7);
  const speck = {savanna:['#3b331a','#4a3f1f','#262111'], river:['#2c3b24','#1f2a19','#33452a'], forest:['#1d2d20','#131e16','#22362a'], tundra:['#46505a','#323a42','#525d68']}[terrain];
  for (let i = 0; i < 2600; i++){ g.fillStyle = speck[i % 3]; const x = R()*w, y = R()*h, s = (R()*2 + .6) * sc * .25; g.fillRect(x, y, s, s); }
  if (terrain === 'savanna'){ g.strokeStyle = 'rgba(120,100,50,.25)'; g.lineWidth = sc*.12; for (let i = 0; i < 140; i++){ const x = R()*w, y = R()*h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R()-.5)*sc*.8, y - sc*(.6+R()*.6)); g.stroke(); } }
  if (terrain === 'tundra'){ g.fillStyle = 'rgba(230,238,245,.05)'; for (let i = 0; i < 40; i++){ g.beginPath(); g.ellipse(R()*w, R()*h, sc*(4+R()*8), sc*(1.5+R()*3), R()*3, 0, 7); g.fill(); } }
  // a forest clearing: lighter, grassy ground
  if (V.clearing){ const c = V.clearing, grd = g.createRadialGradient(c.x*sc, c.y*sc, 0, c.x*sc, c.y*sc, c.r*sc); grd.addColorStop(0, 'rgba(92,110,58,.45)'); grd.addColorStop(.75, 'rgba(80,98,52,.3)'); grd.addColorStop(1, 'rgba(80,98,52,0)'); g.fillStyle = grd; g.beginPath(); g.arc(c.x*sc, c.y*sc, c.r*sc, 0, 7); g.fill(); }
  // ponds: waterhole (muddy rim), forest pool, half-frozen lake (ice rim)
  for (const p of V.ponds){
    const X = p.x*sc, Y = p.y*sc, RX = p.rx*sc, RY = p.ry*sc;
    if (p.cold){ g.fillStyle = 'rgba(214,232,242,.55)'; g.beginPath(); g.ellipse(X, Y, RX + sc*2.2, RY + sc*1.8, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(236,244,250,.5)'; g.beginPath(); g.ellipse(X, Y, RX + sc*1, RY + sc*.8, 0, 0, 7); g.fill(); }
    else { g.fillStyle = p.kind === 'waterhole' ? '#5c5034' : '#3a3a26'; g.beginPath(); g.ellipse(X, Y, RX + sc*1, RY + sc*.9, 0, 0, 7); g.fill(); }
    const grd = g.createRadialGradient(X, Y, 0, X, Y, Math.max(RX, RY));
    if (p.cold){ grd.addColorStop(0, '#163a4f'); grd.addColorStop(1, '#2a6a82'); } else { grd.addColorStop(0, '#173f52'); grd.addColorStop(1, '#22596e'); }
    g.fillStyle = grd; g.beginPath(); g.ellipse(X, Y, RX, RY, 0, 0, 7); g.fill();
    g.strokeStyle = p.cold ? 'rgba(230,242,250,.3)' : 'rgba(160,210,225,.18)'; g.lineWidth = sc*.15;
    for (let i = 0; i < 6; i++){ const a = R()*7, k = R()*.6, x = X + Math.cos(a)*RX*k - sc, y = Y + Math.sin(a)*RY*k; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + sc, y - sc*.4, x + sc*2, y); g.stroke(); }
    if (p.cold){ g.fillStyle = 'rgba(240,248,252,.7)'; for (let i = 0; i < 5; i++){ const a = R()*7; g.beginPath(); g.ellipse(X + Math.cos(a)*RX*.85, Y + Math.sin(a)*RY*.85, sc*(.8+R()*1.2), sc*(.4+R()*.6), a, 0, 7); g.fill(); } }
    g.fillStyle = 'rgba(236,230,211,.6)'; g.font = `700 ${Math.max(8, sc*1.1)}px "Big Shoulders Display", sans-serif`; g.textAlign = 'center';
    g.fillText({waterhole:'WATERHOLE', pool:'POOL', lake:'ICY WATER'}[p.kind] || 'WATER', X, Y + RY + (p.cold ? sc*3.4 : sc*2.4)); g.textAlign = 'left';
  }
  const T = A.TERRAINS[terrain], B = V.band;
  if (B){
    const x0 = B.x0 * sc, x1 = B.x1 * sc;
    g.fillStyle = '#5c5034'; g.fillRect(x0 - sc*.8, 0, sc*.9, h); g.fillRect(x1 - sc*.1, 0, sc*.9, h);
    const grd = g.createLinearGradient(x0, 0, x1, 0); grd.addColorStop(0, '#22596e'); grd.addColorStop(.5, '#173f52'); grd.addColorStop(1, '#22596e');
    g.fillStyle = grd; g.fillRect(x0, 0, x1 - x0, h);
    for (const [a, b] of B.fords){
      g.fillStyle = '#6f6a4a'; g.fillRect(x0, a*sc, x1 - x0, (b - a)*sc);
      g.fillStyle = 'rgba(90,150,170,.35)'; g.fillRect(x0, a*sc, x1 - x0, (b - a)*sc);
      g.fillStyle = 'rgba(236,230,211,.75)'; g.font = `800 ${Math.max(9, sc*1.4)}px "Big Shoulders Display", sans-serif`; g.textAlign = 'center'; g.fillText('FORD', (x0 + x1) / 2, (a + b) / 2 * sc + sc*.5); g.textAlign = 'left';
    }
    g.strokeStyle = 'rgba(160,210,225,.18)'; g.lineWidth = sc*.15;
    for (let i = 0; i < 40; i++){ const x = x0 + R()*(x1 - x0 - sc*3), y = R()*h; if (B.fords.some(([a, b]) => y >= a*sc && y <= b*sc)) continue; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + sc*1.5, y - sc*.5, x + sc*3, y); g.stroke(); }
  }
  if (T.snow){ g.fillStyle = 'rgba(240,245,250,' + (V.snow > 1 ? .14 : V.snow < 1 ? .05 : .09) + ')'; for (let i = 0; i < 70; i++){ const x = R()*w, y = R()*h, rx = sc*(3+R()*9), ry = sc*(1+R()*2.5), a = R()*.6 - .3; if (V.ponds.some(p => Math.hypot((x/sc - p.x) / (p.rx + 6), (y/sc - p.y) / (p.ry + 4)) < 1)) continue; g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, 7); g.fill(); } }
  for (const t of shade){
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.arc(t.x*sc, t.y*sc, t.r*sc, 0, 7); g.fill();
    g.strokeStyle = 'rgba(120,150,70,.55)'; g.lineWidth = Math.max(1, sc*.25); g.setLineDash([sc*.5, sc*.4]); g.beginPath(); g.arc(t.x*sc, t.y*sc, t.r*sc, 0, 7); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#3d4a1f'; g.beginPath(); g.ellipse(t.x*sc, t.y*sc, t.r*.55*sc, t.r*.38*sc, 0, 0, 7); g.fill();
    g.fillStyle = '#4c5c26'; g.beginPath(); g.ellipse((t.x-.3)*sc, (t.y-.3)*sc, t.r*.4*sc, t.r*.26*sc, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(236,230,211,.5)'; g.font = `700 ${Math.max(8, sc*1.1)}px "Big Shoulders Display", sans-serif`; g.textAlign = 'center'; g.fillText('SHADE', t.x*sc, (t.y + t.r + 1.2)*sc); g.textAlign = 'left';
  }
  // 10 m grid
  g.strokeStyle = 'rgba(236,230,211,.05)'; g.lineWidth = 1;
  for (let x = 10; x < A.W; x += 10){ g.beginPath(); g.moveTo(x*sc, 0); g.lineTo(x*sc, h); g.stroke(); }
  for (let y = 10; y < A.H; y += 10){ g.beginPath(); g.moveTo(0, y*sc); g.lineTo(w, y*sc); g.stroke(); }
  // trees
  for (const t of trees){
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc((t.x+.5)*sc, (t.y+.6)*sc, (t.r+1.6)*sc, 0, 7); g.fill();
    g.fillStyle = '#123d1f'; g.beginPath(); g.arc(t.x*sc, t.y*sc, (t.r+1.4)*sc, 0, 7); g.fill();
    g.fillStyle = '#1b5a2c'; g.beginPath(); g.arc((t.x-.4)*sc, (t.y-.4)*sc, (t.r+.6)*sc, 0, 7); g.fill();
    g.fillStyle = '#4a3420'; g.beginPath(); g.arc(t.x*sc, t.y*sc, t.r*.45*sc, 0, 7); g.fill();
  }
  // scale bar
  g.fillStyle = 'rgba(236,230,211,.7)'; g.fillRect(sc*2, h - sc*2.2, sc*10, Math.max(2, sc*.25));
  g.font = `600 ${Math.max(10, sc*1.6)}px JetBrains Mono, monospace`; g.fillText('10 m', sc*2, h - sc*3);
  groundCache[key] = c;
  return c;
}

// ---------- deploy ----------
let deployWorld = null;
// Positions are stored absolute on the map; the sim takes offsets from you.
function youAt(){ return S.youPos || A.homeFor(S.terrain); }
// this game's map variant (waterhole, fords, tree density...): it follows the terrain and the seed
let varMemo = null;
function curVar(){ if (!varMemo || varMemo.tid !== S.terrain || varMemo.seed !== S.seed) varMemo = {tid: S.terrain, seed: S.seed, v: A.mapVariant(S.terrain, S.seed)}; return varMemo.v; }
function absPlacements(){
  const out = {}, team = [...S.team], h = A.homeFor(S.terrain);
  team.forEach((id, i) => {
    if (S.pos[id]) { out[id] = S.pos[id]; return; }
    const dp = A.defaultPost(S.terrain, id, curVar()); if (dp){ out[id] = dp; return; }
    const p = A.defaultPlacement(team, id, i), y = youAt(); out[id] = {x: y.x + p.dx, y: y.y + p.dy};
  });
  return out;
}
function currentPlacements(){ const y = youAt(), abs = absPlacements(), out = {}; for (const id in abs) out[id] = {dx: abs[id].x - y.x, dy: abs[id].y - y.y}; return out; }
function makeCfg(){
  const c = { board:S.board.slice(), team:[...S.team], placements:currentPlacements(), human:youAt(), terrain:S.terrain, mode:S.mode, mount:(S.mount && S.team.has(S.mount)) ? S.mount : null, seed:S.seed };
  if (S.mig){ const m = M.cfgFor(S.mig); c.startHp = m.startHp; c.humanHp = m.humanHp; c.boons = m.boons; } // carried wounds and boons (migration only)
  return c;
}
function drawDeploy(){
  deployWorld = A.setup(makeCfg());
  const cv = $('deployCanvas'); const g = cv.getContext('2d'); const sc = cv._scale;
  g.drawImage(groundFor(S.terrain, deployWorld.trees, cv.width, cv.height, deployWorld.shade, deployWorld.variant), 0, 0);
  const H = deployWorld.human, z = A.zoneFor(S.terrain, curVar());
  const mn = $('mapNote'), note = curVar().note; mn.hidden = !note; mn.textContent = note || '';
  // your side of the map
  g.fillStyle = 'rgba(79,209,189,.07)'; g.fillRect(z.x0*sc, 0, (z.x1 - z.x0)*sc, cv.height);
  g.strokeStyle = 'rgba(79,209,189,.7)'; g.lineWidth = Math.max(1.5, sc*.2); g.setLineDash([sc*1.2, sc*.8]);
  g.beginPath(); g.moveTo(z.x1*sc, 0); g.lineTo(z.x1*sc, cv.height); g.stroke(); g.setLineDash([]);
  g.fillStyle = 'rgba(79,209,189,.9)'; g.font = `800 ${Math.max(11, sc*1.8)}px "Big Shoulders Display", sans-serif`; g.textAlign = 'right'; g.fillText('YOUR SIDE', z.x1*sc - sc, sc*3); g.textAlign = 'left';
  g.fillStyle = 'rgba(239,107,75,.05)'; g.fillRect(z.x1*sc, 0, (A.W - z.x1)*sc, cv.height);
  // escort ring around you; post rings around guards holding a spot
  g.strokeStyle = 'rgba(79,209,189,.6)'; g.setLineDash([sc*.6, sc*.5]); g.lineWidth = Math.max(1.2, sc*.15);
  g.beginPath(); g.arc(H.x*sc, H.y*sc, A.ESCORT_R*sc, 0, 7); g.stroke(); g.setLineDash([]);
  g.fillStyle = 'rgba(79,209,189,.85)'; g.font = `700 ${Math.max(9, sc*1.2)}px "Big Shoulders Display", sans-serif`; g.textAlign = 'center'; g.fillText('ESCORT', H.x*sc, (H.y + A.ESCORT_R + 1.6)*sc);
  for (const u of deployWorld.units) if (u.side === 'P' && u.post){
    g.strokeStyle = 'rgba(240,180,41,.45)'; g.setLineDash([sc*.4, sc*.5]); g.beginPath(); g.arc(u.post.x*sc, u.post.y*sc, A.POST_R*sc, 0, 7); g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(240,180,41,.9)'; g.fillText('POST', u.post.x*sc, (u.post.y + u.r + 2.6)*sc);
  }
  g.textAlign = 'left';
  if (S.mode === 'allout'){ g.fillStyle = C.foe; for (let i = 0; i < 6; i++){ g.fillRect((A.W-1.2)*sc, (6 + i*10.8 - 2)*sc, sc*1.2, sc*4); } }
  const fr = A.snapshot(deployWorld);
  drawUnits(g, sc, deployWorld, fr, null, 0, {deploy:true});
  if (S.mode === 'allout'){ g.fillStyle = C.foe; g.font = `800 ${Math.max(11, sc*2.2)}px "Big Shoulders Display", sans-serif`; g.textAlign = 'right'; g.fillText('GATES', (A.W-2)*sc, 4*sc); g.textAlign = 'left'; }
}
(function deployDrag(){
  const cv = $('deployCanvas'); let drag = null;
  const r2 = v => Math.round(v * 100) / 100; // centimetres: keeps shared links short (they carry positions exactly)
  const pos = e => { const r = cv.getBoundingClientRect(); return { x:r2((e.clientX - r.left) / r.width * A.W), y:r2((e.clientY - r.top) / r.height * A.H) }; };
  cv.addEventListener('pointerdown', e => {
    if (!deployWorld) return; const p = pos(e);
    let best = null, bd = 4;
    for (const u of deployWorld.units) if ((u.side === 'P' && !u.rider) || u.side === 'H'){ const d = Math.hypot(u.x - p.x, u.y - p.y); if (d < bd + u.r){ bd = d; best = u; } }
    if (best){ drag = best.side === 'H' ? 'you' : best.s.id; cv.setPointerCapture(e.pointerId); e.preventDefault(); }
  });
  cv.addEventListener('pointermove', e => {
    if (!drag) return; const p = pos(e);
    if (drag === 'you'){
      const abs = absPlacements(), old = youAt();
      const nu = A.clampPlace(S.terrain, A.HUMAN, p.x, p.y, curVar()), dx = nu.x - old.x, dy = nu.y - old.y;
      // escorts come with you; guards on a post stay where they are
      for (const id in abs){ const q = abs[id]; if (Math.hypot(q.x - old.x, q.y - old.y) <= A.ESCORT_R) abs[id] = A.clampPlace(S.terrain, A.BY_ID[id], q.x + dx, q.y + dy, curVar()); }
      S.pos = abs; S.youPos = nu;
      if (S.mount && S.team.has(S.mount)) S.pos[S.mount] = Object.assign({}, S.youPos);
    } else {
      S.pos = absPlacements(); S.pos[drag] = A.clampPlace(S.terrain, A.BY_ID[drag], p.x, p.y, curVar());
    }
    for (const id in S.pos) S.pos[id] = {x: r2(S.pos[id].x), y: r2(S.pos[id].y)}; // the fight re-clamps, so this is safe
    if (S.youPos) S.youPos = {x: r2(S.youPos.x), y: r2(S.youPos.y)};
    drawDeploy();
  });
  const end = () => { drag = null; };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
})();
$('autoForm').addEventListener('click', () => { S.pos = {}; S.youPos = null; drawDeploy(); });
$('newSeed').addEventListener('click', () => { S.seed = (Math.random()*1e6|0) + 1; $('seedLbl').textContent = S.seed; drawDeploy(); });
$('startFight').addEventListener('click', () => startBattle());

// ---------- battle ----------
function startBattle(){
  if (!draftReady()){ go('draft'); return; }
  if (S.mig){ if (S.mig.over || S.mig.boonOffer){ go('mig'); return; } migSync(); }
  const w = A.simulate(makeCfg(), true);
  // migration: the result counts the moment the fight is simulated (a reload can't undo it)
  if (S.mig){ S.migWorld = w; S.migEntry = M.applyResult(S.mig, w); if (S.mig.over) recordMigEnd(); saveRun(); }
  $('rematch').hidden = !!S.mig;
  const cg = currentGame(); S.played = Object.assign(cg, {pos: Object.assign({}, S.pos), you: S.youPos && Object.assign({}, S.youPos), daily: S.daily, dailyKind: S.dailyKind}); // what the result banner's link replays
  S.world = w; S.dur = w.result.t; S.playT = 0; S.playing = true; S.sel = 0;
  $('scrub').max = S.dur.toFixed(1); $('scrub').value = 0;
  renderMarks(); $('report').hidden = true; $('banner').innerHTML = '';
  go('fight');
  renderReport(false);
  S.lastTs = 0;
}
$('rematch').addEventListener('click', () => { if (!S.daily){ S.seed = (Math.random()*1e6|0) + 1; $('seedLbl').textContent = S.seed; } startBattle(); });
$('replaySame').addEventListener('click', () => { S.playT = 0; S.playing = true; $('report').hidden = true; $('banner').innerHTML = ''; });
$('playBtn').addEventListener('click', () => { if (S.playT >= S.dur) { S.playT = 0; $('report').hidden = true; $('banner').innerHTML = ''; } S.playing = !S.playing; });
document.querySelectorAll('#speedSeg button').forEach(b => b.addEventListener('click', () => { S.speed = +b.dataset.v; syncSpeed(); }));
function syncSpeed(){ document.querySelectorAll('#speedSeg button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.v === S.speed)); }
$('scrub').addEventListener('input', e => { S.playT = +e.target.value; S.playing = false; });
$('fightCanvas').addEventListener('pointerdown', e => {
  if (!S.world) return; const cv = $('fightCanvas'); const r = cv.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width * A.W, y = (e.clientY - r.top) / r.height * A.H;
  const fr = frameAt(S.playT); let best = -1, bd = 5;
  fr.u.forEach((u, i) => { if (u[7] === 0) return; const d = Math.hypot(u[0]-x, u[1]-y) - S.world.units[i].r; if (d < bd){ bd = d; best = i; } });
  if (best >= 0) S.sel = best;
});

const KINDCOL = {kill:C.red, death:C.red, charge:C.orange, latch:C.red, flee:C.slate, heat:C.orange, feed:C.bone, corner:C.gold, ambush:C.red, gate:C.gold, crash:C.orange, flank:C.red, pounce:C.gold, lunge:C.gold, maul:C.red, sweep:C.orange, feud:C.orange, rout:C.slate, win:C.you, danger:C.foe, bluff:C.bone, info:C.muted};
function renderMarks(){
  const m = $('marks'); m.innerHTML = '';
  for (const e of S.world.events){
    if (!['kill','death','gate','win'].includes(e.kind)) continue;
    const i = document.createElement('i'); i.style.left = (e.t / S.dur * 100) + '%'; i.style.background = KINDCOL[e.kind]; i.title = e.text; m.appendChild(i);
  }
}
function frameAt(t){
  const F = S.world.frames; const k = clampI(Math.floor(t / 0.2), 0, F.length - 1);
  const a = F[k], b = F[Math.min(F.length - 1, k + 1)];
  const f = clamp01((t - a.t) / Math.max(1e-6, b.t - a.t));
  if (a === b || f <= 0) return a;
  return { t, u: a.u.map((ua, i) => { const ub = b.u[i]; if (ua[7] !== 1 || ub[7] !== 1) return ua; const o = ua.slice(); o[0] = ua[0] + (ub[0]-ua[0])*f; o[1] = ua[1] + (ub[1]-ua[1])*f; return o; }), c:a.c, ne:a.ne };
}
function clampI(v, a, b){ return v < a ? a : v > b ? b : v; }
function clamp01(v){ return v < 0 ? 0 : v > 1 ? 1 : v; }

const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
// visual effects: kept deliberately calm for now; flip one on to bring it back
const FX = {fades: true, bursts: true, flash: false, stretch: false, breath: false, dust: false, shake: false};
const BURST = {kill:'#ef6b4b', death:'#ef6b4b', maul:'#ef6b4b', crash:'#ec7a2c', sweep:'#ec7a2c'}; // big moments only
function drawUnits(g, sc, w, fr, events, t, opts){
  opts = opts || {};
  // carcasses
  if (fr.c) for (const c of fr.c){ if (c[2] <= 0) continue; const s = Math.max(.8, Math.sqrt(c[2]) * .06) * sc; g.strokeStyle = C.bone; g.globalAlpha = .75; g.lineWidth = Math.max(1.5, sc*.3); g.beginPath(); g.moveTo(c[0]*sc - s, c[1]*sc - s); g.lineTo(c[0]*sc + s, c[1]*sc + s); g.moveTo(c[0]*sc + s, c[1]*sc - s); g.lineTo(c[0]*sc - s, c[1]*sc + s); g.stroke(); g.globalAlpha = 1; }
  const U = w.units;
  // intent & latch lines
  if (!opts.deploy && $('intentBox').checked){
    fr.u.forEach((u, i) => {
      if (u[7] !== 1 || u[5] < 0 || u[6] >= 0) return; const tg = fr.u[u[5]]; if (!tg || tg[7] !== 1) return;
      const side = U[i].side; g.strokeStyle = side === 'P' ? 'rgba(79,209,189,.28)' : (U[u[5]].side === 'H' ? 'rgba(239,107,75,.55)' : 'rgba(239,107,75,.18)');
      g.lineWidth = Math.max(1, sc*.12); g.setLineDash([sc*.6, sc*.5]); g.beginPath(); g.moveTo(u[0]*sc, u[1]*sc); g.lineTo(tg[0]*sc, tg[1]*sc); g.stroke(); g.setLineDash([]);
    });
  }
  fr.u.forEach((u, i) => {
    if (u[7] !== 1 || u[6] < 0) return; const tg = fr.u[u[6]]; if (!tg) return;
    g.strokeStyle = C.red; g.lineWidth = Math.max(2, sc*.35); g.beginPath(); g.moveTo(u[0]*sc, u[1]*sc); g.lineTo(tg[0]*sc, tg[1]*sc); g.stroke();
  });
  // motion trails for committed moves
  if (!opts.deploy && S.world && S.world.frames){
    const F = S.world.frames, k = clampI(Math.floor(t / 0.2), 0, F.length - 1);
    fr.u.forEach((u, i) => {
      if (u[7] !== 1) return; const kind = u[15];
      if (!['charge','pounce','lunge','dart'].includes(kind)) return;
      g.strokeStyle = kind === 'charge' ? 'rgba(236,122,44,.55)' : kind === 'dart' ? 'rgba(217,207,180,.45)' : 'rgba(240,180,41,.7)';
      g.lineWidth = Math.max(2, U[i].r * sc * (kind === 'charge' ? .9 : .5)); g.lineCap = 'round';
      g.beginPath(); g.moveTo(u[0]*sc, u[1]*sc);
      for (let j = 1; j <= 5 && k - j >= 0; j++){ const p = F[k - j].u[i]; if (p[7] !== 1) break; g.lineTo(p[0]*sc, p[1]*sc); }
      g.globalAlpha = .8; g.stroke(); g.globalAlpha = 1; g.lineCap = 'butt';
    });
  }
  // "alive" effects read the recorded frames around t (render only; the fight itself is unchanged)
  const F = (!opts.deploy && S.world && S.world.frames) ? S.world.frames : null, kf = F ? clampI(Math.floor(t / 0.2), 0, F.length - 1) : 0;
  const prevOf = (i, back) => F && kf - back >= 0 ? F[kf - back].u[i] : null;
  const speedOf = i => { const a = prevOf(i, 0), b = prevOf(i, 1); return a && b && a[7] === 1 && b[7] === 1 ? Math.hypot(a[0] - b[0], a[1] - b[1]) / 0.2 : 0; };
  const DUST = {savanna:'217,190,140', river:'120,100,70', forest:'90,80,55', tundra:'240,244,250'}[w.T.id] || '200,190,160';
  if (F && FX.dust && !REDUCED) fr.u.forEach((u, i) => { // dust kicked up behind running heavyweights and chargers
    if (u[7] !== 1 || U[i].side === 'H' || u[9] > 0) return;
    const v = speedOf(i); if (!(v > 4 && (U[i].s.mass > 250 || u[15] === 'charge'))) return;
    for (let j = 1; j <= 3; j++){ const p = prevOf(i, j); if (!p || p[7] !== 1) break;
      const age = t - F[kf - j].t, r = (U[i].r * .6 + age * 2.2) * sc; g.fillStyle = `rgba(${DUST},${Math.max(0, .22 - age * .2)})`;
      g.beginPath(); g.arc(p[0] * sc, p[1] * sc + U[i].r * sc * .4, r, 0, 7); g.fill(); }
  });
  // animals that just died shrink and fade where they fell
  if (F && FX.fades) fr.u.forEach((u, i) => {
    const d = U[i].deathT; if (u[7] !== 0 || d == null || t < d || t - d > .8) return;
    const a = 1 - (t - d) / .8, rr = Math.max(10, U[i].r * sc * 1.1) * (.6 + .4 * a), im = FACEIMG[U[i].s.species || U[i].s.id];
    g.save(); g.globalAlpha = a * .8; g.beginPath(); g.arc(u[0] * sc, u[1] * sc, rr, 0, 7); g.clip();
    if (im && im.complete && im.naturalWidth){ g.filter = 'grayscale(1)'; g.drawImage(im, u[0] * sc - rr, u[1] * sc - rr, rr * 2, rr * 2); g.filter = 'none'; } else { g.fillStyle = '#444'; g.fill(); }
    g.restore();
  });
  // draw order: big first, riders last
  const order = fr.u.map((u, i) => i).sort((a, b) => (fr.u[a][9] - fr.u[b][9]) || (U[b].s.mass - U[a].s.mass));
  for (const i of order){
    const u = fr.u[i]; if (u[7] !== 1) continue;
    const unit = U[i]; const s = unit.s; const isH = unit.side === 'H';
    let x = u[0]*sc, y = u[1]*sc; const rr0 = Math.max(isH ? 8 : 10, unit.r * sc * 1.1) * (u[9] > 0 && isH ? .85 : 1);
    // hit flash and shake (health dropped at the last recorded frame), stretch along a charge/pounce, breathing at rest
    let flash = 0, stretch = 0, ang = 0, breath = 1;
    if (F && kf > 0){
      const dHp = F[kf - 1].u[i][2] - F[kf].u[i][2], since = t - F[kf].t;
      if (FX.flash && dHp > .005 && since < .35) flash = (1 - since / .35) * Math.min(1, .35 + dHp * 8);
      const a = prevOf(i, 0), b = prevOf(i, 1), v = speedOf(i);
      if (FX.stretch && ['charge','pounce','lunge','dart'].includes(u[15]) && v > 1){ stretch = Math.min(.24, v / Math.max(4, s.spd) * .24); ang = Math.atan2(a[1] - b[1], a[0] - b[0]); }
      else if (FX.breath && v < 1) breath = 1 + .03 * Math.sin(t * 2.4 + i * 1.7);
    }
    if (REDUCED){ stretch = 0; breath = 1; }
    if (flash && !REDUCED){ const j = rr0 * .16 * flash; x += Math.sin(t * 90 + i) * j; y += Math.cos(t * 77 + i * 3) * j; }
    const rr = rr0 * breath;
    // heat glow
    if (u[3] > .35){ const a = Math.min(.85, (u[3]-.35) * 1.1); const grd = g.createRadialGradient(x, y, rr*.7, x, y, rr*1.9); grd.addColorStop(0, `rgba(236,122,44,${a})`); grd.addColorStop(1, 'rgba(236,122,44,0)'); g.fillStyle = grd; g.beginPath(); g.arc(x, y, rr*1.9, 0, 7); g.fill(); }
    if (u[12]){ g.strokeStyle = C.gold; g.lineWidth = 2; g.beginPath(); g.arc(x, y, rr + 4, 0, 7); g.stroke(); }
    // body (squashed and stretched along the direction of a charge)
    g.save(); g.translate(x, y); if (stretch){ g.rotate(ang); g.scale(1 + stretch, 1 - stretch * .55); g.rotate(-ang); }
    g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.arc(sc*.25, sc*.35, rr, 0, 7); g.fill();
    g.fillStyle = isH ? '#f5f2ea' : unit.side === 'P' ? '#1e5c53' : '#6b2a1d';
    g.beginPath(); g.arc(0, 0, rr, 0, 7); g.fill();
    const im = !isH && FACEIMG[s.species || s.id];
    if (im && im.complete && im.naturalWidth){ g.save(); g.beginPath(); g.arc(0, 0, rr, 0, 7); g.clip(); g.globalAlpha = u[4] === 'flee' ? .55 : u[15] === 'stalk' ? .6 : 1; g.drawImage(im, -rr, -rr, rr*2, rr*2); g.restore(); }
    if (flash){ g.fillStyle = `rgba(255,70,45,${.55 * flash})`; g.beginPath(); g.arc(0, 0, rr, 0, 7); g.fill(); }
    // tier ring
    g.lineWidth = Math.max(2.5, rr*.22);
    g.strokeStyle = isH ? '#ffffff' : unit.side === 'P' ? C.you : C.foe;
    if (u[4] === 'flee') g.setLineDash([3, 3]);
    g.beginPath(); g.arc(0, 0, rr, 0, 7); g.stroke(); g.setLineDash([]);
    g.restore();
    // hp arc
    if (!opts.deploy){ g.strokeStyle = u[2] > .5 ? '#d5f2cf' : u[2] > .25 ? C.gold : C.red; g.lineWidth = Math.max(1.5, rr*.16); g.beginPath(); g.arc(x, y, rr + Math.max(2.5, rr*.22), -Math.PI/2, -Math.PI/2 + Math.PI*2*u[2]); g.stroke(); }
    // label
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (isH || !(im && im.complete && im.naturalWidth)){
      g.fillStyle = isH ? '#121212' : '#fff';
      const fs = Math.max(8, Math.min(15, rr * .78));
      g.font = `900 ${fs}px "Big Shoulders Display", Impact, sans-serif`;
      g.fillText(isH ? 'YOU' : s.abbr, x, y + 1);
    }
    // status marks
    const tagY = y - rr - Math.max(6, rr*.5);
    let tag = null, tcol = C.fg;
    if (u[13]) { tag = 'HOT'; tcol = C.orange; }
    else if (u[8]) { tag = 'STUN'; tcol = C.gold; }
    else if (u[4] === 'feed' && !opts.deploy) { tag = 'EATING'; tcol = C.bone; }
    else if (u[14]) { tag = 'FULL'; tcol = C.bone; }
    else if (u[4] === 'flee') { tag = 'FLEE'; tcol = C.slate; }
    else if (u[4] === 'withdraw') { tag = 'HURT'; tcol = C.slate; }
    else if (u[15] === 'charge') { tag = 'CHARGE'; tcol = C.orange; }
    else if (u[15] === 'pounce') { tag = 'POUNCE'; tcol = C.gold; }
    else if (u[15] === 'lunge') { tag = 'LUNGE'; tcol = C.gold; }
    else if (u[15] === 'stalk') { tag = 'STALKING'; tcol = C.muted; }
    if (isH && u[9] >= 4.5) { tag = 'IN TREE'; tcol = C.you; }
    if (tag){ g.font = `800 ${Math.max(9, sc*1.3)}px "Big Shoulders Display", sans-serif`; g.fillStyle = tcol; g.fillText(tag, x, tagY); }
    if (i === S.sel && !opts.deploy){ g.strokeStyle = '#fff'; g.lineWidth = 1; g.setLineDash([2, 2]); g.beginPath(); g.arc(x, y, rr + 7, 0, 7); g.stroke(); g.setLineDash([]); }
  }
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  // floating notes
  if (events){
    g.font = `600 ${Math.max(10, sc*1.5)}px Barlow, sans-serif`;
    const placed = [];
    for (let k = Math.min(fr.ne, events.length) - 1; k >= 0; k--){
      const e = events[k]; const age = t - e.t; if (age > 1.8) break; if (age < 0 || e.x == null || e.kind === 'info') continue;
      let slot = 0; while (slot < 2 && placed.some(p => Math.abs(p.x - e.x) < 7 && p.slot === slot && Math.abs(p.y - e.y) < 6)) slot++;
      if (slot >= 2) continue; placed.push({x:e.x, y:e.y, slot});
      if (FX.bursts && age < .55 && BURST[e.kind] && !REDUCED){ // impact burst: expanding ring + debris
        const q = 1 - age / .55, bx = e.x * sc, by = e.y * sc, R0 = (1.2 + age * 9) * sc;
        g.strokeStyle = BURST[e.kind]; g.globalAlpha = q * .8; g.lineWidth = Math.max(1.5, sc * .35 * q); g.beginPath(); g.arc(bx, by, R0, 0, 7); g.stroke();
        g.fillStyle = BURST[e.kind]; for (let d = 0; d < 7; d++){ const an = (k * 2.39 + d * 0.9) % 6.283, rd = R0 * (1.1 + ((k * 7 + d * 13) % 5) * .12); g.beginPath(); g.arc(bx + Math.cos(an) * rd, by + Math.sin(an) * rd, Math.max(1, sc * .28 * q), 0, 7); g.fill(); }
        g.globalAlpha = 1;
      }
      if (e.kind === 'charge' || e.kind === 'pounce' || e.kind === 'lunge' || e.kind === 'ambush') continue;
      const short = ({kill:'DOWN', death:'KILLED', charge:'CHARGE', latch:'GRAB', flee:'BREAKS', heat:'OVERHEAT', feed:'FEEDING', corner:'CORNERED', ambush:'AMBUSH', pounce:'POUNCE', lunge:'LUNGE', maul:'MAUL', sweep:'SWEEP', gate:'GATE', crash:'CRASH', flank:'FLANK', feud:'RIVALRY', rout:'ROUTED', danger:'!', bluff:'BLUFF', win:''})[e.kind];
      if (!short) continue;
      g.globalAlpha = 1 - age / 1.8; g.fillStyle = KINDCOL[e.kind];
      g.font = `900 ${Math.max(11, sc*1.9)}px "Big Shoulders Display", sans-serif`; g.textAlign = 'center';
      g.fillText(short, e.x*sc, e.y*sc - sc*4 - age*sc*1.5 - slot*Math.max(13, sc*2.2));
      g.globalAlpha = 1; g.textAlign = 'left';
    }
  }
}
function drawFight(){
  const w = S.world; if (!w) return;
  const cv = $('fightCanvas'); const g = cv.getContext('2d'); const sc = cv._scale;
  // camera shake for a moment after a big impact (a crash, a heavy knockback, a kill)
  let shake = 0;
  if (FX.shake && !REDUCED) for (let k = w.events.length - 1; k >= 0; k--){ const e = w.events[k], age = S.playT - e.t; if (age < 0) continue; if (age > .3) break; if (e.kind === 'crash' || e.kind === 'kill' || (e.kind === 'charge' && /knocking/.test(e.text))) shake = Math.max(shake, (1 - age / .3) * sc * .5); }
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#0d110e'; g.fillRect(0, 0, cv.width, cv.height);
  g.setTransform(1, 0, 0, 1, shake ? Math.sin(S.playT * 97) * shake : 0, shake ? Math.cos(S.playT * 83) * shake : 0);
  const standing = w.fallen ? w.trees.concat(w.fallen.filter(f => f.t > S.playT)) : w.trees; // trees an elephant shoved over stay up until they fall
  g.drawImage(groundFor(S.terrain_used || w.T.id, standing, cv.width, cv.height, w.shade, w.variant), 0, 0);
  if (w.mode === 'allout'){ g.fillStyle = C.foe; for (let i = 0; i < 6; i++) g.fillRect((A.W-1.2)*sc, (6 + i*10.8 - 2)*sc, sc*1.2, sc*4); }
  drawHazard(g, sc, w, S.playT);
  const fr = frameAt(S.playT);
  drawUnits(g, sc, w, fr, w.events, S.playT, {});
  g.setTransform(1, 0, 0, 1, 0, 0);
}
// closing arena: tint everything outside the safe box, with a bright edge
const HAZCOL = {fire: ['rgba(214,84,30,.38)', '#ff8a3d'], flood: ['rgba(38,104,190,.42)', '#6fb4ff'], blizzard: ['rgba(236,242,250,.5)', '#ffffff']};
function drawHazard(g, sc, w, t){
  const z = A.zoneAt(w, t); if (!z || z.p <= 0) return;
  const [fill, edge] = HAZCOL[w.zone.kind], X0 = z.x0 * sc, X1 = z.x1 * sc, Y0 = z.y0 * sc, Y1 = z.y1 * sc, CW = A.W * sc, CH = A.H * sc;
  g.save(); g.fillStyle = fill;
  g.fillRect(0, 0, CW, Y0); g.fillRect(0, Y1, CW, CH - Y1); g.fillRect(0, Y0, X0, Y1 - Y0); g.fillRect(X1, Y0, CW - X1, Y1 - Y0);
  g.strokeStyle = edge; g.lineWidth = Math.max(1.5, sc * .25); g.setLineDash([sc * 1.2, sc * .8]); g.strokeRect(X0, Y0, X1 - X0, Y1 - Y0);
  g.restore();
}
function renderSide(){
  const w = S.world; if (!w) return;
  const fr = frameAt(S.playT);
  $('clock').textContent = fmtT(S.playT) + ' / ' + fmtT(S.dur);
  $('scrub').value = S.playT.toFixed(1);
  $('playBtn').textContent = S.playing ? 'Pause' : (S.playT >= S.dur ? 'Watch again' : 'Play');
  // inspect
  const i = S.sel, u = fr.u[i], unit = w.units[i], s = unit.s;
  const stateName = u[7] === 0 ? 'Dead' : u[13] ? 'Overheated, cooling off' : u[4] === 'feed' ? 'Feeding' : u[4] === 'flee' ? 'Fleeing' : u[14] ? 'Full, not hunting' : u[4] === 'engage' ? 'Fighting' : u[4] === 'guard' ? 'Guarding you' : u[4] === 'cool' ? 'Cooling off' : u[4] === 'carry' ? 'Carrying you, keeping away from threats' : u[4] === 'withdraw' ? 'Too badly hurt to fight, falling back' : unit.side === 'H' ? (u[9] >= 4.5 ? 'Up a tree' : u[9] > 0 ? 'Riding your ' + (w.mount ? w.mount.s.name : 'mount') : 'On foot') : 'Wandering';
  const mvName = {charge:'Charging', wheel:'Wheeling around', pounce:'Pouncing', lunge:'Lunging', dart:'Darting in', retreat:'Backing out', stalk:'Stalking'}[u[15]];
  const tgt = u[5] >= 0 && u[7] === 1 ? w.units[u[5]] : null;
  const g = (k, v, col, txt) => `<span>${k}</span><div class="bar"><b style="width:${Math.round(clamp01(v)*100)}%;background:${col}"></b></div><span class="n">${txt}</span>`;
  $('inspect').innerHTML = `<div class="hd">${unit.side==='H' ? '<span class="tok" style="background:#f5f2ea">YOU</span>' : tokHTML(s, 44)}<div><h3>${esc(unit.side==='H'?'You':s.name)}</h3><div class="label" style="color:${unit.side==='P'?C.you:unit.side==='E'?C.foe:C.fg}">${unit.side==='P'?(w.mount===unit?'Your mount':'Your team'):unit.side==='E'?'Other side':'The one being protected'}</div></div></div>
    <div style="margin-top:4px" class="styleTag">${unit.side === 'H' ? '' : esc(s.style)}</div><div style="margin-top:6px;font-size:13.5px">${esc(mvName && u[7] === 1 ? mvName : stateName)}${tgt ? ' → ' + esc(tgt.side==='H'?'you':tgt.s.name) : ''}</div>
    <div class="gauges">${g('Health', u[2], u[2]>.5?'#d5f2cf':u[2]>.25?C.gold:C.red, Math.round(u[2]*unit.maxhp))}${g('Heat', u[3], C.orange, Math.round(u[3]*100)+'%')}${g('Stamina', u[11], C.slate, Math.round(u[11]*100)+'%')}${unit.side!=='H'?g('Morale', u[10], C.you, Math.round(clamp01(u[10])*100)+'%'):''}</div>
    <p class="notes" style="margin-top:8px;font-size:12px">Tap any animal on the field to inspect it.</p>`;
  // log
  const lg = $('log'); const evs = w.events.slice(0, fr.ne).filter(e => e.t <= S.playT + .05);
  if (lg._n !== evs.length){
    lg._n = evs.length;
    lg.innerHTML = evs.slice().reverse().slice(0, 80).map(e => `<div data-t="${e.t}"><span class="t">${fmtT(e.t)}</span><span class="${e.kind==='info'?'k-info':''}" style="${e.kind!=='info'?'color:'+KINDCOL[e.kind]:''}">${esc(e.text)}</span></div>`).join('');
  }
  if (S.playT >= S.dur - 1e-6 && $('report').hidden){ renderReport(true); }
}
$('banner').addEventListener('click', e => { if (e.target.id === 'migContinue'){ go('mig'); return; } if (e.target.id === 'copyResult' && S.world && S.played) copyLink(gameLink(S.played, S.world.result.score), $('copyResultOut')); });
$('log').addEventListener('click', e => { const d = e.target.closest('[data-t]'); if (d){ S.playT = Math.max(0, +d.dataset.t - 1.5); S.playing = false; } });

const HZ = A.MATCH_T;
function bestKey(){ return 'wa-best:' + [S.terrain, S.mode, S.board.join('+'), [...S.team].sort().join('+'), S.mount || 'foot'].join('|') + (isPick() ? '|pick' + S.pickN : ''); } // budget keys unchanged
function readBest(){ try { return +localStorage.getItem(bestKey()) || 0; } catch(e){ return 0; } }
function writeBest(v){ try { localStorage.setItem(bestKey(), String(v)); } catch(e){} }
function renderReport(show){
  const w = S.world; if (!w || !show) return;
  const res = w.result; const sum = A.summarize(w);
  const b = $('banner');
  if (S.mig && S.migEntry && S.migWorld === w){ b.innerHTML = migBanner(S.migEntry, res); renderTeamReport(w, sum); return; }
  const score = res.score, prev = readBest(), isBest = score > prev + .05;
  if (isBest) writeBest(score);
  let dailyLine = '';
  const P = S.played || {};
  if (P.daily && P.seed === dailySeed(P.dailyKind, P.daily) && (P.dailyKind === 'pick3') === (P.draft === 'pick' && P.pickN === 3)){
    const k = dailyKey(P.dailyKind, P.daily), nm = P.dailyKind === 'pick3' ? 'Daily Pick-3' : 'Daily'; let db = 0; try { db = +localStorage.getItem(k) || 0; } catch(e){}
    if (score > db + .05){ try { localStorage.setItem(k, String(score)); } catch(e){} }
    bumpStreak(P.daily);
    const team = P.team.map(id => A.BY_ID[id].abbr).join('+') || 'no animals';
    dailyLine = ` ${nm} ${P.daily}: ${score > db + .05 ? 'your best today' : 'best today ' + fmtT(db)} · share: “Wild Arena ${nm.toLowerCase()} ${P.daily}: ${fmtT(score)}${res.survived && res.why === 'cleared' ? ', cleared the board at ' + fmtT(res.t) : ''} with ${team} (${P.dailyKind === 'pick3' ? 'Pick-3' : '$' + spent().toLocaleString()})”.`;
  }
  const draftWord = isPick() ? `this Pick-${S.pickN} draft` : 'this draft';
  const bestLine = isBest ? (prev ? `New best for ${draftWord} here (was ${fmtT(prev)}).` : `First run of ${draftWord} here.`) : `Best for ${draftWord} here: ${fmtT(prev)}.`;
  const sharedLine = S.shared != null ? ` Shared score to beat: ${fmtT(S.shared)}${score > S.shared + .05 ? ', and you beat it.' : score >= S.shared - .05 ? ', and you matched it.' : '.'}` : '';
  const shareRow = `<div class="btnrow"><button class="btn" id="copyResult">Copy link</button><span class="copyOut" id="copyResultOut"></span></div>`;
  if (res.survived){
    const why = res.why === 'cleared' ? `The other side was dead, routed or full by ${fmtT(res.t)}.` : res.why === 'quiet' ? `Nothing came at you for ${A.QUIET_T} s, so the other side gave up at ${fmtT(res.t)}.` : `You held out the full ${fmtT(HZ)}.`;
    b.innerHTML = `<div class="banner win"><span class="big">Survived · ${fmtT(HZ)}</span><span>${why} Full score. ${bestLine}${sharedLine}${dailyLine}</span>${shareRow}</div>`;
  } else {
    const k = A.BY_ID[res.killer];
    b.innerHTML = `<div class="banner lose"><span class="big">You lasted ${fmtT(score)}</span><span>Killed by the ${esc(k ? k.name : 'unknown')}. ${bestLine}${sharedLine}${dailyLine}</span>${shareRow}</div>`;
  }
  renderTeamReport(w, sum);
}
function renderTeamReport(w, sum){
  const mine = sum.units.filter(u => u.side === 'P');
  const mvp = mine.slice().sort((a, b) => (b.protect*1.5 + b.dealt) - (a.protect*1.5 + a.dealt))[0];
  const rows = mine.map(u => { const a = A.BY_ID[u.id]; const status = u.alive ? 'Alive' : 'Killed by ' + (A.BY_ID[u.killedBy] ? A.BY_ID[u.killedBy].name : '?'); return `<tr><td><span style="display:inline-flex;gap:6px;align-items:center">${tokHTML(a, 26)}${esc(a.name)}${mvp && u === mvp && (u.dealt > 0) ? ' <b style="color:var(--gold)">MVP</b>' : ''}</span></td><td class="n">${u.dealt.toLocaleString()}</td><td class="n">${u.protect.toLocaleString()}</td><td class="n">${u.taken.toLocaleString()}</td><td class="n">${u.kills}</td><td>${esc(status)}</td></tr>`; }).join('');
  const foes = sum.units.filter(u => u.side === 'E');
  const deadF = foes.filter(u => !u.alive && !u.escaped).length; const ranF = foes.filter(u => u.escaped).length;
  const fed = w.units.filter(u => u.side === 'E' && u.sated && u.state !== 'dead').length;
  $('report').innerHTML = `<h3 style="margin-bottom:10px">After-action report</h3>
   <div class="tblwrap"><table><thead><tr><th>Your team</th><th class="n">Damage</th><th class="n">Protecting you</th><th class="n">Taken</th><th class="n">Kills</th><th>Status</th></tr></thead><tbody>${rows || '<tr><td colspan="6" style="color:var(--muted)">You fought alone.</td></tr>'}</tbody></table></div>
   <p class="notes" style="margin-top:10px">"Protecting you" counts damage dealt to animals that were targeting you at the time. Other side: ${deadF} of ${foes.length} dead${ranF ? ', ' + ranF + ' routed out of the arena' : ''}${fed ? ', ' + fed + ' ate their fill and stopped hunting' : ''}.</p>`;
  $('report').hidden = false;
}

// ---------- loop ----------
function frame(ts){
  if (S.screen === 'fight' && S.world){
    if (S.lastTs && S.playing){ S.playT = Math.min(S.dur, S.playT + (ts - S.lastTs) / 1000 * S.speed); if (S.playT >= S.dur) S.playing = false; }
    drawFight(); renderSide();
  }
  S.lastTs = ts;
  requestAnimationFrame(frame);
}

// ---------- lab ----------
function renderLabDesc(){
  const names = [...S.team].map(id => A.BY_ID[id].name);
  $('labDraftDesc').textContent = (names.length ? names.join(', ') : 'No animals (just you)') + ` · ${S.mount && S.team.has(S.mount) ? 'riding the ' + A.BY_ID[S.mount].name : 'on foot'} · 50 battles on each terrain, your current formation and mount. Score is time alive, capped at 5:00.`;
}
function runBatched(total, fn, onProgress, done){
  let i = 0;
  function chunk(){
    const end = Math.min(total, i + 6);
    for (; i < end; i++) fn(i);
    onProgress(i / total);
    if (i < total) setTimeout(chunk, 0); else done();
  }
  chunk();
}
const TCOLS = {savanna:'#f0b429', river:'#5aa9c9', forest:'#6cc68a', tundra:'#c9d4de'};
function curveSVG(series){
  // series: [{label, color, scores:[...]}] -> fraction still alive over 0..HZ
  const Wd = 600, Ht = 190, L = 34, Rm = 8, T = 8, B = 24, pw = Wd - L - Rm, ph = Ht - T - B;
  const X = t => L + t / HZ * pw, Y = f => T + (1 - f) * ph;
  let g = '';
  for (const f of [0, .25, .5, .75, 1]) g += `<line x1="${L}" x2="${Wd-Rm}" y1="${Y(f)}" y2="${Y(f)}" stroke="#2b352d" stroke-width="1"/><text x="${L-6}" y="${Y(f)+4}" text-anchor="end" font-size="10" fill="#949d8c" font-family="JetBrains Mono, monospace">${Math.round(f*100)}%</text>`;
  for (let m = 0; m <= HZ / 60; m++) g += `<text x="${X(m*60)}" y="${Ht-6}" text-anchor="middle" font-size="10" fill="#949d8c" font-family="JetBrains Mono, monospace">${m}:00</text>`;
  for (const sr of series){
    const n = sr.scores.length; if (!n) continue;
    let d = '', prev = 1;
    for (let t = 0; t <= HZ; t += 2){ const f = sr.scores.filter(x => x > t).length / n; d += (t ? ` L${X(t).toFixed(1)},${Y(prev).toFixed(1)} L${X(t).toFixed(1)},${Y(f).toFixed(1)}` : `M${X(0)},${Y(f).toFixed(1)}`); prev = f; }
    g += `<path d="${d}" fill="none" stroke="${sr.color}" stroke-width="2"/>`;
  }
  return `<svg viewBox="0 0 ${Wd} ${Ht}" width="100%" role="img" aria-label="Share of runs still alive over time">${g}</svg>`;
}
const mean = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const sem = a => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1) / Math.max(1, a.length)); };
$('runDraft').addEventListener('click', () => {
  const btn = $('runDraft'); btn.disabled = true;
  const terr = Object.keys(A.TERRAINS); const res = {}; terr.forEach(t => res[t] = []); const killers = {};
  const base = makeCfg();
  runBatched(200, i => {
    const terrain = terr[i % 4];
    const w = A.simulate(Object.assign({}, base, {terrain, seed: 1000 + i}));
    res[terrain].push(w.result.score);
    if (!w.result.survived) killers[w.result.killer] = (killers[w.result.killer] || 0) + 1;
  }, p => $('pDraft').style.width = (p*100) + '%', () => {
    btn.disabled = false;
    const all = terr.flatMap(t => res[t]);
    const full = all.filter(x => x >= HZ).length / all.length;
    const kl = Object.entries(killers).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const deaths = all.filter(x => x < HZ).length;
    $('draftOut').innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:24px;align-items:flex-end">
      <div><div class="mono" style="font-size:40px;font-weight:600;line-height:1">${fmtT(mean(all))}</div><div class="label">average time alive (±${Math.round(sem(all))} s)</div></div>
      <div><div class="mono" style="font-size:24px;font-weight:600;line-height:1">${Math.round(full*100)}%</div><div class="label">lasted the full ${fmtT(HZ)}</div></div>
      ${terr.map(t => { const m = mean(res[t]); return `<div style="min-width:110px;flex:1"><div class="label" style="color:${TCOLS[t]}">${A.TERRAINS[t].name}</div><div class="hbar"><div class="track"><b style="left:0;width:${m/HZ*100}%;background:${TCOLS[t]}"></b></div><span class="mono" style="font-size:12px;width:40px;text-align:right">${fmtT(m)}</span></div></div>`; }).join('')}
    </div>
    <div style="margin-top:14px"><div class="label" style="margin-bottom:4px">Share of runs still alive</div>${curveSVG(terr.map(t => ({label:t, color:TCOLS[t], scores:res[t]})))}</div>
    ${deaths ? `<div style="margin-top:10px"><div class="label" style="margin-bottom:6px">Who killed you (${deaths} deaths)</div>${kl.map(([k, n]) => `<div class="hbar" style="margin-bottom:4px"><span style="width:150px;font-size:13px">${esc(A.BY_ID[k] ? A.BY_ID[k].name : k)}</span><div class="track"><b style="left:0;width:${n/deaths*100}%;background:var(--foe)"></b></div><span class="mono" style="font-size:12px;width:30px;text-align:right">${n}</span></div>`).join('')}</div>` : '<p class="notes" style="margin-top:12px">Not a single death in 200 battles.</p>'}`;
  });
});
$('runPrice').addEventListener('click', () => {
  const btn = $('runPrice'); btn.disabled = true;
  const N = 480, R = A.rng(S.seed), terr = Object.keys(A.TERRAINS);
  const onBoard = S.board.map(id => A.BY_ID[id]);
  const on = {}, off = {}; onBoard.forEach(a => { on[a.id] = []; off[a.id] = []; });
  runBatched(N, i => {
    // a random team from this board: shuffle it and take whatever still fits the budget
    const order = S.board.slice(); for (let k = order.length - 1; k > 0; k--){ const j = Math.floor(R() * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; }
    const team = []; let left = BUDGET; for (const id of order) if (A.BY_ID[id].price <= left){ team.push(id); left -= A.BY_ID[id].price; }
    const terrain = terr[i % 4];
    const w = A.simulate({board:S.board, team, terrain, mode:S.mode, mount:bestMount(team) || null, seed: 5000 + i});
    const sc = w.result.score;
    onBoard.forEach(a => (team.includes(a.id) ? on : off)[a.id].push(sc));
  }, p => $('pPrice').style.width = (p*100) + '%', () => {
    btn.disabled = false;
    const rows = onBoard.map(a => {
      const m = mean(on[a.id]) - mean(off[a.id]), se = Math.sqrt(sem(on[a.id]) ** 2 + sem(off[a.id]) ** 2);
      return {a, m, se, per: m / a.price * 100};
    }).sort((x, y) => y.per - x.per);
    const lo = Math.min(...rows.map(r => r.m - r.se), 0), hi = Math.max(...rows.map(r => r.m + r.se), 1);
    const X = v => (v - lo) / (hi - lo) * 100;
    const sg = v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(0);
    $('priceOut').innerHTML = `<div class="tblwrap"><table><thead><tr><th>#</th><th>Animal</th><th class="n">Price</th><th>Time-alive swing</th><th class="n">Seconds</th><th class="n">s per $100</th></tr></thead><tbody>
      ${rows.map((r, k) => `<tr><td class="n">${k+1}</td><td><span style="display:inline-flex;gap:6px;align-items:center">${tokHTML(r.a, 26)}${esc(r.a.name)}</span></td><td class="n">$${r.a.price}</td>
        <td style="min-width:140px"><div class="hbar"><div class="track"><span class="zero" style="left:${X(0)}%"></span><b style="left:${Math.min(X(0),X(r.m))}%;width:${Math.abs(X(r.m)-X(0))}%;background:${r.m>=0?'var(--you)':'var(--foe)'}"></b><b style="left:${X(r.m-r.se)}%;width:${X(r.m+r.se)-X(r.m-r.se)}%;background:rgba(236,230,211,.25);height:2px;top:3px"></b></div></div></td>
        <td class="n">${sg(r.m)} ±${r.se.toFixed(0)}</td><td class="n">${sg(r.per)}</td></tr>`).join('')}
    </tbody></table></div><p class="notes" style="margin-top:8px">Ranked by seconds of extra life per $100. Every run is capped at ${fmtT(HZ)}, and a run you survive scores the full ${fmtT(HZ)}. Effects inside one standard error are noise at this sample size; run it again to see how stable the order is.</p>`;
    S.seed = (Math.random()*1e6|0) + 1; $('seedLbl').textContent = S.seed;
  });
});

// ---------- migration (the roguelike run: 7 fights, team and wounds carry over; rules in migration.js) ----------
const MIG_KEY = 'wa-mig', MIG_BEST = 'wa-mig-best', migDailyKey = d => 'wa-mig-daily:' + d;
const migDailySeed = d => dateSeed('wild-arena:migration:' + d);
function readJSON(k){ try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch(e){ return null; } }
function writeJSON(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
// a saved run is only trusted if everything in it still exists in this version
function loadRun(){
  const r = readJSON(MIG_KEY), ok = id => Object.prototype.hasOwnProperty.call(A.BY_ID, id);
  if (!r || r.v !== 1 || !Array.isArray(r.team) || !Array.isArray(r.board) || !Array.isArray(r.boons) || !Array.isArray(r.log)) return null;
  if (!r.board.every(ok) || !r.team.every(e => e && ok(e.id) && Array.isArray(e.hp)) || !A.TERRAINS[r.terrain]) return null;
  return r;
}
function saveRun(){ if (S.mig) writeJSON(MIG_KEY, S.mig); }
// point the shared game state (board, team, map, fight seed) at the run's coming fight
function migSync(){
  const r = S.mig; if (!r) return;
  const key = r.seed + ':' + r.k;
  S.draft = 'budget'; S.daily = null; S.dailyKind = null; S.shared = null;
  S.terrain = r.terrain; S.board = r.board.slice(); S.boardSeed = r.boardSeed; S.seed = r.fightSeed; $('seedLbl').textContent = S.seed;
  S.team = new Set(M.teamIds(r));
  if (S.migKey !== key){ S.migKey = key; S.pos = {}; S.youPos = null; S.mount = bestMount(); } // a new fight: fresh formation on the new map
  for (const id in S.pos) if (!S.team.has(id)) delete S.pos[id];
  if (S.mount && !S.team.has(S.mount)) S.mount = bestMount();
  if (!S.board.includes(S.focus) && !S.team.has(S.focus)) S.focus = S.board[0] || M.teamIds(r)[0] || 'elephant';
}
function startMig(seed, daily){
  hideNotice(); S.mig = M.newRun(seed, daily || null); S.migKey = null; S.migEntry = null; S.world = null; saveRun(); go('mig');
}
// leave the mode (the run stays saved, to resume from the arena screen); the normal game gets a fresh board
function exitMig(){ if (!S.mig) return; S.mig = null; S.migKey = null; S.migEntry = null; S.world = null; dealNewBoard(); renderHud(); }
function recordMigEnd(){
  const r = S.mig, cur = {survived: r.survived, total: +r.total.toFixed(1), won: r.won, daily: r.daily};
  const best = readJSON(MIG_BEST); r.prevBest = best; r.newBest = M.better(cur, best); if (r.newBest) writeJSON(MIG_BEST, cur);
  if (r.daily){ const db = readJSON(migDailyKey(r.daily)); r.prevDaily = db; r.newDaily = M.better(cur, db); if (r.newDaily) writeJSON(migDailyKey(r.daily), cur); bumpStreak(r.daily); }
}
const hpCol = f => f > .5 ? '#d5f2cf' : f > .25 ? C.gold : C.red;
const hpBar = f => `<i title="${Math.round(f * 100)}%"><b style="width:${Math.round(clamp01(f) * 100)}%;background:${hpCol(f)}"></b></i>`;
const pctHp = f => Math.round(f * 100) + '%';
function migTeamHTML(r, shop){
  let h = `<div class="migteam"><div class="mt"><span class="tok" style="background:#f5f2ea;width:30px;height:30px;font-size:10px">YOU</span><div><div class="nm">You · ${pctHp(r.hp)}</div><div class="hpb">${hpBar(r.hp)}</div></div></div>`;
  for (const e of r.team){
    const a = A.BY_ID[e.id], g = M.groupOf(e.id), nm = g > 1 ? `${a.groupName} (${e.hp.length} of ${g})` : a.name;
    const act = !shop ? '' : e.fresh ? `<button class="btn" data-unbuy="${a.id}" title="Undo: get the $${a.price} back">Undo</button>` : `<button class="btn" data-sell="${a.id}" title="Sell for half its price">Sell $${M.sellPrice(a.id)}</button>`;
    h += `<div class="mt${e.fresh ? ' fresh' : ''}">${tokHTML(a, 30)}<div><div class="nm">${esc(nm)}${e.fresh ? ' <span class="label" style="color:var(--you)">new</span>' : ''}</div><div class="hpb">${e.hp.map(hpBar).join('')}</div></div>${act}</div>`;
  }
  if (!r.team.length) h += `<span class="label" style="align-self:center">No animals with you.</span>`;
  return h + '</div>';
}
// team-line buttons (trading post): sell a carried animal, undo a buy
$('teamline').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !S.mig) return;
  if (b.dataset.sell) M.sell(S.mig, b.dataset.sell); else if (b.dataset.unbuy) M.unbuy(S.mig, b.dataset.unbuy); else return;
  saveRun(); migSync(); S.world = null; renderAll(); renderHud();
});
// the run HUD: fight k/7, money, your health, boons, team, and a way back to the run screen or out
function renderHud(){
  const r = S.mig, hud = $('migHud'); $('migStep').hidden = !r;
  if (!r || S.screen === 'fight'){ hud.hidden = true; return; } // no spoilers while a fight plays (its result already counts)
  const fightTxt = r.over ? (r.won ? 'Run complete' : `Run over · ${r.survived} of ${M.MIG.FIGHTS} survived`) : `Fight ${r.k + 1}/${M.MIG.FIGHTS} · ${A.TERRAINS[r.terrain].name}${r.kind !== 'plain' ? ' · ' + M.KIND_NAME[r.kind] : ''}`;
  const team = r.team.map(e => `<span title="${esc(itemName(A.BY_ID[e.id]))}: ${e.hp.map(pctHp).join(', ')}" style="display:inline-flex;flex-direction:column;align-items:center;gap:2px">${tokHTML(A.BY_ID[e.id], 22)}<span class="hpb" style="display:flex"><i style="display:block;width:22px;height:3px;border-radius:2px;background:var(--line);overflow:hidden"><b style="display:block;height:100%;width:${Math.round(e.hp.reduce((s, x) => s + x, 0) / e.hp.length * 100)}%;background:${hpCol(Math.min(...e.hp))}"></b></i></span></span>`).join('');
  hud.innerHTML = `<b>Migration${r.daily ? ' · daily' : ''}</b><span>${fightTxt}</span><span class="money">$${r.money.toLocaleString()}</span><span>You ${pctHp(r.hp)}</span>`
    + (team ? `<span style="display:inline-flex;gap:4px;flex-wrap:wrap">${team}</span>` : '')
    + (r.boons.length ? `<span class="boons">${r.boons.map(b => `<span class="boon" title="${esc(A.BOONS[b].desc)}">${esc(A.BOONS[b].name)}</span>`).join('')}</span>` : '')
    + `<span class="btnrow">${S.screen !== 'mig' ? '<button class="btn" data-hud="run">Run</button>' : ''}<button class="btn" data-hud="abandon">${r.over ? 'Close run' : 'Abandon'}</button></span>`;
  hud.hidden = false;
}
$('migHud').addEventListener('click', e => {
  const b = e.target.closest('button[data-hud]'); if (!b) return;
  if (b.dataset.hud === 'run'){ go('mig'); return; }
  if (!S.mig.over && b.dataset.armed !== '1'){ b.dataset.armed = '1'; b.textContent = 'Abandon this run?'; b.classList.add('on'); return; } // two clicks to throw a run away
  try { localStorage.removeItem(MIG_KEY); } catch(err){}
  exitMig(); renderAll(); go('arena');
});
function migShare(r){
  const last = r.log[r.log.length - 1], team = last ? last.team.map(id => A.BY_ID[id].abbr).join('+') || 'no animals' : 'no animals';
  return `Wild Arena ${r.daily ? 'daily migration ' + r.daily : 'migration'}: ${r.won ? `made it through all ${M.MIG.FIGHTS} fights` : `survived ${r.survived} of ${M.MIG.FIGHTS} fights`}, ${fmtT(r.total)} alive in all${r.boons.length ? ', boons ' + r.boons.map(b => A.BOONS[b].name).join(', ') : ''}, last team ${team}.`;
}
function migBanner(e, res){
  const r = S.mig, n = e.k + 1, k = A.BY_ID[res.killer];
  const cont = `<div class="btnrow"><button class="btn primary" id="migContinue">${r.over ? 'See how the run went' : 'Continue migration'}</button></div>`;
  if (res.survived){
    const why = res.why === 'cleared' ? `The other side was dead, routed or full by ${fmtT(res.t)}.` : res.why === 'quiet' ? `Nothing came at you for ${A.QUIET_T} s, so the other side gave up at ${fmtT(res.t)}.` : `You held out the full ${fmtT(HZ)}.`;
    return `<div class="banner win"><span class="big">Fight ${n} survived</span><span>${why} You earn $${e.earned}.${r.won ? ` That was the last fight: the migration is through.` : ''}</span>${cont}</div>`;
  }
  return `<div class="banner lose"><span class="big">Killed in fight ${n}</span><span>You lasted ${fmtT(res.score)}, killed by the ${esc(k ? k.name : 'unknown')}. The migration ends here.</span>${cont}</div>`;
}
function recapHTML(r, e){
  const n = e.k + 1, lost = e.lost.map(l => { const a = A.BY_ID[l.id]; return M.groupOf(l.id) > 1 && !l.all ? `${l.n} of your ${a.groupName.toLowerCase()}` : `your ${a.groupName && M.groupOf(l.id) > 1 ? a.groupName.toLowerCase() : a.name}`; });
  const kill = A.BY_ID[e.killer];
  const head = e.survived ? `<span class="big" style="color:var(--you)">Fight ${n} survived · ${fmtT(e.t)}</span>` : `<span class="big" style="color:var(--red)">Killed in fight ${n} · ${fmtT(e.t)}</span>`;
  const lines = [
    `${A.TERRAINS[e.terrain].name}${e.kind !== 'plain' ? ' · ' + M.KIND_NAME[e.kind] : ''}. ${e.survived ? (e.why === 'cleared' ? 'You cleared the field.' : e.why === 'quiet' ? 'The other side gave up.' : 'You held out the full five minutes.') : `Killed by the ${esc(kill ? kill.name : 'unknown')}.`}`,
    `Other side: ${e.down} down${e.routed ? ', ' + e.routed + ' routed' : ''}.` + (lost.length ? ` You lost ${esc(lost.join(', '))}.` : e.team.length ? ' Your whole team made it.' : ''),
  ];
  if (e.survived) lines.push(`Earned <b class="mono" style="color:var(--gold)">$${e.earned}</b> ($${M.MIG.PER_MIN} a minute alive, $${M.MIG.PER_KILL} per enemy down, $${M.MIG.BONUS} for surviving). You were at ${pctHp(e.hpWas)} and patched up to ${pctHp(r.hp)}; survivors heal ${Math.round((M.MIG.HEAL + (r.boons.includes('dressing') ? M.MIG.DRESSING : 0)) * 100)}% of their wounds.`);
  return head + lines.map(l => `<p class="notes" style="margin:0">${l}</p>`).join('');
}
function renderMig(){
  const r = S.mig; if (!r) return;
  $('migTitle').textContent = r.over ? (r.won ? 'Migration complete' : 'The migration ends') : `The migration · fight ${r.k + 1} of ${M.MIG.FIGHTS}`;
  const order = M.terrainOrder(r.seed);
  $('migTrail').innerHTML = Array.from({length: M.MIG.FIGHTS}, (_, i) => {
    const cls = i < r.survived ? 'done' : r.over && !r.won && i === r.k ? 'dead' : !r.over && i === r.k ? 'now' : '';
    return `<span class="${cls}">${i + 1} ${A.TERRAINS[order[i % 4]].name}${M.fightKind(i) !== 'plain' ? ' · ' + M.KIND_NAME[M.fightKind(i)].toLowerCase() : ''}</span>`;
  }).join('');
  const last = r.log[r.log.length - 1];
  $('migRecap').hidden = !last; $('migRecap').innerHTML = last ? recapHTML(r, last) : '';
  // boon: one of three, before the trading post
  const bb = $('migBoonBox'); bb.hidden = !r.boonOffer || r.over;
  if (!bb.hidden) $('migBoons').innerHTML = r.boonOffer.map(id => `<button class="opt" data-boon="${id}"><h3>${esc(A.BOONS[id].name)}</h3><p>${esc(A.BOONS[id].desc)}</p></button>`).join('');
  $('migTeam').innerHTML = migTeamHTML(r, false);
  const nx = $('migNext'), act = $('migActions');
  if (!r.over){
    const tot = r.board.reduce((s, id) => s + A.BY_ID[id].price, 0);
    nx.hidden = false;
    nx.innerHTML = `<h3 style="margin-bottom:6px">Next: fight ${r.k + 1} · ${A.TERRAINS[r.terrain].name}${r.kind !== 'plain' ? ' · ' + M.KIND_NAME[r.kind] : ''}</h3><p class="notes">${r.kind === 'mega' ? 'Something huge and rare is on this board. ' : r.kind === 'herd' ? 'The last fight: the elephants are here, and the mammoth. ' : ''}The trading post has ${r.board.length} animals worth $${tot.toLocaleString()}; whatever you don't buy is against you. You have $${r.money.toLocaleString()}.${r.k === 0 ? ' After each fight you survive you earn money, pick a boon and trade again.' : ''}</p>`;
    act.innerHTML = `<button class="btn primary" id="migToShop" ${r.boonOffer ? 'disabled' : ''}>${r.boonOffer ? 'Choose a boon first' : 'To the trading post'}</button>`;
  } else {
    const best = r.newBest ? 'A new best run.' : r.prevBest ? `Best run: ${r.prevBest.survived} of ${M.MIG.FIGHTS} fights, ${fmtT(r.prevBest.total)} alive.` : '';
    const daily = r.daily ? ` Daily migration ${r.daily}: ${r.newDaily ? 'your best today.' : r.prevDaily ? `best today ${r.prevDaily.survived} of ${M.MIG.FIGHTS}, ${fmtT(r.prevDaily.total)}.` : ''}` : '';
    nx.hidden = false;
    nx.innerHTML = `<h3 style="margin-bottom:6px">${r.won ? `All ${M.MIG.FIGHTS} fights survived` : `${r.survived} of ${M.MIG.FIGHTS} fights survived`} · ${fmtT(r.total)} alive</h3><p class="notes">${best}${daily}</p><p class="notes" style="margin-top:6px">Share: “${esc(migShare(r))}”</p>`;
    act.innerHTML = `<button class="btn primary" id="migAgain">New migration</button><button class="btn" id="migAgainDaily">Daily migration</button><button class="btn" id="migCopy">Copy result</button><span class="copyOut" id="migCopyOut"></span><button class="btn" id="migHome">Back to the arena</button>`;
  }
}
$('migBoons').addEventListener('click', e => { const b = e.target.closest('[data-boon]'); if (!b || !S.mig) return; M.pickBoon(S.mig, b.dataset.boon); saveRun(); renderMig(); renderHud(); });
$('migActions').addEventListener('click', e => {
  const id = e.target.id;
  if (id === 'migToShop') go('draft');
  else if (id === 'migAgain') startMig(newBoardSeed());
  else if (id === 'migAgainDaily') startMig(migDailySeed(todayUTC()), todayUTC());
  else if (id === 'migCopy') copyLink(migShare(S.mig), $('migCopyOut'), 'Result');
  else if (id === 'migHome'){ try { localStorage.removeItem(MIG_KEY); } catch(err){} exitMig(); renderAll(); go('arena'); }
});
// arena screen entry: start, daily, resume, best
function renderMigEntry(){
  const r = loadRun(), live = r && !r.over, rb = $('migResume');
  rb.hidden = !live; if (live) rb.textContent = `Resume (fight ${r.k + 1}/${M.MIG.FIGHTS}, $${r.money.toLocaleString()})`;
  const best = readJSON(MIG_BEST), db = readJSON(migDailyKey(todayUTC()));
  $('migBest').textContent = (best ? `Best run: ${best.won ? 'all ' + M.MIG.FIGHTS + ' fights' : best.survived + ' of ' + M.MIG.FIGHTS + ' fights'} survived, ${fmtT(best.total)} alive.` : 'No migration finished yet.') + (db ? ` Today's daily: ${db.survived} of ${M.MIG.FIGHTS}, ${fmtT(db.total)}.` : '');
}
$('migNew').addEventListener('click', () => startMig(newBoardSeed()));
$('migDaily').addEventListener('click', () => startMig(migDailySeed(todayUTC()), todayUTC()));
$('migResume').addEventListener('click', () => { const r = loadRun(); if (!r || r.over) return; hideNotice(); S.mig = r; S.migKey = null; S.migEntry = null; S.world = null; go('mig'); });

// ---------- init ----------
function renderAll(){ renderBudget(); renderDraft(); renderArenaOpts(); }
window.addEventListener('resize', () => { if (S.screen === 'deploy'){ sizeCanvas($('deployCanvas')); drawDeploy(); } if (S.screen === 'fight') sizeCanvas($('fightCanvas')); });
$('seedLbl').textContent = S.seed;
syncSpeed();
if (!loadHash()){
  dealNewBoard(); renderAll();
  const run = loadRun(); // a migration in progress picks up where it left off after a reload
  if (run && !run.over){ S.mig = run; go('mig'); showNotice(`<b>Migration resumed</b> <span>Fight ${run.k + 1} of ${M.MIG.FIGHTS}, $${run.money.toLocaleString()} to spend.</span>`); }
  else go('arena');
}
requestAnimationFrame(frame);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (S.screen === 'deploy') drawDeploy(); });
})();
