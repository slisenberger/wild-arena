# Realism targets: per-species target-choice priors

Sourced tendencies for **target choice** by other-side predators, used as priors in training labels by `policy/realism_prior.js`
(`plan.js` / `expert_iter --prior`). Drafted Nov 16 2026 (research subagent). Each entry: prior += confidence × Σ weight × feature,
only inside its `when` context and off when an `except` feature holds. **The human is never penalised:** `realism_prior.js` clamps
a human option's prior to ≥ 0, and no entry puts weight on `isHuman`. No entry asks for disengaging: every entry only re-ranks targets.

**Units.** `logMass` is ln(target mass / own mass) / 1.5, clipped to ±2, so thresholds are scaled: 0.5 ≈ 2.1×, 0.75 ≈ 3.1×, 1.0 ≈ 4.5×,
1.5 ≈ 9.5×, 2.2 ≈ 27×, −0.4 ≈ 0.55×, −0.5 ≈ 0.47×. `dist` is m/30 (max 2). `packSupport` = group size − 1 + packmates within 15 m.
Masses in the engine: tiger 220, lion 190, jaguar 100, cougar 60, leopard 70, smilodon 260, utahraptor 350, wolf 45, hyena 60,
grizzly 320, polar 500, black bear 120, honey badger 11, short-faced bear 650, human 75 kg.

## The species differences these encode
| axis | one side | other side |
|---|---|---|
| fleeing prey | wolves, hyenas course it (+0.4 to +0.5) | stalk/ambush cats, polar bear, short-faced bear give it up (−0.25 to −0.4) |
| prey size, solitary | leopard small (10–40 kg, −0.6 above 0.55×); polar seal-sized; black bear neonates | cougar big for its size (+0.3 up to ~4×); smilodon big game (+0.4 up to ~4.5×) |
| prey size, group effect | lone wolf avoids > 4.5×; lone hyena > 3.3×; lone lion > 3.1× | wolfpack commits up to ~10× (no bison); wolfpack6 up to ~27× (bison); hyena clan up to ~7×; lion coalition up to ~8× |
| other predators | leopard, cougar, jaguar avoid (larger) predators; lone wolf/hyena avoid larger ones | hyena clan mobs predators (+0.5); wolf packs go for cougar-sized; grizzly, honey badger don't shy |
| already-engaged prey (`busy`) | hyenas, black bear (puma-kill thief), grizzly, short-faced bear, utahraptor (+0.4 to +0.5) | cats and wolves: no entry |
| hurt prey | wolves (+0.6), polar on walrus-sized, bears, hyenas | cats only via `except: hurt` on size caps |

