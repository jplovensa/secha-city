import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { addJosephineFringe } from './character-hair.js';

export const encounters = {
  arrival: {name:'Josephine', role:'Founder and maker', actor:'josephine', position:[.9,.10,33.1], from:[-.25,.10,33.35], prompt:'Find Josephine outside reception.', line:'I grew up watching my mother run our renovations. She always knew where people would stop and where they needed room to pass. I’d like you to make a room with her in mind.'},
  garden: {name:'Dina', role:'Studio designer', actor:'dina', position:[-5.9,.09,22.18], from:[-4.9,.09,22.18], prompt:'Meet Dina on the garden path.', line:'Hold on a moment. The leaves move differently here. Brush the pandan and listen under the trees before you pick anything for the room.'},
  worktable: {name:'Josephine', role:'Founder and maker', actor:'josephine', position:[-1.83,.29,-4.28], from:[-1.55,.29,-4.66], prompt:'Meet Josephine beside the worktable.', line:'The timber goes where her hands will land. Pick the finish you want her to feel as she comes into the room.'},
  wayang: {name:'Dina', role:'Studio designer', actor:'dina', position:[9.47,.33,-3.81], from:[9.6,.33,-4.54], prompt:'Meet Dina by the wayang panel.', line:'I’ve left four stages of the wall here. Look at the shapes before the light goes on. Once it does, notice which edges come forward.'},
  tea: {name:'Ibu', role:'Your guest', actor:'ibu', position:[-28.6,.21,15.39], from:[-28.6,.21,14.61], prompt:'Find Ibu on the tea terrace.', line:'I can wait here while you finish. Were you thinking of jasmine, or ginger with a little palm sugar?'},
  library: {name:'Dina', role:'Studio designer', actor:'dina', position:[31,.31,2.5],from:[32,.31,2.3],prompt:'Meet Dina at the Material Library.',line:'A client needs a quiet guest room. You have 850 SECHA credits. Choose a timber, a divider and a light setting before we install it.'},
  commission: {name:'Josephine', role:'Founder and maker', actor:'josephine', position:[9.27,.33,12.89],from:[9.38,.33,12.2],prompt:'Meet Josephine in the installed room.',line:'Take a walk around what you ordered. Check how the slats and the light work together before we open the studio.'},
  courtyard: {name:'Dina', role:'Studio designer', actor:'dina', position:[13.6,.08,29.75],from:[14.6,.08,29.75],prompt:'Meet Dina at the Listening Court.',line:'Guests are coming. Choose the light you want them to arrive in, then meet me in the salon.'},
  opening: {name:'Josephine', role:'Founder and maker', actor:'josephine', position:[-15.8,.33,7.02],from:[-16.4,.33,7.02],prompt:'Meet Josephine in the salon.',line:'One last detail. Add your first guest and make sure the room has space to welcome them.'},
  teduh: {name:'Ibu', role:'Your guest', actor:'ibu', position:[9.27,.33,12.89], from:[9.27,.33,12.15], prompt:'Meet Ibu beside the bed.', line:'Let me see the difference. I’d like some light to come through while I can still set down a cup without feeling on display.'},
};

const looks = {
  josephine: { top:'#55463f', trousers:'#242124', hair:'#191618', fringe:true, scale:.98 },
  dina: { top:'#67786d', trousers:'#3c4a47', scale:.94 },
  ibu: { top:'#887451', trousers:'#413e34', hair:'#b9ab9b', scale:.92 },
  visitor: { scale:.96 },
  guest: { top:'#967758', trousers:'#2e3833', scale:.95 },
};
const sourceFiles = {
  studio:'studio-human.glb',
  visitor:'garden-visitor.glb',
};
const cameraDirection = new THREE.Vector3();
const followRate = 1.02;
const up = new THREE.Vector3(0,1,0);
const bent = new THREE.Vector3();
const parentRotation=new THREE.Quaternion();
const armRotation=new THREE.Quaternion();
const pivot=new THREE.Quaternion();
const forearmDirection=new THREE.Vector3();

