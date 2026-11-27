import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { roadHalfWidth, roadLength, roadPoint } from '../traffic.js';
import { sites } from './mission.js';

export const authoredBlocks = [[-27.64,-20.60,-27.5,-15.65],[-14.64,-5.6,-30.5,-16.65],[2.5,19.5,-32.5,-16.25],[22.5,36.5,13.5,24.5]];

export function walkPosition(x,z,dx,dz,obstacles) {
  const clear = (px,pz) => Math.max(Math.abs(px),Math.abs(pz))<49 &&
    !obstacles.some(([left,right,back,front])=> px>left-.27 && px<right+.27 && pz>back-.27 && pz<front+.27);
  if (clear(x+dx,z)) x+=dx;
  if (clear(x,z+dz)) z+=dz;
  return [x,z];
}

export function makeNeighbourhood(scene) {
  const obstacles = authoredBlocks.slice();
  const material = (name,hex) => {
    const value = new StandardMaterial(name,scene);
    value.diffuseColor = Color3.FromHexString(hex);
    value.specularColor = new Color3(.075,.075,.075);
    return value;
  };
  const grass = material('Garden ground','#747f64');
  const road = material('Asphalt','#454745');
  const kerb = material('Sandstone pavement','#bcb09b');
  const paint = material('Lane markings','#e9dbab');
  const plaster = material('Lime plaster','#e2ceb0');
  const clay = material('Terracotta','#975a47');
  const wood = material('Oiled teak','#77533b');
  const metal = material('Dark steel','#343a32');
  const textile = material('Natural linen','#e3d7ba');
  const bedcover = material('Olive cotton','#7b886a');
  const glass = material('Clear glass','#aababc');
  glass.alpha = .30;

  function box(name,x,y,z,w,h,d,finish,parent) {
    const mesh = MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);
    mesh.parent=parent??null;
    mesh.position.set(x,y,z);
    mesh.material=finish;
    return mesh;
  }

  function strip(name,start,length,halfWidth,offset,y,finish,segments) {
    const positions=[], indices=[], normals=[];
    for (let i=0;i<=segments;i++) {
      const {x,z,nx,nz}=roadPoint(start+length*i/segments);
      const inner=offset-halfWidth, outer=offset+halfWidth;
      positions.push(x+nx*inner,y,z+nz*inner,x+nx*outer,y,z+nz*outer);
      normals.push(0,1,0,0,1,0);
      if(i<segments) indices.push(i*2,i*2+2,i*2+1,i*2+1,i*2+2,i*2+3);
    }
    const mesh = new Mesh(name,scene);
    const data = new VertexData();
    data.positions=positions;
    data.indices=indices;
    data.normals=normals;
    data.applyToMesh(mesh);
    mesh.material=finish;
    return mesh;
  }
  box('District grounds',0,-.16,0,110,.3,110,grass);
  strip('Perimeter road',0,roadLength,roadHalfWidth,0,.01,road,220);
  strip('Footpath',0,roadLength,1.18,-roadHalfWidth-1.18,.05,kerb,220);
  strip('Outer road edge',0,roadLength,.045,roadHalfWidth-.19,.022,paint,220);
  strip('Inner road edge',0,roadLength,.045,-roadHalfWidth+.19,.022,paint,220);
  const markings = 56;
  for(let i=0;i<markings;i++) strip('Lane divider',i*roadLength/markings,2.5,.035,0,.025,paint,3);

  function sign(label,x,y,z,parent) {
    const texture = new DynamicTexture(label,{width:768,height:160},scene,false);
    const ctx=texture.getContext();
    ctx.fillStyle='#26392f';
    ctx.fillRect(0,0,768,160);
    ctx.strokeStyle='#c7a878';ctx.lineWidth=3;ctx.strokeRect(12,12,744,136);
    ctx.font='600 64px Helvetica,Arial';ctx.fillStyle='#fbe9cb';ctx.textAlign='center';
    ctx.fillText(label,384,103,690);
    texture.update();
    const finish = new StandardMaterial(label,scene);
    finish.diffuseTexture=texture;finish.emissiveTexture=texture;
    finish.emissiveColor.set(.25,.25,.25);finish.backFaceCulling=false;
    const panel = MeshBuilder.CreatePlane(label,{width:3.5,height:.73},scene);
    panel.parent=parent;
    panel.rotation.y=Math.PI;
    panel.position.set(x,y,z);
    panel.material=finish;
  }

  const buildings = [
    ['studio',-14,30,0,11,9,'SECHA STUDIO'],
    ['client',27.4,-13,Math.PI/2,11,9,'COURTYARD APARTMENTS'],
    ['lab',27.4,7,Math.PI/2,11,9,'MATERIAL LAB'],
  ];
  let screen;
  for (const [id,x,z,angle,w,d,label] of buildings) {
    const parent = new TransformNode(id,scene);
    parent.position.set(x,0,z);
    parent.rotation.y=angle;
    const make = (...args)=>box(...args,parent);
    function wall(name,lx,lz,width,depth,height=3.25,finish=plaster) {
      make(name,lx,height/2,lz,width,height,depth,finish);
      if(angle) obstacles.push([x+lz-depth/2,x+lz+depth/2,z-lx-width/2,z-lx+width/2]);
      else obstacles.push([x+lx-width/2,x+lx+width/2,z+lz-depth/2,z+lz+depth/2]);
    }

    make('Plinth',0,.03,0,w,.13,d,kerb);
    wall('Back wall',0,-d/2,w,.24,3.25,id==='lab'?clay:plaster);
    wall('West wall',-w/2,0,.24,d);
    wall('East wall',w/2,0,.24,d);
    const span=(w-2.5)/2;
    wall('Front window',-w/2+span/2,d/2,span,.14,2.6,glass);
    wall('Front window',w/2-span/2,d/2,span,.14,2.6,glass);
    make('Lintel',0,2.86,d/2,w,.54,.32,wood);
    make('Deep shade canopy',0,3.30,.14,w+.62,.28,d+1.95,id==='studio'?clay:plaster);
    sign(label,0,2.87,d/2+.19,parent);
    make('Entry walk',0,.035,d/2+1.6,3.8,.10,4,kerb);

    if(id==='client') {
      wall('Bed headboard',-2.4,-3.18,2.75,.20,1.25,wood);
      make('Upholstered platform',-2.4,.33,-1.7,2.58,.49,2.76,wood);
      make('Mattress',-2.4,.66,-1.7,2.55,.27,2.68,textile);
      make('Olive coverlet',-2.4,.82,-1.35,2.49,.065,1.95,bedcover);
      make('Left pillow',-3.02,.89,-2.76,1,.16,.49,textile);
      make('Right pillow',-1.82,.89,-2.76,1,.16,.49,textile);
      wall('Bed base',-2.4,-1.7,2.5,2.65,.35,wood);
      make('Linen rug',-2.4,.12,-.85,4.2,.035,4.0,textile);
      make('Bedside table',-.57,.38,-2.45,.62,.53,.6,wood);
      make('Clay reading lamp',-.57,.83,-2.45,.28,.34,.28,clay);
      screen = new TransformNode('Fitted timber screen',scene);
      screen.parent=parent;
      const slats=material('Commission finish','#997450');
      for(let i=0;i<14;i++) box('Screen slat',-.72+i*.10,1.41,.55,.045,2.65,.1,slats,screen);
      box('Screen rail',-.06,2.72,.55,1.46,.08,.11,slats,screen);
      screen.setEnabled(false);
      screen.finish=slats;
    } else {
      wall(id==='studio'?'Reception desk':'Samples counter',0,-2.5,4.5,.86,1.04,wood);
      for (let i=0;i<5;i++) {
        const tone=i%2 ? clay : textile;
        make('Material display',-1.6+i*.80,1.33,-2.5,.54,.62,.25,tone);
      }
      for (let i=0;i<4;i++) make('Timber wall panel',-3.6+i*2.4,1.84,-d/2+.21,.9,2.35,.12,wood);
    }
  }

  const leaf = ['#64744e','#596b4f','#819168'].map((color,index)=>material('Leaf '+index,color));
  const trunk = material('Bark','#645341');
  for (const [index,[x,z]] of [[-23,35],[-5,35],[6,35],[17,35],[26,35],[35,30],[35,-4],[35,-23],[26,-36],[9,-36],[-5,-36],[-23,-36],[-34,-23],[-34,-4],[-34,13],[-34,29],[-33,18],[-21,12],[-9,6],[1,13],[16,20],[13,7],[-17,-9],[1,-10],[14,-6]].entries()) {
    const stem=MeshBuilder.CreateCylinder('Street tree trunk',{height:2.8,diameterTop:.19,diameterBottom:.32,tessellation:7},scene);
    stem.position.set(x,1.4,z);stem.material=trunk;
    const crown=MeshBuilder.CreateSphere('Tree canopy',{diameter:3.6+(index%3)*.33,segments:6},scene);
    crown.position.set(x,3.28,z);crown.scaling.y=.77;crown.material=leaf[index%leaf.length];
    obstacles.push([x-.17,x+.17,z-.17,z+.17]);
  }
  for(let i=0;i<16;i++) {
    const {x,z,nx,nz}=roadPoint((i+.42)*roadLength/16);
    box('Streetlight',x-nx*5,1.63,z-nz*5,.13,3.25,.13,metal);
    box('Lantern',x-nx*4.74,3.25,z-nz*4.74,.43,.16,.43,textile);
  }
  box('Central court',0,.02,4,23,.085,14,kerb);
  box('Pandan courtyard planter',0,.25,6,4,.52,7,clay);
  obstacles.push([-2,2,2.5,9.5]);
  for(let i=0;i<10;i++) {
    const tuft=MeshBuilder.CreateSphere('Courtyard pandan',{diameter:1.45,segments:5},scene);
    tuft.position.set(i%2?-.85:.85,1.07,3+Math.floor(i/2)*1.45);tuft.scaling.y=.89;tuft.material=leaf[i%3];
  }

  const marker = MeshBuilder.CreateTorus('Destination marker',{diameter:2,thickness:.09,tessellation:30},scene);
  marker.material=material('Waypoint','#ffcf78');
  marker.material.emissiveColor.set(.65,.42,.11);
  return {
    obstacles,
    mark(site) {
      marker.setEnabled(Boolean(site));
      if (site) marker.position.set(sites[site].x,.14,sites[site].z);
    },
    applyFinish(choice) {
      screen.setEnabled(Boolean(choice?.color));
      if (!choice?.color) return;
      screen.finish.diffuseColor=Color3.FromHexString(choice.color);
      if (!obstacles.some(([left])=>left===27.85)) obstacles.push([27.85,28.05,-13.75,-12.10]);
    },
  };
}