## Entries
| species | id | when | prefer | except | conf |
|---|---|---|---|---|---|
| tiger | `preyNiche1to1` | logMass >0.5 | logMass -0.5 | hurt | 0.8 |
| tiger | `bigPreyVulnerable` | logMass >0.5 | hurt +0.5 |  | 0.6 |
| tiger | `killsSmallerCarnivores` | isPred true | logMass -0.5 |  | 0.6 |
| tiger | `ambushNotCourse` | always | fleeing -0.3 |  | 0.4 |
| lion | `loneUpperNiche` | packSupport 0, logMass >0.75 | logMass -0.5 | hurt | 0.7 |
| lion | `belowNiche` | logMass <-0.5 | logMass +0.4 |  | 0.6 |
| lion | `killsHyenasAndSmallerPredators` | isPred true | logMass -0.6 |  | 0.7 |
| lion | `stalkNotCourse` | always | fleeing -0.3 |  | 0.4 |
| lionpack | `coalitionTakesBig` | packSupport >=1, logMass <1.4 | logMass +0.4 |  | 0.7 |
| lionpack | `capAtGiants` | logMass >1.4 | logMass -0.4 | hurt | 0.5 |
| lionpack | `killsCompetitors` | isPred true | logMass -0.4 |  | 0.7 |
| lionpack | `stalkNotCourse` | always | fleeing -0.25 |  | 0.4 |
| jaguar | `preyNiche` | logMass >0.4 | logMass -0.4 | hurt | 0.7 |
| jaguar | `avoidsLargerCarnivorans` | isPred true, logMass >0 | isPred -0.3 |  | 0.5 |
| jaguar | `ambushNotCourse` | always | fleeing -0.3 |  | 0.4 |
| cougar | `bigForItsSize` | logMass <0.9 | logMass +0.3 |  | 0.6 |
| cougar | `capAtGiants` | logMass >1.2 | logMass -0.5 | hurt | 0.5 |
| cougar | `subordinate` | isPred true, logMass >0 | isPred -0.6 |  | 0.7 |
| cougar | `edgeAmbusher` | always | fleeing -0.4 |  | 0.5 |
| leopard | `smallPrey` | logMass >-0.4 | logMass -0.6 | hurt | 0.8 |
| leopard | `avoidsCompetitors` | isPred true | isPred -0.4, logMass -0.4 |  | 0.7 |
| leopard | `ambushNotCourse` | always | fleeing -0.3 |  | 0.4 |
| smilodon | `bigGame` | logMass <1.0 | logMass +0.4 |  | 0.55 |
| smilodon | `notMegafauna` | logMass >1.3 | logMass -0.3 | hurt | 0.4 |
| smilodon | `ambushNotCourse` | always | fleeing -0.4 |  | 0.4 |
| utahraptor | `largeHerbivores` | logMass <1.2 | logMass +0.3 |  | 0.3 |
| utahraptor | `joinsTheScramble` | always | busy +0.4, hurt +0.3 |  | 0.3 |
| wolf | `loneAvoidsBig` | packSupport 0, logMass >1.0 | logMass -0.6 | hurt, fleeing | 0.7 |
| wolf | `cullsVulnerable` | always | hurt +0.6 |  | 0.75 |
| wolf | `coursesFleeing` | always | fleeing +0.5 |  | 0.7 |
| wolf | `loneYieldsToBears` | packSupport 0, isPred true | logMass -0.5 |  | 0.5 |
| wolfpack | `commitsToElkSize` | packSupport >=3, logMass <1.5 | logMass +0.4 |  | 0.7 |
| wolfpack | `notBisonYet` | logMass >1.5 | logMass -0.4 | hurt, fleeing | 0.7 |
| wolfpack | `cullsVulnerable` | always | hurt +0.6 |  | 0.75 |
| wolfpack | `coursesFleeing` | always | fleeing +0.5 |  | 0.7 |
| wolfpack | `killsSmallerPredators` | isPred true, logMass <1.0 | isPred +0.3 |  | 0.55 |
| wolfpack6 | `commitsToFormidable` | packSupport >=5, logMass <=2.2 | logMass +0.5 |  | 0.7 |
| wolfpack6 | `cullsVulnerable` | always | hurt +0.6 |  | 0.75 |
| wolfpack6 | `coursesFleeing` | always | fleeing +0.5 |  | 0.7 |
| wolfpack6 | `takesOnPredators` | isPred true, logMass <1.6 | isPred +0.4 |  | 0.5 |
| hyena | `loneUpTo3x` | packSupport 0, logMass >0.8 | logMass -0.5 | hurt | 0.7 |
| hyena | `loneAvoidsLions` | packSupport 0, isPred true | logMass -0.6 |  | 0.7 |
| hyena | `scavengerKlepto` | always | hurt +0.5, busy +0.4 |  | 0.6 |
| hyena | `coursesFleeing` | always | fleeing +0.4 |  | 0.6 |
| hyenapack | `clanTakesZebra` | packSupport >=3, logMass <1.3 | logMass +0.4 |  | 0.65 |
| hyenapack | `mobsLions` | packSupport >=3, isPred true | isPred +0.5 |  | 0.6 |
| hyenapack | `scavengerKlepto` | always | hurt +0.5, busy +0.5 |  | 0.6 |
| hyenapack | `coursesFleeing` | always | fleeing +0.4 |  | 0.6 |
| grizzly | `vulnerablePrey` | logMass >0 | logMass -0.4, hurt +0.4 |  | 0.7 |
| grizzly | `usurpsKills` | always | busy +0.5 |  | 0.6 |
| grizzly | `dominantOverPredators` | isPred true | isPred +0.3 |  | 0.5 |
| polar | `sealSizedPrey` | logMass >-0.5 | logMass -0.5 | hurt | 0.7 |
| polar | `walrusIfVulnerable` | logMass >0.5 | hurt +0.6 |  | 0.55 |
| polar | `stillHunter` | always | fleeing -0.3 |  | 0.4 |
| blackbear | `neonates` | logMass >-0.3 | logMass -0.6 | hurt | 0.7 |
| blackbear | `usurpsCats` | always | busy +0.5 |  | 0.65 |
| blackbear | `picksSmallerPredators` | isPred true | logMass -0.5 |  | 0.5 |
| blackbear | `weakenedPrey` | always | hurt +0.4 |  | 0.5 |
| honeybadger | `chargesThreats` | always | isPred +0.4 |  | 0.4 |
| shortface | `kleptoparasite` | always | busy +0.5, isPred +0.3 |  | 0.3 |
| shortface | `opportunistNotPursuer` | always | hurt +0.4, fleeing -0.3 |  | 0.4 |

