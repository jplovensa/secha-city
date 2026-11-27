import { Vector3 } from 'three';

// Changes refer to the original glTF node IDs and names. Work in metres, in
// Three.js world coordinates, so authored rotations stay intact.
import { furnitureLayout } from './furniture-edits.js';
export { furnitureLayout } from './furniture-edits.js';

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
