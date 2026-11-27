import './style.css';
import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { vehicleAssets } from '../vehicle-data.js';
import { cars, createDriftRun, driftTarget, driftZones, scoreDrift } from '../drift.js';
import { driveStep, roadLength, roadPoint } from '../traffic.js';
import { advanceJob, choices, objective, restoreJob, sites } from './mission.js';
import { addCast, loadDistrict, loadVehicle } from './assets.js';
import { authoredBlocks, makeNeighbourhood, walkPosition } from './world.js';

const $=id=>document.getElementById(id);
const canvas=$('city-world');
const modal=$('dialog');
const mapCanvas=$('map-canvas');
const map=mapCanvas.getContext('2d');
const keys=new Set();
const pressed=new Map();
const garage=new Map();
const saveKey='secha-neighbourhood-keys-by-six-v1';
const parked={x:-14,z:42,yaw:Math.PI/2,speed:0};
const rupiah=new Intl.NumberFormat('en-GB');
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const wheelInput=(positive,negative)=>Number(keys.has(positive))-Number(keys.has(negative));

let engine,scene,camera,world,vehicle,driftMarker;
let ready=false,driving=false,cockpit=false,carLoading=false;
let car={...parked}, walker={x:-14,z:36.2,yaw:Math.PI,pitch:-.04};
let profile=cars[0], run=null, drag=null, mapAt=0;
let job=restoreJob(null);
try {
  const data=JSON.parse(localStorage.getItem(saveKey)??'null');
  job=restoreJob(data?.job);
  profile=cars.find(item=>item.id===data?.vehicle)??profile;
} catch { /* A missing or unreadable save starts a new commission. */ }

const outcome=()=>choices.find(item=>item.id===job.choice);
function putText(id,text) {
  if ($(id).textContent!==text) $(id).textContent=text;
}
function save() {
  try { localStorage.setItem(saveKey,JSON.stringify({job,vehicle:profile.id})); }
  catch { /* Progress stays available for the current session. */ }
}
function refreshJob() {
  const current=objective(job);
  putText('objective',current.text+'.');
  $('result').hidden=job.step!=='complete';
  if (job.step==='complete') {
    const {fee,trust}=outcome();
    putText('result','Handover complete · IDR '+rupiah.format(fee)+' · Trust '+(trust>0?'+':'')+trust);
  }
  world.mark(current.site);
  world.applyFinish(job.step==='complete'?outcome():null);
}
function changeJob(site,choice) {
  job=advanceJob(job,site,choice);
  save();
  refreshJob();
}

function resetInput() {
  keys.clear();
  pressed.clear();
  drag=null;
}
function openDialog(kicker,title,copy,options) {
  resetInput();
  putText('dialog-kicker',kicker);
  putText('dialog-title',title);
  putText('dialog-copy',copy);
  const list=$('dialog-options');
  list.replaceChildren();
  for(const {label,detail,action} of options) {
    const button=document.createElement('button');
    button.type='button';
    button.append(label);
    if(detail) {
      const small=document.createElement('small');
      small.textContent=detail;
      button.append(small);
    }
    button.addEventListener('click',action);
    list.append(button);
  }
  if(!modal.open) modal.showModal();
}
const close=()=>modal.close();
function missionAction(site) {
  if (job.step==='offer' && site==='studio') {
    openDialog('SECHA Studio','The client needs their keys by six',
      'A client is moving into Courtyard Apartments at 18:00. Inspect their bedroom and confirm the specified walnut privacy screen. Your car is parked by the studio.',
      [{label:'Take the commission',action:()=>{changeJob(site);close();}}]);
  } else if (job.step==='inspect' && site==='client') {
    openDialog('Courtyard Apartments','One thing left to fit',
      'The bed and lights are ready. The client asked for a walnut screen between the window and the bed. Check stock at the Material Lab before confirming the handover.',
      [{label:'Check stock at the Material Lab',action:()=>{changeJob(site);close();}}]);
  } else if (job.step==='source' && site==='lab') {
    openDialog('Material Lab','The walnut delivery is late',
      'Walnut won’t arrive until tomorrow morning. The client has asked you to recommend a plan before they leave for the apartment.',
      choices.map(option=>({
        label:option.label,
        detail:option.detail+' Fee IDR '+rupiah.format(option.fee)+' · Trust '+(option.trust>0?'+':'')+option.trust+'.',
        action:()=>{changeJob(site,option.id);close();},
      })));
  } else if (job.step==='deliver' && site==='client') {
    const result=outcome();
    openDialog('Courtyard Apartments','Confirm the handover',
      'Agreed handover: '+result.handover+'. Screen: '+result.finish+'. Confirm to collect your fee and walk through the delivered room.',
      [{label:'Confirm handover',action:()=>{changeJob(site);close();}}]);
  }
}

