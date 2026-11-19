import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

export const encounters = {
  arrival: {name:'Josephine', role:'Founder and maker', actor:'josephine', position:[.9,.10,33.1], from:[-.25,.10,33.35], prompt:'Find Josephine outside reception.', line:'I grew up watching my mother run our renovations. She always knew where people would stop and where they needed room to pass. I’d like you to make a room with her in mind.'},
  garden: {name:'Dina', role:'Studio designer', actor:'dina', position:[-5.9,.09,22.18], from:[-4.9,.09,22.18], prompt:'Meet Dina on the garden path.', line:'Hold on a moment. The leaves move differently here. Brush the pandan and listen under the trees before you pick anything for the room.'},
  worktable: {name:'Josephine', role:'Founder and maker', actor:'josephine', position:[-1.83,.29,-4.28], from:[-1.55,.29,-4.66], prompt:'Meet Josephine beside the worktable.', line:'The timber goes where her hands will land. Pick the finish you want her to feel as she comes into the room.'},
  wayang: {name:'Dina', role:'Studio designer', actor:'dina', position:[9.47,.33,-3.81], from:[9.6,.33,-4.54], prompt:'Meet Dina by the wayang panel.', line:'I’ve left four stages of the wall here. Look at the shapes before the light goes on. Once it does, notice which edges come forward.'},
  tea: {name:'Ibu', role:'Your guest', actor:'ibu', position:[-28.6,.21,15.39], from:[-28.6,.21,14.61], prompt:'Find Ibu on the tea terrace.', line:'I can wait here while you finish. Were you thinking of jasmine, or ginger with a little palm sugar?'},
  teduh: {name:'Ibu', role:'Your guest', actor:'ibu', position:[9.27,.33,12.89], from:[9.27,.33,12.15], prompt:'Meet Ibu beside the bed.', line:'Let me see the difference. I’d like some light to come through while I can still set down a cup without feeling on display.'},
};

const looks = {
  josephine: { top:'#77594d', trousers:'#242124', scale:.98 },
  dina: { top:'#67786d', trousers:'#3c4a47', scale:.94 },
  ibu: { top:'#887451', trousers:'#413e34', hair:'#b9ab9b', scale:.92 },
  visitor: { scale:.96 },
};
const sourceFiles = {
  studio:'studio-human.glb',
  visitor:'garden-visitor.glb',
};
const cameraDirection = new THREE.Vector3();
const followRate = .8;

export function createCast(scene, loadAsset) {
  const sources = new Map();
  const actors = new Map();
  let active;
  let visitor;
  let serial = 0;

  const load = key => {
    if (!sources.has(key)) {
      sources.set(key,loadAsset(sourceFiles[key]).catch(error => {
        sources.delete(key);
        throw error;
      }));
    }
    return sources.get(key);
  };

  async function getActor(key) {
    if (actors.has(key)) return actors.get(key);
    const pending = load(key === 'visitor' ? 'visitor' : 'studio').then(({scene:model,animations}) => {
      const root = new THREE.Group();
      const body = clone(model);
      const look = looks[key];
      const materials = new Map();
      body.traverse(object => {
        if (!object.isMesh) return;
        const old = object.material;
        if (!materials.has(old)) {
          const copy = old.clone();
          if (look.top && /satin full-length top/.test(copy.name)) copy.color.set(look.top);
          if (look.trousers && /tailored trousers/.test(copy.name)) copy.color.set(look.trousers);
          if (look.hair && /ponytail|hair roots/.test(copy.name)) {
            copy.color.set(look.hair);
          }
          materials.set(old,copy);
        }
        object.material = materials.get(old);
        if (object.isSkinnedMesh) object.frustumCulled = false;
      });
      root.add(body);
      root.scale.setScalar(look.scale);
      root.visible = false;
      scene.add(root);
      const mixer = new THREE.AnimationMixer(body);
      const idleClip = animations.find(clip => /idle/i.test(clip.name));
      const walkClip = animations.find(clip => /walk_relaxed|^walk$/i.test(clip.name));
      const clips={idle:idleClip && mixer.clipAction(idleClip),walk:walkClip && mixer.clipAction(walkClip)};
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(.29,24),new THREE.MeshBasicMaterial({color:'#33261b',transparent:true,opacity:.22,depthWrite:false}));
      shadow.rotation.x=-Math.PI/2;
      shadow.scale.y=.7;
      shadow.position.y=.013;
      root.add(shadow);
      return {root,mixer,clips,mode:null,waypoint:null};
    }).catch(error => {actors.delete(key);throw error;});
    actors.set(key,pending);
    return pending;
  }

  function animation(actor, mode) {
    if (actor.mode === mode) return;
    actor.clips[actor.mode]?.fadeOut(.16);
    const next = actor.clips[mode];
    if (next) next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(.16).play();
    actor.mode=mode;
  }

  function place(actor, from, to) {
    actor.root.position.fromArray(from);
    actor.waypoint = new THREE.Vector3(...to);
    actor.root.visible = true;
    animation(actor,'walk');
  }

  async function show(stop) {
    const id = ++serial;
    if (active) active.root.visible = false;
    if (visitor) visitor.root.visible = false;
    active = null;
    visitor = null;
    const encounter = encounters[stop];
    if (!encounter) return;
    const actor = await getActor(encounter.actor);
    if (id !== serial) return;
    active = actor;
    place(active,encounter.from,encounter.position);
    if (stop === 'garden') {
      getActor('visitor').then(person => {
        if (id !== serial) return;
        visitor = person;
        place(visitor,[-2.1,.1,22.75],[-.55,.1,22.95]);
      }).catch(console.warn);
    }
  }

  function face(actor, direction, delta) {
    if (direction.lengthSq() < .0001) return;
    const angle=Math.atan2(direction.x,direction.z);
    const step=Math.atan2(Math.sin(angle-actor.root.rotation.y),Math.cos(angle-actor.root.rotation.y));
    actor.root.rotation.y += step * Math.min(1,delta*8);
  }

  function update(delta, camera) {
    let animated = false;
    for (const actor of [active,visitor]) {
      if (!actor) continue;
      const at = actor.root.position;
      if (actor.waypoint && at.distanceTo(actor.waypoint) > .018) {
        cameraDirection.copy(actor.waypoint).sub(at);
        face(actor,cameraDirection,delta);
        at.addScaledVector(cameraDirection.normalize(),Math.min(followRate*delta,at.distanceTo(actor.waypoint)));
      } else {
        animation(actor,'idle');
        if(actor===active) face(actor,cameraDirection.copy(camera.position).sub(at),delta);
      }
      actor.mixer.update(delta);
      animated = true;
    }
    return animated;
  }

  function nearPerson(position) {
    for (const actor of [active,visitor]) {
      if (!actor) continue;
      const at=actor.root.position;
      if (Math.hypot(position.x-at.x,position.z-at.z)<.49) return true;
    }
    return false;
  }

  return { preload:() => load('studio'),show,update,nearPerson };
}
