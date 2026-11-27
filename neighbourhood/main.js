import './style.css';
import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { HDRCubeTexture } from '@babylonjs/core/Materials/Textures/hdrCubeTexture.js';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration.js';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator.js';
import { RenderTargetTexture } from '@babylonjs/core/Materials/Textures/renderTargetTexture.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { vehicleAssets } from '../vehicle-data.js';
import { cars, createDriftRun, driftTarget, driftZones, scoreDrift } from '../drift.js';
import { driveStep, roadLength, roadPoint } from '../traffic.js';
import { advanceJob, choices, objective, restoreJob, sites } from './mission.js';
import { asset, loadArchitecture, loadVehicle } from './assets.js';
import { loadCast } from './cast.js';
import { cityLandmarks, floorHeight, makeNeighbourhood } from './world.js';
import { makeNavigation } from './navigation.js';

const $=id=>document.getElementById(id);
const canvas=$('city-world');
const modal=$('dialog');
const mapCanvas=$('map-canvas');
const map=mapCanvas.getContext('2d');
const keys=new Set();
const pressed=new Map();
const garage=new Map();
const saveKey='secha-city-house-at-dusk-v1';
const parked={x:0,z:42,yaw:Math.PI/2,speed:0};
const rupiah=new Intl.NumberFormat('en-GB');
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const wheelInput=(positive,negative)=>Number(keys.has(positive))-Number(keys.has(negative));

let engine,scene,camera,world,vehicle,driftMarker,cast,nav,sun,sky,shadows;
let route=[],eyeHeight=1.70,qualityAt=0;
let ready=false,driving=false,cockpit=false,carLoading=false;
let car={...parked}, walker={x:.15,z:36.8,yaw:Math.PI,pitch:-.04};
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
  route=[];
  updateRoom();
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
function updateRoom() {
  const dusk=job.step==='complete';
  const selection=job.step==='deliver'||dusk?outcome():null;
  world.applyFinish(selection,dusk);
  sun.intensity=dusk?.31:1.9;
  sun.diffuse=Color3.FromHexString(dusk?'#ffac73':'#fff0da').toLinearSpace();
  sky.intensity=dusk?.25:.63;
  scene.environmentIntensity=dusk?.24:.88;
  scene.fogColor.set(...(dusk?[.41,.40,.47]:[.72,.78,.83]));
  scene.clearColor.set(scene.fogColor.r,scene.fogColor.g,scene.fogColor.b,1);
}

function missionAction(site) {
  if(job.step==='offer'&&site==='studio') {
    openDialog('Josephine · SECHA Reception','The first guest is coming at dusk',
      'Ibu wants a room she can read in without feeling on display. Walk to Rumah Teduh, look at the view from the entrance and decide what the timber screen needs to do.',
      [{label:'Accept the commission',action:()=>{changeJob(site);close();}}]);
  } else if(job.step==='inspect'&&site==='client') {
    openDialog('Ibu · Rumah Teduh','Light without being on display',
      'From here I can see the entire bed from the lounge. I’d like a little privacy and enough light to read by. Dina has three approaches ready at the Material Library.',
      [{label:'Take the brief to Dina',action:()=>{changeJob(site);close();}}]);
  } else if(job.step==='source'&&site==='lab') {
    openDialog('Dina · Material Library','Choose how the room should feel',
      'We’re keeping the bed, floor and joinery. Pick a screen for the sightline you saw in the room.',
      choices.map(option=>({
        label:option.label,
        detail:option.detail+' Fee IDR '+rupiah.format(option.fee)+' · Trust +'+option.trust+'.',
        action:()=>{changeJob(site,option.id);close();},
      })));
  } else if(job.step==='deliver'&&site==='client') {
    openDialog('Ibu · Rumah Teduh','See the room at dusk',
      outcome().finish+' is installed. Open the room to see how your choice feels with the lamps on.',
      [{label:'Open the room',action:()=>{changeJob(site);close();}}]);
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
    const [x,z]=nav.walk(car.x,car.z,sideX*towardInside*1.72,sideZ*towardInside*1.72);
    walker={x,z,yaw:car.yaw,pitch:-.07};
    car={...car,speed:0,slip:0,heading:car.yaw};
    driving=false;
    vehicle.sync(car,false,0,0);
  } else {
    if (distance(car,walker)>3.25 || carLoading) return;
    driving=true;
    route=[];
  }
  resetInput();
}
function nearSite() {
  const site=objective(job).site;
  return site && distance(walker,sites[site])<2.1 && nav.line(walker,sites[site]) ? site : null;
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
    offer:'Talk to Josephine',inspect:'Talk to Ibu',source:'Talk to Dina',deliver:'Review the room with Ibu',
  }[job.step] : 'Get in car';
  $('interact').hidden=!driving && !site && !nearCar;
  const disabled=carLoading || (driving && !canExit());
  if ($('interact').disabled!==disabled) $('interact').disabled=disabled;
  putText('interact',label);
  $('garage').hidden=driving || distance(walker,{x:parked.x,z:parked.z})>9;
  $('follow').hidden=driving||!objective(job).site||Boolean(site);
  putText('follow',route.length?'Stop following':'Follow route');
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

