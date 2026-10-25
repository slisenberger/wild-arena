# Wild Arena roster: kits

Goal (owner): every animal has an identity as distinct as a fighting-game roster — a role, a signature move you can
see on the field, a clear strength and a clear weakness — while staying recognizably real. Values are the measured
swing (seconds of survival gained by moving it from their side to yours, `price_abs.js`, Oct 2026).

Status: **strong** = distinct and worth picking; **thin** = real but blurs with others or rarely matters;
**weak** = barely matters on the field. Thin/weak ones are the next design targets.

| Animal | Price | Value | Role | Signature you can see | Strength | Weakness | Status |
|---|---|---|---|---|---|---|---|
| Elephant | $700 | 190 | Mount / bulldozer | Mock charge, then trunk-and-tusk **sweep** hitting everyone in reach; you ride 3.2 m up | Reaches any rider; mobs predators | Slow (25 km/h), heat | strong |
| Woolly mammoth (rare) | $500 | 109 | Cold-map bulldozer | Same sweep, at home in snow | Cold-proof, armored fur | Wilts in heat | strong (tundra) |
| Triceratops (rare) | $800 | 172 | Giant ram, mount | Frill-down charge that can't steer | 8 t, 3 m mount | Turns slowly | strong |
| White rhino | $500 | 108 | Armored ram | Long blind charge, 9 m overshoot | Thickest armor but the croc | Placid: slow to start; poor eyes | strong |
| Black rhino | $400 | 83 | Hothead ram | Charges anything that moves; some charges veer off | Turns fast for a rhino | Small for a rhino | strong |
| Hippo | $500 | 108 | River tyrant | Hidden when submerged; burst charges out of water | Deadliest in water | Sunburns and overheats on land | strong |
| Cape buffalo | $300 | 68 | Vengeful bruiser | Holds a 40 s grudge against whoever hurt it | +50% vs lions, tigers, hyenas | Alone without the herd | strong |
| Buffalo herd ×3 | $700 | 188 | Mob | Three buffalo mobbing one target | Numbers + grudges | Price | strong |
| Bison | $400 | 83 | Snow tank | Tail-up mock charge, spins on a dime | Snow, stamina | Weaker in forest | strong |
| Bison herd ×3 | $700 | 198 | Mob | Three bison stampeding together | Best value per $ at the top | Price | strong |
| Moose | $300 | 69 | Stomper | Rears and **stomps** anything small or knocked down | Snow and water | Heat, thin hide | strong |
| Fighting bull | $300 | 57 | Relentless charger | Never needs provoking; chases whatever moves | Always worked up | Tires in a long fight | strong |
| Wild boar | $100 | 24 | Cheap slasher | Tusk slashes that **bleed** | Tough for its size | Small | thin |
| Giraffe | $200 | 36 | Lookout / kicker | Team spots threats 50% farther; lethal kick in self-defense | Sees everything | Never starts a fight | thin |
| Ostrich | $100 | 22 | Lookout / runner | Fastest on two legs; lookout | Speed | Never starts a fight; tiny damage | weak |
| Gorilla | $200 | 22 | Bodyguard | Bluff charge; sticks to you, +40% vs anything targeting you; fights to the death for you | Loyal | Low damage | thin |
| Honey badger | $100 | 8 | Pest | Fearless, twists out of holds (loose skin) | Never breaks | 11 kg: tiny damage | weak |
| Polar bear | $300 | 59 | Aquatic apex | Hunts from the water, white-on-white in snow, maul every 3rd swipe | Snow, water | Overheats anywhere warm | strong |
| Grizzly | $200 | 42 | Brawler | Bluff charge, then **maul** every 3rd swipe | +20% durability | Defensive, not predatory | strong |
| Black bear | $100 | 15 | Timid climber | Bluffs, bolts **up a tree** when in trouble | Climbs | Timid | thin |
| Tiger | $200 | 42 | Solo ambusher | Stalk, 9 m pounce, throat hold on prey 4× its size | Biggest cat | Fragile when caught in the open | strong |
| Lion | $100 | 26 | Sprinter | Fastest sprint, leaps the last 5 m; kills hyenas on sight | Speed | Nervous alone | thin |
| Lion coalition ×2 | $200 | 44 | Pair hunters | Two males converging on one target | Holding their nerve together | Low durability | thin |
| Leopard | $100 | 10 | Tree ambusher | **Drops out of trees**; flees up trees | Hidden in branches | Gives way to bigger cats and hyenas | weak |
| Jaguar | $100 | 22 | Skull-crusher | Bite ignores half of armor; swims | Armor-piercing | Short reach | thin |
| Cougar | $100 | 10 | Leaper | 12 m pounce, leaps 5 m onto riders and into trees | Reaches riders | Slinks off when faced down | weak |
| Gray wolf (solo) | $100 | 2 | — | Hamstring bites | Stamina | Nervous alone; near-worthless | weak |
| Wolf pack ×4 | $100 | 22 (×3) | Attrition hunters | Circle, dart in, hamstring, back out | Tireless, slows prey | Low damage per bite | thin |
| Spotted hyena | $100 | 27 | Bone-cruncher | Bite ignores 30% armor; very tough | Durable, tireless | Lions kill it on sight | thin |
| Hyena clan ×4 | $300 | 54 | Mob | Four hyenas mobbing | Numbers + durability | Lions | strong |
| Saltwater croc | $200 | 46 | Water ambusher | Invisible until 7 m in water; lunge, **death roll**, drags prey under | Strongest bite | Slow on land; never on the tundra | strong (water) |

