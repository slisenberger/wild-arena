(function(){
'use strict';
const A = window.Arena;
const $ = id => document.getElementById(id);
const TIER = {400:'var(--gold)', 300:'var(--orange)', 200:'var(--red)', 100:'var(--slate)'};
const TIERHEX = {400:'#f0b429', 300:'#ec7a2c', 200:'#d8473b', 100:'#8297aa'};
const C = {you:'#4fd1bd', foe:'#ef6b4b', bone:'#d9cfb4', fg:'#ece6d3', muted:'#949d8c', gold:'#f0b429', orange:'#ec7a2c', red:'#d8473b', slate:'#8297aa'};
const BUDGET = 1000;
const maxStr = Math.max(...A.ANIMALS.map(a => Math.sqrt(A.hpOf(a) * a.dmg / a.cd)));

const S = window.__wa = {
  team: new Set(), focus:'elephant', terrain:'savanna', mode:'wild', mount:'', pos:{}, youPos:null, seed: (Math.random()*1e6|0) + 1,
  screen:'draft', world:null, playT:0, playing:true, speed:2, sel:0, lastTs:0, dur:120
};

// ---------- helpers ----------
const spent = () => [...S.team].reduce((s, id) => s + A.BY_ID[id].price, 0);
const fmtT = t => { t = Math.max(0, t); const m = Math.floor(t/60), s = Math.floor(t%60); return m + ':' + String(s).padStart(2,'0'); };
const kmh = v => Math.round(v * 3.6);
function strengthOf(a){ return Math.sqrt(A.hpOf(a) * a.dmg / a.cd); }
function tok(a, size){ const d = document.createElement('span'); d.className = 'tok'; d.style.cssText = tokStyle(a); d.title = a.name; if (size) { d.style.width = d.style.height = size + 'px'; } if (!FACES[a.id]) d.textContent = a.abbr; return d; }
function tokStyle(a){ return FACES[a.id] ? `background:#222 url(${FACES[a.id]}) center/cover;border:2px solid ${TIERHEX[a.price]}` : `background:${TIER[a.price] || '#f5f2ea'}`; }
function tokHTML(a, px){ return `<span class="tok" title="${esc(a.name)}" style="${tokStyle(a)};width:${px}px;height:${px}px;font-size:${Math.round(px*.4)}px">${FACES[a.id] ? '' : a.abbr}</span>`; }
const FACEIMG = {}; for (const id in FACES){ const im = new Image(); im.src = FACES[id]; FACEIMG[id] = im; }
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function terrainFit(a, tid){
  const out = [], load = A.heatLoad(a), snow = A.snowFactor(a), charger = a.gait === 'charge';
  if (tid === 'savanna'){ if (load >= 2.5) out.push(['bad', 'Cooks in the heat']); else if (load < 1) out.push(['good', 'Built for heat']); }
  if (tid === 'river'){ if (a.water >= .8) out.push(['good', 'Rules the river']); else if (load >= 6) out.push(['bad', 'Runs hot']); if (charger && a.water < .8) out.push(['bad', 'Charge founders in water']); }
  if (tid !== 'river' && a.tags.includes('waterbound')) out.push(['bad', 'No water: weak']);
  if (tid === 'forest'){ if (a.tags.includes('ambush')) out.push(['good', 'Ambush ×2']); if (charger) out.push(['bad', 'Crashes into trees']); else if (a.mass > 800) out.push(['bad', 'Slowed by trees']); }
  if (tid === 'tundra'){ if (snow >= .92) out.push(['good', 'At home in snow']); else if (snow < .7) out.push(['bad', `Bogged down (${Math.round(snow*100)}% speed)`]); if (a.cold < .5) out.push(['bad', 'Stiff in the cold']); }
  return out;
}
function badgesHTML(a){ return terrainFit(a, S.terrain).map(([k, t]) => `<span class="bdg ${k}">${t}</span>`).join(''); }
// ---------- navigation ----------
function go(screen){
  S.screen = screen;
  for (const id of ['arena','draft','deploy','fight','lab']) $('s-' + id).hidden = id !== screen;
  document.querySelectorAll('#steps button').forEach(b => b.setAttribute('aria-current', b.dataset.s === screen ? 'true' : 'false'));
  if (screen === 'deploy') { renderMounts(); sizeCanvas($('deployCanvas')); drawDeploy(); }
  if (screen === 'draft') renderDraft();
  if (screen === 'fight') { sizeCanvas($('fightCanvas')); }
  if (screen === 'lab') renderLabDesc();
  window.scrollTo({top:0});
}
document.querySelectorAll('#steps button').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.s === 'fight' && !S.world) { startBattle(); return; }
  go(b.dataset.s);
}));

