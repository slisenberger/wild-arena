// Checks that the hidden prototype modes (?progressive=1, ?five=1) still run end to end through the action bar on a phone.
// Usage: node research/ux_audit/modes_check.js   (exits 1 on a failure; screenshots in research/ux_audit/after/)
const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.join(__dirname, '..', '..', 'index.html');
const OUT = path.join(__dirname, 'after');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const ok = []; const check = (name, v) => { ok.push([name, !!v]); console.log((v ? 'ok   ' : 'FAIL ') + name); };
  const vis = id => p.evaluate(id => !document.getElementById(id).hidden, id);
  const finish = () => p.evaluate(() => { window.__wa.playT = window.__wa.dur; });
  // progressive
  await p.goto(FILE + '?progressive=1'); await p.click('#progNew'); await p.waitForTimeout(200);
  check('progressive: run hub opens', await vis('s-prog'));
  check('progressive: bar hidden on the run hub', await p.evaluate(() => document.getElementById('actbar').hidden));
  await p.click('#progToShop'); await p.waitForTimeout(150);
  check('progressive: trading post', await vis('s-draft'));
  await p.locator('#tiers .card:not(.cant)').first().click();
  await p.screenshot({ path: path.join(OUT, 'phone_17_prog_shop.png'), scale: 'css' });
  await p.click('#actbar .primary'); await p.waitForTimeout(200);
  check('progressive: bar Fight starts the fight', await vis('s-fight'));
  await p.click('#actbar .primary'); await p.waitForTimeout(200); // skip to result
  const lbl = await p.textContent('#actbar .primary');
  check('progressive: bar mirrors the banner (' + lbl + ')', /round|run|continue|shop/i.test(lbl));
  await p.screenshot({ path: path.join(OUT, 'phone_18_prog_result.png'), scale: 'css' });
  await p.click('#actbar .primary'); await p.waitForTimeout(200);
  check('progressive: back on the run hub', await vis('s-prog'));
  // 5 in a row
  await p.goto(FILE + '?five=1'); await p.evaluate(() => localStorage.removeItem('wa-five-run')); await p.reload();
  await p.click('#five'); await p.waitForTimeout(200);
  check('five: draft opens', await vis('s-draft'));
  for (let k = 0; k < 3; k++){ const c = p.locator('#tiers .card:not(.cant):not(.picked)').first(); if (await c.count()) await c.click(); }
  await p.click('#actbar .primary'); await p.waitForTimeout(200);
  check('five: fight', await vis('s-fight'));
  await finish(); await p.waitForTimeout(250);
  const l5 = await p.textContent('#actbar .primary');
  check('five: bar mirrors the banner (' + l5 + ')', /board|retry|arena/i.test(l5));
  await p.screenshot({ path: path.join(OUT, 'phone_19_five_result.png'), scale: 'css' });
  await p.click('#actbar .primary'); await p.waitForTimeout(200);
  check('five: next step opens', await vis('s-draft') || await vis('s-arena'));
  // daily: play again keeps today's seed
  await p.goto(FILE); await p.click('#daily'); await p.waitForTimeout(150);
  const seed = await p.evaluate(() => window.__wa.seed);
  await p.click('#actbar .primary'); await p.waitForTimeout(150); await finish(); await p.waitForTimeout(250);
  await p.click('#actbar .primary'); await p.waitForTimeout(150);
  check('daily: Play again keeps the seed', seed === await p.evaluate(() => window.__wa.seed));
  // share link
  await p.goto(FILE + '#g=1,m:river,b:1234'); await p.waitForTimeout(300);
  check('share link opens the draft on that board', await p.evaluate(() => !document.getElementById('s-draft').hidden && window.__wa.terrain === 'river' && window.__wa.boardSeed === 1234));
  check('no page errors', !errs.length); if (errs.length) console.log(errs);
  await b.close();
  process.exit(ok.every(x => x[1]) ? 0 : 1);
})();
