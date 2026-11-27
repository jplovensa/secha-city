import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import { MeshoptCompression } from '@babylonjs/core/Meshes/Compression/meshoptCompression.js';
import { KhronosTextureContainer2 } from '@babylonjs/core/Misc/khronosTextureContainer2.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { roadDistance, roadHalfWidth } from '../traffic.js';
import { furnitureLayout } from '../furniture-edits.js';
import { registerBuiltInLoaders } from '@babylonjs/loaders/dynamic.js';
import meshopt from '../node_modules/meshoptimizer/meshopt_decoder.cjs?url';
import decoder from './decoder-worker.js?worker&url';
import astc from '@babylonjs/ktx2decoder/wasm/uastc_astc.wasm?url';
import bc7 from '@babylonjs/ktx2decoder/wasm/uastc_bc7.wasm?url';
import rgba from '@babylonjs/ktx2decoder/wasm/uastc_rgba8_unorm_v2.wasm?url';
import srgb from '@babylonjs/ktx2decoder/wasm/uastc_rgba8_srgb_v2.wasm?url';
import r8 from '@babylonjs/ktx2decoder/wasm/uastc_r8_unorm.wasm?url';
import rg8 from '@babylonjs/ktx2decoder/wasm/uastc_rg8_unorm.wasm?url';
import zstd from '@babylonjs/ktx2decoder/wasm/zstddec.wasm?url';
import basis from '@babylonjs/ktx2decoder/wasm/msc_basis_transcoder.wasm?url';
import basisModule from '@babylonjs/ktx2decoder/wasm/msc_basis_transcoder.js?url';
import { vehicleAssets } from '../vehicle-data.js';

const absolute = url => new URL(url,location.href).href;
export const asset = file=>absolute(import.meta.env.BASE_URL+file);

registerBuiltInLoaders();
MeshoptCompression.Configuration.decoder={url:absolute(meshopt)};
KhronosTextureContainer2.DefaultNumWorkers=1;
KhronosTextureContainer2.URLConfig = {
  jsDecoderModule:absolute(decoder),wasmUASTCToASTC:absolute(astc),wasmUASTCToBC7:absolute(bc7),
  wasmUASTCToRGBA_UNORM:absolute(rgba),wasmUASTCToRGBA_SRGB:absolute(srgb),wasmUASTCToR8_UNORM:absolute(r8),
  wasmUASTCToRG8_UNORM:absolute(rg8),wasmZSTDDecoder:absolute(zstd),jsMSCTranscoder:absolute(basisModule),wasmMSCTranscoder:absolute(basis),
};

export const load = (file,scene,options) => LoadAssetContainerAsync(asset(file),scene,{
  pluginOptions:{gltf:options},
});

const solid = /wall|shell|reception|bed|seating|lounge|sofa|chair|table|wardrobe|credenza|worktable|desk|partition|tree trunk/i;
const permeable = /glass|glaz|canopy|wayangcarving|wayangdrawing|wayangblank|wayanglight|fluted|water|context.labels|trim|rail|mullion|floor/i;
const hiddenStage = /^(WayangDrawing|WayangBlank)$/i;
const bermOffsets={6:[-9.2,0],7:[6,0],8:[0,-6],9:[4.8,0],10:[-6,5]};

function shiftWorld(node,x,y,z) {
  node.computeWorldMatrix(true);
  node.setAbsolutePosition(node.getAbsolutePosition().add(new Vector3(x,y,z)));
  node.computeWorldMatrix(true);
}

function prepareArchitecture(name,container) {
  for(const node of [...container.transformNodes,...container.meshes]) {
    const pointer=node._internalMetadata?.gltf?.pointers?.find(value=>/^\/nodes\/\d+$/.test(value));
    const edit=pointer && furnitureLayout[name]?.[pointer.split('/').at(-1)];
    if(edit?.name===node.name) {
      if(edit.remove) node.setEnabled(false);
      else shiftWorld(node,...edit.delta);
    }
    if(hiddenStage.test(node.name)) node.setEnabled(false);
    if(name==='arrival') {
      const berm=node.name.match(/^Soft[ _]planted[ _]berm[ _](\d+)$/i);
      if(berm&&bermOffsets[berm[1]]) {
        const [x,z]=bermOffsets[berm[1]];
        shiftWorld(node,x,0,z);
      }
      if(/Terminalia.*tropical.almond/i.test(node.name)) {
        node.computeWorldMatrix(true);
        const {x,z}=node.getAbsolutePosition();
        if(Math.abs(roadDistance(x,z))<=roadHalfWidth+1.1) {
          const eastWest=Math.abs(x)>Math.abs(z);
          shiftWorld(node,eastWest?Math.sign(x)*47.3-x:0,0,eastWest?0:Math.sign(z)*47.3-z);
        }
      }
    }
  }
}