// ---------- draft ----------
function renderBudget(){
  const sp = spent();
  $('spent').textContent = '$' + sp.toLocaleString();
  const m = $('meter'); m.innerHTML = '';
  for (let i = 0; i < 10; i++){ const x = document.createElement('i'); if (i < sp/100) x.className = sp > BUDGET ? 'over' : 'on'; m.appendChild(x); }
}
function renderDraft(){
  const tiers = $('tiers'); tiers.innerHTML = '';
  const left = BUDGET - spent();
  for (const p of [400,300,200,100]){
    const row = document.createElement('div'); row.className = 'tier';
    const tag = document.createElement('div'); tag.className = 'tierTag'; tag.style.background = TIER[p]; tag.textContent = '$' + p; row.appendChild(tag);
    const cards = document.createElement('div'); cards.className = 'cards';
    for (const a of A.ANIMALS.filter(x => x.price === p)){
      const picked = S.team.has(a.id);
      const c = document.createElement('button'); c.className = 'card' + (picked ? ' picked' : '') + (!picked && a.price > left ? ' cant' : '');
      c.setAttribute('aria-pressed', picked);
      const r1 = document.createElement('div'); r1.className = 'row1'; r1.appendChild(tok(a, 46));
      const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = a.name; r1.appendChild(nm);
      c.appendChild(r1);
      const st = document.createElement('div'); st.className = 'styleTag'; st.textContent = a.style; c.appendChild(st);
      const fit = badgesHTML(a); if (fit){ const bd = document.createElement('div'); bd.className = 'badges'; bd.innerHTML = fit; c.appendChild(bd); }
      const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = `${a.mass.toLocaleString()} kg · ${kmh(a.spd)} km/h`; c.appendChild(meta);
      const bars = document.createElement('div'); bars.className = 'bars';
      const rows = [['Power', strengthOf(a)/maxStr], ['Armor', a.armor/.6], ['Speed', a.spd/20], ['Stamina', Math.min(1, a.stam/60)]];
      for (const [k,v] of rows){ const l = document.createElement('span'); l.textContent = k; const b = document.createElement('div'); b.className = 'bar'; const f = document.createElement('b'); f.style.width = Math.round(Math.min(1,v)*100) + '%'; b.appendChild(f); bars.append(l, b); }
      c.appendChild(bars);
      const ck = document.createElement('span'); ck.className = 'check'; ck.textContent = '✓'; c.appendChild(ck);
      c.addEventListener('click', () => {
        S.focus = a.id;
        if (S.team.has(a.id)) S.team.delete(a.id);
        else if (a.price <= BUDGET - spent()) S.team.add(a.id);
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
  if (!S.team.size){ const s = document.createElement('span'); s.className = 'label'; s.textContent = 'No animals drafted yet. You can fight alone, but you will not like it.'; tl.appendChild(s); }
  for (const id of S.team){ const a = A.BY_ID[id]; const ch = document.createElement('span'); ch.className = 'chip'; ch.appendChild(tok(a)); ch.append(a.name + ' $' + a.price); tl.appendChild(ch); }
  renderDetail();
}
function renderDetail(){
  const a = A.BY_ID[S.focus]; const d = $('detail');
  const hp = A.hpOf(a);
  const stats = [
    ['Price', '$' + a.price], ['Mass', a.mass.toLocaleString() + ' kg'], ['Top speed', kmh(a.spd) + ' km/h'],
    ['Durability', hp.toLocaleString() + ' hp'], ['Strike', a.dmg + ' / ' + a.cd + ' s'], ['Armor', Math.round(a.armor*100) + '%'],
    ['Reach', a.reach + ' m'], ['Sprint', a.stam + ' s'], ['Breaks at', Math.round(a.flee*100) + '% morale'],
    ['Heat tolerance', a.heat.toFixed(2)], ['Cold tolerance', a.cold.toFixed(2)], ['Strikes up to', a.strikeH + ' m'], ['Carries you at', a.mountH ? a.mountH + ' m' : 'too small'],
  ];
  d.innerHTML = `<div><div style="display:flex;gap:10px;align-items:center;margin-bottom:10px">${tokHTML(a, 64)}<h3 style="font-size:22px">${esc(a.name)}</h3></div>
    <div class="stats">${stats.map(([k,v]) => `<div class="stat"><div class="v">${esc(v)}</div><div class="k">${k}</div></div>`).join('')}</div></div>
    <div><div class="styleTag" style="font-size:15px">${esc(a.style)}</div><p style="margin:4px 0 10px">${esc(a.how)}</p>${badgesHTML(a) ? `<div class="badges" style="margin-bottom:10px">${badgesHTML(a)} <span class="notes" style="font-size:12px">in the ${esc(A.TERRAINS[S.terrain].name.toLowerCase())}</span></div>` : ''}<div class="label" style="margin-bottom:6px">Traits</div><ul class="traits">${a.traits.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    <p class="notes" style="margin-top:10px">${a.pred ? 'Predator: hunts by weighing meat against risk, and gets hungrier as the fight goes on.' : 'Herbivore: fights intruders, predators and anything that wounds it.'}</p></div>`;
}
$('toDeployD').addEventListener('click', () => go('deploy'));
$('clearTeam').addEventListener('click', () => { S.team.clear(); S.world = null; S.pos = {}; renderAll(); });

// ---------- arena setup ----------
const TCOL = {savanna:'radial-gradient(circle at 70% 35%,#3d4a1f 0 14%,transparent 15%),linear-gradient(135deg,#5a4a1d,#2c2614)', river:'linear-gradient(90deg,#26341f 0 44%,#1f5165 44% 56%,#26341f 56%)', forest:'radial-gradient(circle at 30% 40%,#244a2c 0 18%,transparent 19%),radial-gradient(circle at 70% 60%,#244a2c 0 22%,transparent 23%),#17241a', tundra:'linear-gradient(135deg,#55606a,#2f363d)'};
function renderArenaOpts(){
  const to = $('terrainOpts'); to.innerHTML = '';
  for (const T of Object.values(A.TERRAINS)){
    const b = document.createElement('button'); b.className = 'opt'; b.setAttribute('aria-pressed', S.terrain === T.id);
    b.innerHTML = `<div class="sw" style="background:${TCOL[T.id]}"></div><h3>${T.name}</h3><p>${esc(T.desc)}</p>`;
    b.addEventListener('click', () => { S.terrain = T.id; S.world = null; S.pos = {}; S.youPos = null; renderArenaOpts(); renderDraft(); });
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
}
$('toDraft').addEventListener('click', () => go('draft'));

// ---------- mount picker ----------
function bestMount(team){ team = team || [...S.team]; let b = '', h = 0; for (const id of team){ const m = A.BY_ID[id].mountH; if (m > h){ h = m; b = id; } } return b; }
function reachersOf(h, team){ return A.ANIMALS.filter(a => !team.includes(a.id) && a.strikeH >= h).map(a => a.name); }
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
      (a.mass < 700 || a.id === 'giraffe' ? `A ${a.mass < 700 ? 'small' : 'skittish'} mount doesn't fight while carrying you: it runs from threats at ${Math.round(a.spd * Math.max(.6, 1 - .6 * 75 / a.mass) * 3.6)} km/h and only bites back if grabbed.` : 'A heavy mount holds its ground near you and fights anything within 9 m.') +
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
function groundFor(terrain, trees, w, h, shade){
  shade = shade || [];
  const key = terrain + w + 'x' + h + ':' + trees.map(t => t.x.toFixed(1)).join(',') + ':' + shade.map(t => t.x.toFixed(1)).join(',');
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
  const T = A.TERRAINS[terrain];
  if (T.water){
    const x0 = T.water.x0 * sc, x1 = T.water.x1 * sc;
    g.fillStyle = '#5c5034'; g.fillRect(x0 - sc*.8, 0, sc*.9, h); g.fillRect(x1 - sc*.1, 0, sc*.9, h);
    const grd = g.createLinearGradient(x0, 0, x1, 0); grd.addColorStop(0, '#22596e'); grd.addColorStop(.5, '#173f52'); grd.addColorStop(1, '#22596e');
    g.fillStyle = grd; g.fillRect(x0, 0, x1 - x0, h);
    for (const [a, b] of T.water.fords){
      g.fillStyle = '#6f6a4a'; g.fillRect(x0, a*sc, x1 - x0, (b - a)*sc);
      g.fillStyle = 'rgba(90,150,170,.35)'; g.fillRect(x0, a*sc, x1 - x0, (b - a)*sc);
      g.fillStyle = 'rgba(236,230,211,.75)'; g.font = `800 ${Math.max(9, sc*1.4)}px "Big Shoulders Display", sans-serif`; g.textAlign = 'center'; g.fillText('FORD', (x0 + x1) / 2, (a + b) / 2 * sc + sc*.5); g.textAlign = 'left';
    }
    g.strokeStyle = 'rgba(160,210,225,.18)'; g.lineWidth = sc*.15;
    for (let i = 0; i < 40; i++){ const x = x0 + R()*(x1 - x0 - sc*3), y = R()*h; if (T.water.fords.some(([a, b]) => y >= a*sc && y <= b*sc)) continue; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + sc*1.5, y - sc*.5, x + sc*3, y); g.stroke(); }
  }
  if (T.snow){ g.fillStyle = 'rgba(240,245,250,.09)'; for (let i = 0; i < 70; i++){ g.beginPath(); g.ellipse(R()*w, R()*h, sc*(3+R()*9), sc*(1+R()*2.5), R()*.6 - .3, 0, 7); g.fill(); } }
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
function absPlacements(){
  const out = {}, team = [...S.team], h = A.homeFor(S.terrain);
  team.forEach((id, i) => {
    if (S.pos[id]) { out[id] = S.pos[id]; return; }
    const dp = A.defaultPost(S.terrain, id); if (dp){ out[id] = dp; return; }
    const p = A.defaultPlacement(team, id, i), y = youAt(); out[id] = {x: y.x + p.dx, y: y.y + p.dy};
  });
  return out;
}
function currentPlacements(){ const y = youAt(), abs = absPlacements(), out = {}; for (const id in abs) out[id] = {dx: abs[id].x - y.x, dy: abs[id].y - y.y}; return out; }
function makeCfg(){ return { team:[...S.team], placements:currentPlacements(), human:youAt(), terrain:S.terrain, mode:S.mode, mount:(S.mount && S.team.has(S.mount)) ? S.mount : null, seed:S.seed }; }
function drawDeploy(){
  deployWorld = A.setup(makeCfg());
  const cv = $('deployCanvas'); const g = cv.getContext('2d'); const sc = cv._scale;
  g.drawImage(groundFor(S.terrain, deployWorld.trees, cv.width, cv.height, deployWorld.shade), 0, 0);
  const H = deployWorld.human, z = A.zoneFor(S.terrain);
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
  const pos = e => { const r = cv.getBoundingClientRect(); return { x:(e.clientX - r.left) / r.width * A.W, y:(e.clientY - r.top) / r.height * A.H }; };
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
      const nu = A.clampPlace(S.terrain, A.HUMAN, p.x, p.y), dx = nu.x - old.x, dy = nu.y - old.y;
      // escorts come with you; guards on a post stay where they are
      for (const id in abs){ const q = abs[id]; if (Math.hypot(q.x - old.x, q.y - old.y) <= A.ESCORT_R) abs[id] = A.clampPlace(S.terrain, A.BY_ID[id], q.x + dx, q.y + dy); }
      S.pos = abs; S.youPos = nu;
      if (S.mount && S.team.has(S.mount)) S.pos[S.mount] = Object.assign({}, S.youPos);
    } else {
      S.pos = absPlacements(); S.pos[drag] = A.clampPlace(S.terrain, A.BY_ID[drag], p.x, p.y);
    }
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
  const w = A.simulate(makeCfg(), true);
  S.world = w; S.dur = w.result.t; S.playT = 0; S.playing = true; S.sel = 0;
  $('scrub').max = S.dur.toFixed(1); $('scrub').value = 0;
  renderMarks(); $('report').hidden = true; $('banner').innerHTML = '';
  go('fight');
  renderReport(false);
  S.lastTs = 0;
}
$('rematch').addEventListener('click', () => { S.seed = (Math.random()*1e6|0) + 1; $('seedLbl').textContent = S.seed; startBattle(); });
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
  // draw order: big first, riders last
  const order = fr.u.map((u, i) => i).sort((a, b) => (fr.u[a][9] - fr.u[b][9]) || (U[b].s.mass - U[a].s.mass));
  for (const i of order){
    const u = fr.u[i]; if (u[7] !== 1) continue;
    const unit = U[i]; const s = unit.s; const isH = unit.side === 'H';
    const x = u[0]*sc, y = u[1]*sc; const rr = Math.max(isH ? 8 : 10, unit.r * sc * 1.1) * (u[9] > 0 && isH ? .85 : 1);
    // heat glow
    if (u[3] > .35){ const a = Math.min(.85, (u[3]-.35) * 1.1); const grd = g.createRadialGradient(x, y, rr*.7, x, y, rr*1.9); grd.addColorStop(0, `rgba(236,122,44,${a})`); grd.addColorStop(1, 'rgba(236,122,44,0)'); g.fillStyle = grd; g.beginPath(); g.arc(x, y, rr*1.9, 0, 7); g.fill(); }
    if (u[12]){ g.strokeStyle = C.gold; g.lineWidth = 2; g.beginPath(); g.arc(x, y, rr + 4, 0, 7); g.stroke(); }
    // body
    g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.arc(x + sc*.25, y + sc*.35, rr, 0, 7); g.fill();
    g.fillStyle = isH ? '#f5f2ea' : unit.side === 'P' ? '#1e5c53' : '#6b2a1d';
    g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill();
    const im = !isH && FACEIMG[s.id];
    if (im && im.complete && im.naturalWidth){ g.save(); g.beginPath(); g.arc(x, y, rr, 0, 7); g.clip(); g.globalAlpha = u[4] === 'flee' ? .55 : u[15] === 'stalk' ? .6 : 1; g.drawImage(im, x - rr, y - rr, rr*2, rr*2); g.restore(); }
    // tier ring
    g.lineWidth = Math.max(2.5, rr*.22);
    g.strokeStyle = isH ? '#ffffff' : unit.side === 'P' ? C.you : C.foe;
    if (u[4] === 'flee') g.setLineDash([3, 3]);
    g.beginPath(); g.arc(x, y, rr, 0, 7); g.stroke(); g.setLineDash([]);
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
  g.drawImage(groundFor(S.terrain_used || w.T.id, w.trees, cv.width, cv.height, w.shade), 0, 0);
  if (w.mode === 'allout'){ g.fillStyle = C.foe; for (let i = 0; i < 6; i++) g.fillRect((A.W-1.2)*sc, (6 + i*10.8 - 2)*sc, sc*1.2, sc*4); }
  const fr = frameAt(S.playT);
  drawUnits(g, sc, w, fr, w.events, S.playT, {});
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
$('log').addEventListener('click', e => { const d = e.target.closest('[data-t]'); if (d){ S.playT = Math.max(0, +d.dataset.t - 1.5); S.playing = false; } });

const HZ = A.MATCH_T;
function bestKey(){ return 'wa-best:' + [S.terrain, S.mode, [...S.team].sort().join('+'), S.mount || 'foot'].join('|'); }
function readBest(){ try { return +localStorage.getItem(bestKey()) || 0; } catch(e){ return 0; } }
function writeBest(v){ try { localStorage.setItem(bestKey(), String(v)); } catch(e){} }
function renderReport(show){
  const w = S.world; if (!w || !show) return;
  const res = w.result; const sum = A.summarize(w);
  const b = $('banner');
  const score = res.score, prev = readBest(), isBest = score > prev + .05;
  if (isBest) writeBest(score);
  const bestLine = isBest ? (prev ? `New best for this draft here (was ${fmtT(prev)}).` : 'First run of this draft here.') : `Best for this draft here: ${fmtT(prev)}.`;
  if (res.survived){
    const why = res.why === 'cleared' ? `The other side was dead, routed or full by ${fmtT(res.t)}.` : res.why === 'quiet' ? `Nothing came at you for ${A.QUIET_T} s, so the other side gave up at ${fmtT(res.t)}.` : `You held out the full ${fmtT(HZ)}.`;
    b.innerHTML = `<div class="banner win"><span class="big">Survived · ${fmtT(HZ)}</span><span>${why} Full score. ${bestLine}</span></div>`;
  } else {
    const k = A.BY_ID[res.killer];
    b.innerHTML = `<div class="banner lose"><span class="big">You lasted ${fmtT(score)}</span><span>Killed by the ${esc(k ? k.name : 'unknown')}. ${bestLine}</span></div>`;
  }
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
  const on = {}, off = {}; A.ANIMALS.forEach(a => { on[a.id] = []; off[a.id] = []; });
  runBatched(N, i => {
    const team = A.randomDraft(R); const terrain = terr[i % 4];
    const w = A.simulate({team, terrain, mode:S.mode, mount:bestMount(team) || null, seed: 5000 + i});
    const sc = w.result.score;
    A.ANIMALS.forEach(a => (team.includes(a.id) ? on : off)[a.id].push(sc));
  }, p => $('pPrice').style.width = (p*100) + '%', () => {
    btn.disabled = false;
    const rows = A.ANIMALS.map(a => {
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

// ---------- init ----------
function renderAll(){ renderBudget(); renderDraft(); renderArenaOpts(); }
window.addEventListener('resize', () => { if (S.screen === 'deploy'){ sizeCanvas($('deployCanvas')); drawDeploy(); } if (S.screen === 'fight') sizeCanvas($('fightCanvas')); });
$('seedLbl').textContent = S.seed;
syncSpeed(); renderAll(); go('arena');
requestAnimationFrame(frame);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (S.screen === 'deploy') drawDeploy(); });
})();