function followRoute() {
  const site=objective(job).site;
  if(!site||driving||modal.open) return;
  if(route.length) {route=[];return;}
  route=nav.route(walker,sites[site]);
  if(!route.length) putText('destination','Walk clear of the nearest obstacle, then try again.');
}

function updateWalking(dt) {
  const forward=wheelInput('KeyW','KeyS'),right=wheelInput('KeyD','KeyA');
  const turn=wheelInput('ArrowRight','ArrowLeft');
  if(turn||forward||right) route=[];
  walker.yaw-=turn*dt*1.8;
  if(route.length) {
    const target=route[0];
    const dx=target.x-walker.x,dz=target.z-walker.z;
    const remaining=Math.hypot(dx,dz);
    if(remaining<.025||nearSite()) {
      if(nearSite()) route=[];
      else route.shift();
      return;
    }
    const yaw=Math.atan2(dx,dz);
    const delta=Math.atan2(Math.sin(yaw-walker.yaw),Math.cos(yaw-walker.yaw));
    walker.yaw+=Math.max(-dt*3,Math.min(dt*3,delta));
    const stride=Math.min(remaining,dt*3.55)/remaining;
    const [x,z]=nav.walk(walker.x,walker.z,dx*stride,dz*stride);
    if(x===walker.x&&z===walker.z&&dt>0) {route=[];return;}
    walker.x=x;walker.z=z;
    return;
  }
  const length=3.45*dt/Math.max(1,Math.hypot(forward,right));
  const [x,z]=nav.walk(walker.x,walker.z,(Math.sin(walker.yaw)*forward-Math.cos(walker.yaw)*right)*length,
    (Math.cos(walker.yaw)*forward+Math.sin(walker.yaw)*right)*length);
  walker.x=x;walker.z=z;
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
function updateCamera(dt=1) {
  const body=driving?car:walker;
  const forward=new Vector3(Math.sin(body.yaw),0,Math.cos(body.yaw));
  if(driving && cockpit) {
    vehicle.root.computeWorldMatrix(true);
    camera.position.copyFrom(Vector3.TransformCoordinates(vehicle.eye,vehicle.root.getWorldMatrix()));
    camera.setTarget(camera.position.add(forward.scale(12)).add(new Vector3(0,-1.25,0)));
  } else if(driving) {
    const origin=new Vector3(car.x,.46,car.z);
    camera.position.copyFrom(origin.subtract(forward.scale(6.7)).add(new Vector3(0,3.4,0)));
    camera.setTarget(origin.add(forward.scale(2.9)).add(new Vector3(0,.78,0)));
  } else {
    eyeHeight+=(floorHeight(walker.x,walker.z)+1.64-eyeHeight)*Math.min(1,dt*7);
    camera.position.set(walker.x,eyeHeight,walker.z);
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
  cityLandmarks.forEach(([left,right,back,front])=>map.fillRect(mapX(left),mapY(back),(right-left)*2.70,(front-back)*2.70));
  if(route.length) {
    map.strokeStyle='#ead494';map.lineWidth=3;
    map.beginPath();map.moveTo(mapX(walker.x),mapY(walker.z));
    for(const point of route) map.lineTo(mapX(point.x),mapY(point.z));
    map.stroke();
  }
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
$('follow').addEventListener('click',followRoute);
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
  route=[];
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
  scene.clearColor=new Color4(.72,.78,.83,1);
  scene.fogMode=Scene.FOGMODE_EXP2;
  scene.fogDensity=.008;
  scene.fogColor=new Color3(.72,.78,.83);
  scene.imageProcessingConfiguration.toneMappingEnabled=true;
  scene.imageProcessingConfiguration.toneMappingType=ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure=1.16;
  scene.imageProcessingConfiguration.contrast=1.10;
  const environment=new HDRCubeTexture(asset('garage/daylight.hdr'),scene,128,false,true,false,true);
  scene.environmentTexture=environment;
  scene.environmentIntensity=.88;
  camera=new FreeCamera('Player camera',new Vector3(0,1.65,0),scene);
  camera.minZ=.05;
  camera.maxZ=125;
  camera.fov=innerWidth<650?1.07:.98;
  scene.activeCamera=camera;
  sky=new HemisphericLight('Open sky',new Vector3(.2,1,.3),scene);
  sky.intensity=.63;
  sky.groundColor=new Color3(.45,.40,.31);
  sun=new DirectionalLight('Afternoon sun',new Vector3(-.62,-1,-.44),scene);
  sun.position.set(37,60,25);
  sun.shadowFrustumSize=112;
  sun.shadowMinZ=5;
  sun.shadowMaxZ=130;
  sun.intensity=1.9;
  shadows=new ShadowGenerator(innerWidth<650?1024:2048,sun);
  shadows.usePercentageCloserFiltering=true;
  shadows.filteringQuality=ShadowGenerator.QUALITY_LOW;
  shadows.bias=.0009;
  shadows.normalBias=.015;
  shadows.setDarkness(.22);
  shadows.getShadowMap().refreshRate=RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
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
    const dt=Math.min(engine.getDeltaTime()/1000,.24);
    if(ready && !modal.open) {
      // Preserve the road and doorway collision step size during a slow render.
      const steps=Math.max(1,Math.ceil(dt/.04));
      for(let i=0;i<steps;i++) {
        if(driving) updateDriving(dt/steps);
        else updateWalking(dt/steps);
      }
      updateCamera(dt);
      cast.update(objective(job).site,driving?car:walker,dt);
      refreshControls();
      const now=performance.now();
      if(now-mapAt>75) {drawMap();mapAt=now;}
      if(now-qualityAt>4500) {
        qualityAt=now;
        const scale=engine.getHardwareScalingLevel();
        if(engine.getFps()<26&&scale<1.85) engine.setHardwareScalingLevel(Math.min(1.85,scale+.18));
      }
    }
    scene.render();
  });
  const results=await Promise.all([
    carFor(profile),loadCast(scene),
    ...['arrival','gallery','teduh','district'].map(name=>loadArchitecture(name,scene,shadows)),
  ]);
  [vehicle,cast]=results;
  nav=makeNavigation(results.slice(2).flat());
  shadows.getShadowMap().resetRefreshCounter();
  vehicle.sync(car,false,0,0);
  vehicle.root.setEnabled(true);
  ready=true;
  $('controls').hidden=$('touch').hidden=false;
  refreshJob();
}
start().catch(error=>{
  console.error(error);
  putText('objective','The city could not load. Reload the page to retry.');
});