## Gaps (none found so far)
- **Honey badger:** only one entry. No peer-reviewed study of how it chooses among large animals; its defensive charges are from a field researcher's popular account (Begg, BBC Wildlife). A distance preference was drafted and dropped: every `dist` weight is negative for all options and would act as a blanket shift onto the human.
- **Utahraptor, short-faced bear:** hypotheses only (Kirkland's iguanodont prey; Matheus' kleptoparasite idea, rejected-as-specialist by Figueirido 2010). Confidence ≤ 0.4.
- **Smilodon sociality** (Carbone et al. 2009) not confirmed in this pass, so no `packSupport` entry. Smilodon 'ambush' is an inference from its build (confidence 0.4).
- **Jaguar vs caiman:** jaguars do kill caimans (crocs count as `isPred` in the game), but Hayward et al. 2016 report carnivorans *avoided*; I couldn't confirm caiman preference, so jaguar has only a mild 'avoid larger predators' entry.
- **Cats' `fleeing −`:** sourced to the stalk/attack phase model (Elliott, lion) and puma edge ambush (Laundré & Hernández); no study measured abandon rates directly. Confidence 0.4–0.5.
- Lion stealing kills from hyenas (Trinkel 2005) is real, but `busy` was kept for scavenger/kleptoparasite species so the axis separates species.