export async function loadArchitecture(name,scene,shadows) {
  const container=await load(name+'.glb',scene,{createInstances:false});
  container.addAllToScene();
  prepareArchitecture(name,container);
  const batches=new Map();
  const obstacles=[];
  const cast=[];
  for(const mesh of container.meshes) {
    mesh.computeWorldMatrix(true);
    mesh.freezeWorldMatrix();
    if(!(mesh instanceof Mesh)||!mesh.geometry||!mesh.isEnabled()||!mesh.material) continue;
    const bounds=mesh.getBoundingInfo().boundingBox;
    const lower=bounds.minimumWorld,upper=bounds.maximumWorld,center=bounds.centerWorld;
    const ancestry=[];
    for(let node=mesh;node?.parent;node=node.parent) ancestry.push(node.name);
    const path=ancestry.join('/');
    const spanX=upper.x-lower.x,spanZ=upper.z-lower.z;
    const isGlass=/glass|glaz|mullion/i.test(path)||mesh.material.needAlphaBlendingForMesh(mesh);
    if(solid.test(path)&&!permeable.test(path)&&!isGlass&&upper.y>.53&&lower.y<1.45&&upper.y-lower.y>.35&&
      spanX<17&&spanZ<17&&(spanX>.055||spanZ>.055)) {
      obstacles.push([lower.x,upper.x,lower.z,upper.z]);
    }
    mesh.receiveShadows=true;
    if(isGlass||mesh.getChildren().length) continue;
    const shouldCast=upper.y>.66&&upper.y-lower.y>.19&&spanX<32&&spanZ<32;
    const sector=Math.floor(center.x/16)+':'+Math.floor(center.z/16);
    const key=sector+':'+Number(shouldCast)+':'+mesh.material.uniqueId+':'+mesh.getVerticesDataKinds().sort().join(',');
    if(!batches.has(key)) batches.set(key,{meshes:[],shouldCast});
    batches.get(key).meshes.push(mesh);
  }
  for(const {meshes,shouldCast} of batches.values()) {
    const merged=meshes.length>1?Mesh.MergeMeshes(meshes,true,true):null;
    if(merged) {
      merged.name=name+' · '+merged.material.name;
      merged.receiveShadows=true;
      merged.freezeWorldMatrix();
    }
    if(shouldCast) cast.push(...(merged?[merged]:meshes));
  }
  for(const mesh of cast) shadows.addShadowCaster(mesh,false);
  return obstacles;
}

export async function loadVehicle(profile,scene) {
  const spec = vehicleAssets[profile.id];
  const container = await load(spec.file,scene,{extensionOptions:{KHR_materials_transmission:{enabled:false}}});
  const root = new TransformNode(profile.name,scene);
  container.addAllToScene();
  container.meshes[0].parent=root;
  const nodes=[...container.transformNodes,...container.meshes];
  const find=name=>nodes.find(node=>node.name===name);
  const wheels=['FL','FR','RL','RR'].map(side=>find('wheel_'+side));
  const front=wheels.slice(0,2).map((wheel,index)=>{
    const side=index?'FR':'FL';
    const authored=find('steer_'+side);
    if(authored) return authored;
    const pivot=new TransformNode('Steering pivot '+side,scene);
    pivot.parent=wheel.parent;
    pivot.position.copyFrom(wheel.position);
    wheel.setParent(pivot);
    const caliper=find('caliper_'+side);
    caliper?.setParent(pivot);
    return pivot;
  });
  const steering=find('steering_wheel');
  const windows=container.meshes.filter(mesh=>mesh.name.includes('glass_'));
  const color=Color3.FromHexString(profile.color).toLinearSpace();
  for(const material of container.materials) {
    const paint = ['paint','paint_body'].includes(material.name);
    if(paint) {
      material.albedoColor=color;
      material.metallic=.25;
      material.roughness=.29;
    }
    if(material.name==='glass') {
      material.alpha=.64;
      material.transparencyMode=2;
    }
  }
  const original=node=>node.rotationQuaternion?.clone()??Quaternion.FromEulerVector(node.rotation);
  const rest=wheels.map(original);
  const steeringRest=original(steering);
  const rotate=(node,base,axis,angle)=>{node.rotationQuaternion=base.multiply(Quaternion.RotationAxis(axis,angle));};
  let spin=0;
  return {
    root,eye:new Vector3(...spec.eye),
    sync(car,interior,steer,dt) {
      root.position.set(car.x,.226,car.z);
      root.rotation.y=car.yaw;
      for(const mesh of windows) mesh.isVisible=!interior;
      spin=(spin+car.speed*dt/spec.radius)%(Math.PI*2);
      for(const [index,wheel] of wheels.entries()) rotate(wheel,rest[index],Vector3.Right(),spin*(index%2?-1:1));
      for(const pivot of front) pivot.rotation.y=-steer*.30;
      rotate(steering,steeringRest,Vector3.Forward(false),steer*.85);
    },
  };
}
