// ===== Wild Arena simulation engine (pure, no DOM) =====
(function (root) {
'use strict';

const W = 100, H = 66, DT = 0.1, MATCH_T = 300, QUIET_T = 30;

// Real-biology-grounded stats. mass kg, spd m/s top speed, dmg per strike, cd s between strikes,
// armor 0-1, reach m, stam = seconds of sprint, heat = heat tolerance (1 normal), cold = cold tolerance,
// water = aquatic affinity (-1..1), aggr, flee = morale break point, corner = cornered damage mult,
// lift = height it can strike up to (leap / rear), climb = can climb trees.
// swim = speed in deep water, m/s (real swimming/bottom-walking speed, not a fraction of sprint speed).
// tag aquaStalk = hides submerged like a croc, lunges out of the water, first strike from the water is an ambush.
const ANIMALS = [
 {id:'elephant', name:'African Elephant', abbr:'ELE', price:400, mass:6000, spd:7, dmg:260, cd:1.6, armor:.35, reach:3.5, stam:20, heat:.8, cold:.6, water:.5, swim:1.5, aggr:.55, flee:.15, corner:1.3, pred:false, charge:true, smart:.95, vision:40, lift:0, tags:['hatesPredators','mount','sweep'],
  traits:['Rideable: you sit 3.2 m up, out of reach of anything that cannot leap that high','Mobs predators on sight','Tusk, trunk and stomp: momentum hits scatter anything smaller']},
 {id:'rhino', name:'White Rhino', abbr:'RHI', price:400, mass:2300, spd:14, dmg:180, cd:1.4, armor:.55, reach:2.6, stam:15, heat:.8, cold:.55, water:0, swim:1, aggr:.4, flee:.12, corner:1.3, pred:false, charge:true, smart:.3, vision:18, lift:0, tags:[],
  traits:['Thickest armor on the board','Placid grazer with poor eyesight: slow to anger, but a full charge is devastating','Fastest heavyweight charge (50 km/h)']},
 {id:'hippo', name:'Hippo', abbr:'HIP', price:400, mass:2000, spd:8, dmg:230, cd:1.3, armor:.5, reach:2.5, stam:8, heat:.5, cold:.4, water:.9, swim:2.5, aggr:.9, flee:.1, corner:1.3, pred:false, charge:true, smart:.4, vision:25, lift:0, tags:['territorial','sunburn'],
  traits:['Bone-crushing bite, the most aggressive animal here','In water: faster, cooler, territorial','On dry land: sunburns and overheats']},
 {id:'giraffe', name:'Giraffe', abbr:'GIR', price:400, mass:1200, spd:15, dmg:120, cd:1.8, armor:.2, reach:3, stam:25, heat:1, cold:.5, water:-.6, swim:0.8, aggr:.2, flee:.5, corner:1.4, pred:false, charge:false, smart:.5, vision:60, lift:0, tags:['lookout','kicker'],
  traits:['Lookout: your whole team spots threats 50% farther away','Lethal kick, but only in self-defense','Cannot cover ground-level threats around you']},
 {id:'polar', name:'Polar Bear', abbr:'PBR', price:300, mass:500, spd:11, dmg:145, cd:1.0, armor:.4, reach:2.1, stam:12, heat:.4, cold:1, water:.85, swim:3, aggr:.85, flee:.2, corner:1.3, pred:true, charge:false, smart:.6, vision:30, lift:3.0, tags:['scavenger','aquaStalk','snowCamo'], prey:{human:1.6},
  traits:['Largest land carnivore, actively hunts humans; 10 cm of fat under dense fur blunts bites and claws','Aquatic stalk: hidden under water until 7 m, then surges out for an ambush strike (x1.7)','Overheats fast anywhere warm, but swimming cools it; dominant in snow, and white on white it is hard to spot until 15 m']},
 {id:'croc', name:'Saltwater Crocodile', abbr:'CRO', price:300, mass:1000, spd:4.5, dmg:220, cd:1.2, armor:.6, reach:2.2, stam:5, heat:1.1, cold:.2, water:1, swim:5, aggr:.8, flee:.15, corner:1.2, pred:true, charge:false, smart:.3, vision:20, lift:0, tags:['deathroll','waterbound','ambush'], prey:{human:1.3},
  traits:['Strongest bite measured: grabs and death-rolls in water','At home in water: almost invisible until 7 m. On land it is slow and tires fast, but the bite is just as deadly','Cold-blooded: never dealt on the tundra']},
 {id:'buffalo', name:'Cape Buffalo', abbr:'BUF', price:300, mass:750, spd:15, dmg:150, cd:1.2, armor:.4, reach:2.3, stam:20, heat:.9, cold:.6, water:.2, swim:1.5, aggr:.7, flee:.25, corner:1.5, pred:false, charge:true, smart:.6, vision:28, lift:0, tags:['vindictive','lionKiller'], rivals:{lion:3, tiger:1.8, hyena:1.6},
  traits:['Lion killer: +50% damage against big cats','Vindictive: hunts down whatever wounded it','Without a herd, it fights alone']},
 {id:'bison', name:'American Bison', abbr:'BIS', price:300, mass:900, spd:15, dmg:140, cd:1.3, armor:.35, reach:2.3, stam:40, heat:.75, cold:1, water:.2, swim:1.5, aggr:.5, flee:.42, corner:1.8, pred:false, charge:true, smart:.5, vision:28, lift:0, tags:['standsGround'],
  traits:['Runs when it can, fights furiously when cornered (x1.8)','Turns and stands its ground once wounded','Huge stamina; at home in snow']},
 {id:'grizzly', name:'Grizzly Bear', abbr:'GRZ', price:200, mass:320, spd:15, dmg:125, cd:.9, armor:.35, reach:2, stam:15, heat:.65, cold:.95, water:.3, swim:1.8, aggr:.6, flee:.25, corner:1.3, pred:true, charge:false, smart:.7, vision:30, lift:2.8, hpMul:1.2, tags:['scavenger'], prey:{human:.8}, rivals:{polar:1.3, wolf:1.3, cougar:1.4},
  traits:['Very hard to kill (+20% durability)','Takes kills from cougars and wolves','Scavenges carcasses aggressively']},
 {id:'tiger', name:'Bengal Tiger', abbr:'TIG', price:200, mass:220, spd:17, dmg:125, cd:.9, armor:.1, reach:2, stam:6, heat:.75, cold:.65, water:.5, swim:2, aggr:.7, flee:.3, corner:1.3, pred:true, latch:true, charge:false, smart:.7, vision:30, lift:3.6, tags:['ambush'], prey:{human:1.4},
  traits:['Throat hold: latches onto prey up to 2.5x its mass','Ambush first strike (x1.7, x2 in forest)','Can leap onto an elephant (3.6 m)']},
 {id:'lion', name:'African Lion', abbr:'LIO', price:200, mass:190, spd:20, dmg:105, cd:.9, armor:.15, reach:2, stam:5, heat:.95, cold:.55, water:-.3, swim:1.2, aggr:.65, flee:.35, corner:1.3, pred:true, latch:true, charge:false, smart:.6, vision:32, lift:3.0, tags:['mane','pack'], prey:{human:1.1}, rivals:{hyena:2.2},
  traits:['Mane protects the neck: throat holds do 40% less','Pride animal: nervous alone, bolder beside another pack animal (not hyenas)','Kills hyenas on sight']},
 {id:'gorilla', name:'Silverback Gorilla', abbr:'GOR', price:200, mass:180, spd:11, dmg:90, cd:1.0, armor:.15, reach:2, stam:10, heat:.8, cold:.5, water:-.8, swim:0.5, aggr:.35, flee:.4, corner:1.4, pred:false, charge:false, smart:.9, vision:25, lift:0, climb:true, tags:['guardian','bluff'],
  traits:['Guardian: sticks closest to you, +40% damage against anything targeting you','Bluff charge: first approach shakes the morale of smaller enemies','Climbs trees']},
 {id:'jaguar', name:'Jaguar', abbr:'JAG', price:100, mass:100, spd:16, dmg:85, cd:.9, armor:.05, reach:1.8, stam:6, heat:.9, cold:.5, water:.7, swim:2, aggr:.6, flee:.35, corner:1.3, pred:true, latch:true, charge:false, smart:.6, vision:28, lift:3.5, climb:true, pierce:.5, tags:['ambush'], prey:{human:.8},
  traits:['Skull bite ignores half of armor','Swims, climbs, ambushes','Small (100 kg)']},
 {id:'wolf', name:'Gray Wolf', abbr:'WLF', price:100, mass:45, spd:16, dmg:40, cd:.7, armor:.05, reach:1.6, stam:60, heat:.7, cold:1, water:.2, swim:1.5, aggr:.5, flee:.5, corner:1.3, pred:true, charge:false, smart:.8, vision:35, lift:0, tags:['hamstring','pack'], prey:{human:.6},
  traits:['Hamstring bites slow the target','Endless stamina','Pack hunter: nervous alone; with another pack animal it is bolder and they hunt the same target']},
 {id:'cougar', name:'Cougar', abbr:'CGR', price:100, mass:60, spd:18, dmg:55, cd:.8, armor:.05, reach:1.8, stam:5, heat:.8, cold:.85, water:-.2, swim:1.2, aggr:.45, flee:.6, corner:1.3, pred:true, latch:true, charge:false, smart:.6, vision:30, lift:5, climb:true, tags:['ambush','yields'], prey:{human:.8},
  traits:['Huge leap (5 m): can reach a rider or a tree','Gives way to bears and wolves','Ambusher']},
 {id:'hyena', name:'Spotted Hyena', abbr:'HYE', price:100, mass:60, spd:16, dmg:60, cd:.8, armor:.1, reach:1.6, stam:50, heat:.9, cold:.6, water:.1, swim:1.5, aggr:.55, flee:.45, corner:1.3, pred:true, charge:false, smart:.8, vision:35, lift:0, pierce:.3, hpMul:1.3, tags:['scavenger','hamstring','pack'], prey:{human:1.0}, rivals:{lion:1.3},
  traits:['Bone-crushing bite ignores 30% of armor','Tough (+30% durability) and tireless','Clan animal: bolder beside a wolf (never a lion); eats fast at carcasses']},
 // ---- added Oct 2026 (no portrait yet: shown as a lettered token) ----
 {id:'blackrhino', name:'Black Rhino', abbr:'BRH', price:300, mass:1200, spd:15, swim:1, dmg:160, cd:1.3, armor:.5, reach:2.3, stam:12, heat:.8, cold:.5, water:0, aggr:.8, flee:.1, corner:1.4, pred:false, charge:true, smart:.3, vision:15, lift:0, tags:['blindCharger'],
  traits:['The irritable rhino: half the weight of a white rhino, twice the temper','Poor eyesight: charges anything that moves within 18 m','Hooked lip, sharp front horn, turns quickly for a rhino']},
 {id:'bull', name:'Fighting Bull', abbr:'TOR', price:200, mass:550, spd:15.5, swim:1.5, dmg:150, cd:1.2, armor:.35, reach:2.2, stam:14, heat:.8, cold:.7, water:.2, aggr:.95, flee:.1, corner:1.4, pred:false, charge:true, smart:.4, vision:25, lift:0, tags:['bred'],
  traits:['Toro bravo: bred for centuries to charge, it never needs provoking','Turns fast for its size and keeps coming back','Tires in a long fight']},
 {id:'moose', name:'Moose', abbr:'MOO', price:300, mass:600, spd:15.5, swim:2.5, dmg:140, cd:1.0, armor:.3, reach:2.2, stam:30, heat:.5, cold:1, water:.6, aggr:.5, flee:.3, corner:1.5, pred:false, charge:true, smart:.5, vision:25, lift:0, tags:['standsGround'],
  traits:['Rears and strikes with its front hooves; kills more people than bears do in Alaska','Long legs: at home in deep snow, and a strong swimmer','Suffers in heat']},
 {id:'ostrich', name:'Ostrich', abbr:'OST', price:100, mass:120, spd:19, swim:.8, dmg:70, cd:1.0, armor:.05, reach:2, stam:30, heat:1.1, cold:.4, water:-.3, aggr:.35, flee:.45, corner:1.4, pred:false, charge:false, smart:.2, vision:55, lift:0, tags:['lookout','kicker'],
  traits:['Fastest runner on two legs (70 km/h), and it can keep it up','Forward kick with a 10 cm claw, but only in self-defense','Huge eyes on a 2.7 m frame: a lookout, and a fast (if wobbly) mount']},
 {id:'honeybadger', name:'Honey Badger', abbr:'HBD', price:100, mass:11, spd:8.5, swim:1, dmg:22, cd:.6, armor:.35, reach:1.2, stam:40, heat:.9, cold:.5, water:-.2, aggr:.9, flee:.02, corner:1.3, pred:true, charge:false, smart:.8, vision:20, lift:0, hpMul:1.5, tags:['fearless','hamstring'], prey:{human:.5},
  traits:['Fearless: its morale never breaks, whatever it faces','Thick, loose skin shrugs off bites; very hard to kill for its size','Goes for the legs']},
 {id:'triceratops', name:'Triceratops', abbr:'TRI', price:500, mass:8000, spd:8, swim:1.2, dmg:300, cd:1.5, armor:.5, reach:3.2, stam:15, heat:.8, cold:.6, water:.3, aggr:.6, flee:.1, corner:1.3, pred:false, charge:true, smart:.3, vision:25, lift:0, rare:true, tags:['hatesPredators','giant'],
  traits:['Rare: only turns up on the odd board','Eight tonnes, a bony frill and two 1 m brow horns','Rideable 3 m up; charges like a rhino the size of an elephant']},
 {id:'mammoth', name:'Woolly Mammoth', abbr:'MAM', price:500, mass:6000, spd:7, swim:1.5, dmg:260, cd:1.6, armor:.4, reach:3.6, stam:20, heat:.4, cold:1, water:.5, aggr:.55, flee:.15, corner:1.3, pred:false, charge:true, smart:.95, vision:40, lift:0, rare:true, tags:['hatesPredators','giant','sweep'],
  traits:['Rare: only turns up on the odd board','An elephant in a fur coat: shrugs off the cold, wilts in the heat','Huge curved tusks sweep everything in reach; rideable 3.2 m up']},
 {id:'blackbear', name:'Black Bear', abbr:'BBR', price:100, mass:120, spd:13.5, swim:1.8, dmg:75, cd:.9, armor:.25, reach:1.8, stam:15, heat:.7, cold:.9, water:.4, aggr:.35, flee:.4, corner:1.3, pred:true, charge:false, smart:.7, vision:25, lift:2.5, climb:true, tags:['scavenger'], prey:{human:.4},
  traits:['Usually timid: more bluster than fight','Climbs trees as easily as you do','A real fighter when cornered']},
 {id:'leopard', name:'Leopard', abbr:'LEO', price:100, mass:70, spd:16, swim:1.5, dmg:70, cd:.9, armor:.05, reach:1.8, stam:6, heat:.95, cold:.6, water:.4, aggr:.6, flee:.4, corner:1.3, pred:true, latch:true, charge:false, smart:.7, vision:30, lift:3.5, climb:true, tags:['ambush'], prey:{human:.9},
  traits:['Pound for pound the strongest climber of the big cats','Ambush first strike (x1.7, x2 in forest)','Throat hold on prey up to 2.5x its mass']},
 {id:'boar', name:'Wild Boar', abbr:'BOA', price:100, mass:150, spd:13, swim:1.5, dmg:75, cd:.8, armor:.3, reach:1.6, stam:20, heat:.7, cold:.85, water:.4, aggr:.7, flee:.2, corner:1.6, pred:false, charge:true, smart:.6, vision:20, lift:0, tags:['standsGround'],
  traits:['A big male: tusks that slash at thigh height','A shield of thick skin and gristle over the shoulders','Hard to put down, and fights hardest when cornered']},
];
// Fighting styles: how each animal moves and attacks. strikeH = highest point it can hit (m); mountH = rider height if it can carry you (0 = can't).
const STYLE = {
 elephant:{gait:'lumber', strikeH:5, mountH:3.2, style:'Bulldozer', how:'Wades in steadily. Every strike is a trunk-and-tusk sweep that also hits everything else within reach.'},
 rhino:{gait:'charge', strikeH:1.6, mountH:1.9, overshoot:9, turn:.15, wheel:1.6, style:'Battering ram', how:'Locks onto a line and charges blind. Barely steers, overshoots by 9 m, then wheels around slowly.'},
 hippo:{gait:'charge', strikeH:1.6, mountH:1.7, overshoot:2, maxRun:12, turn:.6, wheel:1.8, style:'Burst charger', how:'Explosive 12 m rushes, then has to stop and blow before the next one.'},
 giraffe:{gait:'keepaway', strikeH:3, mountH:2.7, style:'Kicker', how:'Holds attackers at leg length and kicks. Never closes in.'},
 polar:{gait:'lumber', strikeH:3, mountH:1.6, maul:true, style:'Heavy brawler', how:'Plods straight in and rears up; every third swipe is a full maul. In a river it swims submerged and surges out at prey on the bank.'},
 croc:{gait:'lunge', strikeH:1.2, mountH:0, style:'Ambush lunger', how:'Lies dead still, then lunges 6 m in half a second and clamps on.'},
 buffalo:{gait:'charge', strikeH:1.8, mountH:1.8, overshoot:4, turn:.9, wheel:.7, style:'Hooking charger', how:'Charges, drives through, and hooks straight back for another pass.'},
 bison:{gait:'charge', strikeH:1.8, mountH:2.0, overshoot:5, turn:1.4, wheel:.5, style:'Spinning charger', how:'Charges and pivots on a dime. The most agile heavyweight.'},
 grizzly:{gait:'lumber', strikeH:2.8, mountH:1.5, maul:true, style:'Brawler', how:'Bulls straight in; every third swipe is a full maul.'},
 tiger:{gait:'stalk', strikeH:3.6, mountH:1.2, pounce:9, style:'Stalker', how:'Creeps in low and slow, then pounces from 9 m.'},
 lion:{gait:'rush', strikeH:3, mountH:1.2, pounce:5, style:'Sprinter', how:'Fastest sprint here: rushes straight in and leaps the last 5 m.'},
 gorilla:{gait:'lumber', strikeH:2.4, mountH:1.5, style:'Bluffer', how:'Knuckle-walks in and bluff-charges first. Fights for real only if that fails.'},
 jaguar:{gait:'stalk', strikeH:3.5, mountH:0, pounce:7, style:'Stalker', how:'Creeps in, then pounces from 7 m for a skull bite.'},
 wolf:{gait:'orbit', strikeH:1.4, mountH:0, dart:1.1, style:'Harrier', how:'Circles at a distance, darts in to bite the legs, then backs out.'},
 cougar:{gait:'stalk', strikeH:5, mountH:0, pounce:12, style:'Leaper', how:'Stalks, then leaps from 12 m: the longest pounce on the board.'},
 hyena:{gait:'orbit', strikeH:1.4, mountH:0, dart:1.5, style:'Harrier', how:'Circles tirelessly and darts in for bone-crushing bites.'},
 blackrhino:{gait:'charge', strikeH:1.5, mountH:1.6, overshoot:7, turn:.4, wheel:1.0, style:'Short-fused ram', how:'Snorts, charges at anything it hears or glimpses, wheels around faster than its big cousin.'},
 bull:{gait:'charge', strikeH:1.7, mountH:1.6, overshoot:5, turn:1.2, wheel:.6, style:'Relentless charger', how:'Charges, hooks, spins and charges again. Never stops coming until it tires.'},
 moose:{gait:'charge', strikeH:2.4, mountH:2.0, overshoot:3, turn:1.0, wheel:.8, style:'Stomper', how:'Short charge, then rears up and rains front-hoof strikes.'},
 ostrich:{gait:'keepaway', strikeH:2, mountH:1.4, style:'Kickboxer', how:'Outruns trouble; if cornered, kicks forward and down with a dagger claw.'},
 honeybadger:{gait:'lumber', strikeH:.8, mountH:0, style:'Pest', how:'Trundles straight at anything, latches onto ankles and will not quit.'},
 mammoth:{gait:'lumber', strikeH:5, mountH:3.2, style:'Ice-age bulldozer', how:'Wades in steadily; every strike is a tusk-and-trunk sweep that also hits everything else within reach.'},
 blackbear:{gait:'lumber', strikeH:2.2, mountH:0, style:'Bluffer', how:'Huffs, swats and bluff-charges; brawls for real only when it has to.'},
 leopard:{gait:'stalk', strikeH:3.5, mountH:0, pounce:7, style:'Stalker', how:'Creeps in close under cover, then pounces from 7 m for the throat.'},
 boar:{gait:'charge', strikeH:1.0, mountH:0, overshoot:3, turn:1.5, wheel:.4, style:'Slasher', how:'Short, low charges with a sideways slash of the tusks, then spins and comes again.'},
 triceratops:{gait:'charge', strikeH:2.4, mountH:3.0, overshoot:6, turn:.3, wheel:1.5, style:'Living battering ram', how:'Lowers its frill and charges; brow horns at the height of a lion\'s chest.'},
};
ANIMALS.forEach(a => Object.assign(a, STYLE[a.id]));
// Pack items: the same species, but one pick brings several. A board deals a species solo or as a pack, never both.
for (const [id, n, groupName, price] of [['wolf', 3, 'Wolf pack', 300], ['hyena', 3, 'Hyena clan', 300], ['lion', 2, 'Lion pride', 400]])
  ANIMALS.push(Object.assign({}, ANIMALS.find(a => a.id === id), {id: id + 'pack', species: id, group: n, groupName, price}));
const HUMAN = {id:'human', name:'You', abbr:'YOU', price:0, mass:75, spd:6.5, dmg:6, cd:1, armor:0, reach:1.2, stam:8, heat:1, cold:.6, water:-.5, aggr:0, flee:0, corner:1, pred:false, charge:false, smart:1, vision:35, lift:0, swim:1, strikeH:1.8, mountH:0, gait:'human', climb:true, tags:[]};
const BY_ID = {}; ANIMALS.forEach(a => BY_ID[a.id] = a); BY_ID.human = HUMAN;

const TERRAINS = {
 savanna:{id:'savanna', name:'Savanna', amb:1.0, heatRamp:true, shade:6, hazard:'fire', desc:'Open and baking. The sun climbs as the fight goes on, so heat builds for everyone; big bodies cook first. A few acacias give shade worth fighting over. After a minute a grass fire closes in from the edges.'},
 river:{id:'river', name:'River', amb:.75, water:{x0:47, x1:57, fords:[[9,18],[47,56]]}, hazard:'flood', desc:'A river splits the field and the other side starts across it. Crocs and hippos hold the water, and everyone else has to swim it slowly. Two shallow fords are the only fast crossings, and a charge founders in deep water. After a minute flood water closes in from the edges; swimmers shrug it off.'},
 forest:{id:'forest', name:'Forest', amb:.55, trees:30, vision:.55, hazard:'fire', desc:'Trees block sight and slow big bodies. Cats ambush for double damage, and a charger that hits a tree is stunned. You can climb a tree. After a minute a forest fire closes in from the edges.'},
 tundra:{id:'tundra', name:'Tundra', amb:.08, cold:true, snow:true, hazard:'blizzard', desc:'Deep snow and cold. Heavy animals flounder (an elephant moves at about half speed), and the cold drains stamina. Polar bear, wolf, bison and cougar move freely. After a minute a blizzard closes in from the edges.'},
};

// ---------- utils ----------
function rng(seed){ let a = seed >>> 0; return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const radiusOf = m => 0.18 * Math.cbrt(m) + 0.9;
const hpOf = s => Math.round(22 * Math.pow(s.mass, 0.6) * (s.hpMul || 1));
const has = (u, t) => u.s.tags.includes(t);

function mkUnit(s, side, x, y, id){
  const hp = hpOf(s);
  return { id, s, side, x, y, vx:0, vy:0, hp, maxhp:hp, r:radiusOf(s.mass), stam:1, heat:0, morale:1, state:'idle',
    target:null, atk:0, stun:0, latchOn:null, latchedBy:null, slow:0, slowT:0, hunger:.45, sated:false,
    grudge:null, grudgeT:0, agit:s.aggr*.4, fleeT:0, cornerT:0, ambushReady:has({s},'ambush') || has({s},'aquaStalk'), bluffed:{}, riding:null, rider:null,
    feud:null, feudT:0, mv:null, pounceCd:0, chargeCd:0, dartT:0, strikes:0, orbitDir:1, onTree:null, climbT:0, carcass:null, feedT:0, heatstroke:false, retargetT:0, homeDx:0, homeDy:0, escaped:false,
    st:{dealt:0, taken:0, kills:0, protect:0, alive:0}, killedBy:null, deathT:null, lastHitBy:null };
}

// ---------- world setup ----------
function setup(cfg){
  // cfg: {team:[ids], placements:{id:{dx,dy}}, terrain, mode:'wild'|'allout', ride:bool, seed, board:[ids] (optional: only these animals are in the game)}
  const R = rng(cfg.seed || 1);
  const T = TERRAINS[cfg.terrain] || TERRAINS.savanna;
  const w = { t:0, lastPress:0, T, mode:cfg.mode || 'wild', units:[], carcasses:[], trees:[], events:[], R, over:false, result:null, cfg, nid:0, frames:null };
  const human = mkUnit(HUMAN, 'H', 22, 36, w.nid++); human.atk = 0; w.units.push(human); w.human = human;
  w.shade = [];
  { const hp = homeFor(T.id); human.x = hp.x; human.y = hp.y; }
  if (cfg.human){ const p = clampPlace(T.id, HUMAN, cfg.human.x, cfg.human.y); human.x = p.x; human.y = p.y; }
  human.home = {x: human.x, y: human.y};
  // trees
  if (T.trees){
    let tries = 0;
    while (w.trees.length < T.trees && tries++ < 500){
      const t = {x:6 + R()*(W-12), y:6 + R()*(H-12), r:1 + R()*1.2};
      if (Math.hypot(t.x-human.x, t.y-human.y) < 7 && Math.hypot(t.x-human.x, t.y-human.y) > 4.5 && !w.trees.some(o=>Math.hypot(o.x-human.x,o.y-human.y)<7)) { w.trees.push(t); continue; }
      if (w.trees.some(o => Math.hypot(o.x-t.x, o.y-t.y) < 7)) continue;
      if (Math.hypot(t.x-human.x, t.y-human.y) < 5) continue;
      w.trees.push(t);
    }
  }
  if (T.shade){
    let tries = 0;
    while (w.shade.length < T.shade && tries++ < 300){
      const t = {x:8 + R()*(W-16), y:8 + R()*(H-16), r:3.6 + R()*1.4};
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
    if (!p){ const dp = defaultPost(T.id, aid); p = dp ? {dx: dp.x - human.x, dy: dp.y - human.y} : defaultPlacement(team, aid, i); }
    const pos = clampPlace(T.id, s, human.x + p.dx, human.y + p.dy);
    const u = mkUnit(s, 'P', pos.x, pos.y, w.nid++);
    u.homeDx = pos.x - human.x; u.homeDy = pos.y - human.y; u.agit = .5;
    if (Math.hypot(u.homeDx, u.homeDy) > ESCORT_R && aid !== mountId) u.post = {x: pos.x, y: pos.y};
    w.units.push(u);
    if (aid === mountId && s.mountH > 0){ u.x = human.x; u.y = human.y; u.homeDx = 0; u.homeDy = 0; u.post = null; u.rider = human; human.riding = u; w.mount = u; }
    // a group item (wolf pack, hyena clan, lion pride) brings its packmates, placed around the leader
    for (let k = 1; k < groupSize(cfg, s); k++){
      const a = k * 2.4, q = clampPlace(T.id, s, pos.x + Math.cos(a) * 2.2, pos.y + Math.sin(a) * 2.2), m = mkUnit(s, 'P', q.x, q.y, w.nid++);
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
      if (T.water){
        if (s.water >= .9){ x = T.water.x0 + 2 + R() * (T.water.x1 - T.water.x0 - 4); if (inFord(w, y)) continue; }
        else { x = T.water.x1 + 5 + R() * (W - T.water.x1 - 9); }
      }
      if (s.id === 'croc' && !T.water) { x = 60 + R()*30; }
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
  if (w.mode === 'allout'){
    const es = w.units.filter(u => u.side === 'E');
    for (let i = es.length - 1; i > 0; i--){ const j = Math.floor(R() * (i + 1)); [es[i], es[j]] = [es[j], es[i]]; }
    es.forEach((u, i) => { u.releaseT = 1 + i * 9; u.penned = true; u.x = W - 2; u.y = 6 + (i % 6) * 10.8; });
  }
  // closing arena: a themed hazard (fire / flood / blizzard) closes in from the edges toward a point near mid-field
  if (T.hazard && w.mode === 'wild' && cfg.hazard !== false) w.zone = {kind: T.hazard, cx: W / 2 + (R() - .5) * 16, cy: H / 2 + (R() - .5) * 12};
  w.zb = zoneAt(w, 0);
  return w;
}

const ESCORT_R = 9, POST_R = 14;
// how many animals one pick brings (pack items bring their whole group); sp() = the species behind an item
function groupSize(cfg, s){ return s.group || 1; }
const sp = s => s.species || s.id;
function zoneFor(tid){ const T = TERRAINS[tid] || TERRAINS.savanna; return {x0: 2, x1: T.water ? T.water.x1 : 45, y0: 2, y1: H - 2}; }
function homeFor(tid){ const T = TERRAINS[tid] || TERRAINS.savanna; return T.water ? {x: 16, y: 33} : {x: 22, y: 36}; }
// where an animal may stand at deployment: inside your zone; only swimmers may start in deep water
function placeOK(tid, s, x, y){
  const T = TERRAINS[tid] || TERRAINS.savanna, z = zoneFor(tid);
  if (x < z.x0 || x > z.x1 || y < z.y0 || y > z.y1) return false;
  if (T.water && x >= T.water.x0 && x <= T.water.x1 && !T.water.fords.some(([a, b]) => y >= a && y <= b)) return s.water >= .8;
  return true;
}
function clampPlace(tid, s, x, y){
  const z = zoneFor(tid); x = clamp(x, z.x0, z.x1); y = clamp(y, z.y0, z.y1);
  const T = TERRAINS[tid] || TERRAINS.savanna;
  if (!placeOK(tid, s, x, y) && T.water) x = T.water.x0 - 1.5;
  return {x, y};
}
// swimmers start in the river by default on the river map: croc lurking beside a ford, hippo holding the deep water
function defaultPost(tid, aid){
  const T = TERRAINS[tid] || TERRAINS.savanna; if (!T.water) return null;
  const W0 = T.water, mid = (W0.x0 + W0.x1) / 2;
  if (aid === 'croc') return {x: W0.x0 + 2.5, y: W0.fords[0][1] + 3};
  if (aid === 'hippo') return {x: mid, y: (W0.fords[0][1] + W0.fords[1][0]) / 2};
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
const ZONE_T0 = 60, ZONE_T1 = 240, ZONE_W = 36, ZONE_H = 24;
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
// pack animals (tag 'pack') bond with any other pack animal on their side, except natural rivals (lion and hyena)
function packMate(u, o){ return o !== u && o.side === u.side && has(o, 'pack') && active(o) && !(u.s.rivals && u.s.rivals[sp(o.s)]) && !(o.s.rivals && o.s.rivals[sp(u.s)]); }
function packMates(w, u){ let n = 0; for (const o of w.units) if (packMate(u, o) && dist(u, o) < 15) n++; return n; }
function strength(u){ return Math.sqrt(Math.max(1,u.hp) * (u.s.dmg / u.s.cd)); }
function pressure(w){ return w.mode === 'wild' ? Math.min(1, w.t / 150) : 1; }
function inFord(w, y){ return w.T.water.fords.some(([a, b]) => y >= a && y <= b); }
function inBand(w, x){ return x >= w.T.water.x0 && x <= w.T.water.x1; }
function inWater(w, u){ return !!(w.T.water && inBand(w, u.x) && !inFord(w, u.y)); }
function onFord(w, u){ return !!(w.T.water && inBand(w, u.x) && inFord(w, u.y)); }
function distWater(w, u){ if (!w.T.water) return 1e9; const W0 = w.T.water; return u.x < W0.x0 ? W0.x0 - u.x : u.x > W0.x1 ? u.x - W0.x1 : (inFord(w, u.y) ? 1 : 0); }
function waterPoint(w, u){ const W0 = w.T.water; let y = u.y; for (const [a, b] of W0.fords) if (y >= a - 2 && y <= b + 2) y = (y - a < b - y) ? a - 4 : b + 4; return {x: (W0.x0 + W0.x1) / 2, y: clamp(y, 3, H - 3)}; }
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
  if (viewer.side !== 'E' && w.lookout) range *= 1.5;
  if (has(u, 'ambush') && u.ambushReady && u.state !== 'flee' && w.T.id === 'forest') range = Math.min(range, 9);
  if ((has(u, 'waterbound') || has(u, 'aquaStalk')) && inWater(w, u) && u.state !== 'flee') range = Math.min(range, 7);
  if (has(u, 'snowCamo') && w.T.snow && u.state !== 'flee') range = Math.min(range, 15);
  return dist(viewer, u) <= range;
}
function teamSees(w, u){
  for (const a of w.units) if (a.side !== 'E' && active(a) && canSee(w, a, u)) return true;
  return false;
}

// ---------- targeting ----------
function guardsAround(w, t, me){
  if (t.side === 'E') return 0;
  let g = 0;
  for (const u of w.units){
    if (u === t || u === me || !active(u) || u.side === 'E' || u.state === 'flee') continue;
    if (dist(u, t) < 7) g += strength(u) * (busy(u) ? .5 : 1); // a guard already in a fight deters less
  }
  return g;
}
function predatorTarget(w, u){
  let best = null, bs = 0;
  const my = strength(u);
  const expo = 0.3 + 0.4 * u.hunger;
  for (const t of w.units){
    if (!hostile(w, u, t)) continue;
    if (!canSee(w, u, t) && !(t.side === 'H' && dist(u, t) < 70)) continue;
    const d = dist(u, t);
    if (has(u,'waterbound') && w.T.water && distWater(w, t) > 5) continue; // a croc takes prey at the water's edge, never on open ground
    const ts = strength(t);
    let vuln = Math.min(4, Math.pow(my / ts, 1.2));
    if (has(u,'fearless')) vuln = Math.max(vuln, .6); // a honey badger takes on anything
    let sc = Math.pow(t.s.mass, expo) * vuln;
    if (ts > my * 2.5 && u.grudge !== t && !has(u,'fearless')) sc *= 0.05;
    if (t.s.id === 'elephant' || has(t,'giant')) sc *= 0.1;
    if (t.side === 'H') sc *= (u.s.prey && u.s.prey.human) || 1;
    if (w.mode === 'allout' && t.side === 'H') sc *= 6;
    if (t.side === 'E') sc *= 1.5; // a live feud gets settled first
    if (u.s.rivals && u.s.rivals[sp(t.s)]) sc *= u.s.rivals[sp(t.s)];
    if (has(u,'yields') && ['grizzly','polar','wolf'].includes(sp(t.s))) sc *= 0.15;
    const g = guardsAround(w, t, u) / my;
    sc /= (1 + g * .45);
    if (!reachable(u, t)) continue;
    if (u.grudge === t && d < 8) sc *= 3;
    if (t.state === 'flee' || t.latchedBy) sc *= 1.3;
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
  let R = 12 + 16 * u.agit + 30 * pressure(w);
  if (has(u,'territorial') && inWater(w,u)) R += 8;
  if (has(u,'blindCharger')) R = Math.max(R, 18);
  for (const t of w.units){
    if (!hostile(w, u, t)) continue;
    const d = dist(u, t);
    let sc = 0;
    if (u.grudge === t) sc = 5;
    if (d > R && sc === 0){
      if (has(u,'hatesPredators') && t.s.pred && d < 20) sc = 1.5; else continue;
    }
    if (sc === 0){
      if (t.s.pred) sc = 2;
      else if (t.side === 'P') sc = .6 + u.agit;           // intruders: your team
      else if (t.side === 'H') sc = .35 + u.agit * .6;     // you: a nuisance more than a target
      else sc = 1.5;                                        // an active feud
      if (has(u,'blindCharger') && Math.hypot(t.vx, t.vy) > 2) sc += t.side === 'E' ? .4 : 1.5;
      if (has(u,'kicker') && !(t.s.pred && d < 6)) sc = 0;
    }
    if (u.s.rivals && u.s.rivals[sp(t.s)]) sc *= u.s.rivals[sp(t.s)];
    if (has(u,'hatesPredators') && t.s.pred) sc *= 2;
    if (!reachable(u, t)) continue;
    if ((t.s.id === 'elephant' || has(t,'giant')) && u.s.id !== 'rhino') sc *= 0.3;
    if (u.target === t) sc *= 1.3;
    sc /= (1 + d / 10);
    if (sc > bs){ bs = sc; best = t; }
  }
  return bs > 0.08 ? best : null;
}
function nearestPlayer(w,u){ let b=null,bd=1e9; for(const t of w.units) if(t.side!=='E'&&active(t)){const d=dist(u,t); if(d<bd){bd=d;b=t;}} return b; }

function allyTarget(w, u){
  const H = w.human;
  const anchor = u.post || H;
  const leash = u.post ? POST_R : u.rider ? 9 : has(u,'guardian') ? 12 : 24;
  let best = null, bs = 0;
  const my = strength(u);
  for (const e of w.units){
    if (e.side !== 'E' || !active(e)) continue;
    if (!teamSees(w, e) && !(u.post && dist(u, e) < 10)) continue;
    if (has(u,'waterbound') && w.T.water && distWater(w, e) > 10) continue;
    const dh = dist(e, anchor), dm = dist(u, e);
    if (dh > leash && !(u.target === e && dh < leash + 8) && u.grudge !== e) continue;
    let intent = e.target === H ? 1 : (e.target && e.target.side === 'P') ? .5 : .25;
    if (u.post) intent = Math.max(intent, .7);
    if (e.state === 'feed') intent = .04;
    if (e.state === 'flee' || e.heatstroke) intent = .02;
    if (e.sated && e.target !== H) intent *= .3;
    let threat = intent * strength(e) / (1 + dh / 10);
    const rawRatio = my / strength(e);
    if (rawRatio < .35 && dh > 6 && u.grudge !== e && !has(u,'guardian')) continue; // small guards don't pick fights with giants
    const ratio = clamp(rawRatio, .25, 2.5);
    let sc = threat * Math.sqrt(ratio) / (1 + dm / 15);
    if (has(u,'guardian') && e.target === H) sc *= 2;
    if (u.s.rivals && u.s.rivals[sp(e.s)]) sc *= Math.sqrt(u.s.rivals[sp(e.s)]);
    if (has(u,'yields') && (e.s.id === 'grizzly' || e.s.id === 'polar')) sc *= .3;
    if (has(u,'kicker') && !(dm < 6 || u.grudge === e)) sc *= .1;
    if (!reachable(u, e)) sc *= .05;
    // spread coverage
    let others = 0; for (const a of w.units) if (a !== u && a.side === 'P' && active(a) && a.target === e && !(has(u,'pack') && packMate(u, a))) others++; // packmates gang up rather than spread
    sc *= Math.pow(.6, others);
    if (u.grudge === e && dm < 6) sc *= 2;
    if (u.target === e) sc *= 1.3;
    if (sc > bs){ bs = sc; best = e; }
  }
  return bs > .5 ? best : null;
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
    u.state = u.target ? 'engage' : 'guard';
    return;
  }
  // enemies
  if (u.s.pred){
    if (u.sated && w.mode === 'wild'){
      u.target = (u.grudge && active(u.grudge) && dist(u,u.grudge) < 6) ? u.grudge : null;
      u.state = u.target ? 'engage' : 'rest';
      return;
    }
    const h = predatorTarget(w, u);
    if (w.mode === 'wild' && u.hunger > .3){
      const c = bestCarcass(w, u);
      if (c.c && c.score > h.score * 1.0){ u.target = null; u.carcass = c.c; u.state = 'feed'; return; }
    }
    u.carcass = null;
    u.target = h.score > .3 ? h.t : null;
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
  if (ambushes && a.ambushReady && t.target !== a){ dmg *= w.T.id === "forest" ? 2 : 1.7; a.ambushReady = false; if (!opts.pounce) log(w, `${capName(a)} ambushes ${nameOf(t)}`, "ambush", a); }
  a.ambushReady = false;
  if (s.rivals && s.rivals[sp(t.s)] && has(a,'lionKiller')) dmg *= 1.5;
  if (has(a,'guardian') && a.side === 'P' && t.target === w.human) dmg *= 1.4;
  if (has(a,'deathroll') && opts.latch) dmg *= inWater(w, a) ? 2 : .5;
  if (opts.latch){ dmg *= .65; if (has(t,'mane')) dmg *= .6; }
  if (opts.pounce){ dmg *= 1.4; }
  if (opts.sweep){ dmg *= .35; }
  if (s.maul && !opts.latch && !opts.sweep){ a.strikes++; if (a.strikes % 3 === 0){ dmg *= 2; log(w, `${capName(a)} rears up and mauls ${nameOf(t)}`, 'maul', a); } }
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
  if (flank){ dmg *= 1.25; if (w.R() < .3) log(w, `${capName(a)} catches ${nameOf(t)} side-on`, 'flank', t); }
  let armor = t.s.armor * (1 - (s.pierce || 0)) * (opts.latch ? .5 : 1) * Math.max(.4, 1 - .1 * (mob - 1)) * (flank ? .5 : 1);
  if (t.s.id === 'croc') armor = inWater(w,t) ? Math.min(.8, armor + .1) : armor - .2;
  dmg *= (1 - armor);
  if (t.side === 'H' && t.riding) dmg *= 1;
  dmg = Math.max(1, dmg);
  applyDamage(w, a, t, dmg);
  // secondary effects
  if (has(a,'hamstring') && t.s.mass < 2500){ t.slow = .35; t.slowT = 4; }
  // knockback & stun from momentum
  if (!opts.latch && speedFrac > .55 && t.state !== 'dead'){
    const ratio = a.s.mass / t.s.mass;
    const kb = Math.min(7, ratio * speedFrac * s.spd * .12);
    if (kb > .4){
      const d = dist(a, t) || 1;
      t.x += (t.x - a.x) / d * kb; t.y += (t.y - a.y) / d * kb;
      if (ratio > 1.5){ t.stun = Math.max(t.stun, .5 + Math.min(1.2, ratio / 8)); }
      if (kb > 2.5) log(w, `${capName(a)} charges ${nameOf(t)}, knocking it back ${kb.toFixed(1)} m`, 'charge', t);
      if (t.latchedBy && ratio > .8){ release(w, t.latchedBy, 'thrown off'); }
    }
  }
  // rider dislodge
  if (t.rider && a.s.mass >= 150 && speedFrac > .6 && w.R() < .1 * Math.pow(clamp(a.s.mass / t.s.mass, 0, 2), 2) && t.state !== 'dead') throwRider(w, t, `${capName(a)} rammed it`, a);
  // latch attempt
  if (!opts.latch && !opts.sweep && s.latch && !a.latchOn && !t.latchedBy && t.state !== 'dead' && t.s.mass <= 2.5 * s.mass && heightOf(t) === 0 && w.R() < (opts.pounce ? .7 : .45)){
    a.latchOn = t; t.latchedBy = a;
    log(w, `${capName(a)} gets a hold on ${nameOf(t)}`, 'latch', t);
  }
  if (!opts.latch && has(a,'deathroll') && !a.latchOn && !t.latchedBy && t.state !== 'dead' && heightOf(t) === 0 && t.s.mass < 2500 && w.R() < (inWater(w, a) || inWater(w, t) ? .7 : .12)){
    a.latchOn = t; t.latchedBy = a;
    log(w, `${capName(a)} clamps its jaws on ${nameOf(t)}${inWater(w,a)?' and death-rolls':''}`, 'latch', t);
  }
}
function sweep(w, a, main){
  let n = 0;
  for (const o of w.units){
    if (o === main || !hostile(w, a, o) || heightOf(o) > a.s.strikeH) continue;
    if (dist(a, o) <= a.r + o.r + a.s.reach){ strike(w, a, o, {sweep:true}); n++; }
  }
  if (n) log(w, `${capName(a)} sweeps ${n + 1} attackers at once`, 'sweep', a);
}
function applyDamage(w, a, t, dmg){
  t.hp -= dmg; t.lastHitBy = a;

  a.st.dealt += dmg; t.st.taken += dmg;
  if (a.side === 'P' && t.target === w.human) a.st.protect += dmg;
  if (t.side !== 'H'){ t.grudge = a; t.grudgeT = 12; }
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
  if (!wet && u.s.water >= .9 && w.T.water) f *= .85;
  return f;
}
function speedOf(w, u){
  let v = u.s.spd;
  if (u.stam < .15) v *= .45; // exhausted
  v *= envFactor(w, u) / (inWater(w, u) && u.s.water >= .8 ? 1.2 : 1); // the swimmer damage bonus is not a speed bonus
  const wet = inWater(w, u);
  if (wet) v *= (u.s.swim || 1) / u.s.spd; // swimming speed, with the same fatigue/heat/slow modifiers
  else if (onFord(w, u) && u.s.water < .8) v *= .8;
  if (has(u,'waterbound') && !(w.T.water && distWater(w, u) < 4)) v *= .7; // a croc on land is slow and tires fast (its bite is as strong as ever)
  if (w.T.id === 'forest' && u.s.mass > 800) v *= .78;
  if (w.T.snow) v *= snowFactor(u.s);
  if (u.slowT > 0) v *= (1 - u.slow);
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
    u.pounceCd = Math.max(0, u.pounceCd - DT); u.chargeCd = Math.max(0, u.chargeCd - DT); u.dartT -= DT;
    if (u.mv && (u.state === 'flee' || u.heatstroke || u.latchedBy && u.mv.k !== 'wheel')) u.mv = null;
    u.agit = has(u,'bred') ? 1 : Math.max(u.s.aggr * .3, u.agit - .01 * DT); // a fighting bull is always worked up
    if (u.target && !active(u.target)) u.target = null;
    if (u.latchOn && !active(u.latchOn)) { u.latchOn = null; }
    // an aquatic stalker that has slipped back under and stayed off prey for ~4 s can ambush again
    if (!u.ambushReady && has(u,'aquaStalk') && inWater(w, u) && u.atk < -4 && !u.latchedBy) u.ambushReady = true;
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
    const floor = Math.min(.95, .4 + w.t / 120);
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
  }
  // morale
  for (const u of units){
    if (!active(u) || u.side === 'H') continue;
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
    if (has(u,'pack')){ const m = packMates(w, u); tgt += m ? Math.min(.2, .1 * m) : -.12; } // alone it's nervous; with its pack it's bold
    let fallen = 0; for (const o of units) if (o.side === u.side && o !== u && (o.state === 'dead' || o.escaped)) fallen++;
    tgt -= (u.side === 'E' ? .05 : .03) * fallen;
    if (u.side === 'E' && u.state !== 'flee') tgt += .25 * pressure(w);
    if (u.side === 'P') tgt += Math.min(.25, friends * .06);
    if (has(u,'yields')) for (const o of units) if (active(o) && hostile(w,o,u) && ['grizzly','polar','wolf'].includes(sp(o.s)) && dist(o,u) < 10) tgt -= .25;
    if (has(u,'standsGround') && u.hp < u.maxhp * .95 && u.grudge) tgt += .25;
    if (has(u,'fearless')) tgt = Math.max(tgt, .8);
    u.morale += (tgt - u.morale) * Math.min(1, .6 * DT);
    if (u.state !== 'flee' && u.cornerT <= 0 && u.morale < u.s.flee && u.fleeT <= 0 && !u.withdrawn){
      u.state = 'flee'; u.fleeT = 4 + R() * 4; release(w, u); u.mv = null;
      u.breaks = (u.breaks || 0) + 1;
      if (u.rider && R() < .5) throwRider(w, u, 'it panicked and bolted');
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
    u.retargetT -= DT;
    if (u.retargetT <= 0){ u.retargetT = .5 + R() * .2; chooseTarget(w, u); }
  }
  // movement
  for (const u of units){
    if (!active(u)) continue;
    if (u.side === 'H'){ moveHuman(w, u); continue; }
    if (u.stun > 0 || u.climbT > 0){ u.climbT = Math.max(0, u.climbT - DT); damp(u); continue; }
    if (u.latchOn){ // glued to prey
      const t = u.latchOn, d = dist(u,t) || 1, want = u.r + t.r - .3;
      u.x = t.x + (u.x - t.x) / d * want; u.y = t.y + (u.y - t.y) / d * want; u.vx = t.vx; u.vy = t.vy; continue;
    }
    let tx = null, ty = null, frac = .5;
    const vmax = speedOf(w, u);
    if (u.mv){ commitMove(w, u, vmax); continue; }
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
      if (w.T.water){ const p = waterPoint(w, u); tx = p.x; ty = p.y; }
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
      if (has(u,'waterbound') && w.T.water && distWater(w, t) > 5){ const p = waterPoint(w, u); tx = p.x; ty = t.y; frac = .3; }
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
    } else {
      // roam / rest: drift gently, enemies wander
      if (!u.wander || R() < .01){
        const H0 = w.human, lean = u.sated ? 0 : Math.min(1, (u.s.pred ? .5 : u.agit * .6) + pressure(w) * .6);
        const bx = u.x + (H0.x - u.x) * lean * .5, by = u.y + (H0.y - u.y) * lean * .5;
        u.wander = {x: clamp(bx + (R()-.5)*20, 5, W-5), y: clamp(by + (R()-.5)*20, 5, H-5)}; if (has(u,'waterbound') && w.T.water) u.wander.x = clamp(u.wander.x, w.T.water.x0 + 1, w.T.water.x1 - 1); } // lurk submerged
      if (has(u,'waterbound') && !w.T.water){ frac = 0; }
      else { tx = u.wander.x; ty = u.wander.y; frac = u.state === 'rest' ? .12 : .25 + .35 * pressure(w); }
    }
    if (u.rider && u.state === 'guard'){ tx = u.x; ty = u.y; frac = 0; }
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
    for (const t of w.trees) if (t.fell){ (w.fallen = w.fallen || []).push({x: t.x, y: t.y, r: t.r, t: w.t}); if (w.human.onTree === t){ w.human.onTree = null; log(w, 'Your tree goes down and you scramble clear', 'danger', w.human); } }
    w.trees = w.trees.filter(t => !t.fell);
  }
  // shake-off attempts by latched prey
  for (const u of units){
    if (!active(u) || !u.latchOn) continue;
    const t = u.latchOn;
    const p = .15 * Math.sqrt(t.s.mass / u.s.mass) * (t.cornerT > 0 ? 1.5 : 1) * (t.side === 'H' ? .3 : 1);
    if (w.R() < p * DT) release(w, u, 'shaken off');
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
    if (u.latchOn){
      strike(w, u, u.latchOn, {latch:true}); u.atk = u.s.cd; continue;
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
        if (!u.climbing){ u.climbing = true; u.climbT = 1.5; log(w, `${capName(u)} climbs after you`, 'danger', u); continue; }
      } else if (u.s.strikeH >= h){
        u.atk = u.s.cd * 1.5;
        const leaper = u.s.pred && u.s.pounce;
        if (w.R() < .35){ log(w, `${capName(u)} ${leaper ? 'leaps up' : 'rears up'} ${t.riding ? 'at you on your ' + t.riding.s.name : 'into the tree'} and strikes you`, 'danger', u);
          if (t.riding && w.R() < (leaper ? .5 : .3)) throwRider(w, t.riding, (leaper ? 'a leaping ' : 'a rearing ') + u.s.name, u);
        } else { u.stun = .8; if (w.R() < .3) log(w, `${capName(u)} leaps for you and misses`, 'info', u); continue; }
      } else { u.atk = .5; continue; }
    }
    // gorilla bluff
    if (has(u,'bluff') && !u.bluffed[t.id] && !(u.side === 'P' && t.target === w.human)){
      u.bluffed[t.id] = true; u.atk = u.s.cd * 1.5;
      if (strength(t) < strength(u) * 1.5){ t.morale -= .35; log(w, `${capName(u)} bluff-charges ${nameOf(t)}, rattling it`, 'bluff', u); }
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
  if (w.T.water && distWater(w, h) < 6 && !onFord(w, h)) dx += h.x < (w.T.water.x0 + w.T.water.x1) / 2 ? -1.5 : 1.5;
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
  if (g === 'stalk' || g === 'rush'){
    const P = s.pounce || 5;
    if (d <= P && d > touch * .8 && u.pounceCd <= 0 && u.stam > .2 && reachable(u, t)){
      const dur = clamp(d / (s.spd * 1.6), .25, .6), px = t.x + t.vx * dur, py = t.y + t.vy * dur, m = Math.hypot(px - u.x, py - u.y) || 1;
      u.mv = {k:'pounce', vx:(px - u.x) / dur * .95, vy:(py - u.y) / dur * .95, t:dur, tgt:t};
      if (d > 6) log(w, `${capName(u)} pounces ${Math.round(d)} m onto ${nameOf(t)}`, 'pounce', u);
      commitMove(w, u, vmax); return null;
    }
    if (g === 'stalk' && d > P + 1) return go(ally ? .6 : (t.target === u ? .6 : .38));
    return go(1);
  }
  if (g === 'lunge'){
    const nearW = w.T.water && distWater(w, u) < 3, L = nearW ? 7 : 3.5, V = nearW ? 12 : 7;
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
      if (t && dist(u, t) <= u.r + t.r + u.s.reach + .8 && heightOf(t) <= u.s.strikeH){ u.vx *= .2; u.vy *= .2; strike(w, u, t, {pounce:true}); u.atk = u.s.cd; }
      else { u.wetLunge = false; u.vx *= .2; u.vy *= .2; u.stun = Math.max(u.stun, mv.k === 'lunge' ? .9 : .5); if (t && dist(u, t) < 14) log(w, `${capName(u)} ${mv.k === 'lunge' ? 'lunges' : 'pounces'} and misses`, 'info', u); }
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
  if (w.T.water && distWater(w, u) < 6 && !onFord(w, u)) dx += u.x < (w.T.water.x0 + w.T.water.x1) / 2 ? -1.5 : 1.5;
  const zb = w.zb && w.zb.p > 0 ? w.zb : {x0: 0, x1: W, y0: 0, y1: H};
  if (u.x < zb.x0 + 5) dx += 1.2; if (u.x > zb.x1 - 5) dx -= 1.2; if (u.y < zb.y0 + 5) dy += 1.2; if (u.y > zb.y1 - 5) dy -= 1.2;
  const m = Math.hypot(dx, dy);
  if (m < .05) return {tx: u.x, ty: u.y, frac: 0};
  return {tx: u.x + dx / m * 6, ty: u.y + dy / m * 6, frac: danger > .02 ? 1 : .35};
}

// ---------- board rules ----------
// Each game deals a board of RULES.board animals from the roster (a rare animal turns up with probability rareP).
// You spend up to RULES.budget on the board; every board animal you don't pick is on the other side.
// With RULES.total set, every board's prices add up to total (± tol), so every board has the same total value
// and you always buy the same share of it. rules.terrain (optional) keeps cold-blooded animals off cold maps.
// Wolves, hyenas and lions are dealt either solo or as a pack item (one pick brings the whole group).
const RULES = {board: 12, budget: 1000, total: null, tol: 100, rareP: .1};
function dealBoard(seed, rules, prices){
  rules = Object.assign({}, RULES, rules || {});
  const R = rng(seed), price = id => (prices && prices[id]) || BY_ID[id].price;
  // cold-blooded animals (the croc) are never dealt on a cold map; each species appears once, solo or as a pack
  const cold = rules.terrain && (TERRAINS[rules.terrain] || {}).cold, ok = a => !(cold && a.cold < .3);
  const forms = {}; for (const a of ANIMALS) if (ok(a)) (forms[sp(a)] = forms[sp(a)] || []).push(a.id);
  const common = Object.keys(forms).filter(k => !BY_ID[k].rare), rare = Object.keys(forms).filter(k => BY_ID[k].rare);
  const form = k => forms[k][Math.floor(R() * forms[k].length)];
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

const API = { RULES, dealBoard, ESCORT_R, POST_R, zoneAt, ZONE_T0, ZONE_T1, HAZARD_NAME, zoneFor, homeFor, placeOK, clampPlace, defaultPost, snowFactor, heatLoad, QUIET_T, STYLE, ANIMALS, HUMAN, BY_ID, TERRAINS, W, H, DT, MATCH_T, setup, step, simulate, snapshot, summarize, randomDraft, defaultPlacement, rng, hpOf, radiusOf };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.Arena = API;
})(typeof window !== 'undefined' ? window : globalThis);
