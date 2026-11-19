export const chapters = [
  'A Room for Two',
  'The First Commission',
  'Opening Night',
];

export const commissionBudget = 850;
export const packages = {
  finish: [
    { id:'walnut',label:'Smoked walnut',cost:420 },
    { id:'oak',label:'Honey oak',cost:310 },
    { id:'umber',label:'Burnt umber',cost:240 },
  ],
  screen: [
    { id:'open',label:'Open screen · 24 cm',cost:260,spacing:24 },
    { id:'private',label:'Privacy screen · 14 cm',cost:360,spacing:14 },
  ],
  lighting: [
    { id:'warm',label:'Warm light',cost:180,light:30 },
    { id:'daylight',label:'Filtered daylight',cost:270,light:70 },
  ],
};

export function quote(selection) {
  const finish=packages.finish.find(item=>item.id===selection.finish);
  const screen=packages.screen.find(item=>item.id===selection.screen);
  const lighting=packages.lighting.find(item=>item.id===selection.lighting);
  const total=(finish?.cost??0)+(screen?.cost??0)+(lighting?.cost??0);
  const ready=Boolean(finish && screen && lighting && total<=commissionBudget);
  return {
    total,ready,remaining:commissionBudget-total,
    design:ready ? {finish:finish.id,spacing:screen.spacing,light:lighting.light} : null,
  };
}

export const chapterFor = id => ['library','commission'].includes(id) ? 1 :
  ['courtyard','opening'].includes(id) ? 2 : 0;