## Sources
- Hayward & Kerley 2005, Prey preferences of the lion, J. Zool. 267: https://doi.org/10.1017/S0952836905007508
- Hayward et al. 2006, Prey preferences of the leopard, J. Zool. 270: https://doi.org/10.1111/j.1469-7998.2006.00139.x
- Hayward, Jędrzejewski & Jędrzejewska 2012, Prey preferences of the tiger, J. Zool. 286: https://doi.org/10.1111/j.1469-7998.2011.00871.x
- Hayward 2006, Prey preferences of the spotted hyaena, J. Zool. 270: https://ibs.bialowieza.pl/publications/1598.pdf
- Hayward et al. 2016, Prey preferences of the jaguar, Front. Ecol. Evol. 3:148: https://doi.org/10.3389/fevo.2015.00148
- Karanth & Sunquist 1995, Prey selection by tiger, leopard and dhole, J. Anim. Ecol.: https://repository.ias.ac.in/89486
- Palomares & Caro 1999, Interspecific killing among mammalian carnivores, Am. Nat. 153: https://doi.org/10.1086/303189
- Donadio & Buskirk 2006, Diet, morphology, and interspecific killing in Carnivora, Am. Nat. 167: https://www.journals.uchicago.edu/doi/10.1086/501033
- Trinkel & Kastberger 2005, Competitive interactions between spotted hyenas and lions in Etosha, Afr. J. Ecol. 43: https://the-eis.com/elibrary/search/25421
- Cooper 1991, Optimal hunting group size: lions defending kills against hyaenas, Afr. J. Ecol. 29: https://www.scilit.net/publications/f8217c570f58fe18c47c4c1e3fad4cb6
- Holekamp et al. 1997, Hunting rates and hunting success in the spotted hyena, J. Zool. (summarised in Smith & Holekamp chapter): https://link.springer.com/10.1007/978-3-031-29803-5_5
- Périquet, Fritz & Revilla 2015, The Lion King and the Hyaena Queen, Biol. Rev. 90: https://doi.org/10.1111/brv.12152
- MacNulty et al. 2012, Nonlinear effects of group size on wolves hunting elk, Behav. Ecol. 23: https://doi.org/10.1093/beheco/arr159
- MacNulty et al. 2014, Group size and wolves hunting bison, PLoS ONE 9: https://doi.org/10.1371/journal.pone.0112884
- MacNulty, Mech & Smith 2007, Ethogram of large-carnivore predatory behavior: https://www.wolf.org/wp-content/uploads/2013/09/287apropsedethogram.pdf
- Barber-Meyer et al. 2016, Wolf pack size and hunting dangerous prey, Behaviour: https://www.wolf.org/wp-content/uploads/2013/08/355.Differential-wolf-pack-size-persistence-and-the-role-of-risk-when-hunting-dangerous-prey.pdf
- Wright et al. 2006, Selection of northern Yellowstone elk by wolves and hunters, JWM 70: https://www.doi.org/10.2193/0022-541X(2006)70[1070:SONYEB]2.0.CO;2
- Wikipedia, Hunting behavior of gray wolves: https://en.wikipedia.org/wiki/Hunting_behavior_of_gray_wolves
- Kortello, Hurd & Murray 2007, Cougars and gray wolves in Banff, Ecoscience 14: https://doi.org/10.2980/1195-6860(2007)14[214:IBCPCA]2.0.CO;2
- Gunther & Smith 2004, Wolves and female grizzly bears with cubs, Ursus 15: https://webarchive.library.unt.edu/eot2008/20080916031905/http://nrmsc.usgs.gov/files/norock/products/Ursus-15-02-Gunther_Smith.pdf
- Knopff et al. 2010, Cougar kill rate and prey composition, JWM 74: https://doi.org/10.2193/2009-314
- Iriarte et al. 1990, Food habits and body size of the American puma, Oecologia 85: https://link.springer.com/doi/10.1007/BF00319400
- Laundré & Hernández 2003, Winter hunting habitat of pumas, Wildl. Biol. 9: https://www.esf.edu/biology/faculty/documents/laundreandhernandez2003huntinghabitatpumas.pdf
- Elbroch et al. 2015, Pumas, black bears and competition refuges, Behav. Ecol. 26: https://www.originalwisdom.com/wp-content/uploads/bsk-pdf-manager/2019/03/Elbroch-et-al_2015_Pumas-black-bears-and-competition-refuges_CT.pdf
- Allen et al. 2021, Can't bear the competition: https://maxallen.inhs.illinois.edu/files/2021/02/Allen-2021-Cant-Bear-The-Competition.pdf
- Balme et al. 2017, Caching reduces kleptoparasitism in a solitary large felid, J. Anim. Ecol. 86: https://doi.org/10.1111/1365-2656.12654
- Zager & Beecham 2006, Black and brown bears as predators on ungulates, Ursus 17: https://www.bearbiology.org/download/the-role-of-american-black-bears-and-brown-bears-as-predators-on-ungulates-in-north-america/
- Stirling & Archibald 1977, Aspects of predation of seals by polar bears, J. Fish. Res. Board Can. 34: https://doi.org/10.1139/f77-169
- Stirling 1974, Midsummer observations on the behavior of wild polar bears, Can. J. Zool.: https://doi.org/10.1139/z74-157
- Calvert & Stirling 1990, Polar bears and overwintering walruses: https://www.bearbiology.org/download/interactions-between-polar-bears-and-overwintering-walruses-in-the-central-canadian-high-arctic/
- COSEWIC Atlantic walrus report, ch. 9: https://www.canada.ca/en/environment-climate-change/services/species-risk-public-registry/cosewic-assessments-status-reports/atlantic-walrus/chapter-9.html
- Begg et al. 2003, Diet and foraging of the honey badger, J. Zool. 260: https://doi.org/10.1017/S0952836903003789
- Begg (BBC Wildlife / Discover Wildlife), Why are honey badgers so aggressive?: https://www.discoverwildlife.com/animal-facts/mammals/why-are-honey-badgers-so-aggressive
- Meachen-Samuels & Van Valkenburgh 2010, Radiographs reveal Smilodon's forelimb strength, PLoS ONE: https://doaj.org/article/f8704881da854a7e970372481ad102a3
- DeSantis et al. 2012, Dental microwear of La Brea carnivorans, PLoS ONE: https://doaj.org/article/3f45e7b762fa4cba9b28cc185aba6ccc
- Figueirido et al. 2010, Demythologizing Arctodus simus, J. Vert. Paleontol. 30: https://doi.org/10.1080/02724630903416027
- Matheus 1995, Diet and co-ecology of Pleistocene short-faced and brown bears in Beringia, Quat. Res. 44: https://doi.org/10.1006/qres.1995.1090
- Utah Geological Survey, the Utahraptor megablock: https://geology.utah.gov/popular/dinosaurs-fossils/megablock
- Smithsonian, What do we really know about Utahraptor?: https://www.smithsonianmag.com/science-nature/what-do-we-really-know-about-utahraptor-95334335/
- Roach & Brinkman 2007, Cooperative pack hunting and gregariousness in Deinonychus, Bull. Peabody Mus. 48: https://doi.org/10.3374/0079-032X(2007)48[103:AROCPH]2.0.CO;2
- Funston, Mills & Biggs 2001, Hunting success of male and female lions in Kruger, J. Zool. 253: https://www.cambridge.org/core/journals/journal-of-zoology/article/factors-affecting-the-hunting-success-of-male-and-female-lions-in-the-kruger-national-park/AAAF9B3CB2FE853D7AC3769F5F71BF53
- Elliott 1975 (thesis) / Elliott, Cowan & Holling 1977, Prey capture by the African lion, Can. J. Zool. 55: https://open.library.ubc.ca/cIRcle/collections/ubctheses/831/items/1.0100037