## Gaps to work on (next design passes)
1. **Lone wolf (2), leopard (10), cougar (10), honey badger (8), black bear (15), ostrich (22).** Each needs one
   *visible* thing it does better than anyone, so picking it is a choice, not a $100 filler. Ideas (realistic):
   - Lone wolf: scout/harrier role — keeps enemy chargers busy (hamstring slows big prey more), or simply only
     appear as a pack item.
   - Leopard: tree ambush exists for the other side; give your leopard a "post in a tree" guard mode (drops on
     what comes for you).
   - Cougar: rider-snatcher — strong bonus for knocking riders off and for attacking anything on a mount.
   - Honey badger: harassment that drags enemy attention (enemies that get bitten switch to it); a decoy.
   - Black bear: tree-sitter that swats down at climbers; nuisance guard.
   - Ostrich: evasive mount that keeps you moving (a getaway mount), plus lookout.
2. **Giraffe and ostrich never start fights:** realistic, but their value must come from their support role
   (lookout radius, getaway mount) being visible and strong enough.
3. **Cats blur together:** tiger (ambush + big holds), lion (sprint + coalition), leopard (trees), jaguar (armor
   piercing + water), cougar (leaps onto riders). Make each signature fire visibly and often enough to read.
4. **Identity check in the audit:** count each signature per fight (sweeps, mock charges, stomps, tree drops,
   death rolls, holds, grudge kills, lookout spots, …) so we can see every animal actually does its thing.

## Cats on your side (Oct 2026 pass)
Owner: "cats murk me but I get little value out of them." Measured cause: guard cats chased the biggest threat
(often a tonne-plus herbivore) and died (86% of them per fight), and the other side's herbivores single out
predators. Changes (all realistic, all symmetric where they apply):
- Guard cats pick fights they can win: other predators, things their size, above all whatever is after you.
- A cat out of the action for ~8 s with nothing after it can ambush again.
- Cats sidestep and give ground when a much bigger herbivore comes for them.
Result, value on your side: lion 8 → ~20 s, jaguar 5 → ~19, cougar 7 → ~19, leopard 2 → ~4–11, tiger ~15
(unchanged within noise). Their biggest value is still denial: left on the other side they hunt you.
