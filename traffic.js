export const routeCheckpoints = [
  { name:'South gate', x:32,z:42 },
  { name:'Material Lab', x:42,z:18 },
  { name:'Garden Villa', x:8,z:-42 },
];

const roadSide = 42;
export const roadRadius = 8;
export const roadHalfWidth = 3.6;
const corner = roadSide - roadRadius;
const straightLength = corner * 2;
const arcLength = Math.PI * roadRadius / 2;
export const roadQuarterLength = straightLength + arcLength;
export const roadLength = roadQuarterLength * 4;

export function roadPoint(distance) {
  const wrapped = ((distance % roadLength) + roadLength) % roadLength;
  const side = Math.floor(wrapped / roadQuarterLength);
  const along = wrapped - side * roadQuarterLength;
  const angle = Math.max(0,along - straightLength) / roadRadius;
  const x = along < straightLength ? along - corner : corner + Math.sin(angle) * roadRadius;
  const z = along < straightLength ? roadSide : corner + Math.cos(angle) * roadRadius;
  const cos = [1,0,-1,0][side], sin = [0,1,0,-1][side];
  const nx = Math.sin(angle), nz = Math.cos(angle);
  return {x:x*cos+z*sin,z:z*cos-x*sin,nx:nx*cos+nz*sin,nz:nz*cos-nx*sin};
}

export function roadDistance(x,z) {
  const dx = Math.abs(x) - corner;
  const dz = Math.abs(z) - corner;
  return Math.hypot(Math.max(0,dx),Math.max(0,dz)) + Math.min(0,Math.max(dx,dz)) - roadRadius;
}

export const onRoad = (x,z) => Math.abs(roadDistance(x,z)) <= roadHalfWidth - .35;

export function driveStep(car, steer, throttle, seconds, handbrake = false, profile = {}) {
  const {topSpeed=12.5, acceleration=5, grip=3.8, slideGrip=1.55, steering=1} = profile;
  const dt = Math.min(.05,seconds);
  const sliding = handbrake && car.speed > 4.3;
  const target = sliding ? Math.min(car.speed,8.2) : throttle > 0 ? topSpeed : throttle < 0 ? -3.1 : 0;
  const accel = sliding ? 5.5 : throttle ? acceleration : 2.9;
  const speed = car.speed + Math.sign(target-car.speed) * Math.min(Math.abs(target-car.speed),dt*accel);
  const turnSpeed = throttle ? Math.max(1.45,Math.abs(speed)) : Math.abs(speed);
  const yaw = car.yaw + steer*dt*Math.sign(speed)*Math.min(1.4,turnSpeed*.53) * steering * (sliding ? 1.23 : 1);
  const heading = car.heading ?? car.yaw;
  const toward = Math.atan2(Math.sin(yaw-heading),Math.cos(yaw-heading));
  const travel = Math.abs(speed)<.4 || (!sliding && (car.slip ?? 0)<.025) ? yaw :
    heading + toward * (1 - Math.exp(-(sliding ? slideGrip : grip)*dt));
  const slip = Math.abs(Math.atan2(Math.sin(yaw-travel),Math.cos(yaw-travel)));
  const dx = Math.sin(travel)*speed*dt;
  const dz = Math.cos(travel)*speed*dt;
  const x = car.x + dx;
  const z = car.z + dz;

  if (onRoad(x,z)) return {x,z,yaw,speed,heading:travel,slip};

  // Keep the tangential part of the movement at a kerb so steering can recover.
  const offset = .01;
  const nx = roadDistance(car.x+offset,car.z) - roadDistance(car.x-offset,car.z);
  const nz = roadDistance(car.x,car.z+offset) - roadDistance(car.x,car.z-offset);
  const normal = Math.hypot(nx,nz) || 1;
  const outward = (dx*nx + dz*nz) / (normal*normal);
  const slideX = x - nx*outward;
  const slideZ = z - nz*outward;
  const slideSpeed = Math.sign(speed) * Math.hypot(slideX-car.x,slideZ-car.z) / (dt || 1);
  return onRoad(slideX,slideZ) ? {x:slideX,z:slideZ,yaw,speed:slideSpeed,heading:travel,slip:0} :
    {...car,yaw,speed:0,heading:yaw,slip:0};
}
