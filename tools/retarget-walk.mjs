import { readFile, writeFile } from 'node:fs/promises';
import {
  AnimationClip, AnimationMixer, Group, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack,
} from 'three';
import { BVHLoader } from 'three/addons/loaders/BVHLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const [bvh] = process.argv.slice(2);
if (!bvh) throw new Error('Pass the path to CMU clip 07_01.bvh.');
globalThis.self=globalThis;
globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
const source = new BVHLoader().parse(await readFile(bvh,'utf8'));
const sourceRig=new Group();
sourceRig.add(source.skeleton.bones[0]);
const sourceMixer=new AnimationMixer(sourceRig);
sourceMixer.clipAction(source.clip).play();
const sourceBones=new Map(source.skeleton.bones.map(bone=>[bone.name,bone]));
const timestep=1/120;
const count=Math.floor(source.clip.duration/timestep);
const names=[
  'Hips','Spine','Spine1','Neck','Head','LeftUpLeg','LeftLeg','LeftFoot','LeftToeBase',
  'RightUpLeg','RightLeg','RightFoot','RightToeBase','LeftArm','LeftForeArm','LeftHand','RightArm','RightForeArm','RightHand',
];
const samples=Array.from({length:count},(_,frame)=>{
  sourceMixer.setTime(frame*timestep);
  sourceRig.updateMatrixWorld(true);
  return Object.fromEntries(names.map(name=>[name,sourceBones.get(name).getWorldPosition(new Vector3())]));
});
const first=samples[40].Hips;
const last=samples.at(-20).Hips;
const heading=-Math.atan2(last.x-first.x,last.z-first.z);
const up=new Vector3(0,1,0);
const basis=new Quaternion().setFromAxisAngle(up,heading);
const features=['LeftFoot','RightFoot','LeftLeg','RightLeg','LeftHand','RightHand','Neck'];
let best={cost:Infinity};
for(let a=35;a<155;a++) {
  for(let b=a+100;b<=Math.min(count-18,a+153);b++) {
    const frameA=samples[a],frameB=samples[b];
    const phaseCost=features.reduce((sum,id)=>{
      const va=frameA[id].clone().sub(frameA.Hips);
      const vb=frameB[id].clone().sub(frameB.Hips);
      return sum+va.distanceToSquared(vb);
    },0);
    const speed=frameB.Hips.distanceTo(frameA.Hips)/((b-a)*timestep);
    const cost=phaseCost+(speed<17||speed>32?4:0);
    if(cost<best.cost) best={a,b,cost,speed};
  }
}
const glb=await readFile(new URL('../public/studio-human.glb',import.meta.url));
const model=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  .parseAsync(glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength),'');
const rig=model.scene;
const mixer=new AnimationMixer(rig);
mixer.clipAction(model.animations.find(a=>a.name==='Idle_Standing')).play();
mixer.update(.04);
rig.updateMatrixWorld(true);
const get=name=>rig.getObjectByName(name);
const at=name=>get(name).getWorldPosition(new Vector3());
const root=get('Root');
const rootPosition=root.position.clone();
const rootScale=root.parent.getWorldScale(new Vector3()).y;
const sourceLeg=samples[best.a].LeftUpLeg.distanceTo(samples[best.a].LeftLeg)+samples[best.a].LeftLeg.distanceTo(samples[best.a].LeftFoot);
const targetLeg=at('thigh_l').distanceTo(at('calf_l'))+at('calf_l').distanceTo(at('foot_l'));
const ratio=targetLeg/sourceLeg;
const rate=Number((best.speed*ratio).toFixed(3));
const floor=Math.min(at('ball_l').y,at('ball_r').y);
const pairs=[
  ['spine_01','spine_02','Spine','Spine1',.58],['spine_03','neck_01','Spine1','Neck',.58],
  ['neck_01','head','Neck','Head',.29],
  ['thigh_l','calf_l','LeftUpLeg','LeftLeg',1],['calf_l','foot_l','LeftLeg','LeftFoot',1],['foot_l','ball_l','LeftFoot','LeftToeBase',.95],
  ['thigh_r','calf_r','RightUpLeg','RightLeg',1],['calf_r','foot_r','RightLeg','RightFoot',1],['foot_r','ball_r','RightFoot','RightToeBase',.95],
  ['upperarm_l','lowerarm_l','LeftArm','LeftForeArm',.94],['lowerarm_l','hand_l','LeftForeArm','LeftHand',.92],
  ['upperarm_r','lowerarm_r','RightArm','RightForeArm',.94],['lowerarm_r','hand_r','RightForeArm','RightHand',.92],
];
const base=new Map(['pelvis',...pairs.map(row=>row[0])].map(name=>[name,get(name).quaternion.clone()]));
const rows=[];
const duration=(best.b-best.a)*timestep;
const frames=Math.round(duration*32);
function aim(name,from,to,desired,weight) {
  const bone=get(name);
  const current=at(to).sub(at(from)).normalize();
  const rotation=new Quaternion().setFromUnitVectors(current,desired.clone().normalize());
  rotation.slerp(new Quaternion(),1-weight);
  const world=bone.getWorldQuaternion(new Quaternion());
  bone.quaternion.copy(bone.parent.getWorldQuaternion(new Quaternion()).invert().multiply(rotation).multiply(world));
  bone.updateMatrixWorld(true);
}
for(let i=0;i<=frames;i++) {
  const sample=samples[Math.round(best.a+(best.b-best.a)*i/frames)];
  for(const [name,q] of base) get(name).quaternion.copy(q);
  root.position.copy(rootPosition);
  rig.updateMatrixWorld(true);
  const hips=sample.LeftUpLeg.clone().sub(sample.RightUpLeg).applyQuaternion(basis);
  aim('pelvis','thigh_r','thigh_l',hips,.68);
  for(const [name,to,sourceFrom,sourceTo,weight] of pairs) {
    const desired=sample[sourceTo].clone().sub(sample[sourceFrom]).applyQuaternion(basis);
    aim(name,name,to,desired,weight);
  }
  const lift=floor-Math.min(at('ball_l').y,at('ball_r').y);
  root.position.y+=Math.max(-.12,Math.min(.12,lift))/rootScale;
  const sway=(sample.Hips.x-first.x-(last.x-first.x)*(best.a+(best.b-best.a)*i/frames-40)/(count-60))*ratio;
  root.position.x+=Math.max(-.04,Math.min(.04,sway))/rootScale;
  rows.push({t:duration*i/frames,root:root.position.clone(),rotations:Object.fromEntries([...base].map(([name])=>[name,get(name).quaternion.clone()]))});
}
for(let i=Math.max(1,frames-3);i<=frames;i++){
  const blend=(i-(frames-4))/4;
  rows[i].root.lerp(rows[0].root,blend);
  for(const [name] of base) rows[i].rotations[name].slerp(rows[0].rotations[name],blend);
}
const round=n=>Number(n.toFixed(6));
const times=rows.map(row=>round(row.t));
const tracks=[new VectorKeyframeTrack('Root.position',times,rows.flatMap(row=>row.root.toArray().map(round)))];
for(const [name] of base){
  tracks.push(new QuaternionKeyframeTrack(name+'.quaternion',times,rows.flatMap(row=>row.rotations[name].toArray().map(round))));
}
const result=AnimationClip.toJSON(new AnimationClip('CMU Natural Walk',duration,tracks));
await writeFile(new URL('../captured-walk.js',import.meta.url),'export default '+JSON.stringify({rate,clip:result})+'\n');
console.log({captureFrames:[best.a,best.b],duration,rate,source:best.cost,tracks:tracks.length});
