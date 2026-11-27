import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import { MeshoptCompression } from '@babylonjs/core/Meshes/Compression/meshoptCompression.js';
import { KhronosTextureContainer2 } from '@babylonjs/core/Misc/khronosTextureContainer2.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
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
const asset = file=>absolute(import.meta.env.BASE_URL+file);

registerBuiltInLoaders();
MeshoptCompression.Configuration.decoder={url:absolute(meshopt)};
KhronosTextureContainer2.DefaultNumWorkers=1;
KhronosTextureContainer2.URLConfig = {
  jsDecoderModule:absolute(decoder),wasmUASTCToASTC:absolute(astc),wasmUASTCToBC7:absolute(bc7),
  wasmUASTCToRGBA_UNORM:absolute(rgba),wasmUASTCToRGBA_SRGB:absolute(srgb),wasmUASTCToR8_UNORM:absolute(r8),
  wasmUASTCToRG8_UNORM:absolute(rg8),wasmZSTDDecoder:absolute(zstd),jsMSCTranscoder:absolute(basisModule),wasmMSCTranscoder:absolute(basis),
};

const load = (file,scene,options) => LoadAssetContainerAsync(asset(file),scene,{
  pluginOptions:{gltf:options},
});

export async function loadDistrict(scene) {
  const container = await load('district.glb',scene,{createInstances:false});
  container.addAllToScene();
  // Batch opaque geometry within each building so the entire district can stay loaded.
  const buildings=['Compact Home','Family Townhouse','Garden Villa','Kitchen and Bath Lab'];
  for(const name of buildings) {
    const root=scene.getNodeByName(name);
    const batches=new Map();
    for(const mesh of root?.getChildMeshes()??[]) {
      mesh.freezeWorldMatrix();
      if(!(mesh instanceof Mesh) || !mesh.geometry || mesh.getChildren().length || !mesh.material ||
          mesh.material.needAlphaBlendingForMesh(mesh)) continue;
      const key=mesh.material.uniqueId+':'+mesh.getVerticesDataKinds().sort().join(',');
      if(!batches.has(key)) batches.set(key,[]);
      batches.get(key).push(mesh);
    }
    for(const batch of batches.values()) {
      if(batch.length<2) continue;
      const combined=Mesh.MergeMeshes(batch,true,true);
      if(combined) {
        combined.name=name+' · '+combined.material.name;
        combined.freezeWorldMatrix();
      }
    }
  }
}

export async function addCast(scene) {
  const container=await load('garden-visitor.glb',scene);
  const positions=[[-15.85,32.25,0],[30,-11.4,Math.PI/2],[29.6,8.5,Math.PI/2]];
  for(const [index,[x,z,yaw]] of positions.entries()) {
    const {rootNodes,animationGroups}=container.instantiateModelsToScene(name=>'Crew '+index+' '+name,false,{doNotInstantiate:true});
    const root = new TransformNode('Crew member '+index,scene);
    root.position.set(x,.10,z);
    root.rotation.y=yaw;
    for(const node of rootNodes) node.parent=root;
    animationGroups.find(animation=>animation.name.endsWith('idle'))?.start(true);
  }
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
      root.position.set(car.x,.042,car.z);
      root.rotation.y=car.yaw;
      for(const mesh of windows) mesh.isVisible=!interior;
      spin=(spin+car.speed*dt/spec.radius)%(Math.PI*2);
      for(const [index,wheel] of wheels.entries()) rotate(wheel,rest[index],Vector3.Right(),spin*(index%2?-1:1));
      for(const pivot of front) pivot.rotation.y=-steer*.30;
      rotate(steering,steeringRest,Vector3.Forward(false),steer*.85);
    },
  };
}
