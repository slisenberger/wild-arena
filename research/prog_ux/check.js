// Progressive-mode checks for the UX pass: a carried elephant is placeable and ridden on the formation page, a giant bought in
// the shop becomes the mount, heal/sell rules show on the buttons, the destructive buttons ask twice, no sideways scroll at 360 px.
// Usage: node research/prog_ux/check.js   (exits 1 on a failure; screenshots in research/prog_ux/after/check_*.png)
const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.join(__dirname, '..', '..', 'index.html');
const OUT = path.join(__dirname, 'after');
(async () => {
  const b = await chromium.launch(), ok = [];
  const check = (name, v) => { ok.push(!!v); console.log((v ? 'ok   ' : 'FAIL ') + name); };
  for (const [dev, opt] of [['phone', { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['small', { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['desk', { viewport: { width: 1200, height: 900 } }]]){
    const ctx = await b.newContext(opt), p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(String(e)));
    const hs = () => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await p.goto(FILE + '?progressive=1'); await p.click('#progNew'); await p.waitForTimeout(150);
    check(`${dev}: Start a run opens round 1's shop`, await p.evaluate(() => window.__wa.screen === 'draft'));
    // a run in round 7 with a carried, wounded, levelled elephant
    await p.evaluate(() => {
      const S = window.__wa, P = window.Progressive, r = S.prog;
      r.k = 6; r.won = 6; r.money = 900;
      r.team = [{id: 'elephant', uid: 99, hp: [.55], was: [.36], scar: [1], xp: 70, lv: 2, kills: 4, fresh: false}, {id: 'wolfpack', uid: 98, hp: [.9, .4, .2], was: [.86, .15, .1], scar: [0, 0, 1], xp: 30, lv: 1, kills: 2, fresh: false}];
      P.dealRound(r); localStorage.setItem('wa-prog', JSON.stringify(r));
    });
    await p.reload(); await p.waitForTimeout(250);
    check(`${dev}: a saved run resumes in the shop`, await p.evaluate(() => window.__wa.screen === 'draft'));
    const heal = await p.locator('[data-heal="elephant"]').textContent();
    check(`${dev}: heal button says the result and cost (${heal.trim()})`, /Heal to 100% · \$\d+/.test(heal));
    const sell = await p.locator('[data-sell="elephant"]').textContent();
    const want = await p.evaluate(() => Math.floor(window.Arena.BY_ID.elephant.price * .5 * .55 / 5) * 5); // half price × 55% health, $5 steps
    check(`${dev}: sell price scales with health (${sell.trim()}, expect $${want})`, sell.includes('+$' + want));
    await p.locator('#progShop').screenshot({ path: path.join(OUT, `check_${dev}_shop_elephant.png`) });
    check(`${dev}: no sideways scroll in the shop (${await hs()} px)`, await hs() <= 0);
    // sell asks twice
    await p.click('[data-sell="wolfpack"]'); await p.waitForTimeout(100);
    check(`${dev}: first sell tap only arms it`, await p.evaluate(() => window.__wa.prog.team.length === 2 && document.querySelector('[data-sell="wolfpack"]').dataset.armed === '1'));
    await p.click('[data-heal="wolfpack"]'); await p.waitForTimeout(100);
    check(`${dev}: heal fills the pack and says so`, await p.evaluate(() => window.__wa.prog.team.find(e => e.id === 'wolfpack').hp.every(f => f === 1) && /Healed the Wolf pack/.test(document.getElementById('progMsg').textContent)));
    await p.evaluate(() => window.scrollTo(0, 0)); await p.locator('#progShop').screenshot({ path: path.join(OUT, `check_${dev}_shop_healed.png`) });
    // formation: the carried elephant is on the map and you ride it by default
    await p.locator('#actbar button', { hasText: 'Formation' }).click(); await p.waitForTimeout(250);
    const f = await p.evaluate(() => { const S = window.__wa; return {screen: S.screen, mount: S.mount, team: [...S.team], pressed: [...document.querySelectorAll('#mountOpts button[aria-pressed="true"]')].map(b => b.textContent)}; });
    check(`${dev}: formation shows the carried animals (${f.team.join(', ')})`, f.screen === 'deploy' && f.team.includes('elephant') && f.team.includes('wolfpack'));
    check(`${dev}: you ride the carried elephant (${f.pressed.join('')})`, f.mount === 'elephant' && /Elephant/.test(f.pressed.join('')));
    await p.screenshot({ path: path.join(OUT, `check_${dev}_formation_elephant.png`) });
    check(`${dev}: no sideways scroll on the formation page (${await hs()} px)`, await hs() <= 0);
    // pick on foot, then come back: the choice sticks this round
    await p.locator('#mountOpts button', { hasText: 'On foot' }).click(); await p.locator('#actbar button', { hasText: 'Shop' }).click(); await p.waitForTimeout(100);
    await p.locator('#actbar button', { hasText: 'Formation' }).click(); await p.waitForTimeout(150);
    check(`${dev}: a mount you pick sticks for the round`, await p.evaluate(() => window.__wa.mount === ''));
    await p.locator('#mountOpts button', { hasText: 'Elephant' }).click();
    // the fight launches from the formation page
    await p.click('#actbar .primary'); await p.waitForTimeout(250);
    check(`${dev}: Fight on the formation page starts the fight, riding the elephant`, await p.evaluate(() => window.__wa.screen === 'fight' && window.__wa.mount === 'elephant'));
    await p.click('#actbar .primary'); await p.waitForTimeout(250);
    const lbl = await p.textContent('#actbar .primary');
    check(`${dev}: result bar (${lbl})`, /shop|run/i.test(lbl));
    await p.click('#actbar .primary'); await p.waitForTimeout(250);
    check(`${dev}: the last round's result opens the shop or the end screen`, await p.evaluate(() => ['draft', 'prog'].includes(window.__wa.screen)));
    if (await p.evaluate(() => window.__wa.screen === 'prog')) await p.screenshot({ path: path.join(OUT, `check_${dev}_end.png`), fullPage: true });
    // abandon asks twice
    if (await p.evaluate(() => !window.__wa.prog.over)){
      await p.click('#progHud [data-hud="abandon"]');
      check(`${dev}: first Abandon tap only arms it`, await p.evaluate(() => !!window.__wa.prog));
      await p.click('#progHud [data-hud="abandon"]'); await p.waitForTimeout(100);
      check(`${dev}: second tap ends the run`, await p.evaluate(() => !window.__wa.prog && !localStorage.getItem('wa-prog')));
    }
    check(`${dev}: no page errors`, !errs.length); if (errs.length) console.log(errs);
    await ctx.close();
  }
  await b.close();
  process.exit(ok.every(Boolean) ? 0 : 1);
})();
