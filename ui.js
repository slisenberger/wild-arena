(function(){
'use strict';
const A = window.Arena;
const M = window.Progressive; // progressive mode's rules (progressive.js)
const $ = id => document.getElementById(id);
// price-tier colors: $100 slate, $200 red, $300 orange, $400 gold, $500+ violet
const tierHex = p => p >= 500 ? '#b48cf2' : p >= 400 ? '#f0b429' : p >= 300 ? '#ec7a2c' : p >= 200 ? '#d8473b' : '#8297aa';
const C = {you:'#4fd1bd', foe:'#ef6b4b', bone:'#d9cfb4', fg:'#ece6d3', muted:'#949d8c', gold:'#f0b429', orange:'#ec7a2c', red:'#d8473b', slate:'#8297aa'};
const BUDGET = A.RULES.budget;
const newBoardSeed = () => (Math.random() * 1e6 | 0) + 1;
const maxStr = Math.max(...A.ANIMALS.map(a => Math.sqrt(A.hpOf(a) * a.dmg / a.cd)));

const S = window.__wa = {
  team: new Set(), boardSeed: newBoardSeed(), board: [], focus:'elephant', terrain:'savanna', mode:'wild', mount:'', pos:{}, youPos:null, seed: (Math.random()*1e6|0) + 1,
  daily:null, shared:null, played:null, screen:'draft', world:null, playT:0, playing:true, speed:2, sel:0, lastTs:0, dur:120,
  prog:null, progKey:null // prog: the active progressive run (null outside the mode)
};

// ---------- helpers ----------
const spent = () => [...S.team].reduce((s, id) => s + A.BY_ID[id].price, 0);
const fmtT = t => { t = Math.max(0, t); const m = Math.floor(t/60), s = Math.floor(t%60); return m + ':' + String(s).padStart(2,'0'); };
const kmh = v => Math.round(v * 3.6);
// 5 in a Row (prototype, Oct 27): hidden unless ?five=1
const FIVE_ON = (() => { try { return /[?&]five=1\b/.test(location.search); } catch(e){ return false; } })();
// Terrain features (prototype, Oct 28, research/map_features.md): hidden unless ?maps2=1. Sets cfg.maps2 on every fight.
const MAPS2_ON = (() => { try { return /[?&]maps2=1\b/.test(location.search); } catch(e){ return false; } })();
const canAdd = a => S.prog ? M.canBuy(S.prog, a.id) : a.price <= BUDGET - spent();
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
// each species' signature move, shown on its card (ROSTER.md has the full kits); pack items use their species' line
const SIGNATURE = {
  elephant: ['Trunk sweep', 'mock charges, then sweeps everything in reach; you ride 3 m up'],
  mammoth: ['Trunk sweep', 'the elephant’s sweep, at home in the snow'],
  triceratops: ['Frill charge', '8 t of horns that can’t steer once it commits'],
  rhino: ['Blind charge', 'a long armored charge that overshoots by 9 m'],
  blackrhino: ['Hothead', 'charges anything that moves, even a sound'],
  hippo: ['Submerged', 'hidden underwater, then bursts out in a charge'],
  buffalo: ['Grudge', 'remembers whoever hurt it for 40 s and hunts them down'],
  bison: ['Spin', 'tail-up mock charge, turns on a dime in the snow'],
  moose: ['Stomp', 'rears and stomps anything small or knocked down'],
  bull: ['Bred to charge', 'never needs provoking; chases whatever moves'],
  boar: ['Upend', 'a low charge that bowls over anything up to 2.5× its weight'],
  giraffe: ['Lookout', 'your side spots threats 50% farther; a lethal kick'],
  ostrich: ['Claw kick', 'a forward kick that rips predators open and knocks them back'],
  gorilla: ['Chest-beat', 'rattles whatever comes for you and turns it onto the gorilla'],
  honeybadger: ['Musk', 'fearless; predators that bite it reel away and leave it alone'],
  polar: ['Snow ghost', 'white on white in the snow; hunts from the water'],
  grizzly: ['Maul', 'a bluff charge, then every third swipe mauls'],
  blackbear: ['Bouncer', 'bluff-charges up to 3× and runs off anything its size'],
  tiger: ['Throat hold', 'stalks, pounces from 9 m, holds prey 4× its size'],
  lion: ['Back leap', 'the fastest sprint; leaps onto big prey busy with someone else'],
  leopard: ['Hidden guard', 'lies unseen beside you and springs on what comes for you'],
  jaguar: ['Water ambush', 'swims in unseen; a bite that ignores half of armor'],
  cougar: ['Nape bite', 'a 12 m pounce; from behind it bites the neck and stuns'],
  wolf: ['Tester', 'nips big herbivores and leads the chase away from you'],
  hyena: ['Bone crack', 'each bite leaves a limp that never wears off'],
  giantkangaroo: ['Kickboxer', 'grabs, then a two-footed kick; holds attackers under water'],
  smilodon: ['Sabre stab', 'pins prey, stabs it, then circles while it bleeds'],
  croc: ['Death roll', 'invisible in water until 7 m; lunges, rolls, drags prey under'],
  muskox: ['Living wall', 'lines up or rings you, horns out, when predators close in'],
  gaur: ['Faces it down', 'walks straight at a stalking cat, which usually slinks off'],
  walrus: ['Tusk stab', 'waits in the icy lake and stabs whatever comes to the edge'],
  woollyrhino: ['Snow plough', 'ploughs a furrow others wade through faster (speculative: from its horn wear)'],
  shortface: ['Kill thief?', 'rears over predators holding prey to make them let go (a hypothesis)'],
  utahraptor: ['Pin', 'leaps onto prey its own size and pins it under its sickle claws'],
};
const sigOf = a => SIGNATURE[a.species || a.id] || null;
// a pick of a pack animal brings its whole group when the rules use groups
const groupOf = a => a.group || 1;
const itemName = a => groupOf(a) > 1 ? `${a.groupName} (${groupOf(a)})` : a.name;
const boardTotal = () => S.board.reduce((t, id) => t + A.BY_ID[id].price, 0);
function dealNewBoard(seed){
  S.daily = null; S.shared = null; S.five = null; hideNotice(); // a fresh board (or a different map) is no longer today's challenge or a shared game
  S.boardSeed = seed || newBoardSeed(); S.board = A.dealBoard(S.boardSeed, {terrain: S.terrain});
  S.team.clear(); S.pos = {}; S.youPos = null; S.mount = ''; S.world = null; S.focus = S.board[0];
}
// ---------- navigation ----------
function go(screen){
  if (S.prog && (screen === 'draft' || screen === 'deploy') && S.prog.over) screen = 'prog'; // a finished run goes to the run screen
  if (!S.prog && screen === 'prog') screen = 'arena';
  if (S.screen === 'draft') S.draftScroll = {board: S.boardSeed, y: window.scrollY}; // coming back to the same board keeps your place
  if (S.prog && (screen === 'draft' || screen === 'deploy' || screen === 'prog')) progSync();
  if (S.screen !== screen){ S.progMsg = ''; S.sellArm = null; if (S.prog && S.screen === 'draft') hideNotice(); } // a run's 'resumed' note has done its job once you leave the shop
  S.screen = screen;
  for (const id of ['arena','draft','deploy','fight','lab','prog']) $('s-' + id).hidden = id !== screen;
  if (screen === 'prog') renderProg();
  $('newSeed').hidden = !!(S.prog || S.five); // a progressive run's or a 5-in-a-row run's fights have fixed seeds
  renderHud(); renderBudget();
  document.querySelectorAll('#steps button[data-s]').forEach(b => b.setAttribute('aria-current', b.dataset.s === screen ? 'true' : 'false'));
  if (screen === 'deploy') { renderMounts(); renderProgForm(); sizeCanvas($('deployCanvas')); drawDeploy(); }
  if (screen === 'draft') { renderBudget(); renderDraft(); }
  if (screen === 'fight') { sizeCanvas($('fightCanvas')); }
  if (screen === 'lab') renderLabDesc();
  window.scrollTo({top: screen === 'draft' && S.draftScroll && S.draftScroll.board === S.boardSeed ? S.draftScroll.y : 0});
  renderActBar();
}
document.querySelectorAll('#steps button[data-s]').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.s === 'fight' && !S.world) { startBattle(); return; }
  go(b.dataset.s);
}));