export function createCast(scene, loadAsset) {
  const sources = new Map();
  const actors = new Map();
  let active;
  let visitor;
  let serial = 0;
  let area = '';
  const placed = new Map();

  const load = key => {
    if (!sources.has(key)) {
      sources.set(key,loadAsset(sourceFiles[key]).catch(error => {
        sources.delete(key);
        throw error;
      }));
    }
    return sources.get(key);
  };

  async function getActor(key,lookKey = key) {
    if (actors.has(key)) return actors.get(key);
    const pending = load(lookKey === 'visitor' ? 'visitor' : 'studio').then(({scene:model,animations}) => {
      const root = new THREE.Group();
      const body = clone(model);
      const look = looks[lookKey];
      const materials = new Map();
      body.traverse(object => {
        if (!object.isMesh) return;
        const old = object.material;
        if (!materials.has(old)) {
          const copy = old.clone();
          if (look.top && /satin full-length top/.test(copy.name)) copy.color.set(look.top);
          if (look.trousers && /tailored trousers/.test(copy.name)) copy.color.set(look.trousers);
          if (look.hair && /ponytail|hair roots/i.test(copy.name)) {
            copy.color.set(look.hair);
          }
          materials.set(old,copy);
        }
        object.material = materials.get(old);
        if (object.isSkinnedMesh) object.frustumCulled = false;
      });
      if (look.fringe) addJosephineFringe(body);
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
      const arms = ['l','r'].map(side => ({
        upper:body.getObjectByName('upperarm_' + side),
        lower:body.getObjectByName('lowerarm_' + side),
        sign:side === 'l' ? 1 : -1,
      })).filter(arm => arm.upper && arm.lower);
      return {root,body,mixer,clips,arms,mode:null,waypoint:null,pace:0};
    }).catch(error => {actors.delete(key);throw error;});
    actors.set(key,pending);
    return pending;
  }

  function animation(actor, mode) {
    if (actor.mode === mode) return;
    actor.clips[actor.mode]?.fadeOut(.24);
    const next = actor.clips[mode];
    if (next) next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(.24).play();
    actor.mode=mode;
  }

  function place(actor, from, to) {
    actor.root.position.fromArray(from);
    actor.waypoint = new THREE.Vector3(...to);
    actor.root.visible = true;
    actor.pace = 0;
    actor.root.rotation.y = Math.atan2(to[0]-from[0],to[2]-from[2]);
    animation(actor,'walk');
  }

  async function show(stop) {
    const id = ++serial;
    area = stop;
    for (const item of placed.values()) item.actor.root.visible = item.area === area;
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

  function relaxArms(actor) {
    actor.body.updateMatrixWorld(true);
    for (const {upper,lower,sign} of actor.arms) {
      const from=upper.getWorldPosition(bent);
      lower.getWorldPosition(forearmDirection).sub(from).normalize();
      const side = .14 * sign;
      const lean = actor.mode === 'walk' ? .15 : .43;
      const desired = new THREE.Vector3(side,-1,.07)
        .applyAxisAngle(up,actor.root.rotation.y).normalize().lerp(forearmDirection,1 - lean).normalize();
      pivot.setFromUnitVectors(forearmDirection,desired);
      upper.getWorldQuaternion(armRotation);
      upper.parent.getWorldQuaternion(parentRotation).invert();
      upper.quaternion.copy(parentRotation.multiply(pivot).multiply(armRotation));
    }
  }

  function update(delta, camera) {
    let animated = false;
    const others = [...placed.values()].filter(item => item.area === area).map(item => item.actor);
    for (const actor of [active,visitor,...others]) {
      if (!actor) continue;
      const at = actor.root.position;
      const remaining = actor.waypoint ? at.distanceTo(actor.waypoint) : 0;
      if (remaining > .018) {
        cameraDirection.copy(actor.waypoint).sub(at);
        face(actor,cameraDirection,delta);
        const targetRate = followRate * THREE.MathUtils.smoothstep(remaining,.012,.44);
        actor.pace += (Math.max(.14,targetRate)-actor.pace)*Math.min(1,delta*6);
        actor.clips.walk?.setEffectiveTimeScale(THREE.MathUtils.clamp(actor.pace/followRate,.32,1.08));
        at.addScaledVector(cameraDirection.normalize(),Math.min(actor.pace*delta,remaining));
      } else {
        animation(actor,'idle');
        if (actor===active) face(actor,cameraDirection.copy(camera.position).sub(at),delta*.7);
      }
      actor.mixer.update(delta);
      if (actor.arms.length) relaxArms(actor);
      animated = true;
    }
    return animated;
  }

  function nearPerson(position, radius=.49) {
    const others=[...placed.values()].filter(item => item.area === area).map(item => item.actor);
    for (const actor of [active,visitor,...others]) {
      if (!actor) continue;
      const at=actor.root.position;
      if (Math.hypot(position.x-at.x,position.z-at.z)<radius) return true;
    }
    return false;
  }

  let personNumber=0;
  async function addPerson(name,kind,position,camera,stop) {
    const id='extra-' + (++personNumber);
    const actor=await getActor(id,kind==='visitor' ? 'visitor' : 'guest');
    actor.root.position.copy(position);
    const diff=camera.position.clone().sub(position);
    actor.root.rotation.y=Math.atan2(diff.x,diff.z);
    actor.root.visible=stop===area;
    animation(actor,'idle');
    placed.set(id,{name,actor,area:stop});
    return id;
  }

  function removePerson(id) {
    const item=placed.get(id);
    if(!item) return;
    item.actor.mixer.stopAllAction();
    scene.remove(item.actor.root);
    placed.delete(id);
    actors.delete(id);
  }

  return { preload:() => load('studio'),show,update,nearPerson,addPerson,removePerson };
}
