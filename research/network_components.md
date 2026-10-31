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

Steps 1–2 are about a day of work and change nothing in play. The rest arrives with the first retrains.
