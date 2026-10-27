// Draft screen prototypes (?draftui=versus|list|deck): checks each design end to end and measures taps + scroll to draft a full
// $1,200 team on a 412 phone, a 360 phone and a 1200 desktop, against the default cards. Then the modes through each design:
// the progressive shop (buy, undo, sell, the premium "Not for sale"), 5 in a Row, the daily, and the switcher.
// Usage: node research/draft_ui/check.js   (exits 1 on a failure; screenshots and metrics.json in research/draft_ui/shots/)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FILE = 'file://' + path.join(__dirname, '..', '..', 'index.html');
const OUT = path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const DEV = {
  phone: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  small: { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desk: { viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 },
};
const UIS = ['default', 'versus', 'list', 'deck'];
// the same scripted thumb as research/ux_audit/audit.js: scrolls only when the target is off screen or under the bars
function thumb(page){
  const st = { taps: 0, scroll: 0 };
  return { st, async tap(sel){
    const el = page.locator(sel).first(); await el.waitFor({ state: 'visible', timeout: 5000 });
    const box = await el.boundingBox(), vh = page.viewportSize().height;
    const bottom = await page.evaluate(() => { const b = document.getElementById('actbar'); if (!b || b.hidden) return 0; const r = b.getBoundingClientRect(); return r.top < innerHeight ? innerHeight - r.top : 0; });
    const top = await page.evaluate(() => document.querySelector('header.top').getBoundingClientRect().bottom);
    if (box.y < top || box.y + box.height > vh - bottom){
      const fixed = await el.evaluate(e => { for (let n = e; n; n = n.parentElement){ const p = getComputedStyle(n).position; if (p === 'fixed' || p === 'sticky') return true; } return false; });
      if (!fixed){ const y0 = await page.evaluate(() => scrollY); await el.evaluate((e, tc) => { const r = e.getBoundingClientRect(); scrollBy(0, r.top + r.height / 2 - (tc + (innerHeight - tc) / 2)); }, top); await page.waitForTimeout(50); st.scroll += Math.abs(await page.evaluate(() => scrollY) - y0); }
    }
    try { await el.tap({ timeout: 3000 }); } catch(e){ await el.click(); }
    st.taps++; await page.waitForTimeout(60);
  } };
}
// greedy: the priciest affordable animal first, until nothing left on the board fits the budget (the same team in every design)
const canStill = p => p.evaluate(() => { const S = window.__wa, A = window.Arena; const left = S.prog ? S.prog.money : A.RULES.budget - [...S.team].reduce((s, id) => s + A.BY_ID[id].price, 0); return S.board.some(id => !S.team.has(id) && A.BY_ID[id].price <= left && !(S.prog && id === S.prog.premium)); });
const PICK = { default: '#tiers .card:not(.picked):not(.cant):not(.premium)', versus: '.vcol.foe .vt:not(.cant):not(.prem) .vtm', list: '.lr:not(.picked):not(.cant):not(.prem) .lrm' };
async function draftFull(p, ui, T, max = 20){
  for (let k = 0; k < max && await canStill(p); k++){
    if (ui === 'deck'){ const take = await p.locator('.dktake[data-take]:not([disabled])').count(); await T.tap(take ? '.dktake' : (await p.locator('.dkleave[data-leave]').count() ? '.dkleave' : '.dktake')); }
    else await T.tap(PICK[ui]);
  }
}
// a fixed target team, tapped in each design: 'top' = priciest affordable first, 'cheap' = cheapest first (a long team, many picks)
const target = (p, how) => p.evaluate(how => { const S = window.__wa, A = window.Arena; let left = A.RULES.budget; const out = [];
  const ids = [...S.board].sort((x, y) => (how === 'top' ? A.BY_ID[y].price - A.BY_ID[x].price : A.BY_ID[x].price - A.BY_ID[y].price) || (x < y ? -1 : 1));
  for (const id of ids) if (A.BY_ID[id].price <= left){ out.push(id); left -= A.BY_ID[id].price; } return out; }, how);
async function draftTo(p, ui, T, ids){
  for (let guard = 0; guard < 40; guard++){
    const mine = await p.evaluate(() => [...window.__wa.team]); const rest = ids.filter(id => !mine.includes(id)); if (!rest.length) return;
    if (ui === 'deck'){ const cur = await p.evaluate(() => { const b = document.querySelector('#dkCard [data-info]'); return b && b.dataset.info; }); await T.tap(rest.includes(cur) ? '.dktake' : '.dkleave'); }
    else if (ui === 'versus') await T.tap(`.vcol.foe .vtm[data-id="${rest[0]}"]`);
    else if (ui === 'list') await T.tap(`.lrm[data-id="${rest[0]}"]`);
    else { const i = await p.evaluate(id => { const A = window.Arena, a = A.BY_ID[id], nm = a.group > 1 ? `${a.groupName} (${a.group})` : a.name; return [...document.querySelectorAll('#tiers .card')].findIndex(c => c.querySelector('.nm').textContent === nm); }, rest[0]); await T.tap(`#tiers .card >> nth=${i}`); }
  }
}
const hscroll = p => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const team = p => p.evaluate(() => [...window.__wa.team].sort().join(','));
(async () => {
  const b = await chromium.launch(); const res = { draft: {}, checks: [] };
  const ok = (name, v) => { res.checks.push([name, !!v]); console.log((v ? 'ok   ' : 'FAIL ') + name); };
  for (const [dn, dev] of Object.entries(DEV)){
    for (const ui of UIS){
      const ctx = await b.newContext(dev);
      await ctx.addInitScript(() => { let a = 12345; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; });
      const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(String(e)));
      await p.goto(FILE + (ui === 'default' ? '' : '?draftui=' + ui));
      const T = thumb(p); await T.tap('#actbar .primary'); // Draft your team
      const shot = n => p.screenshot({ path: path.join(OUT, `${dn}_${ui}_${n}.png`), scale: 'css' });
      if (dn !== 'small') await shot('1_open');
      const h0 = await p.evaluate(() => document.documentElement.scrollHeight);
      const cheap = await target(p, 'cheap'), top = await target(p, 'top');
      let t0 = T.st.taps, s0 = T.st.scroll; await draftTo(p, ui, T, cheap);
      const long = { n: cheap.length, taps: T.st.taps - t0, scroll: Math.round(T.st.scroll - s0), ok: await team(p) === [...cheap].sort().join(',') };
      await shot('2b_long_team');
      await p.evaluate(() => { window.__wa.team.clear(); }); await p.click('#steps button[data-s="draft"]'); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(80);
      if (ui === 'deck') await p.locator('.dkdot').first().click();
      t0 = T.st.taps; s0 = T.st.scroll; await draftTo(p, ui, T, top);
      const r = { long, n: top.length, taps: T.st.taps - t0, scroll: Math.round(T.st.scroll - s0), pageH: h0, spent: await p.evaluate(() => [...window.__wa.team].reduce((s, id) => s + window.Arena.BY_ID[id].price, 0)), team: await team(p), hscroll: await hscroll(p) }; r.topOk = r.team === [...top].sort().join(',');
      if (dn === 'phone') await p.screenshot({ path: path.join(OUT, `${dn}_${ui}_3_full.png`), fullPage: true, scale: 'css' });
      await T.tap('#actbar .primary'); r.fight = await p.evaluate(() => !document.getElementById('s-fight').hidden); r.errors = errs.length;
      res.draft[dn + ' ' + ui] = r; console.log(dn, ui, JSON.stringify(r));
      ok(`${dn} ${ui}: full team, fight starts, no errors, no sideways scroll`, r.fight && !errs.length && r.hscroll <= 0 && r.spent > 0);
      await ctx.close();
    }
    // same team in every design on this device
    ok(`${dn}: every design drafted both target teams`, UIS.every(u => { const r = res.draft[dn + ' ' + u]; return r.long.ok && r.topOk; }));
  }
  // modes, phone, each prototype
  for (const ui of UIS.slice(1)){
    const ctx = await b.newContext(DEV.phone), p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(String(e)));
    const vis = id => p.evaluate(id => !document.getElementById(id).hidden, id), T = thumb(p);
    // progressive shop: buy, undo, buy again, premium not for sale, fight, then sell in the next shop
    await p.goto(FILE + '?progressive=1&draftui=' + ui); await p.evaluate(() => localStorage.removeItem('wa-prog')); await p.reload();
    await p.click('#progNew'); await p.waitForTimeout(150); if (await p.locator('#progToShop').count() && await p.locator('#progToShop').isVisible()){ await p.click('#progToShop'); await p.waitForTimeout(150); } // the new flow opens the shop directly
    ok(`${ui} prog: the shop is this design`, await vis('s-draft') && await p.locator('#draftAlt:not([hidden])').count());
    const m0 = await p.evaluate(() => window.__wa.prog.money);
    await draftFull(p, ui, T, 1);
    const m1 = await p.evaluate(() => window.__wa.prog.money); ok(`${ui} prog: buy spends money (${m0} → ${m1})`, m1 < m0);
    // undo: the shop's Return button, or in Versus (no team panel before you have survivors) tapping the tile on your side
    if (await p.locator('#s-draft [data-unbuy]').count()) await p.locator('#s-draft [data-unbuy]').first().click(); else await p.locator('#draftAlt .vcol.you .vt .vtm').first().click();
    await p.waitForTimeout(100);
    ok(`${ui} prog: undo refunds`, await p.evaluate(() => window.__wa.prog.money) === m0);
    // premium: make one board animal the premium enemy (as round 3+ would) and check it can't be bought
    const prem = await p.evaluate(() => { const r = window.__wa.prog; r.premium = r.board[0]; return r.premium; });
    await p.click('#steps button[data-s="draft"]'); await p.waitForTimeout(100);
    if (ui === 'deck') await p.locator('.dkdot.prem').first().click();
    await p.screenshot({ path: path.join(OUT, `phone_${ui}_4_prog_premium.png`), scale: 'css' });
    ok(`${ui} prog: premium shows "Not for sale"`, await p.locator('#draftAlt').getByText(/Not for sale/).count());
    if (ui === 'versus') await p.locator(`.vt.prem .vtm`).click(); else if (ui === 'list') await p.locator('.lr.prem .lrm').click(); else { await p.keyboard.press('ArrowRight'); }
    await p.waitForTimeout(100); if (await p.locator('#duiDlg[open]').count()) await p.click('#duiDlgX');
    ok(`${ui} prog: tapping the premium doesn't buy it`, await p.evaluate(id => !window.__wa.team.has(id), prem) && await p.evaluate(() => window.__wa.prog.money) === m0);
    await p.evaluate(() => { const r = window.__wa.prog; r.premium = null; }); await p.click('#steps button[data-s="draft"]'); await p.waitForTimeout(100);
    // a carried, wounded animal (as after a won round): heal it, then sell it
    await draftFull(p, ui, T, 1); await p.evaluate(() => { const e = window.__wa.prog.team[0]; e.fresh = false; e.hp = e.hp.map(() => .4); window.__wa.prog.money += 300; }); await p.click('#steps button[data-s="draft"]'); await p.waitForTimeout(100);
    { const h0 = await p.evaluate(() => window.__wa.prog.money); await p.locator('#s-draft [data-heal]').first().click(); await p.waitForTimeout(80);
      ok(`${ui} prog: heal a wounded carried animal`, await p.evaluate(() => window.__wa.prog.team[0].hp.every(h => h === 1)) && await p.evaluate(() => window.__wa.prog.money) < h0);
      await p.screenshot({ path: path.join(OUT, `phone_${ui}_6_prog_carried.png`), scale: 'css' });
      const s0 = await p.evaluate(() => window.__wa.prog.money); await p.locator('#s-draft [data-sell]').first().click(); await p.waitForTimeout(80); await p.locator('#s-draft [data-sell]').first().click(); await p.waitForTimeout(80); // selling takes two taps
      ok(`${ui} prog: sell a carried animal`, await p.evaluate(() => window.__wa.prog.money) > s0 && await p.evaluate(() => window.__wa.prog.team.length === 0)); }
    if (ui === 'deck') await p.locator('.dkdot').first().click();
    await draftFull(p, ui, T, 3);
    await p.screenshot({ path: path.join(OUT, `phone_${ui}_5_prog_shop.png`), scale: 'css' });
    await p.locator('#actbar button', {hasText: 'Fight now'}).click(); await p.waitForTimeout(150); ok(`${ui} prog: Fight now from the bar`, await vis('s-fight'));
    await p.click('#actbar .primary'); await p.waitForTimeout(150); await p.click('#actbar .primary'); await p.waitForTimeout(150);
    if (await vis('s-prog') && await p.locator('#progToShop').count()){
      await p.click('#progToShop'); await p.waitForTimeout(150);
      const sell = p.locator('#s-draft [data-sell]');
      if (await sell.count()){ const a = await p.evaluate(() => window.__wa.prog.money); await sell.first().click(); await p.waitForTimeout(100); await sell.first().click(); await p.waitForTimeout(100); ok(`${ui} prog: sell a survivor in round 2`, await p.evaluate(() => window.__wa.prog.money) > a); await p.screenshot({ path: path.join(OUT, `phone_${ui}_6_prog_round2.png`), scale: 'css' }); }
      else console.log(ui, 'prog: no survivor to sell (lost round 1)');
    }
    // 5 in a Row
    await p.goto(FILE + '?five=1&draftui=' + ui); await p.evaluate(() => localStorage.removeItem('wa-five-run')); await p.reload();
    await p.click('#five'); await p.waitForTimeout(150); ok(`${ui} five: draft opens in this design`, await p.locator('#draftAlt:not([hidden])').count());
    await draftFull(p, ui, T); await p.click('#actbar .primary'); await p.waitForTimeout(150); ok(`${ui} five: fight`, await vis('s-fight'));
    // daily
    await p.goto(FILE + '?draftui=' + ui); await p.click('#daily'); await p.waitForTimeout(150);
    await draftFull(p, ui, T); const dteam = await team(p); await p.click('#actbar .primary'); await p.waitForTimeout(150);
    ok(`${ui} daily: fight with the drafted team`, await vis('s-fight') && dteam.length > 0 && await p.evaluate(() => window.__wa.daily != null));
    ok(`${ui}: no page errors in the modes`, !errs.length); if (errs.length) console.log(errs);
    await ctx.close();
  }
  // switcher: flipping keeps the team and remembers the choice
  { const ctx = await b.newContext(DEV.phone), p = await ctx.newPage();
    await p.goto(FILE + '?draftui=versus'); await p.click('#actbar .primary'); await draftFull(p, 'versus', thumb(p), 2); const t = await team(p);
    for (const u of ['list', 'deck', 'default', 'versus']){ await p.click(`#duiSwitch [data-ui="${u}"]`); await p.waitForTimeout(80); }
    await p.click('#duiSwitch [data-ui="list"]');
    ok('switcher keeps the team across designs', await team(p) === t);
    await p.goto(FILE + '?draftui=1'); await p.click('#actbar .primary'); ok('switcher remembers the choice (?draftui=1 opens List)', await p.locator('.lrows').count());
    // deck: a real touch swipe right takes the card, left leaves it
    await p.goto(FILE + '?draftui=deck'); await p.click('#actbar .primary'); await p.evaluate(() => document.getElementById('dkCard').scrollIntoView({ block: 'center' }));
    const swipe = async dx => { const r = await p.evaluate(() => { const b = document.getElementById('dkCard').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }); const cdp = await ctx.newCDPSession(p);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y }] });
      for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: r.x + dx * i / 10, y: r.y + 3 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach(); await p.waitForTimeout(350); };
    const first = await p.evaluate(() => document.querySelector('#dkCard [data-info]').dataset.info);
    await swipe(-160); const second = await p.evaluate(() => document.querySelector('#dkCard [data-info]').dataset.info);
    ok('deck: swipe left leaves the card', second !== first && !(await p.evaluate(id => window.__wa.team.has(id), first)));
    await swipe(160); ok('deck: swipe right takes the card', await p.evaluate(id => window.__wa.team.has(id), second));
    await p.goto(FILE); await p.evaluate(() => localStorage.removeItem('wa-draftui')); await p.reload(); await p.click('#actbar .primary'); ok('no flag, nothing chosen: the default cards, no switcher', !(await p.locator('#duiSwitch').count()) && await p.locator('#tiers .card').count());
    await ctx.close(); }
  fs.writeFileSync(path.join(OUT, 'metrics.json'), JSON.stringify(res, null, 1));
  await b.close(); process.exit(res.checks.every(x => x[1]) ? 0 : 1);
})();
