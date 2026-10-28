# Progressive mode: design draft (Oct 27)

Status: **prototype built (Oct 27), behind `?progressive=1`**, waiting for the owner's playtest. What was built and measured
is in "Built (Oct 27)" at the end; the sections in between are the original draft. It replaced the switched-off Migration
mode (`migration.js` is gone; its engine hooks are reused).

## The idea in one paragraph
A run of about 7 rounds. Early boards are dealt only from cheap animals, so the honey badger, boar, leopard and lone wolf
are the stars and actually get kills. Each round the board slides up the price ladder: mid-tier animals start to appear,
then big ones, and the elephant and other giants only near the end. You keep your survivors between rounds, wounds and
all, and every round a fixed top-up of money arrives. You spend it on new animals, healing, or training the veterans you
have. The other side is still everything on the board you don't buy, so it also climbs the ladder with you.

## What carries over from Migration (already built, switched off)
- Survivors carry their wounds into the next fight (`cfg.startHp`), the dead stay dead.
- The draft screen doubles as a trading post: buy, or sell for half price.
- Seeded runs, a daily run, a saved run that resumes after a reload, and a greedy bot (`migration_bot.js`) for balance probes.
- Engine hooks are opt-in, so the normal game is untouched.

## What's new
### 1. The price ladder (owner: "progressively more high value animal dense each round, a gradual slope")
Each round has a price cap and a board total. A board is dealt with `dealBoard` from animals under the cap, to the total.

| Round | Cap per animal | Board total | Feel |
|---|---|---|---|
| 1 | $100 | ~$1,000 | badgers, boars, leopards, lone wolves, ostriches |
| 2 | $200 | ~$1,300 | first moose, grizzly, giraffe, packs |
| 3 | $300 | ~$1,600 | hippo, bison, buffalo arrive |
| 4 | $400 | ~$1,900 | rhinos, herds start |
| 5 | $500 | ~$2,200 | mammoth-class rares possible |
| 6 | $700 | ~$2,500 | giants (elephant) possible |
| 7 | any | ~$2,800 | the herd: at least one giant guaranteed |

The slope is gradual on purpose: at most one new price band per round, and the cap rises before the total does, so a
new band first appears as one or two animals, not a whole board of them. Numbers are a starting point, to be set
by the bot probe below.

### 2. The other side (owner: "maybe the other side always has one more premium creature?")
It stays "everything you don't buy". On top of that, two options:
- **A. Nothing extra.** The other side grows only with the board. Simple, and the same rule as the main game.
- **B. One premium extra each round:** one animal from the round's top price band joins the other side and can't be bought.
  This keeps the run tense once your team is strong. It works against you, so it needs a bigger top-up, as the owner noted.
- **Q:** recommend **B from round 3 on**. Rounds 1–2 have no premium band worth adding, and a badger-only fight with an
  extra tiger in it would be unwinnable.

### 3. Money (owner: "each round you can replenish a fixed budget")
- **Fixed top-up per round**, not prize money. Start with $600 and get +$300 each round, plus a small bonus for each
  enemy killed (optional).
