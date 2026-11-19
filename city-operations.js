export const plots = [
  {id:'pandan',name:'Pandan Walk',x:-13.7,z:28,brief:'A first stop for people arriving through the garden.'},
  {id:'maker',name:'Maker Lane',x:19.4,z:9.7,brief:'A site beside the atelier for a room visitors can work in.'},
  {id:'green',name:'North Green',x:-.9,z:-15.1,brief:'A quiet edge between the houses and the courtyard.'},
  {id:'west',name:'West Commons',x:-33.5,z:-12.2,brief:'A neighbourhood site for gatherings and exhibitions.'},
];

export const pavilionTypes = {
  materials:{label:'Material Lab',cost:340,yield:44,description:'Let visitors compare modular panels and timber finishes.'},
  heritage:{label:'Wayang Gallery',cost:390,yield:52,description:'Give the city a place to see heritage relief and layered light.'},
  living:{label:'Living Studio',cost:370,yield:49,description:'Show how furniture placement changes the way a room works.'},
  tea:{label:'Tea Pavilion',cost:315,yield:39,description:'Make room for a cup, a conversation, and a place to pause.'},
};

export const surfaces = {
  eps:{label:'EPS composite',cost:45,seconds:7,bonus:0,colour:'#e0c9aa',description:'A lighter shell with a shorter build.'},
  oak:{label:'Honey oak',cost:100,seconds:10,bonus:5,colour:'#af7d50',description:'Warm timber that brings the grain into the space.'},
  walnut:{label:'Smoked walnut',cost:145,seconds:12,bonus:9,colour:'#79523c',description:'A rich finish with a higher opening return.'},
};

export const furnitureKits = {
  lounge:{label:'Conversation lounge',cost:130},
  atelier:{label:'Maker’s worktable',cost:150},
  gallery:{label:'Gallery seating',cost:145},
};

export const workerRoles={builder:'Builder',designer:'Designer'};
export const hireCost=110;
const cycle=15000;
const openingCredit=310;

export function freshCity(){
  return {credits:1200,visitors:0,workers:[{id:'dina',name:'Dina',role:'designer'}],plots:{},nextWorker:1};
}

export function busyWorkers(state) {
  return new Set(Object.values(state.plots).filter(site=>site.phase==='building').map(site=>site.worker));
}

export function availableWorkers(state) {
  const busy=busyWorkers(state);
  return state.workers.filter(worker=>!busy.has(worker.id));
}

export function simulate(state,now) {
  let changed=false;
  for(const site of Object.values(state.plots)) {
    if(site.phase==='building' && now>=site.readyAt){
      site.phase='built';
      changed=true;
    }
    if(site.phase==='open' && now>=site.nextVisit){
      const turns=Math.min(20,1+Math.floor((now-site.nextVisit)/cycle));
      const revenue=pavilionTypes[site.type].yield+surfaces[site.surface].bonus+
        (state.workers.find(worker=>worker.id===site.worker)?.role==='designer'?5:0);
      state.credits+=turns*revenue;
      state.visitors+=turns*3;
      site.visitors+=turns*3;
      site.nextVisit=now+cycle-((now-site.nextVisit)%cycle);
      changed=true;
    }
  }
  return changed;
}

export function hire(state,name,role) {
  const label=name.trim().slice(0,24);
  if(!label || !Object.hasOwn(workerRoles,role)) return 'Enter a name and choose a role.';
  if(state.workers.length>=8) return 'The city crew is full.';
  if(state.credits<hireCost) return 'The city does not have enough credits to hire.';
  state.credits-=hireCost;
  state.workers.push({id:'crew-'+state.nextWorker++,name:label,role});
  return '';
}

export function beginPavilion(state,plot,type,surface,workerId,now) {
  if(!plots.some(site=>site.id===plot) || state.plots[plot]) return 'Select a vacant plot.';
  const chosen=pavilionTypes[type],material=surfaces[surface];
  if(!chosen || !material) return 'Choose a pavilion and a shell finish.';
  const worker=availableWorkers(state).find(person=>person.id===workerId);
  if(!worker) return 'Assign an available worker to build.';
  const cost=chosen.cost+material.cost;
  if(state.credits<cost) return 'The city does not have enough credits for this build.';
  state.credits-=cost;
  state.plots[plot]={phase:'building',type,surface,worker:worker.id,
    readyAt:now+material.seconds*1000*(worker.role==='builder'?.75:1),visitors:0};
  return '';
}

export function furnish(state,plot,kit) {
  const site=state.plots[plot],selected=furnitureKits[kit];
  if(site?.phase!=='built' || !selected) return 'Finish the shell and choose a furniture layout.';
  if(state.credits<selected.cost) return 'The city does not have enough credits for this layout.';
  state.credits-=selected.cost;
  site.kit=kit;
  site.phase='furnished';
  return '';
}

export function openPavilion(state,plot,now) {
  const site=state.plots[plot];
  if(site?.phase!=='furnished') return 'Furnish the pavilion before opening it.';
  site.phase='open';
  site.nextVisit=now+cycle;
  site.visitors=3;
  state.visitors+=3;
  state.credits+=openingCredit;
  return '';
}

export function readCity(storage) {
  try {
    const saved=JSON.parse(storage.getItem('secha-director-v1')??'null');
    if(saved && Array.isArray(saved.workers) && Number.isFinite(saved.credits) && saved.plots && Object.keys(saved.plots).every(key=>
      plots.some(plot=>plot.id===key) && Object.hasOwn(pavilionTypes,saved.plots[key].type) &&
      Object.hasOwn(surfaces,saved.plots[key].surface))) return saved;
  } catch { /* Start a fresh city if storage is unavailable. */ }
  return freshCity();
}
