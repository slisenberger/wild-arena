// ===== Wild Arena simulation engine (pure, no DOM) =====
(function (root) {
'use strict';

const W = 100, H = 66, DT = 0.1, MATCH_T = 300, QUIET_T = 30;

// Real-biology-grounded stats. mass kg, spd m/s top speed, dmg per strike, cd s between strikes,
// armor 0-1, reach m, stam = seconds of sprint, heat = heat tolerance (1 normal), cold = cold tolerance,
// water = aquatic affinity (-1..1), aggr, flee = morale break point, corner = cornered damage mult,
// climb = can climb trees (and escapes up one when fleeing); strike height and rider height live in STYLE.
// swim = speed in deep water, m/s (real swimming/bottom-walking speed, not a fraction of sprint speed).
// tag aquaStalk = hides submerged like a croc, lunges out of the water, first strike from the water is an ambush.
const ANIMALS = [
 {id:'elephant', rare:true, bluffP:0.35, name:'African Elephant', abbr:'ELE', price:700, mass:6000, spd:7, dmg:260, cd:1.6, armor:.35, reach:3.5, stam:20, heat:.8, cold:.6, water:.5, swim:1.5, aggr:.55, flee:.15, corner:1.3, pred:false, charge:true, vision:40, tags:['hatesPredators','sweep','bluff'],
  traits:['Rideable: you sit 3.2 m up, and its trunk reaches any rider','Matriarch: sometimes a mock charge, often a real one with no warning; it tramples','Mobs predators on sight; momentum hits scatter anything smaller']},
 {id:'rhino', name:'White Rhino', abbr:'RHI', price:400, mass:2300, spd:12.5, dmg:180, cd:1.4, armor:.55, reach:2.6, stam:15, heat:.8, cold:.55, water:0, swim:1, aggr:.3, flee:.25, corner:1.3, pred:false, charge:true, vision:18, tags:[],
  traits:['Placid two-tonne grazer: slow to anger, and it gives way to elephants','Armor-thick hide (only the croc is tougher) and a horn charge that cannot steer','Poor eyesight: it charges what it hears or smells as much as what it sees']},
 {id:'hippo', name:'Hippo', abbr:'HIP', price:400, mass:2000, spd:8, dmg:230, cd:1.3, armor:.55, reach:2.5, stam:8, heat:.5, cold:.4, water:.9, swim:2.5, aggr:.9, flee:.1, corner:1.3, pred:false, charge:true, vision:25, tags:['territorial','sunburn','submerges'],
  traits:['Deadliest large animal in Africa: holds the river and charges out of it','In water: faster, cooler, territorial, and hard to spot until it surfaces','On dry land: sunburns and overheats']},
 {id:'giraffe', name:'Giraffe', abbr:'GIR', price:200, mass:1200, spd:15, dmg:150, cd:1.8, armor:.2, reach:2.5, stam:25, heat:1, cold:.5, water:-.6, swim:0.8, aggr:.2, flee:.5, corner:1.4, pred:false, charge:false, vision:60, tags:['lookout','kicker'],
  traits:['Lookout: your whole team spots threats 50% farther away','Sees lions a kilometre off, and one kick can kill one','Only kicks what comes at it; never starts a fight']},
 {id:'polar', name:'Polar Bear', abbr:'PBR', price:200, mass:500, spd:11, dmg:145, cd:1.0, armor:.4, reach:2.1, stam:12, heat:.4, cold:1, water:.85, swim:3, aggr:.85, flee:.2, corner:1.3, pred:true, charge:false, vision:30, tags:['scavenger','aquaStalk','snowCamo'], prey:{human:1.6},
  traits:['Largest land carnivore, actively hunts humans; 10 cm of fat under dense fur blunts bites and claws','Aquatic stalk: hidden under water until 7 m, then surges out for an ambush strike (x1.7)','Overheats fast anywhere warm, but swimming cools it; dominant in snow, and white on white it is hard to spot until 15 m']},
 {id:'croc', name:'Saltwater Crocodile', abbr:'CRO', price:200, mass:1000, spd:4.5, dmg:220, cd:1.2, armor:.6, reach:2.2, stam:5, heat:1.1, cold:.2, water:1, swim:5, aggr:.8, flee:.15, corner:1.2, pred:true, charge:false, vision:20, tags:['deathroll','waterbound','ambush'], prey:{human:1.3},
  traits:['Strongest bite measured: grabs and death-rolls in water','At home in water: almost invisible until 7 m. On land it is slow and tires fast, but the bite is just as deadly','Cold-blooded: never dealt on the tundra']},
 {id:'buffalo', name:'Cape Buffalo', abbr:'BUF', price:200, mass:750, spd:15, dmg:150, cd:1.2, armor:.4, reach:2.3, stam:20, heat:.9, cold:.6, water:.2, swim:1.5, aggr:.7, flee:.25, corner:1.5, pred:false, charge:true, vision:28, tags:['herd','vindictive','lionKiller'], rivals:{lion:3, tiger:1.8, hyena:1.6},
  traits:["'Black death': a wounded buffalo circles back for whoever hurt it, for a long time",'+50% damage against lions, tigers and hyenas','Without a herd, it fights alone']},
 {id:'bison', bluffP:0.3, name:'American Bison', abbr:'BIS', price:300, mass:900, spd:15, dmg:140, cd:1.3, armor:.35, reach:2.3, stam:40, heat:.75, cold:1, water:.2, swim:1.5, aggr:.5, flee:.3, corner:1.8, pred:false, charge:true, vision:28, tags:['herd','standsGround','bluff'],
  traits:['Injures more Yellowstone visitors than any other animal','Tail up, mock charge, then the real thing; spins on a dime','Huge stamina; at home in snow']},
 {id:'grizzly', name:'Grizzly Bear', abbr:'GRZ', bluffP:.75, price:200, mass:320, spd:15, dmg:125, cd:.9, armor:.35, reach:2, stam:15, heat:.65, cold:.95, water:.3, swim:1.8, aggr:.6, flee:.25, corner:1.3, pred:true, charge:false, vision:30, hpMul:1.2, tags:['scavenger','bluff'], prey:{human:.5}, rivals:{polar:1.3, wolf:1.3, cougar:1.4},
  traits:['Very hard to kill (+20% durability)','Charges at 56 km/h, often a bluff; if it does not stop, it mauls','Takes kills from cougars and wolves']},
 {id:'tiger', name:'Bengal Tiger', abbr:'TIG', latchMax:4, price:100, mass:220, spd:17, dmg:125, cd:.9, armor:.1, reach:2, stam:6, heat:.75, cold:.65, water:.5, swim:2, aggr:.7, flee:.3, corner:1.3, pred:true, latch:true, charge:false, vision:30, tags:['catSense','ambush'], rivals:{leopard:1.6, cougar:1.6, jaguar:1.4}, prey:{human:1.4},
  traits:['Throat hold: latches onto prey up to 2.5x its mass','Ambush first strike (x1.7, x2 in forest)','Can leap onto an elephant (3.6 m)']},
 {id:'lion', name:'African Lion', abbr:'LIO', latchMax:3, price:100, mass:190, spd:20, dmg:105, cd:.9, armor:.15, reach:2, stam:5, heat:.95, cold:.55, water:-.3, swim:1.2, aggr:.65, flee:.35, corner:1.3, pred:true, latch:true, charge:false, vision:32, tags:['catSense','mane','pack','backLeap'], prey:{human:1.1}, rivals:{hyena:2.2, leopard:1.6, cougar:1.5},
  traits:['Fastest sprint here (74 km/h in GPS-collar studies): rushes in and leaps the last 5 m','Pride hunter: leaps onto the back of a buffalo-sized animal while it is busy fighting someone else, and hangs on','Nervous alone; two males together hold their nerve and share the target','Kills hyenas on sight, and its mane is its best defense at the throat']},
 {id:'gorilla', name:'Silverback Gorilla', abbr:'GOR', price:100, mass:180, spd:11, dmg:110, cd:1.0, armor:.15, reach:2, stam:10, heat:.8, cold:.65, water:-.8, swim:.3, aggr:.35, flee:.4, corner:1.4, pred:false, charge:false, vision:25, climb:true, tags:['guardian','bluff','chestBeat'],
  traits:['Guardian: sticks closest to you, +40% damage against anything targeting you','Chest-beat: when something comes for you, it rears and drums its chest; everything close is rattled and turns on it instead','Bluffs first, but fights to the death for you once something comes for you','Too heavy to be much of a climber, and it cannot swim']},
 {id:'jaguar', name:'Jaguar', abbr:'JAG', latchMax:3.5, price:100, mass:100, spd:16, dmg:85, cd:.9, armor:.05, reach:1.8, stam:6, heat:.9, cold:.5, water:.8, swim:2, aggr:.6, flee:.35, corner:1.3, pred:true, latch:true, charge:false, vision:28, climb:true, pierce:.5, tags:['catSense','ambush','caimanHunter','swimStalk'], rivals:{croc:1.6}, prey:{human:.3},
  traits:['Skull-crushing bite that ignores half of armor','Swims with only its head showing: unseen in water until 7 m, it ambushes from the water and lies low again','Hunts crocodiles: a bite to the skull (×1.5 vs the croc); rarely attacks people']},
 {id:'wolf', name:'Gray Wolf', abbr:'WLF', price:100, mass:45, spd:16, dmg:40, cd:.7, armor:.05, reach:1.6, stam:60, heat:.7, cold:1, water:.2, swim:1.5, aggr:.5, flee:.5, corner:1.3, pred:true, charge:false, vision:35, tags:['hamstring','pack','tester'], prey:{human:.3},
  traits:['Hamstring bites slow the target','A lone wolf tests big prey: it nips at a herbivore coming your way, then lopes off just ahead of it, leading the chase away from you',"A pack takes on prey ten times one wolf's size; alone it is nervous"]},
 {id:'cougar', name:'Cougar', abbr:'CGR', latchMax:4, yieldsTo:['grizzly','polar','blackbear','wolf','smilodon'], price:100, mass:60, spd:18, dmg:55, cd:.8, armor:.05, reach:1.8, stam:5, heat:.8, cold:.85, water:-.2, swim:1.2, aggr:.45, flee:.6, corner:1.3, pred:true, latch:true, charge:false, vision:30, climb:true, tags:['catSense','ambush','riderSnatcher','napeBite'], prey:{human:.8},
  traits:['Comes from behind: a pounce on prey that is not facing it ends in a bite to the back of the neck (x1.5, stuns)','Huge leap (5 m): can reach a rider or a tree','Gives way to bears, and to wolves that come as a pack']},
 {id:'hyena', name:'Spotted Hyena', abbr:'HYE', price:100, mass:60, spd:16, dmg:60, cd:.8, armor:.1, reach:1.6, stam:50, heat:.9, cold:.6, water:.1, swim:1.5, aggr:.55, flee:.45, corner:1.3, pred:true, charge:false, vision:35, pierce:.3, hpMul:1.3, tags:['scavenger','boneCrush','pack'], prey:{human:1.0}, rivals:{lion:1.3},
  traits:['Bone-crushing bite ignores 30% of armor and cracks bone: every bite leaves a limp that never wears off (up to -30% speed), and it runs lamed prey down','Tough (+30% durability) and tireless: a clan runs prey down','Clan hunter, not a scavenger: kills most of its own food and eats fast']},
 // ---- added Oct 2026 (no portrait yet: shown as a lettered token) ----
 {id:'blackrhino', bluffP:0.3, name:'Black Rhino', abbr:'BRH', price:300, mass:1200, spd:15, swim:1, dmg:160, cd:1.3, armor:.5, reach:2.3, stam:12, heat:.8, cold:.5, water:0, aggr:.8, flee:.1, corner:1.4, pred:false, charge:true, vision:15, tags:['blindCharger','bluff'],
  traits:['The irritable rhino: half the weight of a white rhino, twice the temper','Charges anything that moves within 18 m, though some charges veer off at the last moment','Hooked lip, sharp front horn, turns quickly for a rhino']},
 {id:'bull', name:'Fighting Bull', abbr:'TOR', price:100, mass:550, spd:15.5, swim:1.5, dmg:150, cd:1.2, armor:.25, reach:2.2, stam:14, heat:.8, cold:.7, water:.2, aggr:.95, flee:.1, corner:1.4, pred:false, charge:true, vision:25, tags:['bred','chasesMovement'],
  traits:['Toro bravo: bred for centuries to charge, it never needs provoking','Charges whatever moves, then turns fast and comes back','Tires in a long fight']},
 {id:'moose', name:'Moose', abbr:'MOO', price:200, mass:600, spd:15.5, swim:2.5, dmg:140, cd:1.0, armor:.15, reach:2.2, stam:30, heat:.5, cold:1, water:.6, aggr:.5, flee:.3, corner:1.5, pred:false, charge:true, vision:25, tags:['standsGround','stomp'],
  traits:['Injures more people than bears do in Alaska','Stands its ground and stomps: front hooves rain down on anything small or knocked down','Long legs: at home in deep snow, a strong swimmer; suffers in heat']},
 {id:'ostrich', name:'Ostrich', abbr:'OST', price:100, mass:120, spd:19, swim:.8, dmg:110, cd:1.0, armor:.05, reach:1.5, stam:30, heat:1.1, cold:.6, water:-.3, aggr:.35, flee:.45, corner:1.4, pred:false, charge:false, vision:55, tags:['lookout','kicker','clawKick'],
  traits:['Fastest runner on two legs (70 km/h), and it can keep it up','Forward kick with a 10 cm toe claw: rips predators open (they bleed) and knocks them back; it kicks whatever comes for you up close','Huge eyes on a 2.7 m frame: a lookout, and a fast (if wobbly) mount']},
 {id:'honeybadger', name:'Honey Badger', abbr:'HBD', price:100, mass:11, spd:8.5, swim:1, dmg:22, cd:.6, armor:.35, reach:1.2, stam:40, heat:.9, cold:.5, water:-.2, aggr:.9, flee:.02, corner:1.3, pred:true, charge:false, vision:20, hpMul:1.5, tags:['fearless','hamstring','looseSkin','musk'], prey:{human:.1},
  traits:['Fearless once fighting: its morale never breaks; wary of big predators, it picks fights with its own size','Musk: a predator that gets hold of it gets a blast from its stink glands and reels away (once every 12 s)','Thick loose skin: it twists out of holds, and its bites on the legs keep rattling whatever it pesters']},
 {id:'triceratops', name:'Triceratops', abbr:'TRI', price:800, mass:8000, spd:8, swim:1.2, dmg:300, cd:1.5, armor:.5, reach:3.2, stam:15, heat:.8, cold:.6, water:.3, aggr:.6, flee:.1, corner:1.3, pred:false, charge:true, vision:25, rare:true, tags:['hatesPredators','giant'],
  traits:['Rare: only turns up on the odd board','Eight tonnes, a bony frill and two 1 m brow horns','Rideable 3 m up; charges like a rhino the size of an elephant']},
 {id:'mammoth', bluffP:0.35, name:'Woolly Mammoth', abbr:'MAM', price:500, mass:6000, spd:7, swim:1.5, dmg:260, cd:1.6, armor:.4, reach:3.6, stam:20, heat:.4, cold:1, water:.5, aggr:.55, flee:.15, corner:1.3, pred:false, charge:true, vision:40, rare:true, tags:['hatesPredators','giant','sweep','bluff'],
  traits:['Rare: only turns up on the odd board','An elephant in a fur coat: shrugs off the cold, wilts in the heat','Huge curved tusks sweep everything in reach; rideable 3.2 m up']},
 {id:'blackbear', name:'Black Bear', abbr:'BBR', bluffP:.7, bluffHumanP:.1, price:100, mass:120, spd:13.5, swim:1.8, dmg:75, cd:.9, armor:.25, reach:1.8, stam:15, heat:.7, cold:.9, water:.4, aggr:.35, flee:.4, corner:1.6, pred:true, charge:false, vision:25, climb:true, tags:['scavenger','bluff','repeatBluff'], prey:{human:.4},
  traits:['Bouncer: huffs, pops its jaws and bluff-charges animals up to three times before it fights (a person it hunts for real); anything its size it rattles is run off','Bolts up the nearest tree when it is in trouble','Fights hard when cornered']},
 {id:'leopard', name:'Leopard', abbr:'LEO', latchMax:2.5, yieldsTo:['lion','tiger','hyena'], price:100, mass:70, spd:16, swim:1.5, dmg:70, cd:.9, armor:.05, reach:1.8, stam:6, heat:.95, cold:.6, water:.4, aggr:.6, flee:.4, corner:1.6, pred:true, latch:true, charge:false, vision:30, climb:true, tags:['catSense','ambush','hiddenGuard'], prey:{human:.9},
  traits:['Cover-to-cover ambusher (x1.7, x2 in forest); climbs after you','On guard it lies up in cover beside you: the other side cannot see it beyond 6 m, so predators walk into its ambush','Gives way to lions, tigers and hyenas','Deadliest of the big cats when wounded or cornered']},
 {id:'boar', name:'Wild Boar', abbr:'BOA', price:100, mass:150, spd:13, swim:1.5, dmg:75, cd:.8, armor:.3, reach:1.6, stam:20, heat:.6, cold:.85, water:.4, aggr:.7, flee:.2, corner:1.6, pred:false, charge:true, vision:20, tags:['standsGround','slash','upends'],
  traits:['A big male: tusks slash at thigh height and leave bleeding wounds','Low charge that bowls over anything up to 2.5x its weight (and knocks a cat off whatever it is holding)','A shield of thick skin and gristle over the shoulders','Hard to put down, and fights hardest when cornered']},
 {id:'giantkangaroo', name:'Giant Kangaroo', abbr:'GKA', price:100, mass:230, spd:9, swim:1.5, dmg:110, cd:1.0, armor:.1, reach:2.1, stam:18, heat:1, cold:.5, water:.4, aggr:.4, flee:.35, corner:1.5, pred:false, charge:false, vision:35, rare:true, tags:['boxer','kicker','drowner','thumper'],
  traits:['Rare: Procoptodon, the Ice Age short-faced kangaroo (230 kg, 2–2.7 m tall)','Grabs with long clawed arms, then leans back for a crushing two-footed kick (a blunt hoof, not a claw)','Backs into water and holds attackers under, like kangaroos do to dogs','Thumps the ground when it spots a predator; strides rather than bounces, hopping only in bursts']},
 {id:'smilodon', name:'Sabre-toothed Cat', abbr:'SAB', latchMax:3.5, price:100, mass:260, spd:14, swim:1.3, dmg:95, cd:1.0, armor:.15, reach:2, stam:4, heat:.85, cold:.7, water:-.1, aggr:.6, flee:.3, corner:1.3, pred:true, latch:true, charge:false, vision:30, rare:true, tags:['catSense','ambush','pinStab','bigGame'], rivals:{lion:1.5, hyena:1.3, tiger:1.2, wolf:1.2}, prey:{human:1.1},
  traits:['Rare: Smilodon fatalis, the Ice Age sabre-tooth (260 kg)','Pins prey with huge forearms, then one killing stab that leaves it bleeding','Fragile sabres: stabbing armor or prey that isn\'t held can snap a canine']},
];
// Fighting styles: how each animal moves and attacks. strikeH = highest point it can hit (m); mountH = rider height if it can carry you (0 = can't).
const STYLE = {
 elephant:{gait:'lumber', strikeH:5, mountH:3.2, style:'Bulldozer', how:'Wades in steadily. Every strike is a trunk-and-tusk sweep that also hits everything else within reach.'},
 rhino:{gait:'charge', strikeH:1.6, mountH:1.9, overshoot:9, turn:.15, wheel:1.6, style:'Battering ram', how:'Locks onto a line and charges blind. Barely steers, overshoots by 9 m, then wheels around slowly.'},
 hippo:{gait:'charge', strikeH:1.6, mountH:1.7, overshoot:2, maxRun:12, turn:.6, wheel:1.8, style:'Burst charger', how:'Explosive 12 m rushes, then has to stop and blow before the next one.'},
 giraffe:{gait:'keepaway', strikeH:2.2, mountH:2.7, style:'Kicker', how:'Holds attackers at leg length and kicks. Never closes in.'},
 polar:{gait:'lumber', strikeH:3, mountH:1.6, maul:true, style:'Heavy brawler', how:'Plods straight in and rears up; every third swipe is a full maul. In a river it swims submerged and surges out at prey on the bank.'},
 croc:{gait:'lunge', strikeH:1.2, mountH:0, style:'Ambush lunger', how:'Lies dead still, then lunges 6 m in half a second and clamps on.'},
 buffalo:{gait:'charge', strikeH:1.8, mountH:1.8, overshoot:4, turn:.9, wheel:.7, style:'Hooking charger', how:'Charges, drives through, and hooks straight back for another pass.'},
 bison:{gait:'charge', strikeH:1.8, mountH:2.0, overshoot:5, turn:1.4, wheel:.5, style:'Spinning charger', how:'Charges and pivots on a dime. The most agile heavyweight.'},
 grizzly:{gait:'lumber', strikeH:2.8, mountH:1.5, maul:true, style:'Brawler', how:'Bulls straight in; every third swipe is a full maul.'},
 tiger:{gait:'stalk', strikeH:3.6, mountH:1.2, pounce:9, style:'Stalker', how:'Creeps in low and slow, then pounces from 9 m.'},
 lion:{gait:'rush', strikeH:3, mountH:1.2, pounce:5, style:'Sprinter', how:'Fastest sprint here: closes to ~30 m, then rushes in and leaps the last 5 m; jumps onto the back of big prey that is busy with someone else.'},
 gorilla:{gait:'lumber', strikeH:2.4, mountH:0, style:'Bluffer', how:'Beats its chest at anything coming for you, drawing it onto itself; bluff-charges first and fights for real only if that fails; cornered, it just bites.'},
 jaguar:{gait:'stalk', strikeH:2.8, mountH:0, pounce:7, style:'Stalker', how:'Creeps in, or swims in with only its head showing, then pounces from 7 m for a skull bite.'},
 wolf:{gait:'orbit', strikeH:1.4, mountH:0, dart:1.1, style:'Harrier', how:'Circles at a distance, darts in to bite the legs, then backs out. Alone, it nips big prey and leads it off on a chase.'},
 cougar:{gait:'stalk', strikeH:5, mountH:0, pounce:12, style:'Leaper', how:'Stalks, then leaps from 12 m (the longest pounce on the board), lands from behind and bites the back of the neck.'},
 hyena:{gait:'orbit', strikeH:1.4, mountH:0, dart:1.5, style:'Harrier', how:'Circles tirelessly and darts in; every bite cracks bone, and it runs lamed prey down.'},
 blackrhino:{gait:'charge', strikeH:1.5, mountH:1.6, overshoot:7, turn:.4, wheel:1.0, style:'Short-fused ram', how:'Snorts, charges at anything it hears or glimpses, wheels around faster than its big cousin.'},
 bull:{gait:'charge', strikeH:1.7, mountH:1.6, overshoot:5, turn:1.2, wheel:.6, style:'Relentless charger', how:'Charges, hooks, spins and charges again. Never stops coming until it tires.'},
 moose:{gait:'charge', strikeH:2.4, mountH:2.0, overshoot:3, turn:1.0, wheel:.8, style:'Stomper', how:'Short charge, then rears up and rains front-hoof strikes.'},
 ostrich:{gait:'keepaway', strikeH:1.3, mountH:1.4, style:'Kickboxer', how:'Outruns trouble; whatever comes at it, or at you up close, gets a forward kick that rips it open with a dagger claw.'},
 honeybadger:{gait:'lumber', strikeH:.8, mountH:0, style:'Pest', how:'Trundles in at things its own size and bites the ankles; grab it and you get a face full of musk.'},
 smilodon:{gait:'stalk', strikeH:3, mountH:1.2, pounce:6, style:'Sabre-tooth', how:'Creeps close and springs from 6 m, wrestles its prey down, drives in its sabres, then lets go and waits for it to bleed out.'},
 giantkangaroo:{gait:'keepaway', strikeH:2.3, mountH:0, style:'Kickboxer', how:'Grabs what gets close, rocks back and kicks with both feet; chased by a predator, it backs into water and holds it under.'},
 mammoth:{gait:'lumber', strikeH:5, mountH:3.2, style:'Ice-age bulldozer', how:'Wades in steadily; every strike is a tusk-and-trunk sweep that also hits everything else within reach.'},
 blackbear:{gait:'lumber', strikeH:2.2, mountH:0, style:'Bluffer', how:'Huffs, pops its jaws and bluff-charges again and again, running off anything its size; brawls for real only when it has to.'},
 leopard:{gait:'stalk', strikeH:3.5, mountH:0, pounce:7, style:'Stalker', how:'Creeps in close under cover, then pounces from 7 m for the throat. On guard it lies hidden beside you and springs on whatever comes for you.'},
 boar:{gait:'charge', strikeH:1.0, mountH:0, overshoot:3, turn:1.5, wheel:.4, style:'Slasher', how:'Short, low charges that bowl over anything its size, a sideways slash of the tusks, then spins and comes again.'},
 triceratops:{gait:'charge', strikeH:2.4, mountH:3.0, overshoot:6, turn:.3, wheel:1.5, style:'Living battering ram', how:'Lowers its frill and charges; brow horns at the height of a lion\'s chest.'},
};
ANIMALS.forEach(a => Object.assign(a, STYLE[a.id]));
// Pack items: the same species, but one pick brings several. A board deals a species solo or as a pack, never both.
for (const [id, n, groupName, price, suffix, dealWeight, rare] of [['wolf', 4, 'Wolf pack', 100, null, 3], ['wolf', 6, 'Great wolf pack', 200, 'pack6', .3, true], ['hyena', 4, 'Hyena clan', 100], ['lion', 2, 'Lion coalition', 200], ['buffalo', 3, 'Buffalo herd', 700, 'herd'], ['bison', 3, 'Bison herd', 700, 'herd']])
  ANIMALS.push(Object.assign({}, ANIMALS.find(a => a.id === id), Object.assign({id: id + (suffix || 'pack'), species: id, group: n, groupName, price, dealWeight: dealWeight || 1}, rare ? {rare: true, traits: ['Rare: six wolves hunting as one', 'They circle, test and hamstring until the biggest prey goes down', 'Endless stamina; nervous only if the pack breaks up']} : {})));
const HUMAN = {id:'human', name:'You', abbr:'YOU', price:0, mass:75, spd:6.5, dmg:6, cd:1, armor:0, reach:1.2, stam:8, heat:1, cold:.6, water:-.5, aggr:0, flee:0, corner:1, pred:false, charge:false, vision:35, swim:1, strikeH:1.8, mountH:0, gait:'human', climb:true, tags:[]};
const BY_ID = {}; ANIMALS.forEach(a => BY_ID[a.id] = a); BY_ID.human = HUMAN;

const TERRAINS = {
 savanna:{id:'savanna', name:'Savanna', amb:1.0, heatRamp:true, shade:6, hazard:'fire', desc:'Open and baking. The sun climbs as the fight goes on, so heat builds for everyone; big bodies cook first. A few acacias give shade worth fighting over. After 30 seconds a grass fire closes in from the edges.'},
 river:{id:'river', name:'River', amb:.75, water:{x0:47, x1:57, fords:[[9,18],[47,56]]}, hazard:'flood', desc:'A river splits the field and the other side starts across it. Crocs and hippos hold the water, and everyone else has to swim it slowly. Two shallow fords are the only fast crossings, and a charge founders in deep water. After 30 seconds flood water closes in from the edges; swimmers shrug it off.'},
 forest:{id:'forest', name:'Forest', amb:.55, trees:30, vision:.55, hazard:'fire', desc:'Trees block sight and slow big bodies. Cats ambush for double damage, and a charger that hits a tree is stunned. You can climb a tree. After 30 seconds a forest fire closes in from the edges.'},
 tundra:{id:'tundra', name:'Tundra', amb:.08, cold:true, snow:true, hazard:'blizzard', desc:'Deep snow and cold. Heavy animals flounder (an elephant moves at about half speed), and the cold drains stamina. Polar bear, wolf, bison and cougar move freely. After 30 seconds a blizzard closes in from the edges.'},
};

// ---------- utils ----------
function rng(seed){ let a = seed >>> 0; return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const radiusOf = m => 0.18 * Math.cbrt(m) + 0.9;
const hpOf = s => Math.round(22 * Math.pow(s.mass, 0.6) * (s.hpMul || 1));
const has = (u, t) => u.s.tags.includes(t);

// ---------- map variants ("freshness") ----------
// Each map varies a little from game to game, drawn from its own rng stream so the fight's w.R sequence is untouched.
// A variant holds the world's water bodies: band = the river (x0, x1, fords), ponds = ellipses {x, y, rx, ry, cold}.
const HOME_PT = {x: 22, y: 36};
function baseVariant(tid){
  const T = TERRAINS[tid] || TERRAINS.savanna;
  return { terrain: T.id, on: false, band: T.water ? {x0: T.water.x0, x1: T.water.x1, fords: T.water.fords.map(f => f.slice())} : null,
    ponds: [], clearing: null, trees: T.trees || 0, shade: T.shade || 0, snow: 1, hasWater: !!T.water, features: [], note: null, key: T.id + ':base' };
}
const pondK = (p, x, y) => Math.hypot((x - p.x) / p.rx, (y - p.y) / p.ry);
function mkPond(R, tid, kind, xr, yr, rxr, ryr, cold){
  // keep it clear of where you start and off the edges
  for (let i = 0; i < 40; i++){
    const p = {kind, x: xr[0] + R() * (xr[1] - xr[0]), y: yr[0] + R() * (yr[1] - yr[0]), rx: rxr[0] + R() * (rxr[1] - rxr[0]), ry: ryr[0] + R() * (ryr[1] - ryr[0]), cold: !!cold};
    const k = pondK(p, HOME_PT.x, HOME_PT.y), d = Math.hypot(HOME_PT.x - p.x, HOME_PT.y - p.y) * (1 - 1 / Math.max(k, 1e-6));
    if (d >= 10 && p.y - p.ry > 4 && p.y + p.ry < H - 4) return p;
  }
  return null;
}
function mapVariant(tid, seed){
  const v = baseVariant(tid);
  const R = rng(((seed || 1) ^ 0x9e3779b9) >>> 0);
  v.on = true; const notes = [];
  if (v.terrain === 'savanna'){
    v.shade = 5 + Math.floor(R() * 3); // 5-7 acacias
    if (R() < .45){ const p = mkPond(R, tid, 'waterhole', [42, 56], [16, 50], [4.5, 6.5], [3.2, 4.6], false); if (p){ v.ponds.push(p); v.features.push('waterhole'); notes.push('A waterhole lies near the middle of the savanna.'); } }
  } else if (v.terrain === 'river'){
    const c = 52 + (R() - .5) * 3, wd = 8.5 + R() * 3; // river width 8.5-11.5 m around the usual 10
    v.band.x0 = +(c - wd / 2).toFixed(2); v.band.x1 = +(c + wd / 2).toFixed(2);
    const fa = 13.5 + (R() - .5) * 6, wa = 7 + R() * 3, fb = 51.5 + (R() - .5) * 6, wb = 7 + R() * 3;
    v.band.fords = [[fa - wa / 2, fa + wa / 2], [fb - wb / 2, fb + wb / 2]].map(f => f.map(n => +n.toFixed(2)));
    const third = R() < .35, fc = 32.5 + (R() - .5) * 6, wc = 4.5 + R() * 2;
    if (third){ v.band.fords.splice(1, 0, [+(fc - wc / 2).toFixed(2), +(fc + wc / 2).toFixed(2)]); v.features.push('third ford'); notes.push('The water is low: a third, narrow ford has opened mid-river.'); }
    if (wd > 10.8) notes.push('The river runs wide today.'); else if (wd < 9.2) notes.push('The river runs narrow today.');
  } else if (v.terrain === 'forest'){
    v.trees = 22 + Math.floor(R() * 17); // 22-38 trees
    if (v.trees >= 34) notes.push('The forest is thick here.'); else if (v.trees <= 26) notes.push('Open woodland: the trees are thinner here.');
    if (R() < .4){ v.clearing = {x: 36 + R() * 28, y: 18 + R() * 30, r: 8 + R() * 4}; v.features.push('clearing'); notes.push('There is a clearing in the trees.'); }
    if (R() < .3){ const p = mkPond(R, tid, 'pool', [32, 68], [12, 54], [3.8, 5.5], [3, 4.4], false); if (p){ v.ponds.push(p); v.features.push('pool'); notes.push('A forest pool lies among the trees.'); } }
  } else if (v.terrain === 'tundra'){
    const sr = R(); v.snow = sr < .25 ? 1.2 : sr < .5 ? .75 : 1;
    if (v.snow > 1){ v.features.push('deep snow'); notes.push('The snow is deep today.'); } else if (v.snow < 1){ v.features.push('light snow'); notes.push('The snow is shallow and wind-packed.'); }
    if (R() < .45){ const p = mkPond(R, tid, 'lake', [42, 62], [14, 52], [6.5, 9.5], [4.5, 6.5], true); if (p){ v.ponds.push(p); v.features.push('frozen lake'); notes.push('A half-frozen lake: open water so cold it saps the strength of anything that swims in it.'); } }
  }
  v.hasWater = !!v.band || v.ponds.length > 0;
  v.note = notes.length ? notes.join(' ') : null;
  v.key = v.terrain + ':' + (seed || 1) + ':' + JSON.stringify([v.band, v.ponds, v.clearing, v.trees, v.shade, v.snow]);
  return v;
}
function variantFor(cfg){
  if (cfg.variant && typeof cfg.variant === 'object') return cfg.variant;
  const tid = (TERRAINS[cfg.terrain] || TERRAINS.savanna).id;
  if (cfg.variant === false) return baseVariant(tid);
  return mapVariant(tid, cfg.mapSeed != null ? cfg.mapSeed : (cfg.seed || 1));
}

function mkUnit(s, side, x, y, id){
  const hp = hpOf(s);
  return { id, s, side, x, y, vx:0, vy:0, hp, maxhp:hp, r:radiusOf(s.mass), stam:1, heat:0, morale:1, state:'idle',
    target:null, idleT: side === 'E' ? 6 : 0, atk:0, stun:0, latchOn:null, latchedBy:null, slow:0, slowT:0, hunger:.45, sated:false,
    grudge:null, grudgeT:0, agit:s.aggr*.4, fleeT:0, cornerT:0, ambushReady:has({s},'ambush') || has({s},'aquaStalk'), bluffed:{}, riding:null, rider:null,
    feud:null, feudT:0, mv:null, pounceCd:0, chargeCd:0, dartT:0, strikes:0, orbitDir:1, onTree:null, climbT:0, carcass:null, feedT:0, heatstroke:false, retargetT:0, homeDx:0, homeDy:0, escaped:false,
    st:{dealt:0, foe:0, taken:0, kills:0, protect:0, alive:0}, killedBy:null, deathT:null, lastHitBy:null };
}

// ---------- migration perks (cfg.boons) ----------
// Each boon is a small, realistic edge for you (the human) or your side. Only read when cfg.boons is set.
const BOONS = {
  spear: {name: 'Spear', desc: 'Your own strikes do double damage.'},
  waterskin: {name: 'Waterskin', desc: 'You build up 30% less heat.'},
  snowshoes: {name: 'Snowshoes', desc: 'Snow slows you half as much.'},
  whistle: {name: "Ranger's whistle", desc: 'Your guards break off and close on anything coming for you, even from their posts.'},
  smoke: {name: 'Smoke pots', desc: 'The other side starts rattled: morale -0.1 for the first 45 s.'},
  hide: {name: 'Thick hide coat', desc: 'You take 15% less damage from blows.'},
  dressing: {name: 'Field dressing', desc: 'Between fights, everyone heals 20% more of their wounds.'},
  tower: {name: 'Lookout tower', desc: 'Your side spots threats 20% farther away.'},
};
function boonMods(ids){
  const on = k => ids.includes(k);
  return {dmg: on('spear') ? 2 : 1, heat: on('waterskin') ? .7 : 1, snow: on('snowshoes') ? .5 : 1, whistle: on('whistle'), smoke: on('smoke') ? .1 : 0, hide: on('hide') ? .85 : 1, see: on('tower') ? 1.2 : 1};
}

// ---------- progressive-mode levels and scars (cfg.levels, cfg.maxHp; opt-in, absent = the plain game) ----------
// cfg.levels = {id: 0-3}: experience, not superpowers. 1 Seasoned: morale breaks later (flee threshold x.75) and a fallen
// packmate shakes it half as much; 2 Cunning: +15% sight range; 3 Veteran: +10% damage, +10% max health. Levels stack.
// cfg.maxHp = {id: multiplier | [multiplier per surviving member]}: lasting scars (-10% each). Your side only.
const LEVEL_FX = {flee: .75, shaken: .5, see: 1.15, dmg: 1.1, hp: 1.1};
function progMods(cfg, aid, u, k){
  const lv = (cfg.levels && cfg.levels[aid]) || 0, mh = cfg.maxHp && cfg.maxHp[aid], m = Array.isArray(mh) ? mh[k] : mh;
  if (lv > 0) u.lv = lv;
  const f = (lv >= 3 ? LEVEL_FX.hp : 1) * (m != null ? clamp(m, .1, 2) : 1);
  if (f !== 1){ u.maxhp *= f; u.hp = u.maxhp; }
}

// ---------- world setup ----------
function setup(cfg){
  // the live game's learned policies (policy/live.js) apply unless the cfg brings its own movePolicy or sets livePolicy:false
  if (cfg.movePolicy === undefined && cfg.livePolicy !== false && INTERNALS.moveChoose && Object.values(INTERNALS.LIVE).some(v => v)){
    const mp = {}; for (const k of Object.keys(INTERNALS.LIVE)) if (INTERNALS.LIVE[k]) mp[k] = INTERNALS.LIVE[k]; // any archetype with shipped weights
    cfg = Object.assign({}, cfg, {movePolicy: mp});
  }
  // cfg: {team:[ids], placements:{id:{dx,dy}}, terrain, mode:'wild'|'allout', ride:bool, seed, board:[ids] (optional: only these animals are in the game)}
  const R = rng(cfg.seed || 1);
  const T = TERRAINS[cfg.terrain] || TERRAINS.savanna;
  const V = variantFor(cfg);
  const w = { sig:{}, t:0, lastPress:0, T, mode:cfg.mode || 'wild', units:[], carcasses:[], trees:[], events:[], R, over:false, result:null, cfg, nid:0, frames:null };
  if (cfg.boons && cfg.boons.length) w.bn = boonMods(cfg.boons); // migration perks (opt-in; absent = the plain game)
  // the world's water bodies: the river band (river map) and any ponds this game's variant adds
  w.variant = V; w.band = V.band; w.ponds = V.ponds; w.wet = !!(V.band || V.ponds.length); w.coldWater = V.ponds.some(p => p.cold); w.snowDepth = V.snow;
  const human = mkUnit(HUMAN, 'H', 22, 36, w.nid++); human.atk = 0; w.units.push(human); w.human = human;
  w.shade = [];
  { const hp = homeFor(T.id); human.x = hp.x; human.y = hp.y; }
  if (cfg.human){ const p = clampPlace(T.id, HUMAN, cfg.human.x, cfg.human.y, V); human.x = p.x; human.y = p.y; }
  human.home = {x: human.x, y: human.y};
  if (cfg.humanHp != null) human.hp = human.maxhp * clamp(cfg.humanHp, .01, 1); // migration: your wounds carry over
  // nothing grows in a pond or a clearing
  const open = (x, y, m) => (V.clearing && Math.hypot(x - V.clearing.x, y - V.clearing.y) < V.clearing.r) || V.ponds.some(p => pondDist(p, x, y) < m);
  // trees
  if (V.trees){
    let tries = 0;
    while (w.trees.length < V.trees && tries++ < 500){
      const t = {x:6 + R()*(W-12), y:6 + R()*(H-12), r:1 + R()*1.2};
      if (V.on && open(t.x, t.y, t.r + 1.5)) continue;
      if (Math.hypot(t.x-human.x, t.y-human.y) < 7 && Math.hypot(t.x-human.x, t.y-human.y) > 4.5 && !w.trees.some(o=>Math.hypot(o.x-human.x,o.y-human.y)<7)) { w.trees.push(t); continue; }
      if (w.trees.some(o => Math.hypot(o.x-t.x, o.y-t.y) < 7)) continue;
      if (Math.hypot(t.x-human.x, t.y-human.y) < 5) continue;
      w.trees.push(t);
    }
  }
  if (V.shade){
    let tries = 0;
    while (w.shade.length < V.shade && tries++ < 300){
      const t = {x:8 + R()*(W-16), y:8 + R()*(H-16), r:3.6 + R()*1.4};
      if (V.on && open(t.x, t.y, t.r + 1)) continue;
      if (w.shade.some(o => Math.hypot(o.x-t.x, o.y-t.y) < 16)) continue;
      if (Math.hypot(t.x-human.x, t.y-human.y) < 9) continue;
      w.shade.push(t);
    }
  }
  const team = cfg.team || [];
  const mountId = cfg.mount !== undefined ? cfg.mount : (cfg.ride ? 'elephant' : null);
  team.forEach((aid, i) => {
    const s = BY_ID[aid];
    let p = cfg.placements && cfg.placements[aid];
    if (!p){ const dp = defaultPost(T.id, aid, V); p = dp ? {dx: dp.x - human.x, dy: dp.y - human.y} : defaultPlacement(team, aid, i); }
    const pos = clampPlace(T.id, s, human.x + p.dx, human.y + p.dy, V);
    const u = mkUnit(s, 'P', pos.x, pos.y, w.nid++);
    // migration carry-over: startHp[id] = a fraction, or one fraction per surviving member of a pack/herd (its length is the group size)
    const hp0 = cfg.startHp && cfg.startHp[aid], hpAt = k => Array.isArray(hp0) ? hp0[k] : hp0, nGroup = Array.isArray(hp0) ? Math.max(1, hp0.length) : groupSize(cfg, s);
    if (cfg.levels || cfg.maxHp) progMods(cfg, aid, u, 0);
    if (hp0 != null) u.hp = u.maxhp * clamp(hpAt(0), .01, 1);
    u.homeDx = pos.x - human.x; u.homeDy = pos.y - human.y; u.agit = .5;
    if (Math.hypot(u.homeDx, u.homeDy) > ESCORT_R && aid !== mountId) u.post = {x: pos.x, y: pos.y};
    w.units.push(u);
    if (aid === mountId && s.mountH > 0){ u.x = human.x; u.y = human.y; u.homeDx = 0; u.homeDy = 0; u.post = null; u.rider = human; human.riding = u; w.mount = u; }
    // a group item (wolf pack, hyena clan, lion pride) brings its packmates, placed around the leader
    for (let k = 1; k < nGroup; k++){
      const a = k * 2.4, q = clampPlace(T.id, s, pos.x + Math.cos(a) * 2.2, pos.y + Math.sin(a) * 2.2, V), m = mkUnit(s, 'P', q.x, q.y, w.nid++);
      if (cfg.levels || cfg.maxHp) progMods(cfg, aid, m, k);
      if (hp0 != null) m.hp = m.maxhp * clamp(hpAt(k), .01, 1);
      m.homeDx = q.x - human.x; m.homeDy = q.y - human.y; m.agit = .5; if (u.post) m.post = {x: q.x, y: q.y};
      w.units.push(m);
    }
  });
  // enemies
  // the other side is every animal you didn't pick: from the whole roster, or only from this game's board (cfg.board)
  const enemies = ANIMALS.filter(a => !team.includes(a.id) && (cfg.board ? cfg.board.includes(a.id) : !a.species));
  enemies.forEach(s => {
    let x, y, ok = false, tries = 0;
    while (!ok && tries++ < 300){
      x = (w.mode === 'allout' ? 68 : 50) + R()*(w.mode === 'allout' ? 28 : 44); y = 5 + R()*(H-10);
      const B = w.band;
      if (B){
        if (s.water >= .9){ x = B.x0 + 2 + R() * (B.x1 - B.x0 - 4); if (inFord(w, y)) continue; }
        else { x = B.x1 + 5 + R() * (W - B.x1 - 9); }
      } else if (s.water >= .9 && V.ponds.length){
        // swimmers start in a pond on the other side's half when there is one
        const ps = V.ponds.filter(p => p.x + p.rx * .5 > 48);
        if (ps.length){
          const p = ps[Math.floor(R() * ps.length)]; x = Math.max(p.x, 48); y = p.y;
          for (let j = 0; j < 12; j++){ const a = R() * Math.PI * 2, k = Math.sqrt(R()) * .7, px = p.x + Math.cos(a) * p.rx * k; if (px >= 48){ x = px; y = p.y + Math.sin(a) * p.ry * k; break; } }
        }
      }
      if (s.id === 'croc' && !B && !(V.ponds.length && pondAt(w, x, y))) { x = 60 + R()*30; }
      ok = !w.units.some(u => Math.hypot(u.x-x, u.y-y) < (tries < 200 ? 9 : 5)) && !w.trees.some(t => Math.hypot(t.x-x, t.y-y) < t.r + 3);
    }
    for (let k = 0; k < groupSize(cfg, s); k++){ // packmates arrive together
      let gx = x, gy = y;
      if (k){ const a = R() * 6.283; gx = clamp(x + Math.cos(a) * 3, 3, W - 3); gy = clamp(y + Math.sin(a) * 3, 3, H - 3); }
      const u = mkUnit(s, 'E', gx, gy, w.nid++); w.units.push(u);
      if (w.mode === 'allout'){ u.releaseT = 0; }
      u.atk = R()*1; u.agit = Math.max(u.agit, .4 + R()*.2);
    }
  });
  w.units.forEach(u => { u.ambushReady = has(u, 'ambush') || has(u, 'aquaStalk'); u.orbitDir = R() < .5 ? 1 : -1; u.dartT = R() * 1.5; });
  if (w.bn && w.bn.smoke) for (const u of w.units) if (u.side === 'E') u.morale -= w.bn.smoke;
  if (w.mode === 'allout'){
    const es = w.units.filter(u => u.side === 'E');
    for (let i = es.length - 1; i > 0; i--){ const j = Math.floor(R() * (i + 1)); [es[i], es[j]] = [es[j], es[i]]; }
    es.forEach((u, i) => { u.releaseT = 1 + i * 9; u.penned = true; u.x = W - 2; u.y = 6 + (i % 6) * 10.8; });
  }
  // closing arena: a themed hazard (fire / flood / blizzard) closes in from the edges toward a point near mid-field
  if (T.hazard && w.mode === 'wild' && cfg.hazard !== false) w.zone = {kind: T.hazard, cx: W / 2 + (R() - .5) * 16, cy: H / 2 + (R() - .5) * 12};
  w.zb = zoneAt(w, 0);
  if (V.on && V.note) log(w, V.note, 'info');
  return w;
}

const ESCORT_R = 9, POST_R = 14;
// how many animals one pick brings (pack items bring their whole group); sp() = the species behind an item
function groupSize(cfg, s){ return s.group || 1; }
const sp = s => s.species || s.id;
// v (optional, all four helpers): this game's map variant from mapVariant(); omitted = the base map
const varOf = (tid, v) => v || baseVariant((TERRAINS[tid] || TERRAINS.savanna).id);
function zoneFor(tid, v){ v = varOf(tid, v); return {x0: 2, x1: v.band ? v.band.x1 : 45, y0: 2, y1: H - 2}; }
function homeFor(tid){ const T = TERRAINS[tid] || TERRAINS.savanna; return T.water ? {x: 16, y: 33} : {x: 22, y: 36}; }
// where an animal may stand at deployment: inside your zone; only swimmers may start in deep water
function placeOK(tid, s, x, y, v){
  v = varOf(tid, v); const z = zoneFor(tid, v), B = v.band;
  if (x < z.x0 || x > z.x1 || y < z.y0 || y > z.y1) return false;
  if (B && x >= B.x0 && x <= B.x1 && !B.fords.some(([a, b]) => y >= a && y <= b)) return s.water >= .8;
  if (v.ponds.some(p => pondK(p, x, y) <= 1)) return s.water >= .8;
  return true;
}
function clampPlace(tid, s, x, y, v){
  v = varOf(tid, v);
  const z = zoneFor(tid, v); x = clamp(x, z.x0, z.x1); y = clamp(y, z.y0, z.y1);
  if (!placeOK(tid, s, x, y, v)){
    const p = v.ponds.find(p => pondK(p, x, y) <= 1);
    if (p){ // step out onto the bank
      let dx = x - p.x, dy = y - p.y, k = pondK(p, x, y); if (k < 1e-3){ dx = -p.rx; dy = 0; k = 1; }
      const f = (1 + 1.6 / Math.min(p.rx, p.ry)) / k; x = clamp(p.x + dx * f, z.x0, z.x1); y = clamp(p.y + dy * f, z.y0, z.y1);
      if (pondK(p, x, y) <= 1){ x = p.x - p.rx - 1.6; y = clamp(y, z.y0, z.y1); }
    } else if (v.band) x = v.band.x0 - 1.5;
  }
  return {x, y};
}
// swimmers start in the water by default: on the river, croc lurking beside a ford and hippo holding the deep water;
// on other maps, in a pond that reaches into your side
function defaultPost(tid, aid, v){
  v = varOf(tid, v);
  if (aid !== 'croc' && aid !== 'hippo') return null;
  if (v.band){
    const W0 = v.band, mid = (W0.x0 + W0.x1) / 2;
    if (aid === 'croc') return {x: W0.x0 + 2.5, y: W0.fords[0][1] + 3};
    return {x: mid, y: (W0.fords[0][1] + W0.fords[1][0]) / 2};
  }
  const z = zoneFor(tid, v);
  for (const p of v.ponds){
    const q = {x: p.x - p.rx * (aid === 'croc' ? .6 : .3), y: p.y};
    if (q.x <= z.x1) return q;
  }
  return null;
}
function defaultPlacement(team, aid, i){
  // biggest units in front (toward enemies, +x), guardians close, small on flanks/behind
  const sorted = [...team].sort((a,b) => BY_ID[b].mass - BY_ID[a].mass);
  const k = sorted.indexOf(aid), n = sorted.length;
  const s = BY_ID[aid];
  if (s.tags.includes('guardian')) return {dx:2.5, dy:-2.5};
  const ring = s.mass > 1500 ? 7 : s.mass > 400 ? 6 : 5;
  const spread = Math.PI * 1.25;
  const ang = n === 1 ? 0 : -spread/2 + spread * (k/(n-1));
  return {dx: Math.cos(ang)*ring, dy: Math.sin(ang)*ring};
}

// ---------- closing arena ----------
// The safe area shrinks from the whole field (t < ZONE_T0) to a ZONE_W x ZONE_H box (t >= ZONE_T1).
const ZONE_T0 = 30, ZONE_T1 = 180, ZONE_W = 36, ZONE_H = 24; // owner: close in earlier to cut idle time
const HAZARD_NAME = {fire: 'fire', flood: 'flood water', blizzard: 'blizzard'};
function zoneAt(w, t){
  const z = w.zone; if (!z) return null;
  const p = clamp((t - ZONE_T0) / (ZONE_T1 - ZONE_T0), 0, 1), e = p * p * (3 - 2 * p);
  return {x0: (z.cx - ZONE_W / 2) * e, x1: W + (z.cx + ZONE_W / 2 - W) * e, y0: (z.cy - ZONE_H / 2) * e, y1: H + (z.cy + ZONE_H / 2 - H) * e, p};
}
function outsideZone(w, u){ const z = w.zb; return !!z && z.p > 0 && (u.x < z.x0 || u.x > z.x1 || u.y < z.y0 || u.y > z.y1); }
function hazardHurt(w, u, dmg){
  u.hp -= dmg; u.st.taken += dmg;
  if (u.hp > 0) return;
  if (u.side === 'H'){ u.hp = 0; u.state = 'dead'; u.deathT = w.t; log(w, `You were caught by the ${HAZARD_NAME[w.zone.kind]}`, 'death', u); w.over = true; w.result = {survived:false, t:w.t, score:w.t, killer:w.zone.kind}; return; }
  kill(w, u, null);
}
// ---------- helpers ----------
// 0 while above half health, rising to 1 at death: badly hurt animals are slower and hit softer
function wound(u){ return clamp((.5 - u.hp / u.maxhp) / .5, 0, 1); }
// locked in a fight right now (in contact with its target, or latched)
function busy(u){ return !!(u.latchOn || u.latchedBy || (u.target && active(u.target) && dist(u, u.target) < u.r + u.target.r + u.s.reach + 1.5)); }
// pack (predators) and herd (buffalo, bison) animals bond only with their own kind
const social = u => has(u, 'pack') || has(u, 'herd');
function packMate(u, o){ return o !== u && o.side === u.side && social(o) && active(o) && sp(o.s) === sp(u.s); }
// strength of an animal plus its packmates close by: a pack takes on prey none of them could alone
function packStrength(w, u){ let s = strength(u); if (social(u)) for (const o of w.units) if (packMate(u, o) && dist(u, o) < 15) s += strength(o); return s; }
// gives way to: the species in its yieldsTo list (a cougar to bears, and to wolves only when they come as a pack)
function yieldsTo(w, u, o){ const l = u.s.yieldsTo; if (!l || !l.includes(sp(o.s))) return false; return sp(o.s) !== 'wolf' || packMates(w, o) > 0; }
function packMates(w, u){ let n = 0; for (const o of w.units) if (packMate(u, o) && dist(u, o) < 15) n++; return n; }
// signature-move counter (for the identity audit): w.sig['tiger:pounce'] = how many times it happened this fight
function sig(w, u, name){ if (!u || !u.s || u.side === 'H') return; const k = u.s.id + ':' + name; w.sig[k] = (w.sig[k] || 0) + 1; u.st.sig = (u.st.sig || 0) + 1; } // u.st.sig: per-unit count (progressive-mode XP; stats only)
function strength(u){ return Math.sqrt(Math.max(1,u.hp) * (u.s.dmg / u.s.cd)); }
function pressure(w){ return w.mode === 'wild' ? Math.min(1, w.t / 150) : 1; }
// water: w.band is the river (vertical band x0..x1 with shallow fords), w.ponds are ellipses; w.wet = any water at all
function inFord(w, y){ return w.band.fords.some(([a, b]) => y >= a && y <= b); }
function inBand(w, x){ return x >= w.band.x0 && x <= w.band.x1; }
function pondDist(p, x, y){ const k = pondK(p, x, y); return k <= 1 ? 0 : Math.hypot(x - p.x, y - p.y) * (1 - 1 / k); }
function pondAt(w, x, y){ for (const p of w.ponds) if (pondK(p, x, y) <= 1) return p; return null; }
function nearestPond(w, u){ let b = null, bd = 1e9; for (const p of w.ponds){ const d = pondDist(p, u.x, u.y); if (d < bd){ bd = d; b = p; } } return b; }
function inWater(w, u){ return !!(w.band && inBand(w, u.x) && !inFord(w, u.y)) || (w.ponds.length > 0 && !!pondAt(w, u.x, u.y)); }
function inColdWater(w, u){ if (!w.coldWater) return false; const p = pondAt(w, u.x, u.y); return !!(p && p.cold); }
function onFord(w, u){ return !!(w.band && inBand(w, u.x) && inFord(w, u.y)); }
function bandDist(w, u){ const W0 = w.band; return u.x < W0.x0 ? W0.x0 - u.x : u.x > W0.x1 ? u.x - W0.x1 : (inFord(w, u.y) ? 1 : 0); }
function distWater(w, u){ let d = w.band ? bandDist(w, u) : 1e9; for (const p of w.ponds) d = Math.min(d, pondDist(p, u.x, u.y)); return d; }
// the nearest deep water to head for (to cool off, or for a waterbound animal); {band:true} = the river, keep your own y line
function waterPoint(w, u, toward){
  const p = nearestPond(w, u);
  if (w.band && !(p && pondDist(p, u.x, u.y) < bandDist(w, u))){ const W0 = w.band; let y = u.y; for (const [a, b] of W0.fords) if (y >= a - 2 && y <= b + 2) y = (y - a < b - y) ? a - 4 : b + 4; return {x: (W0.x0 + W0.x1) / 2, y: clamp(y, 3, H - 3), band: true}; }
  // a pond: the point well inside it nearest to where we want to be
  const o = toward || u, dx = o.x - p.x, dy = o.y - p.y, k = pondK(p, o.x, o.y);
  const f = k > .55 ? .55 / k : 1;
  return {x: p.x + dx * f, y: p.y + dy * f};
}
// keep a point within m metres of the water nearest to u (waterbound animals)
function nearWaterPt(w, u, pt, m){
  if (w.band){ pt.x = clamp(pt.x, w.band.x0 - m, w.band.x1 + m); return pt; }
  const p = nearestPond(w, u); if (!p || pondDist(p, pt.x, pt.y) <= m) return pt;
  const dx = pt.x - p.x, dy = pt.y - p.y, k = pondK(p, pt.x, pt.y), f = (1 + m / Math.max(4, Math.min(p.rx, p.ry)) * .8) / k;
  return {x: p.x + dx * f, y: p.y + dy * f};
}
// a nudge away from nearby deep water (you and evasive mounts keep clear of crocs); null when not near any
function awayWater(w, u){
  if (!w.wet || distWater(w, u) >= 6 || onFord(w, u)) return null;
  if (w.band && !(w.ponds.length && pondDist(nearestPond(w, u), u.x, u.y) < bandDist(w, u))) return {x: u.x < (w.band.x0 + w.band.x1) / 2 ? -1.5 : 1.5, y: 0};
  const p = nearestPond(w, u), dx = u.x - p.x, dy = u.y - p.y, m = Math.hypot(dx, dy) || 1;
  return {x: dx / m * 1.5, y: dy / m * 1.5};
}
function inShade(w, u){ return w.shade.some(t => Math.hypot(t.x - u.x, t.y - u.y) < t.r); }
function snowFactor(s){ if (['polar','wolf','cougar','moose'].includes(sp(s))) return 1; if (s.id === 'mammoth') return .75; if (s.id === 'bison') return .92; return clamp(1.05 - .25 * Math.log10(Math.max(50, s.mass) / 50), .5, .95); }
function heatLoad(s){ return Math.pow(s.mass / 400, .3) / Math.pow(s.heat, 2.2); }
function ambient(w){ return w.T.amb * (w.T.heatRamp ? Math.min(2.2, 1 + w.t / 110) : 1); }
function active(u){ return u.state !== 'dead' && !u.escaped && !u.penned; }
function heightOf(u){ return u.riding ? u.riding.s.mountH : u.onTree ? 4.5 : 0; }
function evasiveMount(u){ return !!u.rider && (u.s.mass < 700 || u.s.gait === 'keepaway'); }
function nameOf(u){ return u.side === 'H' ? 'You' : (u.side === 'P' ? 'your ' : 'the ') + u.s.name; }
function capName(u){ const n = nameOf(u); return n[0].toUpperCase() + n.slice(1); }
function log(w, text, kind, u){ w.events.push({t:+w.t.toFixed(1), text, kind:kind||'info', x:u?u.x:null, y:u?u.y:null}); }
function hostile(w, a, b){
  if (a === b || !active(b)) return false;
  const pa = a.side !== 'E', pb = b.side !== 'E';
  if (pa && pb) return false; // player team incl. human
  if (pa !== pb) return true;
  // both enemies
  if (w.mode === 'allout') return false;
  return a.feud === b || b.feud === a;
}
function reachable(att, t){
  const h = heightOf(t);
  if (h === 0) return true;
  if (t.onTree && att.s.climb) return true;
  return att.s.strikeH >= h;
}
function canSee(w, viewer, u){
  let range = viewer.s.vision * (w.T.vision || 1);
  if (w.bn && viewer.side !== 'E') range *= w.bn.see; // lookout tower
  if (viewer.lv >= 2) range *= LEVEL_FX.see; // Cunning: reads the field sooner
  if (viewer.side !== 'E' && w.lookout) range *= 1.5;
  else if (w.alarm && w.alarm[viewer.side === 'H' ? 'P' : viewer.side] > 0) range *= 1.25; // a kangaroo's thump put everyone on alert
  // big cats find each other by scent: a hidden cat is no secret to another cat
  if (has(viewer, 'catSense') && has(u, 'catSense')) return dist(viewer, u) <= range;
  if (has(u, 'ambush') && u.ambushReady && u.state !== 'flee' && w.T.id === 'forest') range = Math.min(range, 9);
  if (has(u, 'ambush') && u.ambushReady && u.state === 'engage' && w.T.id === 'savanna' && Math.hypot(u.vx, u.vy) < u.s.spd * .45) range = Math.min(range, 12); // creeping through tall grass
  if ((has(u, 'waterbound') || has(u, 'aquaStalk')) && inWater(w, u) && u.state !== 'flee') range = Math.min(range, 7);
  if (has(u, 'snowCamo') && w.T.snow && u.state !== 'flee') range = Math.min(range, 15);
  if (u.perch && u.onTree) range = Math.min(range, 6); // still in the branches
  if (has(u, 'submerges') && inWater(w, u) && u.state !== 'flee') range = Math.min(range, 10);
  if (has(u, 'swimStalk') && inWater(w, u) && u.state !== 'flee') range = Math.min(range, 7); // a jaguar swims with only its head showing
  if (hiddenGuard(u)) range = Math.min(range, 6); // your leopard lying up in cover beside you
  return dist(viewer, u) <= range;
}
// your leopard on guard and ready to ambush is lying up in cover: the other side doesn't see it (or count it as a guard) until it springs
function hiddenGuard(u){ return has(u, 'hiddenGuard') && u.side === 'P' && u.ambushReady && u.state === 'guard' && !u.onTree;
}
function teamSees(w, u){
  for (const a of w.units) if (a.side !== 'E' && active(a) && canSee(w, a, u)){
    if (w.lookout && !u.lookSpotted && dist(a, u) > a.s.vision * (w.T.vision || 1)){ u.lookSpotted = true; sig(w, w.units.find(o => o.side === 'P' && active(o) && has(o,'lookout')), 'lookout spots a threat'); } // only seen thanks to the lookout
    return true;
  }
  return false;
}

// ---------- targeting ----------
function guardsAround(w, t, me){
  if (t.side === 'E') return 0;
  let g = 0;
  for (const u of w.units){
    if (u === t || u === me || !active(u) || u.side === 'E' || u.state === 'flee' || hiddenGuard(u)) continue;
    if (dist(u, t) < 7) g += strength(u) * (busy(u) ? .5 : 1); // a guard already in a fight deters less
  }
  return g;
}
function predatorTarget(w, u){
  let best = null, bs = 0;
  const my = packStrength(w, u); // a pack hunts as one
  const expo = 0.3 + 0.4 * u.hunger;
  for (const t of w.units){
    if (!hostile(w, u, t)) continue;
    if (!canSee(w, u, t) && !(t.side === 'H' && dist(u, t) < 70)) continue;
    if (u.repelBy === t && u.repelUntil > w.t) continue; // musked: it wants nothing more to do with that honey badger
    const d = dist(u, t);
    if (has(u,'waterbound') && w.wet && distWater(w, t) > 5) continue; // a croc takes prey at the water's edge, never on open ground
    const ts = strength(t);
    let vuln = Math.min(4, Math.pow(my / ts, 1.2));
    let sc = Math.pow(t.s.mass, expo) * vuln;
    if (ts > my * 2.5 && u.grudge !== t) sc *= 0.05; // a honey badger too: wary, it bolts from lion tracks and fights when surprised (Begg)
    if (t.s.id === 'elephant' || has(t,'giant')) sc *= 0.1;
    if (t.side === 'H') sc *= (u.s.prey && u.s.prey.human) || 1;
    if (has(u,'riderSnatcher') && t.riding) sc *= 1.6; // a rider is just prey on a high perch to a cougar
    if (has(u,'bigGame') && t.s.mass >= 1.5 * u.s.mass && t.s.mass <= 4 * u.s.mass) sc *= 1.5; // a sabre-tooth's prey: bison, horses, camels
    if (has(u,'pinStab') && t.s.armor >= .45) sc *= .3; // sabres and armor don't mix
    if (w.mode === 'allout' && t.side === 'H') sc *= 6;
    if (t.side === 'E') sc *= 1.5; // a live feud gets settled first
    if (u.s.rivals && u.s.rivals[sp(t.s)]) sc *= u.s.rivals[sp(t.s)];
    if (yieldsTo(w, u, t)) sc *= 0.15;
    const g = guardsAround(w, t, u) / my;
    sc /= (1 + g * .45);
    if (!reachable(u, t)) continue;
    if (u.grudge === t && d < 8) sc *= 3;
    if (t.state === 'flee' || t.latchedBy) sc *= 1.3;
    if (has(u,'boneCrush') && t.limp) sc *= 1 + 3 * t.limp; // a hyena runs down what it has already lamed
    // opportunists: something already locked in a fight with one of ours, or badly hurt, is worth the risk
    if (t.side === 'P' && t.target && t.target !== u && busy(t)) sc *= 1.5;
    if (t.hp < t.maxhp * .6) sc *= 1 + (.6 - t.hp / t.maxhp) * 1.5;
    sc /= (1 + d / (t.side === 'H' ? 45 : 25));
    if (u.target === t) sc *= 1.25; // commitment
    if (has(u,'pack')) for (const o of w.units) if (packMate(u, o) && o.target === t && dist(o, u) < 25){ sc *= 1.5; break; } // hunt as a pack
    if (sc > bs){ bs = sc; best = t; }
  }
  return {t:best, score:bs};
}
function herbivoreTarget(w, u){
  if (w.mode === 'allout'){
    // assault the human, but fight whatever blocks or wounds it
    if (u.grudge && active(u.grudge) && dist(u, u.grudge) < 8) return u.grudge;
    let blocker = null, bd = 7;
    for (const t of w.units) if (t.side === 'P' && active(t)){ const d = dist(u,t); if (d < bd){ bd = d; blocker = t; } }
    if (blocker && w.R() < 0.8) return blocker;
    return reachable(u, w.human) ? w.human : (blocker || nearestPlayer(w,u));
  }
  let best = null, bs = 0;
  const dr = drive(u);
  let R = 20 + 16 * u.agit + 30 * pressure(w) + 60 * dr; // a crowd of intruders in its space: it notices and closes sooner
  if (has(u,'territorial') && inWater(w,u)) R += 8;
  if (has(u,'blindCharger')) R = Math.max(R, 18);
  for (const t of w.units){
    if (!hostile(w, u, t)) continue;
    if (u.repelBy === t && u.repelUntil > w.t) continue; // musked
    const d = dist(u, t);
    let sc = 0;
    if (u.grudge === t) sc = 5;
    if (sc === 0 && !canSee(w, u, t) && !(d < 30 + 50 * dr && (Math.hypot(t.vx, t.vy) > 2 || dr > .5))) continue; // poor-sighted grazers go by sound and smell (and by the noise of the fight, once restless)
    if (d > R && sc === 0){
      if (has(u,'hatesPredators') && t.s.pred && d < 20) sc = 1.5; else continue;
    }
    if (sc === 0){
      if (t.s.pred) sc = d < 12 || t.target === u ? 2 : .6 + u.agit; // mob a predator that's close or coming for it; one across the field is just another intruder
      else if (t.side === 'P') sc = .6 + u.agit;           // intruders: your team
      else if (t.side === 'H') sc = .35 + u.agit * .6 + .6 * dr; // you: a nuisance more than a target, until it has been kept waiting
      else sc = 1.5;                                        // an active feud
      if ((has(u,'blindCharger') || has(u,'chasesMovement')) && Math.hypot(t.vx, t.vy) > 2) sc += t.side === 'E' ? .4 : 1.5;
    }
    if (u.s.rivals && u.s.rivals[sp(t.s)]) sc *= u.s.rivals[sp(t.s)];
    if (has(u,'hatesPredators') && t.s.pred) sc *= 2;
    if (!reachable(u, t)) continue;
    if (t.s.id === 'elephant' || has(t,'giant')) sc *= 0.3;
    if (u.target === t) sc *= 1.3;
    if (has(u,'herd')) for (const o of w.units) if (packMate(u, o) && o.target === t && dist(o, u) < 25){ sc *= 1.5; break; } // the herd mobs together
    sc /= (1 + d / 10);
    if (sc > bs){ bs = sc; best = t; }
  }
  if (bs <= 0.08) return null;
  if (best !== u.target && Math.hypot(best.vx, best.vy) > 2){ if (has(u,'chasesMovement')) sig(w, u, 'chases movement'); else if (has(u,'blindCharger') && !canSee(w, u, best)) sig(w, u, 'charges blind at a sound'); }
  return best;
}
function nearestPlayer(w,u){ let b=null,bd=1e9; for(const t of w.units) if(t.side!=='E'&&active(t)){const d=dist(u,t); if(d<bd){bd=d;b=t;}} return b; }

// battle drive (owner: every animal is here to win the fight): time spent with nothing to do builds up, and the
// longer an animal has been idle the farther it looks for a fight and the readier it is to start one
function drive(u){ return clamp(((u.idleT || 0) - 3) / 12, 0, 1); }
// an enemy busy fighting one of ours (or you), close enough to be trading blows
function locked(e){ const t = e.target; return !!(t && t.side !== 'E' && active(t) && dist(e, t) < e.r + t.r + e.s.reach + 2); }
function allyTarget(w, u){
  const H = w.human;
  const anchor = u.post || H;
  const dr = u.rider ? 0 : drive(u);
  const leash = (u.post ? POST_R : u.rider ? 9 : has(u,'guardian') ? 12 : 24) + 30 * dr;
  let best = null, bs = 0;
  const my = strength(u);
  for (const e of w.units){
    if (e.side !== 'E' || !active(e)) continue;
    if (u.repelBy === e && u.repelUntil > w.t) continue; // musked
    if (!teamSees(w, e) && !(u.post && dist(u, e) < 10)) continue;
    if (has(u,'waterbound') && w.wet && distWater(w, e) > 10) continue;
    const dh = dist(e, anchor), dm = dist(u, e);
    const called = !!(w.bn && w.bn.whistle && e.target === H && dist(e, H) < 25 && !u.rider); // ranger's whistle: anything coming for you within 25 m
    if (dh > leash && !(u.target === e && dh < leash + 8) && u.grudge !== e && !called) continue;
    // bodyguards deal with what is coming at your side; something minding its own business is left alone unless it gets close
    const v = Math.hypot(e.vx, e.vy), toward = v > 1.5 && ((anchor.x - e.x) * e.vx + (anchor.y - e.y) * e.vy) / ((dist(e, anchor) || 1) * v) > .7 && dh < 25;
    const coming = (e.target && e.target.side !== 'E') || toward; // aimed at us, or plainly heading our way
    let intent = e.target === H ? 1 : coming ? .5 : dh < 10 ? .25 : .04;
    if (u.post && (coming || dh < 8)) intent = Math.max(intent, .7);
    if (e.state === 'feed') intent = .04;
    if (e.state === 'flee' || e.heatstroke) intent = .02;
    if (e.sated && e.target !== H) intent *= .3;
    if (e.state !== 'flee' && !e.heatstroke) intent = Math.max(intent, .3 * dr); // bored guards go looking for trouble
    let threat = intent * strength(e) / (1 + dh / 10);
    const rawRatio = packStrength(w, u) / strength(e);
    if (rawRatio < .35 && dh > 6 && u.grudge !== e && !has(u,'guardian') && !has(u,'fearless') && !(has(u,'tester') && !packMates(w, u) && coming && !e.s.pred && e.s.mass <= 1000)) continue; // (a lone wolf tests moose- and bison-sized herbivores coming your way) // small guards don't pick fights with giants (a pack counts as one)
    const ratio = clamp(rawRatio, .25, 2.5);
    let sc = threat * Math.sqrt(ratio) / (1 + dm / 15);
    if (has(u,'guardian') && e.target === H) sc *= 2;
    if (called) sc *= 2;
    // a big cat on guard picks fights it can win: other predators, and things its size or smaller, above all
    // whatever is coming for you; a healthy tonne-plus herbivore is someone else's job
    if (u.s.pred && u.s.latch){ sc *= clamp(my / strength(e), .35, 2); if (e.s.pred) sc *= 1.5; if (e.target === H) sc *= 1.3;
      if (!e.s.pred && e.s.mass > 3 * u.s.mass && e.target !== H && !(has(u,'backLeap') && locked(e) && e.s.mass <= 6 * u.s.mass)) sc *= .15; } // a big herbivore locked in a fight with one of ours (or you): hit it from behind, the way lions take buffalo
    if (u.s.rivals && u.s.rivals[sp(e.s)]) sc *= Math.sqrt(u.s.rivals[sp(e.s)]);
    if (yieldsTo(w, u, e)) sc *= .3;
    if (has(u,'kicker') && !has(u,'boxer') && !(dm < 6 || u.grudge === e) && !(has(u,'clawKick') && e.target === H && dist(e, H) < 8)) sc *= .1; // a kangaroo on guard boxes whatever it's set on; it just doesn't hunt you on the other side
    if (!reachable(u, e)) sc *= .05;
    // spread coverage
    let others = 0; for (const a of w.units) if (a !== u && a.side === 'P' && active(a) && a.target === e && !(social(u) && packMate(u, a))) others++; // packmates and herdmates gang up rather than spread
    sc *= Math.pow(.6, others);
    if (u.grudge === e && dm < 6) sc *= 2;
    if (u.target === e) sc *= 1.3;
    if (sc > bs){ bs = sc; best = e; }
  }
  return bs > .5 * (1 - .5 * dr) ? best : null;
}

function bestCarcass(w, u){
  let best = null, bs = 0;
  for (const c of w.carcasses){
    if (c.meat <= 0) continue;
    const d = Math.hypot(c.x - u.x, c.y - u.y);
    if (d > 35) continue;
    const sc = u.hunger * (has(u,'scavenger') ? 1.7 : 1) * 10 / (1 + d / 20);
    if (sc > bs){ bs = sc; best = c; }
  }
  return {c:best, score:bs};
}

function chooseTarget(w, u){
  if (u.side === 'H') return;
  if (u.latchOn){ u.target = u.latchOn; return; }
  if (u.side === 'P'){
    if (evasiveMount(u)){ u.target = null; u.state = 'carry'; return; }
    if (u.withdrawn){ u.target = null; u.state = 'withdraw'; return; }
    u.target = allyTarget(w, u);
    if (u.gT && active(u.gT)) u.target = u.gT; // learned guard intent (policy/, cfg.movePolicy.guard): intercept / help / screen target
    u.state = u.target ? 'engage' : 'guard';
    return;
  }
  // enemies
  if (u.s.pred){
    if (u.sated && w.mode === 'wild' && drive(u) < .6){
      u.target = (u.grudge && active(u.grudge) && dist(u,u.grudge) < 6) ? u.grudge : null;
      u.state = u.target ? 'engage' : 'rest';
      return;
    }
    if (w.cfg.policy){ policyChoose(w, u); return; } // learned target selection (policy/), opt-in: off unless cfg.policy is given
    const h = predatorTarget(w, u);
    if (w.mode === 'wild' && u.hunger > .3 && !u.sated){
      const c = bestCarcass(w, u);
      if (c.c && c.score > h.score * 1.0){ u.target = null; u.carcass = c.c; u.state = 'feed'; return; }
    }
    u.carcass = null;
    u.target = h.score * (.4 + u.s.aggr) > .3 * (1 - .8 * drive(u)) ? h.t : null; // bold predators commit sooner, timid ones hang back
    if (u.cT){ if (w.t < u.cTT && active(u.cT) && hostile(w, u, u.cT)) u.target = u.cT; else u.cT = null; } // learned cat intent 'soften' (policy/), opt-in: holds the softer prey
    u.state = u.target ? 'engage' : 'roam';
  } else {
    u.target = herbivoreTarget(w, u);
    u.state = u.target ? 'engage' : 'roam';
  }
}

// ---------- damage ----------
function strike(w, a, t, opts){
  opts = opts || {};
  const s = a.s;
  const speedFrac = Math.hypot(a.vx, a.vy) / s.spd;
  let dmg = s.dmg * (0.85 + w.R() * 0.3);
  const massF = clamp(Math.pow(a.s.mass / t.s.mass, 0.2), .6, 1.6);
  dmg *= massF;
  dmg *= envFactor(w, a);
  dmg *= 0.65 + 0.35 * clamp(a.morale, 0, 1);
  dmg *= 1 - .2 * wound(a);
  if (a.cornerT > 0) dmg *= s.corner;
  let chargeF = 1;
  if (!opts.latch && speedFrac > .5) chargeF = 1 + (s.charge ? .7 : .25) * clamp((speedFrac - .5) / .5, 0, 1);
  dmg *= chargeF;
  const ambushes = has(a,"ambush") || (has(a,"aquaStalk") && (inWater(w, a) || a.wetLunge));
  a.wetLunge = false;
  if (ambushes && a.ambushReady && t.target !== a){ dmg *= w.T.id === "forest" ? 2 : 1.7; a.ambushReady = false; sig(w, a, 'ambush'); if (has(a,'swimStalk') && inWater(w, a)) sig(w, a, 'ambush from the water'); if (has(a,'hiddenGuard') && a.side === 'P' && t.target === w.human) sig(w, a, 'springs from hiding'); if (!opts.pounce) log(w, `${capName(a)} ambushes ${nameOf(t)}`, "ambush", a); }
  a.ambushReady = false;
  if (s.rivals && s.rivals[sp(t.s)] && has(a,'lionKiller')){ dmg *= 1.5; sig(w, a, 'lion killer'); }
  if (has(a,'vindictive') && a.grudge === t && a.grudgeT > 12) sig(w, a, 'grudge hit');
  if (s.pierce) sig(w, a, 'armor-piercing bite');
  if (has(a,'caimanHunter') && sp(t.s) === 'croc'){ dmg *= 1.5; sig(w, a, 'skull bite on a croc'); } // jaguars kill caimans with a bite to the back of the skull
  if (has(a,'guardian') && a.side === 'P' && t.target === w.human){ dmg *= 1.4; sig(w, a, 'guarding you'); }
  if (has(a,'deathroll') && opts.latch) dmg *= inWater(w, a) ? 2 : .5;
  // a kangaroo grabs with its forearms first (the target can't dart out), then the kick lands harder
  let clinched = false;
  if (has(a,'boxer') && !opts.latch && t.side !== 'H' && t.s.mass < a.s.mass && !t.latchedBy){
    if (a.clinch === t){ dmg *= 1.4; clinched = true; a.clinch = null; }
    else { dmg *= .6; a.clinch = t; t.stun = Math.max(t.stun, .7); sig(w, a, 'grabs'); }
  }
  // held under water: drowning on top of the hold
  if (has(a,'drowner') && opts.latch){ dmg = dmg * .5 + t.maxhp * .03 * s.cd; t.stam = Math.max(0, t.stam - .1); }
  if (opts.latch && has(a,'pinStab')) dmg *= .6; // wrestling it down, not throttling
  if (a.fangBroken) dmg *= .7;
  if (opts.stab) dmg *= 3;
  if (opts.latch){ dmg *= .65; if (has(t,'mane')) dmg *= .6; if (has(t,'looseSkin')) dmg *= .5; }
  if (opts.pounce){ dmg *= 1.4; sig(w, a, a.fromTree ? 'tree drop' : 'pounce'); }
  // a cougar comes from behind and bites the back of the neck (into the spine): prey that wasn't facing it is stunned
  let nape = false;
  if (opts.pounce && has(a,'napeBite') && t.target !== a && t.s.mass <= 5 * a.s.mass){
    let fx = t.vx, fy = t.vy; if (Math.hypot(fx, fy) < .5 && t.target && active(t.target)){ fx = t.target.x - t.x; fy = t.target.y - t.y; }
    const fm = Math.hypot(fx, fy), ax = a.x - t.x, ay = a.y - t.y, am = Math.hypot(ax, ay) || 1;
    if (fm < 1e-6 || (fx * ax + fy * ay) / (fm * am) < .2){ nape = true; dmg *= 1.5; sig(w, a, 'nape bite'); log(w, `${capName(a)} lands on ${nameOf(t)} from behind and bites the back of its neck`, 'ambush', a); }
  }
  if (has(a,'stomp') && (t.stun > 0 || t.s.mass < 150)){ dmg *= 1.5; sig(w, a, 'stomp'); } // front hooves on something small or down
  if (opts.sweep){ dmg *= .35; }
  if (s.maul && !opts.latch && !opts.sweep){ a.strikes++; if (a.strikes % 3 === 0){ dmg *= 2; sig(w, a, 'maul'); log(w, `${capName(a)} rears up and mauls ${nameOf(t)}`, 'maul', a); } }
  // surrounded: every extra attacker in contact makes each hit count more and armor less
  let mob = 0;
  for (const o of w.units) if (o !== t && active(o) && hostile(w, o, t) && (o.target === t || o.latchOn === t) && dist(o, t) <= o.r + t.r + o.s.reach + .5) mob++;
  mob = Math.max(1, mob);
  dmg *= Math.min(1.75, 1 + .15 * (mob - 1));
  // chargers are exposed while wheeling after a run, or when hit from behind mid-charge
  let flank = false;
  if (t.mv && (t.mv.k === 'wheel' || t.mv.k === 'charge')){
    if (t.mv.k === 'wheel') flank = true;
    else { const hx = t.mv.nx, hy = t.mv.ny, ax = a.x - t.x, ay = a.y - t.y, m = Math.hypot(ax, ay) || 1; if ((hx * ax + hy * ay) / m < -.3) flank = true; }
  }
  if (flank){ dmg *= 1.25; sig(w, a, 'flank'); if (w.R() < .3) log(w, `${capName(a)} catches ${nameOf(t)} side-on`, 'flank', t); }
  let armor = t.s.armor * (1 - (s.pierce || 0)) * (opts.latch || opts.stab || nape ? .5 : 1) * Math.max(.4, 1 - .1 * (mob - 1)) * (flank ? .5 : 1);
  if (t.s.id === 'croc') armor = inWater(w,t) ? Math.min(.8, armor + .1) : armor - .2;
  dmg *= (1 - armor);
  if (t.side === 'H' && t.riding) dmg *= 1;
  if (w.bn){ if (a.side === 'H') dmg *= w.bn.dmg; if (t.side === 'H') dmg *= w.bn.hide; } // spear, hide coat
  if (a.lv >= 3) dmg *= LEVEL_FX.dmg; // Veteran: practised technique
  dmg = Math.max(1, dmg);
  applyDamage(w, a, t, dmg);
  // secondary effects
  if (has(a,'boxer') && !opts.latch && t.state !== 'dead' && t.s.mass < 1.5 * a.s.mass && !t.latchedBy){ // the kick: a heavy blunt shove (it can't move something much bigger)
    const d = dist(a, t) || 1, kb = 1.5 * Math.min(1, a.s.mass / t.s.mass); t.x += (t.x - a.x) / d * kb; t.y += (t.y - a.y) / d * kb; t.stun = Math.max(t.stun, .4); sig(w, a, clinched ? 'clinch and kick' : 'two-footed kick'); }
  if (has(t,'musk') && t.state !== 'dead') musk(w, t, a);
  if (opts.stab && t.state !== 'dead'){ t.bleed = Math.max(t.bleed || 0, dmg * .08); t.bleedT = 8; t.bleedBy = a; }
  if (has(a,'slash') && t.state !== 'dead'){ sig(w, a, 'bleeding slash'); t.bleed = Math.max(t.bleed || 0, dmg * .12); t.bleedT = 5; t.bleedBy = a; } // tusk wounds keep bleeding
  if (nape && t.state !== 'dead') t.stun = Math.max(t.stun, 1.2);
  // an ostrich kicks forward and down: the 10 cm toe claw rips open whatever it hits and the blow knocks it back
  if (has(a,'clawKick') && !opts.latch && t.state !== 'dead' && t.s.mass <= 4 * a.s.mass){
    t.bleed = Math.max(t.bleed || 0, dmg * .15); t.bleedT = 6; t.bleedBy = a;
    if (t.side !== 'H' && !t.riding){ t.stun = Math.max(t.stun, .6); const d = dist(a, t) || 1; t.x += (t.x - a.x) / d * 1.2; t.y += (t.y - a.y) / d * 1.2; if (t.latchOn) release(w, t, 'kicked off'); }
    sig(w, a, 'claw kick'); if (w.R() < .3) log(w, `${capName(a)} rips ${nameOf(t)} open with its toe claw`, 'maul', t);
  }
  // a boar's low charge takes the legs out from under anything up to a couple of times its weight (and off whatever it was holding)
  if (has(a,'upends') && a.mv && a.mv.k === 'charge' && t.state !== 'dead' && heightOf(t) === 0 && t.s.mass <= 2.5 * a.s.mass){
    t.stun = Math.max(t.stun, 1); if (t.latchOn) release(w, t, 'bowled off');
    sig(w, a, 'upends'); log(w, `${capName(a)} hits ${nameOf(t)} low and bowls it over`, 'charge', t);
  }
  // a hyena's bite cracks bone: every bite on the legs leaves a limp that doesn't wear off (it runs prey down)
  if (has(a,'boneCrush') && !opts.sweep && t.state !== 'dead' && t.s.mass < 2500 && (t.limp || 0) < .4){ t.limp = Math.min(.4, (t.limp || 0) + .1); sig(w, a, 'cracks bone'); }
  if (has(a,'hamstring') && t.s.mass < 2500){ t.slow = Math.max(t.slow * (t.slowT > 0 ? 1 : 0), t.s.mass > 3 * a.s.mass ? .5 : .4); t.slowT = 6; sig(w, a, 'hamstring'); } // leg bites cripple big prey
  // knockback & stun from momentum
  if (!opts.latch && speedFrac > .55 && t.state !== 'dead'){
    const ratio = a.s.mass / t.s.mass;
    const kb = Math.min(7, ratio * speedFrac * s.spd * .12);
    if (kb > .4){
      const d = dist(a, t) || 1;
      t.x += (t.x - a.x) / d * kb; t.y += (t.y - a.y) / d * kb;
      if (ratio > 1.5){ t.stun = Math.max(t.stun, .5 + Math.min(1.2, ratio / 8)); }
      if (kb > 2.5){ sig(w, a, 'knockback'); } if (kb > 2.5) log(w, `${capName(a)} charges ${nameOf(t)}, knocking it back ${kb.toFixed(1)} m`, 'charge', t);
      if (t.latchedBy && ratio > .8){ release(w, t.latchedBy, 'thrown off'); }
    }
  }
  // rider dislodge
  if (t.rider && a.s.mass >= 150 && speedFrac > .6 && w.R() < .1 * Math.pow(clamp(a.s.mass / t.s.mass, 0, 2), 2) && t.state !== 'dead') throwRider(w, t, `${capName(a)} rammed it`, a);
  // latch attempt
  // lions on a buffalo: while it is busy with another of their side, one leaps on its back and hangs on (up to 6x its mass)
  const backLeap = has(a,'backLeap') && !t.s.pred && !t.rider && t.target && t.target !== a && (t.target.side !== 'E') === (a.side !== 'E') && t.s.mass <= 6 * s.mass && dist(t, t.target) < t.r + t.target.r + t.s.reach + 2;
  if (!opts.latch && !opts.sweep && s.latch && !a.latchOn && !t.latchedBy && t.state !== 'dead' && (t.s.mass <= (s.latchMax || 2.5) * s.mass || backLeap) && heightOf(t) === 0 && w.R() < (opts.pounce ? .7 : .45)){
    a.latchOn = t; t.latchedBy = a; sig(w, a, t.s.mass > (s.latchMax || 2.5) * s.mass ? 'leaps on its back' : 'hold');
    log(w, `${capName(a)} gets a hold on ${nameOf(t)}`, 'latch', t);
  }
  if (!opts.latch && has(a,'drowner') && !a.latchOn && !t.latchedBy && t.side !== 'H' && t.state !== 'dead' && t.s.mass < a.s.mass && inWater(w, t) && inWater(w, a) && w.R() < .6){
    a.latchOn = t; t.latchedBy = a; a.holdT = 2.5; sig(w, a, 'holds it under');
    log(w, `${capName(a)} pins ${nameOf(t)} and holds it under the water`, 'latch', t);
  }
  if (!opts.latch && has(a,'deathroll') && !a.latchOn && !t.latchedBy && t.state !== 'dead' && heightOf(t) === 0 && t.s.mass < 2500 && w.R() < (inWater(w, a) || inWater(w, t) ? .7 : .12)){
    a.latchOn = t; t.latchedBy = a; sig(w, a, inWater(w, a) ? 'death roll' : 'clamp');
    log(w, `${capName(a)} clamps its jaws on ${nameOf(t)}${inWater(w,a)?' and death-rolls':''}`, 'latch', t);
  }
}
// a honey badger turns its anal pouch out at a predator that bites it or closes in on it: the stench sends it reeling away,
// and it wants nothing more to do with that badger for a while (once every 12 s)
function musk(w, t, a){
  if (a.side === t.side || a.side === 'H' || !a.s.pred || has(a,'fearless') || t.muskAt > w.t - 12) return;
  t.muskAt = w.t; a.repelBy = t; a.repelUntil = w.t + 15; if (a.grudge === t) a.grudge = null;
  if (a.latchOn === t) release(w, a); if (a.target === t) a.target = null;
  a.mv = null; a.state = 'flee'; a.fleeT = 2.5 + w.R() * 1.5; a.stun = Math.max(a.stun, .5); a.morale -= .2;
  sig(w, t, 'musk'); log(w, `${capName(t)} turns out its stink glands and ${nameOf(a)} reels away`, 'bluff', t);
}
function sweep(w, a, main){
  let n = 0;
  for (const o of w.units){
    if (o === main || !hostile(w, a, o) || heightOf(o) > a.s.strikeH) continue;
    if ((o.x - a.x) * (main.x - a.x) + (o.y - a.y) * (main.y - a.y) < 0) continue; // trunk and tusks swing across the front, not behind
    if (dist(a, o) <= a.r + o.r + a.s.reach){ strike(w, a, o, {sweep:true}); n++; }
  }
  if (n){ sig(w, a, 'sweep'); log(w, `${capName(a)} sweeps ${n + 1} attackers at once`, 'sweep', a); }
}
function applyDamage(w, a, t, dmg){
  t.hp -= dmg; t.lastHitBy = a;

  a.st.dealt += dmg; t.st.taken += dmg; if (t.side !== 'E') a.st.foe += dmg; // foe: damage to your side (stat only)
  if (a.side === 'P' && t.target === w.human) a.st.protect += dmg;
  if (t.side !== 'H'){ t.grudge = a; t.grudgeT = has(t,'vindictive') ? 40 : has(a,'fearless') ? 25 : 12; }
  if (has(a,'fearless') && t.side !== 'H' && !has(t,'fearless')) t.morale -= .06; // a honey badger's harassment rattles even a lion // a honey badger's bites make it the thing you can't stop chasing
  t.agit = Math.min(1, t.agit + .25);
  for (const o of w.units) if (o.side === 'E' && active(o) && dist(o, t) < 15) o.agit = Math.min(1, o.agit + .04);
  if (t.hp <= 0) kill(w, t, a);
}
function kill(w, t, a){
  t.hp = 0; t.state = 'dead'; t.deathT = w.t; t.killedBy = a ? a.s.id : null;
  if (a) a.st.kills++;
  if (t.latchOn){ t.latchOn.latchedBy = null; t.latchOn = null; }
  if (t.latchedBy){ t.latchedBy.latchOn = null; t.latchedBy = null; }
  if (t.rider) throwRider(w, t, 'it went down', a);
  if (t.side === 'H'){
    log(w, `You were killed by ${nameOf(a)}`, 'death', t);
    w.over = true; w.result = {survived:false, t:w.t, score:w.t, killer:a ? a.s.id : null};
    return;
  }
  log(w, `${capName(t)} is down${a ? ' (' + nameOf(a) + ')' : ''}`, 'kill', t);
  const c = {x:t.x, y:t.y, meat:t.s.mass * .6, of:t.s.id};
  w.carcasses.push(c);
  if (a && a.s.pred && a.side === 'E' && w.mode === 'wild' && a.hunger > .2){ a.carcass = c; a.state = 'feed'; a.target = null; }
}
function release(w, a, why){
  if (!a.latchOn) return;
  const t = a.latchOn; t.latchedBy = null; a.latchOn = null; a.stun = Math.max(a.stun, .4);
  if (why) log(w, `${capName(a)} is ${why} by ${nameOf(t)}`, 'info', a);
}
function throwRider(w, mount, why, by){
  const h = mount.rider; if (!h) return;
  mount.rider = null; h.riding = null;
  h.x = mount.x + (w.R() - .5) * 4; h.y = mount.y + (w.R() - .5) * 4;
  h.stun = 1.5; applyDamage(w, by || mount, h, 8 + 6 * mount.s.mountH);
  log(w, `You are thrown from your ${mount.s.name} (${why})`, 'danger', h);
}

function envFactor(w, u){
  let f = 1;
  if (u.heat > .6) f *= Math.max(.35, 1 - (u.heat - .6) * 1.3);
  if (w.T.cold) f *= 1 - (1 - u.s.cold) * .55;
  const wet = inWater(w, u);
  if (wet && u.s.water >= .8) f *= 1.2;
  if (!wet && u.s.water >= .9 && w.band) f *= .85;
  return f;
}
function speedOf(w, u){
  let v = u.s.spd;
  if (u.stam < .15) v *= .45; // exhausted
  v *= envFactor(w, u) / (inWater(w, u) && u.s.water >= .8 ? 1.2 : 1); // the swimmer damage bonus is not a speed bonus
  const wet = inWater(w, u);
  if (wet){
    v *= (u.s.swim || 1) / u.s.spd; // swimming speed, with the same fatigue/heat/slow modifiers
    if (w.coldWater && inColdWater(w, u)) v *= .6 + .4 * u.s.cold; // near-freezing water stiffens anything not built for it
  }
  else if (onFord(w, u) && u.s.water < .8) v *= .8;
  if (has(u,'waterbound') && !(w.wet && distWater(w, u) < 4)){ // a croc on land: a burst out of the water, then a slow walk (its bite is as strong as ever)
    const dW = w.wet ? distWater(w, u) : 0;
    v *= dW > 10 ? .25 : .7; // walk 2-4 km/h, exhausted before 100 m (IUCN CSG, Locomotion); no water on the map: as before
  }
  if (w.T.id === 'forest' && u.s.mass > 800) v *= .78;
  if (w.T.snow){ let sf = snowFactor(u.s); if (w.bn && u.side === 'H') sf = 1 - (1 - sf) * w.bn.snow; v *= w.snowDepth === 1 ? sf : Math.max(.35, 1 - (1 - sf) * w.snowDepth); }
  if (u.slowT > 0) v *= (1 - u.slow);
  if (u.limp) v *= 1 - u.limp; // bones cracked by a hyena
  v *= 1 - .3 * wound(u); // badly hurt animals slow down
  if (w.zone && outsideZone(w, u) && w.zone.kind !== 'fire') v *= w.zone.kind === 'blizzard' ? .6 : (u.s.water >= .8 ? 1 : .5);
  if (u.latchedBy) v *= u.s.mass < 1.5 * u.latchedBy.s.mass ? .1 : .5;
  if (u.rider) v *= clamp(1 - .6 * 75 / u.s.mass, .6, 1);
  return v;
}

// ---------- per-tick update ----------
function step(w){
  const R = w.R;
  w.t += DT;
  w.lookout = w.units.some(u => u.side === 'P' && active(u) && has(u,'lookout'));
  if (!w.alarm) w.alarm = {P: 0, E: 0}; w.alarm.P -= DT; w.alarm.E -= DT;
  for (const u of w.units) if (u.penned && w.t >= u.releaseT){ u.penned = false; u.agit = 1; log(w, `Gate opens: ${nameOf(u)} is released`, 'gate', u); }
  const units = w.units;
  // hunger, timers
  for (const u of units){
    if (!active(u)) continue;
    u.st.alive += DT;
    if (u.s.pred) u.hunger = Math.min(1, u.hunger + .003 * DT);
    u.atk -= DT; u.stun = Math.max(0, u.stun - DT); u.slowT = Math.max(0, u.slowT - DT);
    u.grudgeT -= DT; if (u.grudgeT <= 0) u.grudge = null; else if (u.grudge && !active(u.grudge)) u.grudge = null;
    u.cornerT = Math.max(0, u.cornerT - DT);
    if (u.bleedT > 0){ u.bleedT -= DT; const b = u.bleed * DT; u.hp -= b; u.st.taken += b; if (u.bleedBy){ u.bleedBy.st.dealt += b; if (u.side !== 'E') u.bleedBy.st.foe += b; } if (u.hp <= 0){ kill(w, u, u.bleedBy); if (w.over) return; continue; } }
    u.pounceCd = Math.max(0, u.pounceCd - DT); u.chargeCd = Math.max(0, u.chargeCd - DT); u.dartT -= DT;
    if (u.mv && (u.state === 'flee' || u.heatstroke || u.latchedBy && u.mv.k !== 'wheel')) u.mv = null;
    u.agit = has(u,'bred') ? 1 : Math.max(u.s.aggr * .3, u.agit - .01 * DT); // a fighting bull is always worked up
    if (u.target && !active(u.target)) u.target = null;
    if (u.latchOn && !active(u.latchOn)) { u.latchOn = null; }
    if (!u.target && !u.latchOn && !u.latchedBy && (u.state === 'roam' || u.state === 'rest' || u.state === 'guard' || u.state === 'idle')) u.idleT = (u.idleT || 0) + DT; else u.idleT = Math.max(0, (u.idleT || 0) - 2 * DT); // a brief scuffle doesn't reset its patience
    if (has(u,'pinStab')){ u.pinT = u.latchOn ? (u.pinT || 0) + DT : 0; u.backT = Math.max(0, (u.backT || 0) - DT); if (u.stabbed && (!active(u.stabbed) || u.stabbed.state === 'flee')) u.backT = 0; if (!u.backT) u.circling = false; }
    if (u.latchOn && has(u,'drowner')){ u.holdT -= DT; if (u.holdT <= 0 || !inWater(w, u.latchOn)) release(w, u); }
    if (has(u,'thumper') && !u.thumped && active(u) && u.state !== 'dead'){ // foot-thump alarm: its side looks sharper for a while
      for (const o of units) if (o.s.pred && active(o) && hostile(w, u, o) && dist(u, o) < u.s.vision && canSee(w, u, o)){ u.thumped = true; w.alarm[u.side] = 8; sig(w, u, 'foot-thump alarm'); log(w, `${capName(u)} thumps the ground: predator!`, 'info', u); break; }
    }
    if (has(u,'musk') && !(u.muskAt > w.t - 12)) for (const o of units) if (active(o) && o.target === u && o.s.pred && dist(o, u) < u.r + o.r + 1.5){ musk(w, u, o); break; } // the tail goes up, then the spray
    // a silverback beats its chest at anything coming for its group (you, on your side): a deep, carrying display of its
    // size that rattles everything close by and turns their attention onto it instead
    if (has(u,'chestBeat') && !(u.beatAt > w.t - 12) && u.state !== 'flee' && !u.latchedBy && !u.heatstroke){
      const ward = u.side === 'P' ? w.human : u; let n = 0;
      for (const o of units) if (active(o) && hostile(w, o, u) && o.side !== 'H' && (o.target === ward || o.target === u) && dist(o, u) < 14 && dist(o, ward) < 18) n++;
      if (n){ u.beatAt = w.t; sig(w, u, 'chest-beat'); log(w, `${capName(u)} rears up and beats its chest`, 'bluff', u);
        for (const o of units) if (active(o) && hostile(w, o, u) && o.side !== 'H' && dist(o, u) < 14 && strength(o) < 2 * strength(u)){ o.morale -= .2; if (o.target === ward && !o.latchOn){ o.grudge = u; o.grudgeT = Math.max(o.grudgeT, 6); o.target = u; } } }
    }
    // an aquatic stalker that has slipped back under and stayed off prey for ~4 s can ambush again
    if (!u.ambushReady && (has(u,'aquaStalk') || has(u,'swimStalk')) && inWater(w, u) && u.atk < -4 && !u.latchedBy) u.ambushReady = true;
    // a cat that has been out of the action for a while (no strike for ~8 s, nothing after it) lies low and can ambush again
    if (!u.ambushReady && has(u,'ambush') && has(u,'catSense') && u.atk < -8 && !u.latchedBy && !u.latchOn && !units.some(o => o.target === u && active(o))) u.ambushReady = true;
  }
  // closing arena
  if (w.zone){
    w.zb = zoneAt(w, w.t);
    for (const u of units){
      if (!active(u) || u.riding || !outsideZone(w, u)) continue;
      const k = w.zone.kind;
      if (!u.hazardLogged){ u.hazardLogged = true; log(w, `${capName(u)} ${u.side === 'H' ? 'are' : 'is'} caught in the ${HAZARD_NAME[k]}`, 'heat', u); }
      if (k === 'fire'){ hazardHurt(w, u, u.maxhp * .025 * DT); u.heat = Math.min(1.4, u.heat + .04 * DT); }
      else if (k === 'blizzard'){ u.stam = Math.max(0, u.stam - .06 * DT); hazardHurt(w, u, u.maxhp * .012 * DT); }
      else if (k === 'flood' && u.s.water < .4) hazardHurt(w, u, u.maxhp * .015 * DT);
      if (w.over) return;
    }
  }
  // the other side is a team: pressure mounts over time, and only natural rivals ever flare up
  if (w.mode === 'wild'){
    const floor = Math.min(.95, .5 + w.t / 90);
    for (const u of units){
      if (!active(u) || u.side !== 'E') continue;
      if (!u.s.pred) u.agit = Math.max(u.agit, floor);
      if (u.feud){ u.feudT -= DT; if (u.feudT <= 0 || !active(u.feud)){ if (u.feud && active(u.feud)) log(w, `${capName(u)} and ${nameOf(u.feud)} break off their scrap`, 'info', u); u.feud = null; } continue; }
      if (!u.s.rivals) continue;
      for (const o of units){
        if (o === u || o.side !== 'E' || !active(o) || o.feud) continue;
        const k = u.s.rivals[sp(o.s)]; if (!k || k < 1.5) continue;
        if (dist(u, o) < 5 && R() < .025 * k * DT){
          u.feud = o; o.feud = u; u.feudT = o.feudT = 5 + R() * 4;
          log(w, `Old rivalry: ${nameOf(u)} turns on ${nameOf(o)}`, 'feud', u); break;
        }
      }
    }
  }
  // heat
  for (const u of units){
    if (!active(u)) continue;
    const sp = Math.hypot(u.vx, u.vy) / u.s.spd;
    let exert = sp * sp + (u.state === 'engage' && u.target && dist(u,u.target) < u.r + u.target.r + u.s.reach + 1 ? .5 : 0) + (u.latchOn || u.latchedBy ? .5 : 0);
    if (u.riding) exert = 0;
    const shaded = w.shade.length && inShade(w, u);
    const amb = ambient(w) * (shaded ? .35 : 1);
    let gain = amb * exert * .016 * heatLoad(u.s) / .9;
    if (has(u,'sunburn') && !inWater(w,u)) gain += .012 * amb;
    if (w.bn && u.side === 'H') gain *= w.bn.heat; // waterskin
    let cool = Math.max(0, .012 * (1 - amb * .5)) + (inWater(w,u) ? .09 : 0) + (exert < .15 ? .008 : 0) + (shaded ? .02 : 0);
    if (w.T.id === 'forest') cool += .004;
    u.heat = clamp(u.heat + (gain - cool) * DT, 0, 1.4);
    if (!u.heatstroke && u.heat >= 1.05 && u.side !== 'H'){
      u.heatstroke = true; release(w, u);
      log(w, `${capName(u)} is overheating and pulls out of the fight`, 'heat', u);
      if (u.rider){ const h = u.rider; u.rider = null; h.riding = null; h.x = u.x - 2; h.y = u.y; h.stun = .6; log(w, `Your ${u.s.name} kneels to cool off and you have to climb down`, 'danger', h); }
    } else if (u.heatstroke && u.heat < .55){ u.heatstroke = false; log(w, `${capName(u)} has cooled down`, 'info', u); }
    // stamina
    const chill = w.T.cold ? 1 - u.s.cold : 0;
    if (sp > .55) u.stam = Math.max(0, u.stam - DT / u.s.stam * sp * (1 + 1.5 * chill));
    else u.stam = Math.min(1, u.stam + (DT / (u.s.stam * 1.5) * .9 + DT * .02) * (1 - .6 * chill));
    if (w.coldWater && !u.riding && inColdWater(w, u)) u.stam = Math.max(0, u.stam - .05 * DT * (1.15 - u.s.cold)); // swimming in near-freezing water saps strength fast
  }
  // morale
  for (const u of units){
    if (!active(u) || u.side === 'H') continue;
    if (u.side === 'P' && !(u.st.low <= u.hp / u.maxhp)) u.st.low = u.hp / u.maxhp; // lowest health this fight (progressive-mode scars; stats only)
    const my = strength(u);
    let fear = 0, friends = 0;
    for (const o of units){
      if (o === u || !active(o)) continue;
      const d = dist(u, o);
      if (d > 15) continue;
      if (hostile(w, o, u) && (o.target === u || o.latchOn === u)) fear += strength(o);
      if (o.side === u.side && u.side === 'P' && d < 10) friends++;
    }
    let tgt = 1 - .85 * (1 - u.hp / u.maxhp) - .3 * Math.max(0, fear / my - 1);
    if (social(u)){ const m = packMates(w, u); tgt += m ? Math.min(.2, .1 * m) : has(u,'pack') ? -.12 : 0; } // a lone pack hunter is nervous (a lone buffalo is just grumpy); together they're bold
    // a loss shakes its own kind (packmates, herdmates) and anything that saw it fall close by; a rhino doesn't
    // lose its nerve because a wolf died across the field
    let fallen = 0;
    for (const o of units){
      if (o.side !== u.side || o === u || !(o.state === 'dead' || o.escaped)) continue;
      if (sp(o.s) === sp(u.s)) fallen += 1; else if (o.state === 'dead' && dist(o, u) < 15) fallen += .4;
    }
    tgt -= (u.side === 'E' ? .05 : .03) * fallen * (u.lv >= 1 ? LEVEL_FX.shaken : 1);
    if (u.side === 'E' && u.state !== 'flee') tgt += .25 * pressure(w);
    if (w.bn && w.bn.smoke && u.side === 'E' && w.t < 45) tgt -= w.bn.smoke; // smoke pots
    if (u.side === 'P') tgt += Math.min(.25, friends * .06);
    if (u.s.yieldsTo) for (const o of units) if (active(o) && hostile(w,o,u) && yieldsTo(w, u, o) && dist(o,u) < 10) tgt -= .25;
    if (has(u,'standsGround') && u.hp < u.maxhp * .95 && u.grudge) tgt += .25;
    if (has(u,'fearless')) tgt = Math.max(tgt, .8);
    if (has(u,'vindictive') && u.grudge && active(u.grudge)) tgt += .3; // it does not give up on whoever hurt it
    if (has(u,'guardian') && u.side === 'P' && units.some(e => e.side === 'E' && active(e) && e.target === w.human && dist(e, u) < 15)) tgt = Math.max(tgt, .8); // fights to the death for you
    u.morale += (tgt - u.morale) * Math.min(1, .6 * DT);
    if (u.state !== 'flee' && u.cornerT <= 0 && u.morale < u.s.flee * (u.lv >= 1 ? LEVEL_FX.flee : 1) && u.fleeT <= 0 && !u.withdrawn){
      u.state = 'flee'; u.fleeT = 4 + R() * 4; release(w, u); u.mv = null;
      u.breaks = (u.breaks || 0) + 1;
      if (u.rider && R() < (u.state === 'carry' && !u.latchedBy ? .15 : .5)) throwRider(w, u, 'it panicked and bolted'); // a mount already running with you mostly just runs faster; one that's grabbed bucks
      const broken = u.breaks >= (u.side === 'E' ? 2 : 3) || u.hp < u.maxhp * .3;
      if (broken && u.side === 'E' && w.mode === 'wild' && !u.routing){ u.routing = true; log(w, `${capName(u)} is beaten and makes for the edge`, 'flee', u); }
      else if (broken && u.side === 'P'){ u.withdrawn = true; log(w, `${capName(u)} is too badly hurt to fight and falls back`, 'flee', u); }
      else log(w, `${capName(u)} breaks and runs`, 'flee', u);
    }
  }
  // decisions
  for (const u of units){
    if (!active(u) || u.side === 'H') continue;
    if (u.state === 'flee'){
      // a climber on the run goes up the nearest tree and waits it out (black bear, leopard, jaguar, cougar)
      if (u.onTree){
        let near = false; for (const o of units) if (active(o) && hostile(w, o, u) && dist(o, u) < 15) near = true;
        u.treeSafeT = near ? 0 : (u.treeSafeT || 0) + DT; u.fleeT = Math.max(u.fleeT, 1);
        if (u.treeSafeT > 6 || outsideZone(w, u)){ u.onTree = null; u.state = 'idle'; u.morale = Math.max(u.morale, u.s.flee + .15); log(w, `${capName(u)} climbs down`, 'info', u); }
        continue;
      }
      if (u.s.climb && w.trees.length && !u.routing && !u.latchedBy && !u.rider){
        let bt = null, bd = 3; for (const t of w.trees){ const d = Math.hypot(t.x - u.x, t.y - u.y) - t.r; if (d < bd && !outsideZone(w, t)){ bd = d; bt = t; } }
        if (bt){ sig(w, u, 'tree escape'); u.onTree = bt; u.treeSafeT = 0; u.x = bt.x; u.y = bt.y; u.vx = u.vy = 0; u.climbT = 1.2; release(w, u); log(w, `${capName(u)} scrambles up a tree`, 'info', u); continue; }
      }
      u.fleeT -= DT;
      // cornered?
      const nearEdge = u.x < 4 || u.x > W - 4 || u.y < 4 || u.y > H - 4;
      let threatNear = null; for (const o of units) if (active(o) && hostile(w,o,u) && o.target === u && dist(o,u) < 7) threatNear = o;
      if (threatNear && (nearEdge || u.latchedBy)){
        u.state = 'engage'; u.target = threatNear; u.cornerT = 6; u.morale = .7; u.fleeT = 0;
        log(w, `${capName(u)} is cornered and turns to fight`, 'corner', u);
      } else if (u.side === 'E' && nearEdge && !threatNear && (u.routing || u.morale < u.s.flee * .8) && w.mode === 'wild'){
        u.escaped = true; u.state = 'gone'; release(w, u);
        if (u.latchedBy) release(w, u.latchedBy);
        log(w, `${capName(u)} bolts out of the arena`, 'rout', u);
      } else if (u.fleeT <= 0 && !u.routing){ u.state = u.withdrawn ? 'withdraw' : 'idle'; u.morale = Math.max(u.morale, u.s.flee + .15); }
      continue;
    }
    if (u.heatstroke){ u.state = 'cool'; u.target = null; continue; }
    if (u.side === 'P' && w.cfg.movePolicy && w.cfg.movePolicy.guard) guardDecide(w, u); // learned guard intent (policy/), opt-in
    u.retargetT -= DT;
    if (u.retargetT <= 0){ u.retargetT = .5 + R() * .2; chooseTarget(w, u); }
  }
  // movement
  for (const u of units){
    if (!active(u)) continue;
    if (u.side === 'H'){ moveHuman(w, u); continue; }
    if (u.stun > 0 || u.climbT > 0){ u.climbT = Math.max(0, u.climbT - DT); damp(u); continue; }
    if (u.latchOn){ // glued to prey
      const t = u.latchOn;
      if (has(u,'deathroll') && w.wet && t.s.mass < u.s.mass && !inWater(w, t) && distWater(w, t) < 8){ // drags it into the water
        const p = waterPoint(w, t, t), dx = p.x - t.x, dy = p.y - t.y, m = Math.hypot(dx, dy) || 1; t.x += dx / m * 1.5 * DT; t.y += dy / m * 1.5 * DT; if (!u.dragging){ u.dragging = true; sig(w, u, 'drags into water'); } }
      const d = dist(u,t) || 1, want = u.r + t.r - .3;
      u.x = t.x + (u.x - t.x) / d * want; u.y = t.y + (u.y - t.y) / d * want; u.vx = t.vx; u.vy = t.vy; continue;
    }
    let tx = null, ty = null, frac = .5;
    const vmax = speedOf(w, u);
    if (u.mv){ commitMove(w, u, vmax); continue; }
    // a big cat doesn't trade blows with a charging buffalo or rhino: it sidesteps and gives ground, then comes back
    u.dodge = null; // recomputed every tick: a stale sidestep must not steer a cat that is now fleeing, cornered or overheated
    if ((has(u,'catSense') || has(u,'boxer')) && u.state !== 'flee' && !u.latchOn && !u.latchedBy && u.cornerT <= 0){
      let th = null, td = 9; for (const o of units) if (active(o) && hostile(w, o, u) && o.target === u && !o.s.pred && o.s.mass > 3 * u.s.mass){ const d = dist(o, u); if (d < td){ td = d; th = o; } }
      if (th){ const ax = (u.x - th.x) / (td || 1), ay = (u.y - th.y) / (td || 1); u.dodge = {x: u.x + ax * 6 - ay * 4 * u.orbitDir, y: u.y + ay * 6 + ax * 4 * u.orbitDir}; if (!u.dodging){ u.dodging = true; sig(w, u, 'dodge'); } }
      else u.dodging = false;
    } else u.dodging = false;
    // a lone wolf tests big prey: it nips, and when the animal turns on it, it lopes off just ahead of it (away from you,
    // on your side), drawing the chase and tiring it, then comes back for more
    u.kite = null;
    if (has(u,'tester') && u.state !== 'flee' && !u.latchOn && !u.latchedBy && u.cornerT <= 0 && !packMates(w, u)){
      let th = null, td = 10; for (const o of units) if (active(o) && hostile(w, o, u) && o.target === u && !o.s.pred && o.s.mass > 3 * u.s.mass){ const d = dist(o, u); if (d < td){ td = d; th = o; } }
      if (th){ let ax = (u.x - th.x) / (td || 1), ay = (u.y - th.y) / (td || 1);
        if (u.side === 'P'){ const H0 = w.human, hd = dist(u, H0) || 1; ax += (u.x - H0.x) / hd * .6; ay += (u.y - H0.y) / hd * .6; }
        const m = Math.hypot(ax, ay) || 1; u.kite = {x: u.x + ax / m * 6, y: u.y + ay / m * 6}; if (!u.kiting){ u.kiting = true; sig(w, u, 'leads a chase'); } }
      else u.kiting = false;
    }
    if (u.state === 'flee'){
      let ax = 0, ay = 0;
      for (const o of units) if (active(o) && hostile(w,o,u)){ const d = dist(o,u); const k = 1 / (d*d + 1); ax += (u.x-o.x)*k; ay += (u.y-o.y)*k; }
      let m = Math.hypot(ax, ay);
      if (m > 1e-9){ ax /= m; ay /= m; } else if (u.fleeDir){ ax = u.fleeDir.x; ay = u.fleeDir.y; }
      if (u.routing){
        const ex = [u.x, W - u.x, u.y, H - u.y], k = ex.indexOf(Math.min(...ex));
        const gx = k === 0 ? -1 : k === 1 ? 1 : 0, gy = k === 2 ? -1 : k === 3 ? 1 : 0;
        ax = ax * .5 + gx; ay = ay * .5 + gy;
      }
      if (u.side === 'P'){ ax += (w.human.x - u.x) * .004; ay += (w.human.y - u.y) * .004; }
      m = Math.hypot(ax, ay) || 1; u.fleeDir = {x: ax/m, y: ay/m};
      tx = u.x + ax/m*10; ty = u.y + ay/m*10; frac = 1;
    } else if (u.state === 'cool'){
      let toWater = w.wet;
      if (toWater && w.shade.length){ let sd = 1e9; for (const t of w.shade) sd = Math.min(sd, Math.hypot(t.x-u.x, t.y-u.y)); toWater = distWater(w, u) < sd + 10; } // a waterhole beats shade unless it is much farther
      if (toWater){ const p = waterPoint(w, u); tx = p.x; ty = p.y; }
      else if (w.shade.length){ let b = w.shade[0], bd = 1e9; for (const t of w.shade){ const d = Math.hypot(t.x-u.x, t.y-u.y); if (d < bd){ bd = d; b = t; } } tx = b.x; ty = b.y; if (bd < b.r * .6) frac = 0; }
      else { tx = u.side === 'P' ? 4 : W - 4; ty = u.y; }
      frac = .35;
    } else if (u.state === 'feed' && u.carcass){
      const c = u.carcass, d = Math.hypot(c.x-u.x, c.y-u.y);
      if (d < u.r + 1.2){
        frac = 0; c.meat -= DT * Math.pow(u.s.mass, .6) * .05 * (has(u,'scavenger') ? 1.5 : 1);
        u.hunger = Math.max(0, u.hunger - .035 * DT * (has(u,'scavenger') ? 1.4 : 1));
        if (u.feedT <= 0){ log(w, `${capName(u)} starts feeding on the ${BY_ID[c.of].name} carcass`, 'feed', u); }
        u.feedT += DT;
        if (u.hunger < .12){ u.sated = true; u.state = 'rest'; u.carcass = null; log(w, `${capName(u)} has eaten its fill and loses interest`, 'feed', u); }
        if (c.meat <= 0){ u.carcass = null; u.state = 'idle'; }
      } else { tx = c.x; ty = c.y; frac = .7; }
    } else if (u.state === 'engage' && u.target){
      const t = u.target, d = dist(u, t), touch = u.r + t.r + u.s.reach * .6;
      if (has(u,'waterbound') && w.wet && distWater(w, t) > 5){ const p = waterPoint(w, u, t); tx = p.x; ty = p.band ? t.y : p.y; frac = .3; }
      else if (perchAmbush(w, u, t, d)){ continue; } // up a tree, waiting to drop on it
      else if (u.backT > 0 && t === u.stabbed){ // stabbed and let go: circle out of reach while it bleeds
        const rx = (u.x - t.x) / (d || 1), ry = (u.y - t.y) / (d || 1), vx = -ry * u.orbitDir + rx * (8 - d) * .4, vy = rx * u.orbitDir + ry * (8 - d) * .4, m = Math.hypot(vx, vy) || 1;
        tx = u.x + vx / m * 5; ty = u.y + vy / m * 5; frac = .6;
        if (!u.circling){ u.circling = true; sig(w, u, 'lets it bleed'); }
      }
      else if (w.cfg.movePolicy && intentMove(w, u, t, d, touch, vmax)){ const m = u.intentGo; if (!m) continue; tx = m.tx; ty = m.ty; frac = m.frac; } // learned movement intent (policy/), opt-in
      else if (waitForOpening(w, u, t, d)){ // shadow a well-guarded target from ~16 m instead of charging into its guards
        const rx = (u.x - t.x) / (d || 1), ry = (u.y - t.y) / (d || 1), vx = -ry * u.orbitDir + rx * (16 - d) * .25, vy = rx * u.orbitDir + ry * (16 - d) * .25, m = Math.hypot(vx, vy) || 1;
        tx = u.x + vx / m * 5; ty = u.y + vy / m * 5; frac = .45;
      }
      else { const m = gaitMove(w, u, t, d, touch, vmax); if (m === null) continue; tx = m.tx; ty = m.ty; frac = m.frac; }
    } else if (u.state === 'carry' || u.state === 'withdraw'){
      const m = evadeMove(w, u); tx = m.tx; ty = m.ty; frac = m.frac;
    } else if (u.side === 'P'){
      const H = w.human;
      tx = H.x + u.homeDx; ty = H.y + u.homeDy;
      if (u.post){ tx = u.post.x; ty = u.post.y; }
      if (u.rider || w.mount === u){ tx = H.x; ty = H.y; }
      frac = Math.hypot(tx-u.x, ty-u.y) > 6 ? .8 : .35;
      if (Math.hypot(tx-u.x, ty-u.y) < 1) frac = 0;
      if (u.gIntent && w.cfg.movePolicy){ const m = guardIdleGo(w, u); if (m){ tx = m.tx; ty = m.ty; frac = m.frac; } } // learned guard intent (policy/), opt-in
    } else {
      // roam / rest: drift gently, enemies wander
      if (!u.wander || R() < .01){
        const H0 = w.human, lean = u.sated ? 0 : Math.min(1, (u.s.pred ? .5 : .2 + u.agit * .7) + pressure(w) * .6);
        const bx = u.x + (H0.x - u.x) * lean * .5, by = u.y + (H0.y - u.y) * lean * .5;
        u.wander = {x: clamp(bx + (R()-.5)*20, 5, W-5), y: clamp(by + (R()-.5)*20, 5, H-5)}; if (has(u,'waterbound') && w.wet) u.wander = nearWaterPt(w, u, u.wander, -1); } // lurk submerged
      if (has(u,'waterbound') && !w.wet){ frac = 0; }
      else { tx = u.wander.x; ty = u.wander.y; frac = u.state === 'rest' ? .12 : .35 + .35 * pressure(w); }
    }
    if (u.dodge){ tx = u.dodge.x; ty = u.dodge.y; frac = 1; } // the sidestep wins over whatever else it was doing
    else if (u.kite){ tx = u.kite.x; ty = u.kite.y; frac = .9; }
    // a kangaroo chased by a predator lighter than itself backs into water, where the attacker has to swim
    if (has(u,'drowner') && w.wet && !u.latchOn && !u.routing){
      let th = null; for (const o of units) if (active(o) && hostile(w, o, u) && o.s.pred && o.s.mass < u.s.mass && o.target === u && dist(o, u) < 14) th = o;
      if (th && !inWater(w, u) && distWater(w, u) < 30){ const p = waterPoint(w, u, u); tx = p.x; ty = p.band ? u.y : p.y; frac = 1; if (!u.wading){ u.wading = true; sig(w, u, 'backs into water'); } }
      else if (th && inWater(w, u) && u.target && !inWater(w, u.target)){ tx = u.x; ty = u.y; frac = 0; } // stay in: let it come
      else if (!th) u.wading = false;
    }
    if (u.rider && u.state === 'guard'){ tx = u.x; ty = u.y; frac = 0; } // (tried: evading with a smaller mount made riding worse, Oct 2026)
    // keep out of the closing hazard: get back inside first, and never chase or wander into it (routing animals run through it)
    if (w.zb && w.zb.p > 0 && !u.routing){
      const z = w.zb, m = 2.5;
      const nearEdge = u.x < z.x0 + 1 || u.x > z.x1 - 1 || u.y < z.y0 + 1 || u.y > z.y1 - 1; // in it, or about to be: step inward even mid-fight
      if (nearEdge){ tx = clamp(u.x, z.x0 + m, z.x1 - m); ty = clamp(u.y, z.y0 + m, z.y1 - m); frac = Math.max(frac, outsideZone(w, u) ? .9 : .5); }
      else if (tx !== null){ tx = clamp(tx, z.x0 + m, z.x1 - m); ty = clamp(ty, z.y0 + m, z.y1 - m); }
    }
    let dvx = 0, dvy = 0;
    if (tx !== null && frac > 0){
      const dx = tx - u.x, dy = ty - u.y, m = Math.hypot(dx, dy);
      if (m > .2){
        const sp = vmax * frac * (u.stam < .2 && frac > .6 ? .6 : 1); let d = steerTrees(w, u, dx/m, dy/m);
        if (w.trees.length && sp > 1) d = unstick(w, u, d);
        dvx = d.x*sp; dvy = d.y*sp;
      }
    }
    const acc = Math.min(1, 6 / (1 + u.s.mass / 1500) * DT);
    u.vx += (dvx - u.vx) * acc; u.vy += (dvy - u.vy) * acc;
  }
  // integrate
  for (const u of units){
    if (!active(u)) continue;
    if (u.riding){ u.x = u.riding.x; u.y = u.riding.y; u.vx = u.riding.vx; u.vy = u.riding.vy; continue; }
    if (u.onTree){ u.vx = u.vy = 0; continue; }
    u.x += u.vx * DT; u.y += u.vy * DT;
    u.x = clamp(u.x, u.r * .5, W - u.r * .5); u.y = clamp(u.y, u.r * .5, H - u.r * .5);
  }
  // collisions
  for (let i = 0; i < units.length; i++){
    const a = units[i]; if (!active(a) || a.riding || a.onTree) continue;
    for (let j = i + 1; j < units.length; j++){
      const b = units[j]; if (!active(b) || b.riding || b.onTree) continue;
      if (a.latchOn === b || b.latchOn === a || a.rider === b || b.rider === a) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = (a.r + b.r) * .85;
      if (d < m && d > 1e-4){
        const o = m - d, ta = b.s.mass / (a.s.mass + b.s.mass);
        a.x -= dx/d*o*ta; a.y -= dy/d*o*ta; b.x += dx/d*o*(1-ta); b.y += dy/d*o*(1-ta);
      }
    }
    for (const t of w.trees){
      const dx = a.x - t.x, dy = a.y - t.y, d = Math.hypot(dx, dy), m = t.r + a.r * .6;
      if (d < m && d > 1e-4){
        a.x = t.x + dx/d*m; a.y = t.y + dy/d*m;
        // an elephant leaning into a trunk for a second or so simply shoves the tree over
        if (a.s.mass >= 5000 && Math.hypot(a.vx, a.vy) > 1 && (t.push = (t.push || 0) + DT) > 1.2){ t.fell = true; log(w, `${capName(a)} shoves over a tree`, 'crash', a); }
      }
    }
  }
  if (w.trees.some(t => t.fell)){
    for (const t of w.trees) if (t.fell){ (w.fallen = w.fallen || []).push({x: t.x, y: t.y, r: t.r, t: w.t}); if (w.human.onTree === t){ w.human.onTree = null; log(w, 'Your tree goes down and you scramble clear', 'danger', w.human); } for (const o of w.units) if (o !== w.human && o.onTree === t) o.onTree = null; }
    w.trees = w.trees.filter(t => !t.fell);
  }
  // shake-off attempts by latched prey
  for (const u of units){
    if (!active(u) || !u.latchOn) continue;
    const t = u.latchOn;
    const p = .15 * Math.sqrt(t.s.mass / u.s.mass) * (t.cornerT > 0 ? 1.5 : 1) * (t.side === 'H' ? .3 : 1) * (has(t,'looseSkin') ? 5 : 1); // loose skin: it twists free
    if (w.R() < p * DT * (has(u,'pinStab') ? .6 : 1)){ if (has(t,'looseSkin')) sig(w, t, 'twists free'); release(w, u, 'shaken off'); }
  }
  // attacks
  for (const u of units){
    if (!active(u) || u.stun > 0 || u.atk > 0 || u.climbT > 0) continue;
    if (u.side === 'H'){
      const a = u.latchedBy; if (a){ u.atk = 1; applyDamage(w, u, a, 5 * (1 - a.s.armor)); continue; }
      if (heightOf(u) > 0) continue;
      // on foot and cornered: kick and punch at whatever is on you (it barely hurts, but it can finish something)
      let e = null, ed = 1e9;
      for (const o of units) if (o.side === 'E' && active(o) && o.target === u){ const d = dist(u, o); if (d <= u.r + o.r + u.s.reach && d < ed){ ed = d; e = o; } }
      if (e){ u.atk = 1; strike(w, u, e, {}); if (w.R() < .15) log(w, `You kick and punch at ${nameOf(e)}`, 'info', u); }
      continue;
    }
    if (has(u,'pinStab') && !u.fangBroken && (u.latchOn ? u.pinT >= 1.2 : u.target && active(u.target) && u.target.stun > .2 && dist(u, u.target) <= u.r + u.target.r + u.s.reach)){
      const t = u.latchOn || u.target, held = u.latchOn === t;
      let pb = .03; if (!held || (t.s.mass > 2 * u.s.mass && t.stam > .5)) pb += .3; if (t.s.armor >= .45) pb += .35; // thrashing prey or armor can snap a sabre
      if (w.R() < pb){ u.fangBroken = true; u.morale -= .1; sig(w, u, 'snaps a canine'); log(w, `${capName(u)} snaps a sabre on ${nameOf(t)}`, 'info', u); strike(w, u, t, {latch: held}); }
      else { sig(w, u, 'killing stab'); log(w, `${capName(u)} drives its sabres into ${nameOf(t)}`, 'maul', t); strike(w, u, t, {stab:true}); }
      if (u.latchOn) release(w, u); u.stabbed = t; u.backT = 5; u.pinT = 0; u.atk = u.s.cd; continue;
    }
    if (u.latchOn){
      strike(w, u, u.latchOn, {latch:true}); u.atk = has(u,'pinStab') && u.pinT < 1.2 ? clamp(1.2 - u.pinT, .3, u.s.cd) : u.s.cd; continue; // a sabre-tooth stabs as soon as the prey is pinned
    }
    // a kicker carrying you lashes out at anything that gets in close (a giraffe's kick can kill a lion)
    if (u.state === 'carry' && u.rider && has(u,'kicker')){
      let e = null, ed = 1e9; for (const o of units) if (o.side === 'E' && active(o) && (o.target === u || o.target === w.human || o.latchOn === u)){ const d = dist(u, o); if (d <= u.r + o.r + u.s.reach && d < ed){ ed = d; e = o; } }
      if (e){ strike(w, u, e, {}); u.atk = u.s.cd; sig(w, u, 'kicks while carrying you'); continue; }
    }
    // defensive counterattack: anything latching me
    let t = u.target;
    if (u.latchedBy && (u.state !== 'flee' || u.cornerT > 0)) t = u.latchedBy;
    if (!t || u.state === 'flee' || u.state === 'feed' || u.heatstroke) { if (u.latchedBy){ t = u.latchedBy; } else continue; }
    if (!active(t)) continue;
    const d = dist(u, t), touch = u.r + t.r + u.s.reach;
    if (d > touch) continue;
    const easy = t.state === 'flee' || t.stun > 0 || t.latchedBy || t.heatstroke || t.side === 'H';
    if (u.s.gait === 'orbit' && !(u.mv && u.mv.k === 'dart') && !easy && !u.latchedBy && u.cornerT <= 0) continue;
    if ((u.s.gait === 'stalk' || u.s.gait === 'rush' || u.s.gait === 'lunge') && u.mv) continue;
    if (u.mv && u.mv.k === 'lunge') continue;
    // height check: rider / tree
    const h = heightOf(t);
    if (h > 0 && !t.latchedBy){
      if (t.onTree && u.s.climb){
        if (!u.climbing){ u.climbing = true; u.climbT = 1.5; log(w, `${capName(u)} climbs after ${t.side === 'H' ? 'you' : nameOf(t)}`, 'danger', u); continue; }
      } else if (u.s.strikeH >= h){
        u.atk = u.s.cd * 1.5;
        const leaper = u.s.pred && u.s.pounce;
        if (w.R() < .35){ log(w, `${capName(u)} ${leaper ? 'leaps up' : 'rears up'} ${t.riding ? 'at you on your ' + t.riding.s.name : 'into the tree'} and strikes you`, 'danger', u);
          if (t.riding && w.R() < (has(u,'riderSnatcher') ? .85 : leaper ? .5 : .3)){ throwRider(w, t.riding, (leaper ? 'a leaping ' : 'a rearing ') + u.s.name, u); sig(w, u, 'rider knocked off'); }
        } else { u.stun = .8; if (w.R() < .3) log(w, `${capName(u)} leaps for you and misses`, 'info', u); continue; }
      } else { u.atk = .5; continue; }
    }
    // bluff / mock charge (gorilla always; elephant, mammoth, black rhino, bison, bears sometimes): stop short and rattle it first.
    // Never when cornered (a cornered gorilla bites without the display: Betsem 2011); a black bear rarely bluffs a person
    // (88% of fatal black bear attacks were predatory: Herrero et al. 2011)
    if (has(u,'bluff') && u.bluffed[t.id] === undefined) u.bluffed[t.id] = w.R() < (t === w.human && u.s.bluffHumanP !== undefined ? u.s.bluffHumanP : (u.s.bluffP || 1)) && u.grudge !== t && u.cornerT <= 0 && !(u.side === 'P' && t.target === w.human);
    if (u.bluffed[t.id] === true){
      u.bluffed[t.id] = false; u.atk = u.s.cd * 1.5; sig(w, u, 'mock charge');
      if (strength(t) < strength(u) * 1.5){ t.morale -= .35; log(w, `${capName(u)} ${u.s.id === 'gorilla' ? 'bluff-charges' : 'mock-charges'} ${nameOf(t)}, rattling it`, 'bluff', u); }
      // a black bear huffs, pops its jaws and bluff-charges again and again (up to three times) before it will fight;
      // anything its size or smaller that loses its nerve is driven off
      if (has(u,'repeatBluff')){
        const n = u.bluffN = u.bluffN || {}; n[t.id] = (n[t.id] || 0) + 1;
        if (t.side !== 'H' && strength(t) < strength(u) * 1.5 && t.morale < t.s.flee + .1 && t.state !== 'flee' && !has(t,'fearless')){ t.state = 'flee'; t.fleeT = 3 + w.R() * 2; t.mv = null; release(w, t); sig(w, u, 'drives it off'); log(w, `${capName(u)} runs ${nameOf(t)} off`, 'bluff', u); }
        if (n[t.id] < 3 && u.grudge !== t) u.bluffed[t.id] = w.R() < (u.s.bluffP || 1);
      }
      continue;
    }
    // giraffe only kicks predators / attackers
    strike(w, u, t, {}); u.atk = u.s.cd * (0.9 + w.R() * .2);
    if (has(u,'sweep') && !w.over) sweep(w, u, t);
    if (u.s.gait === 'orbit'){ u.mv = {k:'retreat', t:.7, tgt:t}; }
    if (t.state === 'dead' || w.over) continue;
  }
  // end conditions
  if (!w.over){
    const threats = units.filter(u => u.side === 'E' && (active(u) || u.penned) && !(u.sated && w.mode === 'wild'));
    const hz = w.cfg.horizon || MATCH_T;
    for (const u of units) if (u.side === 'E' && active(u) && u.target && u.target.side !== 'E' && u.state !== 'flee') { w.lastPress = w.t; break; }
    const penned = units.some(u => u.penned);
    const quiet = !penned && w.t - w.lastPress >= QUIET_T && w.t >= (w.zone ? ZONE_T1 : 75); // with a closing arena, only once it has fully closed
    if (w.t >= hz || threats.length === 0 || quiet){
      w.over = true;
      const why = threats.length === 0 ? 'cleared' : quiet ? 'quiet' : 'time';
      w.result = {survived:true, t:w.t, score:hz, cleared: why === 'cleared', why};
      log(w, why === 'cleared' ? 'No threats left. You survived.' : why === 'quiet' ? `Nothing has come at you or your team for ${QUIET_T} seconds. The other side has given up. You survived.` : `Time. You lasted the full ${Math.round(hz / 60)} minutes.`, 'win', w.human);
    }
  }
}
function damp(u){ u.vx *= .5; u.vy *= .5; }
// Tree ambush (leopard, jaguar): climb a tree near the prey's approach, wait hidden in the branches, then drop onto it.
// Returns true while perched (the caller skips movement); the drop is a pounce that counts as an ambush and stuns.
function perchAmbush(w, u, t, d){
  if (u.onTree && u.perch){
    u.perchT += DT;
    if (d <= 7 && heightOf(t) <= u.s.strikeH){ // drop onto it
      u.onTree = null; u.perch = false; u.fromTree = true; const dur = .35;
      u.mv = {k:'pounce', vx:(t.x - u.x) / dur, vy:(t.y - u.y) / dur, t:dur, tgt:t};
      log(w, `${capName(u)} drops out of a tree onto ${nameOf(t)}`, 'ambush', u); return false;
    }
    if (u.perchT > 20 || outsideZone(w, u) || !active(t)){ u.onTree = null; u.perch = false; }
    return !!u.onTree;
  }
  if (!u.s.climb || !has(u,'ambush') || !w.trees.length || !u.ambushReady || u.onTree || d < 9 || d > 30 || w.t < (u.nextPerch || 0)) return false;
  // your leopard only perches when its target is coming its way (it guards from the branches)
  if (u.side === 'P'){ const v = Math.hypot(t.vx, t.vy); if (v < 1.5 || ((u.x - t.x) * t.vx + (u.y - t.y) * t.vy) / ((d || 1) * v) < .6) return false; }
  let bt = null, bd = 5; for (const tr of w.trees){ const q = Math.hypot(tr.x - u.x, tr.y - u.y) - tr.r; if (q < bd && !outsideZone(w, tr)){ bd = q; bt = tr; } }
  if (!bt) return false;
  u.onTree = bt; u.perch = true; u.perchT = 0; u.nextPerch = w.t + 30; u.x = bt.x; u.y = bt.y; u.vx = u.vy = 0; u.climbT = 1.2;
  return true;
}
// A predator on the other side doesn't throw itself at a target ringed by stronger guards: it waits nearby for an
// opening (a guard busy elsewhere, the target hurt or running) until its patience runs out (bolder = less patient,
// hungrier = less patient). Crocs keep to their water and honey badgers don't wait for anything.
function waitForOpening(w, u, t, d){
  if (u.side !== 'E' || !u.s.pred || has(u,'waterbound') || has(u,'fearless') || u.grudge === t) return false;
  if (u.waitFor !== t){ u.waitFor = t; u.waitT = 0; }
  if (d > 26 || t.state === 'flee' || t.stun > 0 || t.latchedBy || t.heatstroke || t.hp < t.maxhp * .5) return false;
  const patience = (6 + 18 * (1 - u.s.aggr)) * (1.3 - u.hunger);
  if (u.waitT >= patience || guardsAround(w, t, u) < 1.2 * packStrength(w, u)) return false;
  u.waitT += DT; return true;
}
// wedged between trunks (no progress for a second while trying to move): detour sideways for a moment
function unstick(w, u, d){
  if (!u.prog || w.t - u.prog.t > 1){
    if (u.prog && Math.hypot(u.x - u.prog.x, u.y - u.prog.y) < .6 && !(u.detourT > 0)){ u.detourT = 1.6; u.detourSide = -(u.detourSide || 1); }
    u.prog = {x: u.x, y: u.y, t: w.t};
  }
  if (!(u.detourT > 0)) return d;
  u.detourT -= DT;
  const px = -d.y * u.detourSide, py = d.x * u.detourSide, x = px * .85 - d.x * .15, y = py * .85 - d.y * .15, m = Math.hypot(x, y) || 1;
  return {x: x / m, y: y / m};
}
// walk around a trunk in the way instead of pushing into it
function steerTrees(w, u, nx, ny){
  let sx = nx, sy = ny;
  for (const t of w.trees){
    const ox = t.x - u.x, oy = t.y - u.y, d = Math.hypot(ox, oy), clear = t.r + u.r * .6 + .6;
    if (d > clear + 1.5 || d < 1e-4) continue;
    const ahead = (ox * nx + oy * ny) / d; if (ahead < .3) continue;
    let px = -ny, py = nx; if (px * ox + py * oy > 0){ px = -px; py = -py; } // the side away from the trunk
    const k = 1.5 * ahead * (1 - .5 * clamp((d - clear) / 1.5, 0, 1));
    sx += px * k; sy += py * k;
  }
  const m = Math.hypot(sx, sy) || 1; return {x: sx / m, y: sy / m};
}

function moveHuman(w, h){
  if (h.riding){ return; }
  if (h.stun > 0){ damp(h); return; }
  if (h.climbT > 0){ h.climbT -= DT;
    if (h.climbT <= 0 && h.pendingMount){ const m = h.pendingMount; h.pendingMount = null; if (active(m) && !m.rider && dist(m,h) < m.r + 3){ m.rider = h; h.riding = m; log(w, `You climb back onto your ${m.s.name}`, 'info', h); } return; }
    if (h.climbT <= 0 && h.pendingTree){ h.onTree = h.pendingTree; h.pendingTree = null; log(w, 'You climb a tree', 'info', h); } damp(h); return; }
  const units = w.units;
  // threats
  let ax = 0, ay = 0, nearest = null, nd = 1e9, danger = 0;
  for (const e of units){
    if (e.side !== 'E' || !active(e) || e.state === 'feed' || e.state === 'rest' || e.heatstroke) continue;
    if (!teamSees(w, e)) continue;
    const d = dist(e, h);
    const intent = e.target === h ? 1 : .3;
    if (d < 30){ const k = intent * strength(e) / (d * d + 4); ax += (h.x - e.x) / (d||1) * k; ay += (h.y - e.y) / (d||1) * k; danger += k; }
    if (e.target === h && d < nd){ nd = d; nearest = e; }
  }
  // tree logic
  if (h.onTree && outsideZone(w, h)){ h.onTree = null; h.safeT = 0; log(w, `You climb down to get away from the ${HAZARD_NAME[w.zone.kind]}`, 'danger', h); }
  if (h.onTree){
    let safe = true; for (const e of units) if (e.side === 'E' && active(e) && e.target === h && dist(e,h) < 18) safe = false;
    if (safe){ h.safeT = (h.safeT || 0) + DT; if (h.safeT > 5){ h.onTree = null; h.safeT = 0; log(w, 'You climb down', 'info', h); } }
    else h.safeT = 0;
    return;
  }
  if (w.trees.length && nearest && nd < 14){
    let bt = null, bd = 1e9; for (const t of w.trees){ if (outsideZone(w, t)) continue; const d = Math.hypot(t.x-h.x, t.y-h.y); if (d < bd){ bd = d; bt = t; } }
    let guarded = false; for (const a of units) if (a.side === 'P' && active(a) && dist(a, h) < 6 && strength(a) > strength(nearest)*.6) guarded = true;
    if (bt && bd < 10 && !guarded){
      if (bd < bt.r + 1.6 && !h.latchedBy){ h.climbT = 1.5; h.pendingTree = bt; h.x = bt.x; h.y = bt.y + bt.r * .3; damp(h); return; }
      const dx = bt.x - h.x, dy = bt.y - h.y, m = Math.hypot(dx,dy)||1; setVel(w, h, dx/m, dy/m, 1); return;
    }
  }
  // get back on the elephant if it is close
  const M = w.mount;
  if (M && active(M) && !M.rider && M.state !== 'flee' && !M.heatstroke && !h.latchedBy){
    const d = dist(M, h);
    if (d < M.r + 1.8){ h.climbT = 2; h.pendingMount = M; damp(h); return; }
    if (d < 25){ const dx = M.x - h.x, dy = M.y - h.y; setVel(w, h, dx/d, dy/d, 1); return; }
  }
  // pull toward allies (centroid weighted by strength), away from threats
  let gx = 0, gy = 0, gw = 0;
  for (const a of units){ if (a.side === 'P' && active(a) && a.state !== 'flee' && !a.post){ const s = strength(a); gx += a.x * s; gy += a.y * s; gw += s; } }
  if (!gw && h.home){ gx = h.home.x; gy = h.home.y; gw = 1; }
  let dx = 0, dy = 0;
  if (gw > 0){ gx /= gw; gy /= gw; const d = Math.hypot(gx-h.x, gy-h.y); if (d > 2){ dx += (gx-h.x)/d * Math.min(1, d/8); dy += (gy-h.y)/d * Math.min(1, d/8); } }
  if (danger > 0){ const m = Math.hypot(ax, ay) || 1; const k = Math.min(2, danger * 4); dx += ax/m * k; dy += ay/m * k; }
  // avoid water (crocs) and edges
  { const aw = awayWater(w, h); if (aw){ dx += aw.x; if (aw.y) dy += aw.y; } }
  // stay clear of the field edges and of the closing hazard (hard push once you are in it)
  const zb = w.zb && w.zb.p > 0 ? w.zb : {x0: 0, x1: W, y0: 0, y1: H}, out = outsideZone(w, h), ek = out ? 4 : 1;
  if (h.x < zb.x0 + 4) dx += ek; if (h.x > zb.x1 - 4) dx -= ek; if (h.y < zb.y0 + 4) dy += ek; if (h.y > zb.y1 - 4) dy -= ek;
  const m = Math.hypot(dx, dy);
  if (m < .05){ damp(h); return; }
  const urgent = (nearest && nd < 10) || out;
  setVel(w, h, dx/m, dy/m, urgent ? 1 : Math.min(.6, m));
}
function setVel(w, u, nx, ny, frac){
  const v = speedOf(w, u) * frac;
  const acc = Math.min(1, 5 * DT);
  u.vx += (nx*v - u.vx) * acc; u.vy += (ny*v - u.vy) * acc;
}

// ---------- gaits ----------
function wrapA(a){ while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
function accel(u, dvx, dvy, k){ const acc = Math.min(1, (k || 1) * 6 / (1 + u.s.mass / 1500) * DT); u.vx += (dvx - u.vx) * acc; u.vy += (dvy - u.vy) * acc; }
function gaitMove(w, u, t, d, touch, vmax){
  const R = w.R, s = u.s, g = s.gait, ally = u.side === 'P';
  const lead = {tx: t.x + t.vx * .3, ty: t.y + t.vy * .3};
  const go = f => ({tx: lead.tx, ty: lead.ty, frac: d > touch ? f : 0});
  if (g === 'charge'){
    if (d > 5 && d < 32 && u.chargeCd <= 0 && u.stam > .3 && reachable(u, t)){
      const px = t.x + t.vx * d / Math.max(4, vmax) * .5, py = t.y + t.vy * d / Math.max(4, vmax) * .5, m = Math.hypot(px - u.x, py - u.y) || 1;
      const run = Math.min(s.maxRun || 99, m + (s.overshoot || 4));
      u.mv = {k:'charge', nx:(px - u.x) / m, ny:(py - u.y) / m, left:run, t:run / Math.max(3, vmax) + 1.5, tgt:t, hit:{}};
      if (d > 9) log(w, `${capName(u)} lowers its head and charges ${nameOf(t)}`, 'charge', u);
      commitMove(w, u, vmax); return null;
    }
    return go(d > 8 ? .55 : .8);
  }
  if (g === 'rush' && has(u,'pack') && d > 9 && !t.latchedBy && t.state !== 'flee'){ // a coalition doesn't charge in line: the second lion swings round to the far side
    let lead2 = null; for (const o of w.units) if (packMate(u, o) && o.target === t && dist(o, t) < d && dist(o, t) < 25){ lead2 = o; break; }
    if (lead2){
      const ax = t.x - lead2.x, ay = t.y - lead2.y, m = Math.hypot(ax, ay) || 1, fx = t.x + ax / m * 7, fy = t.y + ay / m * 7; // the point opposite its packmate
      if (Math.hypot(fx - u.x, fy - u.y) > 4){ if (!u.encircling){ u.encircling = true; sig(w, u, 'encircles'); } const sx = fx - t.x, sy = fy - t.y, k = Math.hypot(sx, sy) || 1, ux = u.x - t.x, uy = u.y - t.y, ud = Math.hypot(ux, uy) || 1;
        // swing wide around the prey rather than through it
        const side = Math.sign(ux * sy - uy * sx) || 1, wx = t.x + (ux / ud * Math.cos(.8 * side) - uy / ud * Math.sin(.8 * side)) * Math.max(9, ud * .9), wy = t.y + (ux / ud * Math.sin(.8 * side) + uy / ud * Math.cos(.8 * side)) * Math.max(9, ud * .9);
        return (ux * sx + uy * sy) / (ud * k) > .3 ? {tx: fx, ty: fy, frac: 1} : {tx: wx, ty: wy, frac: 1}; }
    }
  }
  if (u.encircling && (g !== 'rush' || d <= 9)) u.encircling = false;
  if (g === 'stalk' || g === 'rush'){
    const P = s.pounce || 5;
    if (d <= P && d > touch * .8 && u.pounceCd <= 0 && u.stam > .2 && reachable(u, t)){
      const dur = clamp(d / (s.spd * 1.6), .25, .6), px = t.x + t.vx * dur, py = t.y + t.vy * dur, m = Math.hypot(px - u.x, py - u.y) || 1;
      u.mv = {k:'pounce', vx:(px - u.x) / dur * .95, vy:(py - u.y) / dur * .95, t:dur, tgt:t};
      if (d > 6) log(w, `${capName(u)} pounces ${Math.round(d)} m onto ${nameOf(t)}`, 'pounce', u);
      commitMove(w, u, vmax); return null;
    }
    // creep only while the prey is unaware; once it runs (or turns on you), break cover and run it down, but only from
    // within ~30 m: a spotted tiger doesn't pursue from farther (Schaller 1967), stalkers need 15-20 m (Laundre &
    // Hernandez 2003). Farther off it keeps creeping in
    const away = (t.vx * (t.x - u.x) + t.vy * (t.y - u.y)) / (d || 1);
    if (g === 'stalk' && d > P + 1){
      if (!ally && (away > 2 || t.target === u)) return go(d < 30 ? 1 : .38);
      if (ally && (t.target === w.human || t.target === u || busy(t))) return go(1); // defending: no time to creep, run it down
      return go(ally ? .6 : .38);
    }
    if (g === 'rush' && !ally && d > 30) return go(.6); // lions close in before the rush; success is highest from ~20 m (Van Orsdol 1984)
    return go(1);
  }
  if (g === 'lunge'){
    const nearW = w.wet && distWater(w, u) < 3, L = nearW ? 7 : 3.5, V = nearW ? 12 : 7;
    if (d <= L && d > touch * .7 && u.pounceCd <= 0 && reachable(u, t)){
      const dur = clamp(d / V, .2, .55), m = d || 1;
      u.mv = {k:'lunge', vx:(t.x - u.x) / m * V, vy:(t.y - u.y) / m * V, t:dur, tgt:t};
      log(w, `${capName(u)} explodes out of stillness and lunges at ${nameOf(t)}`, 'lunge', u);
      commitMove(w, u, vmax); return null;
    }
    if (d <= touch) return go(0);
    return d > 14 ? go(.55) : go(.15);
  }
  if (g === 'orbit'){
    const easy = t.state === 'flee' || t.stun > 0 || t.latchedBy || t.heatstroke;
    if (d > 10 || easy) return go(.9);
    if (u.dartT <= 0 && u.stam > .15){ u.dartT = s.dart * (.8 + R() * .6); u.mv = {k:'dart', t:1.4, tgt:t}; commitMove(w, u, vmax); return null; }
    const rx = (u.x - t.x) / (d || 1), ry = (u.y - t.y) / (d || 1), ro = t.r + u.r + 3.2;
    const vx = -ry * u.orbitDir + rx * (ro - d) * .6, vy = rx * u.orbitDir + ry * (ro - d) * .6, m = Math.hypot(vx, vy) || 1;
    return {tx: u.x + vx / m * 5, ty: u.y + vy / m * 5, frac: .6};
  }
  if (g === 'keepaway'){
    if (d < touch * .75){ const m = d || 1; return {tx: u.x + (u.x - t.x) / m * 4, ty: u.y + (u.y - t.y) / m * 4, frac: .6}; }
    return go(.7);
  }
  // lumber; an aquatic stalker in deep water surges out at prey on or near the bank (reuses the croc's lunge move)
  if (has(u,'aquaStalk') && inWater(w, u) && d <= 6 && d > touch * .7 && u.pounceCd <= 0 && reachable(u, t)){
    const V = 10, dur = clamp(d / V, .2, .55), m = d || 1;
    u.mv = {k:'lunge', vx:(t.x - u.x) / m * V, vy:(t.y - u.y) / m * V, t:dur, tgt:t}; u.wetLunge = true;
    log(w, `${capName(u)} surges out of the water at ${nameOf(t)}`, 'lunge', u);
    commitMove(w, u, vmax); return null;
  }
  return go(d > 12 ? .8 : 1);
}
function commitMove(w, u, vmax){
  const mv = u.mv; mv.t -= DT;
  const t = mv.tgt && active(mv.tgt) ? mv.tgt : null;
  if (mv.k === 'charge'){
    if (t){ const cur = Math.atan2(mv.ny, mv.nx); let da = wrapA(Math.atan2(t.y - u.y, t.x - u.x) - cur); const mx = (u.s.turn || .5) * DT; da = clamp(da, -mx, mx); mv.nx = Math.cos(cur + da); mv.ny = Math.sin(cur + da); }
    accel(u, mv.nx * vmax, mv.ny * vmax, 1.6);
    mv.left -= Math.hypot(u.vx, u.vy) * DT;
    if (inWater(w, u) && u.s.water < .8){ u.mv = {k:'wheel', t:(u.s.wheel || 1) + .8}; u.chargeCd = 2.5; u.vx *= .3; u.vy *= .3; log(w, `${capName(u)}'s charge founders in the deep water`, 'info', u); return; }
    for (const tr of w.trees){
      if (Math.hypot(tr.x - u.x, tr.y - u.y) < tr.r + u.r * .55 + .4 && Math.hypot(u.vx, u.vy) > vmax * .5){
        u.mv = null; u.vx = u.vy = 0; u.stun = Math.max(u.stun, 1.6); u.chargeCd = 3;
        applyDamage(w, u, u, u.maxhp * .04); if (u.state === 'dead') return;
        log(w, `${capName(u)} slams into a tree and is stunned`, 'crash', u); return;
      }
    }
    for (const o of w.units){
      if (!hostile(w, u, o) || mv.hit[o.id] || heightOf(o) > u.s.strikeH) continue;
      if (dist(u, o) <= u.r + o.r + u.s.reach * .5 && Math.hypot(u.vx, u.vy) > vmax * .45){ mv.hit[o.id] = 1; strike(w, u, o, {}); if (w.over) return; }
    }
    const edge = u.x < 3 || u.x > W - 3 || u.y < 3 || u.y > H - 3;
    if (mv.left <= 0 || mv.t <= 0 || edge){ u.mv = {k:'wheel', t:u.s.wheel || 1}; u.chargeCd = .6 + (u.s.wheel || 1); }
    return;
  }
  if (mv.k === 'wheel'){ accel(u, 0, 0, 1.4); if (mv.t <= 0) u.mv = null; return; }
  if (mv.k === 'pounce' || mv.k === 'lunge'){
    u.vx = mv.vx; u.vy = mv.vy;
    if (mv.t <= 0){
      u.mv = null; u.pounceCd = mv.k === 'lunge' ? 3.5 : 3;
      if (t && dist(u, t) <= u.r + t.r + u.s.reach + .8 && heightOf(t) <= u.s.strikeH){ u.vx *= .2; u.vy *= .2; strike(w, u, t, {pounce:true}); u.atk = u.s.cd; if (u.fromTree && t.state !== 'dead') t.stun = Math.max(t.stun, 1.2); u.fromTree = false; }
      else { u.fromTree = false; u.wetLunge = false; u.vx *= .2; u.vy *= .2; u.stun = Math.max(u.stun, mv.k === 'lunge' ? .9 : .5); if (t && dist(u, t) < 14) log(w, `${capName(u)} ${mv.k === 'lunge' ? 'lunges' : 'pounces'} and misses`, 'info', u); }
    }
    return;
  }
  if (mv.k === 'dart'){
    if (!t || mv.t <= 0){ u.mv = null; return; }
    const d = dist(u, t) || 1; accel(u, (t.x - u.x) / d * vmax, (t.y - u.y) / d * vmax, 2); return;
  }
  if (mv.k === 'retreat'){
    if (!t || mv.t <= 0){ u.mv = null; return; }
    const d = dist(u, t) || 1; accel(u, (u.x - t.x) / d * vmax * .85, (u.y - t.y) / d * vmax * .85, 2); return;
  }
  u.mv = null;
}
function evadeMove(w, u){
  let ax = 0, ay = 0, danger = 0;
  for (const e of w.units){
    if (e.side !== 'E' || !active(e) || e.state === 'feed' || e.state === 'rest' || e.heatstroke) continue;
    const d = dist(e, u); if (d > 22) continue;
    const k = (e.target === w.human || e.target === u ? 1 : .35) * strength(e) / (d * d + 4);
    ax += (u.x - e.x) / (d || 1) * k; ay += (u.y - e.y) / (d || 1) * k; danger += k;
  }
  let gx = 0, gy = 0, gw = 0;
  for (const a of w.units) if (a.side === 'P' && a !== u && active(a) && a.state !== 'flee'){ const s = strength(a); gx += a.x * s; gy += a.y * s; gw += s; }
  let dx = 0, dy = 0;
  if (gw){ gx /= gw; gy /= gw; const d = Math.hypot(gx - u.x, gy - u.y); if (d > 3){ dx += (gx - u.x) / d * .6; dy += (gy - u.y) / d * .6; } }
  if (danger > 0){ const m = Math.hypot(ax, ay) || 1, k = Math.min(2.5, danger * 4); dx += ax / m * k; dy += ay / m * k; }
  { const aw = awayWater(w, u); if (aw){ dx += aw.x; if (aw.y) dy += aw.y; } }
  const zb = w.zb && w.zb.p > 0 ? w.zb : {x0: 0, x1: W, y0: 0, y1: H};
  if (u.x < zb.x0 + 5) dx += 1.2; if (u.x > zb.x1 - 5) dx -= 1.2; if (u.y < zb.y0 + 5) dy += 1.2; if (u.y > zb.y1 - 5) dy -= 1.2;
  const m = Math.hypot(dx, dy);
  if (m < .05) return {tx: u.x, ty: u.y, frac: 0};
  return {tx: u.x + dx / m * 6, ty: u.y + dy / m * 6, frac: danger > .02 ? 1 : .35};
}

// the sensible default mount: ride a giant (3 m+ up, out of most leaps) if you have one; otherwise you're safer on foot
// (measured: riding a rhino, hippo, bison, moose or giraffe scores lower than running on foot)
function defaultMount(team){ let b = null, h = 2.99; for (const id of team){ const m = BY_ID[id].mountH; if (m > h){ h = m; b = id; } } return b; }
// Measured value of each pick (price_abs.js, seconds of survival): mine = with you vs left off the board,
// theirs = against you vs off the board (negative = it hurts you). Written by apply_values.js; shown on the cards.
const MEASURED = {/*MEASURED*/elephant:{mine:130,theirs:-28}, rhino:{mine:54,theirs:-21}, hippo:{mine:53,theirs:-18}, giraffe:{mine:27,theirs:-5}, polar:{mine:32,theirs:-7}, croc:{mine:28,theirs:-7}, buffalo:{mine:30,theirs:-16}, bison:{mine:40,theirs:-14}, grizzly:{mine:23,theirs:-12}, tiger:{mine:16,theirs:-4}, lion:{mine:10,theirs:-7}, gorilla:{mine:19,theirs:5}, jaguar:{mine:8,theirs:-1}, wolf:{mine:6,theirs:-3}, cougar:{mine:6,theirs:0}, hyena:{mine:-4,theirs:-2}, blackrhino:{mine:46,theirs:-18}, bull:{mine:20,theirs:-9}, moose:{mine:33,theirs:-6}, ostrich:{mine:4,theirs:0}, honeybadger:{mine:2,theirs:1}, triceratops:{mine:190,theirs:-25}, mammoth:{mine:81,theirs:-20}, blackbear:{mine:11,theirs:-9}, leopard:{mine:14,theirs:3}, boar:{mine:19,theirs:-3}, giantkangaroo:{mine:6,theirs:-6}, smilodon:{mine:16,theirs:-6}, wolfpack:{mine:19,theirs:-6}, wolfpack6:{mine:25,theirs:-7}, hyenapack:{mine:17,theirs:-12}, lionpack:{mine:21,theirs:-15}, buffaloherd:{mine:129,theirs:-35}, bisonherd:{mine:134,theirs:-27}};
// ---------- board rules ----------
// Each game deals a board of RULES.board animals from the roster (a rare animal turns up with probability rareP).
// You spend up to RULES.budget on the board; every board animal you don't pick is on the other side.
// With RULES.total set, every board's prices add up to total (± tol), so every board has the same total value
// and you always buy the same share of it. rules.terrain (optional) keeps cold-blooded animals off cold maps.
// Wolves, hyenas and lions are dealt either solo or as a pack item (one pick brings the whole group).
const RULES = {board: 12, budget: 1200, total: 2600, tol: 100, rareP: .3}; // owner: $1,000 felt hard; see CLAUDE.md for validation
function dealBoard(seed, rules, prices){
  rules = Object.assign({}, RULES, rules || {});
  const R = rng(seed), price = id => (prices && prices[id]) || BY_ID[id].price;
  // cold-blooded animals (the croc) are never dealt on a cold map; each species appears once, solo or as a pack
  const cold = rules.terrain && (TERRAINS[rules.terrain] || {}).cold, ok = a => !(cold && a.cold < .3);
  const ex = rules.exclude || null; // ids never dealt (migration: animals you already own)
  const cap = rules.maxPrice || 0; // progressive mode: only animals at or under this price (0 = no cap)
  const forms = {}; for (const a of ANIMALS) if (ok(a) && !(ex && ex.includes(a.id)) && !(cap && price(a.id) > cap)) (forms[sp(a)] = forms[sp(a)] || []).push(a.id);
  const common = Object.keys(forms).filter(k => !BY_ID[k].rare), rare = Object.keys(forms).filter(k => BY_ID[k].rare);
  // pick solo or pack by dealWeight (wolves come as a pack 3 times in 4: that's how real wolves hunt)
  const form = k => { const f = forms[k], tw = f.reduce((s, id) => s + (BY_ID[id].dealWeight || 1), 0); let r = R() * tw; for (const id of f){ r -= BY_ID[id].dealWeight || 1; if (r <= 0) return id; } return f[f.length - 1]; };
  let b = [];
  for (let tries = 0; tries < 20000; tries++){
    const pool = common.slice(); b = [];
    if (rare.length && R() < rules.rareP) b.push(form(rare[Math.floor(R() * rare.length)]));
    while (b.length < rules.board && pool.length) b.push(form(pool.splice(Math.floor(R() * pool.length), 1)[0]));
    if (!rules.total || Math.abs(b.reduce((s, id) => s + price(id), 0) - rules.total) <= rules.tol) break;
  }
  return ANIMALS.map(a => a.id).filter(id => b.includes(id)); // roster order
}

// ---------- run helpers ----------
function simulate(cfg, record){
  const w = setup(cfg);
  const frames = record ? [] : null;
  let k = 0;
  if (record) frames.push(snapshot(w));
  while (!w.over){ step(w); if (record && (++k % 2 === 0 || w.over)) frames.push(snapshot(w)); }
  w.frames = frames;
  return w;
}
function snapshot(w){
  return { t:w.t, u: w.units.map(u => [u.x, u.y, u.hp / u.maxhp, u.heat, u.state, u.target ? u.target.id : -1, u.latchOn ? u.latchOn.id : -1, active(u) ? 1 : (u.escaped ? 2 : 0), u.stun > 0 ? 1 : 0, heightOf(u), u.morale, u.stam, u.cornerT > 0 ? 1 : 0, u.heatstroke ? 1 : 0, u.sated ? 1 : 0, u.mv ? u.mv.k : (u.state === 'engage' && u.s.gait === 'stalk' && u.target && dist(u, u.target) > (u.s.pounce || 0) + 1 ? 'stalk' : '')]),
    c: w.carcasses.map(c => [c.x, c.y, c.meat]), ne: w.events.length };
}
function summarize(w){
  return {
    survived: w.result.survived, t: w.result.t, score: w.result.score, why: w.result.why || null, killer: w.result.killer || null,
    units: w.units.map(u => ({id:u.s.id, side:u.side, alive:active(u), escaped:u.escaped, dealt:Math.round(u.st.dealt), taken:Math.round(u.st.taken), kills:u.st.kills, protect:Math.round(u.st.protect), killedBy:u.killedBy}))
  };
}
function randomDraft(R, budget){
  budget = budget || 1000;
  const pool = ANIMALS.slice(); const team = []; let left = budget;
  while (true){
    const ok = pool.filter(a => a.price <= left && !team.includes(a.id));
    if (!ok.length) break;
    const a = ok[Math.floor(R() * ok.length)]; team.push(a.id); left -= a.price;
  }
  return team;
}

// ---------- learned-policy hooks (policy/) ----------
// With cfg.policy set, an enemy predator's retarget (feed / a target / roam) is decided by policy/policy.js, which
// registers itself as INTERNALS.choose. predCandidates = the targets predatorTarget would consider: keep its filters in
// sync with predatorTarget's (hostile, seen or the human within 70 m, the waterbound rule, reachable height).
function predCandidates(w, u){
  const out = [];
  for (const t of w.units){
    if (!hostile(w, u, t)) continue;
    if (!canSee(w, u, t) && !(t.side === 'H' && dist(u, t) < 70)) continue;
    if (has(u,'waterbound') && w.wet && distWater(w, t) > 5) continue;
    if (!reachable(u, t)) continue;
    out.push(t);
  }
  return out;
}
// With cfg.movePolicy = {<archetype>: weights}, units of that archetype pick a movement intent every ~0.5 s while
// engaged (policy/move_policy.js registers INTERNALS.moveChoose); the engine still does the steering. Intent 0 = commit
// returns false: the caller runs the usual waitForOpening / gaitMove chain, so a policy that always commits is the
// heuristic. Any other intent returns true with its move in u.intentGo ({tx, ty, frac}, or null if a gait move took
// over). Other-side archetypes by gait: 'harrier' = orbit (wolf, hyena and their packs), 'cat' = stalk / rush (tiger,
// jaguar, cougar, leopard, smilodon, lion, lion coalition), 'charger' = charge (rhinos, hippo, buffalo / bison and their
// herds, bull, moose, boar, triceratops), 'bulldozer' = lumbering herbivores (elephant, mammoth, gorilla), 'brawler' =
// lumbering predators (grizzly, polar, black bear, honey badger), 'kicker' = keepaway (giraffe, ostrich, giant kangaroo).
// The croc (lunge) stays heuristic. Only a unit whose archetype has weights in cfg.movePolicy is affected.
const INTENTS = ['commit', 'wait', 'flank', 'regroup', 'disengage'];
const ARCH_GAIT = {orbit: 'harrier', stalk: 'cat', rush: 'cat', charge: 'charger', keepaway: 'kicker'};
function archetypeOf(u){
  if (u.side === 'E'){ const g = u.s.gait; return g === 'lumber' ? (u.s.pred ? 'brawler' : 'bulldozer') : ARCH_GAIT[g] || null; }
  return u.side === 'P' && !u.rider ? 'guard' : null;
}
// per-archetype geometry of the generic intents: wait = circle at R m (radial gain g, speed fraction f); flank = the rear
// point this far beyond touching (then the usual gait move from there: a cat pounces, a charger charges from behind);
// disengage = back off this far beyond reach. A charger waits and backs off far enough to start a charge (5-32 m); a cat
// waits just outside its pounce range at a creep (tall-grass cover holds below 45% of its speed).
const INTENT_GEO = {
  harrier:   {R: () => 16, g: .25, f: .45, flank: () => 3.2, ff: .8, back: 10},
  cat:       {R: u => Math.max(12, (u.s.pounce || 5) + 4), g: .25, f: .3, flank: u => Math.max(2.5, Math.min(6, (u.s.pounce || 5) - 1.5)), ff: .7, back: 12},
  charger:   {R: () => 20, g: .25, f: .35, flank: () => 12, ff: .7, back: 14},
  bulldozer: {R: () => 12, g: .25, f: .35, flank: () => 3, ff: .7, back: 10},
  brawler:   {R: () => 10, g: .3, f: .4, flank: () => 3, ff: .8, back: 10},
  kicker:    {R: () => 14, g: .25, f: .4, flank: () => 3, ff: .7, back: 12},
};
// same-species allies (packmates, herd members, or just the same kind) for 'regroup'
const kinOf = (u, o) => o !== u && o.side === u.side && active(o) && sp(o.s) === sp(u.s);
function intentMove(w, u, t, d, touch, vmax){ const m = intentGo(w, u, t, d, touch, vmax); if (m === false) return false; u.intentGo = m; return true; }
function intentGo(w, u, t, d, touch, vmax){
  const arch = archetypeOf(u), P = arch && w.cfg.movePolicy[arch];
  if (!P) return false;
  if (arch === 'guard') return guardGo(w, u, t, d, touch);
  if (!INTERNALS.moveChoose) throw new Error('cfg.movePolicy is set but no movement policy is loaded: require policy/move_policy.js');
  if (u.intentFor !== t || !(u.intentT > DT / 2)){ u.intentFor = t; u.intentT = .5; u.intent = INTERNALS.moveChoose(w, u, t, d, P, arch); }
  else u.intentT -= DT;
  const k = u.intent, rx = (u.x - t.x) / (d || 1), ry = (u.y - t.y) / (d || 1), G = INTENT_GEO[arch], circle = (R0, g, f) => {
    const vx = -ry * u.orbitDir + rx * (R0 - d) * g, vy = rx * u.orbitDir + ry * (R0 - d) * g, m = Math.hypot(vx, vy) || 1;
    return {tx: u.x + vx / m * 5, ty: u.y + vy / m * 5, frac: f}; };
  if (!k) return false; // commit: the heuristic
  if (P.set === 'cat' && arch === 'cat') return catGo(w, u, t, d, touch, vmax, k); // the cat-specific intent set (CAT_INTENTS)
  if (k === 1) return circle(G.R(u), G.g, G.f); // wait for an opening: shadow from a distance that fits the gait (harrier ~16 m, as waitForOpening does)
  if (k === 2){ // flank: get round behind the target (opposite the way it faces), then the usual gait move from there (dart, pounce, charge)
    let hx = t.vx, hy = t.vy; if (Math.hypot(hx, hy) < .5 && t.target && active(t.target)){ hx = t.target.x - t.x; hy = t.target.y - t.y; }
    const hm = Math.hypot(hx, hy); if (hm < 1e-6) return gaitMove(w, u, t, d, touch, vmax);
    const ro = t.r + u.r + G.flank(u), px = t.x - hx / hm * ro, py = t.y - hy / hm * ro;
    if (Math.hypot(px - u.x, py - u.y) < 2.5) return gaitMove(w, u, t, d, touch, vmax);
    let vx = px - u.x, vy = py - u.y; const m = Math.hypot(vx, vy) || 1; vx /= m; vy /= m;
    if (d < ro + 1){ vx += rx * (ro + 1 - d) * .6; vy += ry * (ro + 1 - d) * .6; } // swing wide instead of cutting through it
    return {tx: u.x + vx * 5, ty: u.y + vy * 5, frac: G.ff};
  }
  if (k === 3){ // regroup: close on the packmates (harrier) / same-species allies, herd members included, then hang back with them
    const mate = arch === 'harrier' ? packMate : kinOf;
    let cx = 0, cy = 0, n = 0; for (const o of w.units) if (mate(u, o) && dist(u, o) < 40){ cx += o.x; cy += o.y; n++; }
    if (!n) return circle(G.R(u), G.g, G.f);
    cx /= n; cy /= n; const m = Math.hypot(cx - u.x, cy - u.y);
    return m < 3 ? circle(Math.max(d, 10), .25, .3) : {tx: cx, ty: cy, frac: .7};
  }
  return {tx: t.x + rx * (touch + G.back), ty: t.y + ry * (touch + G.back), frac: .7}; // disengage: back off out of reach (harrier ~10 m; a charger to charging room)
}
// Cat-specific intents (cfg.movePolicy.cat with weights.set === 'cat'; policy/move_cat_features.js): the decisions a big
// cat lives on, which the generic intents can't express. 0 commit = the heuristic (stalk, creep while unseen, pounce from
// pounce range). Any intent that doesn't apply right now returns false = the heuristic for this tick.
//   1 pounce    spring now from up to 1.3× pounce range (the heuristic waits for pounce range)
//   2 creep     close at a creep (tall-grass cover holds below 45% speed) toward the target's rear, pounce from range
//   3 abandon   spotted: withdraw to ~18 m and lie low; ~8 s out of the action with nothing after it restores the ambush
//               (the engine's own catSense rule), then re-approach
//   4 soften    switch to the softest reachable prey within 25 m (hurt, busy, held, running, unguarded, you), held 4 s
//   5 cover     hold still in cover (beside a trunk within 10 m, else flat in the grass); prey that wanders into pounce
//               range is pounced (the heuristic's ambush)
//   6 blindside circle wide to the point behind the target (its heading: velocity, else toward its own target), then
//               the heuristic pounce from there
const CAT_INTENTS = ['commit', 'pounce', 'creep', 'abandon', 'soften', 'cover', 'blindside'];
const CAT_GEO = {pounceX: 1.3, creep: .3, abandonR: 18, abandonF: .55, softR: 25, softHold: 4, softEdge: 1.2, coverR: 10, coverF: .3, blindF: .42, behind: -.5};
function headingOf(t){
  let hx = t.vx, hy = t.vy; if (Math.hypot(hx, hy) < .5 && t.target && active(t.target)){ hx = t.target.x - t.x; hy = t.target.y - t.y; }
  const m = Math.hypot(hx, hy); return m < 1e-6 ? null : {x: hx / m, y: hy / m};
}
// how soft a target is for this cat (pure): hurt, busy / held / running / stunned, few guards, within its strength; you ×1.3
function catSoftness(w, u, o){
  const my = packStrength(w, u), easy = o.state === 'flee' || o.stun > 0 || !!o.latchedBy || !!o.heatstroke;
  return (1.5 - o.hp / o.maxhp) * (busy(o) ? 1.4 : 1) * (easy ? 1.5 : 1) * Math.min(2, my / strength(o)) / (1 + guardsAround(w, o, u) / my) * (o.side === 'H' ? 1.3 : 1);
}
function catSofter(w, u, t){
  let best = null, bs = catSoftness(w, u, t) * CAT_GEO.softEdge;
  for (const o of predCandidates(w, u)){ if (o === t || dist(u, o) > CAT_GEO.softR) continue; const s = catSoftness(w, u, o); if (s > bs){ bs = s; best = o; } }
  return best;
}
function catPounce(w, u, t, d, vmax){
  const dur = clamp(d / (u.s.spd * 1.6), .25, .6), px = t.x + t.vx * dur, py = t.y + t.vy * dur;
  u.mv = {k:'pounce', vx:(px - u.x) / dur * .95, vy:(py - u.y) / dur * .95, t:dur, tgt:t};
  if (d > 6) log(w, `${capName(u)} pounces ${Math.round(d)} m onto ${nameOf(t)}`, 'pounce', u);
  commitMove(w, u, vmax); return null;
}
function catGo(w, u, t, d, touch, vmax, k){
  const P = u.s.pounce || 5, G = CAT_GEO, rx = (u.x - t.x) / (d || 1), ry = (u.y - t.y) / (d || 1);
  if (k === 1) return d <= P * G.pounceX && d > touch * .8 && u.pounceCd <= 0 && u.stam > .2 && reachable(u, t) ? catPounce(w, u, t, d, vmax) : false;
  if (k === 3){ if (d < G.abandonR) return {tx: t.x + rx * (G.abandonR + 2), ty: t.y + ry * (G.abandonR + 2), frac: G.abandonF}; return {tx: u.x, ty: u.y, frac: 0}; }
  if (k === 4){
    const o = catSofter(w, u, t); if (!o) return false;
    u.cT = o; u.cTT = w.t + G.softHold; u.target = o; u.intentFor = null; // chooseTarget keeps it for softHold s; decide again for the new prey
    const od = dist(u, o); return gaitMove(w, u, o, od, u.r + o.r + u.s.reach * .6, vmax);
  }
  if (d <= P) return false; // creep / cover / blind side: in pounce range the heuristic springs
  if (k === 5){
    let bt = null, bd = G.coverR; for (const tr of w.trees){ const q = Math.hypot(tr.x - u.x, tr.y - u.y) - tr.r; if (q < bd && !outsideZone(w, tr)){ bd = q; bt = tr; } }
    if (!bt) return {tx: u.x, ty: u.y, frac: 0}; // flat in the grass
    const ox = bt.x - t.x, oy = bt.y - t.y, om = Math.hypot(ox, oy) || 1, px = bt.x + ox / om * (bt.r + u.r + .3), py = bt.y + oy / om * (bt.r + u.r + .3);
    return Math.hypot(px - u.x, py - u.y) < 1 ? {tx: u.x, ty: u.y, frac: 0} : {tx: px, ty: py, frac: G.coverF};
  }
  const h = headingOf(t), behind = h && rx * h.x + ry * h.y < G.behind;
  if (k === 2){
    if (!h || behind) return {tx: t.x, ty: t.y, frac: G.creep};
    const ro = t.r + u.r + P * .8; let vx = t.x - h.x * ro - u.x, vy = t.y - h.y * ro - u.y; const m = Math.hypot(vx, vy) || 1; vx /= m; vy /= m;
    if (d < ro + 1){ vx += rx * (ro + 1 - d) * .6; vy += ry * (ro + 1 - d) * .6; }
    return {tx: u.x + vx * 5, ty: u.y + vy * 5, frac: G.creep};
  }
  // 6 blind side
  if (!h || behind) return false; // already behind it (or it has no heading): the heuristic closes and pounces
  const ro = t.r + u.r + Math.max(2.5, P * .7), px = t.x - h.x * ro, py = t.y - h.y * ro;
  if (Math.hypot(px - u.x, py - u.y) < 2.5) return false;
  let vx = px - u.x, vy = py - u.y; const m = Math.hypot(vx, vy) || 1; vx /= m; vy /= m;
  if (d < ro + 2){ vx += rx * (ro + 2 - d) * .6; vy += ry * (ro + 2 - d) * .6; } // swing wide, not across its front
  return {tx: u.x + vx * 5, ty: u.y + vy * 5, frac: G.blindF};
}
// Guard archetype (cfg.movePolicy.guard): your side's animals that aren't carrying you, in 'guard' state or engaged.
// guardDecide (decisions loop) picks an intent every 0.5 s; 0 hold = the heuristic. screen / intercept / help also set
// u.gT, which chooseTarget keeps as the target until the next decision; screen / space out / fall back steer
// (guardGo while engaged, guardIdleGo in guard state). Without cfg.movePolicy.guard none of this runs.
const GUARD_INTENTS = ['hold', 'screen', 'intercept', 'space', 'help', 'fallback'];
const GUARD_SPACE = 8, GUARD_SCREEN = 5, GUARD_NEAR = 3;
function sideSees(w, e){ for (const a of w.units) if (a.side !== 'E' && active(a) && canSee(w, a, e)) return true; return false; } // teamSees without its lookout side effect
// the most threatening enemy to you: aimed at you or heading your way (within 25 m); unless onlyComing, also anything within 12 m
function guardThreat(w, u, onlyComing){
  const H = w.human; let best = null, bs = 0;
  for (const e of w.units){
    if (e.side !== 'E' || !active(e) || e.state === 'flee' || e.heatstroke) continue;
    const dh = dist(e, H); if (dh > 10 && !sideSees(w, e)) continue;
    const v = Math.hypot(e.vx, e.vy), toward = v > 1.5 && dh < 25 && ((H.x - e.x) * e.vx + (H.y - e.y) * e.vy) / ((dh || 1) * v) > .7;
    const intent = e.target === H || e.latchOn === H ? 1 : toward ? .5 : !onlyComing && dh < 12 ? .25 : 0;
    if (!intent || (u && !reachable(u, e))) continue;
    const sc = intent * strength(e) / (1 + dh / 10);
    if (sc > bs){ bs = sc; best = e; }
  }
  return best;
}
// the strongest enemy on the most hurt of your animals that is in a fight
function guardHelpTarget(w, u){
  let best = null, bh = 2;
  for (const a of w.units){
    if (a === u || a.side !== 'P' || !active(a) || a.withdrawn) continue;
    let att = null, as = 0;
    for (const e of w.units) if (e.side === 'E' && active(e) && (e.target === a || e.latchOn === a) && dist(e, a) < e.r + a.r + e.s.reach + 3 && (!u || reachable(u, e))){ const s = strength(e); if (s > as){ as = s; att = e; } }
    if (att && a.hp / a.maxhp < bh){ bh = a.hp / a.maxhp; best = att; }
  }
  return best;
}
function guardDecide(w, u){
  if (u.rider || u.withdrawn || u.latchOn || !(u.state === 'guard' || u.state === 'engage')) return;
  if (!INTERNALS.moveChoose) throw new Error('cfg.movePolicy is set but no movement policy is loaded: require policy/move_policy.js');
  u.gIntentT = (u.gIntentT || 0) - DT; if (u.gIntentT > DT / 2) return;
  u.gIntentT = .5;
  const t = u.target && active(u.target) ? u.target : null;
  const k = u.gIntent = INTERNALS.moveChoose(w, u, t, t ? dist(u, t) : 0, w.cfg.movePolicy.guard, 'guard');
  u.gT = k === 1 ? guardThreat(w, u, false) : k === 2 ? guardThreat(w, u, true) : k === 4 ? guardHelpTarget(w, u) : null;
  if (u.gT){ u.target = u.gT; u.state = 'engage'; }
}
function guardSpot(u, H, dx, dy, r, near){ // a point r m from you in direction (dx, dy); null when already there
  const m = Math.hypot(dx, dy); if (m < 1e-6){ dx = u.x - H.x; dy = u.y - H.y; } const n = Math.hypot(dx, dy) || 1;
  const tx = H.x + dx / n * r, ty = H.y + dy / n * r, g = Math.hypot(tx - u.x, ty - u.y);
  return g < (near || 1) ? {tx: u.x, ty: u.y, frac: 0} : {tx, ty, frac: g > 6 ? .8 : .45};
}
function guardGo(w, u, t, d, touch){
  const k = u.gIntent || 0, H = w.human;
  if (!k || k === 2 || k === 4) return false; // hold, intercept, help: the heuristic chase of the (possibly re-chosen) target
  const hd = dist(u, H);
  if (k === 1){ // screen: stand between you and the threat, ~5 m out; fight it once it arrives
    if (t !== u.gT || d < touch + 2) return false;
    return guardSpot(u, H, t.x - H.x, t.y - H.y, GUARD_SCREEN, 1.2);
  }
  if (k === 3){ // space out: fight >= 8 m from you, from the far side of the target, so its sweeps and charges point away from you
    const ex = t.x - H.x, ey = t.y - H.y, em = Math.hypot(ex, ey) || 1, ux = ex / em, uy = ey / em;
    const rx = (u.x - t.x) / (d || 1), ry = (u.y - t.y) / (d || 1), side = rx * ux + ry * uy;
    if (hd >= GUARD_SPACE && side > .3) return false;
    if (side > .3 || d > touch + 6) return guardSpot(u, H, ex, ey, Math.max(GUARD_SPACE + 2, em + touch));
    let sx = -ry, sy = rx; if (sx * ux + sy * uy < 0){ sx = -sx; sy = -sy; } // swing round it, not through it
    const g = (touch + 1 - d) * .5, vx = sx + rx * g, vy = sy + ry * g, m = Math.hypot(vx, vy) || 1;
    return {tx: u.x + vx / m * 5, ty: u.y + vy / m * 5, frac: .8};
  }
  if (hd > GUARD_NEAR + 1.5) return guardSpot(u, H, u.x - H.x, u.y - H.y, GUARD_NEAR); // fall back: get back beside you
  return d < touch + 1 ? false : {tx: u.x, ty: u.y, frac: 0}; // and only fight what is in reach there
}
function guardIdleGo(w, u){
  const k = u.gIntent, H = w.human, hd = Math.hypot(u.homeDx, u.homeDy);
  if (k === 3) return hd >= GUARD_SPACE + 1 ? null : guardSpot(u, H, u.homeDx, u.homeDy, GUARD_SPACE + 1);
  if (k === 5) return guardSpot(u, H, u.homeDx, u.homeDy, GUARD_NEAR);
  return null;
}
const INTERNALS = { choose: null, predCandidates, predatorTarget, bestCarcass, guardsAround, packStrength, packMates, packMate, strength, hostile, canSee, reachable, distWater, inWater, busy, yieldsTo, wound, heightOf, pressure, active, has, dist, sp, social };
Object.assign(INTERNALS, { moveChoose: null, LIVE: {harrier: null, guard: null}, INTENTS, CAT_INTENTS, CAT_GEO, catSoftness, catSofter, headingOf, archetypeOf, drive, locked, GUARD_INTENTS, GUARD_SPACE, guardThreat, guardHelpTarget, sideSees, evasiveMount, zoneAt });
function policyChoose(w, u){
  if (!INTERNALS.choose) throw new Error('cfg.policy is set but no policy is loaded: require policy/policy.js');
  INTERNALS.choose(w, u, w.cfg.policy);
}

const API = { _internals: INTERNALS, MEASURED, RULES, BOONS, LEVEL_FX, dealBoard, defaultMount, mapVariant, baseVariant, ESCORT_R, POST_R, zoneAt, ZONE_T0, ZONE_T1, HAZARD_NAME, zoneFor, homeFor, placeOK, clampPlace, defaultPost, snowFactor, heatLoad, QUIET_T, STYLE, ANIMALS, HUMAN, BY_ID, TERRAINS, W, H, DT, MATCH_T, setup, step, simulate, snapshot, summarize, randomDraft, defaultPlacement, rng, hpOf, radiusOf };
if (typeof module !== 'undefined' && module.exports){
  module.exports = API;
  try { require('./policy/live.js'); } catch (e){ if (e.code !== 'MODULE_NOT_FOUND') throw e; } // learned policies (absent next to a stray copy of sim.js)
} else root.Arena = API;
})(typeof window !== 'undefined' ? window : globalThis);
