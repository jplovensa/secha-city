import * as THREE from 'three';
import { plots, surfaces } from './city-operations.js';

const mat = color => new THREE.MeshStandardMaterial({color,roughness:.78});
const floorMat=mat('#d7b994');
const plaster=mat('#cfc3aa');
const railMat=mat('#866748');
const stakes=mat('#d0af79');
const shellMats=Object.fromEntries(Object.entries(surfaces).map(([id,source])=>[id,mat(source.colour)]));
const baseGeometry=new THREE.CylinderGeometry(3.05,3.12,.16,64);
const stakeGeometry=new THREE.CylinderGeometry(.04,.052,2.5,10);
const woodTint=mat('#977758');

export function createPavilions(scene,textureLoader,studyURL,addSolids,removeSolids){
  const root=new THREE.Group();root.name='Director plots';scene.add(root);
  const current=new Map();
  let furnitureSource;
  let study;
  let latest;
  let selected='pandan';

  function mesh(parent,name,geometry,material,x,y,z){
    const item=new THREE.Mesh(geometry,material);
    item.name=name;
    item.position.set(x,y,z);
    parent.add(item);
    return item;
  }

  function sourcePiece(pattern) {
    let hit;
    furnitureSource?.traverse(node=>{ if(!hit && pattern.test(node.name)) hit=node; });
    return hit;
  }

  function placeAsset(container,pattern,x,z,yaw=0) {
    const source=sourcePiece(pattern);
    if(!source) return false;
    source.updateWorldMatrix(true,true);
    const copy=source.clone(true);
    copy.matrixAutoUpdate=false;
    copy.matrix.copy(source.matrixWorld);
    const dims=new THREE.Box3().setFromObject(copy);
    if(dims.isEmpty()) return false;
    const center = dims.getCenter(new THREE.Vector3());
    const translate=new THREE.Matrix4().makeTranslation(-center.x,-dims.min.y,-center.z);
    copy.matrix.premultiply(translate);
    const mount=new THREE.Group();mount.name='Pavilion furniture';
    mount.rotation.y=yaw;
    mount.position.set(x,.194,z);
    mount.add(copy);container.add(mount);
    return true;
  }

  function addFurniture(container,kit){
    if(kit==='gallery') {
      placeAsset(container,/Bernhardt.*Fabric.Sofa/i,0,-1.38,0);
      placeAsset(container,/Forest.archive.curved.designer.chair/i,-1.8,.5,-.46);
      placeAsset(container,/Forest.archive.curved.designer.chair/i,1.8,.5,.46);
    } else {
      const work=kit==='atelier';
      placeAsset(container,work ? /Kenwood.*oak.dining.table/i : /Scovato.*travertine.coffee.table/i,0,-.24,0);
      for(const side of [-1,1]){
        placeAsset(container,/Forest.archive.curved.designer.chair/i,side*(work?1.65:1.5),-.13,-side*1.04);
      }
    }
  }

  function shell(container,site){
    const surface=shellMats[site.surface];
    mesh(container,'Pavilion foundation',baseGeometry,floorMat,0,.11,0);
    for(let i=0;i<=26;i++) {
      const a=Math.PI+i*Math.PI/26;
      const x=2.75*Math.cos(a), z=2.22*Math.sin(a);
      const post=mesh(container,'Pavilion wall rib',stakeGeometry,surface,x,1.43,z);
      post.scale.set(1.15,1,1.25);
    }
    const panel=new THREE.CylinderGeometry(2.62,2.62,2.14,48,1,true,Math.PI,Math.PI);
    // CylinderGeometry starts in +Z. Rotate the half shell to the back of the room.
    const backMaterial=surface.clone();backMaterial.side=THREE.DoubleSide;
    const wall=mesh(container,'Pavilion wall',panel,backMaterial,0,1.27,0);
    wall.rotation.y=-Math.PI/2;
    wall.scale.z=.82;
    for(let depth=-1.76;depth<=1.62;depth+=.56) {
      const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(-2.78,2.62,depth),
        new THREE.Vector3(0,3.64,depth),new THREE.Vector3(2.78,2.62,depth));
      mesh(container,'Pavilion roof timber',new THREE.TubeGeometry(curve,20,.048,9,false),railMat,0,0,0);
    }
    for(const side of [-1,1]) mesh(container,'Pavilion entrance post',stakeGeometry,woodTint,side*2.75,1.44,.6);
    if(site.type==='heritage') {
      if(!study) {
        study=textureLoader.load(studyURL);
        study.colorSpace=THREE.SRGBColorSpace;
      }
      const artwork=new THREE.MeshBasicMaterial({map:study});
      mesh(container,'Pavilion wayang relief',new THREE.PlaneGeometry(2.30,.72),artwork,0,1.73,-2.0);
    }
    if(site.type==='materials') {
      for(const [i,tile] of Object.values(shellMats).entries()) {
        mesh(container,'Material samples',new THREE.BoxGeometry(.38,.62,.12),tile,(i-1)*.52,1.23,-1.99);
      }
    }
    if(site.kit) addFurniture(container,site.kit);
  }

  function preparePlot(plot,site) {
    const group=new THREE.Group();group.name=plot.name;
    group.position.set(plot.x,.075,plot.z);root.add(group);
    const ring=mesh(group,'Plot boundary',new THREE.RingGeometry(3.1,3.17,64),
      new THREE.MeshBasicMaterial({color:'#edc78a',transparent:true,opacity:.7,side:2}),0,.066,0);
    ring.rotation.x=-Math.PI/2;
    ring.visible=plot.id===selected;
    if(site?.phase==='building') {
      mesh(group,'Construction platform',baseGeometry,plaster,0,.11,0);
      for(const [x,z] of [[-2.35,-1.8],[2.35,-1.8],[-2.35,1.8],[2.35,1.8]]) {
        mesh(group,'Construction guide',stakeGeometry,stakes,x,1.42,z);
      }
    } else if(site) shell(group,site);
    return {group,ring};
  }

  function sync(state) {
    latest=state;
    for(const plot of plots) {
      const site=state.plots[plot.id];
      const token=JSON.stringify([site?.phase,site?.type,site?.surface,site?.kit,Boolean(furnitureSource)]);
      const cached=current.get(plot.id);
      if(cached?.token===token) continue;
      if(cached) {
        removeSolids(cached.group);
        root.remove(cached.group);
      }
      const view=preparePlot(plot,site);
      current.set(plot.id,{...view,token});
      if(site && site.phase!=='building') addSolids(view.group);
    }
  }

  return {
    sync,
    attachGallery(gallery){furnitureSource=gallery;if(latest)sync(latest);},
    select(id){selected=id;for(const [key,item] of current)item.ring.visible=key===id;},
  };
}