function carFor(selection) {
  if(!garage.has(selection.id)) {
    const pending=loadVehicle(selection,scene).then(model=>{
      model.root.setEnabled(false);
      return model;
    }).catch(error=>{
      garage.delete(selection.id);
      throw error;
    });
    garage.set(selection.id,pending);
  }
  return garage.get(selection.id);
}
function showGarage() {
  if (!ready || carLoading || driving || distance(walker,{x:parked.x,z:parked.z})>9) return;
  openDialog('SECHA Studio','Choose a car','Your selection applies to the car parked at the studio.',
    cars.map(item=>({
      label:item.name+(profile===item?' · Selected':''),
      detail:vehicleAssets[item.id].source+' · '+item.description,
      action:async()=>{
        if(carLoading) return;
        carLoading=true;
        for(const button of $('dialog-options').querySelectorAll('button')) button.disabled=true;
        putText('dialog-copy','Opening '+item.name+'…');
        try {
          const model=await carFor(item);
          vehicle?.root.setEnabled(false);
          vehicle=model;
          profile=item;
          car={...parked};
          vehicle.sync(car,false,0,0);
          vehicle.root.setEnabled(true);
          save();
          if(modal.open) close();
        } catch(error) {
          console.warn(error);
          putText('dialog-copy','This car could not load. Choose it again to retry.');
          for(const button of $('dialog-options').querySelectorAll('button')) button.disabled=false;
        } finally {
          carLoading=false;
        }
      },
    })));
}

function canExit() { return Math.abs(car.speed)<1.65; }
function useCar() {
  if (driving) {
    if (!canExit()) return;
    const sideX=-Math.cos(car.yaw),sideZ=Math.sin(car.yaw);
    const towardInside=car.x*sideX+car.z*sideZ<0?1:-1;
    const [x,z]=walkPosition(car.x,car.z,sideX*towardInside*1.72,sideZ*towardInside*1.72,world.obstacles);
    walker={x,z,yaw:car.yaw,pitch:-.07};
    car={...car,speed:0,slip:0,heading:car.yaw};
    driving=false;
    vehicle.sync(car,false,0,0);
  } else {
    if (distance(car,walker)>3.25 || carLoading) return;
    driving=true;
  }
  resetInput();
}
function nearSite() {
  const site=objective(job).site;
  return site && distance(walker,sites[site])<2.2 ? site : null;
}
function action() {
  if (!ready || modal.open || carLoading) return;
  if (driving) {useCar();return;}
  const site=nearSite();
  if(site) missionAction(site);
  else useCar();
}

function refreshControls() {
  const site=!driving && nearSite();
  const nearCar=distance(car,walker)<=3.25;
  const label=driving ? canExit()?'Get out':'Slow down to exit' : site ? {
    offer:'Accept commission',inspect:'Inspect bedroom',source:'Check available finishes',deliver:'Hand over apartment',
  }[job.step] : 'Get in car';
  $('interact').hidden=!driving && !site && !nearCar;
  const disabled=carLoading || (driving && !canExit());
  if ($('interact').disabled!==disabled) $('interact').disabled=disabled;
  putText('interact',label);
  $('garage').hidden=driving || distance(walker,{x:parked.x,z:parked.z})>9;
  $('camera').hidden=$('drift').hidden=$('brake').hidden=$('drive-hud').hidden=!driving;
  putText('camera',cockpit?'Chase view':'Cockpit view');
  putText('drift',run?'Leave drift':'Drift challenge');
  if (driving) {
    putText('speed',Math.round(Math.abs(car.speed)*3.6)+' km/h');
    const progress=run?.next===driftZones.length ? (run.points>=driftTarget?'Complete':'Target missed') :
      run ? driftZones[run.next].name:'';
    putText('drift-score',run?Math.round(run.points+run.slide)+' / '+driftTarget+' pts · '+progress:'');
  }
}
function changeCamera() {if(driving) cockpit=!cockpit;}
function toggleDrift() {
  if(!driving) return;
  run=run?null:createDriftRun();
  refreshDriftMarker();
}
function refreshDriftMarker() {
  const target=run&&driftZones[run.next];
  driftMarker.setEnabled(Boolean(target));
  if(target) driftMarker.position.set(target.x,.11,target.z);
}

