import * as THREE from 'three';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { dividerLayout, finishes } from './chapter.js';
import { createCast, encounters } from './characters.js';
import { applyFurnitureLayout } from './layout.js';
import { driveStep, routeCheckpoints } from './traffic.js';
import { createPavilions } from './pavilions.js';
import { plots } from './city-operations.js';

const files = ['arrival', 'gallery', 'teduh','district'];
const asset = (name) => new URL(import.meta.env.BASE_URL + name, document.baseURI).href;
const worldPoint = ([x, y, z]) => new THREE.Vector3(x, z, -y);

export function createCity(canvas, onIssue) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 700 ? 1.25 : 1.6));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  let dirty = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#d8c9ae');
  scene.fog = new THREE.FogExp2('#d8c9ae', .016);
  const camera = new THREE.PerspectiveCamera(56, 1, .075, 125);
  camera.rotation.order = 'YXZ';
  const basisPath=import.meta.env.DEV ? '/node_modules/three/examples/jsm/libs/basis/' : asset('basis/');
  const ktx=new KTX2Loader().setTranscoderPath(basisPath).setWorkerLimit(1).detectSupport(renderer);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(ktx);
  const cast = createCast(scene, name => loader.loadAsync(asset(name)));
  const sky = new THREE.HemisphereLight('#fcf1dc', '#a5947a', 2.05);
  const sun = new THREE.DirectionalLight('#ffdfaf', 2.0);
  sun.position.set(-13, 19, 17);
  const bounce = new THREE.DirectionalLight('#c0d3ed', .42);
  bounce.position.set(7, 11, -12);
  scene.add(sky, sun, bounce);

  function lamp(color, intensity, distance, at) {
    const light = new THREE.PointLight(color, intensity, distance, 2);
    light.position.copy(worldPoint(at));
    scene.add(light);
    return light;
  }

  const galleryLights = [4.5, 7.6, 10.6].map(x => lamp('#ffd39e', 0, 3.8, [x,9.12,2.57]));
  lamp('#ffe0b4', 14, 9, [-3.0, 4.2, 3.0]);
  lamp('#ffd6a4', 4, 7, [7.2,-8.72,2.86]);
  const partitionLight = lamp('#ffdbac', 21, 8.5, [10.6,-8.6,2.3]);

  const wayang = Object.fromEntries(['WayangDrawing','WayangBlank','WayangCarving','WayangLight'].map(name => [name, []]));
  const promises = new Map();
  let arrivalScene;
  const collision = [];
  const textures = new WeakSet();
  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
  const pointBox = new THREE.Box3();
  const ray = new THREE.Raycaster();
  const hits = [];
  const temporary = new THREE.Vector3();

  function collectSolids(object) {
    const solidParent = /wall|shell|reception|steps|bed|seating|lounge|sofa|chair|table|wardrobe|credenza|worktable|desk|wood rail|partition/i;
    const ignored = /glass|glaz|canopy|wayangcarving|wayangdrawing|wayangblank|wayanglight|fluted|water|context.labels/i;
    object.updateMatrixWorld(true);
    object.traverse(node => {
      if (!node.isMesh || node.isInstancedMesh) return;
      const chain = [];
      for (let p = node; p && p !== object; p = p.parent) chain.push(p.name);
      const ancestry = chain.join('/');
      const material = node.material;
      if (/warm led diffuser|teduh lamp milk/i.test(material.name)) {
        material.emissive.set('#eebc79');
        material.emissiveIntensity = .7;
      }
      if (material.map && !textures.has(material.map)) {
        textures.add(material.map);
        material.map.anisotropy = anisotropy;
      }
      if (!solidParent.test(ancestry) || ignored.test(ancestry) || material.transparent) return;
      node.geometry.computeBoundingBox();
      const box = node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld);
      if (box.max.y - box.min.y > .32) collision.push({node,box,owner:object});
    });
  }

  function load(name, progress) {
    if (!files.includes(name)) return Promise.resolve();
    if (!promises.has(name)) {
      const pending = loader.loadAsync(asset(name + '.glb'), progress).then(gltf => {
        applyFurnitureLayout(name,gltf);
        const object = gltf.scene;
        if (name==='arrival') arrivalScene=object;
        scene.add(object);
        for (const label of Object.keys(wayang)) {
          object.traverse(node => { if (node.name === label) wayang[label].push(node); });
        }
        collectSolids(object);
        setStage(currentStage);
        return object;
      }).catch(error => {
        promises.delete(name);
        throw error;
      });
      promises.set(name, pending);
    }
    return promises.get(name);
  }

  let currentStage = 3;
  function setStage(stage) {
    currentStage = stage;
    dirty = true;
    for (const [label, nodes] of Object.entries(wayang)) {
      const on = label === 'WayangDrawing' ? stage === 0 : label === 'WayangBlank' ? stage === 1
        : label === 'WayangCarving' ? stage >= 2 : stage === 3;
      for (const node of nodes) node.visible = on;
    }
    for (const light of galleryLights) light.intensity = stage === 3 ? 2.6 : 0;
  }

  const screen = new THREE.Group();
  screen.position.copy(worldPoint([10.55,-9.78,.33]));
  scene.add(screen);
  screen.visible = false;
  const wood = new THREE.MeshStandardMaterial({color: finishes.walnut.color, roughness: .57});
  const brass = new THREE.MeshStandardMaterial({color:'#bc905b',metalness:.18,roughness:.44});
  const bead = new THREE.CylinderGeometry(.030,.041,2.36,12,1);
  const shoulder = new THREE.LatheGeometry([
    [.028,0],[.033,.06],[.047,.13],[.026,.23],[.031,.29],[.043,.36],[.029,.47],[.028,.49]
  ].map(([x,y]) => new THREE.Vector2(x,y)),16);
  const brassRing = new THREE.CylinderGeometry(.041,.041,.035,16);
  const barGeometry = new THREE.BoxGeometry(2.6,.055,.092);
  const bars = [new THREE.Mesh(barGeometry,wood), new THREE.Mesh(barGeometry,wood)];
  bars[0].position.y=.04;
  bars[1].position.y=2.39;
  screen.add(...bars);
  const stripes = new THREE.Group();
  const stripeMaterial = new THREE.MeshBasicMaterial({color:'#5a442c', transparent:true, opacity:.2, depthWrite:false});
  const stripeGeometry = new THREE.PlaneGeometry(.068, 2.1);
  screen.add(stripes);

  let lastSpacing;
  let slats = [];
  function setDesign(design) {
    dirty = true;
    screen.visible = true;
    wood.color.set(finishes[design.finish].color);
    if (lastSpacing !== design.spacing) {
      for (const slat of slats) screen.remove(slat);
      stripes.clear();
      slats = dividerLayout(design.spacing).map((x, i) => {
        const unit = new THREE.Group();
        unit.position.x = x;
        const stem = new THREE.Mesh(bead,wood);
        stem.position.y = 1.21;
        const turn = new THREE.Mesh(shoulder,wood);
        turn.position.y = .95 + .12 * Math.sin(i * .6);
        const collar = new THREE.Mesh(brassRing,brass);
        collar.position.y = turn.position.y + .244;
        unit.add(stem,turn,collar);
        screen.add(unit);
        const shadow = new THREE.Mesh(stripeGeometry,stripeMaterial);
        shadow.rotation.x = -Math.PI/2;
        shadow.rotation.z = -.30;
        shadow.position.set(x + .29, .006, 1.01);
        stripes.add(shadow);
        return unit;
      });
      lastSpacing = design.spacing;
    }
    const t = design.light / 100;
    partitionLight.intensity = 3 + 40 * t;
    partitionLight.color.set('#ffd099').lerp(new THREE.Color('#f8e4bf'), t);
    stripeMaterial.opacity = .04 + .28 * t;
  }

  let yaw = 0;
  let pitch = 0;
  function lookFrom(eye, target) {
    dirty = true;
    camera.position.copy(worldPoint(eye));
    camera.lookAt(worldPoint(target));
    yaw = camera.rotation.y;
    pitch = camera.rotation.x;
  }

  function turn(dx,dy) {
    dirty = true;
    yaw -= dx * .004;
    pitch = THREE.MathUtils.clamp(pitch - dy * .004, -.86, .75);
    camera.rotation.set(pitch,yaw,0,'YXZ');
  }

  function blocked(dx, dz) {
    const size = Math.hypot(dx,dz);
    if (!size) return false;
    temporary.set(dx / size, 0, dz / size);
    const probe = camera.position.clone().addScaledVector(temporary, size + .23);
    if (roadCar && Math.abs(probe.x-car.x)<1.12 && Math.abs(probe.z-car.z)<2.18 && Math.hypot(camera.position.x-car.x,camera.position.z-car.z)>1) return true;
    if (cast.nearPerson(probe) && !cast.nearPerson(camera.position)) return true;
    pointBox.min.copy(probe).addScalar(-.32);
    pointBox.min.y = probe.y - 1.48;
    pointBox.max.copy(probe).addScalar(.32);
    for (const {node,box} of collision) {
      if (!pointBox.intersectsBox(box)) continue;
      ray.set(camera.position, temporary);
      ray.far = size + .23;
      hits.length = 0;
      for (const drop of [0,.7,1.30]) {
        ray.ray.origin.y = camera.position.y - drop;
        if (ray.ray.origin.y < box.min.y || ray.ray.origin.y > box.max.y) continue;
        node.raycast(ray,hits);
        if (hits.length) return true;
      }
    }
    if (screen.visible) {
      const nearScreen = Math.abs(probe.z - screen.position.z) < .17 && Math.abs(probe.x - screen.position.x) < 1.3;
      const wasNear = Math.abs(camera.position.z - screen.position.z) < .20 && Math.abs(camera.position.x - screen.position.x) < 1.32;
      if (nearScreen && !wasNear) return true;
    }
    return false;
  }

  function walk(right, forward, time) {
    const meters = Math.min(time,.055) * 3.15;
    const norm = Math.max(1,Math.hypot(right,forward));
    const dx = (right * Math.cos(yaw) - forward * Math.sin(yaw)) * meters / norm;
    const dz = (-right * Math.sin(yaw) - forward * Math.cos(yaw)) * meters / norm;
    const oldX = camera.position.x, oldZ = camera.position.z;
    if (!blocked(dx,0)) camera.position.x = THREE.MathUtils.clamp(oldX + dx,-47,47);
    if (!blocked(0,dz)) camera.position.z = THREE.MathUtils.clamp(oldZ + dz,-47,47);
    const {x,z} = camera.position;
    const insideQuarter = x > -21 && x < 14.8 && z > -8.7 && z < 14.8;
    const insideReception = x > -6.5 && x < 6.5 && z > 24.5 && z < 32;
    const insideCafe = x > -35.5 && x < -22.5 && z > 1.5 && z < 17.8;
    const eyeHeight = insideQuarter ? 1.94 : insideReception || insideCafe ? 1.82 : 1.68;
    const y = THREE.MathUtils.lerp(camera.position.y,eyeHeight,Math.min(1,time * 4));
    const moved = oldX !== x || oldZ !== z;
    if (moved || Math.abs(camera.position.y - y) > .0001) dirty = true;
    camera.position.y = y;
    return moved;
  }

  function distanceTo(point) {
    return Math.hypot(camera.position.x-point[0],camera.position.z-point[2]);
  }

  function approach(point, delta) {
    const dx = point[0] - camera.position.x;
    const dz = point[2] - camera.position.z;
    yaw = Math.atan2(-dx,-dz);
    pitch = -.035;
    camera.rotation.set(pitch,yaw,0,'YXZ');
    dirty = true;
    return walk(0,1,delta);
  }

  function marker(point) {
    const target = new THREE.Vector3(point[0],point[1]+1.77,point[2]);
    camera.updateMatrixWorld();
    const projected = target.project(camera);
    return {
      visible: projected.z < 1 && projected.z > -1 && Math.abs(projected.x) < .91 && Math.abs(projected.y) < .82,
      x: (1+projected.x)*50,
      y: (1-projected.y)*50,
    };
  }

  const pavilions=createPavilions(scene,new THREE.TextureLoader(),asset('wayang-study.png'),collectSolids,owner=>{
    for(let i=collision.length-1;i>=0;i--) if(collision[i].owner===owner) collision.splice(i,1);
  });
  const directorPeople=new Map();

  function clearPlotTrees() {
    arrivalScene?.traverse(tree=>{
      if(!/Terminalia.*tropical.almond/i.test(tree.name)) return;
      const at=tree.getWorldPosition(new THREE.Vector3());
      for(const plot of plots) {
        const dx=at.x-plot.x,dz=at.z-plot.z;
        const distance=Math.hypot(dx,dz);
        if(distance>=3.90) continue;
        at.x=plot.x+(distance ? dx/distance : 1)*3.96;
        at.z=plot.z+(distance ? dz/distance : 0)*3.96;
        tree.position.copy(tree.parent.worldToLocal(at));
      }
    });
  }

  async function openDirector() {
    await load('district');
    await cast.show('director');
    clearPlotTrees();
    load('gallery').then(gallery=>{pavilions.attachGallery(gallery);dirty=true;}).catch(console.warn);
    dirty=true;
  }

  function showDevelopment(state) {
    pavilions.sync(state);
    for(const plot of plots) {
      const site=state.plots[plot.id];
      const expected=site?.phase==='building' ? 'worker' : site?.phase==='open' ? 'visitor' : '';
      const existing=directorPeople.get(plot.id);
      if(expected===existing?.role) continue;
      if(existing?.id) cast.removePerson(existing.id);
      directorPeople.delete(plot.id);
      if(!expected) continue;
      const slot={role:expected};
      directorPeople.set(plot.id,slot);
      const person=state.workers.find(worker=>worker.id===site.worker);
      const name=expected==='worker' ? person?.name??'Builder' : 'Visitor';
      const position=new THREE.Vector3(plot.x+1.2,.12,plot.z+2.6);
      const from=[plot.x+1.65,.12,plot.z+3.35];
      cast.addPerson(name,expected==='visitor'?'visitor':'guest',position,camera,'director',from).then(id=>{
        if(directorPeople.get(plot.id)===slot) slot.id=id;
        else cast.removePerson(id);
        dirty=true;
      }).catch(console.warn);
    }
    dirty=true;
  }

  function focusPlot(id,walkThrough=false) {
    const plot=plots.find(item=>item.id===id);
    if(!plot) return;
    pavilions.select(id);
    if(walkThrough) lookFrom([plot.x,-(plot.z+4.1),1.73],[plot.x,-plot.z,1.33]);
    else lookFrom([plot.x+7,-(plot.z+11.4),8.6],[plot.x,-plot.z,.86]);
  }

  const guestLocations = {
    arrival:[[2.85,.10,34.3],[-2.05,.10,34.7],[-3.4,.10,35.0],[3.55,.10,35.5]],
    garden:[[-8.75,.09,23.3],[-9.9,.09,24.5],[-4.5,.09,24.6],[-3,.09,23.6]],
    worktable:[[-4.7,.29,-3.3],[-4.6,.29,-2.15],[-2.2,.29,-1.9],[-.3,.29,-3.5]],
    wayang:[[5.82,.33,-4.1],[6.45,.33,-5.42],[9.6,.33,-5.65],[11.03,.33,-4.7]],
    tea:[[-30.55,.21,15.2],[-29.55,.21,14.15],[-29.6,.21,16.28],[-27.5,.21,16.7]],
    teduh:[[5.12,.33,12.95],[5.6,.33,11.74],[10.82,.33,13.15],[12.45,.33,12.85]],
    library:[[28.8,.31,2.4],[32.8,.31,3.15],[34,.31,1.8],[29.3,.31,3.7]],
    commission:[[5.12,.33,12.95],[5.6,.33,11.74],[10.82,.33,13.15],[12.45,.33,12.85]],
    courtyard:[[11.7,.08,29.9],[16.0,.08,29.9],[12.3,.08,31.55],[15.8,.08,31.4]],
    opening:[[-13.05,.33,7.05],[-12.0,.33,9.18],[-16.75,.33,9.1],[-14.25,.33,7.07]],
  };

  function placeIsClear(point) {
    if (distanceTo(point.toArray())<1.12 || cast.nearPerson(point,.94)) return false;
    for (const {node,box} of collision) {
      if (point.x<box.min.x-.42 || point.x>box.max.x+.42 || point.z<box.min.z-.42 || point.z>box.max.z+.42) continue;
      for (const lift of [.30,.90,1.40]) {
        const origin=point.clone().add(new THREE.Vector3(0,lift,0));
        if (origin.y<box.min.y || origin.y>box.max.y) continue;
        for (let i=0;i<8;i++) {
          ray.set(origin,new THREE.Vector3(Math.sin(i*Math.PI/4),0,Math.cos(i*Math.PI/4)));
          ray.far=.45;
          hits.length=0;
          node.raycast(ray,hits);
          if (hits.length) return false;
        }
      }
    }
    return true;
  }

  async function addPerson(stop,name,kind) {
    const point=(guestLocations[stop]??[]).map(p=>new THREE.Vector3(...p)).find(placeIsClear);
    if (!point) return null;
    const id=await cast.addPerson(name,kind,point,camera,stop);
    dirty=true;
    return id;
  }

  let roadCar;
  let roadSetup;
  let car={x:-3,z:42,yaw:Math.PI/2,speed:0};
  let wheels=[];
  let driving=false;
  let checkpoints=[];
  let currentCheckpoint=0;
  const roadHeight=.134;
  function stripe(x,z,width,depth,material,y=roadHeight) {
    const flat=new THREE.Mesh(new THREE.PlaneGeometry(width,depth),material);
    flat.rotation.x=-Math.PI/2;
    flat.position.set(x,y,z);
    scene.add(flat);
  }

  function clearRoadTrees() {
    arrivalScene?.traverse(tree=>{
      if (!/Terminalia.*tropical.almond/i.test(tree.name)) return;
      const at=tree.getWorldPosition(new THREE.Vector3());
      const edge=Math.max(Math.abs(at.x),Math.abs(at.z));
      if(edge<38 || edge>46) return;
      if(Math.abs(at.x)>Math.abs(at.z)) at.x=Math.sign(at.x)*47.1;
      else at.z=Math.sign(at.z)*47.1;
      tree.position.copy(tree.parent.worldToLocal(at));
    });
  }

  function road() {
    clearRoadTrees();
    const asphalt=new THREE.MeshStandardMaterial({color:'#57554f',roughness:.99});
    const paint=new THREE.MeshStandardMaterial({color:'#d9c6a1',roughness:.94});
    for (const side of [-1,1]) {
      stripe(0,42*side,92,7.2,asphalt);
      stripe(42*side,0,7.2,76.8,asphalt);
      for (let m=-35;m<=35;m+=5) {
        stripe(m,42*side,2.5,.07,paint,roadHeight+.013);
        stripe(42*side,m,.07,2.5,paint,roadHeight+.013);
      }
    }
    checkpoints=routeCheckpoints.map(entry => {
      const marker=new THREE.Mesh(new THREE.TorusGeometry(1.75,.075,12,40),new THREE.MeshBasicMaterial({color:'#ffeea3'}));
      marker.rotation.x=-Math.PI/2;
      marker.position.set(entry.x,roadHeight+.10,entry.z);
      scene.add(marker);
      return marker;
    });
    checkpoints.forEach((marker,id)=>{marker.visible=id===currentCheckpoint;});
  }

  async function openDistrict() {
    if (!roadSetup) {
      roadSetup=Promise.all([load('district'),loader.loadAsync(asset('city-car.glb'))]).then(([,result])=>{
        roadCar=result.scene;
        wheels=['FL','FR','RL','RR'].map(id=>roadCar.getObjectByName('wheel_'+id)).filter(Boolean);
        scene.add(roadCar);
        road();
        syncCar();
      }).catch(error=>{roadSetup=null;throw error;});
    }
    await roadSetup;
    await cast.show('roam');
    placeByCar();
    dirty=true;
  }

  function syncCar() {
    roadCar.position.set(car.x,roadHeight+.035,car.z);
    roadCar.rotation.y=car.yaw;
  }

  function placeByCar() {
    driving=false;
    car={...car,speed:0};
    const eye=[car.x-3.5*Math.cos(car.yaw),-(car.z+3.5*Math.sin(car.yaw)),1.68];
    const target=[car.x,-car.z,1.0];
    lookFrom(eye,target);
  }

  function beginDrive() {
    if (!roadCar || Math.hypot(camera.position.x-car.x,camera.position.z-car.z)>5) return false;
    driving=true;
    drive(0,0,0);
    return true;
  }

  function drive(leftRight,goStop,dt) {
    if (!roadCar || !driving) return null;
    car=driveStep(car,-leftRight,goStop,dt);
    syncCar();
    for (const wheel of wheels) wheel.rotateX(car.speed*dt/.30);
    const forward=new THREE.Vector3(Math.sin(car.yaw),0,Math.cos(car.yaw));
    const center=roadCar.position;
    const desired=center.clone().addScaledVector(forward,-7).add(new THREE.Vector3(0,3.45,0));
    camera.position.lerp(desired,dt===0 ? 1 : Math.min(1,dt*9));
    camera.lookAt(center.clone().addScaledVector(forward,3).add(new THREE.Vector3(0,1.02,0)));
    const target=routeCheckpoints[currentCheckpoint];
    if(target && Math.hypot(car.x-target.x,car.z-target.z)<3.5) {
      checkpoints[currentCheckpoint++].visible=false;
      if (checkpoints[currentCheckpoint]) checkpoints[currentCheckpoint].visible=true;
    }
    dirty=true;
    return {speed:Math.round(Math.abs(car.speed)*3.6),checkpoint:currentCheckpoint};
  }

  function setMood(mood) {
    const dusk=mood==='dusk';
    scene.background.set(dusk?'#727d93':'#d8c9ae');
    scene.fog.color.copy(scene.background);
    sky.color.set(dusk?'#d1cbf1':'#fcf1dc');
    sun.color.set(dusk?'#f3a884':'#ffdfaf');
    sky.intensity=dusk?1.25:2.05;
    sun.intensity=dusk?.72:2;
    dirty=true;
  }

  function resize() {
    dirty = true;
    camera.aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    camera.fov = camera.aspect < .7 ? 74 : 56;
    camera.updateProjectionMatrix();
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  }
  new ResizeObserver(resize).observe(canvas);
  resize();
  canvas.addEventListener('webglcontextlost',event => {event.preventDefault();onIssue();});
  function draw() {
    if (!dirty) return;
    renderer.render(scene,camera);
    dirty = false;
  }

  function animate(delta) {
    const animated = cast.update(delta,camera);
    dirty ||= animated;
  }

  return { load, lookFrom, turn, walk, setStage, setDesign, draw, animate, marker, approach, distanceTo,
    preloadCast:cast.preload, showCast:cast.show, addPerson, removePerson:id=>{cast.removePerson(id);dirty=true;},
    setMood, openDistrict, beginDrive, stopDrive:placeByCar, drive, openDirector, showDevelopment, focusPlot };

}
