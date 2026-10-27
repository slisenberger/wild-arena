# Prehistoric candidates (mid tier $200–$400, or strong rares)

Research only (Oct 27, 2026). Nothing in sim.js, ui.js or elsewhere was changed. Same format as
`research/mid_tier_candidates.md`: stat lines follow the `ANIMALS` / `STYLE` format in sim.js and are first guesses by
analogy, to be checked with `price_abs.js` and `audit.js` before any pricing.

Owner's rule for prehistoric animals: **it must have really lived**, and nothing speculative is presented as fact. So each
entry starts with **evidence quality**, rated:

- **A**: many skeletons, or frozen mummies with skin, hair and stomach contents. Body size and build are known.
- **B**: good skeletons but few of them, or behaviour inferred only from bones (mechanics, wear, isotopes).
- **C**: fragments (a skull, teeth, a few bones). Size is extrapolated and behaviour is guessed. Ranked down or set aside.

Behaviour can't be observed in any of these animals. Every signature below is labelled with what it rests on: **trace**
(a fossil injury, bite mark or trackway), **morphology** (bone mechanics), or **analogy** (with a named living relative).

Already in the game and not proposed again: triceratops, woolly mammoth, giant kangaroo (Procoptodon), Smilodon. Being built
separately right now: musk ox herd, gaur, walrus (the walrus is the reason no prehistoric seal or sea cow is proposed here).

## How the tiers are read

20 s of swing per $100: $200 ≈ 30–49 s, $300 ≈ 50–69 s, $400 ≈ 70–89 s. Reference points (swing = mine − theirs):
hippo $300 66 s, white rhino (2.3 t) $400 ~76, bison $300 55, buffalo $300 56, moose $200 47, black rhino $200 47,
polar bear $200 37, grizzly $200 33, bull $200 35, hyena clan $200 ~40, lion coalition $200 25, tiger 26, lion 26,
Smilodon $100 17–27, giant kangaroo $100 18–20. Rule from the existing roster (see the mid-tier doc): below ~250 kg an animal
lands at $100 whatever its weapons, and mid tier needs ~500–1,500 kg of real fighter or a group of ~60–350 kg animals.

Every existing prehistoric animal is a **rare** (dealt on ~30% of boards). Two separate questions for each candidate:
the price (from swing) and whether it is dealt as a rare. A rare can still cost $300.

Maps: savanna (open, hot, fire), river (water band, flood), forest (trees, ambush ×2, vision ×.55), tundra (deep snow
slows heavy bodies: `snowFactor` = 1.05 − .25·log10(mass/50), clamped .5–.95; mammoth .75, bison .92, polar/wolf/cougar/
moose 1). The tundra and forest have the fewest specialists.

---

# Part 1: Ice Age and Cenozoic animals

## 1. Woolly rhinoceros (*Coelodonta antiquitatis*), tundra: the snow-plough ram

**Evidence: A.** Several frozen carcasses with skin, fur, organs and stomach contents (Starunia, Ukraine, 1907 and 1929;
Churapcha 1972; "Sasha", a 7-month calf found in Yakutia in 2014; a 3–4-year-old in 2020 with most organs intact). Many
skeletons and skulls, and some 20 Palaeolithic cave paintings, one showing two rhinos fighting (Chauvet).
- Size: 3.2–3.6 m long, 1.45–1.6 m at the shoulder, up to **1.5–2 t**. Some sources say up to 2.4–2.9 t (Wikipedia
  "Woolly rhinoceros", citing size studies). Comparable to the white rhino, with a longer body and shorter legs.
- Horns: a nasal horn usually **1–1.35 m** long (record 1.65 m along the curve), 2.5–11.4 kg, often flattened from side to
  side. Abrasion on the horn points to **sweeping snow aside while grazing**. The nasal septum was ossified, which is
  read as an adaptation to pressure on the face from grazing under snow.
- Skin 5–15 mm thick (heaviest on chest and shoulders), 1.5–3 cm of fat under it, a thick undercoat with long guard hair.
  Short ears and tail (less heat loss).
- Combat: skulls show damage from other rhinos' front horns, and jaws and ribs show healed breaks. Fights between rhinos seem
  to have been more frequent than in living rhinos. Adults had few predators. Cave hyenas scavenged them, and one skull from
  the Volga carries a healed cave-lion wound from youth.
- Habitat: mammoth steppe, lowlands and river valleys, dry and cold. It avoided mountains with heavy snow (flag: it was
  built for cold and shallow snow, not deep drifts). Better tolerance of warmth than the mammoth.
- Maps: **tundra** (home), forest/savanna playable but it overheats.