function updateWalking(dt) {
  const forward=wheelInput('KeyW','KeyS'),right=wheelInput('KeyD','KeyA');
  const turn=wheelInput('ArrowRight','ArrowLeft');
  walker.yaw-=turn*dt*1.8;
  const length=3.45*dt/Math.max(1,Math.hypot(forward,right));
  const [x,z]=walkPosition(walker.x,walker.z,(Math.sin(walker.yaw)*forward-Math.cos(walker.yaw)*right)*length,
    (Math.cos(walker.yaw)*forward+Math.sin(walker.yaw)*right)*length,world.obstacles);
  walker.x=x;
  walker.z=z;
}
function updateDriving(dt) {
  const steer=wheelInput('KeyD','KeyA')+wheelInput('ArrowRight','ArrowLeft');
  car=driveStep(car,-Math.sign(steer),wheelInput('KeyW','KeyS'),dt,keys.has('Space'),profile);
  vehicle.sync(car,cockpit,Math.sign(steer),dt);
  if(run) {
    const previous=run.next;
    scoreDrift(run,car,dt);
    if(previous!==run.next) refreshDriftMarker();
  }
}
function updateCamera() {
  const body=driving?car:walker;
  const forward=new Vector3(Math.sin(body.yaw),0,Math.cos(body.yaw));
  if(driving && cockpit) {
    vehicle.root.computeWorldMatrix(true);
    camera.position.copyFrom(Vector3.TransformCoordinates(vehicle.eye,vehicle.root.getWorldMatrix()));
    camera.setTarget(camera.position.add(forward.scale(12)).add(new Vector3(0,-1.25,0)));
  } else if(driving) {
    const origin=new Vector3(car.x,.24,car.z);
    camera.position.copyFrom(origin.subtract(forward.scale(6.7)).add(new Vector3(0,3.4,0)));
    camera.setTarget(origin.add(forward.scale(2.9)).add(new Vector3(0,.78,0)));
  } else {
    camera.position.set(walker.x,1.66,walker.z);
    camera.setTarget(camera.position.add(forward).add(new Vector3(0,walker.pitch,0)));
  }
}

const mapX=x=>170+x*2.70;
const mapY=z=>150+z*2.70;
function drawMap() {
  map.fillStyle='#1d3027';
  map.fillRect(0,0,340,300);
  map.strokeStyle='#b3a48d';map.lineWidth=9;
  map.beginPath();
  for(let i=0;i<=128;i++) {
    const {x,z}=roadPoint(i*roadLength/128);
    if(i===0) map.moveTo(mapX(x),mapY(z));
    else map.lineTo(mapX(x),mapY(z));
  }
  map.stroke();
  map.fillStyle='#496052';
  authoredBlocks.forEach(([left,right,back,front])=>map.fillRect(mapX(left),mapY(back),(right-left)*2.70,(front-back)*2.70));
  const next=objective(job).site;
  for(const [id,site] of Object.entries(sites)) {
    map.fillStyle=next===id?'#f2c477':'#a3ae8a';
    map.beginPath();map.arc(mapX(site.x),mapY(site.z),next===id?8:5,0,Math.PI*2);map.fill();
  }
  if(!driving) {
    map.fillStyle='#d48e73';map.fillRect(mapX(car.x)-4,mapY(car.z)-4,8,8);
  }
  const p=driving?car:walker;
  const nextDrift=run&&driftZones[run.next];
  if(nextDrift) {
    map.strokeStyle='#f3c579';map.lineWidth=3;
    map.beginPath();map.arc(mapX(nextDrift.x),mapY(nextDrift.z),10,0,Math.PI*2);map.stroke();
  }
  map.save();
  map.translate(mapX(p.x),mapY(p.z));map.rotate(-p.yaw);
  map.fillStyle='#fff7e1';map.beginPath();map.moveTo(0,10);map.lineTo(-6,-5);map.lineTo(6,-5);map.closePath();map.fill();
  map.restore();
  const target=next?sites[next]:null;
  putText('destination',target?target.label+' · '+Math.round(distance(driving?{x:target.parking[0],z:target.parking[1]}:target,p))+' m':'Free roam');
}

$('interact').addEventListener('click',action);
$('garage').addEventListener('click',showGarage);
$('camera').addEventListener('click',changeCamera);
$('drift').addEventListener('click',toggleDrift);
modal.addEventListener('close',resetInput);
window.addEventListener('blur',resetInput);
document.addEventListener('visibilitychange',resetInput);