Caveat: most figures were checked against abstracts and secondary summaries, not full texts. DOIs for Palomares & Caro, Matheus,
Stirling 1974 and Meachen-Samuels (DOAJ record) were not opened in this pass.

## Herbivore archetypes: bulldozers and kickers (added Nov 16 2026, research subagent)
Elephant, mammoth, gorilla, walrus (bulldozers) and giraffe, ostrich, giant kangaroo (kickers) have no target net yet; these priors are
for when they get one. Their targets are your guards and the human. As above: no `isHuman` weights, no `dist` weights, and entries only
re-rank. Masses: elephant 6,000, mammoth 6,000, gorilla 180, walrus 1,200, giraffe 1,200, ostrich 120, giant kangaroo 230 kg.

**Two things the features can't express (so they aren't encoded):** for a 6 t proboscidean every predator (and the human) sits at the
`logMass` clip (−2), so "the biggest predator is the biggest threat" (McComb 2011: stronger response to male lions) can't separate a lion
from a wolf or a grizzly. And a `logMass` weight on a negative-`logMass` window shifts the whole window *down* relative to the human
(which sits at 0 after the clamp), so a "takes on rhino-sized herbivores" entry would have penalised rhinos; it was dropped.

### The species differences these encode
| axis | one side | other side |
|---|---|---|
| goes for predators (`isPred`) | elephant +0.5 (0.7), gorilla +0.4, mammoth +0.45 (0.45), walrus +0.4, giraffe +0.3 | ostrich, giant kangaroo: no blanket preference, only by size |
| size of predator it takes on | ostrich and giant kangaroo prefer smaller predators (−0.5 `logMass`: jackal/hyena/dingo-sized); gorilla avoids predators > ~1.6× itself | elephant, mammoth, walrus, giraffe: no size cap (every predator is smaller) |
| big herbivores | ostrich avoids anything > ~2× unless hurt | others: no entry |
| defends an attacked ally (`busy`) | gorilla +0.5, giraffe +0.5 (mother/calf), elephant, walrus, ostrich +0.4, mammoth +0.35 | giant kangaroo: none (males defend themselves, not others) |
| chases a fleeing target | walrus −0.5 (slow on land), gorilla −0.4 (bluff charges stop short), giant kangaroo −0.3 | elephant, mammoth, giraffe, ostrich: no entry |

### Entries
| species | id | when | prefer | except | conf |
|---|---|---|---|---|---|
| elephant | `mobsPredators` | always | isPred +0.5 |  | 0.7 |
| elephant | `defendsAttacked` | always | busy +0.4 |  | 0.5 |
| mammoth | `mobsPredators` (analogue) | always | isPred +0.45 |  | 0.45 |
| mammoth | `defendsAttacked` (analogue) | always | busy +0.35 |  | 0.35 |
| gorilla | `chargesThreats` | always | isPred +0.4 |  | 0.55 |
| gorilla | `defendsAttacked` | always | busy +0.5 |  | 0.5 |
| gorilla | `leopardSizedFoes` | isPred true, logMass >0.3 | logMass -0.5 |  | 0.4 |
| gorilla | `bluffNotPursuit` | always | fleeing -0.4 |  | 0.4 |
| walrus | `tusksVsBears` | isPred true | isPred +0.4 |  | 0.5 |
| walrus | `defendsHerdmate` | always | busy +0.4 |  | 0.4 |
| walrus | `noPursuitOnLand` | always | fleeing -0.5 |  | 0.5 |
| giraffe | `kicksPredators` | isPred true | isPred +0.3 |  | 0.5 |
| giraffe | `kicksCalfAttacker` | always | busy +0.5 |  | 0.4 |
| ostrich | `nestPredatorsSmall` | isPred true | logMass -0.5 |  | 0.45 |
| ostrich | `defendsChicks` | always | busy +0.4 |  | 0.4 |
| ostrich | `avoidsLarge` | logMass >0.5 | logMass -0.5 | hurt | 0.4 |
| giantkangaroo | `boxesCanids` (analogue) | isPred true | logMass -0.5 |  | 0.5 |
| giantkangaroo | `defensiveNotPursuit` (analogue) | always | fleeing -0.3 |  | 0.35 |

