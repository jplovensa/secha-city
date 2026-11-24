import { roadDistance, roadHalfWidth, roadPoint, roadQuarterLength } from './traffic.js';

export const cars = [
  { id:'hatch', name:'City Hatch', color:'#d14835', description:'Balanced grip and predictable steering.',
    topSpeed:12.5, acceleration:5, grip:3.8, slideGrip:1.55, steering:1.08 },
  { id:'coupe', name:'Terracotta Coupé', color:'#bc653f', description:'Quick turn-in and longer slides.',
    topSpeed:14, acceleration:6.3, grip:3.4, slideGrip:1.15, steering:1.19 },
  { id:'wagon', name:'Pandan Touring', color:'#688775', description:'A steadier, higher-grip car for short slides.',
    topSpeed:11.5, acceleration:4.6, grip:4.2, slideGrip:1.85, steering:1.04 },
];

export const driftZones = ['South Gate','Material Lab','Garden Villa','Pandan Bend'].map((name,index) => {
  const distance = (index+1)*roadQuarterLength;
  const point = roadPoint(distance-6);
  return {name,distance,...point};
});
export const driftTarget = 100;

export function createDriftRun() {
  return {next:0,points:0,slide:0,inside:false};
}

export function scoreDrift(run, car, seconds) {
  const zone = driftZones[run.next];
  if (!zone) return run;
  const inside = Math.hypot(car.x-zone.x,car.z-zone.z)<10;
  if (inside && car.slip>.105 && car.speed>4.3 && Math.abs(roadDistance(car.x,car.z))<roadHalfWidth-1.15) {
    run.slide += seconds * Math.min(car.slip,.65) * car.speed * 10;
  }
  if (run.inside && !inside) {
    const exit = roadPoint(zone.distance+2);
    // Cross the exit side heading down the next straight to bank the score.
    const forwardX = exit.nz, forwardZ = -exit.nx;
    if ((car.x-exit.x)*forwardX + (car.z-exit.z)*forwardZ > 0) {
      run.points += Math.round(run.slide);
      run.next++;
    }
    run.slide = 0;
  }
  run.inside = inside && run.next < driftZones.length;
  return run;
}
