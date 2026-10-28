# Terrain features: chokepoints, cover and a slightly smaller field (prototype, `?maps2=1`)

Owner, Oct 28 (phone playtest): "the map feels maybe a tad big, would be nice to have mild map variety too" / "I want
mechanics that make setting formation matter. Right now formation setting seems.. everything is a big map with no
chokepoints".

## The problem
Every map is an open 100 × 66 m box. Water (river, ponds) and trees are the only terrain, and none of it gives the
Formation screen a reason to exist: a herd, a cat or a charger reaches you from any direction, so where you stand and
where the guards stand barely matters (camp.js, Oct 2026: the best start spot was worth +4 to +18 s, and only for weak
teams). Formation matters when terrain decides *where* the other side can come from.

## Features (real ones only, per biome)
All are solid circles in the engine (a chain of overlapping circles makes a wall or a gully). "Tall" ones also block
sight beyond 4 m.

| Map | Feature | Real basis | What it does | Why formation matters |
|---|---|---|---|---|
| Savanna | **Kopje** (granite outcrop, 4–6 boulders, ~12 m across; 80% of maps) | Serengeti kopjes (inselbergs): Wikipedia "Inselberg", "Serengeti" (Moru, Gol kopjes) | Impassable, tall (hides what is behind it) | Put your back to it: nothing comes from behind; cats can creep round it unseen |
| Savanna | **Donga** (dry erosion gully with steep sides, from one edge, 40–60% across, half with a crossing) | Wikipedia "Donga"; animals cross at game trails | Impassable, low (you can see across), charges stop at its edge | Covers one flank; the far end and the crossing are the only ways round, so a guard post there holds a gap |
| Savanna | **Termite mounds** (3–6, 2–3 m across) | Macrotermes mounds, several m tall: Wikipedia "Mound-building termites" | Impassable, tall | Small cover; breaks a charge line |
| River | **Cut banks** (outer side of a bend: one bank walled on the north half, the other on the south half) | Wikipedia "Cut bank", "Point bar"; herds cross at fixed points (Mara crossings) | Steep earth wall: no climbing in or out of the water there; fords and the mid-river point bar stay open | The river becomes a set of real crossings: guard the ford or the point bar and the far side has to come through it |
| River | **Side gully** (50% of maps) | A donga cutting down to the river | As the donga | Splits one side of the field |
| Forest | **Ravine** (70% of maps, from one edge, 50–70% across, one crossing where the sides have slumped) | Wikipedia "Ravine" | Impassable, low | Same as the donga, narrower crossing between trees |
| Forest | **Deadfall** (2–4 tangles of fallen trunks, 6–10 m long) | Coarse woody debris: Wikipedia "Coarse woody debris" | Impassable, low (chargers stop at it) | Short walls between the trees; funnels and charge breakers |
| Tundra | **Moraine** (75% of maps: a ridge of boulders right across the field, one or two gaps) | Glacial moraines: Wikipedia "Moraine" | Impassable, tall | The clearest chokepoint: the other side must come through one or two gaps |
| Tundra | **Erratics** (2–4 lone boulders) | Wikipedia "Glacial erratic" | Impassable, tall | Cover, charge breakers |
| All | **Border** (each game trims 0–3 m off your back edge, 3–9 m off theirs, 1–6 m off the top and bottom) | Thornbush thicket (savanna, e.g. *Senegalia mellifera*, "wait-a-bit"), steep valley sides (river), dense undergrowth (forest), scree (tundra) | Impassable edge | The field is ~83% of the old area (see below) |

Mechanics, all opt-in (`cfg.maps2`):
- **Impassable:** units collide with each circle (like trunks, but nothing knocks them over), steer round them (the tree
  steering, looking 2.5 m ahead), and **route** round walls: each feature leaves waypoints at its gaps, its free ends and
  every ~8 m along both sides; a unit whose straight line to its goal is blocked heads for the first waypoint of the
  shortest route (Dijkstra over the waypoints, recomputed every 0.5 s). The wedged-detour (`unstick`) works for them too.
- **Sight:** tall features (kopje, mound, moraine, erratic) hide anything behind them beyond 4 m (`canSee`).
- **No striking through:** no blow, bite or pounce lands across a rock or a gully.
- **Charges end at a wall:** a charger that runs into one stops, stunned 1.2 s, and takes 3% of its health (as with trees,
  milder: it sees a rock coming).
- **Deployment:** `placeOK` refuses spots inside a feature; `clampPlace` steps out to its edge.
- **Closing arena:** closes in from the playable box's edges; its final core (x 38–62, y 25–41) is always kept free of
  features, so the end-game box is always open; an animal caught outside the box with a wall between it and the middle
  routes to the middle.

Not built (ideas for later): high ground on a kopje (a climber or you up there, harder to reach), thickets that small
animals slip through, a pressure ridge on the frozen lake, an explicit back-to-the-wall flank rule (the collision already
stops anything from getting behind you).

