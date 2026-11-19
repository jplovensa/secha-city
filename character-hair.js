import { BufferGeometry, Color, Float32BufferAttribute, Mesh, MeshStandardMaterial, Vector3 } from 'three';

const colour = new Color();
const point = new Vector3();

export function addJosephineFringe(body) {
  const head = body.getObjectByName('head');
  if (!head) return;
  body.updateMatrixWorld(true);
  const anchor = head.getWorldPosition(new Vector3());
  const inverse = head.matrixWorld.clone().invert();
  const positions = [];
  const colours = [];
  const indices = [];
  const columns = 56;
  const rows = 16;

  for (let i=0; i<=rows; i++) {
    const t=i/rows;
    for (let j=0; j<=columns; j++) {
      const u=2*j/columns-1;
      const edge=u*u;
      const rootY=.166-.021*edge;
      const tipY=.070-.011*edge + .0025*Math.sin(22*u)+.0017*Math.cos(42*u);
      const y=rootY+(tipY-rootY)*t;
      const width=.050+.025*Math.sin(t*Math.PI/2);
      const zRoot=.045-.025*edge;
      const zTip=.115-.043*edge;
      const z=zRoot+(zTip-zRoot)*Math.sin(t*Math.PI/2) + .005*Math.sin(Math.PI*t);
      point.set(u*width+.004*Math.sin(t*Math.PI)*u,y,z).add(anchor).applyMatrix4(inverse);
      positions.push(point.x,point.y,point.z);
      const strand = .019 + .006*Math.sin(107*u + .16*Math.sin(12*t)) + .004*Math.sin(52*u);
      colour.setRGB(strand,strand*.87,strand*.89);
      colours.push(colour.r,colour.g,colour.b);
      if (i<rows && j<columns) {
        const a=i*(columns+1)+j;
        const b=a+columns+1;
        indices.push(a,b,a+1,b,b+1,a+1);
      }
    }
  }
  const geo=new BufferGeometry();
  geo.setAttribute('position',new Float32BufferAttribute(positions,3));
  geo.setAttribute('color',new Float32BufferAttribute(colours,3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const material=new MeshStandardMaterial({vertexColors:true,roughness:.72,metalness:0,side:2});
  const fringe=new Mesh(geo,material);
  fringe.name='Josephine | black fringe';
  head.add(fringe);
}
