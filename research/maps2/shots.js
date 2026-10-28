// Phone screenshots of the maps2 prototype (?maps2=1): the formation (deploy) screen and a fight ~25 s in, on each map.
// Usage: node research/maps2/shots.js   (exits 1 on a page error; screenshots in research/maps2/shots/)
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const FILE = 'file://' + path.join(__dirname, '..', '..', 'index.html');
const OUT = path.join(__dirname, 'shots'); fs.mkdirSync(OUT, {recursive: true});
const GAMES = [['savanna', 11, 3], ['river', 23, 5], ['forest', 31, 12], ['tundra', 41, 2]]; // fight seeds picked so each map shows its big feature (a donga + kopje, a side gully, a ravine, a moraine)
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  for (const [m, bs, s] of GAMES){
    await p.goto(FILE + '?maps2=1#g=1,m:' + m + ',b:' + bs + ',s:' + s); await p.waitForTimeout(300);
    for (let k = 0; k < 3; k++){ const c = p.locator('#tiers .card:not(.cant):not(.picked)').first(); if (await c.count()) await c.click(); }
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.locator('#actbar button', {hasText: 'Formation'}).click(); await p.waitForTimeout(300);
    await p.locator('#deployCanvas').scrollIntoViewIfNeeded();
    await p.screenshot({ path: path.join(OUT, `deploy_${m}.png`), scale: 'css' });
    await p.click('#actbar .primary'); await p.waitForTimeout(300);
    await p.evaluate(() => { const S = window.__wa; S.playing = false; S.playT = Math.min(25, S.dur); });
    await p.waitForTimeout(400); await p.locator('#fightCanvas').scrollIntoViewIfNeeded();
    await p.screenshot({ path: path.join(OUT, `fight_${m}.png`), scale: 'css' });
  }
  console.log(errs.length ? 'page errors: ' + errs.join('\n') : 'no page errors');
  await b.close(); process.exit(errs.length ? 1 : 0);
})();
