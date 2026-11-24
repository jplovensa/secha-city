import * as THREE from 'three';

const rubber = new THREE.MeshStandardMaterial({color:'#1c1e1c',roughness:.90});
const trim = new THREE.MeshStandardMaterial({color:'#292c27',roughness:.75});
const metal = new THREE.MeshStandardMaterial({color:'#9da29c',metalness:.62,roughness:.31});
const glass = new THREE.MeshStandardMaterial({color:'#333f40',metalness:.29,roughness:.18});
const white = new THREE.MeshBasicMaterial({color:'#ffebc3'});
const red = new THREE.MeshBasicMaterial({color:'#e34433'});

function box(group, material, size, position) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size),material);
  mesh.position.set(...position);
  group.add(mesh);
  return mesh;
}

function sideProfile(group, points, width, material) {
  const shape = new THREE.Shape();
  for (const [index,[length,height]] of points.entries()) {
    if (index === 0) shape.moveTo(-length,height);
    else shape.lineTo(-length,height);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape,{depth:width,bevelSize:.059,bevelThickness:.055,bevelSegments:2,steps:1});
  geometry.translate(0,0,-width/2);
  geometry.rotateY(Math.PI/2);
  const mesh = new THREE.Mesh(geometry,material);
  group.add(mesh);
  return mesh;
}

export function makeStreetCar(profile) {
  const wagon = profile.id === 'wagon';
  const body = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({color:profile.color,metalness:.32,roughness:.29});
  const half = wagon ? 2.28 : 2.14;
  const deck = wagon ? .85 : .68;
  sideProfile(body,[[-half,.39],[-half,deck],[-1.45,deck+.05],[.72,deck+.04],[half,.65],[half,.40]],1.74,paint);
  const roof = wagon ? 1.43 : 1.22;
  const tail = wagon ? -1.98 : -1.50;
  sideProfile(body,[[tail,deck+.03],[wagon?-1.78:-.74,roof],[.11,roof],[.89,deck+.04]],1.48,glass);
  box(body,paint,[1.52,.065,wagon?1.89:.81],[0,roof+.027,wagon?-.8:-.30]);
  box(body,trim,[1.61,.13,.14],[0,.39,half]);
  box(body,trim,[1.62,.12,.12],[0,.40,-half]);
  if (!wagon) box(body,trim,[1.51,.055,.27],[0,.86,-1.92]);
  const wheels = [];
  for (const side of [-1,1]) {
    box(body,white,[.43,.12,.075],[side*.57,.60,half+.018]);
    box(body,red,[.39,.11,.075],[side*.58,deck-.11,-half-.022]);
    box(body,paint,[.25,.12,.23],[side*.90,deck+.20,.53]);
    for (const axle of [-1,1]) {
      const wheel = new THREE.Group();
      wheel.position.set(side*.84,.34,axle*(wagon?1.36:1.24));
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(.355,.355,.25,18),rubber);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(.23,.23,.262,10),metal);
      tyre.rotation.z = rim.rotation.z = Math.PI/2;
      wheel.add(tyre,rim);
      box(wheel,trim,[.269,.105,.40],[0,0,0]);
      box(wheel,trim,[.269,.40,.105],[0,0,0]);
      body.add(wheel);
      wheels.push(wheel);
    }
  }
  return {body,wheels};
}

export function makeCockpit() {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({roughness:.4,metalness:.32});
  const dash = new THREE.MeshStandardMaterial({color:'#242625',roughness:.88});
  box(group,paint,[1.68,.11,1.32],[0,.63,1.42]);
  box(group,dash,[1.66,.26,.39],[0,.84,.81]);
  box(group,trim,[1.53,.09,.33],[0,.96,.79]);
  box(group,dash,[.43,.15,.15],[.31,1.02,.77]);
  const instrument = new THREE.Group();
  instrument.position.set(.31,1.025,.68);
  group.add(instrument);
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(.059,.005,8,24),metal);
  instrument.add(bezel);
  for (let tick=0; tick<9; tick++) {
    const angle = -2.25 + tick*.56;
    const line = box(instrument,white,[.003,.010,.003],[Math.sin(angle)*.046,Math.cos(angle)*.046,-.004]);
    line.rotation.z=-angle;
  }
  const needle = new THREE.Group();
  box(needle,red,[.003,.043,.003],[0,.020,-.007]);
  instrument.add(needle);
  for (const side of [-1,1]) {
    const pillar = box(group,dash,[.085,.75,.11],[side*.77,1.19,.85]);
    pillar.rotation.x = -.36;
    pillar.rotation.z = side*.26;
    box(group,trim,[.18,.27,1.3],[side*.86,.82,-.09]);
  }
  const wheel = new THREE.Group();
  wheel.position.set(.31,.90,.59);
  wheel.rotation.x = -.30;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.158,.023,10,32),rubber);
  wheel.add(ring);
  box(wheel,metal,[.28,.035,.024],[0,0,0]);
  box(wheel,dash,[.115,.088,.04],[0,0,-.022]);
  box(wheel,metal,[.033,.10,.024],[0,-.075,0]);
  group.add(wheel);
  return {group,paint,wheel,needle};
}