### Claims
- **Elephant.** `mobsPredators`: family groups bunch and mob toward lion roars, led by older matriarchs (McComb et al. 2011).
  `defendsAttacked`: coalitions and protection of harassed or attacked group members in ~35 years of field records (Bates et al. 2008).
- **Mammoth** (extinct; living-proboscidean analogues, lower confidence): the same two tendencies; Homotherium took ~2-year-old
  juvenile mammoths at Friesenhahn Cave (DeSantis et al. 2021), so herds had big cats to defend calves against.
- **Gorilla.** `chargesThreats`: a leading silverback charged predator surrogates (human observers) 106 and 33 times to protect infants,
  females and unrelated immigrants (Tamura et al. 2024); the leopard is the only natural predator and males put themselves between
  attacker and group (Berggorilla). `defendsAttacked`: same, plus a silverback defending his group against chimpanzees at Loango
  (Southern et al. 2021). `leopardSizedFoes`: the predators it faces are leopard-sized, and an outnumbered silverback was chased off
  (Berggorilla; Southern 2021). `bluffNotPursuit`: displays are chest beats, roars and bluff charges (SDZ factsheet; Tamura 2024).
- **Walrus.** `tusksVsBears`: tusks used in defence against polar bears (Fay 1982 via NAMMCO summary); adults are aggressive with large
  tusks, bears take sub-adults and calves (COSEWIC; NWF). `defendsHerdmate`: adults guard calves/sub-adults (COSEWIC; NWF).
  `noPursuitOnLand`: bear approach is the main cause of stampedes into the water on Wrangel Island (Kochnev 2002).
- **Giraffe.** `kicksPredators`: 13% of adults carry lion claw marks, mostly on hindquarters/flanks, i.e. they survive and fight off
  attacks (Strauss & Packer 2013); kicks can injure lions (Muneza et al. 2022 background). `kicksCalfAttacker`: a mother drove off a
  lion attacking her calf by kicking it (Tufts Magazine 2013, reporting field researchers).
- **Ostrich.** `nestPredatorsSmall`: the male guards the nest with his feet (Toronto Zoo); eggs are lost to hyenas and jackals (SDZWA).
  `defendsChicks`: first defence is running; it kicks when chicks need protecting or it can't flee (Smithsonian National Zoo).
  `avoidsLarge`: from the same "run first, kick as a last resort" (National Zoo; SDZWA).
- **Giant kangaroo** (Procoptodon extinct; eastern grey kangaroo analogue, ~70 kg males vs ~15 kg dingoes): `boxesCanids`: large males are
  the only class that wards off dingo attacks (kicking, tail-thumping, one fight > 1 h) (Jarman & Wright 1993; Wright 1993).
  `defensiveNotPursuit`: large males flee shorter distances, ward off, or take to water (same).

### Gaps (none found so far)
- **Elephant vs rhino:** young musth bulls without older bulls killed 40+ rhinos (Slotow et al. 2000, https://doi.org/10.1038/35044191;
  Pachyderm, Hluhluwe-Umfolozi: https://pachydermjournal.org/index.php/pachyderm/article/view/1058). Abnormal context and not expressible
  with the current features (see above); left out.
- **Elephant/mammoth: bigger predator first** (McComb 2011, male vs female roars): not separable at the `logMass` clip. Would need an
  unclipped mass feature or a `threat` feature (target damage × mass).
- **Chasing fleeing targets** for elephant, mammoth, giraffe, ostrich: no source found on whether they pursue a retreating predator.
- **Giraffe vs big herbivores, giraffe size limits; elephant/walrus size limits:** no source found.
- **Gorilla vs leopard directly:** Schaller's 1964 account of an adult attacking a leopard is only second-hand (forums); Fay 1995 (Folia
  Primatol.) on leopard predation was not found. Gorilla vs large herbivores: nothing found.
