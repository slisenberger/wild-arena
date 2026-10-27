// Mobile UX audit: walks every flow of index.html in a phone, a small phone and a desktop context, screenshots each step
// and counts taps + scroll distance for the core loop. Usage: node research/ux_audit/audit.js <before|after>
// Optional 2nd arg: the index.html to serve (e.g. the old build). Writes research/ux_audit/<phase>/*.png and <phase>/metrics.json. Needs Playwright (chromium) only.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const phase = process.argv[2] || 'before';
const OUT = path.join(__dirname, phase); fs.mkdirSync(OUT, { recursive: true });

function serve(){
  return new Promise(res => {
    const srv = http.createServer((q, r) => { const f = process.argv[3] ? path.resolve(process.argv[3]) : path.join(ROOT, 'index.html'); r.writeHead(200, { 'content-type': 'text/html' }); fs.createReadStream(f).pipe(r); });
    srv.listen(0, () => res(srv));
  });
}
const DEV = {
  phone: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true },
  small: { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desk: { viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 },
};

// a scripted thumb: taps an element, scrolling it into view first like a person would; counts taps and scroll pixels
function thumb(page, log){
  const st = { taps: 0, scroll: 0, steps: [] };
  async function ensureVisible(sel){
    const el = page.locator(sel).first();
    await el.waitFor({ state: 'visible', timeout: 5000 });
    const box = await el.boundingBox();
    const vh = page.viewportSize().height;
    // what's fixed/sticky at the bottom covers part of the viewport
    const bottomCover = await page.evaluate(() => { const b = document.getElementById('actbar'); if (!b || b.hidden) return 0; const r = b.getBoundingClientRect(); return r.top < innerHeight ? innerHeight - r.top : 0; });
    const topCover = await page.evaluate(() => { const h = document.querySelector('header.top'); return h ? h.getBoundingClientRect().bottom : 0; });
    if (box.y < topCover || box.y + box.height > vh - bottomCover){
      const fixed = await el.evaluate(e => { for (let n = e; n; n = n.parentElement){ const p = getComputedStyle(n).position; if (p === 'fixed' || p === 'sticky') return true; } return false; });
      if (!fixed){
        const y0 = await page.evaluate(() => scrollY);
        await el.evaluate((e, tc) => { const r = e.getBoundingClientRect(); const mid = tc + (innerHeight - tc) / 2; scrollBy(0, r.top + r.height / 2 - mid); }, topCover);
        await page.waitForTimeout(60);
        const y1 = await page.evaluate(() => scrollY);
        st.scroll += Math.abs(y1 - y0); st.lastScroll = Math.abs(y1 - y0);
      }
    }
    return el;
  }
  return {
    st,
    async tap(sel, label){
      st.lastScroll = 0;
      const el = await ensureVisible(sel);
      const box = await el.boundingBox();
      const yb = await page.evaluate(() => scrollY); st.cardTopBefore = (await el.boundingBox()).y;
      try { await el.tap({ timeout: 3000 }); } catch(e){ await el.click(); }
      st.taps++; st.steps.push(label || sel); if (log) log(`tap ${label || sel} (${Math.round(box.width)}x${Math.round(box.height)}) after scrolling ${st.lastScroll || 0}px`);
      await page.waitForTimeout(120);
      st.lastJump = (await page.evaluate(() => scrollY)) - yb;
    },
  };
}

