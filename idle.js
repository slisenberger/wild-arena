const A=require(process.env.SIM||'./sim.js');const T=Object.keys(A.TERRAINS);
const teams={eleRhiTig:['elephant','rhino','tiger'],user5:['elephant','grizzly','tiger','jaguar','cougar'],cats:['tiger','lion','jaguar','cougar'],swarm:['grizzly','tiger','gorilla','jaguar','wolf','cougar','hyena'],noEle:['rhino','giraffe','jaguar','hyena']};
function tallest(t){ return A.defaultMount(t); } // ride a giant, else on foot
for(const tr of T){for(const [k,team] of Object.entries(teams)){let first=[],gap=[],quiet=0,qT=[],n=12;
 for(let i=0;i<n;i++){const w=A.setup({team,terrain:tr,mount:tallest(team),seed:300+i*13});let prev=0,last=0,f=null,mg=0;
  while(!w.over){A.step(w);const d=w.units.filter(u=>u.side==='E').reduce((s,u)=>s+u.st.dealt,0);if(d>prev){if(f===null)f=w.t;prev=d;last=w.t;}mg=Math.max(mg,w.t-last);}
  first.push(f===null?999:f);gap.push(mg);if(w.result.why==='quiet'){quiet++;qT.push(Math.round(w.result.t));}}
 const med=a=>a.slice().sort((x,y)=>x-y)[Math.floor(a.length/2)];
 console.log(tr.padEnd(8),k.padEnd(10),'first hit med',String(Math.round(med(first))).padStart(4)+'s','longest idle med',String(Math.round(med(gap))).padStart(3)+'s','quiet-ends',quiet+'/'+n,qT.length?'at '+qT.join(','):'');}}
