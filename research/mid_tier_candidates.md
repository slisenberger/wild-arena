# Mid-tier animal candidates ($200–$400)

Research only (Oct 27, 2026). Nothing in sim.js, ui.js or elsewhere was changed. Stat lines follow the `ANIMALS` / `STYLE`
format in sim.js and are first guesses by analogy, to be checked with `price_abs.js` and `audit.js` before any pricing.

## How the tiers are read

Prices come from swing (mine − theirs) at 20 s per $100, rounded. Today: $200 ≈ 30–49 s, $300 ≈ 50–69 s, $400 ≈ 70–89 s.
Reference points (MEASURED in sim.js, swing = mine − theirs):

| Animal | Mass | Swing | Price | Note |
|---|---|---|---|---|
| Hippo | 2,000 kg | 66 | $300 | water specialist |
| Buffalo | 750 kg | 56 | $300 | grudge, anti-cat |
| Bison | 900 kg | 54 | $300 | snow tank |
| Black rhino | 1,200 kg | 47 | $200 | |
| Moose | 600 kg | 47 | $200 | snow and water |
| Giraffe | 1,200 kg | 39 | $200 | lookout, harmless on their side |
| Polar bear | 500 kg | 37 | $200 | snow and water |
| Bull | 550 kg | 35 | $200 | |
| Grizzly | 320 kg | 33 | $200 | |
| Croc | 1,000 kg | 25 | $100* | water-bound (*$200 in ROSTER.md table; sim.js price is $100) |
| Boar | 150 kg | 24 | $100 | |
| Tiger | 220 kg | 26 | $100 | |

Rough rule from this table: below ~250 kg an animal lands at $100 whatever its weapons. Mid tier needs ~500–1,500 kg of
real fighter, or a group of ~250–350 kg animals (packs and herds come out at ~2.7–4× a single animal: buffalo 56 → herd
152, hyena 9 → clan 39). Water- or map-limited animals lose about half their value (croc).

Already in the roster, so not proposed again: the saltwater crocodile (the `croc` entry is already the saltwater croc),
Cape buffalo and its herd, a Bengal tiger. A second buffalo and a second tiger have to earn their place on a clearly
different identity.

---

## 1. Musk ox herd ×3 (tundra): the living wall

