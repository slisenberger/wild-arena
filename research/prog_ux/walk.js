// Progressive-mode UX walk: plays a whole run through the UI the way a thumb would, screenshots every step and counts taps.
// Usage: node research/prog_ux/walk.js <before|after> [index.html]   (env QUICK=1: tap 'Fight now' in the shop, no screenshots)   (screenshots in research/prog_ux/<phase>/, taps in metrics.json)
// Math.random is a fixed-seed generator, so both phases deal the same run. The bot taps the action bar's primary button
// (or the screen's own primary), buys the cheapest affordable cards, heals one wounded survivor and sells one when it can.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const phase = process.argv[2] || 'after';
const FILE = 'file://' + path.resolve(process.argv[3] || path.join(__dirname, '..', '..', 'index.html'));
const OUT = path.join(__dirname, phase); fs.mkdirSync(OUT, { recursive: true });
const DEV = {
  phone: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  small: { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desk: { viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 },
};
(async () => {
  const b = await chromium.launch(), metrics = {};
  for (const [dev, opt] of Object.entries(DEV)){
    const ctx = await b.newContext(opt);
    await ctx.addInitScript(() => { let a = 4242; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; });
    const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(String(e)));
    const shots = dev !== 'small' && !process.env.QUICK; let n = 0;
    const shot = async (name, full) => { if (!shots) return; const f = path.join(OUT, `${dev}_${String(++n).padStart(2, '0')}_${name}.png`);
      if (typeof full === 'string' && await p.locator(full).count() && await p.locator(full).first().isVisible()) await p.locator(full).first().screenshot({ path: f }); else await p.screenshot({ path: f, fullPage: full === true }); };
    const scr = () => p.evaluate(() => window.__wa.screen);
    const run = () => p.evaluate(() => { const r = window.__wa.prog; return r && { k: r.k, over: r.over, losses: r.losses, money: r.money, team: r.team.map(e => ({ id: e.id, hp: e.hp, fresh: !!e.fresh })) }; });
    let taps = 0; const log = []; const tap = async (sel, why) => { const el = p.locator(sel).first(); await el.scrollIntoViewIfNeeded(); await el.click(); taps++; log.push(why || sel); await p.waitForTimeout(140); };
    const hscroll = () => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    let maxH = 0;
    await p.goto(FILE + '?progressive=1'); await p.waitForTimeout(200);
    await tap('#progNew', 'start run');
    const round = {}; let seen = { wounded: false, healed: false, sold: false, loss: false, formation: false };
    for (let guard = 0; guard < 30; guard++){
      let R = await run(); if (!R) break;
      const t0 = taps;
      if (await scr() === 'prog' && !R.over){ await shot(`hub_r${R.k + 1}`); await tap('#progToShop', 'to the shop'); }
      if (R.over) break;
      R = await run();
      await shot(`shop_r${R.k + 1}${R.losses ? '_l' + R.losses : ''}`);
      maxH = Math.max(maxH, await hscroll());
      // a wounded survivor: heal one (and say what happened), sell another if it's allowed
      const wounded = R.team.filter(e => !e.fresh && e.hp.some(f => f < .995));
      if (wounded.length && !seen.healed){
        seen.wounded = true;
        const h = p.locator('[data-heal]:not([disabled])');
        if (await h.count()){ await shot('shop_wounded', '#progShop'); await tap('[data-heal]:not([disabled])', 'heal'); seen.healed = true; await shot('shop_healed', '#progShop'); }
      }
      if (R.k >= 1 && !seen.sold && R.team.filter(e => !e.fresh).length >= 2){
        const s = p.locator('[data-sell]:not([disabled])');
        if (await s.count()){ await tap('[data-sell]:not([disabled])', 'sell'); if (await p.locator('[data-sell][data-armed="1"]').count()){ await shot('shop_sell_confirm', '#progShop'); await tap('[data-sell][data-armed="1"]', 'confirm sell'); } seen.sold = true; await shot('shop_sold', '#progShop'); }
      }
      // buy the cheapest affordable cards
      for (let i = 0; i < 6; i++){
        const c = p.locator('#tiers .card:not(.cant):not(.picked)'); const k = await c.count(); if (!k) break;
        await c.last().scrollIntoViewIfNeeded(); await c.last().click(); taps++; log.push('buy'); await p.waitForTimeout(100);
      }
      await shot(`shop_r${(await run()).k + 1}_bought`);
      const quick = process.env.QUICK && await p.locator('#actbar button', { hasText: 'Fight now' }).count();
      if (quick){ await p.locator('#actbar button', { hasText: 'Fight now' }).click(); taps++; log.push('fight now'); await p.waitForTimeout(140); }
      else await tap('#actbar .primary', 'bar primary (shop)');
      if (await scr() === 'deploy'){ if (!seen.formation){ seen.formation = true; await shot('formation', true); } maxH = Math.max(maxH, await hscroll()); await tap('#actbar .primary', 'bar primary (formation)'); }
      if (await scr() !== 'fight') throw new Error('expected the fight, got ' + await scr());
      await tap('#actbar .primary', 'skip to result');
      const won = await p.evaluate(() => window.__wa.world.result.survived);
      if (!won && !seen.loss){ seen.loss = true; await shot('result_loss'); } else if (won && !round.firstWin) await shot('result_win');
      await tap('#actbar .primary', 'continue');
      const key = `round ${R.k + 1}${R.losses ? ' (after a loss)' : ''}`; if (!round[key]) round[key] = taps - t0;
      if (won) round.firstWin = true;
    }
    if (await scr() === 'prog'){ await shot('end', true); await shot('end_summary', '#progTeamBox'); }
    metrics[dev] = { taps, rounds: round, hscroll: maxH, errors: errs, seen, steps: log };
    console.log(dev, JSON.stringify({ taps, rounds: round, hscroll: maxH, errors: errs.length, seen }));
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, process.env.QUICK ? 'metrics_quick.json' : 'metrics.json'), JSON.stringify(metrics, null, 1));
  await b.close();
})();
