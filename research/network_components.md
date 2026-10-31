# Extensible networks for speciation and new animals (design, Oct 31)

Owner: "we need a long term generalizable pattern here for extensible network components and training to support
speciation and new animals". This note proposes that pattern. It is a design, not built yet.

## What breaks today
- **Fixed input size.** A net's inputs are a positional vector. Adding a trait or a feature changes every position after
  it, so a shipped net can't read the new vector. Today's workaround is `P.traitsV = 2`, a version switch per net, which
  doesn't scale.
- **One code path per class.** `choose`, `chooseHerb` and `chooseGuard` in policy.js, plus a separate feature module per
  side, and archetypes are hard-coded from gaits in sim.js. The croc has no class at all. A new class (lurkers) means new
  hooks in sim.js and policy.js.
- **Species identity is traits only.** A species can differ from another only as far as its stats and tags do. Woolly
  rhino and rhino sit .24 apart and will mostly act alike, whatever the sources say.
- **Training is hand-assembled per run.** Sweeps, flags, gates, the realism checks (buffalo must not shun predators) and
  the ship steps live in messages and memory, not in data.

## The pattern

### 1. Named inputs (schema), not positions
Every feature and trait has a stable name in one append-only registry (`policy/registry/inputs.js`). Each net stores the
input names it was trained on (`P.inputs = [...]`). At decision time the extractor builds a name → value map, and the net
reads its own names (a missing name reads 0). Consequences:
- Adding a trait or feature never touches shipped nets: they ignore names they don't list. No more `traitsV`.
- **Warm start by widening:** a new net copies an old one and adds input weights of 0 for the new names, so it starts as
  exactly the old net and training only has to learn what the new inputs add.
- Speed: the name → index map is resolved once per net at load time, so play is as fast as now.

### 2. Species = traits + a learned residual
A species' identity is its trait vector (from the roster, automatic for any new animal) plus a small learned embedding
per species (4–8 numbers) that starts at 0.
- A new animal works at once through its traits: it acts like the species nearest it in trait space (zero-shot).
- Once it has been in enough training fights, its residual learns what the traits miss (woolly rhino vs rhino).
- A species with no residual yet uses 0, so adding an animal never changes another species' behaviour.

### 3. One decision interface, classes as data
Every target decision is the same shape: a unit, its candidates (the engine's own candidate list, which always contains
today's pick), the heuristic's pick, and the per-option feature map. The policy side has one `chooseTarget(w, u)`. A
routing table (`policy/registry/classes.json`) maps a unit to a class by rules (side, gait, pred, tags, or a species
list), and maps each class to its net file or to "heuristic". Lurkers (croc, walrus) become a row, not new hooks.
Invariant kept: a net whose output is 0 picks the heuristic's choice, so any class is byte-identical until a net ships.

### 4. Species specs as data, checked automatically
`policy/registry/species_spec.json` holds per-species expectations from the reviewed sources, as checks on the
speciation report (`probes/speciation.js`), for example:
- buffalo: changed picks onto predators ≥ 0 (mobs lions);
- cougar: must not commit to well-guarded targets more than today.

Training uses them as validation gates and the ship check uses them too, so a net that is strong but unrealistic for one
species is caught without anyone having to remember.

### 5. One trainer, one class file
Expert iteration (lookahead teacher → gain regression → DAgger rounds → validation with gates → held-out test) is the
method that has worked across classes. A class file holds everything a run needs: units, candidate source, goal, horizon,
input names, gates, species specs, and the warm-start net. `gcp.js launch class:<name>` builds the sweep from it.

### 6. Ship manifest with a record
`policy/weights/live.json` (it already exists for movement) grows target entries. Each weights file carries:
- its input names;
- the engine hash it was trained on;
- its fresh eval (goal ± SE, style, gates, drift);
- its speciation report.

`target_ident_test` runs every class in the registry automatically.

### 7. What happens when an animal is added
1. Add the roster entry. Traits come from it, and its signature tags join the input registry (append only).
2. It gets routed to a class by the existing rules, and the class net handles it zero-shot.
3. **Coverage check** (automatic): eval the class net on fights with the new species against the heuristic. Below today's
   targets → that species routes to "heuristic" (one line in classes.json) until retrained. Never worse than today.
4. Next retrain of that class warm-starts from the shipped net (widened) and learns the new species' residual.
5. Speciation report plus species-spec checks, the fresh eval, and the ship bar. Then reprice, as for any change.

### 8. Joint training: every class learns in the same fights (owner idea, Oct 31)
Today one class learns while every other class plays its frozen shipped policy. So improvements never adapt to each other:
your guards learned against today's cats, and the next cat net learns against yesterday's guards. Joint training runs
all classes in one environment:
- **One collection pass labels everyone.** In a training fight every class plays its current net. At sampled decisions of
  *any* class, the lookahead teacher branches the fight and labels that decision. Inside the branches, everyone plays the
  current nets, so the teacher judges against the opponents the net will actually meet. One fight yields data for 6–8
  classes, which divides the lookahead's cost across them.
- **Per-decision labels avoid the credit problem** that sank PPO (one fight result spread over ~50k decisions from many
  learners). Each decision gets its own label, whoever made it.
- **Rounds:** collect with the current set, then train each class on its own data (warm start), then validate each class
  against the previous set. A class's update is accepted only if it passes its gates and species specs; rejected classes
  keep their net. The accepted set becomes the new current set.
- **League against cycling.** When both sides learn, they can chase each other in circles (A beats B, B adapts, A's gain
  disappears) or forget how to handle an old style. Keep snapshots of past sets and play a share of the training fights
  against them. A class must hold up against the league, not only the latest set.
- **Fixed yardsticks for shipping.** "Better" is always measured against two fixed references: today's heuristic, and the
  live set. It is never measured only against the moving set. The ship bar stays: ≥ 2 SE on fresh fights, style 1.00, no
  gates, species specs pass.
- **Ships as a set, priced once.** A joint round changes both sides together, so it ships as one release with one
  reprice, not as eight separate PRs.
- **The underdog stays a pricing question.** If both sides improve, how hard the game feels is set by prices and the board
  total as now (the owner decides those knobs). Training doesn't decide difficulty.
- **Order:** single-class runs first, for classes that have no net yet (harriers, lurkers) or a known flaw (chargers),
  because they are cheaper to debug. Then joint rounds over everything, starting from those nets.

### 9. What the nets may control (ladder) and feasibility
Every control is a set of discrete options at a decision point. The engine executes the choice with its sourced
mechanics, and an output of 0 is today's choice. So each rung uses the same interface, teacher and gates.
1. **Whom** (target). Built for every class except the lurkers. Headroom measured: about +0.2 everywhere.
2. **How to approach** (intents: commit / wait / flank / regroup / disengage; cat intents: creep / cover / blindside ...).
   Shipped as movement nets for harrier, guard, cat, bulldozer and charger; built but not shipped for brawler and kicker.
   Next: decide target and intent together (factored: target, then intent, each labelled by the teacher on its own),
   because the cat diagnosis showed that timing plus target is the lever.
3. **When to use the signature move**: start a charge now or reposition, pounce now or creep closer, bluff or charge for
   real, box or kick, drag to water. The engine still decides whether the move works and how hard it hits; the net only
   picks the moment, within sourced limits (bluff counts, cooldowns).
4. **Group roles**: packs and herds pick lead / flank / hold / encircle, with packmates' choices as inputs (wolves, hyena
   clans, lion coalitions, buffalo / bison / musk ox herds).