**Facts**
- Mass: bulls 273–364 kg, cows 182–227 kg (Alaska Dept. of Fish & Game, [muskox guide](https://adfg.alaska.gov/static/species/speciesinfo/muskox/pdfs/muskoxguide.pdf));
  adults average 285 kg, range 180–410 kg (Wikipedia "Muskox", citing standard references). Shoulder ~1.5 m.
- Speed: up to 60 km/h (Wikipedia "Muskox"; treat as a short-burst figure).
- Weapons: horns curving down then up, fused in bulls into a boss. "Four inches of horn boss and three inches of bone
  lie directly over the brain"; rutting bulls charge from ~46 m and collide with a force compared to a car hitting a wall at
  27 km/h (NPS, [Gates of the Arctic: circle defense](https://www.nps.gov/gaar/learn/nature/muskox-circle-defense.htm)).
- Defence against predators: "If only one predator is present, muskoxen form a defensive line … If there are many
  predators, muskoxen form a defensive circle. Adults stand shoulder to shoulder facing the threat, with the young inside"
  (NPS, [Cape Krusenstern: defense strategy](https://www.nps.gov/cakr/learn/nature/mo-defense.htm)). "Occasionally one
  muskox will charge the enemy, but will quickly rejoin the others" (NPS). Bulls form the front line (Wikipedia).
- Weakness of the ring: wolves are the main predator (up to half of all deaths), and "some brown bears have learned how to
  hunt muskox successfully", including grizzlies north of the Brooks Range killing them in their circle (NPS).
- Humans: fatal attacks are rare but real: a 73-year-old man killed in Norway, 22 July 1964 (Wikipedia); Alaska State
  Troopers officer Curtis Worland killed near Nome while trying to scare a group away from his dog kennel
  ([NBC News](https://www.nbcnews.com/news/amp/rcna61640), [Nome Nugget](https://nomenugget.com/news/nome%E2%80%99s-curtis-worland-died-after-musk-ox-attack);
  the coverage dates it to early January 2023: please check the date before quoting it).
- Habitat: Arctic tundra → **tundra** only. Very poorly suited to heat (thick qiviut).

**Suggested stats** (per animal; pack item like `bisonherd`)
```
{id:'muskox', name:'Musk Ox', abbr:'MOX', price:100, mass:300, spd:14, swim:1.2, dmg:110, cd:1.1, armor:.35, reach:2.0,
 stam:25, heat:.3, cold:1, water:.1, aggr:.45, flee:.3, corner:1.6, pred:false, charge:true, vision:25,
 tags:['herd','standsGround','ring']}
STYLE: {gait:'charge', strikeH:1.5, mountH:0, overshoot:2, turn:1.2, wheel:.5}
pack item: ['muskox', 3, 'Musk ox herd', 300, 'herd', 3]   // dealt as a herd 3 times in 4
```
Why: dmg between boar (150 kg, 75) and bull (550 kg, 150). Armor .35 as the bison (horn boss plus very dense coat), with the
ring bonus below on top. Speed 14 rather than the quoted 60 km/h (16.7 m/s): that figure is a burst and the animal is built for
standing its ground. Short `overshoot` because the real sortie is a short dash and back. heat .3 (below polar .4): it suffers
in any warm map. Not rideable (1.5 m, no record of it).

**Signature: `ring` (form a ring)**
- Trigger: ≥ 2 musk oxen of one side within 15 m of each other, and an enemy predator within 25 m coming for one of them,
  or (on your side) for you. Re-checked every 1 s.
- One threat → **line**: the oxen stand shoulder to shoulder (1.2 m apart) between the threat and what they protect.
  Several threats → **ring**: stations on a 2.5 m circle around you (your side) or around their own centroid (other side),
  each facing outward toward the nearest threat.
- While holding station: frontal hits take +.25 armor (horn boss; only for hits within ±60° of facing), no flank bonus
  against them, morale floor .5, and each ox counts double in `guardsAround`, so enemy predators fall back on
  `waitForOpening` (that is how wolves really work a muskox ring: they wait for one to break).
- Sortie: every 6–10 s (random per ox), the ox nearest a predator within 8 m charges it (max 10 m run, normal charge damage)
  and then goes back to its station.
- Ring breaks (oxen scatter and fight individually, 15 s before they can form again) when: a bear (grizzly, polar, black bear)
  or anything over 2× an ox's mass reaches the ring and lands a hit (NPS: bears break it), or a member drops below 30% HP.
- Anti-stall: a ring that has held 20 s with no predator inside 8 m dissolves. On the other side, the battle `drive` makes the
  herd advance as a line on you, and any human on foot within 10 m of an enemy ring draws a sortie (the Norway and Nome
  deaths both happened when a person came close).
- Different from existing kits: the gorilla draws attackers onto itself and the buffalo herd mobs. The ring is a stationary
  formation that physically shields you and turns cats and packs into waiters. It is the first formation mechanic in the game.

**Expected tier:** a single ox ~18–25 s (between boar 24 and grizzly 33, minus its lack of offence), so the herd ~55–75 s
→ **$300** (possibly $400 on tundra-heavy boards; the solo $100). The value is mostly "mine": on their side a ring is
defensive, so "theirs" will be small unless the line advance is strong.
**Portrait:** [File:Muskox animals ovibos moschatus.jpg](https://commons.wikimedia.org/wiki/File:Muskox_animals_ovibos_moschatus.jpg),
public domain, Jerry Hout, U.S. Fish and Wildlife Service (2048×1298). Backup: [File:Ovibos moschatus, Myskoxcentrum.jpg](https://commons.wikimedia.org/wiki/File:Ovibos_moschatus,_Myskoxcentrum.jpg), CC0, Dgse87.
**Risks**
- Balance: a ring around you could be the strongest anti-cat and anti-pack defence in the game for $300. The bear and
  big-animal break rule and the 20 s dissolve are the brakes. It does nothing against elephants or rhinos (realistic), so it
  shouldn't become a must-pick, but a probe of ring time per fight is needed.
- Camping: a stationary formation is exactly what the anti-stall work removed. Measure with `camp.js`/`idle.js`.
- Off-map value: heat .3 makes it a liability on the savanna. Consider dealing it only on tundra and forest (new deal filter,
  as the croc's cold filter does) or accept that it's cheap filler there.
- Realism: solid (NPS, ADF&G). The guarding-a-human part is the stretch: real oxen ring around calves. Treating you as the
  "calf" is the same game assumption the gorilla and the guards already make.

---

## 2. Gaur (forest): the stalker's nightmare

**Facts**
- The largest living bovid. Males 588–1,500 kg, females 440–1,000 kg; shoulder 142–220 cm (avg male 188 cm); horns
  60–115 cm (Wikipedia "Gaur", citing field measurements; a 13-animal Indian sample averaged ~1,500 kg for males).
- Speed: no measured top speed found. "When alarmed, gaur crash into the jungle at a surprising speed" (Wikipedia). Flag:
  the speed in the stat line is an estimate.
- Temperament: timid where undisturbed, "very bold and aggressive" where used to people; "bulls may charge without
  provocation, especially during summer, when the intense heat and parasitic insects make them more short-tempered"
  (Wikipedia). Kills domestic cattle in fights. Attacks on people are a live conflict issue in Kerala
  ([Down To Earth](https://www.downtoearth.org.in/wildlife-biodiversity/kerala-s-gaur-human-conflict-debates-fail-to-address-some-core-issues-here-is-why-89591)).
- Against tigers: only tigers and saltwater crocs kill adults. "When confronted by a tiger, the adult members of a gaur herd
  often form a circle … As tigers rely on ambush attacks when taking on prey as large as a gaur, they will almost always
  abandon a hunt if detected and met in this manner." A herd in Nagarahole "walked as a menacing phalanx towards a stalking
  tiger, forcing the tiger to retreat". A tiger was gored and trampled to death in a prolonged fight, and a large male tiger was
  found dead beside a broken sapling, apparently slammed into it by a bull (Wikipedia and [New World Encyclopedia](https://www.newworldencyclopedia.org/entry/Bos_gaurus),
  which trace these to Karanth's Nagarahole work and to Schaller). Not checked against the primary sources.
- Habitat: evergreen and moist deciduous forest, hills, forest edge (India to Southeast Asia) → **forest** (also savanna at a
  push, as forest-edge grassland).

**Suggested stats**
```
{id:'gaur', name:'Gaur', abbr:'GAU', price:300, mass:1000, spd:14, swim:1.5, dmg:170, cd:1.3, armor:.4, reach:2.4,
 stam:18, heat:.75, cold:.55, water:.2, aggr:.5, flee:.25, corner:1.5, pred:false, charge:true, vision:25,
 tags:['standsGround','facesDown','forestRunner'], rivals:{tiger:1.5, leopard:1.3}}
STYLE: {gait:'charge', strikeH:1.9, mountH:1.9, overshoot:4, turn:.9, wheel:.8}
```
Why: heavier than the buffalo (750 kg, dmg 150) and lighter than the black rhino (1,200 kg, 160 but with a horn): 170. Armor
.4 like the buffalo (thick hide, no rhino plating). Speed 14, a notch under buffalo and bison because of its weight.
`forestRunner` (optional): its charges don't crash into trees (it lives in forest and moves through it at speed); without it, the
forest map would punish its home animal. heat .75 plus `aggr` rising with heat would match "short-tempered in summer", but that
is flavour, not needed.

**Signature: `facesDown` (faces down the stalker)**
- Trigger: an enemy with gait `stalk` or the `ambush` tag, not yet latched, within 20 m, that the gaur can see (`canSee`; forest
  vision ×.55 applies), and whose target is the gaur or anything of its side within 10 m of it (you, if the gaur is yours).
  Cooldown 10 s.
- Effect: the gaur turns to face the cat and walks at it (2 m/s, the "phalanx"). The cat loses its ambush (no ×1.7/×2 first
  strike) and, with probability .7, abandons that target and won't pick it again for 12 s (reuse the `repelBy/repelUntil` fields
  from the honey badger's musk). With .3 it commits anyway, without the ambush bonus.
- Not triggered by cats it can't see: a hidden leopard (`hiddenGuard`), a jaguar in water (`swimStalk`), a polar bear in snow
  (`snowCamo`). That gives the cats counterplay and keeps those signatures meaningful.
- Different from existing kits: the honey badger's musk fires on contact and works on any predator. `facesDown` is sight-based,
  fires before the attack and only against ambushers. The buffalo hunts cats down (grudge, ×1.5 vs lions); the gaur denies them
  the ambush. It gives the forest map, where ambush is ×2, its first specialist answer to cats.

**Expected tier:** buffalo-class body (56 s) plus a deterrent that matters most on forest boards: ~50–65 s → **$300**.
**Portrait:** [File:Intimate portrait of gaur (52077051551).jpg](https://commons.wikimedia.org/wiki/File:Intimate_portrait_of_gaur_(52077051551).jpg),
CC BY 2.0, Kandukuru Nagarjun (5818×3879; needs attribution in CREDITS.md, like the giant kangaroo). Backup:
[File:Gaur Kanha.jpg](https://commons.wikimedia.org/wiki/File:Gaur_Kanha.jpg), CC BY 2.0, Honza Soukup.
**Risks**
- Balance: on forest boards with 2–3 enemy cats it could be close to a must-pick. The .7 chance, the visibility condition and
  the cooldown are the dials. Watch "theirs": on their side it just blunts your cats, which are already weak picks.
- Overlap: a third big charging bovid after buffalo and bison. The identity (anti-ambush, forest) is different, but the body is
  the same. If the roster feels bovine-heavy, the gaur is the one to add rather than a water buffalo.
- Realism: good for the deterrence (one encyclopedic source chain, multiple anecdotes). The tree-slam kill is a single
  anecdote: don't build it in.

---

## 3. Walrus (tundra and river): the tusked tank in the water

**Facts**
- Mass: most Pacific males 800–1,700 kg, outsized ones to 2,000 kg (Wikipedia "Walrus"). Tusks (both sexes) up to 1 m and
  5.4 kg, used for fighting, dominance and hauling out ("Odobenus" = tooth-walker).
- Hide: skin up to 10 cm thick around the neck and shoulders of males, blubber up to 15 cm (Wikipedia). "Their tusks and their
  thick skin" are its defence (walrus researcher, [PolarTREC Q&A](https://polartrec2021.arcus.org/comment/752)).
- Speed: cruises at ~7 km/h, bursts to ~35 km/h in water ([SeaWorld](https://seaworld.org/animals/all-about/walrus/adaptations/),
  [Discover Wildlife](https://www.discoverwildlife.com/tv/animal-facts/marine-animals/walrus-facts)). On land it is slow and
  clumsy; claims that it can match a running human are unverified (flag).
- Predators: only the polar bear and the orca, both mostly on calves; polar bears rush hauled-out herds and take those
  crushed in the stampede (Wikipedia). A 1981–89 Canadian High Arctic study recorded bears killing 3 (probably 7) walruses and
  wounding 3 without killing them ([Calvert & Stirling, bear biology](https://www.bearbiology.org/download/interactions-between-polar-bears-and-overwintering-walruses-in-the-central-canadian-high-arctic/)).
  Popular sources say walruses fatally wound bears with their tusks; no documented case was found (flag).
- Humans: walrus attacks are documented by Inuit and European explorers, mostly on boats and kayaks, sometimes capsizing
  them; in a 1960 Greenland case a walrus surfaced at the ice edge and stabbed a hunter with a tusk
  (Wikipedia, [Walrus attack](https://en.wikipedia.org/wiki/Walrus_attack)).
- Habitat: Arctic shelf seas, sea ice, beaches → **tundra** (the half-frozen lake, ~44% of tundra maps) and **river**.
  Useless on dry ground.

**Suggested stats**
```
{id:'walrus', name:'Walrus', abbr:'WAL', price:200, mass:1200, spd:3, swim:4, dmg:170, cd:1.4, armor:.5, reach:2.2,
 stam:6, heat:.3, cold:1, water:1, aggr:.5, flee:.2, corner:1.4, pred:false, charge:false, vision:20,
 tags:['territorial','submerges','tuskStab','needsWater'], rivals:{polar:1.3}}
STYLE: {gait:'lunge', strikeH:1.5, mountH:0}
```
Why: mass and damage like the black rhino. Armor .5 just under the hippo (.55): 10 cm hide plus blubber. Land speed 3 m/s and
stamina 6 because it hauls itself along. swim 4 (sustained burst; croc 5, polar 3). The croc's `lunge` gait fits a heavy body
that heaves forward and stabs down. `territorial` and `submerges` as the hippo: it defends its stretch of water, it doesn't hunt
you (`pred:false`; it eats clams).

**Signature: `tuskStab` (stab from the water)**
- Trigger: the walrus is in water (or within 1 m of it) and its target is within reach at the water's edge or in the water
  (wading, swimming, or a rider on a wading mount).
- Effect: a downward two-tusk stab instead of a normal strike: ×1.5 damage, ignores half of armor, and a target ≤ 1.5× its mass is
  pinned for 1 s (stun). Cooldown: every other strike. On land it strikes normally (no bonus).
- Rider rule: a stab on a mount of `mountH` ≤ 2 m in water has a 30% chance to throw the rider (the kayak record).
- `needsWater` (a new deal filter, like the croc's cold filter): only dealt on maps with water (`w.wet`), so it's never stranded
  on a dry savanna. This needs `dealBoard` to know the map variant, not only the terrain (today it gets `rules.terrain`).
- Different from existing kits: the croc grabs and drags under; the hippo charges out of the water; the polar bear stalks from it.
  The walrus is a defensive wall at the shoreline: it doesn't chase, but whatever fights it at the water's edge takes the
  heaviest piercing hit in the game for its price. On your side, deploy it on the bank beside you.

**Expected tier:** hippo-like in water, nothing on land. With the water deal filter, ~35–50 s → **$200**. Without it (dealt
on dry maps too), croc-like ~20–30 s → $100.
**Portrait:** [File:Pacific Walrus - Bull (8247646168).jpg](https://commons.wikimedia.org/wiki/File:Pacific_Walrus_-_Bull_(8247646168).jpg),
public domain, Joel Garlich-Miller, U.S. Fish and Wildlife Service (3072×2048). Backup: [File:Close up of head of young bull walrus marine mammal in water odobenus rosmarus.jpg](https://commons.wikimedia.org/wiki/File:Close_up_of_head_of_young_bull_walrus_marine_mammal_in_water_odobenus_rosmarus.jpg), public domain, same author.
**Risks**
- Balance: low risk of a must-pick (immobile). Bigger risk: it's a dud whose value depends on deployment and map, like the
  giant kangaroo's hold-under.
- Engine: needs the deal filter to know about water, and land locomotion at 3 m/s may look odd next to 15 m/s animals. Both are
  honest.
- Realism: good facts (USFWS, Wikipedia, Calvert & Stirling). The river map is fresh water and the walrus is marine; the
  tundra lake is the better fit. Flag for the owner: a walrus in an African river may read as wrong. Restricting it to tundra
  (lake variants) would be cleaner but rarer.
- Overlap: some with the hippo (big armored water animal); the hippo charges, the walrus holds the edge.

---

## 4. Plains zebra harem ×4 (savanna): the stallion

**Facts**
- Mass: males 220–322 kg, females 175–250 kg; runs at 60–70 km/h (Wikipedia "Plains zebra").
- Social defence: harems of one stallion, several mares and foals. "The harem stallion attacks predators to defend his harem";
  hunted by hyenas or wild dogs, "a zebra harem stays close together and cooperates to protect threatened members … The harem
  stallion goes on the offensive and attacks the dogs or hyenas." Against lions: "Stallions sometimes try to drive lions away with
  bluff charges"; zebras keep 50–100 m from a lion (Wikipedia).
- Weapons: kicks and bites. A well-placed kick can kill a hyena (fact sheet, [Blair Drummond](https://blairdrummond.com/animals/our-animals/grants-zebra/));
  claims that kicks break lions' jaws or kill lions are lodge-blog level ([Londolozi](https://blog.londolozi.com/2017/06/01/zebra-stallions-fighting/), flag).
  Stallion fights are savage (tails bitten off, broken bones, sometimes fatal; Londolozi).
- Humans: no record of hunting people; a zebra bites and kicks when handled (zoo keepers) and is famously hard to tame.
- Habitat: African savanna → **savanna** (and river).

**Suggested stats** (per zebra; first member is the stallion)
```
{id:'zebra', name:'Plains Zebra', abbr:'ZEB', price:100, mass:270, spd:17, swim:1.2, dmg:90, cd:1.0, armor:.1, reach:1.8,
 stam:30, heat:1, cold:.5, water:-.2, aggr:.3, flee:.45, corner:1.5, pred:false, charge:false, vision:35,
 tags:['herd','kicker','stallion']}
STYLE: {gait:'keepaway', strikeH:1.6, mountH:0}
pack item: ['zebra', 4, 'Zebra harem', 200, 'harem', 3]
```
Why: between ostrich (120 kg, kick 110 with a claw) and giraffe (1,200 kg, 150); dmg 90 for a blunt hoof. Keepaway gait like
other kickers. Not rideable (never domesticated).

**Signature: `stallion` (the stallion's defence)**
- The mares stay bunched (within 6 m of each other) and keep you in the middle when they're on your side.
- The stallion attacks harriers (gait `orbit`, or any predator ≤ 1.5× his mass) that close within 10 m of a mare or of you:
  he runs at them, bites and holds 1.5 s (stun .5; zebras bite), then wheels and double-kicks (×1.3, shove 1 m).
- Big cats (lion, tiger, smilodon) only get a bluff charge (reuse `bluff`), then the harem bolts.
- Flight kick (all members): fleeing, a zebra kicks back at a pursuer directly behind within 2 m (normal kick, no cooldown
  reset). Different from the ostrich, which kicks forward and only up close to you.

**Expected tier:** ~1,100 kg of mostly evasive animals. Ostrich 21, giraffe 39, wolf pack 27 → ~25–40 s → **$200** at the
low end, possibly $100. The hard-counter to hyena clans and wolf packs is its point.
**Portrait:** [File:Plains zebra, South Luangwa National Park (51871516786).jpg](https://commons.wikimedia.org/wiki/File:Plains_zebra,_South_Luangwa_National_Park_(51871516786).jpg),
CC BY 2.0, "I've Got It On Film!" (Flickr). Backup: [File:Equus quagga granti - Opole1.jpg](https://commons.wikimedia.org/wiki/File:Equus_quagga_granti_-_Opole1.jpg), CC BY 3.0, Pudelek (Marcin Szala).
Free zebra head shots are scarce on Commons; a closer crop may need more searching.
**Risks:** the savanna is already the best-covered map. Likely below mid tier. On the other side zebras would be close to
harmless (realistic, but filler). Iconic, so players will like seeing it.

---

## 5. Wild water buffalo (river)

**Facts**
- 600–1,200 kg, heavier than domestic water buffalo; captive average 900 kg; shoulder 150–190 cm; horn span among the widest
  of any bovid (Wikipedia "Wild water buffalo"). Grassland, swamp and riverine habitat (Kaziranga, Assam).
- Tigers and mugger crocs take adults. A herd drove a tiger out of a river in Kaziranga: two adults advanced on it, gained
  momentum, and the tiger ran (Aaranyak biologist's account, [econe.in](https://www.econe.in/preypredatorstory); anecdotal).
- Humans: a wild buffalo outside Kaziranga gored two villagers to death in January 2021
  ([EastMojo](https://eastmojo.com/news/2021/01/15/assam-kaziranga-wild-buffalo-gunned-down-after-goring-2-men-to-death/)).

**Suggested stats**
```
{id:'waterbuffalo', name:'Wild Water Buffalo', abbr:'WWB', price:300, mass:900, spd:14, swim:2, dmg:160, cd:1.3, armor:.35,
 reach:2.6, stam:20, heat:.7, cold:.5, water:.7, aggr:.6, flee:.25, corner:1.5, pred:false, charge:true, vision:25,
 tags:['herd','wadesIn'], rivals:{tiger:1.4, croc:1.3}}
STYLE: {gait:'charge', strikeH:1.8, mountH:1.8, overshoot:3, turn:.9, wheel:.7}
```
**Signature: `wadesIn`:** wades at 80% speed (not the 40% everyone else gets); its charges don't founder in deep water; it
charges into the water at a predator holding or lunging at anything of its side there (croc death roll, polar or jaguar
water ambush): the first hit breaks the hold, as the boar's `upends` does.
**Expected tier:** ~50–60 s → $300.
**Portrait:** [File:A wild water buffalo at Kaziranga National Park (কাজিৰঙা ৰাষ্ট্ৰীয় উদ্যানত এটি বনৰীয়া ম'হ).jpg](https://commons.wikimedia.org/wiki/File:A_wild_water_buffalo_at_Kaziranga_National_Park_(%E0%A6%95%E0%A6%BE%E0%A6%9C%E0%A6%BF%E0%A7%B0%E0%A6%99%E0%A6%BE_%E0%A7%B0%E0%A6%BE%E0%A6%B7%E0%A7%8D%E0%A6%9F%E0%A7%8D%E0%A7%B0%E0%A7%80%E0%A7%9F_%E0%A6%89%E0%A6%A6%E0%A7%8D%E0%A6%AF%E0%A6%BE%E0%A6%A8%E0%A6%A4_%E0%A6%8F%E0%A6%9F%E0%A6%BF_%E0%A6%AC%E0%A6%A8%E0%A7%B0%E0%A7%80%E0%A7%9F%E0%A6%BE_%E0%A6%AE%27%E0%A6%B9).jpg),
CC BY 4.0, কুমুদ ঘোষ (Kumud Ghosh). Backup: [File:Wild water buffalo in the reeds.jpg](https://commons.wikimedia.org/wiki/File:Wild_water_buffalo_in_the_reeds.jpg), CC BY 4.0, Murugavel.T.
**Risks:** strong overlap with the Cape buffalo (same body, same price, same "anti-cat bovine" read) and with the hippo on the
river. Realism of the rescue is anecdotal. Recommend **not** adding it alongside the gaur; if anything, it's the river version
of the same idea.

---

## 6. Komodo dragon (savanna, forest): venom, $100, not mid tier

**Facts**
- Mass: wild adults ~70 kg, average males 79–91 kg (Guinness figures, via [WorldAtlas](https://worldatlas.com/articles/komodo-dragon-facts-animals-of-asia.html)); bursts to ~20 km/h over a few dozen metres; ambushes deer, pigs and water
  buffalo from cover at 5–10 m.
- Venom: Fry et al. 2009, PNAS 106:8969–8974 ([PMC2690028](https://pmc.ncbi.nlm.nih.gov/articles/PMC2690028)): venom glands
  with anticoagulant and shock-inducing toxins; the skull is weak in bite force but resists pulling ("grip and rip"); the old
  "toxic bacteria" story is rejected. It bites, lets go, and follows the bleeding animal.
- Habitat: dry savanna and monsoon forest on Komodo, Rinca, Flores → **savanna, forest**. Cold-blooded (cold < .3), so the
  existing rule keeps it off the tundra.

**Suggested stats**
```
{id:'komodo', name:'Komodo Dragon', abbr:'KOM', price:100, mass:85, spd:5.5, swim:1, dmg:50, cd:1.0, armor:.3, reach:1.5,
 stam:4, heat:1.2, cold:.2, water:.3, aggr:.6, flee:.3, corner:1.4, pred:true, charge:false, vision:20,
 tags:['ambush','venom','scavenger'], prey:{human:.6}}
STYLE: {gait:'lunge', strikeH:1.0, mountH:0}
```
**Signature: `venom` (bite and follow):** each bite adds a venom stack (max 3): 0.8% max HP/s for 20 s and −15% stamina regen;
other bleeds on a venomed target run 1.5× (anticoagulant). After a bite it backs off to ~8 m and shadows the target instead of
holding on; it prefers venomed targets within 60 m. Different from the smilodon (one big stab plus 8 s bleed), boar and ostrich
(short bleeds): a slow, stacking, long-range threat.
**Expected tier:** 85 kg, slow, short reach → ~10–20 s → **$100**. It does not fit the brief's tier. Its mid-tier version is
the rare **Megalania** (*Varanus priscus*, the giant Ice Age monitor that Fry et al. 2009 also argue was venomous; mass
estimates vary widely, a few hundred kg is the usual recent range: needs a paleontology check), which BACKLOG.md already lists
for an "Ice Age Australia" board. No free Megalania image was found on Commons in this search.
**Portrait (Komodo):** [File:Komodo dragon (Varanus komodoensis) in Disney's Animal Kingdom.jpg](https://commons.wikimedia.org/wiki/File:Komodo_dragon_(Varanus_komodoensis)_in_Disney%27s_Animal_Kingdom.jpg),
CC0, Kaldari. Backup: [File:Komodo dragon, Varanus komodoensis, Komodo Island, Indonesia, 20250822 1319 2752.jpg](https://commons.wikimedia.org/wiki/File:Komodo_dragon,_Varanus_komodoensis,_Komodo_Island,_Indonesia,_20250822_1319_2752.jpg), CC BY 4.0, Jakub Hałun.
**Risks:** a new damage-over-time type that would need care in the morale and "gave up" logic (a target that's still
bleeding when the fight goes quiet). Strong identity, wrong tier.

---

## 7. Common eland (savanna): judged weak

**Facts:** bulls 400–942 kg (to ~1,000), cows 300–600 kg; "the slowest antelope", peak 40 km/h that tires them quickly,
trots at 22 km/h indefinitely; can jump 2.5–3 m fences; docile; bulls bark and trot back and forth to alert the herd to
predators; females use their horns to protect young (Wikipedia "Common eland"). Preyed on by lions, hyenas, wild dogs.
**Stats by analogy:** mass 700, spd 11, dmg 110, armor .2, aggr .2, flee .45, gait `keepaway`, tags `['herd','lookout']`.
**Signature idea:** `alarmTrot` (a bark that alerts the team like the giraffe's lookout). That duplicates the giraffe and the
giant kangaroo's thump.
**Expected tier:** giraffe-like at best without the giraffe's kick: ~20–35 s → $100–200.
**Portrait:** [File:Antílope Eland (Tragelaphus oryx).jpg](https://commons.wikimedia.org/wiki/File:Ant%C3%ADlope_Eland_(Tragelaphus_oryx).jpg), CC BY 4.0, Josefito123.
**Verdict:** real but passive; no distinct fighting identity. Not recommended.

---

## 8. Gemsbok (savanna): great signature, $100 body

**Facts:** males 180–240 kg, females 100–210 kg, to 60 km/h; both sexes carry ~85 cm spear horns; females defend calves with
them; Kalahari and Namib (Wikipedia "Gemsbok"). Lions killed by gemsbok horns are widely claimed (kneels with its head between
its forelegs, horns forward) but I found only guide and dealer accounts, not a field record
([teamwindchase travel log](https://teamwindchase.com/Africa-2019-11.htm); flag).
**Signature idea:** `spearWall`: a pounce or rush coming at it head-on (within ±45° of its facing) meets the horns: the attacker
takes ×1.5 of its own momentum damage and the pounce fails. Cats learn to come from behind (the cougar's nape bite is the
mirror image).
**Expected tier:** 210 kg → ~15–25 s → $100. A gemsbok herd ×3 might reach $200.
**Portrait:** [File:Gemsbok (Oryx gazella) (8603176457).jpg](https://commons.wikimedia.org/wiki/File:Gemsbok_(Oryx_gazella)_(8603176457).jpg), CC BY 2.0, Ron Knight.
**Verdict:** a good $100 light pick for later; not mid tier, and the lion-killing claim needs a better source.

---

## 9. Siberian (Amur) tiger (tundra, forest): overlap

**Facts:** wild males 180–306 kg in the 1980s data, historical average 215 kg; females 100–167 kg (Wikipedia "Siberian tiger",
citing Slaght et al. 2005). Kills brown and Asiatic black bears occasionally: bears were 2.2% of 1992–2013 kills found in
Sikhote-Alin (Seryodkin et al. 2018, [WCS](https://library.wcs.org/en-us/doi/ctl/view/mid/33065/pubid/PUB15720.aspx));
secondhand tallies of 22 tiger-kills-brown-bear vs 12 the reverse (unverified forum figure; flag).
**Stats:** tiger with mass 250, cold 1, heat .5, `snowCamo`-like stalking in snow, rival bonus vs bears.
**Signature idea:** `bearHunter`: prefers bears as prey and gets its throat hold on them.
**Expected tier:** the Bengal tiger is 26 s at 220 kg → ~25–40 s → $100–200, highest on tundra.
**Portrait:** [File:Panthera tigris altaica 13 - Buffalo Zoo.jpg](https://commons.wikimedia.org/wiki/File:Panthera_tigris_altaica_13_-_Buffalo_Zoo.jpg), public domain, Dave Pape.
**Verdict:** the tundra does lack a cat, but this is the tiger again with a coat. Better as a cosmetic/terrain variant of the
existing tiger (e.g. the tiger card shows "Amur tiger" on tundra boards with cold 1) than as a new pick.

---

## Considered and set aside (below mid tier or already covered)

| Animal | Mass | Why not mid tier | Source |
|---|---|---|---|
| Green anaconda | typical females 30–80 kg (verified max 97.5 kg; "up to 250 kg" is an upper claim) | $100 river ambusher; constriction overlaps the croc's hold | Britannica; [Guinness](https://www.guinnessworldrecords.com/world-records/70277-heaviest-species-of-snake) |
| Southern cassowary | 29–55 kg males, 47–76 kg females (~85 kg max); 50 km/h, jumps ~2 m | $100; overlaps the ostrich (claw kick). A good forest $100 later | Wikipedia "Southern cassowary" |
| Wolverine | 11–18 kg males | $100 tundra honey badger; the honey badger is already the weakest pick (3 s) | Wikipedia "Wolverine" |
| Saltwater crocodile | — | already in the roster (`croc` is the saltwater croc) | sim.js |
| Cape / Asian water buffalo variants | — | Cape buffalo already in; Asian covered in §5 (overlap) | — |
| Wild yak | bulls to ~1,000 kg | cold high-plateau bovid: a second bison (snow tank); generally avoids people | Wikipedia "Wild yak" |

---

## Ranked shortlist

1. **Musk ox herd ×3 — $300, tundra.** The most new gameplay: the first formation mechanic (a ring or line that physically
   shields you and turns cats and packs into waiters, broken by bears). Excellent sources (NPS, ADF&G, human fatalities). Adds a
   tundra specialist at the price where the tundra has only the moose, bison and polar bear. Watch stalling and ring time.
2. **Gaur — $300, forest.** The forest's first specialist: a heavy bovid whose signature is denying ambushes (the forest's ×2
   ambush makes cats strongest there). Well-sourced deterrence (Karanth/Schaller via Wikipedia). Main risk is "another bovine"
   and being too good against cat-heavy forest boards.
3. **Walrus — $200, tundra lake and river.** A new silhouette (pinniped) and a new role: an immobile shoreline wall with a
   piercing stab from the water, instead of another charger. Needs a water-aware deal filter; may be swingy with deployment.
   Public-domain USFWS portraits are plentiful.
4. **Zebra harem ×4 — $200 (maybe $100), savanna.** The hard counter to hyena clans and wolf packs (the stallion attacks
   harriers, bluffs lions), well sourced for behaviour, iconic. Lowest value and on the best-covered map; take it if the owner
   wants a cheap mid-tier group rather than another heavyweight.

Honourable mentions: the Komodo dragon's venom is the best new mechanic in this list but it's a $100 animal; its mid-tier
form is the rare Megalania. Gemsbok (`spearWall`) and cassowary are good future $100 light picks. Wild water buffalo, eland and
the Amur tiger are not recommended (overlap or no identity).

Map coverage after the top three: tundra +2 (musk ox, walrus), forest +1 (gaur), river +1 (walrus, if allowed there).

## Notes for the main session

- Every new animal also joins the other side and dilutes the deal (12 of now ~32–35 species per board). Re-run `price_abs.js`
  (N=240) on the new entries and `board.js` validation after adding them; the board total ($2,600) will probably need re-tuning.
- New hooks implied: `ring` (formation stations), `facesDown` (could reuse `repelBy/repelUntil`), `tuskStab`, a water-aware deal
  filter (`needsWater`), `forestRunner`. All are opt-in per species, so boards without these animals stay byte-identical, as the
  identity pass did.
- Uncertain points flagged in the text: gaur top speed; walrus land speed and whether walruses kill polar bears; the Worland
  date; zebra kicks killing lions; gemsbok killing lions; Megalania mass; Amur tiger vs bear tallies.
- Wikipedia text was read through the MediaWiki API (rate-limited; Komodo and anaconda pages couldn't be fetched, so their
  facts come from the other sources cited). Commons licences were read from each file's `extmetadata` (LicenseShortName, Artist);
  files marked BY-SA, NC, ND or GFDL were excluded. Re-check each file page before cropping.
