export const sites = {
  studio:{label:'SECHA Reception',host:'Josephine',x:.9,y:.10,z:33.1,parking:[0,42]},
  client:{label:'Rumah Teduh',host:'Ibu',x:9.27,y:.33,z:12.89,parking:[10,42]},
  lab:{label:'Material Library',host:'Dina',x:31,y:.31,z:2.5,parking:[42,3]},
};

export const choices = [
  {id:'oak',label:'Open honey oak',detail:'Wide slats carry daylight through to the lounge. The bed stays partly visible from the entry.',fee:1_200_000,trust:1,finish:'Honey oak · 24 cm spacing',color:'#bd8e5b',spacing:.24,warmth:.60},
  {id:'walnut',label:'Close smoked walnut',detail:'Tighter slats screen the bed. Concealed warm light keeps the timber legible after dusk.',fee:1_650_000,trust:2,finish:'Smoked walnut · 14 cm spacing',color:'#785038',spacing:.14,warmth:1.05},
  {id:'linen',label:'Layer linen behind oak',detail:'A woven lining softens the window glare and adds privacy while letting the room stay bright.',fee:1_450_000,trust:2,finish:'Honey oak and woven linen',color:'#a3774c',spacing:.19,warmth:.82,lined:true},
];

const steps = ['offer','inspect','source','deliver','complete'];

export function restoreJob(saved) {
  const step=steps.includes(saved?.step)?saved.step:'offer';
  const choice=choices.find(option=>option.id===saved?.choice);
  if(steps.indexOf(step)>=3 && !choice) return {step:'source',choice:null};
  return {step,choice:steps.indexOf(step)>=3?choice.id:null};
}

export function advanceJob(job,site,choiceId) {
  if(job.step==='offer'&&site==='studio') return {step:'inspect',choice:null};
  if(job.step==='inspect'&&site==='client') return {step:'source',choice:null};
  if(job.step==='source'&&site==='lab'&&choices.some(item=>item.id===choiceId)) return {step:'deliver',choice:choiceId};
  if(job.step==='deliver'&&site==='client') return {...job,step:'complete'};
  return job;
}

export function objective(job) {
  return {
    offer:{site:'studio',text:'Meet Josephine at reception'},
    inspect:{site:'client',text:'Meet Ibu and inspect the bedroom at Rumah Teduh'},
    source:{site:'lab',text:'Meet Dina at the Material Library and choose a screen'},
    deliver:{site:'client',text:'Return to Rumah Teduh and see your screen at dusk'},
    complete:{site:null,text:'The room is open. Explore SECHA City'},
  }[job.step];
}
