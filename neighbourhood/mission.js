export const sites = {
  studio: {label:'SECHA Studio', x:-14,z:33.5,parking:[-14,42]},
  client: {label:'The apartment',x:30.7,z:-13,parking:[42,-13]},
  lab: {label:'Material Lab',x:30.7,z:7,parking:[42,7]},
};

export const choices = [
  {id:'oak', label:'Fit the stocked oak', detail:'Use the lab’s honey-oak screen. The whole room is ready at 18:00.', fee:1_250_000, trust:2, finish:'Honey oak', color:'#b98855', handover:'18:00 today'},
  {id:'defer', label:'Hand over the essentials', detail:'Keep the bedroom ready at 18:00. Schedule the walnut screen separately.', fee:950_000, trust:1, finish:'Screen deferred', color:null, handover:'18:00 today · screen later'},
  {id:'extend', label:'Move the handover', detail:'Keep the specified walnut screen. Agree to hand over at 10:00 tomorrow.', fee:1_500_000, trust:-1, finish:'Smoked walnut', color:'#563626', handover:'10:00 tomorrow'},
];

const steps = ['offer','inspect','source','deliver','complete'];

export function restoreJob(saved) {
  const step = steps.includes(saved?.step) ? saved.step : 'offer';
  const choice = choices.find(option=>option.id===saved?.choice);
  if (steps.indexOf(step)>=3 && !choice) return {step:'source',choice:null};
  return {step,choice:steps.indexOf(step)>=3 ? choice.id : null};
}

export function advanceJob(job,site,choiceId) {
  if (job.step==='offer' && site==='studio') return {step:'inspect',choice:null};
  if (job.step==='inspect' && site==='client') return {step:'source',choice:null};
  if (job.step==='source' && site==='lab' && choices.some(item=>item.id===choiceId)) return {step:'deliver',choice:choiceId};
  if (job.step==='deliver' && site==='client') return {...job,step:'complete'};
  return job;
}

export function objective(job) {
  return {
    offer:{site:'studio',text:'Pick up your commission at SECHA Studio'},
    inspect:{site:'client',text:'Drive to the apartment and inspect the bedroom'},
    source:{site:'lab',text:'Visit the Material Lab and settle the finish'},
    deliver:{site:'client',text:'Return to the apartment for handover'},
    complete:{site:null,text:'Explore the neighbourhood'},
  }[job.step];
}
