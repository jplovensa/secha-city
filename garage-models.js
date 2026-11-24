import * as THREE from 'three';

export const vehicleAssets = {
  hatch: {file:'city-car.glb', source:'Five-Door Hatchback', eye:[.37,1.21,-.34], radius:.316},
  coupe: {file:'garage/classic-coupe.glb', source:'Classic 1970s Coupé', eye:[.37,1.06,-.95], radius:.305},
  wagon: {file:'garage/estate-car.glb', source:'Family Estate Car', eye:[.37,1.22,-.34], radius:.330},
};

export function prepareVehicle(body, profile, reflections) {
  const spec = vehicleAssets[profile.id];
  const wheels = ['FL','FR','RL','RR'].map(id=>body.getObjectByName('wheel_'+id));
  const front = wheels.slice(0,2).map((wheel,index) => {
    const side = index === 0 ? 'FL' : 'FR';
    const authored = body.getObjectByName('steer_'+side);
    if (authored) return authored;
    const pivot = new THREE.Group();
    pivot.position.copy(wheel.position);
    wheel.parent.add(pivot);
    pivot.attach(wheel);
    const caliper = body.getObjectByName('caliper_'+side);
    if (caliper) pivot.attach(caliper);
    return pivot;
  });
  const steeringWheel = body.getObjectByName('steering_wheel');
  const windowMeshes = [];
  const materials = new Set();
  body.traverse(node => {
    if (!node.isMesh) return;
    if (node.name.includes('glass_')) windowMeshes.push(node);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      materials.add(material);
    }
  });
  for (const material of materials) {
    if (material.name === 'paint_body' || material.name === 'paint') material.color.set(profile.color);
    if (material.isMeshStandardMaterial) {
      material.envMap = reflections;
      material.envMapIntensity = .62;
    }
  }

  let steering = 0;
  let spin = 0;
  const rest = wheels.map(wheel=>wheel.quaternion.clone());
  const wheelRest = steeringWheel.quaternion.clone();
  const rotation = new THREE.Quaternion();
  const axle = new THREE.Vector3(1,0,0);
  const column = new THREE.Vector3(0,0,1);

  return {
    body,
    eye:new THREE.Vector3(...spec.eye),
    setCabinView(inside) {
      for (const pane of windowMeshes) pane.visible = !inside;
    },
    animate(turn,speed,dt) {
      steering = dt ? THREE.MathUtils.lerp(steering,turn,Math.min(1,dt*12)) : 0;
      spin = (spin+speed*dt/spec.radius) % (2*Math.PI);
      for (const [index,wheel] of wheels.entries()) {
        wheel.quaternion.copy(rest[index]).multiply(rotation.setFromAxisAngle(axle,spin*(index%2?-1:1)));
      }
      for (const pivot of front) pivot.rotation.y = -steering*.31;
      steeringWheel.quaternion.copy(wheelRest).multiply(rotation.setFromAxisAngle(column,steering*.88));
    },
  };
}
