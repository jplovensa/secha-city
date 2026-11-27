import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { PointLight } from '@babylonjs/core/Lights/pointLight.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { roadHalfWidth, roadLength, roadPoint } from '../traffic.js';
import { sites } from './mission.js';

export const authoredBlocks = [[-27.64,-20.60,-27.5,-15.65],[-14.64,-5.6,-30.5,-16.65],[2.5,19.5,-32.5,-16.25],[22.5,36.5,13.5,24.5]];
export const cityLandmarks = [...authoredBlocks,[-6,6,24.5,32],[-21,14.8,-8.7,14.8],[-35.5,-22.5,1.5,17.8],[27,35,-4,5]];

export function floorHeight(x,z) {
  if(x>-21&&x<14.8&&z>-8.7&&z<14.8) return .32;
  if(x>-6.5&&x<6.5&&z>24.5&&z<32) return .17;
  if(x>-35.5&&x<-22.5&&z>1.5&&z<17.8) return .21;
  if(x>27&&x<35&&z>-3&&z<5) return .29;
  return .055;
}

export function makeNeighbourhood(scene) {
  function matte(name,color,roughness) {
    const material=new PBRMaterial(name,scene);
    material.albedoColor=Color3.FromHexString(color).toLinearSpace();
    material.metallic=0;
    material.roughness=roughness;
    return material;
  }
  function box(name,x,y,z,width,height,depth,material,parent) {
    const mesh=MeshBuilder.CreateBox(name,{width,height,depth},scene);
    mesh.parent=parent??null;
    mesh.position.set(x,y,z);
    mesh.material=material;
    mesh.receiveShadows=true;
    return mesh;
  }
  const road=matte('Asphalt','#4a4a46',.99);
  const kerb=matte('Sandstone paving','#a99c84',.87);
  const paint=matte('Lane markings','#ded0aa',.88);

  function strip(name,start,length,halfWidth,offset,y,material,segments) {
    const positions=[],indices=[],normals=[];
    for(let i=0;i<=segments;i++) {
      const {x,z,nx,nz}=roadPoint(start+length*i/segments);
      const inner=offset-halfWidth,outer=offset+halfWidth;
      positions.push(x+nx*inner,y,z+nz*inner,x+nx*outer,y,z+nz*outer);
      normals.push(0,1,0,0,1,0);
      if(i<segments) indices.push(i*2,i*2+2,i*2+1,i*2+1,i*2+2,i*2+3);
    }
    const mesh=new Mesh(name,scene);
    const data=new VertexData();
    data.positions=positions;data.indices=indices;data.normals=normals;
    data.applyToMesh(mesh);
    mesh.material=material;
    mesh.receiveShadows=true;
    mesh.freezeWorldMatrix();
    return mesh;
  }

  strip('Perimeter road',0,roadLength,roadHalfWidth,0,.198,road,224);
  strip('Perimeter footpath',0,roadLength,.82,-roadHalfWidth-.82,.237,kerb,224);
  for(const side of [-1,1]) strip('Road edge',0,roadLength,.045,side*(roadHalfWidth-.17),.206,paint,224);
  for(let i=0;i<56;i++) strip('Lane divider',i*roadLength/56,2.45,.04,0,.207,paint,4);

  const marker=MeshBuilder.CreateTorus('Destination marker',{diameter:1.65,thickness:.045,tessellation:36},scene);
  const markerPaint=new StandardMaterial('Waypoint',scene);
  markerPaint.emissiveColor=new Color3(.74,.44,.12);
  marker.material=markerPaint;

  const screen=new TransformNode('Rumah Teduh screen',scene);
  screen.position.set(10.55,.33,9.78);
  const timber=matte('Finished timber','#ad8259',.58);
  const linen=matte('Natural woven linen','#d5cbb6',.98);
  const roomLight=new PointLight('Concealed light on the screen',new Vector3(10.6,2.45,9.25),scene);
  roomLight.diffuse=Color3.FromHexString('#ffcd94');
  roomLight.range=6.2;
  roomLight.intensity=0;
  const roomFill=new PointLight('Bedside glow',new Vector3(7.3,2.7,8.95),scene);
  roomFill.diffuse=Color3.FromHexString('#ffe0bb');
  roomFill.range=6;
  roomFill.intensity=.24;
  let activeChoice;
  return {
    mark(site) {
      marker.setEnabled(Boolean(site));
      if(site) marker.position.set(sites[site].x,sites[site].y+.035,sites[site].z);
    },
    applyFinish(choice,dusk) {
      roomFill.intensity=dusk?.85:.24;
      roomLight.intensity=choice ? choice.warmth*(dusk?1.25:.45) : 0;
      if(choice===activeChoice) return;
      activeChoice=choice;
      screen.getChildMeshes().forEach(mesh=>mesh.dispose());
      if(!choice) return;
      timber.albedoColor=Color3.FromHexString(choice.color).toLinearSpace();
      const count=Math.floor(2.22/choice.spacing)+1;
      for(let i=0;i<count;i++) {
        const slat=MeshBuilder.CreateCylinder('Turned timber slat',{height:2.23,diameterTop:.063,diameterBottom:.084,tessellation:12},scene);
        slat.parent=screen;
        slat.position.set((i-(count-1)/2)*choice.spacing,1.14,0);
        slat.material=timber;
        slat.receiveShadows=true;
      }
      box('Timber sill',0,.055,0,2.36,.08,.14,timber,screen);
      box('Timber head rail',0,2.23,0,2.36,.08,.14,timber,screen);
      if(choice.lined) box('Woven linen backing',0,1.13,.072,2.23,2.10,.028,linen,screen);
    },
  };
}