- Prize money (Migration's rule) snowballs: winning makes you richer, which makes winning easier. A fixed top-up
  keeps every round about the draft.
- **Q:** fixed only, or fixed plus a small kill bonus? Recommend fixed plus a **$25-per-kill** bonus, capped at
  $150 a round, so a badger kill is worth something.

### 4. Healing (owner: "you can heal animals")
- Free rest between rounds: every survivor heals 30% of its missing health.
- Paid treatment: full heal for 25% of the animal's price, with a minimum of $50. That's cheaper than buying a fresh
  one, so keeping veterans alive pays off.
- **Lasting damage (owner: "maybe some damage persists"):** an animal that dropped below 25% health in a fight keeps a
  scar: −10% maximum health for the rest of the run, up to −30%. It's visible on the card.

### 5. Experience and levels (owner, Oct 27: "if the animal does stuff it gets exp points, and can level up")
Animals earn XP for what they actually do in a fight. The fight already counts all of this (`A.summarize`):
- damage dealt (1 XP per 50 damage), damage dealt to something attacking you (double), kills (10 XP), surviving the
  fight (5 XP), its signature move landing (5 XP: musk, claw kick, chest-beat...), MVP of the fight (10 XP).
- Cheap animals earn XP at the same rate as giants for the same deeds, so a badger kill is worth as much as an
  elephant kill. The badger levels fastest by being in the thick of it.

Levels (thresholds ~25 / 60 / 110 XP) give **experience, not superpowers**, all grounded in how real animals get better:
- **Level 1, Seasoned:** morale breaks 25% later, and a death nearby shakes it less.
- **Level 2, Cunning:** better reads: +15% sight range for threats and waits better for an opening (predators), or holds
  position better near you (guards).
- **Level 3, Veteran:** +10% damage from practised technique and +10% max health (it's a fit, battle-hardened adult).
- A pack or herd levels as one: the group shares XP.

Hard cap: a level-3 animal is at most about 15% stronger in measured swing, so a veteran honey badger stays a story,
not a giant-killer. Scars (above) still apply, so a veteran can also be a battered one. Levels show on the card
(★ to ★★★) with the XP bar.

### 6. The honey badger moment
Round 1 is all $100 animals on both sides, so the badger's fearless, never-retreating fight is suddenly one of the
strongest things on the field. The kill counter and an end-of-run "MVP of the run" make that visible. It's the mode's
signature story: the badger that went the distance.

### 7. How a run ends
- **Two retries per run (owner, Oct 27).** Losing a round uses a retry: you refight it on a new fight seed and may change
  your team first (and heal). A third loss ends the run.
- Score = rounds won + total time alive. Survive all 7 rounds → a "run complete" badge.
- **Endgame boss (optional, later):** T. rex is far too strong for the normal game ("good animals are too good"), but
  it could be the final round's boss in this mode only: the other side gets a T. rex, and your levelled team has to
  survive it.

## Balance plan before anyone playtests
1. Adapt `migration_bot.js` to the ladder: a greedy bot drafts, heals and trains on 500 seeded runs.
2. Targets: the bot completes about 15–25% of runs, and the median run ends around round 4–5. Round 1 should be won
   about 80% of the time, and round 1 needs real decisions: no single $100 team should always win it.
3. Check that the honey badger, boar and leopard get kills in rounds 1–2, and how often the badger survives to round 4.
4. Tune caps, totals and top-ups until the targets hold, then let the owner playtest behind `?progressive=1`.

## Open questions for the owner
Decided (Oct 27): experience with XP and levels; two retries per run.
1. Option A or B for the other side? (Recommend B from round 3.)
2. Fixed top-up only, or with a kill bonus? (Recommend fixed + $25/kill, capped; XP already rewards kills.)
3. Does this replace Migration (switched off), or sit beside it? Recommend **replacing it**: same engine hooks, a
   clearer hook.
4. T. rex as a final-round boss: yes, later?

## Built (Oct 27)
Files: `progressive.js` (rules, `PROG` constants), UI in ui.js (`S.prog`, `s-prog` screen, the draft screen is the shop),
`progressive_bot.js` (balance bot), `progressive_r1.js` (round-1 choices), `level_abs.js` (what a level is worth).
Migration (`migration.js`, `migration_bot.js`, `?migration=1`) was removed; old `wa-mig` saves are ignored.

### Final constants (tuned with the bot)
| Round | Cap | Board | Total | Money in | Premium enemy |
|---|---|---|---|---|---|
| 1 | $100 | 12 | $1,200 | $400 start | – |
| 2 | $200 | 10 | $1,200 | +$400 | – |
| 3 | $300 | 10 | $1,500 | +$400 | the round's top band (hippo / buffalo / gaur …) |
| 4 | $400 | 10 | $1,800 | +$400 | rhino / hippo / musk ox herd |
| 5 | $400 | 11 | $2,100 | +$350 | rhino / hippo / musk ox herd |
| 6 | $700 | 11 | $2,300 | +$400 | buffalo or bison herd |
| 7 | any | 12 | $2,600 | +$650 | herd; a giant (elephant/mammoth/triceratops) is on the board for sale |

(Current as of Oct 28, with the learned guard target choice (`guard_target_m2`) and `charger_target_m1` live and `abs_r19` prices:
bot round 1 first-try 77%, median run ends in round 6, 23.4% complete; at the Oct 27 constants this engine gave 72% / 69.6%,
so round 1 went back to 12 / $1,200 and the top-ups came down. Oct 27 night (charger a1, `abs_r18`): 79%, round 6, 21.4%.
The bot results below are from an earlier tuning.)

Plus $25 per kill, at most $150 a won round (`PER_KILL`, `KILL_CAP`). Rares on 10% → 30% of boards. Free rest heals 30% of
missing health; full heal 25% of price (min $50); sell for half (superseded by the UX pass below). Scar: below 25% health in a fight → −10% max health for
the run (max 3). XP: 1 per 50 damage (damage to something attacking you counts twice), 10 per kill, 5 for surviving, 5 per
signature move (max 2 a fight), 10 for MVP; levels at 25 / 60 / 110 XP; packs share one pool. Your own health resets each
round (the human stays as fragile as now). Premium: the round's top price band, non-rare if possible, chosen by the seed,
never a species you own, never the last round's giant.

**Retries (a design call, see DECISIONS.md):** a loss goes back to the shop as the round opened (team, wounds, XP, money)
and refights on a new fight seed; only the time alive counts. With "the dead stay dead" instead, 17% of bot runs died in
round 1 (a crippled retry can't win), so the retry restores the round.

### Levels: experience, not superpowers (engine hook `cfg.levels`, `LEVEL_FX` in sim.js)
Seasoned: flee threshold ×0.75 and a fallen packmate shakes it half as much. Cunning: +15% sight range. Veteran: +10%
damage, +10% max health. Measured (`level_abs.js 120 3`, paired: same boards, 3-animal base teams and seeds, the item at
level 0 vs level 3; 12,150 fights): level 3 adds **+3.95 ± 1.17 s** on average against a mean swing of 52 s, i.e. **~8% of
the swing** pooled over all items (per item noisy, ±5–10 s SE). Within the ~15% cap, so the effects were kept as designed.

### Bot results (`progressive_bot.js 500 4 1001`, fresh seeds)
The bot heals any pick under 60%, buys by measured swing with ±50% seeded noise, and 1 buy in 4 is a random affordable
animal (so it plays like a player with favourites); it never sells.
- Rounds won: 0:6, 1:12, 2:40, 3:91, 4:104, 5:127, 6:38, 7:82 → **16.4% complete**; the run ends in round **5 (median)**,
  p25 4, p75 6.
- First-try win by round: 83%, 88%, 73%, 62%, 56%, 43%, 56%. Round 6 (the first herd premium) is the wall.
- Levels: by round 4, 62% of picks are at least Seasoned and 21% Veteran; by round 7, 56% / 35%.
- Round 1: 218 distinct bot teams over 500 runs. Win rate with the animal on the team: boar 88%, wolf pack 89%, croc 88%,
  tiger 84%, ostrich 84%, lion 81%, gorilla 79%, leopard 75%, honey badger 62%, lone wolf 36%.
- Kills per fight in rounds 1–2 (when on the team): tiger 1.75, croc 1.51, **boar 1.27**, lion 0.95, ostrich 0.61, wolf
  pack 0.49, **leopard 0.47**, gorilla 0.44, **honey badger 0.02** (2 kills in 112 fights).
- A honey badger is still on the team in round 4 in 10.6% of runs: 53 of the 83 runs that had one in rounds 1–2. It
  survives (fearless, loose skin) but almost never finishes anything.

### Round 1 needs real choices (`progressive_r1.js 16 4`: every 4-animal team on 16 dealt round-1 boards, 4 seeds each)
A random full-spend team wins 40% (boards range 26–60%); on every board some teams never win and some always do. 9
distinct best teams over 16 boards, but the $100 tier includes the tiger, lion and croc, and they dominate the top teams
(top-5 appearances: tiger 75, lion 69, croc 50, boar 26, gorilla 17, wolf pack 17 … leopard 2, honey badger 2). So round 1
is a big-cat round more than a badger round.

### Open after the build
- The badger story doesn't happen yet: in round 1 it gets 0.02 kills a fight. Options: deal round 1 without the $100 big
  cats (tiger, lion, jaguar, croc; a "small animals" round), or give the badger a real finishing move. Needs the owner.
- The premium herd in rounds 6–7 (DECISIONS.md).
- Not built from the draft: paid "training", T. rex boss, a smarter bot (selling, saving).

## UX pass (Oct 27, after the owner's first playthrough; `research/prog_ux/README.md`)
- Flow: Start → round 1's shop → Formation (the fight starts there; "Fight now" in the shop skips it) → result → next shop.
  The run overview is one tap away (HUD); a resumed run opens in the shop.
- Heal: full heal = price × `HEAL_RATE` .55 × the share of health missing ($5 steps, up; min $10). Sell = price × .5 ×
  health ($5 steps, down); not under 25% health. Health % per member, rest line, "Heal to 100% · $X", "Heal all wounded".
- XP: each card says what its level does and what the next one gives; "How XP and levels work"; the recap lists what each
  animal earned its XP for.
- The last round pays no kill money (nothing left to buy). The end screen lists every animal of the run (`run.hist`, one
  record per buy: rounds, kills, damage, protecting you, XP/level, scars, MVPs, how it left), survivors first with a gold badge.
- Formation bug fixed: the mount follows the team (a giant you buy or carry is ridden by default) until you pick one.
- Bot (500 runs × 2 seed sets): complete 17.3% → 15.9%, round 1 first-try 81.5% (unchanged), median end round 6.

