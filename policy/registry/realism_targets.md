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
