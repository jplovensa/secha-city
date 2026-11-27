import { Animation } from '@babylonjs/core/Animations/animation.js';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Quaternion } from '@babylonjs/core/Maths/math.vector.js';
import captured from '../captured-walk.js';
import { sites } from './mission.js';
import { load } from './assets.js';

const looks={
  studio:{top:'#584136',bottom:'#242425',hair:'#241c19',offset:[-.48,.12]},
  client:{top:'#9b8063',bottom:'#48443b',hair:'#918074',offset:[.48,-.38]},
  lab:{top:'#637f73',bottom:'#35413a',hair:'#392921',offset:[.62,.05]},
};

function buildWalk(scene,character,idle,prefix) {
  const nodes=new Map(idle.targetedAnimations.map(({target})=>[target.name.slice(prefix.length),target]));
  const group=new AnimationGroup(character+' · captured walk',scene);
  const tracks=new Set();
  for(const track of captured.clip.tracks) {
    const [name,property]=track.name.split('.');
    const target=nodes.get(name);
    if(!target||property!=='quaternion') continue;
    const animation=new Animation(track.name,'rotationQuaternion',60,Animation.ANIMATIONTYPE_QUATERNION,Animation.ANIMATIONLOOPMODE_CYCLE);
    animation.setKeys(track.times.map((time,i)=>({frame:time*60,value:Quaternion.FromArray(track.values,i*4)})));
    group.addTargetedAnimation(animation,target);
    tracks.add(target);
  }
  for(const {target,animation} of idle.targetedAnimations) {
    if(animation.targetProperty==='rotationQuaternion'&&tracks.has(target)) continue;
    const stable=animation.clone();
    const keys=animation.getKeys();
    if(!keys.length) continue;
    stable.framePerSecond=60;
    stable.setKeys([{frame:0,value:keys[0].value},{frame:captured.clip.duration*60,value:keys[0].value}]);
    group.addTargetedAnimation(stable,target);
  }
  return group;
}

export async function loadCast(scene) {
  const models=await load('studio-human.glb',scene);
  const actors=new Map();
  const contact=new StandardMaterial('Cast contact shadow',scene);
  contact.diffuseColor=new Color3(.12,.085,.055);
  contact.alpha=.16;
  contact.disableLighting=true;
  for(const [id,site] of Object.entries(sites)) {
    const look=looks[id];
    const prefix=site.host+' / ';
    const instance=models.instantiateModelsToScene(name=>prefix+name,true,{doNotInstantiate:true});
    const root=new TransformNode(site.host,scene);
    root.position.set(site.x+look.offset[0],site.y,site.z+look.offset[1]);
    for(const node of instance.rootNodes) node.parent=root;
    const shadow=MeshBuilder.CreateGround(site.host+' contact',{width:.58,height:.45},scene);
    shadow.parent=root;
    shadow.position.y=.009;
    shadow.material=contact;
    for(const mesh of root.getChildMeshes()) {
      if(/Original skinned ankle lining/i.test(mesh.name)) {
        mesh.setEnabled(false);
        continue;
      }
      if(!mesh.material || mesh===shadow) continue;
      mesh.receiveShadows=true;
      mesh.alwaysSelectAsActiveMesh=true;
      const name=mesh.material.name;
      const tint=/satin full-length top/i.test(name)?look.top:/tailored trousers/i.test(name)?look.bottom:
        /ponytail|hair roots/i.test(name)?look.hair:null;
      if(tint&&mesh.material.albedoColor) mesh.material.albedoColor=Color3.FromHexString(tint).toLinearSpace();
    }
    const idle=instance.animationGroups.find(group=>group.name.includes('Idle_Standing'));
    const walk=buildWalk(scene,site.host,idle,prefix);
    for(const group of [idle,walk]) {
      group.enableBlending=true;
      group.blendingSpeed=.12;
    }
    idle.start(true);
    actors.set(id,{root,idle,walk,moving:false,arrived:false});
  }
  return {
    update(active,viewer,dt) {
      for(const [id,actor] of actors) {
        const site=sites[id], position=actor.root.position;
        const dx=site.x-position.x,dz=site.z-position.z;
        const remaining=Math.hypot(dx,dz);
        const distance=Math.hypot(viewer.x-position.x,viewer.z-position.z);
        const moving=id===active&&distance<4.75&&remaining>.035&&!actor.arrived;
        if(moving!==actor.moving) {
          (moving?actor.idle:actor.walk).stop();
          if(moving) actor.walk.start(true,.48);
          else actor.idle.start(true);
          actor.moving=moving;
        }
        if(moving) {
          const step=Math.min(remaining,dt*.64);
          position.x+=dx*step/remaining;
          position.z+=dz*step/remaining;
        } else if(remaining<=.035) actor.arrived=true;
        if(distance>10) continue;
        const facing=moving?Math.atan2(dx,dz):Math.atan2(viewer.x-position.x,viewer.z-position.z);
        const delta=Math.atan2(Math.sin(facing-actor.root.rotation.y),Math.cos(facing-actor.root.rotation.y));
        actor.root.rotation.y+=Math.max(-dt*2.6,Math.min(dt*2.6,delta));
      }
    },
  };
}