## "A tad big": options
The field is a fixed 100 × 66 m (`W`, `H` in sim.js; ui.js reads `A.W/A.H`). Options:
1. **Per-map W/H.** A real refactor: every clamp, spawn, zone and render uses the constants, and the learned policies'
   inputs are scaled by them (they were trained on 100 × 66). Not worth it for a prototype.
2. **An impassable border per map variant (built).** A few lines (a playable box `w.pb` in the integrate clamp, spawns,
   wander, flight to the edge, the zone), the coordinate frame stays the same for the policies, and it reads as terrain
   (thornbush, valley side, undergrowth, scree). Average playable area 83% (about 92 × 60 m), varying per game.
3. **An earlier or tighter closing arena.** It only shrinks the field late, and the zone timing is a difficulty knob.
4. **Smaller deployment zones.** Doesn't make the field smaller.

**Recommendation:** option 2 (built), plus the features above. Leave the zone timing alone.

## Measured
All on dealt boards (12 animals, total $2,600, rares 30%, budget $1,200); prices, budget, total and rare rate unchanged.

**Does formation matter?** (`research/maps2/formation.js 10 9 4 40`: 40 cases, 10 per map, a player-like full-spend team
on a fixed map; candidates = the default formation, the default moved as a whole to 14 spots on your side, 9 random
formations; screen 4 seeds, top 6 on 12 more, then best vs default on 40 fresh seeds; 19,520 fights.) Gain of the best
formation found over the default, in seconds alive:

| Map | plain | maps2 | maps2 − plain (paired) |
|---|---|---|---|
| Savanna | +16.6 ± 7.7 | +12.9 ± 10.0 | −3.8 ± 10.1 |
| River | +12.1 ± 3.2 | +10.8 ± 9.6 | −1.4 ± 8.7 |
| Forest | −15.1 ± 7.4 | +3.6 ± 9.8 | +18.7 ± 8.8 |
| Tundra | +19.3 ± 12.0 | +33.7 ± 13.4 | +14.4 ± 14.1 |
| All | +8.2 ± 4.5 | +15.2 ± 5.5 | **+7.0 ± 5.4** |

Cases where the found formation beats the default by more than 2 SE: 3/40 plain, 8/40 maps2. Reading: formation is worth
a little more with the features (best on the tundra, where the moraine is a real wall with one or two gaps), but the
difference is 1.3 SE: **a lift found so far, not yet a clear one.** The random search is weak (a negative "gain" on the plain
forest means it can't even find the default's quality there), and fights are close to win/lose coin flips (one fight's
SD ~130 s), so a better formation search (feature-aware candidates: back to the kopje, guards in the gap) is the next step
before concluding anything.

**Did the game get easier?** (owner: the player is the underdog)
- Paired telemetry (`research/maps2/probe.js 150`, 600 fights per arm, default formation): score −2.4 ± 5.8 s, win 44.5% →
  44.2%; no change.
- `board.js 16 2 24 12 1200 2600` (RAREP=.3), same 16 boards: median board's best team **88% → 83%** (p25 83 → 71),
  typical full-spend team **165 → 175 s**, teams with a screen win 65 → 68%, 15 → 15 distinct best teams.
- The formation test's default formation: 157 → 165 s (+8.1 ± 4.1).
- Net: no clear easing; the typical team may gain ~5–10 s (within ~2 SE), the best team on a board does slightly worse.
  Flagged for the owner, no knob changed.

**Fight flow** (probe, paired): fight length 49.6 → 48.9 s (−0.7 ± 2.1), first hit 5.1 → 5.3 s, longest no-damage stretch
median 7.3 → 7.4 s (p90 39 → 31 s), idle share yours 37% → 37%, theirs 23% → 23% (+0.6 ± 0.4 pts), endings dead 55.5 → 55.8%,
cleared 42.0 → 41.3%, quiet ("gave up") 2.2% → 2.2%.

**Stuck animals** (wants to move, moved < 1 m in 4 s): 7.7 → 7.5 animal-s per fight overall (most of it is chargers
wheeling in deep water, already there without the flag); **beside a feature (not wheeling): 0.09 → 0.15 animal-s per fight**
(the "off" number counts the same spots on the plain map); share of animals ever stuck 7% → 7%. Time spent outside the
closed arena 0.43 → 0.38 animal-s per fight; hazard deaths 6 → 5 of 600.

**Determinism:** without the flag, 480 board fights (240 configs, all 4 maps, random start spots, live policies on and
`livePolicy:false`) are identical to origin/main (`research/maps2/ident.js`): w.t, result, every unit's hp and position.

## Next
- A feature-aware formation search (candidates that use the terrain) to settle whether the lift is real.
- If formation still matters only a little: stronger chokepoints (more of the field walled, narrower gaps) or the
  high-ground idea, before anything goes on by default.
