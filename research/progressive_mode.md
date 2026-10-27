# Progressive mode: design draft (Oct 27)

Status: **draft for the owner**, nothing built. It grows out of the owner's riffs (Oct 27) and reuses what the switched-off
Migration mode (`migration.js`) already does well. Decisions the owner needs to make are marked **Q** with a recommendation.

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