// ---------- draft ----------
function renderBudget(){
  if (S.prog){ const f = S.screen === 'fight'; $('spent').textContent = f ? '' : '$' + S.prog.money.toLocaleString(); $('meter').innerHTML = ''; $('budgetMax').textContent = f ? 'Progressive' : 'to spend'; return; } // no spoilers during a fight
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
  const five = S.five ? `5 in a Row ${S.five.date}, board ${S.five.k + 1} of 5 (${A.TERRAINS[S.terrain].name})${S.five.pending ? ', your retry' : ''}: win all five boards; one retry per run. Today's maps: ${Array.from({length: 5}, (_, k) => A.TERRAINS[fiveTerrain(S.five.date, k)].name).join(', ')}. ` : '';
  const daily = S.daily ? `Daily challenge ${S.daily} (${A.TERRAINS[S.terrain].name}): the same board, map and fight seed for everyone today. ` : '';
  const R = S.prog;
  $('draftTitle').textContent = R ? `Round ${R.k + 1} of ${M.PROG.ROUNDS} · the shop` : 'Build a team to protect you from the rest';
  for (const id of ['clearTeam', 'newBoard', 'copyDraft', 'copyDraftOut']) $(id).hidden = !!R;
  if (S.five) $('newBoard').hidden = true;
  $('progShop').hidden = !R; if (R) $('progShop').innerHTML = progShopHTML(R); else $('progShop').innerHTML = '';
  $('boardLede').textContent = R ? progLede(R)
    : five + daily + (`This game's board: ${onBoard.length} animals worth $${boardTotal().toLocaleString()}. Spend up to $${BUDGET.toLocaleString()}; every board animal you don't pick ends up on the other side. Tap a card to draft it; the panel below shows the full stat line.`);
  if (draftAlt()) return; // a prototype draft screen (?draftui=…, DRAFT_UIS below) renders instead of the cards
  // the cards are grouped by price, priciest first
  const groups = [...new Set(onBoard.map(a => a.price))].sort((x, y) => y - x).map(p => [p, onBoard.filter(x => x.price === p)]);
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
      const prem = R && a.id === R.premium; if (prem) c.classList.add('cant', 'premium');
      const fit = (prem ? '<span class="bdg bad">Not for sale: it fights you</span>' : '') + (a.rare ? '<span class="bdg good">Rare</span>' : '') + (groupOf(a) > 1 ? `<span class="bdg good">×${groupOf(a)}, hunt together</span>` : '') + badgesHTML(a); if (fit){ const bd = document.createElement('div'); bd.className = 'badges'; bd.innerHTML = fit; c.appendChild(bd); }
      const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = `${a.mass.toLocaleString()} kg · ${kmh(a.spd)} km/h`; c.appendChild(meta);
      const bars = document.createElement('div'); bars.className = 'bars';
      const rows = [['Power', strengthOf(a)/maxStr], ['Armor', a.armor/.6], ['Speed', a.spd/20], ['Stamina', Math.min(1, a.stam/60)]];
      for (const [k,v,col] of rows){ const l = document.createElement('span'); l.textContent = k; const b = document.createElement('div'); b.className = 'bar'; const f = document.createElement('b'); f.style.width = Math.round(Math.min(1,v)*100) + '%'; if (col) f.style.background = col; b.appendChild(f); bars.append(l, b); }
      c.appendChild(bars);
      const sg = sigOf(a); if (sg){ const d = document.createElement('div'); d.className = 'sigline'; d.innerHTML = `<b>${esc(sg[0])}</b> ${esc(sg[1])}`; c.appendChild(d); }
      const rec = recordLine(a.id); if (rec){ const d = document.createElement('div'); d.className = 'recline'; d.textContent = rec; c.appendChild(d); }
      const ck = document.createElement('span'); ck.className = 'check'; ck.textContent = '✓'; c.appendChild(ck);
      c.addEventListener('click', () => {
        S.focus = a.id;
        if (S.prog){ if (picked) M.unbuy(S.prog, a.id); else M.buy(S.prog, a.id); S.progMsg = ''; S.sellArm = null; saveRun(); progSync(); S.world = null; renderAll(); renderHud(); return; }
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
    tl.innerHTML = `<span class="label">The board · against you right now: ${foes.length} animals, $${foes.reduce((t, id) => t + A.BY_ID[id].price, 0).toLocaleString()}${R.premium ? ' (with the premium ' + esc(itemName(A.BY_ID[R.premium])) + ')' : ''}</span>`;
    const btn = $('toDeployD'); btn.disabled = false; btn.textContent = 'Set formation';
    renderDetail(); return;
  }
  if (!S.team.size){ const s = document.createElement('span'); s.className = 'label'; s.textContent = 'No animals drafted yet. You can fight alone, but you will not like it.'; tl.appendChild(s); }
  for (const id of S.team){ const a = A.BY_ID[id]; const ch = document.createElement('span'); ch.className = 'chip'; ch.appendChild(tok(a)); ch.append(itemName(a) + ' $' + a.price); tl.appendChild(ch); }
  const foes = S.board.filter(id => !S.team.has(id));
  const fl = document.createElement('span'); fl.className = 'label'; fl.style.marginLeft = '6px';
  fl.textContent = `Against you: ${foes.length} animals, $${foes.reduce((t, id) => t + A.BY_ID[id].price, 0).toLocaleString()}`; tl.appendChild(fl);
  renderDetail();
}
function renderDetail(){
  const a = A.BY_ID[S.focus]; const d = $('detail');
  const hp = A.hpOf(a);
  const stats = [
    ...([['Price', '$' + a.price + (() => { const own = S.prog && S.prog.team.find(e => e.id === a.id && !e.fresh); return own ? (M.tooHurtToSell(own) ? ' (too hurt to sell)' : ' (sells for $' + M.sellPrice(own) + ')') : ''; })()]]), ['Mass', a.mass.toLocaleString() + ' kg'], ['Top speed', kmh(a.spd) + ' km/h'],
    ['Durability', hp.toLocaleString() + ' hp'], ['Strike', a.dmg + ' / ' + a.cd + ' s'], ['Armor', Math.round(a.armor*100) + '%'],
    ['Reach', a.reach + ' m'], ['Sprint', a.stam + ' s'], ['Breaks at', Math.round(a.flee*100) + '% morale'],
    ['Heat tolerance', a.heat.toFixed(2)], ['Cold tolerance', a.cold.toFixed(2)], ['Strikes up to', a.strikeH + ' m'], ['Carries you at', a.mountH ? a.mountH + ' m' : 'too small'],
  ];
  d.innerHTML = `<div><div style="display:flex;gap:10px;align-items:center;margin-bottom:10px">${tokHTML(a, 64)}<h3 style="font-size:22px">${esc(itemName(a))}</h3></div>${sigOf(a) ? `<p class="sigline" style="margin:-2px 0 8px"><b>${esc(sigOf(a)[0])}</b> ${esc(sigOf(a)[1])}</p>` : ''}${recordDetail(a.id)}${groupOf(a) > 1 ? `<p class="notes" style="margin:-4px 0 8px">One pick brings ${groupOf(a)} of them; they keep each other's nerve and go for the same target. Left on the board, all ${groupOf(a)} come at you.</p>` : ''}
    <div class="stats">${stats.map(([k,v]) => `<div class="stat"><div class="v">${esc(v)}</div><div class="k">${k}</div></div>`).join('')}</div></div>
    <div><div class="styleTag" style="font-size:15px">${esc(a.style)}</div><p style="margin:4px 0 10px">${esc(a.how)}</p>${badgesHTML(a) ? `<div class="badges" style="margin-bottom:10px">${badgesHTML(a)} <span class="notes" style="font-size:12px">in the ${esc(A.TERRAINS[S.terrain].name.toLowerCase())}</span></div>` : ''}<div class="label" style="margin-bottom:6px">Traits</div><ul class="traits">${a.traits.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    <p class="notes" style="margin-top:10px">${a.pred ? 'Predator: hunts by weighing meat against risk, and gets hungrier as the fight goes on.' : 'Herbivore: fights intruders, predators and anything that wounds it.'}</p></div>`;
}
$('toDeployD').addEventListener('click', () => go('deploy'));
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
$('startOver').addEventListener('click', () => { exitProg(); S.seed = newBoardSeed(); $('seedLbl').textContent = S.seed; dealNewBoard(); S.playing = false; renderAll(); go('arena'); });

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
  renderStreak(); renderProgEntry(); renderFiveEntry(); renderStats();
  const td = $('terrainDesc'); if (td) td.textContent = A.TERRAINS[S.terrain].desc; // phones show only the picked map's blurb
}
$('toDraft').addEventListener('click', () => { exitProg(); go('draft'); });
// daily challenge: today's local date picks the map, the board and the fight seed, so everyone plays the same game
// the day is the player's LOCAL date (like Wordle): the same date string gives the same daily everywhere, and it rolls over at
// local midnight. (It used to be the UTC date, so evening play in the Americas counted as the next day and inflated the streak.)
const todayLocal = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
function dateSeed(s){ let h = 2166136261; for (const c of s){ h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) % 1e6 + 1; }
const dailySeed = d => dateSeed('wild-arena:' + d);
const dailyKey = d => 'wa-daily:' + d;
function startDaily(){
  exitProg();
  const d = todayLocal(), h = dailySeed(d), terr = Object.keys(A.TERRAINS);
  S.terrain = terr[h % terr.length]; S.seed = h; $('seedLbl').textContent = S.seed;
  dealNewBoard(h); S.daily = d; renderAll(); go('draft');
}
$('daily').addEventListener('click', () => startDaily());
// ---------- 5 in a Row (prototype; FIVE_ON): five boards in a row, each with its own map, a full-budget draft each;
// a board counts only if you survive to 5:00, one retry (a fresh fight seed, redraft allowed) per run. The local date seeds
// every board, map and fight, so everyone plays the same five. The run is saved, so a reload resumes it.
const FIVE_KEY = 'wa-five-run', fiveBestKey = d => 'wa-five-best:' + d;
const fiveSeed = (d, k, what) => dateSeed(`wild-arena:five:${d}:${k}:${what}`);
function fiveSave(){ try { localStorage.setItem(FIVE_KEY, JSON.stringify(S.five)); } catch(e){} }
function fiveLoad(){ try { const r = JSON.parse(localStorage.getItem(FIVE_KEY) || 'null'); return r && r.date === todayLocal() && Array.isArray(r.res) ? r : null; } catch(e){ return null; } }
function fiveBest(d){ try { return JSON.parse(localStorage.getItem(fiveBestKey(d)) || 'null'); } catch(e){ return null; } }
// load board k of the run (or the same board again for the retry, keeping the team so it can be tweaked)
function fiveBoard(run){
  if (!run.pending){
    const b = fiveSeed(run.date, run.k, 'board'), terr = Object.keys(A.TERRAINS);
    S.terrain = terr[b % terr.length]; dealNewBoard(b);
  }
  S.five = run; S.seed = fiveSeed(run.date, run.k, run.pending ? 'retry' : 'fight'); $('seedLbl').textContent = S.seed; S.world = null;
}
function startFive(){
  exitProg();
  const old = fiveLoad(), run = old && !old.over ? old : {date: todayLocal(), k: 0, retry: 1, pending: false, res: [], over: false};
  fiveBoard(run); fiveSave(); renderAll(); go('draft');
  if (old && !old.over) showNotice(`<b>5 in a Row resumed</b> <span>Board ${run.k + 1} of 5${run.pending ? ' (your retry)' : ''}.</span>`);
}
function fiveApply(w){
  const R = S.five, res = w.result, won = !!res.survived;
  R.res.push({k: R.k, won, score: res.score, retry: !!R.pending, team: [...S.team]});
  if (won){ R.k++; R.pending = false; if (R.k >= 5) R.over = true; }
  else if (R.retry){ R.retry = 0; R.pending = true; }
  else R.over = true;
  if (R.over){
    const wins = R.res.filter(x => x.won).length, time = R.res.reduce((t, x) => t + x.score, 0), b = fiveBest(R.date);
    if (!b || wins > b.wins || (wins === b.wins && time > b.time)){ try { localStorage.setItem(fiveBestKey(R.date), JSON.stringify({wins, time})); } catch(e){} }
    bumpStreak(R.date);
  }
  fiveSave();
}
// 🟩 won first time, 🟨 won on the retry, 🟧 lost with the retry still to come, 🟥 lost, ⬜ not reached
const fivePips = R => Array.from({length: 5}, (_, k) => { const t = R.res.filter(x => x.k === k); return t.some(x => x.won) ? (t.length > 1 ? '🟨' : '🟩') : t.length ? (R.pending && R.k === k && !R.over ? '🟧' : '🟥') : '⬜'; }).join('');
function fiveShare(){ const R = S.five, wins = R.res.filter(x => x.won).length; return `Wild Arena 5 in a Row ${R.date}: ${wins}/5 ${fivePips(R)}`; }
function fiveBanner(res){
  const R = S.five, wins = R.res.filter(x => x.won).length, last = R.res[R.res.length - 1], b = fiveBest(R.date);
  const head = res.survived ? `Board ${last.k + 1} won · ${fmtT(HZ)}` : `Board ${last.k + 1} lost · ${fmtT(res.score)}`;
  let msg, btn;
  if (R.over && wins === 5){ msg = `All five boards. A perfect run${R.retry ? ', without the retry' : ''}.`; btn = 'Back to the arena'; }
  else if (R.over){ msg = `Run over: ${wins} of 5 boards${b ? ` (best today ${b.wins}/5)` : ''}.`; btn = 'Back to the arena'; }
  else if (R.pending){ msg = `You get one retry per run, and this is it: same board, a new fight seed. Redraft if you like.`; btn = 'Retry this board'; }
  else { msg = `${wins} of 5 down${R.retry ? ', retry still in hand' : ', retry used'}.`; btn = `Board ${R.k + 1} of 5`; }
  const share = R.over ? `<div class="btnrow"><button class="btn" id="copyFive">Copy result</button><span class="copyOut" id="copyFiveOut"></span></div>` : '';
  return `<div class="banner ${res.survived ? 'win' : 'lose'}"><span class="big">${head}</span><span class="mono">${fivePips(R)}</span><span>${res.survived ? '' : 'Killed by the ' + esc((A.BY_ID[res.killer] || {}).name || 'unknown') + '. '}${msg}</span><div class="btnrow"><button class="btn primary" id="fiveNext">${btn}</button></div>${share}</div>`;
}
function fiveNext(){
  const R = S.five; if (!R) return;
  if (R.over){ S.five = null; try { localStorage.removeItem(FIVE_KEY); } catch(e){} dealNewBoard(); renderAll(); go('arena'); return; }
  fiveBoard(R); renderAll(); go('draft');
}
$('five').addEventListener('click', startFive);
// today's five maps, shown up front (arena panel) and in the draft text
const fiveTerrain = (d, k) => { const terr = Object.keys(A.TERRAINS); return terr[fiveSeed(d, k, 'board') % terr.length]; };
function fiveMapsHTML(R, d){
  return Array.from({length: 5}, (_, k) => { const t = R ? R.res.filter(x => x.k === k) : [], won = t.some(x => x.won), lost = !won && t.length && (!R.pending || R.k !== k || R.over);
    const cls = won ? 'done' : lost ? 'lost' : R && !R.over && R.k === k ? 'now' : '';
    return `<span class="${cls}">${k + 1} ${esc(A.TERRAINS[fiveTerrain(d, k)].name)}${won ? ' ✓' : ''}</span>`; }).join('');
}
function renderFiveEntry(){
  const panel = $('fivePanel'); panel.hidden = !FIVE_ON; if (!FIVE_ON) return;
  const d = todayLocal(), r = fiveLoad(), live = r && !r.over, b = fiveBest(d);
  $('fiveMaps').innerHTML = fiveMapsHTML(live ? r : null, d);
  $('five').textContent = live ? `Resume (board ${r.k + 1} of 5${r.pending ? ', retry' : ''})` : "Start today's run";
  $('fiveBest').textContent = b ? `Best today: ${b.wins}/5` : '';
}
// daily streak: consecutive local days with at least one daily run (either kind)
function prevDay(d){ const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - 1); return t.toISOString().slice(0, 10); }
function readStreak(){ try { const s = JSON.parse(localStorage.getItem('wa-streak') || 'null'); if (s && typeof s.last === 'string' && s.n >= 1){ const d = todayLocal(); if (s.last > d){ s.last = d; s.n = Math.max(1, s.n - 1); localStorage.setItem('wa-streak', JSON.stringify(s)); } return s; } } catch(e){} return null; } // a UTC-dated entry from the old rule can be a day ahead: count it as today, minus the day it gained
function bumpStreak(day){
  const s = readStreak(); if (s && s.last === day) return;
  const n = s && s.last === prevDay(day) ? s.n + 1 : 1;
  try { localStorage.setItem('wa-streak', JSON.stringify({last: day, n})); } catch(e){}
  renderStreak();
}
function renderStreak(){
  const s = readStreak(), d = todayLocal(), live = s && (s.last === d || s.last === prevDay(d)), el = $('streak');
  el.hidden = !live; el.textContent = live ? `Streak: ${s.n} day${s.n === 1 ? '' : 's'}${s.last === d ? '' : ' (play today to keep it)'}` : '';
}

// ---------- notices and shareable game links ----------
function showNotice(html, warn){ $('noticeText').innerHTML = html; $('notice').className = 'notice' + (warn ? ' warn' : ''); $('notice').hidden = false; }
function hideNotice(){ $('notice').hidden = true; }
$('noticeClose').addEventListener('click', hideNotice);
// #g=1,m:<map>,b:<board seed>,s:<fight seed>,d:<b|p2..p5>[,t:<id+id>,r:<mount|->,p:you=x_y;id=x_y][,sc:<score s>]
// Version first; fields are key:value, so old links with fields missing (or newer links with unknown keys) still load.
const LINK_V = 1;
function currentGame(){ return {terrain:S.terrain, boardSeed:S.boardSeed, seed:S.seed, team:[...S.team], mount:(S.mount && S.team.has(S.mount)) ? S.mount : '', pos:S.pos, you:S.youPos}; }
function gameLink(o, score){
  const f = [LINK_V, 'm:' + o.terrain, 'b:' + o.boardSeed, 's:' + o.seed, 'd:b'];
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
  const g = {v, terrain: kv.m || 'savanna', boardSeed: seedOf(kv.b), seed: seedOf(kv.s)};
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
  S.terrain = g.terrain; // old Pick N links (d:pN) open as budget games
  S.seed = g.seed || newBoardSeed(); $('seedLbl').textContent = S.seed;
  dealNewBoard(g.boardSeed || undefined);
  for (const id of g.team) if (S.board.includes(id) && canAdd(A.BY_ID[id])) S.team.add(id); // drop anything not on this board or over the limit
  const team = [...S.team];
  S.mount = g.mount === null ? bestMount() : (g.mount && S.team.has(g.mount) && A.BY_ID[g.mount].mountH ? g.mount : '');
  for (const id of team) if (g.pos[id]) S.pos[id] = A.clampPlace(S.terrain, A.BY_ID[id], g.pos[id].x, g.pos[id].y, curVar());
  if (g.you) S.youPos = A.clampPlace(S.terrain, A.HUMAN, g.you.x, g.you.y, curVar());
  S.shared = g.score;
  const what = `Same map, board${g.seed ? ' and fight seed' : ''}${team.length ? ', with their team loaded' : ''}.`;
  showNotice(g.score == null ? `<b>Shared game</b> <span>${what}</span>` : g.score >= A.MATCH_T - .05 ? `<b>Shared game: they survived the full ${fmtT(A.MATCH_T)}. Can you?</b> <span>${what}</span>` : `<b>Shared game: can you beat ${fmtT(g.score)}?</b> <span>${what}</span>`);
}
// load a game link from the URL (on start, or pasted into this tab); anything unreadable gets a fresh board and a short note
function loadHash(){
  const g = parseLink(location.hash);
  if (!g) return false;
  exitProg();
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
  foot.addEventListener('click', () => { S.mount = ''; if (S.prog) S.mountPick = S.progKey; S.world = null; renderMounts(); renderProgForm(); drawDeploy(); }); box.appendChild(foot);
  const hpOfPick = id => { const e = S.prog && S.prog.team.find(x => x.id === id); return e ? ' · ' + pctHp(e.hp.reduce((s, x) => s + x, 0) / e.hp.length) : ''; };
  for (const id of team){
    const a = A.BY_ID[id]; if (!a.mountH) continue;
    const b = document.createElement('button'); b.setAttribute('aria-pressed', S.mount === id);
    b.appendChild(tok(a, 30)); b.append(`${a.name} · ${a.mountH} m${hpOfPick(id)}`);
    b.addEventListener('click', () => { S.mount = id; if (S.prog) S.mountPick = S.progKey; S.world = null; renderMounts(); renderProgForm(); drawDeploy(); });
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
  const key = terrain + w + 'x' + h + ':' + V.key + (FX.terrain ? ':t' : '') + ':' + trees.map(t => t.x.toFixed(1)).join(',') + ':' + shade.map(t => t.x.toFixed(1)).join(',');
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
  if (FX.terrain) groundDetail(g, terrain, w, h, sc);
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
    if (FX.terrain) riverReeds(g, B, h, sc);
  }
  if (T.snow){ g.fillStyle = 'rgba(240,245,250,' + (V.snow > 1 ? .14 : V.snow < 1 ? .05 : .09) + ')'; for (let i = 0; i < 70; i++){ const x = R()*w, y = R()*h, rx = sc*(3+R()*9), ry = sc*(1+R()*2.5), a = R()*.6 - .3; if (V.ponds.some(p => Math.hypot((x/sc - p.x) / (p.rx + 6), (y/sc - p.y) / (p.ry + 4)) < 1)) continue; g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, 7); g.fill(); } }
  for (const t of shade){
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.arc(t.x*sc, t.y*sc, t.r*sc, 0, 7); g.fill();
    g.strokeStyle = 'rgba(120,150,70,.55)'; g.lineWidth = Math.max(1, sc*.25); g.setLineDash([sc*.5, sc*.4]); g.beginPath(); g.arc(t.x*sc, t.y*sc, t.r*sc, 0, 7); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#3d4a1f'; g.beginPath(); g.ellipse(t.x*sc, t.y*sc, t.r*.55*sc, t.r*.38*sc, 0, 0, 7); g.fill();
    g.fillStyle = '#4c5c26'; g.beginPath(); g.ellipse((t.x-.3)*sc, (t.y-.3)*sc, t.r*.4*sc, t.r*.26*sc, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(236,230,211,.5)'; g.font = `700 ${Math.max(8, sc*1.1)}px "Big Shoulders Display", sans-serif`; g.textAlign = 'center'; g.fillText('SHADE', t.x*sc, (t.y + t.r + 1.2)*sc); g.textAlign = 'left';
  }
  if (V.pb) drawFeatures(g, terrain, V, w, h, sc); // terrain features (?maps2=1)
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

// terrain features (?maps2=1): the impassable border (thornbush, valley side, undergrowth, scree), then rocks, gullies,
// cut banks, deadfall and moraine, each with a label; painted once into the cached ground canvas
const FEAT_EDGE = {savanna: ['#141308', '#2b2d12', '#3a3c18', 'THORNBUSH'], river: ['#17140c', '#3a2c1a', '#4e3c24', 'STEEP VALLEY SIDE'], forest: ['#070c08', '#0f2414', '#173420', 'DENSE UNDERGROWTH'], tundra: ['#2a3036', '#59626b', '#78828c', 'SCREE']};
function drawFeatures(g, terrain, V, w, h, sc){
  const P = V.pb, E = FEAT_EDGE[terrain], R = A.rng(23);
  g.save();
  g.fillStyle = E[0]; g.beginPath(); g.rect(0, 0, w, h); g.rect(P.x0*sc, P.y0*sc, (P.x1 - P.x0)*sc, (P.y1 - P.y0)*sc); g.fill('evenodd');
  const blob = (x, y) => { const r = (.9 + R()*1.4)*sc; g.fillStyle = R() < .5 ? E[1] : E[2]; g.beginPath(); g.arc(x*sc, y*sc, r, 0, 7); g.fill(); };
  for (let x = 0; x < A.W; x += 1.6){ if (P.y0 > .3) blob(x + R(), P.y0 - .2 - R()*Math.min(P.y0, 1.2)); if (A.H - P.y1 > .3) blob(x + R(), P.y1 + .2 + R()*Math.min(A.H - P.y1, 1.2)); }
  for (let y = P.y0; y < P.y1; y += 1.6){ if (P.x0 > .3) blob(P.x0 - .2 - R()*Math.min(P.x0, 1.2), y + R()); blob(P.x1 + .2 + R()*1.2, y + R()); }
  g.strokeStyle = 'rgba(236,230,211,.35)'; g.lineWidth = Math.max(1, sc*.15); g.setLineDash([sc*.6, sc*.5]); g.strokeRect(P.x0*sc, P.y0*sc, (P.x1 - P.x0)*sc, (P.y1 - P.y0)*sc); g.setLineDash([]);
  g.fillStyle = 'rgba(236,230,211,.45)'; g.font = `700 ${Math.max(7, sc*1)}px "Big Shoulders Display", sans-serif`; g.textAlign = 'center';
  if (A.H - P.y1 > 1.6) g.fillText(E[3], (P.x0 + P.x1) / 2 * sc, (P.y1 + (A.H - P.y1) * .6) * sc + sc*.4);
  const O = V.obst, ditch = o => o.k === 'donga' || o.k === 'ravine', disc = (o, r, col, dx, dy) => { g.fillStyle = col; g.beginPath(); g.arc((o.x + (dx || 0))*sc, (o.y + (dy || 0))*sc, r*sc, 0, 7); g.fill(); };
  // gullies: a pale crumbling rim, then the dark cut; cut banks: an earth wall with a lighter lip
  for (const o of O) if (ditch(o)) disc(o, o.r + .45, terrain === 'forest' ? '#4a3a26' : '#7a6440');
  for (const o of O) if (ditch(o)) disc(o, o.r * .82, '#120d07');
  for (const o of O) if (o.k === 'bank') disc(o, o.r + .25, '#8a6a3e');
  for (const o of O) if (o.k === 'bank') disc(o, o.r * .8, '#4a331c');
  for (const o of O){
    if (o.k === 'kopje' || o.k === 'moraine' || o.k === 'boulder'){ disc(o, o.r + .25, 'rgba(0,0,0,.45)', .5, .6); disc(o, o.r + .12, 'rgba(16,20,24,.7)'); disc(o, o.r, o.k === 'kopje' ? '#857a62' : '#56606a'); disc(o, o.r * .62, o.k === 'kopje' ? '#a3967a' : '#76808a', -o.r * .2, -o.r * .22); if (o.k !== 'kopje') disc(o, o.r * .42, 'rgba(238,244,248,.85)', -o.r * .3, -o.r * .35); }
    else if (o.k === 'mound'){ disc(o, o.r + .2, 'rgba(0,0,0,.4)', .4, .5); disc(o, o.r, '#7c4c2a'); disc(o, o.r * .5, '#a56a3a', -.15, -.2); }
    else if (o.k === 'log'){ disc(o, o.r + .15, 'rgba(0,0,0,.4)', .3, .4); disc(o, o.r, '#5b3d22'); disc(o, o.r * .55, '#6e4c2c', -.1, -.15); }
  }
  g.font = `800 ${Math.max(8, sc*1.15)}px "Big Shoulders Display", sans-serif`; g.fillStyle = 'rgba(236,230,211,.7)';
  for (const f of V.feats || []){ const L = {kopje: 'KOPJE', donga: 'DONGA', ravine: 'RAVINE', bank: 'CUT BANK', moraine: 'MORAINE', log: 'DEADFALL'}[f.k]; if (L && f.k !== 'log') g.fillText(L, f.x*sc, f.y*sc); }
  g.textAlign = 'left'; g.restore();
}
// ground texture (FX.terrain), painted once into the cached ground canvas: grass tufts, leaf litter and dapples, snow drifts
function groundDetail(g, terrain, w, h, sc){
  const R = A.rng(11);
  if (terrain === 'savanna' || terrain === 'river'){
    const cols = terrain === 'savanna' ? ['rgba(168,142,70,.32)', 'rgba(128,116,52,.32)', 'rgba(198,172,98,.24)'] : ['rgba(96,128,64,.34)', 'rgba(74,104,52,.34)', 'rgba(126,150,80,.26)'];
    if (terrain === 'savanna') for (let n = 0; n < 16; n++){ // sun-bleached patches of bare earth
      const x = R()*w, y = R()*h, r = sc*(3 + R()*6), grd = g.createRadialGradient(x, y, 0, x, y, r); grd.addColorStop(0, 'rgba(120,100,58,.2)'); grd.addColorStop(1, 'rgba(120,100,58,0)');
      g.fillStyle = grd; g.beginPath(); g.ellipse(x, y, r * 1.5, r, R()*.6 - .3, 0, 7); g.fill(); }
    g.lineWidth = Math.max(1, sc*.11); g.lineCap = 'round';
    for (let c = 0; c < 3; c++){
      g.strokeStyle = cols[c]; g.beginPath();
      for (let n = 0; n < (terrain === 'savanna' ? 50 : 28); n++){
        const x = R()*w, y = R()*h, nb = 3 + (R()*4 | 0);
        for (let b = 0; b < nb; b++){ const a = -Math.PI/2 + (b - (nb - 1) / 2) * .34 + (R() - .5) * .2, L = sc*(.5 + R()*.7), bx = x + (b - nb / 2) * sc * .09;
          g.moveTo(bx, y); g.quadraticCurveTo(bx + Math.cos(a)*L*.3, y + Math.sin(a)*L*.6, bx + Math.cos(a)*L, y + Math.sin(a)*L); }
      }
      g.stroke();
    }
    g.lineCap = 'butt';
  }
  if (terrain === 'forest'){
    for (let n = 0; n < 60; n++){ // sunlight through the canopy
      const x = R()*w, y = R()*h, r = sc*(1.5 + R()*3.5), grd = g.createRadialGradient(x, y, 0, x, y, r); grd.addColorStop(0, 'rgba(206,214,140,.13)'); grd.addColorStop(1, 'rgba(206,214,140,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    const leaf = ['rgba(98,74,40,.5)', 'rgba(70,86,42,.45)', 'rgba(118,90,46,.4)'];
    for (let n = 0; n < 700; n++){ g.fillStyle = leaf[n % 3]; g.beginPath(); g.ellipse(R()*w, R()*h, sc*(.18 + R()*.18), sc*(.08 + R()*.06), R()*3.2, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(70,52,30,.35)'; g.lineWidth = Math.max(1, sc*.12); g.beginPath(); // fallen twigs
    for (let n = 0; n < 45; n++){ const x = R()*w, y = R()*h, a = R()*3.2, L = sc*(.8 + R()*1.6); g.moveTo(x, y); g.lineTo(x + Math.cos(a)*L, y + Math.sin(a)*L); g.lineTo(x + Math.cos(a)*L*.6 + Math.cos(a + .7)*L*.35, y + Math.sin(a)*L*.6 + Math.sin(a + .7)*L*.35); }
    g.stroke();
  }
  if (terrain === 'tundra'){
    for (let n = 0; n < 14; n++){ // wind-packed drifts: a lit crest and a blue shadow on the lee side
      const x = R()*w, y = R()*h, rx = sc*(4 + R()*8), ry = sc*(.8 + R()*1.4), a = -.22 + (R() - .5)*.15;
      g.fillStyle = 'rgba(110,135,165,.09)'; g.beginPath(); g.ellipse(x, y + ry*.7, rx, ry, a, 0, 7); g.fill();
      g.fillStyle = 'rgba(246,249,252,.09)'; g.beginPath(); g.ellipse(x, y, rx*.95, ry*.8, a, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(240,245,250,.09)'; g.lineWidth = Math.max(1, sc*.1); g.beginPath(); // wind streaks
    for (let n = 0; n < 50; n++){ const x = R()*w, y = R()*h, L = sc*(2 + R()*5); g.moveTo(x, y); g.quadraticCurveTo(x + L*.5, y - L*.16, x + L, y - L*.2); }
    g.stroke();
  }
}
function riverReeds(g, B, h, sc){ // reed beds along both banks, not on the fords
  const R = A.rng(13); g.lineWidth = Math.max(1, sc*.12); g.lineCap = 'round';
  for (let c = 0; c < 2; c++){
    g.strokeStyle = c ? 'rgba(150,160,84,.55)' : 'rgba(92,124,60,.6)'; g.beginPath();
    for (let n = 0; n < 34; n++){
      const side = R() < .5, y = R()*h, x = (side ? B.x0 - .4 - R()*1.2 : B.x1 + .4 + R()*1.2) * sc, lean = side ? -.25 : .25;
      if (B.fords.some(([a, b]) => y >= (a - 1)*sc && y <= (b + 1)*sc)) continue;
      for (let b = 0; b < 5; b++){ const bx = x + (b - 2) * sc*.18, L = sc*(.9 + R()*.9), a = -Math.PI/2 + lean + (b - 2) * .14; g.moveTo(bx, y); g.quadraticCurveTo(bx, y - L*.5, bx + Math.cos(a)*L, y + Math.sin(a)*L); }
    }
    g.stroke();
  }
  g.lineCap = 'butt';
}
// animated but cheap (FX.weather): one pattern fill each, from a small tile made once per scale
const WXC = {};
function wxTile(kind, sc, g){
  const key = kind + sc; if (WXC[key]) return WXC[key];
  const T = Math.max(32, Math.round(sc * (kind === 'snow' ? 16 : 10))), c = document.createElement('canvas'); c.width = c.height = T; const q = c.getContext('2d'), R = A.rng(kind === 'snow' ? 17 : 19);
  if (kind === 'snow'){ for (let n = 0; n < 12; n++){ const r = sc * (.07 + R() * .13); q.fillStyle = `rgba(250,252,255,${.45 + R()*.4})`; q.beginPath(); q.arc(R()*T, R()*T, r, 0, 7); q.fill(); } }
  else { q.strokeStyle = 'rgba(196,232,244,.5)'; q.lineWidth = Math.max(1, sc*.12); q.lineCap = 'round'; for (let n = 0; n < 7; n++){ const x = R()*T, y = R()*T, L = sc*(.8 + R()*1.8); q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x + L*.5, y - sc*.25, x + L, y); q.stroke(); } }
  return (WXC[key] = {T, pat: g.createPattern(c, 'repeat')});
}
function drawWater(g, sc, w, wall){ // a slow shimmer drifting downstream on the river and the ponds
  const B = w.variant && w.variant.band, ponds = w.variant ? w.variant.ponds : null; if (!B && !(ponds && ponds.length)) return;
  const X = wxTile('water', sc, g), off = (wall * .8 * sc) % X.T;
  g.save(); g.globalAlpha = .5 + .22 * Math.sin(wall * 1.6); g.fillStyle = X.pat; g.translate(0, off); g.beginPath();
  if (B) g.rect(B.x0 * sc, -off, (B.x1 - B.x0) * sc, A.H * sc);
  if (ponds) for (const p of ponds){ g.moveTo((p.x + p.rx * .9) * sc, p.y * sc - off); g.ellipse(p.x * sc, p.y * sc - off, p.rx * .9 * sc, p.ry * .9 * sc, 0, 0, 7); }
  g.fill(); g.restore();
}
function drawSnowfall(g, sc, W, H, wall){ // light snow falling across the tundra, over everything
  const X = wxTile('snow', sc, g), ox = (wall * .5 * sc) % X.T, oy = (wall * 1.3 * sc) % X.T;
  g.save(); g.globalAlpha = .7; g.fillStyle = X.pat; g.translate(ox, oy); g.fillRect(-ox, -oy, W, H); g.restore();
}

// ---------- deploy ----------
let deployWorld = null;
// Positions are stored absolute on the map; the sim takes offsets from you.
function youAt(){ return S.youPos || A.homeFor(S.terrain); }
// this game's map variant (waterhole, fords, tree density...): it follows the terrain and the seed
let varMemo = null;
function curVar(){ if (!varMemo || varMemo.tid !== S.terrain || varMemo.seed !== S.seed) varMemo = {tid: S.terrain, seed: S.seed, v: A.mapVariant(S.terrain, S.seed, MAPS2_ON ? {maps2: true} : undefined)}; return varMemo.v; }
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
  if (MAPS2_ON) c.maps2 = true;
  if (S.prog){ const m = M.cfgFor(S.prog); c.startHp = m.startHp; if (m.maxHp) c.maxHp = m.maxHp; if (m.levels) c.levels = m.levels; } // carried wounds, scars and levels (progressive mode only)
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
  if (S.prog){ if (S.prog.over){ go('prog'); return; } progSync(); }
  const w = recordFight(makeCfg()); // = A.simulate(cfg, true), plus timed signature moves for the callouts
  // progressive mode: the result counts the moment the fight is simulated (a reload can't undo it)
  if (S.prog){ S.progWorld = w; S.progEntry = M.applyResult(S.prog, w); if (S.prog.over) recordProgEnd(); saveRun(); }
  if (S.five){ S.fiveWorld = w; fiveApply(w); }
  if (!S.prog) recordStats(w); // personal stats count the fight the moment it's simulated
  $('rematch').hidden = !!(S.prog || S.five);
  const cg = currentGame(); S.played = Object.assign(cg, {pos: Object.assign({}, S.pos), you: S.youPos && Object.assign({}, S.youPos), daily: S.daily}); // what the result banner's link replays
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
// motion cues and callouts (render only). Everything here is derived once per fight from the recorded frames, events
// and timed signature moves (cuesFor), then looked up at time t, so scrubbing backwards and forwards stays exact.
// FX.facing: heading notch; pounceArc: pounce lift + arc + ground shadow; chargeCue: dust + streaks behind a charge;
// sweepArc: the elephant/mammoth front sweep; roll: croc death-roll spin; knockback: ease-out slide; puff: mock-charge
// stop; callouts: signature-move labels (at most 2 on screen); terrain: textured ground; weather: river shimmer and
// falling snow; slowmo: playback dips around a kill (off by default).
Object.assign(FX, {facing: true, pounceArc: true, chargeCue: true, sweepArc: true, roll: true, knockback: true, puff: true, callouts: true, terrain: true, weather: true, slowmo: false});
try { const v = localStorage.getItem('wa-fx-callouts'); if (v != null) FX.callouts = v === '1'; } catch(e){}
{ const b = $('calloutBox'); if (b){ b.checked = FX.callouts; b.addEventListener('change', () => { FX.callouts = b.checked; try { localStorage.setItem('wa-fx-callouts', b.checked ? '1' : '0'); } catch(e){} }); } }
S.FX = FX; S.perf = new Float32Array(240); S.perfN = 0; // canvas time per fight frame (ms), for profiling
// the fight, recorded exactly like A.simulate(cfg, true), plus when each signature move happened (w.sig only counts them)
function recordFight(cfg){
  const w = A.setup(cfg), frames = [A.snapshot(w)], sigEv = [], seen = {};
  let k = 0;
  while (!w.over){
    A.step(w);
    for (const key in w.sig){
      const n = w.sig[key]; if (n === seen[key]) continue; seen[key] = n;
      const c = key.indexOf(':'), sp = key.slice(0, c), name = key.slice(c + 1), i = sigUnit(w, sp, name);
      if (i >= 0) sigEv.push({t: w.t, name, i, x: w.units[i].x, y: w.units[i].y});
    }
    if (++k % 2 === 0 || w.over) frames.push(A.snapshot(w));
  }
  w.frames = frames; w.sigEv = sigEv;
  return w;
}
function sigUnit(w, sp, name){ // which unit of that species just did it: the one in the matching state, else the busiest
  let best = -1, bs = -1;
  for (let i = 0; i < w.units.length; i++){
    const u = w.units[i]; if (u.side === 'H' || u.s.id !== sp) continue;
    let sc = (u.state !== 'dead' ? 1 : 0) + (u.target ? 1 : 0) + (u.mv ? 1 : 0) + (u.latchOn ? 2 : 0);
    if (name === 'encircles' && u.encircling) sc += 5; if (name === 'drags into water' && u.dragging) sc += 5;
    if ((name === 'holds it under' || name === 'death roll') && u.latchOn) sc += 5;
    if (sc > bs){ bs = sc; best = i; }
  }
  return best;
}
const SIGLABEL = {'killing stab':'Killing stab', 'snaps a canine':'Snaps a sabre', 'mock charge':'Mock charge', 'holds it under':'Holds it under',
  'death roll':'Death roll', 'drags into water':'Drags it in', 'encircles':'Encircles', 'stomp':'Stomp', 'maul':'Maul', 'sweep':'Sweep',
  'two-footed kick':'Two-footed kick', 'clinch and kick':'Clinch and kick', 'tree drop':'Drops from the tree', 'skull bite on a croc':'Skull bite',
  'lion killer':'Lion killer', 'grudge hit':'Grudge', 'foot-thump alarm':'Thump alarm', 'lookout spots a threat':'Lookout spots it',
  'charges blind at a sound':'Charges blind', 'chases movement':'Chases movement', 'rider knocked off':'Rider thrown', 'knockback':'Knocked back',
  'twists free':'Twists free', 'lets it bleed':'Lets it bleed', 'tree escape':'Up a tree',
  'forms a ring':'Forms a ring', 'forms a line':'Shoulder to shoulder', 'sortie':'Sortie', 'ring broken':'Ring broken', 'faces down a stalker':'Faces it down', 'tusk stab':'Tusk stab',
  'opens a lane':'Snow furrow', 'makes it let go':'Makes it let go', 'rears over a kill':'Rears up', 'pins it down':'Pins it down'};
const SIGPRI = {'killing stab':3, 'death roll':3, 'holds it under':3, 'maul':2, 'sweep':2, 'mock charge':2, 'stomp':2, 'encircles':2, 'two-footed kick':2, 'snaps a canine':2, 'forms a ring':3, 'forms a line':2, 'faces down a stalker':3, 'tusk stab':2, 'ring broken':2, 'makes it let go':3, 'pins it down':3, 'rears over a kill':2};
const CALLOUT_LIFE = 1.6, CUE_MAX = 2;
function cuesFor(w){
  if (w._cues) return w._cues;
  const F = w.frames, NF = F.length, N = w.units.length, U = w.units;
  const head = new Float32Array(NF * N), seg0 = new Int32Array(NF * N), seg1 = new Int32Array(NF * N);
  for (let i = 0; i < N; i++){
    let h = U[i].side === 'E' ? Math.PI : 0;
    for (let k = 0; k < NF; k++){
      const a = F[k].u[i], b = F[k < NF - 1 ? k + 1 : k].u[i], p = F[k > 0 ? k - 1 : 0].u[i];
      const dx = k < NF - 1 ? b[0] - a[0] : a[0] - p[0], dy = k < NF - 1 ? b[1] - a[1] : a[1] - p[1];
      if (a[7] === 1){
        if (dx * dx + dy * dy > .0144) h = Math.atan2(dy, dx); // moving > .6 m/s: face the way it goes
        else if (a[5] >= 0){ const tg = F[k].u[a[5]]; if (tg && tg[7] === 1 && Math.abs(tg[0] - a[0]) + Math.abs(tg[1] - a[1]) > .1) h = Math.atan2(tg[1] - a[1], tg[0] - a[0]); } // nearly still: face its target
      }
      head[k * N + i] = h;
    }
    let s0 = 0; for (let k = 0; k < NF; k++){ if (k === 0 || F[k].u[i][15] !== F[k - 1].u[i][15]) s0 = k; seg0[k * N + i] = s0; } // runs of one committed move
    let e0 = NF - 1; for (let k = NF - 1; k >= 0; k--){ if (k === NF - 1 || F[k].u[i][15] !== F[k + 1].u[i][15]) e0 = k; seg1[k * N + i] = e0; }
  }
  const nearest = (k, x, y, tag) => { let best = -1, bd = 1e9; const fu = F[k].u; for (let i = 0; i < N; i++){ if (fu[i][7] !== 1 || (tag && !U[i].s.tags.includes(tag))) continue; const d = (fu[i][0] - x) ** 2 + (fu[i][1] - y) ** 2; if (d < bd){ bd = d; best = i; } } return best; };
  const faceTo = (k, i) => { const u = F[k].u[i], tg = u[5] >= 0 ? F[k].u[u[5]] : null; return tg ? Math.atan2(tg[1] - u[1], tg[0] - u[0]) : head[k * N + i]; };
  const fx = [], kills = [];
  for (const e of w.events){
    if (e.kind === 'kill' || e.kind === 'death') kills.push(e.t);
    if (e.x == null) continue;
    const k = clampI(Math.round(e.t / .2), 0, NF - 1);
    if (e.kind === 'sweep'){ const i = nearest(k, e.x, e.y, 'sweep'); if (i >= 0) fx.push({type:'sweep', t:e.t, dur:.5, i, ang:faceTo(k, i), R:U[i].r + U[i].s.reach}); }
    else if (e.kind === 'bluff'){ const i = nearest(k, e.x, e.y); if (i >= 0) fx.push({type:'puff', t:e.t, dur:.8, i, ang:faceTo(k, i), x:e.x, y:e.y, R:U[i].r}); }
    else if (e.kind === 'charge' && /knocking/.test(e.text)){ // the knocked animal slides out over 0.4 s instead of jumping
      const k0 = clampI(Math.floor(e.t / .2 - 1e-6), 0, NF - 1), k1 = Math.min(NF - 1, k0 + 2), i = nearest(Math.min(NF - 1, k0 + 1), e.x, e.y);
      if (i >= 0 && k1 > k0) fx.push({type:'kb', t:F[k0].t, dur:F[k1].t - F[k0].t, i, k0, k1});
    }
  }
  const calls = [], lastLabel = {};
  for (const s of (w.sigEv || [])){
    const k = clampI(Math.round(s.t / .2), 0, NF - 1);
    if (s.name === 'death roll'){ let k1 = k; while (k1 < NF - 1 && F[k1 + 1].u[s.i][6] >= 0 && F[k1 + 1].u[s.i][7] === 1) k1++; fx.push({type:'roll', t:s.t, dur:Math.max(.6, F[k1].t - s.t + .2), i:s.i}); }
    const label = SIGLABEL[s.name]; if (!label) continue;
    // rate limit, decided once so a scrubbed replay shows the same labels: at most CUE_MAX on screen, the same move
    // not again within 5 s, minor moves only when the screen is empty
    let live = 0, used = 0;
    for (let j = calls.length - 1; j >= 0 && calls[j].t > s.t - CALLOUT_LIFE; j--){ live++; used |= 1 << calls[j].slot; }
    if (live >= CUE_MAX || (live && !SIGPRI[s.name]) || (lastLabel[label] != null && s.t - lastLabel[label] < 5)) continue;
    lastLabel[label] = s.t;
    calls.push({t:s.t, i:s.i, x:s.x, y:s.y, label, side:U[s.i].side, slot:(used & 1) ? 1 : 0});
  }
  fx.sort((a, b) => a.t - b.t);
  return (w._cues = {N, NF, head, seg0, seg1, fx, calls, kills, kx:new Float32Array(N), ky:new Float32Array(N), spin:new Float32Array(N), widths:{}});
}
function firstAfter(arr, t){ let lo = 0, hi = arr.length; while (lo < hi){ const m = (lo + hi) >> 1; if (arr[m].t < t) lo = m + 1; else hi = m; } return lo; }
function headingAt(CU, F, i, t){ // interpolated heading between the recorded frames around t
  const k = clampI(Math.floor(t / .2), 0, CU.NF - 1), k1 = Math.min(CU.NF - 1, k + 1), a = CU.head[k * CU.N + i], b = CU.head[k1 * CU.N + i];
  let d = b - a; if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI;
  return a + d * clamp01((t - F[k].t) / .2);
}
// a kill slows playback for ~0.6 s of real time (FX.slowmo, off by default)
const SLOW = .35;
function slowAt(w, t, speed){
  if (!FX.slowmo || REDUCED || !w || !w.frames) return 1;
  const ks = cuesFor(w).kills, win = .6 * speed * SLOW; let lo = 0, hi = ks.length; while (lo < hi){ const m = (lo + hi) >> 1; if (ks[m] <= t) lo = m + 1; else hi = m; }
  return lo > 0 && t - ks[lo - 1] < win ? SLOW : 1;
}
// cue overlays for one frame: per-unit overrides (knockback slide, roll spin) and the ground-level effects under the tokens
function prepCues(g, sc, w, fr, t, CU){
  CU.kx.fill(NaN); CU.spin.fill(0);
  const F = w.frames, fx = CU.fx, DUSTC = DUSTOF[w.T.id] || DUSTOF.savanna;
  for (let n = firstAfter(fx, t - 1.2); n < fx.length && fx[n].t <= t; n++){
    const c = fx[n], p = (t - c.t) / c.dur; if (p < 0 || p >= 1) continue;
    const u = fr.u[c.i];
    if (c.type === 'kb' && FX.knockback){ const a = F[c.k0].u[c.i], b = F[c.k1].u[c.i], e = 1 - (1 - p) * (1 - p) * (1 - p); CU.kx[c.i] = a[0] + (b[0] - a[0]) * e; CU.ky[c.i] = a[1] + (b[1] - a[1]) * e;
      // skid marks behind the slide
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), r = w.units[c.i].r * sc * .5, ox = -Math.sin(ang) * r, oy = Math.cos(ang) * r;
      g.strokeStyle = DUSTC; g.globalAlpha = .45 * (1 - p); g.lineWidth = Math.max(1, sc * .18); g.beginPath();
      g.moveTo(a[0] * sc + ox, a[1] * sc + oy); g.lineTo(CU.kx[c.i] * sc + ox, CU.ky[c.i] * sc + oy); g.moveTo(a[0] * sc - ox, a[1] * sc - oy); g.lineTo(CU.kx[c.i] * sc - ox, CU.ky[c.i] * sc - oy); g.stroke(); g.globalAlpha = 1; }
    else if (c.type === 'roll' && FX.roll && !REDUCED && u[7] === 1){ CU.spin[c.i] = (t - c.t) * 9 * (p < .85 ? 1 : (1 - p) / .15 * .5 + .5); }
    else if (c.type === 'puff' && FX.puff && !REDUCED){ // the mock charge stops short: a little dust kicked up in front
      const q = 1 - p, x = c.x * sc + Math.cos(c.ang) * (c.R + .6) * sc, y = c.y * sc + Math.sin(c.ang) * (c.R + .6) * sc;
      g.fillStyle = DUSTC;
      for (let d = 0; d < 5; d++){ const an = c.ang + (d - 2) * .5, rd = (.4 + p * 2.2) * sc; g.globalAlpha = .38 * q; g.beginPath(); g.arc(x + Math.cos(an) * rd, y + Math.sin(an) * rd, (.5 + p * 1.1) * sc, 0, 7); g.fill(); }
      g.globalAlpha = 1; }
  }
}
function drawSweeps(g, sc, w, fr, t, CU){ // the trunk-and-tusk sweep across the front half, drawn over the tokens
  if (!FX.sweepArc || REDUCED) return; const fx = CU.fx;
  for (let n = firstAfter(fx, t - 1.2); n < fx.length && fx[n].t <= t; n++){
    const c = fx[n]; if (c.type !== 'sweep') continue; const p = (t - c.t) / c.dur; if (p < 0 || p >= 1) continue;
    const u = fr.u[c.i]; if (u[7] !== 1) continue;
    const x = (isNaN(CU.kx[c.i]) ? u[0] : CU.kx[c.i]) * sc, y = (isNaN(CU.kx[c.i]) ? u[1] : CU.ky[c.i]) * sc, R = Math.max(c.R * sc, w.units[c.i].r * sc * 1.1 * 1.45 + 6), e = 1 - (1 - Math.min(1, p * 1.6)) ** 2;
    const a0 = c.ang - 1.3, a1 = a0 + 2.6 * e;
    g.strokeStyle = '#ec7a2c'; g.lineCap = 'round';
    g.globalAlpha = .55 * (1 - p); g.lineWidth = Math.max(3, sc * .9); g.beginPath(); g.arc(x, y, R, a0, a1); g.stroke();
    g.globalAlpha = .22 * (1 - p); g.lineWidth = Math.max(5, sc * 1.6); g.beginPath(); g.arc(x, y, R + Math.max(4, sc * 1.1), Math.max(a0, a1 - .9), a1); g.stroke();
    g.globalAlpha = 1; g.lineCap = 'butt';
  }
}
// signature callouts: a small pill above the animal, rising a little and fading
function drawCallouts(g, sc, w, fr, t, CU){
  if (!FX.callouts) return; const cs = CU.calls, fs = Math.max(11, Math.round(sc * 1.45));
  g.font = `700 ${fs}px Barlow, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let n = firstAfter(cs, t - CALLOUT_LIFE); n < cs.length && cs[n].t <= t; n++){
    const c = cs[n], age = t - c.t; if (age < 0 || age >= CALLOUT_LIFE) continue;
    const u = fr.u[c.i], alive = u[7] === 1, x0 = (alive ? u[0] : c.x) * sc, rr = Math.max(10, w.units[c.i].r * sc * 1.1);
    const a = Math.min(1, age / .15) * Math.min(1, (CALLOUT_LIFE - age) / .5), y0 = (alive ? u[1] : c.y) * sc - rr - Math.max(6, rr * .5) - fs * 1.5 - age * sc * .5 - c.slot * fs * 1.7;
    const key = c.label + fs; let tw = CU.widths[key]; if (tw == null) tw = CU.widths[key] = g.measureText(c.label).width;
    const pw = tw + fs * 1.1, ph = fs * 1.5, x = Math.min(Math.max(x0, pw / 2 + 2), A.W * sc - pw / 2 - 2), y = Math.max(ph / 2 + 2, y0);
    g.globalAlpha = a * .85; g.fillStyle = '#0d110e'; g.beginPath(); g.roundRect ? g.roundRect(x - pw / 2, y - ph / 2, pw, ph, ph / 2) : g.rect(x - pw / 2, y - ph / 2, pw, ph); g.fill();
    g.globalAlpha = a; g.strokeStyle = c.side === 'P' ? C.you : c.side === 'E' ? C.foe : '#fff'; g.lineWidth = Math.max(1.5, sc * .14); g.stroke();
    g.fillStyle = C.fg; g.fillText(c.label, x, y + 1);
  }
  g.globalAlpha = 1; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
}
const DUSTOF = {savanna:'rgb(217,190,140)', river:'rgb(150,128,92)', forest:'rgb(120,105,75)', tundra:'rgb(240,244,250)'};
// pounce: lift along an arc from take-off to landing, with a ground shadow and a faint dashed path
function pounceLift(g, sc, F, CU, i, t){
  const k = clampI(Math.floor(t / .2), 0, CU.NF - 1), s0 = CU.seg0[k * CU.N + i], s1 = CU.seg1[k * CU.N + i];
  const ka = Math.max(0, s0 - 1), kb = Math.min(CU.NF - 1, s1 + 1), ta = F[s0].t - .1, tb = F[kb].t;
  const p = clamp01((t - ta) / Math.max(.2, tb - ta)), A0 = F[ka].u[i], B0 = F[kb].u[i];
  const d = Math.hypot(B0[0] - A0[0], B0[1] - A0[1]), H = Math.min(3.6, .9 + d * .3) * sc;
  if (H > 0 && d > .5){ g.strokeStyle = 'rgba(240,180,41,.6)'; g.lineWidth = Math.max(1.2, sc * .18); g.setLineDash([sc * .5, sc * .45]); g.beginPath(); g.moveTo(A0[0] * sc, A0[1] * sc); g.quadraticCurveTo((A0[0] + B0[0]) / 2 * sc, (A0[1] + B0[1]) / 2 * sc - H * 2, B0[0] * sc, B0[1] * sc); g.stroke(); g.setLineDash([]); }
  return Math.sin(Math.PI * p) * H;
}
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
      if (!['charge','pounce','lunge','dart'].includes(kind) || (kind === 'charge' && FX.chargeCue && !REDUCED) || (kind === 'pounce' && FX.pounceArc && !REDUCED)) return;
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
  const CU = F && F.length ? cuesFor(w) : null;
  if (CU) prepCues(g, sc, w, fr, t, CU);
  if (CU && FX.chargeCue && !REDUCED){ // a charge: light dust behind it and three speed streaks
    g.fillStyle = DUSTOF[w.T.id] || DUSTOF.savanna;
    for (let i = 0; i < fr.u.length; i++){
      const u = fr.u[i]; if (u[7] !== 1 || u[15] !== 'charge') continue; const v = speedOf(i); if (v < 3) continue;
      const hd = headingAt(CU, F, i, t), c = Math.cos(hd), s = Math.sin(hd), r = U[i].r * sc, x = (isNaN(CU.kx[i]) ? u[0] : CU.kx[i]) * sc, y = (isNaN(CU.kx[i]) ? u[1] : CU.ky[i]) * sc;
      for (let j = 1; j <= 4; j++){ const p = prevOf(i, j); if (!p || p[7] !== 1) break; const age = t - F[kf - j].t, jit = (((i * 7 + (kf - j) * 13) % 5) - 2) * .22 * r;
        g.globalAlpha = Math.max(0, .2 - age * .16); g.beginPath(); g.arc(p[0] * sc - s * jit, p[1] * sc + c * jit, r * .5 + age * 1.6 * sc, 0, 7); g.fill(); }
      g.globalAlpha = Math.min(1, v / 10) * .55; g.strokeStyle = C.fg; g.lineWidth = Math.max(1, sc * .13); g.lineCap = 'round'; g.beginPath();
      const L = r * (.7 + Math.min(1.1, v / 12));
      for (let m = -1; m <= 1; m++){ const k = m ? .75 : 1, bx = x - c * r * (1.3 + (m ? 0 : .15)) - s * m * r * .55, by = y - s * r * (1.3 + (m ? 0 : .15)) + c * m * r * .55; g.moveTo(bx, by); g.lineTo(bx - c * L * k, by - s * L * k); }
      g.stroke(); g.globalAlpha = 1; g.lineCap = 'butt';
    }
  }
  // draw order: big first, riders last
  const order = fr.u.map((u, i) => i).sort((a, b) => (fr.u[a][9] - fr.u[b][9]) || (U[b].s.mass - U[a].s.mass));
  for (const i of order){
    const u = fr.u[i]; if (u[7] !== 1) continue;
    const unit = U[i]; const s = unit.s; const isH = unit.side === 'H';
    let x = u[0]*sc, y = u[1]*sc; const rr0 = Math.max(isH ? 8 : 10, unit.r * sc * 1.1) * (u[9] > 0 && isH ? .85 : 1);
    if (CU && !isNaN(CU.kx[i])){ x = CU.kx[i] * sc; y = CU.ky[i] * sc; } // knocked back: an ease-out slide
    if (CU && FX.pounceArc && !REDUCED && u[15] === 'pounce'){ // in the air: shadow stays on the ground, the token rises along the arc
      const lift = pounceLift(g, sc, F, CU, i, t);
      if (lift > .5){ const k = 1 - Math.min(.4, lift / (sc * 7)); g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(x, y + rr0 * .2, rr0 * k, rr0 * .5 * k, 0, 0, 7); g.fill(); y -= lift; }
    }
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
    if (im && im.complete && im.naturalWidth){ g.save(); g.beginPath(); g.arc(0, 0, rr, 0, 7); g.clip(); g.globalAlpha = u[4] === 'flee' ? .55 : u[15] === 'stalk' ? .6 : 1; if (CU && CU.spin[i]) g.rotate(CU.spin[i]); g.drawImage(im, -rr, -rr, rr*2, rr*2); g.restore(); }
    if (flash){ g.fillStyle = `rgba(255,70,45,${.55 * flash})`; g.beginPath(); g.arc(0, 0, rr, 0, 7); g.fill(); }
    // tier ring
    g.lineWidth = Math.max(2.5, rr*.22);
    g.strokeStyle = isH ? '#ffffff' : unit.side === 'P' ? C.you : C.foe;
    if (u[4] === 'flee') g.setLineDash([3, 3]);
    g.beginPath(); g.arc(0, 0, rr, 0, 7); g.stroke(); g.setLineDash([]);
    if (FX.facing && !(isH && u[9] > 0)){ // heading notch: which way it's going (or facing its target when still)
      const hd = CU ? headingAt(CU, F, i, t) + (CU.spin[i] || 0) : (unit.side === 'E' ? Math.PI : 0), R1 = rr * 1.4 + 5, R0 = rr * .9, wa = .34;
      g.fillStyle = isH ? '#ffffff' : unit.side === 'P' ? C.you : C.foe; g.beginPath(); g.moveTo(Math.cos(hd) * R1, Math.sin(hd) * R1); g.lineTo(Math.cos(hd + wa) * R0, Math.sin(hd + wa) * R0); g.lineTo(Math.cos(hd - wa) * R0, Math.sin(hd - wa) * R0); g.closePath(); g.fill();
    }
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
  if (CU) drawSweeps(g, sc, w, fr, t, CU);
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
      if (FX.callouts && CU && (e.kind === 'maul' || e.kind === 'sweep' || e.kind === 'bluff')) continue; // a callout names these
      const short = ({kill:'DOWN', death:'KILLED', charge:'CHARGE', latch:'GRAB', flee:'BREAKS', heat:'OVERHEAT', feed:'FEEDING', corner:'CORNERED', ambush:'AMBUSH', pounce:'POUNCE', lunge:'LUNGE', maul:'MAUL', sweep:'SWEEP', gate:'GATE', crash:'CRASH', flank:'FLANK', feud:'RIVALRY', rout:'ROUTED', danger:'!', bluff:'BLUFF', win:''})[e.kind];
      if (!short) continue;
      g.globalAlpha = 1 - age / 1.8; g.fillStyle = KINDCOL[e.kind];
      g.font = `900 ${Math.max(11, sc*1.9)}px "Big Shoulders Display", sans-serif`; g.textAlign = 'center';
      g.fillText(short, e.x*sc, e.y*sc - sc*4 - age*sc*1.5 - slot*Math.max(13, sc*2.2));
      g.globalAlpha = 1; g.textAlign = 'left';
    }
  }
  if (CU) drawCallouts(g, sc, w, fr, t, CU);
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
  const wall = REDUCED ? 0 : performance.now() / 1000;
  if (FX.weather) drawWater(g, sc, w, wall);
  drawHazard(g, sc, w, S.playT);
  if (w.furrowAll) drawFurrows(g, sc, w.furrowAll, S.playT);
  const fr = frameAt(S.playT);
  drawUnits(g, sc, w, fr, w.events, S.playT, {});
  if (FX.weather && w.T.id === 'tundra') drawSnowfall(g, sc, cv.width, cv.height, wall);
  g.setTransform(1, 0, 0, 1, 0, 0);
}
// a woolly rhino's furrow through the snow: a pale trampled trail that fades over its 12 s (sim.js FURROW.life)
function drawFurrows(g, sc, pts, t){
  g.save(); g.lineCap = 'round';
  for (const p of pts){ const age = t - p.t; if (age < 0) continue;
    const k = 1 - age / 12; if (k <= 0) continue;
    g.fillStyle = `rgba(232,240,248,${(.42 * k).toFixed(3)})`; g.beginPath(); g.arc(p.x * sc, p.y * sc, sc * 1.2, 0, 7); g.fill(); }
  g.restore();
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
$('banner').addEventListener('click', e => { if (e.target.id === 'progContinue'){ if (S.prog && !S.prog.over){ S.progRecapOpen = S.prog.log.length; go('draft'); } else go('prog'); return; } if (e.target.id === 'fiveNext'){ fiveNext(); return; } if (e.target.id === 'copyFive'){ copyLink(fiveShare(), $('copyFiveOut'), 'Result'); return; } if (e.target.id === 'copyResult' && S.world && S.played) copyLink(gameLink(S.played, S.world.result.score), $('copyResultOut')); });
$('log').addEventListener('click', e => { const d = e.target.closest('[data-t]'); if (d){ S.playT = Math.max(0, +d.dataset.t - 1.5); S.playing = false; } });

const HZ = A.MATCH_T;
function bestKey(){ return 'wa-best:' + [S.terrain, S.mode, S.board.join('+'), [...S.team].sort().join('+'), S.mount || 'foot'].join('|'); }
function readBest(){ try { return +localStorage.getItem(bestKey()) || 0; } catch(e){ return 0; } }
function writeBest(v){ try { localStorage.setItem(bestKey(), String(v)); } catch(e){} }
function renderReport(show){
  const w = S.world; if (!w || !show) return;
  const res = w.result; const sum = A.summarize(w);
  const b = $('banner');
  if (S.prog && S.progEntry && S.progWorld === w){ b.innerHTML = progBanner(S.progEntry, res); renderTeamReport(w, sum); return; }
  if (S.five && S.fiveWorld === w){ b.innerHTML = fiveBanner(res); renderTeamReport(w, sum); return; }
  const score = res.score, prev = readBest(), isBest = score > prev + .05;
  if (isBest) writeBest(score);
  let dailyLine = '';
  const P = S.played || {};
  if (P.daily && P.seed === dailySeed(P.daily)){
    const k = dailyKey(P.daily), nm = 'Daily'; let db = 0; try { db = +localStorage.getItem(k) || 0; } catch(e){}
    if (score > db + .05){ try { localStorage.setItem(k, String(score)); } catch(e){} }
    bumpStreak(P.daily);
    const team = P.team.map(id => A.BY_ID[id].abbr).join('+') || 'no animals';
    dailyLine = ` ${nm} ${P.daily}: ${score > db + .05 ? 'your best today' : 'best today ' + fmtT(db)} · share: “Wild Arena ${nm.toLowerCase()} ${P.daily}: ${fmtT(score)}${res.survived && res.why === 'cleared' ? ', cleared the board at ' + fmtT(res.t) : ''} with ${team} ($${spent().toLocaleString()})”.`;
  }
  const draftWord = 'this draft';
  const bestLine = isBest ? (prev ? `New best for ${draftWord} here (was ${fmtT(prev)}).` : `First run of ${draftWord} here.`) : `Best for ${draftWord} here: ${fmtT(prev)}.`;
  const sharedLine = S.shared != null ? ` Shared score to beat: ${fmtT(S.shared)}${score > S.shared + .05 ? ', and you beat it.' : score >= S.shared - .05 ? ', and you matched it.' : '.'}` : '';
  const shareRow = `<div class="btnrow"><button class="btn primary" id="playAgain" title="${S.daily ? 'Same team, same daily fight' : 'Same board and team, a new fight seed'}">Play again</button><button class="btn" id="playTeam">Change team</button><button class="btn" id="playNew">New board</button><button class="btn" id="copyResult">Copy link</button><span class="copyOut" id="copyResultOut"></span></div>`;
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
    if (S.lastTs && S.playing){ S.playT = Math.min(S.dur, S.playT + (ts - S.lastTs) / 1000 * S.speed * slowAt(S.world, S.playT, S.speed)); if (S.playT >= S.dur) S.playing = false; }
    const t0 = performance.now(); drawFight(); S.perf[S.perfN++ % S.perf.length] = performance.now() - t0; renderSide();
    renderActBar();
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
    const w = A.simulate({board:S.board, team, terrain, mode:S.mode, mount:bestMount(team) || null, seed: 5000 + i, maps2: MAPS2_ON});
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

// ---------- progressive mode (a 7-round run up a price ladder; rules in progressive.js) ----------
// prototype (Oct 27): replaces the switched-off Migration mode; hidden unless ?progressive=1 until the owner has played it
const PROG_ON = (() => { try { return /[?&]progressive=1\b/.test(location.search); } catch(e){ return false; } })();
{ const p = document.querySelector('.progentry'); if (p && !PROG_ON){ p.hidden = true; p.style.display = 'none'; } }
const PROG_KEY = 'wa-prog', PROG_BEST = 'wa-prog-best', progDailyKey = d => 'wa-prog-daily:' + d;
const progDailySeed = d => dateSeed('wild-arena:progressive:' + d);
const RN = M.PROG.ROUNDS;
function readJSON(k){ try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch(e){ return null; } }
function writeJSON(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
// a saved run is only trusted if everything in it still exists in this version
function loadRun(){
  const r = readJSON(PROG_KEY), ok = id => Object.prototype.hasOwnProperty.call(A.BY_ID, id);
  if (!r || r.v !== 1 || r.mode !== 'progressive' || !Array.isArray(r.team) || !Array.isArray(r.board) || !Array.isArray(r.log) || typeof r.pre !== 'string') return null;
  if (!r.board.every(ok) || (r.premium && !ok(r.premium)) || !r.team.every(e => e && ok(e.id) && Array.isArray(e.hp) && Array.isArray(e.scar)) || !A.TERRAINS[r.terrain]) return null;
  return r;
}
function saveRun(){ if (S.prog) writeJSON(PROG_KEY, S.prog); }
// point the shared game state (board, team, map, fight seed) at the run's coming fight; the premium enemy sits on the board
function progSync(){
  const r = S.prog; if (!r) return;
  const key = r.seed + ':' + r.k;
  S.daily = null; S.shared = null;
  S.terrain = r.terrain; S.board = A.ANIMALS.map(a => a.id).filter(id => r.board.includes(id) || id === r.premium); S.boardSeed = r.boardSeed; S.seed = r.fightSeed; $('seedLbl').textContent = S.seed;
  S.team = new Set(M.teamIds(r));
  if (S.progKey !== key){ S.progKey = key; S.pos = {}; S.youPos = null; } // a new round: fresh formation on the new map (a retry keeps yours)
  for (const id in S.pos) if (!S.team.has(id)) delete S.pos[id];
  // the mount follows the team (carried survivors and this visit's buys: ride your elephant) until you pick one on the formation page this round
  if (S.mountPick !== key || (S.mount && !S.team.has(S.mount))){ S.mount = bestMount(); if (S.mountPick === key && !S.team.has(S.mount)) S.mountPick = null; }
  if (!S.board.includes(S.focus) && !S.team.has(S.focus)) S.focus = r.board[0] || M.teamIds(r)[0] || 'honeybadger';
}
function startProg(seed, daily){
  hideNotice(); S.prog = M.newRun(seed, daily || null); S.progKey = null; S.progEntry = null; S.world = null; S.progHowOpen = false; S.progMsg = ''; saveRun(); go('draft'); // straight into round 1's shop (the run overview is one tap away)
}
// leave the mode (the run stays saved, to resume from the arena screen); the normal game gets a fresh board
function exitProg(){ if (!S.prog) return; S.prog = null; S.progKey = null; S.progEntry = null; S.world = null; dealNewBoard(); renderHud(); }
function recordProgEnd(){
  const r = S.prog, cur = {won: r.won, total: +r.total.toFixed(1), complete: r.complete, daily: r.daily};
  const best = readJSON(PROG_BEST); r.prevBest = best; r.newBest = M.better(cur, best); if (r.newBest) writeJSON(PROG_BEST, cur);
  if (r.daily){ const db = readJSON(progDailyKey(r.daily)); r.prevDaily = db; r.newDaily = M.better(cur, db); if (r.newDaily) writeJSON(progDailyKey(r.daily), cur); bumpStreak(r.daily); }
}
const hpCol = f => f > .5 ? '#d5f2cf' : f > .25 ? C.gold : C.red;
const hpBar = f => `<i title="${Math.round(f * 100)}%"><b style="width:${Math.round(clamp01(f) * 100)}%;background:${hpCol(f)}"></b></i>`;
const pctHp = f => Math.round(f * 100) + '%';
const stars = lv => `<span class="stars" title="${M.LEVEL_NAME[lv]}" aria-label="level ${lv}">${'★'.repeat(lv)}<span class="off">${'★'.repeat(3 - lv)}</span></span>`;
const money = n => '$' + n.toLocaleString();
// what each level does, in plain words (sim.js LEVEL_FX; the levels stack)
const LV_FX = ['no experience bonus yet', 'holds its nerve longer; a fallen packmate shakes it less', 'spots threats 15% farther', '+10% damage and +10% health'];
function xpHowHTML(){
  const X = M.PROG.XP, L = M.PROG.LEVELS;
  return `<p class="notes"><b>Earning XP:</b> 1 XP per ${X.dmg} damage it deals (double against anything that's attacking you), ${X.kill} per kill, ${X.survive} for surviving the fight, ${X.sig} each time its signature move lands (up to ${X.sigMax} a fight) and ${X.mvp} for the fight's MVP. A pack or herd shares one pool.</p>`
    + `<p class="notes"><b>Levels</b> (they stack): ★ Seasoned at ${L[0]} XP: ${LV_FX[1]}. ★★ Cunning at ${L[1]}: ${LV_FX[2]}. ★★★ Veteran at ${L[2]}: ${LV_FX[3]}. Experience, not superpowers: a Veteran is roughly 8% more useful than a Rookie.</p>`;
}
// XP toward the next level (a full bar at Veteran), and what the next level brings
function xpInfo(e){
  const L = M.PROG.LEVELS, lo = e.lv ? L[e.lv - 1] : 0, hi = L[e.lv];
  return hi == null ? {f: 1, txt: `${e.xp} XP · top level`} : {f: (e.xp - lo) / (hi - lo), txt: `${e.xp}/${hi} XP → ${M.LEVEL_NAME[e.lv + 1]}: ${LV_FX[e.lv + 1]}`};
}
const lvNow = e => e.lv ? `<b>${M.LEVEL_NAME[e.lv]}:</b> ${LV_FX.slice(1, e.lv + 1).join('; ')}.` : `<b>Rookie:</b> ${LV_FX[0]}.`;
const retriesLeft = r => Math.max(0, M.PROG.RETRIES - r.losses);
const avgOf = a => a.reduce((s, x) => s + x, 0) / a.length;
// health: one bar + % per member (packs and herds), a flag for wounded ones, and what the free rest did after the last fight
function healthHTML(e){
  const g = M.groupOf(e.id), hurt = M.needsHeal(e), low = Math.min(...e.hp);
  const members = e.hp.map(f => `<span class="hpm">${hpBar(f)}<span class="pc">${pctHp(f)}</span></span>`).join('');
  const lost = g > 1 && e.hp.length < g ? `<span>${g - e.hp.length} of ${g} lost</span>` : '';
  const flag = e.fresh ? '' : !hurt ? '<span class="flag ok">Full health</span>' : low < .35 ? '<span class="flag bad">Badly hurt</span>' : '<span class="flag hurt">Wounded</span>';
  return `<div class="hpb">${members}${lost}${flag}</div>`;
}
function restHTML(e){
  if (e.fresh || !Array.isArray(e.was) || !e.was.length || e.was.length !== e.hp.length) return '';
  const was = avgOf(e.was), rested = Math.min(1, was + (1 - was) * M.PROG.REST);
  if (was > .995) return '';
  return `<div class="rest">Came out of the last fight at ${pctHp(was)}; the free rest healed it to ${pctHp(rested)}${avgOf(e.hp) > rested + .005 ? ', then you healed it to ' + pctHp(avgOf(e.hp)) : ''}.</div>`;
}
// one team card: shop (heal / sell / return), view (run screen) or compact
function mtHTML(r, e, mode){
  const a = A.BY_ID[e.id], g = M.groupOf(e.id), nm = g > 1 ? `${a.groupName} (${e.hp.length} of ${g})` : a.name, scars = e.scar.reduce((s, n) => s + n, 0);
  if (mode === 'shop' && e.fresh) // bought this visit: a compact line with a full refund
    return `<div class="mt small fresh">${tokHTML(a, 30)}<div class="mtb"><div class="nm">${esc(nm)} <span class="label" style="color:var(--you)">new · $${a.price}</span></div></div><div class="mta"><button class="btn" data-unbuy="${a.id}" title="Changed your mind: give it back for the full $${a.price}">Return · +$${a.price}</button></div></div>`;
  const x = xpInfo(e);
  let act = '';
  if (mode === 'shop'){
    if (M.needsHeal(e)){
      const c = M.healCost(e), ok = M.canHeal(r, e.id);
      act += `<button class="btn" data-heal="${a.id}" ${ok ? '' : 'disabled'} title="Pays to bring every member back to full health. Cost: ${Math.round(M.PROG.HEAL_RATE * 100)}% of its $${a.price} price × the ${pctHp(M.missing(e))} of health it's missing.">Heal to 100% · $${c}${ok ? '' : ` (need $${c - r.money} more)`}</button>`;
    }
    if (M.tooHurtToSell(e)) act += `<button class="btn" disabled title="Below ${M.PROG.SELL_MIN * 100}% health nobody will buy it: heal it or keep it">Can't sell: under ${M.PROG.SELL_MIN * 100}% health</button>`;
    else { const sp = M.sellPrice(e), armed = S.sellArm === e.id;
      act += `<button class="btn${armed ? ' arm' : ''}" data-sell="${a.id}" data-armed="${armed ? 1 : 0}" title="Half its $${a.price} price × its health (${pctHp(Math.min(1, M.condition(e)))}). Its XP and level go with it.">${armed ? `Tap again to sell · +$${sp}` : `Sell · +$${sp}`}</button>`; }
  }
  const sub = [e.kills ? `${e.kills} kill${e.kills > 1 ? 's' : ''}` : '', scars ? `<span class="scar">${scars} scar${scars > 1 ? 's' : ''}: −${Math.round(M.PROG.SCAR * 100 * scars)}% max health for the run</span>` : ''].filter(Boolean).join(' · ');
  return `<div class="mt${e.fresh ? ' fresh' : ''}">${tokHTML(a, 34)}<div class="mtb"><div class="nm">${esc(nm)} ${stars(e.lv)}${e.fresh ? ' <span class="label" style="color:var(--you)">new</span>' : ''}</div>`
    + healthHTML(e) + restHTML(e)
    + `<div class="lvnow">${lvNow(e)}</div><div class="xpb"><i><b style="width:${Math.round(clamp01(x.f) * 100)}%"></b></i><span>${esc(x.txt)}</span></div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${act ? `<div class="mta">${act}</div>` : ''}</div>`;
}
function progTeamHTML(r, mode){
  mode = mode === true ? 'shop' : mode || 'view';
  const team = mode === 'shop' ? r.team.filter(e => !e.fresh).concat(r.team.filter(e => e.fresh)) : r.team;
  let h = '<div class="progteam">' + team.map(e => mtHTML(r, e, mode)).join('');
  if (!r.team.length) h += `<span class="label" style="align-self:center">${r.over ? 'None of your animals made it.' : 'No animals with you yet: tap a card below to buy one.'}</span>`;
  return h + '</div>';
}
const healAllCost = r => r.team.filter(e => !e.fresh && M.needsHeal(e)).reduce((s, e) => s + M.healCost(e), 0);
// the shop's round panel: what you need for the decision, in one place (round, map, money, retries, premium enemy, recap), then your team
function progShopHTML(r){
  const cap = M.PROG.CAP[r.k], tot = r.board.reduce((s, id) => s + A.BY_ID[id].price, 0), p = r.premium && A.BY_ID[r.premium];
  // round, map, money and retries sit in the run bar above; here: the board's tier, the premium enemy, the retry
  const chips = [`<span>${cap ? `Animals up to $${cap}` : 'Any animal'} · ${r.board.length} on the board, ${money(tot)}</span>`];
  if (r.attempt) chips.unshift(`<span>Retry ${r.attempt} of ${M.PROG.RETRIES}: a new fight</span>`);
  if (r.k === RN - 1) chips.push('<span>Last round: a giant is for sale</span>');
  if (p) chips.push(`<span class="prem" title="Premium enemy: not for sale, it joins the other side">${tokHTML(p, 24)}<b>Premium enemy:</b> ${esc(itemName(p))} ($${p.price})</span>`);
  const last = r.log[r.log.length - 1], recapOpen = S.progRecapOpen === r.log.length;
  const recap = last ? `<details class="recapbox" data-k="recap"${recapOpen ? ' open' : ''}><summary>Last fight: round ${last.k + 1} ${last.survived ? 'won' : 'lost'} · ${fmtT(last.t)}</summary><div class="recap">${recapHTML(r, last, true)}</div></details>` : '';
  const intro = r.k === 0 && !r.attempt && !r.log.length ? `<details class="howrun" data-k="how"${S.progHowOpen ? ' open' : ''}><summary>How a run works</summary><p class="notes">Seven rounds, each board a little richer: round 1 is all $100 animals, the giants come at the end. Whatever you don't buy fights you. Your survivors stay with you, wounds and all; they earn XP and level up. Each new round brings fresh money (+$${M.PROG.TOPUP[1]} or more, plus $${M.PROG.PER_KILL} a kill). Lose a round and you refight it from this shop; you get ${M.PROG.RETRIES} retries in the whole run.</p></details>` : '';
  const carried = r.team.filter(e => !e.fresh), hurt = carried.filter(M.needsHeal), all = healAllCost(r);
  const healAll = hurt.length >= 2 ? `<button class="btn" id="progHealAll" ${all <= r.money ? '' : 'disabled'} title="Heal every wounded animal to 100%">Heal all ${hurt.length} wounded · $${all}${all <= r.money ? '' : ` (need $${all - r.money} more)`}</button>` : '';
  const sum = carried.length ? `${carried.length} survivor${carried.length > 1 ? 's' : ''}${hurt.length ? `, ${hurt.length} wounded` : ', all at full health'}. Rest heals ${M.PROG.REST * 100}% of a wound for free after each won fight; healing pays for the rest. Selling pays half the price × health; under ${M.PROG.SELL_MIN * 100}% nobody buys.` : '';
  const noTeamPanel = !r.team.some(e => !e.fresh) && DUI.on && DUI.ui === 'versus'; // Versus shows your side itself: no empty panel above it
  return `<div class="panel"><div class="roundchips">${chips.join('')}</div>${recap}${intro}</div>`
    + (noTeamPanel ? '' : `<div class="panel"><div class="teamhead"><h3>Your team</h3>${healAll}</div>${sum ? `<p class="notes" style="margin-bottom:8px">${sum}</p>` : ''}<div class="progmsg" id="progMsg" role="status">${S.progMsg || ''}</div>${progTeamHTML(r, 'shop')}`
    + `<details class="xphow" data-k="xp"${S.progXpOpen ? ' open' : ''}><summary>How XP and levels work</summary>${xpHowHTML()}</details></div>`);
}
function progLede(r){
  const p = r.premium && A.BY_ID[r.premium];
  return `Tap a card to buy it; whatever you don't buy is against you${p ? `, plus the premium ${itemName(p)}` : ''}. Then set your formation (or fight straight away).`;
}
function progSay(msg){ S.progMsg = msg; }
// the shop's team buttons: return a buy, heal (one or all), sell (tap twice)
function progShopClick(e){
  const b = e.target.closest('button'); if (!b || !S.prog || b.disabled) return;
  const r = S.prog, nm = id => itemName(A.BY_ID[id]), entry = id => r.team.find(x => x.id === id);
  if (b.dataset.sell){
    const id = b.dataset.sell;
    if (S.sellArm !== id){ S.sellArm = id; progSay(''); renderDraft(); return; } // two taps: selling loses its XP and level
    const x = entry(id), sp = M.sellPrice(x), c = M.condition(x);
    if (!M.sell(r, id)) return; progSay(`Sold the ${esc(nm(id))} for $${sp} (at ${pctHp(Math.min(1, c))} health). ${money(r.money)} to spend.`);
  } else if (b.dataset.unbuy){ const id = b.dataset.unbuy; if (!M.unbuy(r, id)) return; progSay(`Returned the ${esc(nm(id))}: +$${A.BY_ID[id].price} back.`); }
  else if (b.dataset.heal){
    const id = b.dataset.heal, x = entry(id), before = x.hp.map(pctHp).join(', '), c = M.healCost(x);
    if (!M.heal(r, id)) return; progSay(`Healed the ${esc(nm(id))} from ${before} to 100% for $${c}. ${money(r.money)} left.`);
  } else if (b.id === 'progHealAll'){
    const hurt = r.team.filter(x => !x.fresh && M.needsHeal(x)), c = healAllCost(r); if (c > r.money) return;
    for (const x of hurt) M.heal(r, x.id); progSay(`Healed ${hurt.map(x => 'the ' + esc(nm(x.id))).join(', ')} to 100% for $${c}. ${money(r.money)} left.`);
  } else return;
  S.sellArm = null; saveRun(); progSync(); S.world = null; renderAll(); renderHud();
}
$('progShop').addEventListener('click', progShopClick);
$('progShop').addEventListener('toggle', e => { const k = e.target.dataset && e.target.dataset.k; if (k === 'recap') S.progRecapOpen = e.target.open ? S.prog.log.length : -1; else if (k === 'how') S.progHowOpen = e.target.open; else if (k === 'xp') S.progXpOpen = e.target.open; }, true);
// the formation step in a run: who's with you (health, level) and who's against you; the fight starts from here
function renderProgForm(){
  const el = $('progForm'), r = S.prog; el.hidden = !r; if (!r) return;
  const foes = S.board.filter(id => !S.team.has(id)), p = r.premium && A.BY_ID[r.premium];
  const mine = r.team.map(e => { const a = A.BY_ID[e.id]; return `<span class="chip">${tokHTML(a, 24)}${esc(M.groupOf(e.id) > 1 ? `${a.groupName} (${e.hp.length} of ${M.groupOf(e.id)})` : a.name)} · ${pctHp(avgOf(e.hp))}${e.lv ? ' ' + '★'.repeat(e.lv) : ''}</span>`; }).join('');
  el.innerHTML = `<div class="label">Round ${r.k + 1} · ${esc(A.TERRAINS[r.terrain].name)} · your team</div><div class="teamline">${mine || '<span class="label">Just you.</span>'}</div>`
    + `<p class="notes">Against you: ${foes.length} animals worth ${money(foes.reduce((t, id) => t + A.BY_ID[id].price, 0))}${p ? `, including the premium ${esc(itemName(p))}` : ''}. Auto formation is already set${S.mount ? ` and you ride the ${esc(A.BY_ID[S.mount].name)}` : ''}: tap Fight, or drag anyone first.</p>`;
}
// the run HUD: round k/7, money, retries, team, and a way to the run overview or out
let abandonTimer = null;
function renderHud(){
  const r = S.prog, hud = $('progHud'); $('progStep').hidden = !r;
  const so = $('startOver'); so.textContent = r ? 'Leave run' : 'Start over'; so.title = r ? 'Back to the arena. The run stays saved: resume it from the arena screen.' : 'New board, empty team, back to the map';
  if (!r || S.screen === 'fight'){ hud.hidden = true; return; } // no spoilers while a fight plays (its result already counts)
  const roundTxt = r.over ? (r.complete ? 'Run complete' : `Run over · ${r.won} of ${RN} rounds won`) : `Round ${r.k + 1}/${RN} · ${A.TERRAINS[r.terrain].name}`;
  const team = r.team.map(e => `<span class="hudpick" title="${esc(itemName(A.BY_ID[e.id]))}: ${e.hp.map(pctHp).join(', ')}, ${M.LEVEL_NAME[e.lv]}">${tokHTML(A.BY_ID[e.id], 24)}<i><b style="width:${Math.round(e.hp.reduce((s, x) => s + x, 0) / e.hp.length * 100)}%;background:${hpCol(Math.min(...e.hp))}"></b></i>${e.lv ? `<span class="stars">${'★'.repeat(e.lv)}</span>` : ''}</span>`).join('');
  const lives = `<span class="lives" title="Retries left: ${retriesLeft(r)}">${'♥'.repeat(retriesLeft(r))}<span class="off">${'♥'.repeat(M.PROG.RETRIES - retriesLeft(r))}</span></span>`;
  hud.innerHTML = `<b>Progressive${r.daily ? ' · daily' : ''}</b><span>${roundTxt}</span><span class="money">$${r.money.toLocaleString()}</span>${lives}`
    + (team ? `<span class="hudteam">${team}</span>` : '')
    + `<span class="btnrow">${S.screen !== 'prog' ? '<button class="btn" data-hud="run" title="All seven rounds, your team and the last fight">Run overview</button>' : ''}<button class="btn" data-hud="abandon" title="${r.over ? 'Close the finished run' : 'End this run for good (it can\'t be resumed)'}">${r.over ? 'Close run' : 'Abandon run'}</button></span>`;
  hud.hidden = false;
}
$('progHud').addEventListener('click', e => {
  const b = e.target.closest('button[data-hud]'); if (!b) return;
  if (b.dataset.hud === 'run'){ go('prog'); return; }
  if (!S.prog.over && b.dataset.armed !== '1'){ // two taps to throw a run away; the arming wears off after 4 s
    b.dataset.armed = '1'; b.textContent = 'Tap again: end the run for good'; b.classList.add('on');
    clearTimeout(abandonTimer); abandonTimer = setTimeout(() => { if (b.isConnected){ b.dataset.armed = '0'; b.textContent = 'Abandon run'; b.classList.remove('on'); } }, 4000);
    return;
  }
  try { localStorage.removeItem(PROG_KEY); } catch(err){}
  exitProg(); renderAll(); go('arena');
});
// the run's MVP: the pick that was MVP of the most fights
function runMvp(r){ const e = Object.entries(r.mvp || {}).sort((a, b) => b[1] - a[1])[0]; return e ? A.BY_ID[e[0]] : null; }
function progShare(r){
  const last = r.log[r.log.length - 1], team = last ? last.team.map(id => A.BY_ID[id].abbr).join('+') || 'no animals' : 'no animals', mvp = runMvp(r);
  return `Wild Arena ${r.daily ? 'daily progressive ' + r.daily : 'progressive'}: ${r.complete ? `all ${RN} rounds won` : `${r.won} of ${RN} rounds won`}, ${r.kills} kills, ${fmtT(r.total)} alive in all${mvp ? ', MVP ' + mvp.name : ''}, last team ${team}.`;
}
const upsTxt = e => e.ups.map(u => `${itemName(A.BY_ID[u.id])} is now ${M.LEVEL_NAME[u.lv]} (${LV_FX[u.lv]})`).join('; ');
function progBanner(e, res){
  const r = S.prog, n = e.k + 1, k = A.BY_ID[res.killer];
  const cont = `<div class="btnrow"><button class="btn primary" id="progContinue">${r.over ? 'See how the run went' : e.retry ? `Retry round ${n}: to the shop` : `Round ${r.k + 1}: to the shop`}</button></div>`;
  if (res.survived){
    const why = res.why === 'cleared' ? `The other side was dead, routed or full by ${fmtT(res.t)}.` : res.why === 'quiet' ? `Nothing came at you for ${A.QUIET_T} s, so the other side gave up at ${fmtT(res.t)}.` : `You held out the full ${fmtT(HZ)}.`;
    return `<div class="banner win"><span class="big">Round ${n} won</span><span>${why} ${e.down} kills${r.complete ? '' : `: +$${e.earned}`}.${e.ups.length ? ' ' + esc(upsTxt(e)) + '.' : ''}${r.complete ? ' That was the last round: the run is complete.' : ''}</span>${cont}</div>`;
  }
  const tail = r.over ? 'That was your last retry: the run ends here.' : `You refight it from the shop as the round opened: same team, wounds, XP and money, a new fight (${retriesLeft(r)} retr${retriesLeft(r) === 1 ? 'y' : 'ies'} left after this one).`;
  return `<div class="banner lose"><span class="big">Round ${n} lost</span><span>You lasted ${fmtT(res.score)}, killed by the ${esc(k ? k.name : 'unknown')}. ${tail}</span>${cont}</div>`;
}
// what each animal earned its XP for, in words
function xpWhyTxt(w){
  const X = M.PROG.XP, bits = [];
  if (w.fight) bits.push(`${w.fight} for fighting`);
  if (w.kills) bits.push(`${w.kills} for ${w.kills / X.kill} kill${w.kills / X.kill > 1 ? 's' : ''}`);
  if (w.sig) bits.push(`${w.sig} for its signature move`);
  if (w.mvp) bits.push(`${w.mvp} as MVP`);
  if (w.survive) bits.push(`${w.survive} for surviving`);
  return bits.join(', ');
}
function recapHTML(r, e, compact){
  const n = e.k + 1, nm = id => itemName(A.BY_ID[id]);
  const lost = e.lost.map(l => { const a = A.BY_ID[l.id]; return M.groupOf(l.id) > 1 && !l.all ? `${l.n} of your ${a.groupName.toLowerCase()}` : `your ${M.groupOf(l.id) > 1 ? a.groupName.toLowerCase() : a.name}`; });
  const kill = A.BY_ID[e.killer];
  const head = e.survived ? `<span class="big" style="color:var(--you)">Round ${n} won · ${fmtT(e.t)}</span>` : `<span class="big" style="color:var(--red)">Round ${n} lost · ${fmtT(e.t)}</span>`;
  const lines = [
    `${A.TERRAINS[e.terrain].name}${e.premium ? ' · with the ' + esc(nm(e.premium)) : ''}. ${e.survived ? (e.why === 'cleared' ? 'You cleared the field.' : e.why === 'quiet' ? 'The other side gave up.' : 'You held out the full five minutes.') : `Killed by the ${esc(kill ? kill.name : 'unknown')}.`}`,
    `Other side: ${e.down} down${e.routed ? ', ' + e.routed + ' routed' : ''}.` + (lost.length ? ` You lost ${esc(lost.join(', '))}.` : e.team.length ? ' Your whole team made it.' : ''),
  ];
  const ks = Object.entries(e.kills || {}).map(([id, c]) => `${esc(nm(id))} ${c}`);
  if (ks.length) lines.push(`Kills: ${ks.join(', ')}.${e.mvp ? ` MVP: the ${esc(nm(e.mvp))}.` : ''}`);
  let xp = '';
  if (e.survived){
    const rows = Object.entries(e.xp).filter(([, v]) => v > 0).map(([id, v]) => { const w = e.xpWhy && e.xpWhy[id], up = e.ups.find(u => u.id === id);
      const gone = e.lost.some(l => l.id === id && l.all);
      return `<li><b>${esc(nm(id))} +${v} XP</b>${gone ? ' (lost in the fight)' : ''}${w ? ': ' + esc(xpWhyTxt(w)) : ''}${up ? ` · <b style="color:var(--gold)">now ${M.LEVEL_NAME[up.lv]}: ${esc(LV_FX[up.lv])}</b>` : ''}</li>`; });
    if (rows.length) xp = `<p class="notes" style="margin:0">XP earned:</p><ul class="xplist">${rows.join('')}</ul>`;
    if (e.scars.length) lines.push(`Scarred (fell below ${M.PROG.SCAR_AT * 100}% health): ${e.scars.map(s => esc(nm(s.id))).join(', ')}, −${M.PROG.SCAR * 100}% max health for the run.`);
    if (e.topup != null) lines.push(`Money: +$${e.earned} for kills ($${M.PROG.PER_KILL} each, up to $${M.PROG.KILL_CAP}), +$${e.topup} for the new round. Survivors rested: each healed ${M.PROG.REST * 100}% of its wounds for free.`); // the last round pays nothing
  } else if (e.retry) lines.push('The lost fight is undone: your team, money, wounds and XP are back as they were when the round opened.');
  return (compact ? '' : head) + lines.map(l => `<p class="notes" style="margin:0">${l}</p>`).join('') + xp;
}
// the end of a run: every animal that fought for you (alive, dead, sold), survivors first, then by kills
const kfmt = n => n >= 1000 ? (n / 1000).toFixed(n >= 1e5 ? 0 : 1) + 'k' : String(n);
function runSummaryHTML(r){
  const alive = new Set(r.team.map(e => e.uid)), hs = (r.hist || []).slice();
  const rank = h => alive.has(h.uid) ? 0 : h.out && h.out.how === 'undone' ? 2 : 1;
  hs.sort((a, b) => rank(a) - rank(b) || b.kills - a.kills || (b.dealt + b.protect) - (a.dealt + a.protect));
  if (!hs.length) return '<p class="notes">No animal fought for you this run.</p>';
  const rows = hs.map(h => {
    const a = A.BY_ID[h.id], o = h.out, rs = h.rounds.slice().sort((x, y) => x - y), live = alive.has(h.uid);
    const fate = live ? `<span class="flag surv">★ Survivor${r.complete ? ': went the distance' : ''}</span>`
      : !o ? '' : o.how === 'died' ? `<span class="flag bad">Died in round ${o.k + 1}${o.by && A.BY_ID[o.by] ? ' to the ' + esc(A.BY_ID[o.by].name) : ''}</span>`
      : o.how === 'fled' ? `<span class="flag hurt">Fled in round ${o.k + 1}</span>` : o.how === 'sold' ? `<span class="flag">Sold before round ${o.k + 1} · $${o.price}</span>`
      : `<span class="flag">Refunded: round ${o.k + 1} was replayed</span>`;
    const span = rs.length ? (rs.length === 1 ? `round ${rs[0] + 1}` : `rounds ${rs[0] + 1}–${rs[rs.length - 1] + 1} (${rs.length})`) : '';
    const stats = [span, `${h.kills} kill${h.kills === 1 ? '' : 's'}`, `${kfmt(h.dealt + h.protect)} damage${h.protect ? ` (${kfmt(h.protect)} protecting you)` : ''}`,
      `${M.LEVEL_NAME[h.lv]} · ${h.xp} XP`, h.scars ? `${h.scars} scar${h.scars > 1 ? 's' : ''}` : '', h.mvp ? `MVP ${h.mvp}×` : ''].filter(Boolean).join(' · ');
    return `<div class="mt sumrow${live ? ' surv' : ''}">${tokHTML(a, 34)}<div class="mtb"><div class="nm">${esc(itemName(a))} ${stars(h.lv)}</div><div class="hpb">${fate}</div><div class="sub">${stats}</div></div></div>`;
  });
  const nRef = hs.filter(h => rank(h) === 2).length, main = rows.slice(0, rows.length - nRef), ref = rows.slice(rows.length - nRef);
  return `<div class="progteam">${main.join('')}</div>` + (nRef ? `<details class="xphow"><summary>${nRef} more bought for a round you lost and replayed (refunded)</summary><div class="progteam">${ref.join('')}</div></details>` : '');
}
function renderProg(){
  const r = S.prog; if (!r) return;
  $('progTitle').textContent = r.over ? (r.complete ? 'Run complete' : 'The run ends') : `Run overview · round ${r.k + 1} of ${RN}`;
  const order = M.terrainOrder(r.seed);
  $('progTrail').innerHTML = Array.from({length: RN}, (_, i) => {
    const cls = i < r.won ? 'done' : r.over && !r.complete && i === r.k ? 'dead' : !r.over && i === r.k ? 'now' : '';
    const cap = M.PROG.CAP[i];
    return `<span class="${cls}">${i + 1} ${A.TERRAINS[order[i % 4]].name} · ${cap ? '$' + cap : 'all'}</span>`;
  }).join('');
  const last = r.log[r.log.length - 1];
  $('progRecap').hidden = !last; $('progRecap').innerHTML = last ? recapHTML(r, last) : '';
  $('progTeamTitle').textContent = r.over ? 'Every animal of the run' : 'Your team';
  $('progTeam').innerHTML = r.over ? runSummaryHTML(r) : progTeamHTML(r, 'view') + `<details class="xphow"><summary>How XP and levels work</summary>${xpHowHTML()}</details>`;
  const nx = $('progNext'), act = $('progActions');
  if (!r.over){
    const tot = r.board.reduce((s, id) => s + A.BY_ID[id].price, 0), cap = M.PROG.CAP[r.k], p = r.premium && A.BY_ID[r.premium];
    nx.hidden = false;
    nx.innerHTML = `<h3 style="margin-bottom:6px">Next: round ${r.k + 1} · ${A.TERRAINS[r.terrain].name}${r.attempt ? ' · retry ' + r.attempt : ''}</h3><p class="notes">${cap ? `Animals up to $${cap}` : 'Any animal'}: ${r.board.length} on the board, worth $${tot.toLocaleString()}.${p ? ` The premium enemy this round is the <b>${esc(itemName(p))}</b> ($${p.price}): it can't be bought and fights you.` : ''}${r.k === RN - 1 ? ' The last round: a giant is on the board.' : ''} You have $${r.money.toLocaleString()}, ${retriesLeft(r)} retr${retriesLeft(r) === 1 ? 'y' : 'ies'} left.</p>`;
    act.innerHTML = `<button class="btn primary" id="progToShop">Back to the shop</button>`;
  } else {
    const fmtBest = b => `${b.complete ? 'all ' + RN : b.won + ' of ' + RN} rounds, ${fmtT(b.total)} alive`;
    const best = r.newBest ? 'A new best run.' : r.prevBest ? `Best run: ${fmtBest(r.prevBest)}.` : '';
    const daily = r.daily ? ` Daily run ${r.daily}: ${r.newDaily ? 'your best today.' : r.prevDaily ? `best today ${fmtBest(r.prevDaily)}.` : ''}` : '';
    const mvp = runMvp(r);
    nx.hidden = false;
    nx.innerHTML = `<h3 style="margin-bottom:6px">${r.complete ? `All ${RN} rounds won` : `${r.won} of ${RN} rounds won`} · ${r.kills} kills · ${fmtT(r.total)} alive</h3>${mvp ? `<p class="notes" style="display:flex;gap:8px;align-items:center">${tokHTML(mvp, 30)} MVP of the run: the ${esc(mvp.name)}.</p>` : ''}<p class="notes">${best}${daily}</p><p class="notes" style="margin-top:6px">Share: “${esc(progShare(r))}”</p>`;
    act.innerHTML = `<button class="btn primary" id="progAgain">New run</button><button class="btn" id="progAgainDaily">Daily run</button><button class="btn" id="progCopy">Copy result</button><span class="copyOut" id="progCopyOut"></span><button class="btn" id="progHome">Back to the arena</button>`;
  }
}
$('progActions').addEventListener('click', e => {
  const id = e.target.id;
  if (id === 'progToShop') go('draft');
  else if (id === 'progAgain') startProg(newBoardSeed());
  else if (id === 'progAgainDaily') startProg(progDailySeed(todayLocal()), todayLocal());
  else if (id === 'progCopy') copyLink(progShare(S.prog), $('progCopyOut'), 'Result');
  else if (id === 'progHome'){ try { localStorage.removeItem(PROG_KEY); } catch(err){} exitProg(); renderAll(); go('arena'); }
});
// arena screen entry: start, daily, resume, best. Starting a new run while one is saved asks first (it replaces the saved run).
function renderProgEntry(){
  if (!PROG_ON) return;
  const r = loadRun(), live = r && !r.over, rb = $('progResume');
  rb.hidden = !live; if (live) rb.textContent = `Resume (round ${r.k + 1}/${RN}, $${r.money.toLocaleString()})`;
  for (const id of ['progNew', 'progDaily']){ const b = $(id); b.dataset.armed = '0'; b.classList.remove('on'); b.textContent = id === 'progNew' ? (live ? 'New run' : 'Start a run') : 'Daily run'; }
  const best = readJSON(PROG_BEST), db = readJSON(progDailyKey(todayLocal()));
  $('progBest').textContent = (best ? `Best run: ${best.complete ? 'all ' + RN : best.won + ' of ' + RN} rounds won, ${fmtT(best.total)} alive.` : 'No run finished yet.') + (db ? ` Today's daily: ${db.won} of ${RN}, ${fmtT(db.total)}.` : '');
}
function confirmReplace(b, start){
  const r = loadRun();
  if (r && !r.over && b.dataset.armed !== '1'){ b.dataset.armed = '1'; b.textContent = `Tap again: replace your saved run (round ${r.k + 1})`; b.classList.add('on'); return; }
  start();
}
$('progNew').addEventListener('click', e => confirmReplace(e.currentTarget, () => startProg(newBoardSeed())));
$('progDaily').addEventListener('click', e => confirmReplace(e.currentTarget, () => startProg(progDailySeed(todayLocal()), todayLocal())));
$('progResume').addEventListener('click', () => { const r = loadRun(); if (!r || r.over) return; hideNotice(); S.prog = r; S.progKey = null; S.progEntry = null; S.world = null; go('draft'); });

// ---------- personal stats (localStorage 'wa-stats'): every fight played on this device ----------
// per pick (catalog item): games, wins, kills, damage, protecting you, deaths, MVPs; per enemy: games faced, times it
// killed you; per map: games, wins, best; your own kills; the last 50 games with a replay link
const STATS_KEY = 'wa-stats', HIST_N = 50;
function readStats(){ try { const s = JSON.parse(localStorage.getItem(STATS_KEY) || 'null'); if (s && s.v === 1) return s; } catch(e){} return {v: 1, games: 0, wins: 0, you: 0, mine: {}, foes: {}, maps: {}, hist: []}; }
function recordStats(w){
  const st = readStats(), sum = A.summarize(w), res = w.result, won = !!res.survived;
  st.games++; if (won) st.wins++;
  const m = st.maps[S.terrain] || (st.maps[S.terrain] = {g: 0, w: 0, best: 0}); m.g++; if (won) m.w++; m.best = Math.max(m.best, res.score);
  const mine = sum.units.filter(u => u.side === 'P'), mvp = mine.slice().sort((a, b) => (b.protect * 1.5 + b.dealt) - (a.protect * 1.5 + a.dealt))[0];
  for (const id of S.team){ const r = st.mine[id] || (st.mine[id] = {g: 0, w: 0, k: 0, d: 0, p: 0, x: 0, mvp: 0}); r.g++; if (won) r.w++; }
  for (const u of mine){ const r = st.mine[u.id]; if (!r) continue; r.k += u.kills || 0; r.d += u.dealt || 0; r.p += u.protect || 0; if (!u.alive && !u.escaped) r.x++; }
  if (mvp && mvp.dealt > 0 && st.mine[mvp.id]) st.mine[mvp.id].mvp++;
  for (const id of S.board) if (!S.team.has(id)){ const f = st.foes[id] || (st.foes[id] = {g: 0, kd: 0}); f.g++; }
  if (!won && res.killer && st.foes[res.killer]) st.foes[res.killer].kd++;
  st.you += (sum.units.find(u => u.side === 'H') || {}).kills || 0;
  let link = ''; try { link = gameLink(Object.assign(currentGame(), {pos: Object.assign({}, S.pos), you: S.youPos}), res.score); link = link.slice(link.indexOf('#')); } catch(e){}
  st.hist.unshift({d: todayLocal(), m: S.terrain, t: [...S.team], sc: Math.round(res.score * 10) / 10, won, k: res.killer || null, l: link});
  st.hist.length = Math.min(st.hist.length, HIST_N);
  try { localStorage.setItem(STATS_KEY, JSON.stringify(st)); } catch(e){}
  renderStats();
}
const pct = (a, b) => b ? Math.round(100 * a / b) + '%' : '–';
function recordLine(id){ const r = readStats().mine[id]; return r && r.g ? `You: ${r.g} game${r.g === 1 ? '' : 's'} · ${pct(r.w, r.g)} won · ${r.k} kill${r.k === 1 ? '' : 's'}` : ''; }
function recordDetail(id){
  const st = readStats(), r = st.mine[id], f = st.foes[id];
  if (!(r && r.g) && !(f && f.g)) return '';
  const bits = [];
  if (r && r.g) bits.push(`On your side: ${r.g} game${r.g === 1 ? '' : 's'}, ${pct(r.w, r.g)} won, ${r.k} kills, ${r.d.toLocaleString()} damage (${r.p.toLocaleString()} protecting you), MVP ${r.mvp}×, died ${r.x}×.`);
  if (f && f.g) bits.push(`Against you: faced ${f.g}×, killed you ${f.kd}×.`);
  return `<p class="notes" style="margin:0 0 8px;color:var(--gold)">${esc(bits.join(' '))}</p>`;
}
function renderStats(){
  const el = $('statsPanel'); if (!el) return;
  const st = readStats(); el.hidden = !st.games; if (!st.games) return;
  const name = id => A.BY_ID[id] ? itemName(A.BY_ID[id]) : id;
  const nem = Object.entries(st.foes).filter(([, f]) => f.kd).sort((a, b) => b[1].kd - a[1].kd)[0];
  const best = Object.entries(st.mine).filter(([, r]) => r.g >= 3).sort((a, b) => b[1].w / b[1].g - a[1].w / a[1].g)[0];
  const top = Object.entries(st.mine).sort((a, b) => b[1].k - a[1].k)[0];
  $('statsSum').textContent = `Your stats: ${st.games} game${st.games === 1 ? '' : 's'}, ${pct(st.wins, st.games)} survived`;
  const maps = Object.keys(A.TERRAINS).map(t => { const m = st.maps[t]; return `<tr><td>${esc(A.TERRAINS[t].name)}</td><td class="n">${m ? m.g : 0}</td><td class="n">${m ? pct(m.w, m.g) : '–'}</td><td class="n">${m ? fmtT(m.best) : '–'}</td></tr>`; }).join('');
  const rows = Object.entries(st.mine).sort((a, b) => b[1].g - a[1].g).map(([id, r]) => `<tr><td><span style="display:inline-flex;gap:6px;align-items:center">${tokHTML(A.BY_ID[id] || A.HUMAN, 18)}${esc(name(id))}</span></td><td class="n">${r.g}</td><td class="n">${pct(r.w, r.g)}</td><td class="n">${r.k}</td><td class="n">${r.d >= 1000 ? (r.d / 1000).toFixed(r.d >= 1e5 ? 0 : 1) + 'k' : r.d}</td></tr>`).join('');
  const hist = st.hist.slice(0, 12).map(h => `<li><span class="mono">${esc(h.d.slice(5))}</span> ${esc(A.TERRAINS[h.m] ? A.TERRAINS[h.m].name : h.m)} · ${h.won ? '<b style="color:var(--gold)">survived</b>' : 'lasted ' + fmtT(h.sc) + (h.k && A.BY_ID[h.k] ? ' (' + esc(A.BY_ID[h.k].name) + ')' : '')} · ${esc(h.t.map(id => A.BY_ID[id] ? A.BY_ID[id].abbr : id).join('+') || 'alone')}${h.l ? ` · <a href="${esc(h.l)}">replay</a>` : ''}</li>`).join('');
  $('statsBody').innerHTML = `<p class="notes">${[nem ? `Nemesis: the ${esc(name(nem[0]))} (killed you ${nem[1].kd}×).` : '', top && top[1].k ? `Top killer on your side: ${esc(name(top[0]))} (${top[1].k} kills).` : '', best ? `Best record: ${esc(name(best[0]))} (${pct(best[1].w, best[1].g)} of ${best[1].g}).` : '', st.you ? `You've finished off ${st.you} animal${st.you === 1 ? '' : 's'} with your own hands.` : ''].filter(Boolean).join(' ')}</p>
    <div class="tblwrap"><table><thead><tr><th>Map</th><th class="n">Games</th><th class="n">Survived</th><th class="n">Best</th></tr></thead><tbody>${maps}</tbody></table></div>
    <div class="tblwrap" style="margin-top:10px"><table><thead><tr><th>Your animals</th><th class="n">Games</th><th class="n">Won</th><th class="n">Kills</th><th class="n">Damage</th></tr></thead><tbody>${rows}</tbody></table></div>
    <h4 style="margin:12px 0 6px">Recent games</h4><ul class="hist">${hist}</ul>`;
}

// ---------- action bar + one-tap replay (mobile UX pass, Oct 27) ----------
// A sticky bar at the bottom with the next primary action of every step, so nothing important sits below the fold:
// arena -> draft -> fight (auto formation; the formation step stays optional) -> skip to result -> play again / new board.
// It mirrors existing buttons rather than adding new paths, and hides where a screen has its own flow (Migration hub, Lab).
const SPEED_KEY = 'wa-speed';
try { const v = +localStorage.getItem(SPEED_KEY); if ([1, 2, 4, 8, 16].includes(v)) S.speed = v; } catch(e){}
document.querySelectorAll('#speedSeg button').forEach(b => b.addEventListener('click', () => { try { localStorage.setItem(SPEED_KEY, String(S.speed)); } catch(e){} }));
function skipToEnd(){ if (!S.world) return; S.playT = S.dur; S.playing = false; }
$('skipEnd').addEventListener('click', skipToEnd);
function playAgain(){ $('rematch').click(); } // same board and team; a new fight seed (the daily keeps today's seed)
function playNewBoard(){ dealNewBoard(); renderAll(); go('draft'); }
$('banner').addEventListener('click', e => {
  const id = e.target.id;
  if (id === 'playAgain') playAgain(); else if (id === 'playNew') playNewBoard(); else if (id === 'playTeam') go('draft');
});
// drafting re-renders every card; keep the tapped card where it was on screen (the team line above it can grow a row)
{ let anchor = null; const cardsIn = () => [...$('tiers').querySelectorAll('.card')];
  $('tiers').addEventListener('click', e => { const c = e.target.closest('.card'); anchor = c ? {i: cardsIn().indexOf(c), top: c.getBoundingClientRect().top} : null; }, true);
  $('tiers').addEventListener('click', () => { if (!anchor || S.screen !== 'draft') return; const c = cardsIn()[anchor.i]; if (c){ const d = c.getBoundingClientRect().top - anchor.top; if (Math.abs(d) > .5) window.scrollBy(0, d); } anchor = null; }); }
function actBtn(label, fn, primary, title){ const b = document.createElement('button'); b.className = 'btn' + (primary ? ' primary' : ''); b.textContent = label; if (title) b.title = title; b.addEventListener('click', fn); return b; }
let actKey = '';
function renderActBar(){
  const bar = $('actbar'), sc = S.screen, ended = !!(S.world && S.playT >= S.dur - 1e-6), banner = $('banner').querySelector('.btn.primary');
  const key = [sc, ended, !!banner && banner.id, banner && banner.textContent, sc === 'draft' ? spent() + ':' + S.team.size + ':' + (S.prog ? S.prog.money + ':' + M.teamIds(S.prog).length : '') : ''].join('|');
  if (key === actKey) return; actKey = key;
  $('skipEnd').hidden = ended;
  const box = $('actbarIn'); box.innerHTML = '';
  const add = (...b) => b.forEach(x => box.appendChild(x));
  if (sc === 'arena') add(actBtn('Draft your team', () => $('toDraft').click(), true), actBtn('Daily', () => startDaily(), false, 'Daily challenge: same board, map and fight seed for everyone today'));
  else if (sc === 'draft'){
    const n = S.prog ? M.teamIds(S.prog).length : S.team.size;
    const sum = document.createElement('span'); sum.className = 'sum';
    sum.innerHTML = S.prog ? `<b>$${S.prog.money.toLocaleString()}</b><br>left` : DUI.ui && DUI.ui !== 'default' ? `<b>$${(BUDGET - spent()).toLocaleString()}</b> left<br>${n} pick${n === 1 ? '' : 's'}` : `<b>$${spent().toLocaleString()}</b> / $${BUDGET.toLocaleString()}<br>${n} pick${n === 1 ? '' : 's'}`; // the prototype draft screens count down what's left (owner)
    if (S.prog) add(sum, actBtn('Fight now', () => startBattle(), false, 'Skip the formation: fight with the auto formation'), actBtn('Formation', () => go('deploy'), true, 'Next: pick your mount and placements, then fight'));
    else add(sum, actBtn('Formation', () => go('deploy'), false, 'Place your animals (optional: Fight uses the auto formation)'), actBtn(n ? 'Fight' : 'Fight alone', () => startBattle(), true));
  }
  else if (sc === 'deploy' && S.prog) add(actBtn('Shop', () => go('draft'), false, 'Back to the shop'), actBtn('Auto', () => $('autoForm').click(), false, 'Auto formation: put everyone back in the default spots'), actBtn('Fight', () => startBattle(), true));
  else if (sc === 'deploy') add(actBtn('Auto', () => $('autoForm').click(), false, 'Auto formation'), actBtn('Release the animals', () => startBattle(), true));
  else if (sc === 'fight' && S.world){
    if (!ended) add(actBtn('Skip to result', skipToEnd, true));
    else if (banner && (S.prog || S.five)) add(actBtn(banner.textContent, () => banner.click(), true));
    else if (banner) add(actBtn('Team', () => go('draft'), false, 'Change team'), actBtn('New board', playNewBoard), actBtn('Play again', playAgain, true));
  }
  bar.hidden = !box.children.length;
  document.body.classList.toggle('hasbar', !bar.hidden);
}

// ---------- DRAFT_UIS: alternative draft screens (prototype Oct 27, hidden unless ?draftui=…; research/draft_ui/README.md) ----------
// Versus board, compact list and deck. They read and write the same state as the default cards (S.team, S.mount, S.focus and
// the progressive shop), so deploy and fight are unchanged. The only hook outside this block is `if (draftAlt()) return;` in
// renderDraft. Their CSS is injected from here (DUI_CSS) so template.html stays untouched. ?draftui=versus|list|deck|default
// picks one; ?draftui=1 uses the last choice (localStorage wa-draftui); a switcher on the draft screen flips between them.
const DUI_NAMES = {default: 'Default', versus: 'Versus', list: 'List', deck: 'Deck'};
const DUI_KEY = 'wa-draftui';
const DUI = (() => {
  let q = null; try { q = new URLSearchParams(location.search).get('draftui'); } catch(e){}
  let stored = null; try { stored = localStorage.getItem(DUI_KEY); } catch(e){}
  // a choice made with the switcher sticks without the flag; the progressive shop uses Versus unless you chose otherwise (owner)
  const prog = /[?&]progressive=1\b/.test(location.search);
  if (q == null && !(stored && DUI_NAMES[stored] && stored !== 'default') && !prog) return {on: false, ui: 'default'};
  let ui = DUI_NAMES[q] ? q : null;
  if (!ui) ui = stored && DUI_NAMES[stored] ? stored : prog ? 'versus' : null;
  return {on: true, ui: DUI_NAMES[ui] ? ui : 'default', sort: 'price', role: '', good: false, afford: false, open: null, flash: null, msg: '', deck: {key: null, i: 0, left: new Set()}};
})();
const DUI_HELP = {
  versus: 'Tap an animal to move it across; ⓘ shows its full stat line.',
  list: 'Tap a row to draft it, ▾ to open its stat line.',
  deck: 'One animal at a time: Take or Leave (or swipe right / left). Back and the strip go to any card.',
};
const DUI_ROLE = a => a.tags.includes('shoreGuard') ? 'Lurkers' : ({charge: 'Chargers', lumber: 'Brawlers', stalk: 'Cats', rush: 'Cats', orbit: 'Harriers', keepaway: 'Kickers', lunge: 'Lurkers'})[a.gait] || 'Other';
const duiFit = a => terrainFit(a, S.terrain).reduce((s, [k]) => s + (k === 'good' ? 1 : -1), 0);
const duiByPrice = ids => ids.map(id => A.BY_ID[id]).sort((x, y) => y.price - x.price || itemName(x).localeCompare(itemName(y)));
const duiPrem = id => !!(S.prog && id === S.prog.premium);
const duiFresh = id => !!(S.prog && S.prog.team.some(e => e.id === id && e.fresh));
const duiEntry = id => S.prog ? S.prog.team.find(e => e.id === id) : null;
const duiLeft = () => S.prog ? S.prog.money : BUDGET - spent();

// draft or undraft one item, with the same rules and side effects as tapping a default card; false when nothing changed
function duiToggle(id){
  const a = A.BY_ID[id]; S.focus = id; let ok;
  if (S.prog){
    const r = S.prog; if (duiPrem(id)) return false;
    ok = duiFresh(id) ? M.unbuy(r, id) : M.buy(r, id);
    if (!ok && !S.team.has(id)) duiNote(`Not enough money: $${r.money.toLocaleString()} left`);
    if (ok){ saveRun(); progSync(); S.world = null; }
    renderAll(); renderHud(); return ok;
  }
  ok = true;
  if (S.team.has(id)) S.team.delete(id); else if (canAdd(a)) S.team.add(id); else { ok = false; duiNote(`${itemName(a)} costs $${a.price}: $${duiLeft().toLocaleString()} left`); }
  S.world = null;
  if (S.mount && !S.team.has(S.mount)) S.mount = bestMount();
  if (!S.mount) S.mount = bestMount();
  renderAll(); return ok;
}
// the progressive shop's sell / undo / heal buttons, wherever a design shows the run's team
function duiShop(b){ // same rules and messages as the shop's own team panel (progShopClick: sell takes two taps, heal all, return)
  if (!S.prog || !(b.dataset.sell || b.dataset.unbuy || b.dataset.heal || b.id === 'progHealAll')) return false;
  progShopClick({target: b}); return true; // its message shows in the Your team panel
}
let duiNoteT = 0;
function duiNote(t){ DUI.msg = t; clearTimeout(duiNoteT); duiNoteT = setTimeout(() => { DUI.msg = ''; const n = document.querySelector('#draftAlt .duimsg'); if (n) n.textContent = ''; }, 2600); }
function duiDetailHTML(id){ S.focus = id; renderDetail(); return $('detail').innerHTML; }
function duiInfo(id){ $('duiDlgBody').innerHTML = duiDetailHTML(id); $('duiDlg').showModal(); }

// both sides: head count, and the budget you have left
function duiScore(note){
  // owner (Oct 27): no measured values on screen (the +s / -s took away the fun of discovering what's good); just who's
  // on each side and the budget you have left
  const mine = [...S.team], theirs = S.board.filter(id => !S.team.has(id));
  const money = S.prog ? `<b>$${S.prog.money.toLocaleString()}</b><span class="sub">left to spend</span>` : `<b>$${duiLeft().toLocaleString()}</b><span class="sub">left of $${BUDGET.toLocaleString()}</span>`;
  return `<div class="duiscore"><div class="sd you"><span class="label">Your side · ${mine.length}</span>${money}</div>`
    + `<div class="sd foe"><span class="label">Their side · ${theirs.length}</span><span class="sub">everything you leave${S.prog && S.prog.premium ? ', + premium' : ''}</span></div>`
    + `<div class="duimsg" aria-live="polite">${esc(DUI.msg)}</div></div>`;
}
const duiSig = a => { const s = sigOf(a); return s ? `<b>${esc(s[0])}</b> ${esc(s[1])}` : esc(a.style); };
const duiTags = a => (a.rare ? '<span class="bdg good">Rare</span>' : '') + (groupOf(a) > 1 ? `<span class="bdg good">×${groupOf(a)}</span>` : '');
const duiPriceHTML = a => `<span class="dprice" style="color:${tierHex(a.price)}">$${a.price}</span>`;
// a progressive animal's health bars and shop buttons
function duiProgBits(id){
  const e = duiEntry(id); if (!e) return '';
  const a = A.BY_ID[id]; let act = '';
  if (e.fresh) act = `<button class="btn" data-unbuy="${id}">Return · +$${a.price}</button>`;
  else {
    if (M.needsHeal(e)) act += `<button class="btn" data-heal="${id}" ${M.canHeal(S.prog, id) ? '' : 'disabled'}>Heal to 100% · $${M.healCost(e)}</button>`;
    if (M.tooHurtToSell(e)) act += `<button class="btn" disabled>Can't sell: under ${Math.round(M.PROG.SELL_MIN * 100)}%</button>`;
    else { const armed = S.sellArm === id; act += `<button class="btn${armed ? ' arm' : ''}" data-sell="${id}">${armed ? 'Tap again: sell · $' : 'Sell · $'}${M.sellPrice(e)}</button>`; }
  }
  return `${healthHTML(e)}${e.lv ? stars(e.lv) : ''}<span class="dacts">${act}</span>`;
}

// ---- 1. Versus board: your side and their side, tap to move an animal across ----
function duiVersus(box){
  const mine = duiByPrice([...S.team]), theirs = duiByPrice(S.board.filter(id => !S.team.has(id)));
  const tile = (a, side) => {
    const prem = duiPrem(a.id), carried = side === 'you' && S.prog && !duiFresh(a.id), cls = ['vt', side, !S.team.has(a.id) && !canAdd(a) ? 'cant' : '', prem ? 'prem' : '', DUI.flash === a.id ? 'flash' : ''].join(' ');
    const lbl = prem ? 'Not for sale: it fights you' : side === 'foe' ? `Bring ${itemName(a)} to your side` : carried ? `${itemName(a)}: details` : `Send ${itemName(a)} to their side`;
    return `<div class="${cls}"><button class="vtm" data-${prem || carried ? 'info' : 'id'}="${a.id}" aria-label="${esc(lbl)}">${tokHTML(a, 38)}<span class="vtb"><span class="vtn">${esc(itemName(a))}</span>`
      + `<span class="vtl">${duiPriceHTML(a)}${duiTags(a)}${prem ? '<span class="bdg bad">Not for sale</span>' : ''}</span></span></button>`
      + `<button class="vti" data-info="${a.id}" aria-label="${esc(itemName(a))} details"><span>i</span></button>${side === 'you' && S.prog && duiEntry(a.id) && !duiEntry(a.id).fresh ? `<div class="vtp">${healthHTML(duiEntry(a.id))}</div>` : ''}</div>`; // heal / sell / XP live in the shop's Your team panel above
  };
  box.innerHTML = duiScore(true) + `<div class="vs"><section class="vcol you"><h3>Your side</h3><p class="vh">${S.prog ? 'Tap a new buy to return it; heal and sell in Your team above' : 'Tap to send back'}</p><div class="vlist">${mine.map(a => tile(a, 'you')).join('') || '<p class="vempty">Nobody yet. Tap an animal on their side to bring it over.</p>'}</div></section>`
    + `<section class="vcol foe"><h3>Their side</h3><p class="vh">Tap to bring across</p><div class="vlist">${theirs.map(a => tile(a, 'foe')).join('') || '<p class="vempty">Nobody left against you.</p>'}</div></section></div>`;
  DUI.flash = null;
}

// ---- 2. Compact list: one row per animal, sort and filter, the stat line opens inline ----
function duiList(box){
  const all = S.board.map(id => A.BY_ID[id]), roles = [...new Set(all.map(DUI_ROLE))].sort();
  if (DUI.role && !roles.includes(DUI.role)) DUI.role = '';
  let rows = all.filter(a => (!DUI.role || DUI_ROLE(a) === DUI.role) && (!DUI.good || duiFit(a) > 0) && (!DUI.afford || S.team.has(a.id) || canAdd(a)));
  const by = {price: (x, y) => y.price - x.price, cheap: (x, y) => x.price - y.price, fit: (x, y) => duiFit(y) - duiFit(x) || y.price - x.price, name: () => 0};
  rows.sort((x, y) => by[DUI.sort](x, y) || itemName(x).localeCompare(itemName(y)));
  const seg = [['price', 'Price ↓'], ['cheap', 'Price ↑'], ['fit', 'Map fit'], ['name', 'A–Z']].map(([k, t]) => `<button data-sort="${k}" aria-pressed="${DUI.sort === k}">${t}</button>`).join('');
  const chips = `<button data-role="" aria-pressed="${!DUI.role}">All ${all.length}</button>` + roles.map(r => `<button data-role="${r}" aria-pressed="${DUI.role === r}">${r}</button>`).join('')
    + `<button data-good="1" aria-pressed="${DUI.good}">Good on ${esc(A.TERRAINS[S.terrain].name.toLowerCase())}</button><button data-afford="1" aria-pressed="${DUI.afford}">Affordable</button>`;
  const team = S.prog ? `<div class="label">Your team: undo, sell or heal</div>${progTeamHTML(S.prog, true)}`
    : `<div class="lteam">${[...S.team].map(id => { const a = A.BY_ID[id]; return `<button class="chip" data-id="${id}" aria-label="Remove ${esc(itemName(a))}">${tokHTML(a, 26)}${esc(itemName(a))} <span class="x">×</span></button>`; }).join('') || '<span class="label">No animals drafted yet</span>'}</div>`;
  const row = a => {
    const picked = S.team.has(a.id), prem = duiPrem(a.id), carried = picked && S.prog && !duiFresh(a.id), open = DUI.open === a.id;
    const fit = terrainFit(a, S.terrain).map(([k, t]) => `<span class="bdg ${k}">${t}</span>`).join(''), rec = recordLine(a.id);
    const third = (prem ? '<span class="bdg bad">Not for sale: it fights you</span>' : '') + duiTags(a) + fit + (rec ? `<span class="recline">${esc(rec)}</span>` : '');
    return `<div class="lr${picked ? ' picked' : ''}${!picked && !canAdd(a) ? ' cant' : ''}${prem ? ' prem' : ''}${open ? ' open' : ''}"><div class="lrh">`
      + `<button class="lrm" data-${prem || carried ? 'open' : 'id'}="${a.id}" aria-pressed="${picked}">${tokHTML(a, 40)}<span class="lrt"><span class="lrn">${esc(itemName(a))}</span><span class="lrs">${duiSig(a)}</span>${third ? `<span class="lr3">${third}</span>` : ''}</span>`
      + `<span class="lrr">${duiPriceHTML(a)}<span class="lradd">${prem ? '–' : picked ? '✓' : '+'}</span></span></button>`
      + `<button class="lrx" data-open="${a.id}" aria-expanded="${open}" aria-label="${esc(itemName(a))} stat line">▾</button></div>`
      + (open ? `<div class="detail lrd">${duiDetailHTML(a.id)}</div>` : '') + '</div>';
  };
  box.innerHTML = duiScore(false) + team + `<div class="ltools"><div class="seg lsort">${seg}</div><div class="chips">${chips}</div></div>`
    + `<div class="lrows">${rows.map(row).join('') || '<p class="vempty">Nothing on this board matches. <button class="linkbtn" data-role="" data-clear="1">Show all</button></p>'}</div>`;
}

// ---- 3. Deck: one big card at a time, Take / Leave, swipe on touch, back to any card ----
function duiDeckState(){
  const key = [S.boardSeed, S.terrain, S.prog ? S.progKey : ''].join(':'), d = DUI.deck;
  if (d.key !== key){ d.key = key; d.i = 0; d.left = new Set(); }
  d.order = duiByPrice(S.board).map(a => a.id);
  d.i = Math.max(0, Math.min(d.i, d.order.length));
  return d;
}
function duiDeck(box){
  const d = duiDeckState(), n = d.order.length, id = d.order[d.i], a = id && A.BY_ID[id];
  const strip = d.order.map((x, k) => { const b = A.BY_ID[x], st = S.team.has(x) ? 'taken' : duiPrem(x) ? 'prem' : d.left.has(x) ? 'left' : ''; return `<button class="dkdot ${st}${k === d.i ? ' now' : ''}" data-jump="${k}" aria-label="${esc(itemName(b))}${st ? ' (' + (st === 'taken' ? 'yours' : st === 'prem' ? 'not for sale' : 'left') + ')' : ''}">${tokHTML(b, 30)}</button>`; }).join('');
  let card, btns;
  if (!a){
    const mine = duiByPrice([...S.team]), theirs = duiByPrice(S.board.filter(x => !S.team.has(x)));
    card = `<div class="dkcard dkend"><div class="dkname">That's the board</div><p class="notes">Your side: ${mine.map(b => esc(itemName(b))).join(', ') || 'just you'}.<br>Against you: ${theirs.length} ${theirs.length === 1 ? 'animal' : 'animals'}, $${theirs.reduce((s, b) => s + b.price, 0).toLocaleString()}.</p><p class="notes">Fight from the bar below, or go back through the deck.</p></div>`;
    btns = `<button class="btn" data-back="1">‹ Back</button><button class="btn" data-jump="0">From the top</button>`;
  } else {
    const picked = S.team.has(id), prem = duiPrem(id), carried = picked && S.prog && !duiFresh(id), cant = !picked && !canAdd(a) && !prem;
    const bars = [['Power', strengthOf(a) / maxStr], ['Armor', a.armor / .6], ['Speed', a.spd / 20], ['Stamina', Math.min(1, a.stam / 60)]].map(([k, v]) => `<span>${k}</span><div class="bar"><b style="width:${Math.round(Math.min(1, v) * 100)}%"></b></div>`).join('');
    const sg = sigOf(a), rec = recordLine(id), fit = badgesHTML(a);
    card = `<div class="dkcard${picked ? ' taken' : ''}${cant ? ' cant' : ''}${prem ? ' prem' : ''}" id="dkCard"><span class="stamp take">Take</span><span class="stamp leave">Leave</span>`
      + `<div class="dkhd"><span class="dkface" style="${tokStyle(a)}">${faceOf(a) ? '' : a.abbr}</span><div class="dkhb"><div class="label">${d.i + 1} of ${n}${picked ? ' · <span style="color:var(--you)">on your side</span>' : prem ? ' · <span style="color:var(--foe)">not for sale</span>' : d.left.has(id) ? ' · left' : ''}</div><div class="dkname">${esc(itemName(a))}</div>`
      + `<div class="dkprice" style="color:${tierHex(a.price)}">$${a.price}</div><div class="styleTag">${esc(a.style)}</div></div></div>`
      + `<div class="badges">${prem ? '<span class="bdg bad">Not for sale: it fights you</span>' : ''}${a.rare ? '<span class="bdg good">Rare</span>' : ''}${groupOf(a) > 1 ? `<span class="bdg good">×${groupOf(a)}, hunt together</span>` : ''}${fit}</div>`
      + (sg ? `<div class="dksig"><b>${esc(sg[0])}</b>${esc(sg[1])}</div>` : '')
      + `<div class="bars">${bars}</div><div class="meta">${a.mass.toLocaleString()} kg · ${kmh(a.spd)} km/h${groupOf(a) > 1 ? ` · ${groupOf(a)} of them` : ''}</div>`
      + (rec ? `<div class="recline">${esc(rec)}</div>` : '') + (S.prog && picked ? `<div class="vtp">${duiProgBits(id)}</div>` : '')
      + `<button class="linkbtn dkmore" data-info="${id}">Full stat line</button></div>`;
    const back = `<button class="btn" data-back="1" ${d.i ? '' : 'disabled'} aria-label="Back">‹</button>`;
    btns = prem || carried ? `${back}<button class="btn dkleave" disabled>${prem ? 'Not for sale' : 'Sell it below'}</button><button class="btn dktake" data-next="1">Next ›</button>`
      : picked ? `${back}<button class="btn dkleave" data-leave="1">Send back</button><button class="btn dktake" data-take="1">Keep ›</button>`
      : `${back}<button class="btn dkleave" data-leave="1">Leave</button><button class="btn dktake" data-take="1" ${cant ? 'disabled' : ''}>${cant ? `$${(a.price - duiLeft()).toLocaleString()} short` : `Take $${a.price}`}</button>`;
  }
  box.innerHTML = `<div class="dk"><div class="dkstrip">${strip}</div>${card}<div class="dkbtns">${btns}</div>${a && !duiPrem(id) ? '<p class="dkhint">Swipe right to take, left to leave</p>' : ''}${duiScore(false)}`
    + (S.prog ? `<div class="label">Your team: undo, sell or heal</div>${progTeamHTML(S.prog, true)}` : '') + '</div>';
}
// deck moves: take (draft it, next), leave (undraft if needed, next), next, back, jump
function duiDeckMove(kind, k){
  const d = duiDeckState(), id = d.order[d.i];
  if (kind === 'jump'){ d.i = k; return renderDraft(); }
  if (kind === 'back'){ d.i = Math.max(0, d.i - 1); return renderDraft(); }
  if (!id) return;
  if (kind === 'take'){ if (!S.team.has(id) && !duiToggle(id)) return renderDraft(); d.left.delete(id); }
  if (kind === 'leave'){ if (S.team.has(id) && !duiToggle(id)) return; d.left.add(id); }
  d.i = Math.min(d.order.length, d.i + 1); renderDraft(); renderActBar();
}
// swipe the deck card (pointer events, so touch and mouse both work); vertical scrolling stays with the page
function duiSwipe(box){
  let p = null;
  box.addEventListener('pointerdown', e => { const c = e.target.closest('#dkCard'); if (!c || e.target.closest('button') || DUI.ui !== 'deck') return; p = {x: e.clientX, y: e.clientY, c, id: e.pointerId, dx: 0}; });
  box.addEventListener('pointermove', e => {
    if (!p || e.pointerId !== p.id) return; p.dx = e.clientX - p.x;
    if (Math.abs(e.clientY - p.y) > 40 && Math.abs(p.dx) < 30){ p.c.style.transform = ''; p = null; return; } // a scroll, not a swipe
    p.c.style.transition = 'none'; p.c.style.transform = `translateX(${p.dx}px) rotate(${p.dx / 25}deg)`;
    p.c.querySelector('.take').style.opacity = clamp01(p.dx / 90); p.c.querySelector('.leave').style.opacity = clamp01(-p.dx / 90);
  });
  const end = e => {
    if (!p || e.pointerId !== p.id) return; const {c, dx} = p; p = null; c.style.transition = '';
    const take = dx > 80 && !c.classList.contains('cant') && !c.classList.contains('prem'), leave = dx < -80 && !c.classList.contains('prem');
    if (take || leave){ c.style.transform = `translateX(${take ? 120 : -120}%) rotate(${take ? 12 : -12}deg)`; c.style.opacity = 0; setTimeout(() => duiDeckMove(take ? 'take' : 'leave'), 160); }
    else { c.style.transform = ''; c.querySelectorAll('.stamp').forEach(s => { s.style.opacity = 0; }); }
  };
  box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
}

// the switcher, the container and the one dialog; built the first time a draftui flag is seen
function duiEls(){
  let box = $('draftAlt'); if (box) return box;
  const st = document.createElement('style'); st.textContent = DUI_CSS; document.head.appendChild(st);
  const sw = document.createElement('div'); sw.id = 'duiSwitch'; sw.className = 'duisw'; $('teamline').before(sw);
  sw.addEventListener('click', e => { const b = e.target.closest('button[data-ui]'); if (b && b.dataset.ui !== DUI.ui) duiSet(b.dataset.ui); });
  box = document.createElement('div'); box.id = 'draftAlt'; box.className = 'dui'; $('tiers').after(box);
  const dlg = document.createElement('dialog'); dlg.id = 'duiDlg'; dlg.innerHTML = '<div class="dlghd"><span class="label">Stat line</span><button class="btn" id="duiDlgX">Close</button></div><div class="detail" id="duiDlgBody"></div>'; document.body.appendChild(dlg);
  $('duiDlgX').addEventListener('click', () => dlg.close()); dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  box.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const ds = b.dataset;
    if (duiShop(b)) return;
    if (ds.info) return duiInfo(ds.info);
    if (ds.sort){ DUI.sort = ds.sort; return renderDraft(); }
    if ('role' in ds){ DUI.role = ds.role; if (ds.clear){ DUI.good = DUI.afford = false; } return renderDraft(); }
    if (ds.good){ DUI.good = !DUI.good; return renderDraft(); }
    if (ds.afford){ DUI.afford = !DUI.afford; return renderDraft(); }
    if (ds.open){ DUI.open = DUI.open === ds.open ? null : ds.open; return renderDraft(); }
    if (ds.jump != null) return duiDeckMove('jump', +ds.jump);
    if (ds.back) return duiDeckMove('back');
    if (ds.take) return duiDeckMove('take');
    if (ds.leave) return duiDeckMove('leave');
    if (ds.next) return duiDeckMove('next');
    if (ds.id){
      // keep the tapped row / tile in place when the page above it changes height
      const sel = `[data-id="${ds.id}"]`, top = b.getBoundingClientRect().top;
      DUI.flash = ds.id; duiToggle(ds.id); DUI.flash = null;
      if (DUI.ui === 'list'){ const nb = box.querySelector('.lrows ' + sel); if (nb){ const dy = nb.getBoundingClientRect().top - top; if (Math.abs(dy) > .5) window.scrollBy(0, dy); } }
    }
  });
  duiSwipe(box);
  document.addEventListener('keydown', e => {
    if (S.screen !== 'draft' || DUI.ui !== 'deck' || $('duiDlg').open || e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowRight'){ const c = $('dkCard'); if (c && !c.classList.contains('cant')) duiDeckMove(c.classList.contains('prem') ? 'next' : 'take'); }
    else if (e.key === 'ArrowLeft'){ const c = $('dkCard'); if (c && !c.classList.contains('prem')) duiDeckMove('leave'); }
    else if (e.key === 'Backspace') duiDeckMove('back');
  });
  return box;
}
function duiSet(ui){
  DUI.ui = ui; DUI.open = null;
  try { localStorage.setItem(DUI_KEY, ui); } catch(e){}
  try { const u = new URL(location.href); u.searchParams.set('draftui', ui); history.replaceState(history.state, '', u.href); } catch(e){}
  renderDraft(); renderActBar(); window.scrollTo({top: 0});
}
// the hook in renderDraft: false = the default cards render as usual
function draftAlt(){
  if (!DUI.on) return false;
  const box = duiEls(), alt = DUI.ui !== 'default';
  $('duiSwitch').innerHTML = `<span class="label">Draft screen <span style="color:var(--gold)">prototype</span></span><div class="seg">${Object.entries(DUI_NAMES).map(([k, t]) => `<button data-ui="${k}" aria-pressed="${DUI.ui === k}">${t}</button>`).join('')}</div>`;
  box.hidden = !alt; for (const id of ['tiers', 'teamline', 'detail']) $(id).hidden = alt;
  // the explanatory text folds behind a tap on the prototype screens (owner: less to scroll past)
  let help = $('duiHelp'); if (!help){ help = document.createElement('details'); help.id = 'duiHelp'; help.className = 'duihelp'; $('boardLede').after(help); help.addEventListener('toggle', () => { DUI.helpOpen = help.open; }); }
  $('boardLede').hidden = alt; help.hidden = !alt;
  if (!alt) return false;
  const lede = S.prog ? $('boardLede').textContent : $('boardLede').textContent.replace(/Tap a card to draft it;.*$/, DUI_HELP[DUI.ui]);
  help.innerHTML = `<summary>How this works</summary><p>${esc(lede)}</p>`; help.open = !!DUI.helpOpen;
  ({versus: duiVersus, list: duiList, deck: duiDeck})[DUI.ui](box);
  { const h = document.querySelector('header.top'); if (h) document.documentElement.style.setProperty('--hdrH', h.offsetHeight + 'px'); } // the sticky scoreboard sits just under the header
  return true;
}
const DUI_CSS = `
.duihelp{font-size:13.5px;color:var(--muted)} .duihelp summary{cursor:pointer;min-height:36px;display:flex;align-items:center;gap:6px;font-weight:600;color:var(--fg);list-style:none} .duihelp summary::-webkit-details-marker{display:none} .duihelp summary::before{content:'▸';color:var(--gold);transition:transform .15s} .duihelp[open] summary::before{transform:rotate(90deg)} .duihelp p{margin:4px 0 0;line-height:1.45}
.duisw{display:flex;align-items:center;gap:6px 10px;flex-wrap:wrap}
.duisw .seg button{font-family:var(--display);font-weight:800;font-size:14px;letter-spacing:.05em;text-transform:uppercase;padding-inline:12px}
.dui{display:flex;flex-direction:column;gap:12px;min-width:0}
.dprice{font-family:var(--mono);font-size:12.5px;font-weight:600}
.duiscore{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:3px 12px;background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:9px 12px;position:sticky;top:var(--hdrH, 0px);z-index:15;box-shadow:0 6px 12px -8px rgba(0,0,0,.6)} /* stays under the header while you scroll (owner) */
.duiscore .sd{display:flex;flex-direction:column;gap:0;min-width:0}
.duiscore .sd.foe{text-align:right;align-items:flex-end}
.duiscore .sd.you .label{color:var(--you)} .duiscore .sd.foe .label{color:var(--foe)}
.duiscore b{font-family:var(--mono);font-size:19px;font-weight:600;line-height:1.2}
.duiscore .sub{font-size:11.5px;color:var(--muted)}
.duiscore .v{font-family:var(--mono);font-size:12.5px;margin-top:2px}
.duiscore .sd.you .v{color:var(--you)} .duiscore .sd.foe .v{color:var(--foe)}
.duiscore .tug{grid-column:1/-1;display:flex;height:7px;border-radius:4px;overflow:hidden;background:var(--foe);margin-top:4px}
.duiscore .tug i{display:block;background:var(--you);border-right:2px solid var(--bg)}
.duinote{grid-column:1/-1;font-size:11px;line-height:1.35;color:var(--muted);margin-top:3px}
.duinote summary{cursor:pointer;color:var(--muted)}
.duimsg{grid-column:1/-1;font-size:12.5px;color:var(--gold);min-height:0}
.duimsg:empty{display:none}
.vempty{margin:4px 2px;font-size:12.5px;color:var(--muted)}
/* versus */
.vs{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;align-items:start}
.vcol{border-radius:var(--r);padding:8px 6px 6px;display:flex;flex-direction:column;gap:4px;min-width:0;min-height:140px}
.vcol h3{font-size:16px;padding-inline:4px}
.vcol .vh{margin:0 4px 2px;font-size:11px;color:var(--muted)}
.vcol.you{border:1.5px solid color-mix(in srgb, var(--you) 60%, var(--line));background:color-mix(in srgb, var(--you) 6%, var(--bg))}
.vcol.you h3{color:var(--you)}
.vcol.foe{border:1.5px solid color-mix(in srgb, var(--foe) 55%, var(--line));background:color-mix(in srgb, var(--foe) 6%, var(--bg))}
.vcol.foe h3{color:var(--foe)}
.vlist{display:grid;grid-template-columns:minmax(0,1fr);gap:4px}
.vt{position:relative;min-width:0}
.vtm{width:100%;display:grid;grid-template-columns:30px minmax(0,1fr);gap:6px;align-items:start;text-align:left;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:5px 6px 6px;min-height:48px}
.vtm .tok{width:30px!important;height:30px!important}
.vtb{display:flex;flex-direction:column;gap:2px;min-width:0}
.vtn{font-family:var(--display);font-weight:800;font-size:14px;line-height:1.05;text-transform:uppercase;letter-spacing:.02em;overflow-wrap:anywhere;padding-right:16px}
.vtl{display:flex;flex-wrap:wrap;gap:3px;align-items:center}
.vtl .bdg{font-size:9.5px;padding:0 5px}
.vts{font-size:11px;line-height:1.3;color:var(--muted);display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
.vts b{color:var(--fg)}
.vt.cant .vtm{opacity:.42}
.vt.prem .vtm{border-color:var(--foe)}
.vt.flash .vtm{animation:duiflash .7s ease-out}
@keyframes duiflash{from{box-shadow:0 0 0 3px var(--gold)}to{box-shadow:0 0 0 0 transparent}}
.vti{position:absolute;top:0;right:0;width:40px;height:44px;background:none;border:0;display:flex;align-items:flex-start;justify-content:flex-end;padding:5px}
.vti span{display:block;width:18px;height:18px;border-radius:50%;border:1px solid var(--muted);font:600 11px/16px var(--mono);color:var(--muted);text-align:center;background:var(--panel)}
.vtp{display:flex;flex-direction:column;gap:4px;padding:4px 2px 2px}
.hpb{display:flex;gap:2px;align-items:center;flex-wrap:wrap}
.hpb i{display:block;width:26px;height:5px;border-radius:3px;background:var(--line);overflow:hidden}
.hpb i b{display:block;height:100%}
.dacts{display:flex;gap:4px;flex-wrap:wrap}
.dacts .btn{min-height:38px;padding:4px 9px;font-size:12.5px;flex:1 1 auto}
@media (min-width:821px){ .vlist{grid-template-columns:repeat(2, minmax(0,1fr))} .vtm .tok{width:44px!important;height:44px!important} .vtm{grid-template-columns:44px minmax(0,1fr)} .vtn{font-size:16px} .vts{font-size:12px} }
/* list */
.lteam{display:flex;flex-wrap:wrap;gap:6px}
.lteam .chip{min-height:40px;font-weight:600}
.lteam .chip .x{color:var(--muted);font-size:15px;margin-left:2px}
.ltools{display:flex;flex-direction:column;gap:8px;min-width:0}
.lsort{display:flex;width:100%}
.lsort button{flex:1 1 0;font-family:var(--body);font-weight:600;font-size:13px;padding-inline:4px}
.chips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin-inline:-16px;padding-inline:16px}
.chips::-webkit-scrollbar{display:none}
.chips button{flex:0 0 auto;min-height:40px;border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:6px 13px;font-size:13px;font-weight:600;color:var(--muted)}
.chips button[aria-pressed="true"]{background:var(--fg);color:var(--bg);border-color:var(--fg)}
.lrows{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:var(--r);overflow:hidden}
.lr{border-top:1px solid var(--line);background:var(--panel);min-width:0}
.lr:first-child{border-top:0}
.lr.picked{background:color-mix(in srgb, var(--you) 10%, var(--panel));box-shadow:inset 3px 0 0 var(--you)}
.lr.prem{box-shadow:inset 3px 0 0 var(--foe)}
.lrh{display:flex;align-items:stretch;min-width:0}
.lrm{flex:1 1 auto;min-width:0;display:grid;grid-template-columns:40px minmax(0,1fr) auto;gap:10px;align-items:center;text-align:left;background:none;border:0;padding:8px 6px 8px 10px;min-height:62px}
.lrm .tok{width:40px!important;height:40px!important}
.lr.cant .lrm{opacity:.45}
.lrt{min-width:0;display:flex;flex-direction:column;gap:2px}
.lrn{font-family:var(--display);font-weight:800;font-size:16px;line-height:1.1;text-transform:uppercase;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lrs{font-size:12px;line-height:1.3;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lrs b{color:var(--fg)}
.lr.open .lrs{white-space:normal}
.lr3{display:flex;gap:4px;flex-wrap:nowrap;overflow:hidden;align-items:center}
.lr.open .lr3{flex-wrap:wrap}
.lr3 .bdg{font-size:9.5px;padding:0 6px;white-space:nowrap}
.lr3 .recline{white-space:nowrap;font-size:10px}
.lrr{display:flex;flex-direction:column;align-items:flex-end;gap:5px}
.lradd{width:28px;height:28px;border-radius:50%;border:1.5px solid var(--line);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;color:var(--muted)}
.lr.picked .lradd{background:var(--you);border-color:var(--you);color:var(--bg)}
.lrx{flex:0 0 44px;background:none;border:0;border-left:1px solid var(--line);color:var(--muted);font-size:17px}
.lr.open .lrx{color:var(--gold);transform:rotate(180deg);border-left:0;border-right:1px solid var(--line)}
.lrd{margin:0 8px 10px}
/* deck */
.dk{display:flex;flex-direction:column;gap:10px;max-width:560px;width:100%;margin-inline:auto;min-width:0}
.dkstrip{display:flex;flex-wrap:wrap;gap:3px}
.dkdot{position:relative;width:40px;height:40px;padding:0;border:0;background:none;display:flex;align-items:center;justify-content:center;border-radius:50%}
.dkdot .tok{width:30px!important;height:30px!important;opacity:.85}
.dkdot.taken .tok{box-shadow:0 0 0 2px var(--bg),0 0 0 4px var(--you);opacity:1}
.dkdot.left .tok{filter:grayscale(1);opacity:.4}
.dkdot.prem .tok{box-shadow:0 0 0 2px var(--bg),0 0 0 4px var(--foe)}
.dkdot.now::after{content:"";position:absolute;left:12px;right:12px;bottom:0;height:3px;border-radius:2px;background:var(--gold)}
.dkcard{position:relative;background:var(--panel);border:1.5px solid var(--line);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:9px;touch-action:pan-y;user-select:none;-webkit-user-select:none;transition:transform .16s ease-out, opacity .16s;overflow:hidden}
.dkcard.taken{border-color:var(--you);background:color-mix(in srgb, var(--you) 7%, var(--panel))}
.dkcard.prem{border-color:var(--foe)}
.dkcard.cant .dkface{filter:grayscale(.6)}
.dkhd{display:grid;grid-template-columns:104px minmax(0,1fr);gap:14px;align-items:center}
.dkface{width:104px;height:104px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-family:var(--display);font-weight:900;font-size:30px;border-width:3px!important}
.dkhb{min-width:0;display:flex;flex-direction:column;gap:3px}
.dkname{font-family:var(--display);font-weight:900;font-size:28px;line-height:1;text-transform:uppercase;letter-spacing:.02em;overflow-wrap:anywhere}
.dkprice{font-family:var(--mono);font-size:21px;font-weight:600;line-height:1.1}
.dksig{background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:9px 12px;font-size:14px;line-height:1.35;color:var(--muted)}
.dksig b{display:block;font-family:var(--display);font-weight:800;font-size:18px;letter-spacing:.04em;text-transform:uppercase;color:var(--fg)}
.dkcard .bars{grid-template-columns:62px 1fr;font-size:10.5px;gap:5px 8px}
.dkcard .bar{height:7px}
.dkcard .meta{font-family:var(--mono);font-size:12px;color:var(--muted)}
.dkmore{align-self:flex-start}
.stamp{position:absolute;top:18px;z-index:2;font-family:var(--display);font-weight:900;font-size:30px;letter-spacing:.08em;text-transform:uppercase;padding:2px 12px;border:3px solid;border-radius:8px;opacity:0;pointer-events:none}
.stamp.take{right:16px;color:var(--you);transform:rotate(10deg)}
.stamp.leave{left:16px;color:var(--foe);transform:rotate(-10deg)}
.dkend{gap:10px}
.dkend .dkname{font-size:26px}
.dkbtns{display:grid;grid-template-columns:52px minmax(0,1fr) minmax(0,1.3fr);gap:8px;position:sticky;bottom:calc(76px + env(safe-area-inset-bottom, 0px));z-index:5;background:var(--bg);padding-block:6px;margin-block:-6px}
.dkbtns .btn{min-height:54px;font-size:16px}
.dkbtns .btn:only-child{grid-column:1/-1}
.dkbtns .btn[data-back]:first-child:nth-last-child(2){grid-column:1}
.dkbtns .btn[data-jump]{grid-column:2/-1}
.dkleave{color:var(--foe);border-color:color-mix(in srgb, var(--foe) 55%, var(--line))!important}
.dktake{background:var(--you)!important;color:#0a201c!important;border-color:var(--you)!important;font-family:var(--display);font-weight:900;font-size:19px!important;letter-spacing:.05em;text-transform:uppercase}
.dktake:disabled{background:var(--panel2)!important;color:var(--muted)!important;border-color:var(--line)!important}
.dkhint{margin:-4px 0 0;text-align:center;font-size:11.5px;color:var(--muted)}
#duiDlg{max-width:760px;width:calc(100% - 24px);max-height:86vh;background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:12px;padding:12px}
#duiDlg::backdrop{background:rgba(0,0,0,.6)}
#duiDlg .dlghd{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
#duiDlg .detail{border:0;padding:4px}
.dkbtns .btn:disabled{opacity:1;color:var(--dim);background:var(--panel)}
@media (max-width:560px){ .dkhd{grid-template-columns:84px minmax(0,1fr)} .dkface{width:84px;height:84px} .dkname{font-size:25px} .dkprice{font-size:19px} .dkcard{padding:12px;gap:8px} .dksig{font-size:13px;padding:8px 10px} .dksig b{font-size:16px} }
`;

// ---------- init ----------
function renderAll(){ renderBudget(); renderDraft(); renderArenaOpts(); renderActBar(); }
window.addEventListener('resize', () => { { const h = document.querySelector('header.top'); if (h) document.documentElement.style.setProperty('--hdrH', h.offsetHeight + 'px'); } if (S.screen === 'deploy'){ sizeCanvas($('deployCanvas')); drawDeploy(); } if (S.screen === 'fight') sizeCanvas($('fightCanvas')); });
$('seedLbl').textContent = S.seed;
syncSpeed();
if (!loadHash()){
  dealNewBoard(); renderAll();
  const run = loadRun(); // a progressive run in progress picks up where it left off after a reload
  if (PROG_ON && run && !run.over){ S.prog = run; go('draft'); showNotice(`<b>Run resumed</b> <span>Round ${run.k + 1} of ${RN}, $${run.money.toLocaleString()} to spend.</span>`); }
  else go('arena');
}
requestAnimationFrame(frame);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (S.screen === 'deploy') drawDeploy(); });
})();
