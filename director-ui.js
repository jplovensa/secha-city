import {
  availableWorkers,beginPavilion,busyWorkers,furnish,furnitureKits,hire,hireCost,
  openPavilion,pavilionTypes,plots,readCity,simulate,surfaces,workerRoles,
} from './city-operations.js';

const stateKey='secha-director-v1';
const plotLabel={building:'Building',built:'Ready to furnish',furnished:'Ready to open',open:'Open'};
const money=new Intl.NumberFormat('en');
const element=(tag, text, name)=>{
  const node=document.createElement(tag);
  if(text) node.textContent=text;
  if(name) node.className=name;
  return node;
};

export function makeDirector(panel,scene){
  const state=readCity(localStorage);
  let selected=plots[0].id;
  let shown=false;
  let onFoot=false;
  let message='';
  let pulse=0;
  const preferences=new Map();
  let hireName='';
  let hireRole='builder';
  const world=()=>scene();

  function save(){
    try {localStorage.setItem(stateKey,JSON.stringify(state));}
    catch { /* If blocked, keep the current session playable. */ }
  }

  function buttons(text,action,kind){
    const node=element('button',text,kind);
    node.type='button';
    node.addEventListener('click',action);
    return node;
  }

  function result(error,success){
    message=error||success;
    if(!error){save();world().showDevelopment(state);}
    render();
  }

  function caption(group, name, choices, value, onSelect) {
    const id='director-'+name.toLowerCase().replaceAll(' ','-');
    const label=element('label',name);
    label.htmlFor=id;
    const menu=element('select');menu.id=id;
    for(const [value,text] of choices){
      const option=element('option',text);option.value=value;menu.add(option);
    }
    menu.value=value;
    menu.addEventListener('change',()=>onSelect(menu.value));
    group.append(label,menu);
    return menu;
  }

  function render(){
    if(!shown) return;
    const plot=plots.find(plot=>plot.id===selected);
    const site=state.plots[plot.id];
    const prefs=preferences.get(plot.id)??{type:'materials',surface:'eps',kit:'lounge',worker:''};
    preferences.set(plot.id,prefs);
    const opened=Object.values(state.plots).filter(plot=>plot.phase==='open').length;
    const workers=availableWorkers(state);
    const worker=state.workers.find(person=>person.id===site?.worker);
    const report = opened===0 ? 'Open the first pavilion and show visitors what SECHA builds.'
      : opened<2 ? 'Build a second pavilion that gives visitors a different reason to stay.'
      : opened<4 ? 'Connect all four sites into a working interior district.'
      : 'All four pavilions are open. Walk through the city you built.';
    panel.replaceChildren();
    const intro=element('div',null,'director-intro');
    const stamp=element('p',opened<4?'Central City · '+opened+' / 4 open':'Central City · District open','eyebrow');
    const title=element('h2','Central City');
    title.id='director-title';
    const brief=element('p',report);
    intro.append(stamp,title,brief);
    panel.append(intro);

    const ledger=element('div',null,'city-ledger');
    for(const [label,value] of [['Credits',money.format(state.credits)],['Crew',workers.length+' available'],['Visitors',money.format(state.visitors)]]) {
      const slot=element('div');
      slot.append(element('span',label),element('b',value));
      ledger.append(slot);
    }
    panel.append(ledger);
    const plotList=element('nav',null,'plot-list');
    plotList.setAttribute('aria-label','Development plots');
    for(const item of plots) {
      const site=state.plots[item.id];
      const choice=buttons('',()=>{
        selected=item.id;message='';onFoot=false;
        world().focusPlot(selected);
        render();
      });
      choice.setAttribute('aria-pressed',String(item.id===selected));
      choice.append(element('b',item.name),element('span',plotLabel[site?.phase]??'Vacant'));
      plotList.append(choice);
    }
    panel.append(plotList);

    const task=element('section',null,'director-task');
    task.append(element('h3',site?pavilionTypes[site.type].label:plot.name));
    const forms=element('div',null,'director-fields');

    if(!site){
      task.append(element('p',plot.brief));
      caption(forms,'Pavilion',Object.entries(pavilionTypes).map(([id,item])=>[id,item.label]),prefs.type,value=>{prefs.type=value;render();});
      caption(forms,'Shell finish',Object.entries(surfaces).map(([id,finish])=>[id,finish.label+' · '+finish.cost]),prefs.surface,value=>{prefs.surface=value;render();});
      if(!workers.some(person=>person.id===prefs.worker)) prefs.worker=workers[0]?.id??'';
      caption(forms,'Worker',workers.length?workers.map(person=>[person.id,person.name+' · '+workerRoles[person.role]]):[['','All crew assigned']],prefs.worker,value=>{prefs.worker=value;});
      const project=pavilionTypes[prefs.type], material=surfaces[prefs.surface];
      const price=project.cost+material.cost;
      task.append(forms,element('p',project.description+' '+material.description,'director-note'));
      const build=buttons('Build · '+price+' credits',()=>result(beginPavilion(state,selected,prefs.type,prefs.surface,prefs.worker,Date.now()),'Construction started.'),'primary');
      build.disabled=!prefs.worker || state.credits<price;
      task.append(build);
    } else if(site.phase==='building'){
      const timer=element('p',worker?.name+' is assembling the '+surfaces[site.surface].label.toLowerCase()+' shell.');
      timer.id='director-timer';task.append(timer);
      const remaining=element('div',null,'director-build-bar');
      const bar=element('span');bar.id='director-bar';remaining.append(bar);task.append(remaining);
    } else {
      task.append(element('p',surfaces[site.surface].label+' shell'+(site.kit?' · '+furnitureKits[site.kit].label:'')));
      const visit=buttons(onFoot?'Back to site view':'Walk through pavilion',()=>{
        onFoot=!onFoot;
        world().focusPlot(selected,onFoot);
        render();
      },'soft');
      if(site.phase==='built'){
        caption(forms,'Furniture layout',Object.entries(furnitureKits).map(([id,kit])=>[id,kit.label+' · '+kit.cost]),prefs.kit,value=>{prefs.kit=value;render();});
        task.append(forms);
        const style=buttons('Furnish · '+furnitureKits[prefs.kit].cost+' credits',()=>result(furnish(state,selected,prefs.kit),'The furniture is installed.'),'primary');
        style.disabled=state.credits<furnitureKits[prefs.kit].cost;
        task.append(style);
      }
      if(site.phase==='furnished') task.append(buttons('Open to visitors',()=>result(openPavilion(state,selected,Date.now()),'The city’s first visitors have arrived.'),'primary'));
      if(site.phase==='open') task.append(element('p',site.visitors+' visitors hosted. The pavilion earns credits every 15 seconds.'));
      task.append(visit);
    }
    if(message) {
      const feedback=element('p',message,'director-feedback');
      feedback.setAttribute('role','status');
      task.append(feedback);
    }
    panel.append(task);

    const crew=element('details',null,'director-crew');crew.open=hireName.length>0 || Boolean(panel.dataset.crewOpen==='yes');
    crew.addEventListener('toggle',()=>{panel.dataset.crewOpen=crew.open?'yes':'no';});
    crew.append(element('summary','Crew · '+state.workers.length+' people'));
    const roster=element('ul',null,'city-roster');const busy=busyWorkers(state);
    for(const person of state.workers) {
      roster.append(element('li',person.name+' · '+workerRoles[person.role]+(busy.has(person.id)?' · Building':' · Available')));
    }
    const form=element('form',null,'director-fields');
    const label=element('label','Name');label.htmlFor='worker-name';
    const input=element('input');input.id='worker-name';input.required=true;input.maxLength=24;input.value=hireName;
    input.addEventListener('input',()=>{hireName=input.value;});
    form.append(label,input);
    caption(form,'Role',Object.entries(workerRoles),hireRole,value=>{hireRole=value;});
    const submit=element('button','Hire worker · '+hireCost+' credits','primary');submit.type='submit';submit.disabled=state.credits<hireCost;
    form.append(submit);
    form.addEventListener('submit',event=>{
      event.preventDefault();
      const name=hireName.trim();const error=hire(state,name,hireRole);
      if(!error) hireName='';
      result(error,name+' joined the crew.');
    });
    crew.append(roster,form);panel.append(crew);
    updateTimer(Date.now());
  }

  function updateTimer(now){
    const site=state.plots[selected];
    const bar=panel.querySelector('#director-bar');
    const label=panel.querySelector('#director-timer');
    if(!bar || !label || site?.phase!=='building') return;
    const seconds=Math.max(0,Math.ceil((site.readyAt-now)/1000));
    const name=state.workers.find(item=>item.id===site.worker)?.name??'The crew';
    label.textContent=name+' is assembling the shell · '+seconds+' s';
    bar.style.width=Math.max(4,(1-(site.readyAt-now)/(surfaces[site.surface].seconds*1000))*100)+'%';
  }

  return {
    open() {
      shown=true;onFoot=false;panel.hidden=false;
      simulate(state,Date.now());save();
      world().showDevelopment(state);world().focusPlot(selected);
      render();
    },
    close() {shown=false;onFoot=false;panel.hidden=true;},
    get onFoot(){return onFoot;},
    step(now) {
      if(!shown || now-pulse<250) return;
      pulse=now;
      const wall=Date.now();
      if(simulate(state,wall)){
        save();world().showDevelopment(state);render();
      }else updateTimer(wall);
    },
  };
}