- **Walrus actively attacking bears:** popular accounts (BBC footage summaries) only; Fay 1982 full text not read.
- **Ostrich:** no peer-reviewed study of anti-predator kicks; only zoo/institution pages (the "kick kills a lion" claim is unmeasured).
- **Giant kangaroo vs larger predators** (Thylacoleo, the real Pleistocene threat): nothing on behaviour; drowning dogs is from news.
- **Hurt targets:** no herbivore source on preferring wounded enemies; none encoded.

### Sources
- McComb et al. 2011, Leadership in elephants: the adaptive value of age, Proc. R. Soc. B 278: https://doi.org/10.1098/rspb.2011.0168
- Bates et al. 2008, Do elephants show empathy?, J. Consciousness Studies 15: https://dspace.stir.ac.uk/handle/1893/946
- DeSantis et al. 2021, Dietary ecology of the scimitar-toothed cat Homotherium serum, Curr. Biol. 31: https://doi.org/10.1016/j.cub.2021.03.061
- Tamura et al. 2024, Protection service of a leading silverback male from external threats in wild western gorillas, Folia Primatol. 95: https://doi.org/10.1163/14219980-bja10026
- Southern et al. 2021, Lethal coalitionary attacks of chimpanzees on gorillas in Loango, Sci. Rep. 11: https://doi.org/10.1038/s41598-021-93829-x
- Berggorilla & Regenwald Direkthilfe, Do gorillas have enemies?: https://www.berggorilla.org/en/gorillas/general/everyday-life/do-gorillas-have-enemies/
- San Diego Zoo Global Library, Western lowland gorilla fact sheet, behavior: https://ielc.libguides.com/sdzg/factsheets/westernlowlandgorilla/behavior
- Fay 1982, Ecology and biology of the Pacific walrus, North American Fauna 74 (USGS): https://www.usgs.gov/publications/ecology-and-biology-pacific-walrus-odobenus-rosmarus-divergens-illiger
- COSEWIC Atlantic walrus report, ch. 9: https://www.canada.ca/en/environment-climate-change/services/species-risk-public-registry/cosewic-assessments-status-reports/atlantic-walrus/chapter-9.html
- National Wildlife Federation 2000, In search of the tooth walker: https://www.nwf.org/Magazines/National-Wildlife/2000/In-Search-of-the-Tooth-Walker
- Kochnev 2002, Causes of walrus mortality on Wrangel Island: https://www.arlis.org/docs/vol1/E/Walrus/Russian/Kochnev.2002.CausesWalrusMortalityWrangel.MarMamRep.ENG&RUSS.pdf
- Strauss & Packer 2013, Using claw marks to study lion predation on giraffes of the Serengeti, J. Zool. 289: https://doi.org/10.1111/j.1469-7998.2012.00972.x
- Muneza et al. 2022, Giraffe skin disease and lion predation, J. Zool. 316: https://doi.org/10.1111/jzo.12930
- Tufts Magazine, Summer 2013, The Good Mother: https://news.tufts.edu/magazine/summer2013/features/mother.html
- San Diego Zoo Wildlife Alliance, Ostrich: https://animals.sandiegozoo.org/node/118
- Smithsonian National Zoo, How fast is an ostrich? And more fun facts: https://www.nationalzoo.si.edu/node/16512
- Toronto Zoo, Ostrich: https://www.torontozoo.com/animals/Ostrich
- Jarman & Wright 1993, Macropod studies at Wallaby Creek IX: exposure and responses of eastern grey kangaroos to dingoes, Wildl. Res. 20: https://doi.org/10.1071/WR9930833
- Wright 1993, Observations of the behaviour of male eastern grey kangaroos when attacked by dingoes, Wildl. Res. 20: https://doi.org/10.1071/WR9930845

Caveat: page fetches were blocked in this session (CSIRO, PMC and others not reachable), so every claim here was checked against search
abstracts and summaries, not full texts. The CSIRO DOIs were built from the journal's article codes (WR9930833, WR9930845), not opened.
