import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { dividerLayout, finishes } from './chapter.js';

const files = ['arrival', 'gallery', 'teduh'];
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
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
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
  const collision = [];
  const textures = new WeakSet();
  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
  const pointBox = new THREE.Box3();
  const ray = new THREE.Raycaster();
  const hits = [];
  const temporary = new THREE.Vector3();

  function collectSolids(object) {
    const solidParent = /wall|shell|reception|steps|bed|seating|lounge|sofa|credenza|worktable|desk|wood rail|partition/i;
    const ignored = /glass|glaz|canopy|wayang|fluted|water|context labels/i;
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
      if (box.max.y - box.min.y > .32) collision.push({node,box});
    });
  }

  function load(name, progress) {
    if (!files.includes(name)) return Promise.resolve();
    if (!promises.has(name)) {
      const pending = loader.loadAsync(asset(name + '.glb'), progress).then(({scene: object}) => {
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
  screen.position.copy(worldPoint([10.34,-9.78,.33]));
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
    pointBox.min.copy(probe).addScalar(-.32);
    pointBox.max.copy(probe).addScalar(.32);
    for (const {node,box} of collision) {
      if (!pointBox.intersectsBox(box)) continue;
      ray.set(camera.position, temporary);
      ray.far = size + .23;
      hits.length = 0;
      node.raycast(ray,hits);
      if (hits.length) return true;
      ray.ray.origin.y -= .65;
      node.raycast(ray,hits);
      if (hits.length) return true;
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
    if (!blocked(dx,0)) camera.position.x = THREE.MathUtils.clamp(oldX + dx,-40,40);
    if (!blocked(0,dz)) camera.position.z = THREE.MathUtils.clamp(oldZ + dz,-23,44);
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

  return { load, lookFrom, turn, walk, setStage, setDesign, draw };
}
