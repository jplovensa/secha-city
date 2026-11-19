import * as THREE from 'three';
import { roadHalfWidth, roadLength, roadPoint, routeCheckpoints } from './traffic.js';

const metal = new THREE.MeshStandardMaterial({color:'#3c3e34',roughness:.68});
const light = new THREE.MeshStandardMaterial({color:'#ffdda1',emissive:'#d9a557',emissiveIntensity:.65});
const pole = new THREE.CylinderGeometry(.045,.072,3.1,8);
const arm = new THREE.BoxGeometry(.10,.09,.70);
const diffuser = new THREE.BoxGeometry(.26,.07,.33);
const signboard = new THREE.BoxGeometry(2.5,.62,.08);
const signpost = new THREE.BoxGeometry(.09,1.44,.09);

function streetlamp(point, height) {
  const {x,z,nx,nz} = point;
  const lamp = new THREE.Group();
  const post = new THREE.Mesh(pole,metal);
  post.position.y = 1.55;
  const bracket = new THREE.Mesh(arm,metal);
  bracket.position.set(0,3.10,.26);
  const shade = new THREE.Mesh(diffuser,light);
  shade.position.set(0,3.04,.55);
  lamp.add(post,bracket,shade);
  lamp.position.set(x - nx*(roadHalfWidth+1.9),height,z - nz*(roadHalfWidth+1.9));
  lamp.rotation.y = Math.atan2(nx,nz);
  return lamp;
}

function wayfinding(label, location, rotation, height) {
  const marker = new THREE.Group();
  const post = new THREE.Mesh(signpost,metal);
  post.position.y = .72;
  const plate = new THREE.Mesh(signboard,metal);
  plate.position.y = 1.55;
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 160;
  const art = canvas.getContext('2d');
  art.fillStyle = '#343d32';
  art.fillRect(0,0,640,160);
  art.lineWidth = 3;
  art.strokeStyle = '#a39474';
  art.strokeRect(11,11,618,138);
  art.fillStyle = '#e9d5b0';
  art.font = '600 26px Helvetica, Arial, sans-serif';
  art.fillText('SECHA CITY',34,52);
  art.fillStyle = '#fff4df';
  art.font = '600 53px Helvetica, Arial, sans-serif';
  art.fillText(label,34,119,570);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(2.48,.60),new THREE.MeshBasicMaterial({map:texture}));
  face.position.set(0,1.55,.045);
  marker.add(post,plate,face);
  marker.position.set(location[0],height,location[1]);
  marker.rotation.y = rotation;
  return marker;
}

export function addStreetscape(scene,height) {
  const street = new THREE.Group();
  const lampCount = 16;
  for (let i = 0; i < lampCount; i++) {
    street.add(streetlamp(roadPoint(roadLength*(i+.52)/lampCount),height));
  }
  street.add(
    wayfinding(routeCheckpoints[0].name,[11,36.4],-Math.PI/2,height),
    wayfinding(routeCheckpoints[1].name,[36.4,23.5],0,height),
    wayfinding(routeCheckpoints[2].name,[14,-36.4],Math.PI/2,height),
  );
  scene.add(street);
}