// every visible tappable thing on screen that's under 44 px on a side
async function smallTargets(page){
  return page.evaluate(() => {
    const out = [];
    for (const e of document.querySelectorAll('button, a, input, summary, select, label')){
      const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
      if (e.closest('[hidden]') || getComputedStyle(e).visibility === 'hidden') continue;
      if (e.tagName === 'LABEL' && !e.querySelector('input')) continue;
      if (r.width < 44 || r.height < 44){
        const t = (e.id ? '#' + e.id + ' ' : '') + (e.textContent || e.value || e.type || '').trim().replace(/\s+/g, ' ').slice(0, 28);
        out.push(`${t} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    return [...new Set(out)];
  });
}
const hscroll = page => page.evaluate(() => { const d = document.documentElement, W = d.clientWidth, over = d.scrollWidth - W; if (over > 0) console.log('hscroll culprits: ' + [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); if (r.right <= W + .5) return false; for (let n = e.parentElement; n && n !== document.body; n = n.parentElement){ const o = getComputedStyle(n).overflowX; if (o === 'auto' || o === 'hidden' || o === 'scroll') return false; } return true; }).map(e => e.tagName + '#' + e.id + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right)).slice(0, 8).join(', ')); return over; });
const docH = page => page.evaluate(() => document.documentElement.scrollHeight);
async function yOf(page, sel){ return page.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return Math.round(r.top + scrollY); }, sel); }

// touch drag through CDP (real touch events, so pointer events fire as on a phone)
async function touchDrag(page, x0, y0, x1, y1){
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / 8, y: y0 + (y1 - y0) * i / 8 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

async function run(){
  const srv = await serve();
  const URL = `http://localhost:${srv.address().port}/index.html`;
  const browser = await chromium.launch();
  const metrics = { phase, devices: {} };
  for (const [dname, dev] of Object.entries(DEV)){
    const ctx = await browser.newContext(dev);
    // same boards and seeds in every run and phase: Math.random is a fixed-seed generator
    await ctx.addInitScript(() => { let a = 12345; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); if (/hscroll culprits/.test(m.text())) console.log(dname, m.text()); });
    const m = metrics.devices[dname] = { screens: {}, errors };
    const shot = async (name, full) => { await page.waitForTimeout(150); await page.screenshot({ path: path.join(OUT, `${dname}_${name}.png`), fullPage: !!full, scale: 'css' }); };
    const note = async (name) => { m.screens[name] = { docH: await docH(page), hscroll: await hscroll(page), small: await smallTargets(page) }; };
    const lines = []; const log = s => lines.push(s);

    // ---- core loop, timed, as a first-time player ----
    const t0 = Date.now();
    await page.goto(URL); await page.waitForSelector('#s-arena:not([hidden]), #s-draft:not([hidden])');
    m.load_ms = Date.now() - t0;
    await shot('01_arena'); await shot('01_arena_full', true); await note('arena');
    m.arenaPrimaryY = await yOf(page, '#toDraft');
    m.arenaPrimaryInView = await page.evaluate(() => { const b = document.querySelector('#actbar:not([hidden]) .primary') || document.getElementById('toDraft'); const r = b.getBoundingClientRect(); return r.bottom <= innerHeight; });
    const T = thumb(page, log);
    const hasBar = await page.evaluate(() => !!document.getElementById('actbar'));
    await T.tap(hasBar ? '#actbar .primary' : '#toDraft', 'Draft your team');
    await shot('02_draft'); await shot('02_draft_full', true); await note('draft');
    m.draftPrimaryY = await yOf(page, '#toDeployD');
    // pick the first three affordable cards
    for (let k = 0; k < 3; k++){
      const idx = await page.evaluate(() => [...document.querySelectorAll('#tiers .card')].findIndex(c => !c.classList.contains('picked') && !c.classList.contains('cant')));
      if (idx < 0) break;
      const topOf = () => page.evaluate(i => document.querySelectorAll('#tiers .card')[i].getBoundingClientRect().top, idx);
      await T.tap(`#tiers .card >> nth=${idx}`, 'card'); // (tap() scrolls it into view first; the shift is measured after the tap)
      const tb = T.st.cardTopBefore; m['cardShiftAfterPick' + k] = Math.round((await topOf()) - tb);
    }
    await shot('03_draft_picked');
    if (hasBar){ // the formation step is optional now: visit it outside the counted loop for the screenshots and the drag test
      await page.click('#steps button[data-s="deploy"]'); await page.waitForTimeout(150);
      await page.evaluate(() => document.getElementById('deployCanvas').scrollIntoView({ block: 'center' })); await page.waitForTimeout(100);
      await shot('04_deploy'); await note('deploy');
      const pts = await page.evaluate(() => { const A = window.Arena, S = window.__wa; const cv = document.getElementById('deployCanvas'); const r = cv.getBoundingClientRect(); const W = A.setup({ board: S.board, team: [...S.team], terrain: S.terrain, seed: S.seed, placements: {}, human: A.homeFor(S.terrain) }); const u = W.units.find(u => u.side === 'P' && !u.rider); return u ? { x: r.left + u.x / A.W * r.width, y: r.top + u.y / A.H * r.height } : null; });
      const before = await page.evaluate(() => JSON.stringify([window.__wa.pos, window.__wa.youPos])), vy = await page.evaluate(() => scrollY);
      if (pts){ await touchDrag(page, pts.x, pts.y, pts.x - 30, pts.y + 25); m.dragMoved = (await page.evaluate(() => JSON.stringify([window.__wa.pos, window.__wa.youPos]))) !== before; m.dragScrolledPage = (await page.evaluate(() => scrollY)) !== vy; }
      await shot('05_deploy_dragged');
      await page.click('#autoForm'); await page.click('#steps button[data-s="draft"]'); await page.waitForTimeout(150);
      m.draftScrollRestored = await page.evaluate(() => scrollY);
    }
    const fightAfterDraft = hasBar ? '#actbar .primary' : '#toDeployD';
    await T.tap(fightAfterDraft, hasBar ? 'action bar' : 'Set formation');
    const onDeploy = await page.evaluate(() => !document.getElementById('s-deploy').hidden);
    if (onDeploy){
      await shot('04_deploy'); await note('deploy');
      m.deployPrimaryY = await yOf(page, '#startFight');
      // drag a unit on the deploy canvas with a real touch
      const cv = await page.locator('#deployCanvas').boundingBox();
      const before = await page.evaluate(() => JSON.stringify(window.__wa.pos));
      const pts = await page.evaluate(() => { const A = window.Arena, S = window.__wa; const cv = document.getElementById('deployCanvas'); const r = cv.getBoundingClientRect(); const id = [...S.team][0]; const W = A.setup({ board: S.board, team: [...S.team], terrain: S.terrain, seed: S.seed, placements: {}, human: A.homeFor(S.terrain) }); const u = W.units.find(u => u.side === 'P' && !u.rider); return u ? { x: r.left + u.x / A.W * r.width, y: r.top + u.y / A.H * r.height } : null; });
      if (pts){
        const vy = await page.evaluate(() => scrollY);
        await touchDrag(page, pts.x, pts.y, pts.x - 30, pts.y + 25);
        m.dragMoved = (await page.evaluate(() => JSON.stringify(window.__wa.pos))) !== before;
        m.dragScrolledPage = (await page.evaluate(() => scrollY)) !== vy;
      }
      await shot('05_deploy_dragged');
      await T.tap('#startFight', 'Release the animals');
    }
    m.tapsToFight = T.st.taps; m.scrollToFight = T.st.scroll; m.timeToFight_ms = Date.now() - t0;
    await page.waitForSelector('#s-fight:not([hidden])');
    await page.waitForTimeout(700);
    await shot('06_fight_start'); await note('fight');
    m.fightDur = await page.evaluate(() => window.__wa.dur);
    // skip to the result the way the UI offers
    if (hasBar) await T.tap('#actbar .primary', 'Skip to result (bar)');
    else { await T.tap('#speedSeg button[data-v="16"]', '16x'); }
    // real time to the result at the chosen speed (capped at 20 s, then jump)
    const tWait = Date.now();
    try { await page.waitForFunction(() => document.querySelector('#banner .banner'), null, { timeout: 20000 }); } catch(e){ await page.evaluate(() => { window.__wa.playT = window.__wa.dur; }); await page.waitForFunction(() => document.querySelector('#banner .banner')); m.resultNeededForce = true; }
    m.waitForResult_ms = Date.now() - tWait;
    await page.waitForTimeout(300);
    await page.evaluate(() => scrollTo(0, 0));
    await shot('07_result'); await shot('07_result_full', true); await note('result');
    m.bannerY = await yOf(page, '#banner'); m.reportY = await yOf(page, '#report');
    m.tapsToResult = T.st.taps; m.scrollToResult = T.st.scroll;
    // play again: same board (rematch)
    const again = hasBar ? '#actbar .primary' : '#rematch';
    await T.tap(again, 'Play again (same board)');
    await page.waitForTimeout(300); await shot('08_rematch');
    m.tapsLoop1 = T.st.taps; m.scrollLoop1 = T.st.scroll;
    // new board: whatever path the UI gives from the fight screen
    const tb0 = T.st.taps, sb0 = T.st.scroll;
    // the rematch is playing: let it finish (not counted), then take the UI's path to a new board
    await page.evaluate(() => { window.__wa.playT = window.__wa.dur; }); await page.waitForFunction(() => document.querySelector('#banner .banner')); await page.evaluate(() => scrollTo(0, 0));
    if (await page.$('#playNew')) {
      await T.tap('#actbar button:has-text("New board")', 'New board (bar)');
    } else { await T.tap('#steps button[data-s="draft"]', 'Draft step'); await T.tap('#newBoard', 'Deal a new board'); }
    await shot('09_newboard');
    for (let k = 0; k < 3; k++){
      const idx = await page.evaluate(() => [...document.querySelectorAll('#tiers .card')].findIndex(c => !c.classList.contains('picked') && !c.classList.contains('cant')));
      if (idx < 0) break; await T.tap(`#tiers .card >> nth=${idx}`, 'card');
    }
    if (hasBar){ await T.tap('#actbar .primary', 'action bar'); if (await page.evaluate(() => !document.getElementById('s-deploy').hidden)) await T.tap('#actbar .primary', 'action bar'); }
    else { await T.tap('#toDeployD', 'Set formation'); await T.tap('#startFight', 'Release'); }
    m.tapsNewBoardToFight = T.st.taps - tb0; m.scrollNewBoardToFight = T.st.scroll - sb0;
    await page.waitForSelector('#s-fight:not([hidden])');
    // fight screen controls mid-fight
    await page.evaluate(() => { window.__wa.playT = Math.min(window.__wa.dur, 40); window.__wa.playing = false; });
    await page.waitForTimeout(250); await shot('10_fight_mid'); await shot('10_fight_mid_full', true);
    m.steps = T.st.steps; m.log = lines;

    // ---- daily challenge ----
    await T.tap('#steps button[data-s="arena"]', 'Arena step');
    await T.tap('#daily', 'Daily challenge'); await shot('11_daily');
    // ---- stats panel (now there are games) ----
    await T.tap('#steps button[data-s="arena"]', 'Arena step');
    await page.evaluate(() => { const d = document.getElementById('statsPanel'); if (d) d.open = true; d && d.scrollIntoView(); });
    await shot('12_stats'); await note('stats');
    // ---- share link ----
    await page.goto(URL + '#g=1,m:river,b:1234'); await page.waitForTimeout(400);
    m.shareLinkOpens = await page.evaluate(() => !document.getElementById('s-draft').hidden && window.__wa.terrain === 'river' && window.__wa.boardSeed === 1234 && !document.getElementById('notice').hidden);
    await page.evaluate(() => scrollTo(0, 0)); await shot('13_sharelink'); await note('sharelink');
    // ---- lab ----
    await page.click('#steps button[data-s="lab"]'); await shot('14_lab'); await note('lab');
    // ---- credits ----
    await page.click('#creditsBtn'); await page.waitForTimeout(200); await shot('15_credits'); await page.click('#creditsClose');
    // ---- hidden modes still load ----
    for (const q of ['five', 'migration']){
      await page.goto(URL + `?${q}=1`); await page.waitForTimeout(300);
      m[q + 'Panel'] = await page.evaluate(q => !document.getElementById(q === 'five' ? 'fivePanel' : 'migNew').closest('[hidden]'), q);
      await shot(`16_${q}`, true);
    }
    // stats: max horizontal overflow anywhere
    m.maxHscroll = Math.max(...Object.values(m.screens).map(s => s.hscroll));
    await ctx.close();
  }
  await browser.close(); srv.close();
  fs.writeFileSync(path.join(OUT, 'metrics.json'), JSON.stringify(metrics, null, 1));
  for (const [d, m] of Object.entries(metrics.devices)) console.log(d, JSON.stringify({ taps: [m.tapsToFight, m.tapsToResult, m.tapsLoop1, m.tapsNewBoardToFight], scroll: [m.scrollToFight, m.scrollToResult, m.scrollLoop1, m.scrollNewBoardToFight], fightDur: m.fightDur, waitResult: m.waitForResult_ms, ttf: m.timeToFight_ms, drag: m.dragMoved, dragScroll: m.dragScrolledPage, hs: m.maxHscroll, share: m.shareLinkOpens, five: m.fivePanel, mig: m.migrationPanel, errors: m.errors.length }));
}
run().catch(e => { console.error(e); process.exit(1); });
