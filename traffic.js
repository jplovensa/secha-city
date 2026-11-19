export const routeCheckpoints = [
  { name:'South gate', x:32,z:42 },
  { name:'Material district', x:42,z:0 },
  { name:'Garden Villa', x:8,z:-42 },
];

export const onRoad = (x,z) => {
  const edge=Math.max(Math.abs(x),Math.abs(z));
  return edge>=38.65 && edge<=45.35;
};

export function driveStep(car, steer, throttle, seconds) {
  const dt=Math.min(.05,seconds);
  const target=throttle>0 ? 12.5 : throttle<0 ? -3.1 : 0;
  const accel=throttle ? 5.0 : 2.9;
  const speed=car.speed+Math.sign(target-car.speed)*Math.min(Math.abs(target-car.speed),dt*accel);
  const yaw=car.yaw+steer*dt*Math.sign(speed)*Math.min(1.4,Math.abs(speed)*.53);
  const x=car.x+Math.sin(yaw)*speed*dt;
  const z=car.z+Math.cos(yaw)*speed*dt;
  return onRoad(x,z) ? {x,z,yaw,speed} : {...car,yaw,speed:0};
}