const aliases={ArrowUp:'KeyW',ArrowDown:'KeyS'};
const movement=new Set(['KeyW','KeyS','KeyA','KeyD','ArrowLeft','ArrowRight','Space']);
window.addEventListener('keydown',event=>{
  if(!ready || modal.open || event.altKey || event.ctrlKey || event.metaKey) return;
  const key=aliases[event.code]??event.code;
  if(movement.has(key) && (key!=='Space'||driving)) {
    event.preventDefault();
    keys.add(key);
  }
  if(!event.repeat && key==='KeyE') action();
  if(!event.repeat && key==='KeyC') changeCamera();
});
window.addEventListener('keyup',event=>keys.delete(aliases[event.code]??event.code));
for(const button of document.querySelectorAll('[data-key]')) {
  button.addEventListener('pointerdown',event=>{
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    pressed.set(event.pointerId,button.dataset.key);
    keys.add(button.dataset.key);
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(type,event=>{
    const key=pressed.get(event.pointerId);
    pressed.delete(event.pointerId);
    if(key&&![...pressed.values()].includes(key)) keys.delete(key);
  });
}
canvas.addEventListener('pointerdown',event=>{
  if(driving || modal.open || !ready || event.button!==0) return;
  canvas.setPointerCapture(event.pointerId);
  drag={pointer:event.pointerId,x:event.clientX,y:event.clientY};
});
canvas.addEventListener('pointermove',event=>{
  if(drag?.pointer!==event.pointerId) return;
  walker.yaw-=(event.clientX-drag.x)*.0044;
  walker.pitch=Math.max(-.82,Math.min(.76,walker.pitch-(event.clientY-drag.y)*.0043));
  drag.x=event.clientX;
  drag.y=event.clientY;
});
canvas.addEventListener('lostpointercapture',()=>{drag=null;});

async function start() {
  engine=new Engine(canvas,true,{adaptToDeviceRatio:false,doNotHandleContextLost:false});
  engine.setHardwareScalingLevel(Math.max(.85,1/Math.min(devicePixelRatio,1.4)));
  scene=new Scene(engine);
  scene.useRightHandedSystem=true;
  scene.clearColor=new Color4(.79,.78,.68,1);
  scene.fogMode=Scene.FOGMODE_EXP2;
  scene.fogDensity=.012;
  scene.fogColor=new Color3(.79,.78,.68);
  camera=new FreeCamera('Player camera',new Vector3(0,1.65,0),scene);
  camera.minZ=.05;
  camera.maxZ=125;
  camera.fov=innerWidth<650?1.07:.98;
  scene.activeCamera=camera;
  const sky=new HemisphericLight('Open sky',new Vector3(.2,1,.3),scene);
  sky.intensity=.79;
  sky.groundColor=new Color3(.45,.40,.31);
  const sun=new DirectionalLight('Afternoon sun',new Vector3(-.65,-1,-.42),scene);
  sun.diffuse=new Color3(1,.91,.77);
  sun.intensity=.69;
  world=makeNeighbourhood(scene);
  driftMarker=MeshBuilder.CreateTorus('Drift corner',{diameter:3.25,thickness:.11,tessellation:32},scene);
  driftMarker.material=new StandardMaterial('Amber drift marker',scene);
  driftMarker.material.emissiveColor=new Color3(1,.65,.15);
  driftMarker.setEnabled(false);

  window.addEventListener('resize',()=>{
    engine.resize();
    camera.fov=innerWidth<650?1.07:.98;
  });
  updateCamera();
  engine.runRenderLoop(()=>{
    if(document.hidden) return;
    const dt=Math.min(engine.getDeltaTime()/1000,.05);
    if(ready && !modal.open) {
      if(driving) updateDriving(dt);
      else updateWalking(dt);
      updateCamera();
      refreshControls();
      const now=performance.now();
      if(now-mapAt>75) {drawMap();mapAt=now;}
    }
    scene.render();
  });
  [vehicle]=await Promise.all([carFor(profile),loadDistrict(scene)]);
  vehicle.sync(car,false,0,0);
  vehicle.root.setEnabled(true);
  addCast(scene).catch(error=>console.warn('The neighbourhood crew could not load.',error));
  ready=true;
  $('controls').hidden=$('touch').hidden=false;
  refreshJob();
}
start().catch(error=>{
  console.error(error);
  putText('objective','The neighbourhood could not load. Reload to retry or return to the City menu.');
});