5. **Your guards' positioning**: escort tighter or intercept, where to stand relative to you and the threats.

Never given to a net (realism first, sourced engine): steering and speed, stats, damage, morale and fleeing thresholds,
wounds, and anything about you (deployment stays the player's).

**Gate per rung: measure headroom before training.** For each class, a lookahead probe on the new options (as
arch_lookahead did for targets) says whether there is anything to learn, in about an hour, before a multi-hour run.

**Feasibility.**
- Compute: expert iteration costs about $0.6–1.3 per class run on spot VMs (5–10 h on 16 cores). A joint round over 8
  classes with targets and intents is about a day on the 64-CPU quota, roughly $5–10. A full programme (rungs 1–3 for
  every class, a few joint rounds) is tens of dollars and a few weeks of calendar time, dominated by evaluation and
  realism checks, not by compute.
- Play cost: nets are about 5k weights and decide a few times a second per animal. The ?smart=1 build already runs four
  of them at phone speed, so more rungs are cheap in-game. No lookahead at play (owner rule).
- Main risk is capture, not cost. Nets have kept about 1/4 to all of the teacher's gain (chargers: about all; enemy
  cats: about 1/2; your cats and bulldozers: none found so far). Expect uneven gains by class, and keep "heuristic" as
  the per-class fallback.
- Second risk: engine changes. Any change to sim.js invalidates trained nets. Named inputs plus warm starts make the
  retrain incremental; the pipeline should retrain automatically after an engine change, and the ship check catches
  drift.

## Choices and why
- **Per-class nets, not one universal net.** One net would share data across classes, but retraining it would change
  every class at once (a full reprice each time) and one class's bug would leak into all. Per-class nets with the same
  architecture and input registry keep the sharing that matters: any class can warm-start from another (lurkers from
  bulldozers).
- **Residual embeddings, small and starting at 0.** They give speciation freedom beyond the traits without making new
  animals depend on training data first.
- **Data over code.** New classes, species, checks and routes are file edits that a test covers, not new code paths.

## Migration (on the main-based branch, before the class retrains)
1. Input registry plus the named-input extractor; current nets get their `inputs` lists written by a converter (same
   numbers, byte-identical play, checked by target_ident_test on every live net).
2. Single `chooseTarget` with the routing table; the old three hooks become routes. Identity test.
3. Species residuals in target_model / set_model (0-initialised); trainer support.
4. species_spec.json plus gates in expert_iter and the ship check.
5. Class files; gcp.js builds sweeps from them.

Then the planned retrains (harriers, species-aware chargers, kickers, lurkers, bulldozers, your cats) run as the first
users of the pattern.
6. Joint rounds (§8): `expert_iter` labels every class's decisions in one collection pass, plus a league of past sets.

Steps 1–2 are about a day of work and change nothing in play. The rest arrives with the first retrains.