**Suggested stats**
```
{id:'woollyrhino', name:'Woolly Rhinoceros', abbr:'WRH', price:300, mass:1800, spd:12, swim:1, dmg:175, cd:1.4, armor:.5,
 reach:2.8, stam:15, heat:.4, cold:1, water:0, aggr:.5, flee:.2, corner:1.4, pred:false, charge:true, vision:18, rare:true,
 tags:['snowPlough']}
STYLE: {gait:'charge', strikeH:1.5, mountH:1.8, overshoot:7, turn:.3, wheel:1.3, style:'Snow-plough ram',
 how:'Head low, horn sweeping the snow aside; charges down its own furrow.'}
```
Why: mass between the black (1.2 t) and white rhino (2.3 t). dmg 175 is just under the white rhino's 180 (lighter, but a
longer horn). reach 2.8 (white rhino 2.6) for the 1–1.35 m horn. Armor .5 like the black rhino: thinner skin than African
rhinos, but fat and fur on top. spd 12 because of the short legs. heat .4 (polar bear's) and cold 1. vision 18 like the white
rhino (small eyes). Rideable at 1.8 m like the other rhinos (the "default mount" rule still prefers giants).

**Signature: `snowPlough` (morphology: horn abrasion and the ossified septum)**
- Its own `snowFactor` is .8 (a 1.8 t body would get .66). The horn and head push snow aside.
- While it moves on a snow map it leaves a **furrow**: a trail point every 0.5 s, each lasting 20 s. Anyone within 1.5 m of
  a live trail point moves as if `snowFactor` were halfway to 1 (sf + (1 − sf)/2). Your elephant (.53) gets .77 in it; a
  rider on the rhino's back gets nothing extra.
- Its charges in snow keep full speed (other chargers lose snow speed); on the furrow everyone else does too.
- Render: a darker line in the snow that fades.
- Different from existing kits: the first animal that changes the map for others. On the tundra you deploy your heavy team
  behind it and it opens lanes; on their side its furrows bring their heavy animals to you faster.

**Tier:** a white rhino minus a fifth of its mass, plus tundra mobility: ~55–70 s on tundra boards, ~45 s elsewhere (heat),
→ **$300, dealt as a rare** (mammoth-style Ice Age rare). Without the furrow it's a $300 rhino with a coat.
**Portrait:** [File:Woolly rhinoceros (Coelodonta antiquitatis) - Mauricio Antón.jpg](https://commons.wikimedia.org/wiki/File:Woolly_rhinoceros_(Coelodonta_antiquitatis)_-_Mauricio_Ant%C3%B3n.jpg),
CC BY 2.5, Mauricio Antón (683×490: small but usable for 112×112). Backup: [File:Wooly rhinoceros.jpg](https://commons.wikimedia.org/wiki/File:Wooly_rhinoceros.jpg),
public domain, Charles R. Knight (846×629).
**Risks**
- Realism: excellent body evidence. The furrow is an extrapolation from horn wear (feeding behaviour), made into a movement
  effect. Honest in spirit (a 1.8 t animal does compact snow), but say "inferred" on the card.
- Overlap: a third rhino. The tundra role and the furrow keep it apart, but its fighting is ordinary rhino.
- Balance: the furrow helps elephants and mammoths most on the tundra, where they were weakest. Watch elephant boards there.

---

## 2. Giant short-faced bear (*Arctodus simus*), tundra and forest: the bully

**Evidence: A−.** Many specimens across North America, several fairly complete skeletons (the most complete, from Fulton
County, Indiana, has disease lesions), Yukon genomes (2020). Diet is the debated part, not the body.
- Mass: adults **317–957 kg**. Females mostly under 500 kg, males ~700–850 kg (Christiansen 1999 mean 770 kg from seven male
  limb bones; a 2010 study put three of six specimens at 740–957 kg). Average ~625 kg. One of the largest land carnivorans.
- Height: up to 1.67 m at the shoulder; **2.4–3.4 m standing on its hind legs, with a vertical arm reach up to 4.3 m**.
- Locomotion: an efficient pacing gait built for endurance, top speed ~40–45 km/h (Matheus' calculations). Its build is "gracile",
  which argues against chasing nimble prey.
- Diet: today read as a colossal opportunistic omnivore, brown-bear-like (dental wear, jaw mechanics; Figueirido et al. 2010).
  Isotopes vary by region: some La Brea and Beringian individuals sit at the trophic level of Smilodon. A canine puncture on a
  Columbian mammoth rib and gnaw marks on mammoth bones (Huntington Reservoir, Utah) are attributed to it. Long argued to be a
  **kleptoparasite** that used its size to take kills from wolves, Homotherium and other predators (Matheus 1995). Flag:
  that's a hypothesis, not established.
- Habitat: temperate open woodland, mixed habitats, Beringian steppe (C3 diets point to some tree cover). Maps: **tundra,
  forest** (savanna possible).

**Suggested stats**
```
{id:'shortface', name:'Giant Short-faced Bear', abbr:'SFB', bluffP:.5, price:300, mass:700, spd:12.5, swim:1.8, dmg:165,
 cd:1.0, armor:.35, reach:2.3, stam:25, heat:.65, cold:.95, water:.3, aggr:.6, flee:.2, corner:1.3, pred:true, charge:false,
 vision:30, hpMul:1.1, rare:true, tags:['scavenger','bluff','usurps'], prey:{human:.6},
 rivals:{grizzly:1.2, wolf:1.3, smilodon:1.2}}
STYLE: {gait:'lumber', strikeH:4.3, mountH:1.7, maul:true, style:'Bully',
 how:'Stands up to 3.4 m over anything holding a kill and makes it let go. Every third swipe is a maul.'}
```
Why: 700 kg, between the female and male means. dmg 165 on the bear line (grizzly 320 kg 125, polar 500 kg 145). spd 12.5
from the 40–45 km/h estimate; stam 25 (grizzly 15) for the endurance build. strikeH 4.3 from the measured arm reach: it can
reach riders on giants (elephant mountH 3.2), the only animal besides elephant-class reach that can. hpMul 1.1 (grizzly has
1.2; this one is less heavily built for its size). Rideable? No (not a mount).

**Signature: `usurps` (hypothesis plus analogy: brown bears at wolf and cougar kills)**
- Analogy: in Yellowstone, grizzlies regularly take carcasses from wolves (Gunther & Smith 2004, *Ursus* 15:232–238) and bears
  take cougar kills (Murphy et al. 1998, *Ursus* 10:55–60). Neither paper was re-read for this doc; check before quoting.
- Trigger: an enemy predator within 25 m is holding, latched onto or feeding on something (any `latch`/hold state, or a croc's
  death roll), and that predator is ≤ 0.6× the bear's mass. Cooldown 8 s.
- Effect: the bear goes to it and **rears** (1.2 s, it stands 3.4 m tall). The predator lets go and yields with probability .6
  (+.2 if ≤ .3× the bear's mass, −.2 per packmate within 15 m). A yielding predator backs off and ignores that target for 15 s
  (reuse `repelBy`/`repelUntil` from the honey badger). If it doesn't yield, the bear's first strike is a maul.
- On your side: it pries cats, wolves, hyenas and smaller crocs off your animals, and off you. On their side: it takes your
  guard cats' and packs' targets away from them, then fights for the carcass.
- Different from existing kits: the gorilla draws attackers onto itself, the black bear bluffs things its own size, the honey
  badger's musk works only on whatever bites it. This one ends **holds on others**, which nothing else does. The boar's
  `upends` also breaks a hold, but only with a charge hit on a small target.

**Tier:** a polar bear (37 s) with 40% more mass, the anti-hold signature and rider reach: ~45–60 s → **$300** ($200 if
`price_abs` comes in low). Rare (Ice Age).
**Portrait:** [File:Arctodus simus model.jpg](https://commons.wikimedia.org/wiki/File:Arctodus_simus_model.jpg), CC0,
Hunsvotti (3000×4000, photo of a museum life model). Backup: [File:Arctodus simus National Parks Coloring Book.png](https://commons.wikimedia.org/wiki/File:Arctodus_simus_National_Parks_Coloring_Book.png),
public domain (NPS; it's line art, so the model photo is better).
**Risks**
- Realism: body A; the bully role rests on a debated hypothesis plus good modern analogy. Card text: "may have taken kills
  from other predators, as grizzlies do from wolves."
- Overlap: a fourth bear (grizzly, polar, black). The signature and size give it a different job; its fighting (maul) is
  shared.
- Balance: the anti-hold could make enemy cats near-useless when it's on your side. The .6 chance and the mass ratio are the
  dials.

---

## 3. *Doedicurus clavicaudatus*, savanna: the living fortress with a mace

**Evidence: A−.** Known since Owen (1847) from tails, carapaces, skulls and skeletons (Burmeister 1874 reconstruction). Ancient
DNA (2016, from a 12,000-year-old carapace) places glyptodonts inside the armadillos.
- Mass: ~**1,400 kg** on average, ~1.5 m tall, 3.6 m long; one 8,000-year-old specimen calculated at 1.9–2.4 t.
- Armor: a domed carapace of tightly fitted scutes, anchored to the pelvis; armored skull roof and tail.
- Tail: a club up to **1 m long, 40–65 kg**, with depressions along its edges that probably held horn spikes. Alexander,
  Fariña & Vizcaíno (1999, *Zool. J. Linn. Soc.*) calculated a blow of about **2.5 kJ**, tip speeds of 11–15 m/s, and
  reported **carapace fractures consistent with tail-club impacts** (trace).
- Doubt about predator defence: its eyesight may have been too poor to aim the club, and the accuracy needed was probably only
  possible against a **stationary target**, which suggests fights between rivals (Wikipedia, summarising that literature).
  Smilodon is said to have preyed on Doedicurus (flag: the evidence wasn't checked here).
- Posture: centre of mass near the hind legs, so it could probably rear up on them, as living xenarthrans do in defence.
- Speed: no estimate found. Flag: assume very slow.
- Habitat: Pampas of Argentina and Uruguay, open grassland with some woodland → **savanna**.

**Suggested stats**
```
{id:'doedicurus', name:'Doedicurus', abbr:'DOE', price:300, mass:1400, spd:4.5, swim:.8, dmg:90, cd:1.2, armor:.7,
 reach:1.6, stam:12, heat:.8, cold:.5, water:0, aggr:.35, flee:.05, corner:1.5, pred:false, charge:false, vision:15,
 rare:true, tags:['tailClub','shell','standsGround']}
STYLE: {gait:'lumber', strikeH:1.2, mountH:0, style:'Fortress', how:'Turns its back on trouble, plants its feet and swings
 a spiked tail club that cracks shells.'}
```
Why: dmg 90 is the head (shove and bite: a grazer's jaws); the real damage is the club below. Armor .7, the highest in the
game (croc .6, rhino/hippo .55): a fused bony carapace. spd 4.5 (croc on land) because nothing suggests speed. flee .05 like
the honey badger: it can't run, so it holds. vision 15 for the poor eyesight. Not rideable.

**Signature: `tailClub` and `shell` (trace: carapace fractures; morphology: club mechanics)**
- `tailClub`: it turns its rear toward the nearest threat (180° in 1.5 s; no club while turning). Every 2 s it swings at an
  enemy in its rear arc (±50°) within 2.8 m: **base 260** (elephant class), ignores 25% of armor (spikes), shoves targets
  ≤ 2× its mass 1.5 m back and stuns them 0.8 s.
- Accuracy rule (from the "stationary target" argument): 90% against a target that is held, latched, stunned, eating or
  standing still; 35% against one moving faster than 3 m/s. So a croc in a death roll or a cat latched onto your animal next
  to it gets clubbed; a darting wolf mostly doesn't.
- `shell`: a pounce or latch on it lands on the carapace: `latchMax` 0.5 s (cats can't hold on), no ambush or pounce bonus.
  Bites from the front (its armored head) are normal.
- On your side you deploy it beside you as a wall: things that grab you next to it get clubbed. On their side it is almost
  harmless unless you go to it (aggr .35, speed 4.5): a "theirs" near zero, like the giraffe.
- Different from existing kits: the first defensive weapon pointed **backwards**, and the first animal whose hit chance
  depends on the target moving. The kangaroo grabs and kicks forward; the elephant sweeps everything in reach.

**Tier:** almost all "mine" (a wall next to you), a little "theirs": ~35–55 s → **$200–300**, rare. The club's base damage
and the accuracy rule are the dials.
**Portrait:** [File:Doedicurus BW.jpg](https://commons.wikimedia.org/wiki/File:Doedicurus_BW.jpg), CC BY 3.0, Nobu Tamura
(800×357, life restoration). Backup: [File:Doedicurus and Glyptodon.jpg](https://commons.wikimedia.org/wiki/File:Doedicurus_and_Glyptodon.jpg),
public domain, R. Bruce Horsfall (2216×1618).
**Risks**
- Realism: body and club are solid; using it against predators is debated (it may have been for rival fights). The accuracy
  rule is the honest compromise. Card text should say so.
- Balance: stall risk (a slow wall). It doesn't move toward anything, so `drive` should push it along on the other side, and
  `idle.js` should check it doesn't create "camping with the glyptodont".
- Engine: rear-arc attacks and turning are new code.

---

## 4. *Homotherium* pair ×2, tundra: the cat that doesn't give up

**Evidence: A− for the body, C for the pair.** Many specimens across Eurasia and the Americas; Friesenhahn Cave (Texas) has
Homotherium skeletons of all ages with ~400 juvenile mammoths; a Yukon genome (Barnett et al. 2020, *Current Biology*); a
**mummified three-week-old cub** from Yakutia with dense dark fur and **wide, rounded paws without a carpal pad**, read as
snow adaptations (Lopatin et al. 2024, *Scientific Reports*).
- Mass: lion-sized, up to ~200–250 kg; 0.9–1.1 m at the shoulder. Longer legs and a sloping back; small semi-retractable claws;
  weaker forelimbs than Smilodon.
- Hunting: built for **moderate-speed endurance running in open country** (limb proportions; genome shows selection on
  respiratory and circulatory genes; vision genes suggest a daytime hunter). Incisors used for gripping, like hyenas and canids.
  Its canines aren't found broken, unlike Smilodon's. Took juvenile mammoths at Friesenhahn; in Beringia bison, muskox, horse,
  reindeer (isotopes).
- Group hunting: **speculative** ("probably relied on group hunting", from the open habitat and weak forelimbs; the genome's
  cognition genes were "tentatively" linked to it). Flag: the pair is a design choice; a solo version is honest too.
- Maps: **tundra** (the mammoth steppe), savanna.

**Suggested stats** (per cat; pack item like `lionpack`)
```
{id:'homotherium', name:'Scimitar-toothed Cat', abbr:'HOM', latchMax:2, price:100, mass:190, spd:15, swim:1.3, dmg:95,
 cd:.9, armor:.1, reach:2, stam:30, heat:.6, cold:1, water:.1, aggr:.6, flee:.3, corner:1.3, pred:true, latch:true,
 charge:false, vision:35, rare:true, tags:['catSense','pack','runsDown','snowPaws'], prey:{human:1.1},
 rivals:{smilodon:1.2, lion:1.3}}
STYLE: {gait:'rush', strikeH:3, mountH:0, pounce:3, style:'Endurance hunter', how:'Lopes after its prey and keeps coming
 long after any other cat would quit; slashes at the throat and falls back.'}
pack item: ['homotherium', 2, 'Homotherium pair', 200, 'pair', 1, true]
```
Why: mass 190 (between lion and Smilodon). spd 15 (lion 20, Smilodon 14): not a sprinter. **stam 30** where every other cat
has 4–6: the whole point. Short pounce (3 m) and latchMax 2 for weak forelimbs. cold 1 and `snowPaws` (`snowFactor` 1).

**Signature: `runsDown` (morphology and genome)**
- When its target runs (flees, routs, or simply moves away faster than 3 m/s), it doesn't give up as other cats do. It follows
  at 85% speed for up to 60 s while its stamina holds.
- A bite on a target that has been running ≥ 5 s or is under 30% stamina is a **scimitar slash**: ×1.4, 6 s bleed (1% max
  HP/s), and it lets go at once (no hold). Then it drops back 3 m and keeps pace.
- Snow: `snowFactor` 1 (the cub's paws).
- Pair: with the second cat within 15 m, they alternate: the one that just slashed drops back, the other takes over.
- Different from existing kits: every cat today is an ambusher or sprinter that stops when the prey runs. This one is the
  answer to evasive mounts (giraffe, ostrich) and to animals that run off to break morale. It's the tundra cat the mid-tier
  doc couldn't justify with the Amur tiger.

**Tier:** lion coalition (25 s) plus tundra mobility and the chase: ~30–45 s → **$200** for the pair (solo $100). Rare.
**Portrait:** [File:Homotherium killing.png](https://commons.wikimedia.org/wiki/File:Homotherium_killing.png), CC BY 3.0
(Netherlands port), Mauricio Antón (672×886). Backup: [File:Homotherium cub mummified head.png](https://commons.wikimedia.org/wiki/File:Homotherium_cub_mummified_head.png),
CC BY 4.0, Lopatin et al. (the actual mummy; striking, but it's a cub).
**Risks**
- Realism: the endurance build is well supported; the pair isn't (flag on the card: "may have hunted in groups").
- Overlap: a second sabre-tooth next to Smilodon. Their kits are opposite (Smilodon pins and stabs, short sprint; this one runs
  and slashes). Card names should keep "sabre-toothed" and "scimitar-toothed" clearly apart.
- Balance: a chase that never ends could keep fights going and add idling at the map edge. Cap it at 60 s.

---

## 5. Dire wolf pack ×4 (*Aenocyon dirus*), savanna and forest: drawn to the struggle

**Evidence: A.** Thousands of individuals from Rancho La Brea alone (the most common carnivore there, 5 for every gray wolf);
ancient DNA shows a lineage separate from gray wolves for ~5.7 million years (Perri et al. 2021, *Nature*). Flag: the 2025
"de-extinct dire wolves" are gene-edited gray wolves and say nothing about the real animal.
- Mass: average ~60 kg (*A. d. guildayi*) and ~68 kg (*A. d. dirus*), skeletal limit ~110 kg. The size of the largest gray
  wolves, with a heavier head.
- Bite: **the highest canine bite force per kilogram of any placental carnivore measured** (163 N/kg vs gray wolf 136,
  African wild dog 142). Larger carnassial blades; teeth often broken (big, struggling prey).
- Prey: isotopes show a preference for ruminants such as *Bison antiquus*, also horses, camels, ground sloths; estimated prey
  size **300–600 kg**. Little sexual dimorphism, read as monogamous pairs and packs like gray wolves (analogy).
- **La Brea trace evidence:** herbivores mired in asphalt drew predators: about **ten carnivores per trapped herbivore**, and
  the dire wolf is the most common of them (trace and taphonomy).
- Habitat: plains, grasslands, forested mountains, rarely north of 42°N (not ice-age tundra) → **savanna, forest**. Not tundra
  (the range evidence argues against it; an honest deal filter).

**Suggested stats** (per wolf; pack item like `wolfpack`)
```
{id:'direwolf', name:'Dire Wolf', abbr:'DWF', price:100, mass:65, spd:15.5, swim:1.5, dmg:60, cd:.75, armor:.05, reach:1.7,
 stam:50, heat:.8, cold:.7, water:.2, aggr:.6, flee:.4, corner:1.3, pred:true, charge:false, vision:35, pierce:.15,
 rare:true, tags:['pack','drawnToStruggle'], prey:{human:.5}}
STYLE: {gait:'orbit', strikeH:1.4, mountH:0, dart:1.2, style:'Mob hunter', how:'Circles like a wolf, but comes running at
 anything stuck, wading or down, and bites hard.'}
pack item: ['direwolf', 4, 'Dire wolf pack', 200, 'pack', 1, true]
```
Why: wolf (45 kg, dmg 40) scaled up, dmg 60 like the hyena for the bite. pierce .15 for the carnassial blades. stam 50.
heat .8 (warmer range than the gray wolf).

**Signature: `drawnToStruggle` (trace: La Brea)**
- Every 1 s the pack scans 60 m for an animal that is **stuck**: wading or swimming, below 70% speed in snow or mud, stunned,
  pinned, held by a croc, or limping (hyena bone-crack, wounds). The pack converges on it (opportunist weight ×2).
- Bites on a stuck target: ×1.3 and they don't back out after the bite (they hold on and tear, 1 s).
- Different from existing kits: the gray wolf pack hamstrings to *create* a slow target; the hyenas cripple; the opportunists
  rule values targets *already fighting*. This one is drawn to *immobility*, wherever it comes from. That makes it a
  combo piece: on the river map it mobs whatever wades the ford; with your hyenas it finishes the lamed.

**Tier:** hyena clan (~40 s) to wolf pack ×4 (~27): ~30–45 s → **$200**. Rare or not: as a rare, so it doesn't crowd out the
gray wolf pack on the same boards.
**Portrait:** [File:Dire wolf National Park Service illustration.png](https://commons.wikimedia.org/wiki/File:Dire_wolf_National_Park_Service_illustration.png),
public domain, NPS illustration by Benji Paysnoe (3194×1656). Backup: [File:Aenocyon dirus restoration & skeleton.jpg](https://commons.wikimedia.org/wiki/File:Aenocyon_dirus_restoration_%26_skeleton.jpg),
public domain, Erwin S. Christman (1916).
**Risks:** overlap with the gray wolf pack (same silhouette, same gait). The signature has to read on the field or it's a
re-skin. Players know it (Game of Thrones), which is good for picking and bad for realism expectations (it wasn't huge).

---

## 6. *Daeodon* ("hell pig", entelodont), savanna and forest: the face-biter

**Evidence: B.** The holotype is fragmentary (Cope), but referred skeletons are mounted (Agate Fossil Beds, Nebraska; often
under the name *Dinohyus hollandi*; flag: the synonymy is debated).
- Size: skull up to **90 cm**, 1.77 m at the shoulder, 3.7 m long, large males **at least 750 kg**. Two-toed, cursorial legs
  and bison-like shoulder muscles (adapted to grassland).
- Diet: omnivore; tooth wear suggests crushing bone and ripping meat as well as nuts, roots and vines; bite marks on
  chalicothere bones (hunted or scavenged). Not closely related to pigs: entelodonts are nearer to hippos and whales.
- **Trace evidence: entelodonts bit each other's faces.** Tooth marks on entelodont skulls are read as dominance fights; the
  bony jaw tubercles and cheek flanges may have protected the face (Wikipedia "Daeodon" / "Entelodon", summarising the
  literature; the classic Archaeotherium skull wounds).
- Rare at Agate, where rhino die-offs left thousands of carcasses → probably neither social nor drawn to carrion.
- Habitat: transition from dense forest to prairie, floodplain with wet and dry seasons → **savanna, forest**.

**Suggested stats**
```
{id:'daeodon', name:'Daeodon', abbr:'DAE', price:200, mass:700, spd:13, swim:1.5, dmg:155, cd:1.0, armor:.3, reach:2.0,
 stam:18, heat:.8, cold:.6, water:.3, aggr:.7, flee:.2, corner:1.6, pred:false, charge:true, vision:22, rare:true,
 tags:['standsGround','faceBite','scavenger']}
STYLE: {gait:'charge', strikeH:1.5, mountH:0, overshoot:2, turn:1.2, wheel:.5, style:'Face-biter', how:'Trots in head-on,
 clamps its huge jaws on the face and shakes.'}
```
Why: between the bull (550 kg, 150) and buffalo (750 kg, 150): dmg 155 for the skull. Short charge (a trot into a bite, not
a horned ram). pred:false: it doesn't hunt you (honest about the uncertain carnivory), but aggr .7 means it fights what
comes near. Not rideable.

**Signature: `faceBite` (trace: entelodont skull bite marks)**
- A bite on a target facing it (within ±45° of the target's heading) and ≤ 2× its mass goes for the face: ×1.3, and the target
  is **blinded** for 3 s (vision ×.3; it loses its current target and can't pick a new one beyond 5 m).
- Two Daeodons, or a Daeodon against something with the same tag, lock faces (pure flavour, rare).
- Different from existing kits: the first effect that takes away an animal's sight. It counters stalkers mid-stalk and
  cancels a charge that's lined up on you.

**Tier:** bull/buffalo-class body: ~40–50 s → **$200**. Rare.
**Portrait:** the NPS illustration whose file name begins *"Daeodon hollandi" is a large pig like mammal known as an
entelodont…* (public domain, NPS image, 2200×1700; the name is very long, search Commons for "Daeodon hollandi" to get it exactly). Backup:
[File:Daeodon skeleton.jpg](https://commons.wikimedia.org/wiki/File:Daeodon_skeleton.jpg), public domain.
**Risks:** "hell pig" pop-culture claims (that it hunted everything) are not supported; keep it an omnivore that bites faces.
Overlap with the boar (a pig-shaped charger) only in looks. The blindness effect is new engine work.

---

## 7. Harlan's ground sloth (*Paramylodon harlani*), forest and savanna: the bite-proof brawler

**Evidence: A−.** Abundant at Rancho La Brea (a fully reconstructed skeleton, several hundred osteoderms), also Florida, Texas,
Anza-Borrego.
- Mass: Early Pleistocene ~915 kg; **Late Pleistocene up to ~1.39 t**. 2.8 m long including a 1.2 m tail.
- **Osteoderms**: small bony ossicles embedded in the skin, "presumably adding a degree of protection" (morphology; mylodonts
  are the only sloths with them, like armadillos).
- Claws: big claws on three fingers and two toes; may have dug for roots. Like Megatherium, ground sloths could rear up on the
  hind legs and tail (morphology).
- Prey of Smilodon, dire wolves and American lions (La Brea isotopes and assemblage).
- Habitat: open grassland and parkland → **savanna, forest**.

**Suggested stats**
```
{id:'groundsloth', name:"Harlan's Ground Sloth", abbr:'GSL', price:200, mass:1100, spd:4, swim:1, dmg:150, cd:1.4,
 armor:.3, reach:2.2, stam:10, heat:.8, cold:.6, water:.2, aggr:.35, flee:.1, corner:1.6, pred:false, charge:false,
 vision:20, rare:true, tags:['biteMail','rears','standsGround']}
STYLE: {gait:'lumber', strikeH:3, mountH:0, style:'Clawed brawler', how:'Sits back on its tail, rears up and rakes with
 hooked claws; teeth skid off its studded hide.'}
```
Why: dmg 150 for the claws (moose 140 with hooves). Slow (no speed estimate; flag). armor .3 overall; see below.

**Signature: `biteMail` (morphology: osteoderms)**
- Armor depends on what hits it: **.55 against bites and claws** (any `pred` attacker, latches, holds), only .15 against blunt
  hits (charges, hooves, tusks, sweeps, kicks). Ossicles stop teeth; they don't stop a rhino.
- `rears`: an attacker within 3 m in front makes it rear (0.8 s): strikes reach 3 m up for the next 4 s (anti-pounce, can hit a
  cougar mid-leap or a rider on a horse-height mount).
- Different from existing kits: the first damage-type armor. It's the predator-proof heavy (cats, wolves, hyenas, dire wolves
  break on it) that a herbivore charger still flattens.

**Tier:** ~30–45 s → **$200**. **Megatherium** is the giant version (3.5–4 t, rears to ~4 m, claws as stabbing weapons:
Fariña & Blanco 1996, *Proc. R. Soc. B*, "Megatherium, the stabber"); it would be a $600–700 capped giant, rideable on the
back at ~2 m if wanted.
**Portrait:** [File:Paramylodon harlani UMNH.jpg](https://commons.wikimedia.org/wiki/File:Paramylodon_harlani_UMNH.jpg),
public domain, Daderot (skeleton photo, 2448×3264). No free life restoration found in this search; for Megatherium:
[File:Megatherium americanum.jpg](https://commons.wikimedia.org/wiki/File:Megatherium_americanum.jpg), public domain,
R. Bruce Horsfall.
**Risks:** a slow defensive animal again (stall risk, like Doedicurus). Choose one of the two "slow fortresses", not both.

---

## 8. Irish elk (*Megaloceros giganteus*), tundra and forest: the antler span

**Evidence: A.** Hundreds of skeletons from Irish bogs (100+ at Ballybetagh alone), mtDNA.
- Mass: **450–600 kg, up to 700+ kg**; 2 m at the shoulder. Antlers up to **4.2 m** tip to tip and 40 kg.
- Antlers: mainly for display and fights between males; finite-element analysis suggests interlocking, twisting, "more
  constrained and predictable" fights than in living deer. No evidence of use against predators.
- Habitat: boreal steppe-woodland (not the open mammoth steppe in Siberia), temperate forest in interglacials, with narrower
  antlers in forest → **tundra edge, forest**.

**Suggested stats:** `{mass:600, spd:16, dmg:130, cd:1.1, armor:.15, reach:3.0, stam:30, heat:.6, cold:.95, aggr:.4, flee:.4,
charge:true, tags:['antlerSpan']}`, STYLE charge, strikeH 2, overshoot 3.
**Signature idea: `antlerSpan`**: its frontal strikes hit up to two enemies within 3 m and ±60° (the 4 m rack), at 70% on
the second. In forest each charge has a 20% chance to snag on a tree (1 s stuck), the old "trapped in branches" story without
the myth that it caused the extinction.
**Tier:** moose-class (47 s) minus the stomp: ~35–45 s → $200.
**Portrait:** [File:Megaloceros giganteus Paris 25 05 2013 01.jpg](https://commons.wikimedia.org/wiki/File:Megaloceros_giganteus_Paris_25_05_2013_01.jpg), CC0, Vassil (skeleton).
**Verdict:** real and iconic, but a moose with a wider rack, and its weapon was for display. Not recommended over the others.

---

## 9. Marsupial lion (*Thylacoleo carnifex*), forest: rare, but a $100 body

**Evidence: A−.** Nearly complete skeletons (first in 1966, more from the Nullarbor caves, complete hind feet 2005).
- Mass: **101–130 kg** average, 124–164 kg for big individuals: a lioness.
- Pound for pound the strongest bite of any mammal measured (a 101 kg animal biting like a 250 kg lion). A huge
  **semi-opposable thumb with a hooked claw** for grappling and possibly the killing blow; a stiff tail it could prop itself on
  while rearing.
- Climbing: claw marks in a Nullarbor cave matched to Thylacoleo (Arman & Prideaux 2015, *Scientific Reports*), so it climbed
  out of caves; possibly cached carcasses in trees like a leopard (inference).
- Prey: Diprotodon and giant kangaroos (inference). Habitat: woodland and scrub → **forest**.

**Stats sketch:** leopard-like with `mass:120, dmg:110, pierce:.3, climb:true`, gait stalk, pounce 5; tag `thumbHook`:
a pounce lands with the thumb claw (5 s bleed and the target can't shake it off for 1 s).
**Tier:** ~15–25 s → **$100 rare**. Not mid tier. Best saved for the "Ice Age Australia" board (BACKLOG): giant kangaroo,
Thylacoleo, Megalania, Diprotodon.
**Portrait:** [File:Thylacoleo BW.jpg](https://commons.wikimedia.org/wiki/File:Thylacoleo_BW.jpg), CC BY 3.0, Nobu Tamura.

---

## 10. Cave lion (*Panthera spelaea*), tundra: overlap

**Evidence: A.** Many skeletons and permafrost-mummified cubs (Boeskorov et al.; "Boris" and "Sparta", Yakutia), cave art.
Larger than living lions (the Middle Pleistocene *P. fossilis* reached ~400–500 kg; the Late Pleistocene cave lion was
noticeably smaller but still large). Cave art suggests males had little or no mane; probably more solitary than African lions
(uncertain). Isotopes: horse, reindeer, mammoth, and **cave bears** (it seems to have hunted cave bears in their caves).
**Verdict:** the tundra lacks a cat, but this is the lion again with a winter coat. As with the Amur tiger in the mid-tier doc,
better as a terrain variant of the existing lion card than as a new pick; Homotherium is the tundra cat with its own kit.
**Portrait:** [File:European cave lion (Panthera leo spelaea) - Mauricio Antón.jpg](https://commons.wikimedia.org/wiki/File:European_cave_lion_(Panthera_leo_spelaea)_-_Mauricio_Ant%C3%B3n.jpg), CC BY 2.5.

---

## 11. Megalania (*Varanus priscus*): ranked down (evidence C for size)

**Evidence: C for size, B for existence.** Known from fragments since Owen (1859: three vertebrae); no complete skeleton.
Size estimates have swung widely: Wroe 2002 average 97–158 kg (max 331 kg); Wroe et al. 2009 at least 575 kg; Molnar 2004
up to 320 kg for typical specimens, 1,940 kg for the largest vertebra; Conrad et al. 2012 typical 2 m precaudal. Venom is
inferred from its relatives (Fry et al. 2009, *PNAS*), not observed. Sprint ~2.6–3 m/s (scaled).
**Verdict:** a great idea (the Komodo's venom at mid-tier size), but any stat line picks a number out of a fourfold range. If the
owner wants it, use the conservative ~300 kg with "size uncertain" on the card, venom as "probably venomous", and price it by
measurement. A rare for the Australia board, not a core mid-tier pick.
**Portrait:** [File:Varanus priscus BW.jpg](https://commons.wikimedia.org/wiki/File:Varanus_priscus_BW.jpg), CC BY 3.0,
ArthurWeasley (life restoration).

---

## Considered and set aside (Ice Age / Cenozoic)

| Animal | Evidence | Why not | Notes |
|---|---|---|---|
| Cave bear (*Ursus spelaeus*) | A (thousands of skeletons) | Mostly herbivorous (isotopes, molarised teeth); a grizzly in a cave. No fighting identity | males 350–600 kg; maybe a $200 "grizzly variant" |
| Glyptodon | A | Doedicurus is the same idea with a club; Glyptodon (≤ 400 kg) has no club | |
| Megatherium / Eremotherium | A | 3.5–4.5 t: giants, not mid tier | Megatherium = the giant version of §7 |
| Diprotodon | A (Lake Callabonna, 360 individuals) | 2.7–3.5 t walking herbivore; possibly incisor fights (speculative). Little fighting identity | Australia board, giant tier |
| Elasmotherium | B | 3.5–5 t giant; the famous long horn is unproven (a 2021 study argues against it) | |
| Paraceratherium | B− (incomplete) | 15–20 t: far beyond the game's scale | |
| Andrewsarchus | **C: one skull** (83 cm), a jaw and teeth | Body size is extrapolated from a skull; old "giant carnivore" proportions were wrong (it was entelodont-like, omnivore/scavenger) | any stat line would be invented |
| Gigantopithecus | **C: teeth and four jaws** | 200–300 kg is a guess; a fruit and plant eater of subtropical forest; no fighting evidence; overlaps the gorilla | |
| Deinosuchus | B | 2.5–5 t (8–10 m) giant croc; water-bound like the croc, overlaps it; bite marks on hadrosaur bones and turtle shells | river rare "boss" at best |
| Terror birds (Phorusrhacos ~93 kg, Titanis >150 kg) | B / **C (Titanis: fragments)** | Below mid tier; overlaps the ostrich; Titanis' size rests on a few bones | a $100 rare idea: beak strike-and-retreat |
| Entelodon | B | Daeodon is the bigger, better-known entelodont | |
| Arctotherium (South American short-faced bear) | B | Known species ~110–140 kg (the huge *A. angustidens* is one specimen); Arctodus covers the role | |

---

# Part 2: Dinosaurs

Owner's direction: smaller, memorable, well-known dinosaurs; the triceratops is already in; T. rex only as a possible future
boss. Realism means the real animal: **feathered dromaeosaurs at their real size**, no venom or neck frill on Dilophosaurus.

## D1. *Protoceratops andrewsi* herd ×3, savanna: the Fighting Dinosaurs

**Evidence: A.** More than 100 specimens from the Gobi (Djadokhta Formation), all growth stages, eggs. Plus the
**Fighting Dinosaurs** (MPC-D 100/512 and 100/25, found 1971): a Protoceratops and a Velociraptor buried mid-fight. The
Velociraptor lies under it with its feet at the Protoceratops' throat and belly, its left hand on the skull, and **its right
arm clamped in the Protoceratops' jaws** (Barsbold 1974; Unwin et al. 1995 argue for a simultaneous death, not scavenging;
Carpenter 1998). The sickle claw was a piercing weapon, not a slasher.
- Mass: **62–104 kg**, 2–2.5 m long. A big skull with a strong parrot-like beak and shearing teeth, a frill (display and jaw
  muscles), a short stiff neck.
- Social: thought to have lived in mixed-age groups (bonebeds of juveniles and adults; inference).
- Habitat: arid dunes and scrub → **savanna** (the closest map).

**Suggested stats** (per animal; pack item)
```
{id:'protoceratops', name:'Protoceratops', abbr:'PRO', price:100, mass:85, spd:8, swim:.8, dmg:60, cd:1.0, armor:.2,
 reach:1.4, stam:15, heat:1.1, cold:.4, water:-.2, aggr:.4, flee:.3, corner:1.7, pred:false, charge:false, vision:25,
 rare:true, tags:['herd','lockjaw','standsGround']}
STYLE: {gait:'lumber', strikeH:1.0, mountH:0, style:'Lockjaw', how:'Stands its ground and bites; whatever grabs it gets
 its arm caught in a beak that does not let go.'}
pack item: ['protoceratops', 3, 'Protoceratops herd', 100, 'herd', 1, true]
```
Why: honey-badger-to-boar size. A cold ~ .4 is a guess (flag: dinosaur thermal physiology is debated; nothing in the game needs
more than "doesn't like the tundra"). Not rideable.

**Signature: `lockjaw` (trace: the Fighting Dinosaurs)**
- Trigger: a predator ≤ 2.5× its mass grabs it (latch, pin, hold, or a pounce lands on it), or attacks it from within 1.5 m
  in front.
- Effect: it **clamps the attacker's limb**: for 3 s the attacker can't move or let go, its own damage on the Protoceratops is
  ×.5, and anything else of the Protoceratops' side within 5 m gets ×1.3 on the trapped attacker (it's held for them). The
  attacker can break free early with probability .3 per second if it's over 1.5× the Protoceratops' mass. Cooldown 8 s.
- On your side, three of them around you turn small predators (wolves, hyenas, leopards, raptors) into sitting targets for your
  other guards. On their side they're slow and harmless unless you bring cats.
- If a Velociraptor or Deinonychus is on the board too, the log line can be "locked in combat, like the Fighting Dinosaurs".
- Different from existing kits: the kangaroo's grab is offensive and the honey badger shakes holds off; this one **holds the
  holder**.

**Tier:** three small herbivores: ~15–25 s → **$100**. Memorable, not mid tier.
**Portrait:** [File:Protoceratops andrewsi Restoration.png](https://commons.wikimedia.org/wiki/File:Protoceratops_andrewsi_Restoration.png),
CC BY 4.0, PaleoNeolitic (4438×2310). For the credits panel or a tooltip: [File:Fighting dinosaurs (2).jpg](https://commons.wikimedia.org/wiki/File:Fighting_dinosaurs_(2).jpg),
CC BY 2.0, Yuya Tamai (the real fossil).
**Risks:** low value. Dinosaurs and Ice Age mammals on one board is a mood question for the owner (the triceratops already
mixes them).

## D2. *Velociraptor mongoliensis*: real, famous, and tiny

**Evidence: A.** Over a dozen skeletons, a juvenile with a complete skull, quill knobs on a forearm (2007) showing
**wing feathers**. Real size: **1.5–2.07 m long, 14–20 kg** (up to ~28 kg in some estimates), turkey-sized. The film animal
was modelled on Deinonychus. Hunted Protoceratops (the Fighting Dinosaurs); sickle claw for piercing and gripping.
**Stats sketch:** `mass:18, spd:11, dmg:30, armor:.05, pred:true, latch:true, gait:'stalk', pounce:3`, tag `sickleGrip`.
**Verdict:** a realistic Velociraptor is a honey-badger-sized predator (honey badger 11 kg, swing 3 s). Even a pair would be
$100 filler, and players expecting the film will feel cheated. **Not recommended** as a pick. Use it in the Protoceratops'
flavour text, or let Deinonychus (D3) be "the raptor".
**Portrait:** [File:Velociraptor dinoguy2.jpg](https://commons.wikimedia.org/wiki/File:Velociraptor_dinoguy2.jpg), CC BY 2.5,
Matt Martyniuk (feathered restoration).

## D3. *Deinonychus antirrhopus* trio ×3, forest: pin and stab

**Evidence: A− for the body, B for the group.** Over 1,000 bones from at least three individuals at the Yale quarry, mounted
skeletons (AMNH, Harvard); feathers inferred (closest relatives have them). Several Deinonychus are found with Tenontosaurus
skeletons (an adult tenontosaur was too big for one).
- Mass: **60–73 kg** (Paul), up to ~100 kg (Campione et al.); 3.3–3.4 m long.
- Group: debated. Roach & Brinkman 2007 argue for a mob of individuals at a kill, not a cooperative pack like wolves; Currie &
  Eberth 2010 disagree; parallel dromaeosaur trackways (China) suggest they moved in groups. Flag: "groups, not wolf-style packs".
- Killing method: the **raptor prey restraint** model (Fowler et al. 2011, *PLoS ONE*): leap onto prey, pin it under body
  weight, grip with the sickle claws, and flap the arms for balance, as hawks and eagles do (morphology plus analogy with
  accipitrids).
- Habitat: Early Cretaceous floodplains with forest (Cloverly Formation) → **forest**.

**Suggested stats** (per animal; pack item)
```
{id:'deinonychus', name:'Deinonychus', abbr:'DEI', latchMax:4, price:100, mass:75, spd:12, swim:1, dmg:60, cd:.8,
 armor:.05, reach:1.6, stam:12, heat:.9, cold:.5, water:-.1, aggr:.65, flee:.35, corner:1.3, pred:true, latch:true,
 charge:false, vision:32, pierce:.2, rare:true, tags:['pinDown','mob'], prey:{human:1.0}}
STYLE: {gait:'stalk', strikeH:2.5, mountH:0, pounce:4, style:'Pinner', how:'Leaps onto its prey, pins it with the sickle
 claws and stabs while flapping for balance.'}
pack item: ['deinonychus', 3, 'Deinonychus group', 200, 'group', 1, true]
```
**Signature: `pinDown` (morphology plus analogy: Fowler et al. 2011)**
- A pounce on a target ≤ 1.3× its mass is a **pin**: the target is stunned and can't move for as long as the hold lasts (up to
  `latchMax` 4 s), and takes a sickle stab ×1.2 every 0.6 s. Wing-flapping balance: a pinning Deinonychus can't be shoved or
  upended off (boar's `upends` fails), but any hit on it breaks the pin.
- Bigger targets: it clings to the flank like the lion's `backLeap`, with normal bites. The group converges on what one has
  pinned (`mob`, not coordinated encircling).
- That makes it deadly to you on foot (75 kg), to wolves, hyenas, leopards, cougars, and to other raptors; useless against
  rhinos except as a nuisance.
- Different from Smilodon's `pinStab` (a forelimb pin, one huge stab, then it backs off): a foot pin with many small stabs
  that holds the victim down.

**Tier:** hyena-clan-like numbers with a human-killing pin: ~25–40 s → **$200** (its "theirs" will be large because it
hunts you).
**Portrait:** [File:Deinonychus BW.jpg](https://commons.wikimedia.org/wiki/File:Deinonychus_BW.jpg), CC BY 2.5, Nobu Tamura.
Photo: [File:Deinonychus antirrhopus - AMNH - DSC06297.JPG](https://commons.wikimedia.org/wiki/File:Deinonychus_antirrhopus_-_AMNH_-_DSC06297.JPG), CC0, Daderot.

## D4. *Utahraptor ostrommaysi*, forest: the mid-tier raptor

**Evidence: B+.** Holotype a sickle claw and a few bones (1993), then many more specimens, including a 9-tonne sandstone
block (the "Stikes Quarry") with several individuals of different ages, read as a social group (Kirkland et al.; flag:
whether it is a social group or a death trap, like La Brea, is debated).
- Size: **6–7 m long, typically ~280–500 kg** (Kirkland: "under 500 kg", polar-bear sized; later work puts it at Achillobator's
  350–450 kg). Stocky legs, built more like other large theropods than its cousins; legs suggest an **ambush** predator rather
  than a pursuer. Sickle claw ~24 cm. Blade-like hand claws.
- Prey: iguanodonts and ankylosaurs of the Cedar Mountain Formation (inference). Feathered (inferred from relatives).
- Habitat: Early Cretaceous seasonal floodplains → **forest** (ambush) and savanna.

**Suggested stats**
```
{id:'utahraptor', name:'Utahraptor', abbr:'UTA', latchMax:3, price:200, mass:400, spd:12, swim:1.2, dmg:140, cd:.9,
 armor:.1, reach:2.2, stam:10, heat:.9, cold:.5, water:0, aggr:.65, flee:.3, corner:1.3, pred:true, latch:true,
 charge:false, vision:30, pierce:.25, rare:true, tags:['ambush','pinDown','bigGame'], prey:{human:1.2}}
STYLE: {gait:'stalk', strikeH:3, mountH:0, pounce:6, style:'Ambush pinner', how:'Waits in cover, bursts out over a short
 distance, pins with a 24 cm sickle claw and tears with its hands.'}
```
Why: polar-bear mass with a cat's ambush. dmg 140 (polar 145, tiger 125). spd 12 (stocky, ambusher). The same `pinDown` as
Deinonychus, which at 400 kg pins anything up to ~520 kg: you, every cat, bears up to polar size, bulls, moose. Above that it
clings and tears.
**Signature:** `pinDown` (above); in forest its ambush is ×2 like the cats'. Only one raptor kit should exist: Utahraptor is
the solo mid-tier version, Deinonychus the group version.
**Tier:** polar bear / tiger-class predator with a pin: ~40–55 s → **$200–300**. Rare.
**Portrait:** [File:Utahraptor traditional.jpg](https://commons.wikimedia.org/wiki/File:Utahraptor_traditional.jpg), CC0,
PaleoNeolitic (3400×2000). Backup: [File:Utahraptor BW.jpg](https://commons.wikimedia.org/wiki/File:Utahraptor_BW.jpg),
CC BY 2.5, Nobu Tamura.
**Risks:** "good animals are too good": a 400 kg predator that pins you is a strong threat on their side. Measure "theirs"
first; the pin's mass cap is the dial. The film image (scaly, pack of six) will clash with the feathered loner.

## D5. *Pachycephalosaurus wyomingensis*: the head-butt is debated

**Evidence: C+.** **Known mainly from skulls and skull caps** (domes up to 22–25 cm thick); the body is reconstructed from
smaller relatives. Size ~4.5 m, commonly ~370–450 kg (estimates from relatives; flag).
- Head-butting: debated. Against: the dome might not survive ramming, the neck was S-curved, rounded domes give glancing blows.
  Alternative: **flank-butting** (Sues 1978, Carpenter 1997). For combat of some kind: **22% of pachycephalosaurid domes have
  lesions consistent with trauma and infection** (Peterson et al. 2013, *PLoS ONE*; trace).
**Stats sketch:** `mass:400, spd:11, dmg:110, armor:.2, charge:true, gait:'charge', strikeH:1.3`; tag `flankButt`: a short
dash into an attacker's flank (not head-on): ×1.3, shove 2 m, stun 1 s on targets ≤ 2× its mass.
**Tier:** ~20–35 s → $100–200.
**Portrait:** [File:Pachycephalosaurus Reconstruction.jpg](https://commons.wikimedia.org/wiki/File:Pachycephalosaurus_Reconstruction.jpg), CC BY 4.0, Fred Wierum.
**Verdict:** famous, but the body is guessed and the signature is the debated part. Ranked down; use the flank version if built.

## D6. *Iguanodon bernissartensis*, river and forest: the thumb spike (giant-adjacent)

**Evidence: A.** Dozens of complete skeletons from the Bernissart mine (Belgium) and elsewhere; the famous case of the thumb
spike first put on the nose.
- Size: ~9 m (to ~11 m), **~3.1 t** on average (Paul), some estimates higher. Walked on two or four legs.
- Thumb spike: a conical spike on each hand, "typically interpreted as a close-quarter stiletto-like weapon against predators",
  possibly also for opening seeds or against other Iguanodons. Function debated (morphology only).
- Habitat: Wealden floodplains and river deltas → **river, forest**.
**Stats sketch:** `mass:3000, spd:9, dmg:170, armor:.2, reach:2.5, gait:'lumber', strikeH:3, mountH:2.6`; tag `thumbSpike`:
anything latched onto its front half or pouncing at it from the front takes a stab: ×1.5, half armor, 5 s bleed; cats' `latchMax`
on it ×.5.
**Tier:** a 3 t herbivore that's not a charger: ~70–90 s → **$400**, rare. A possible second "big mount" (mountH 2.6 is below
the giant threshold of 3, so not a default mount).
**Portrait:** [File:Iguanodon bernissartensis (Davide Bonadonna, cropped).png](https://commons.wikimedia.org/wiki/File:Iguanodon_bernissartensis_(Davide_Bonadonna,_cropped).png), CC BY 4.0, Davide Bonadonna.
**Verdict:** solid, recognisable, but at $400 and 3 t it's a big body more than a mid-tier one.

## D7. *Carnotaurus sastrei*: a 1.5 t predator is "too good"

**Evidence: A− (one skeleton, articulated, with extensive skin impressions).** 7.5–8 m, **1.3–2.1 t**. Two thick horns
over the eyes, deep skull on a muscular neck (head blows or pushing in rival fights: hypotheses differ), vestigial arms,
the largest tail-to-thigh running muscle of any theropod (111–137 kg per leg): a fast runner for its size, slower than an
ostrich (Mazzetta et al.).
**Verdict:** the game's largest predator today is the 500 kg polar bear. A 1.5 t theropod predator that hunts you would be the
most dangerous animal on any board ("good animals are too good"). If ever built, a **rare at $400–500**, measured first; better
as a roguelike boss than a draft pick.
**Portrait:** [File:Carnotaurus sastrei FW.jpg](https://commons.wikimedia.org/wiki/File:Carnotaurus_sastrei_FW.jpg), CC BY 4.0, Fred Wierum.

## D8. *Dilophosaurus wetherilli*: the film's version was wrong

**Evidence: A−** (several skeletons; Marsh & Rowe 2020 redescription). ~7 m, **~400 kg**. Two thin crests too weak for
fighting (display). The venom spit and the neck frill are inventions of *Jurassic Park*, which also made it small. Robust arms
with large claws (grasping prey).
**Verdict:** honestly built it's a 400 kg theropod with display crests and grasping arms: overlapping Utahraptor's slot
without a distinct fighting signature. Players' expectations (spit, frill) can't be met realistically. Not recommended.
**Portrait:** [File:Life reconstruction of Dilophosaurus wetherilli.png](https://commons.wikimedia.org/wiki/File:Life_reconstruction_of_Dilophosaurus_wetherilli.png), CC BY 4.0, Connor Ashbridge.

## D9. Armored giants: Stegosaurus and Ankylosaurus (giant tier, capped)

- **Stegosaurus** (evidence A: many skeletons, "Sophie" in London). ~3.5–7 t depending on species and estimate. The tail
  spikes (the "thagomizer") have the **best trace evidence of any dinosaur weapon**: an Allosaurus tail vertebra with a puncture
  matching a Stegosaurus spike, and spikes with broken, healed tips (Carpenter et al. 2005, in *The Carnivorous Dinosaurs*;
  not re-read here). Signature idea: `thagomizer`, a sideways tail swing at an attacker beside or behind it (±90°), base 220,
  pierce .5, a 10% chance to break a spike (dmg ×.8 for good). **Giant tier: $600–700 capped**, rare.
  Portrait: [File:Sophie the Stegosaurus stenops of the Natural History Museum, London.jpg](https://commons.wikimedia.org/wiki/File:Sophie_the_Stegosaurus_stenops_of_the_Natural_History_Museum,_London.jpg), CC BY 4.0, APK (skeleton; no free life restoration found in this search).
- **Ankylosaurus** (evidence B: a few partial skeletons, one tail club). **4.8–8 t**. Club-tail blows are supported by
  biomechanics (Arbour 2009, *PLoS ONE*) and by flank-armor damage in its relative *Zuul* (Arbour et al. 2022, *Biology
  Letters*). It's Doedicurus at five times the mass: **giant tier, $700**, and the two shouldn't both exist (Doedicurus is the
  mid-tier version of the same idea).
  Portrait: [File:Ankylosaurus 2026.jpg](https://commons.wikimedia.org/wiki/File:Ankylosaurus_2026.jpg), CC0, Plegadis.

## Boss note: *Tyrannosaurus rex* (not a draft pick)

Evidence A (dozens of specimens, "Sue", "Stan"). ~8–9 t adults, the strongest bite of any land animal estimated, healed bite
wounds on Triceratops and Edmontosaurus (trace). In the draft it would be the elephant problem ×2 with a predator's targeting.
As a future roguelike endgame boss it works: one animal, everything you've built against it, closing arena. If built, adults
didn't sprint (preferred walking speed ~1.3 m/s, van Bijlert et al. 2021; top speed debated, roughly 5–8 m/s in
musculoskeletal models), so the fight would be about getting out of its
way, not outrunning it. Portrait: [File:Tyrannosaurus Rex and Triceratops, painting by Charles R Knight.jpg](https://commons.wikimedia.org/wiki/File:Tyrannosaurus_Rex_and_Triceratops,_painting_by_Charles_R_Knight.jpg), public domain
(Knight's 1927 mural: dated posture, fine for a boss splash).

---

# Ranked shortlists

## Best 4 overall

1. **Giant short-faced bear (Arctodus) — $300, tundra and forest, rare.** Evidence A− for the body. A new job nobody has:
   it **ends holds** on others (prying cats, packs and crocs off your animals and off you), with a 4.3 m reach that touches riders
   on giants. Grounded in modern analogy (grizzlies take wolf and cougar kills); the kleptoparasite hypothesis is labelled.
   Fills the forest and tundra at mid price.
2. **Woolly rhinoceros — $300, tundra, rare.** The best-evidenced candidate (frozen mummies, cave art, healed fight injuries).
   The `snowPlough` furrow is the first effect that changes the map for others: the tundra's heavy-animal problem becomes a
   positioning game. Iconic.
3. **Doedicurus — $200–300, savanna, rare.** The most new gameplay: a backwards weapon (2.5 kJ club, carapace fractures as
   trace evidence), cat-proof shell, and a hit chance that depends on whether the target holds still (the honest version of the
   "stationary target" debate). Watch stalling.
4. **Utahraptor — $200–300, forest, rare.** The mid-tier dinosaur: polar-bear mass, ambush build, the `pinDown` kill method from
   Fowler et al. 2011. Gives the forest an ambush predator that isn't a cat, and players a real (feathered) raptor at a real size.
   Measure "theirs" first.

Alternates: **Homotherium pair** ($200, tundra; the endurance-chaser cat, very good evidence for the body, the pair is
speculative) if the owner prefers mammals only; **dire wolf pack** ($200) for a crowd-pleaser with A-grade evidence.

Map coverage of the four: tundra +2 (rhino, bear), forest +2 (bear, Utahraptor), savanna +1 (Doedicurus). Roles: charger,
brawler, fortress, ambush predator. No overlap among them.

## Best 2 dinosaurs

1. **Utahraptor** (above): the dinosaur that fits the mid tier.
2. **Protoceratops herd ×3** ($100, savanna): the Fighting Dinosaurs fossil is the best behavioural evidence of any dinosaur,
   and `lockjaw` (it holds whatever grabs it) is a signature nobody else has. Cheap, but memorable. Pair it with Deinonychus
   if the owner wants the predator-prey matchup on the same board.

Giant-tier pick if the owner wants one: **Stegosaurus** (the thagomizer has a puncture wound in an Allosaurus vertebra to back
it). Not recommended: Velociraptor (a 15–20 kg turkey-sized predator: realism makes it filler), Dilophosaurus (its fame rests
on film inventions), Pachycephalosaurus (body known only from skulls, head-butting debated), Carnotaurus (too strong as a
predator).

## Notes for the main session

- Every candidate is proposed as a **rare**, matching how the existing prehistoric animals are dealt. Adding several at once
  dilutes the rare slot; consider a themed rare pool (Ice Age / Cretaceous / Australia) per board, so a board doesn't mix a
  Utahraptor with a woolly rhino unless the owner likes that.
- New hooks implied, all opt-in per species (boards without them stay byte-identical): `snowPlough` (trail points that modify
  `snowFactor`), `usurps` (reuse `repelBy/repelUntil`), `tailClub` (rear arc, movement-based accuracy) and `shell`,
  `runsDown`/`snowPaws`, `drawnToStruggle`, `faceBite` (a blinded state), `biteMail` (damage-type armor), `lockjaw` (a reverse
  hold), `pinDown`.
- Deal filters: dire wolf not on tundra (range evidence); cold-blooded rule doesn't apply to any of these (Megalania would
  need it).
- Measure with `price_abs.js` (N=240) and re-validate boards with `board.js` before pricing; the guesses above are by analogy.
- Uncertain points flagged in the text: woolly rhino in deep snow; Arctodus kleptoparasitism; Doedicurus speed and predator
  use of the club; Smilodon preying on Doedicurus; Homotherium group hunting; Daeodon carnivory and synonymy; Megalania size;
  Deinonychus and Utahraptor group behaviour; Pachycephalosaurus body and butting; dinosaur cold tolerance; the two *Ursus*
  papers and Carpenter et al. 2005 (cited from memory, not re-read).
- Sources: Wikipedia articles read through the MediaWiki API (rate-limited), each summarising the primary literature named in
  the text; primary papers were not re-read unless stated. Commons licences were read from each file's `extmetadata`
  (LicenseShortName, Artist); BY-SA, NC, ND and GFDL files were excluded, and files whose "public domain" claim looked doubtful
  (modern paleoart tagged PD by an uploader other than the artist) were skipped. Re-check each file page before cropping; CC BY
  files need a line in CREDITS.md.
