import { Vector3 } from 'three';

// Changes refer to the original glTF node IDs and names. Work in metres, in
// Three.js world coordinates, so authored rotations stay intact.
export const furnitureLayout = {
  gallery: {
    15: {name:'Low curved shadow room table 1', delta:[1.12,0,0]},
    16: {name:'Low curved shadow room table 2', delta:[-1.12,0,0]},
    177: {name:'Archive / Forest archive curved designer chair', delta:[0,0,.12]},
    184: {name:'Archive / Forest archive curved designer chair', delta:[0,0,-.12]},
    191: {name:'Archive / Forest archive curved designer chair', delta:[0,0,.12]},
    198: {name:'Archive / Forest archive curved designer chair', delta:[0,0,-.12]},
    205: {name:'Archive / Forest archive curved designer chair', delta:[0,0,.12]},
    212: {name:'Archive / Forest archive curved designer chair', delta:[0,0,-.12]},
  },
  teduh: {
    17: {name:'Layered_Bed_lampbase', delta:[-.25,.04,.07]},
    18: {name:'Layered_Bed_lampbase.001', delta:[.25,.04,.07]},
    19: {name:'Layered_Bed_lampshade', delta:[-.25,.04,.07]},
    20: {name:'Layered_Bed_lampshade.001', delta:[.25,.04,.07]},
    21: {name:'Forest collection / outdoor lounge sofa', delta:[0,0,.55]},
    31: {name:'Archive / Forest archive curved occasional table', remove:true},
    33: {name:'Archive / Forest archive curved occasional table', remove:true},
  },
};

export function applyFurnitureLayout(name, gltf) {
  const edits = furnitureLayout[name];
  if (!edits) return;
  const objects = [];
  const names = gltf.parser.json.nodes;
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(object => {
    const id = gltf.parser.associations.get(object)?.nodes;
    const edit = edits[id];
    if (edit && names[id]?.name === edit.name) objects.push([object,edit]);
  });
  for (const [object,edit] of objects) {
    const parent = object.parent;
    if (edit.remove) {
      parent.remove(object);
      continue;
    }
    const to = object.getWorldPosition(new Vector3()).add(new Vector3(...edit.delta));
    object.position.copy(parent.worldToLocal(to));
  }
}
