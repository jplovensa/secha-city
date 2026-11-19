"""Export the selected chapter areas from the native SketchUp model as web GLBs.

Run with the SketchUp SDK loader from the model workspace on macOS.
"""
from array import array
from ctypes import Structure, c_ubyte, byref
from pathlib import Path
import json
import struct
import sys
import tempfile

sys.path.insert(0, str(Path.cwd()))
from asset_axes import *

MODEL = Path(sys.argv[1])
OUTPUT = Path(sys.argv[2])
OUTPUT.mkdir(exist_ok=True, parents=True)
model = load(MODEL)
root = refs(('EntitiesGetNumGroups', 'EntitiesGetGroups'), ref('ModelGetEntities', model))[0]

class Color(Structure):
    _fields_ = [(k, c_ubyte) for k in 'rgba']

def opt(method, entity):
    result = R()
    su(method, entity, byref(result), optional=True)
    return result

def yes(method, entity):
    result = B()
    su(method, entity, byref(result), optional=True)
    return result.value

def children(group):
    e = ref('GroupGetEntities', group)
    return {string('GroupGetName', g):g for g in refs(('EntitiesGetNumGroups', 'EntitiesGetGroups'), e)}

def walk_root(path):
    item = root
    chain = [root]
    for part in path:
        item = children(item)[part]
        chain.append(item)
    return item, chain

def gltf_matrix(source):
    m = list(source)
    m[12:15] = [v * .0254 for v in m[12:15]]
    return m

def file_number(name):
    return next((n for n in ('Tracing Study','EPS Blank','WAYANG EPS','WAYANG LED') if n in name), '')

class GLB:
    def __init__(self, path):
        self.path = path
        self.raw = bytearray()
        self.d = dict(asset={'version':'2.0','generator':'SECHA City SketchUp export'}, scene=0, scenes=[{'nodes':[0]}],
                      nodes=[{'name':'SketchUp coordinates', 'rotation':[-.7071067811865476,0,0,.7071067811865476], 'children':[]}],
                      meshes=[], materials=[], accessors=[], bufferViews=[])
        self.mats = {}
        self.cache = {}
        self.images = {}
        self.tmp = tempfile.TemporaryDirectory()

    def add(self, key, item):
        self.d.setdefault(key, []).append(item)
        return len(self.d[key]) - 1

    def view(self, data, target=None):
        self.raw.extend(bytes(-len(self.raw) % 4))
        item = dict(buffer=0, byteOffset=len(self.raw), byteLength=len(data))
        if target:
            item['target'] = target
        self.raw.extend(data)
        return self.add('bufferViews', item)

    def accessor(self, data, code, size, btype, target, bounds=False):
        result = dict(bufferView=self.view(data.tobytes(), target), componentType=code, count=len(data)//size, type=btype)
        if bounds:
            result.update(min=[min(data[j::size]) for j in range(size)], max=[max(data[j::size]) for j in range(size)])
        return self.add('accessors', result)

    def material(self, source):
        key = source.value
        if key in self.mats:
            return self.mats[key]
        color = Color(208,198,182,255)
        name = 'Ivory plaster'
        opacity = D(1)
        texture = R()
        if key:
            name = string('MaterialGetName', source)
            su('MaterialGetColor',source,byref(color),optional=True)
            if yes('MaterialGetUseOpacity',source):
                su('MaterialGetOpacity',source,byref(opacity))
            texture = opt('MaterialGetTexture',source)
        def linear(value):
            f = value/255
            return f/12.92 if f < .04045 else ((f+.055)/1.055)**2.4
        rgb = [linear(v) for v in (color.r,color.g,color.b)]
        pbr = dict(baseColorFactor=[*rgb, opacity.value], metallicFactor=0, roughnessFactor=.82)
        out = dict(name=name, pbrMetallicRoughness=pbr, doubleSided=True)
        if texture.value:
            tk = texture.value
            if tk not in self.images:
                path = Path(self.tmp.name) / f'{tk}.png'
                if su('TextureWriteToFile',texture,str(path).encode(),optional=True)==0 and path.exists():
                    png = path.read_bytes()
                    # SketchUp's writer keeps the source encoding for some imported textures.
                    mime = 'image/jpeg' if png[:2] == b'\xff\xd8' else 'image/png'
                    im = self.add('images', dict(bufferView=self.view(png), mimeType=mime))
                    if 'samplers' not in self.d:
                        self.add('samplers',dict(wrapS=10497, wrapT=10497))
                    self.images[tk] = self.add('textures', dict(source=im,sampler=0))
                else:
                    self.images[tk] = None
            tex = self.images[tk]
            if tex is not None:
                pbr['baseColorTexture'] = {'index':tex}
                pbr['baseColorFactor'] = [1,1,1,opacity.value]
                if any(word in name.lower() for word in ('leaf','leaves','foliage','daun','logo')):
                    out.update(alphaMode='MASK',alphaCutoff=.45)
        if opacity.value < .99:
            out['alphaMode'] = 'BLEND'
        if any(s in name.lower() for s in ('led_', 'light_glow', 'lamp_milk', 'light warmth')):
            out['emissiveFactor'] = rgb
        result = self.add('materials', out)
        self.mats[key] = (result, 'baseColorTexture' in pbr)
        return self.mats[key]

    def geometry(self, entities, inherited):
        key = (entities.value, inherited.value)
        if key in self.cache:
            return self.cache[key]
        by_mat = {}
        for f in refs(('EntitiesGetNumFaces','EntitiesGetFaces'),entities):
            if yes('DrawingElementGetHidden', cast_ref('FaceToDrawingElement', f)):
                continue
            face_mat = opt('FaceGetFrontMaterial',f)
            front = bool(face_mat.value)
            use = face_mat if front else (inherited if inherited.value else opt('FaceGetBackMaterial',f))
            material, textured = self.material(use)
            mesh = R()
            if su('MeshHelperCreate',byref(mesh),f,optional=True):
                continue
            nv = getnum('MeshHelperGetNumVertices',mesh)
            ni = 3 * getnum('MeshHelperGetNumTriangles',mesh)
            if nv and ni:
                verts=(Point*nv)(); normals=(Point*nv)(); uv=(Point*nv)(); inds=(Z*ni)(); got=Z()
                su('MeshHelperGetVertices',mesh,Z(nv),verts,byref(got))
                su('MeshHelperGetVertexIndices',mesh,Z(ni),inds,byref(got))
                su('MeshHelperGetNormals',mesh,Z(nv),normals,byref(got),optional=True)
                if textured:
                    method = 'MeshHelperGetFrontSTQCoords' if front or inherited.value else 'MeshHelperGetBackSTQCoords'
                    su(method,mesh,Z(nv),uv,byref(got),optional=True)
                seen, points, norms, uvs, indices = by_mat.setdefault(material, ({}, array('f'), array('f'), array('f'), array('I')))
                lookup = []
                for v,n,t in zip(verts,normals,uv):
                    xyz = tuple(round(a*.0254,5) for a in (v.x,v.y,v.z))
                    normal = tuple(round(a,4) for a in (n.x,n.y,n.z))
                    if normal == (0,0,0):
                        normal = (0,0,1)
                    st = (round(t.x/t.z,5), round(1-t.y/t.z,5)) if textured and t.z else (0,0)
                    code = (*xyz,*normal,*st)
                    idx=seen.get(code)
                    if idx is None:
                        idx=len(seen);seen[code]=idx
                        points.extend(xyz);norms.extend(normal)
                        if textured:
                            uvs.extend(st)
                    lookup.append(idx)
                indices.extend(lookup[j] for j in inds)
            su('MeshHelperRelease',byref(mesh))
        primitives=[]
        for mid, (_, p, n, u, ix) in by_mat.items():
            if not ix:
                continue
            attrs=dict(POSITION=self.accessor(p,5126,3,'VEC3',34962,True),NORMAL=self.accessor(n,5126,3,'VEC3',34962))
            if u:
                attrs['TEXCOORD_0']=self.accessor(u,5126,2,'VEC2',34962)
            if len(p)//3 <= 65536:
                ix=array('H',ix)
            primitives.append(dict(attributes=attrs,indices=self.accessor(ix,5123 if ix.typecode=='H' else 5125,1,'SCALAR',34963),material=mid))
        result = self.add('meshes',dict(primitives=primitives)) if primitives else None
        self.cache[key] = result
        return result

    def visit(self, item, typ, parent, matrix=None, inherited=None, name=None, include=None):
        de=cast_ref(typ+'ToDrawingElement',item)
        if yes('DrawingElementGetHidden',de):
            return
        group = typ=='Group'
        label=name or string(typ+'GetName',item)
        if group:
            e=ref('GroupGetEntities',item)
        else:
            definition=ref('ComponentInstanceGetDefinition',item)
            e=ref('ComponentDefinitionGetEntities',definition)
            label=label or string('ComponentDefinitionGetName',definition)
        m=opt('DrawingElementGetMaterial',de)
        material=m if m.value else (inherited or R())
        transform=matrix if matrix is not None else mat(item,typ+'GetTransform')
        node=dict(name=label,matrix=gltf_matrix(transform))
        mesh=self.geometry(e,material)
        if mesh is not None:
            node['mesh']=mesh
        idx=self.add('nodes',node)
        self.d['nodes'][parent].setdefault('children',[]).append(idx)
        for k,seq in [('Group','Groups'),('ComponentInstance','Instances')]:
            for sub in refs(('EntitiesGetNum'+seq,'EntitiesGet'+seq),e):
                n=string(k+'GetName',sub)
                if include and not include(n):
                    continue
                self.visit(sub,k,idx,inherited=material)

    def section(self, path, name=None, include=None):
        item, chain=walk_root(path)
        t=ID
        for part in chain:
            t=multiply(t,mat(part,'GroupGetTransform'))
        self.visit(item,'Group',0,matrix=t,name=name,include=include)

    def write(self):
        self.raw.extend(bytes(-len(self.raw)%4))
        self.d['buffers']=[dict(byteLength=len(self.raw))]
        manifest=json.dumps(self.d,ensure_ascii=False,separators=(',',':')).encode()
        manifest+=b' '*(-len(manifest)%4)
        with self.path.open('wb') as out:
            out.write(struct.pack('<4sII',b'glTF',2,28+len(manifest)+len(self.raw)))
            out.write(struct.pack('<I4s',len(manifest),b'JSON'))
            out.write(manifest)
            out.write(struct.pack('<I4s',len(self.raw),b'BIN\0'))
            out.write(self.raw)
        print(self.path.name,len(self.d['nodes']),len(self.d['materials']),self.path.stat().st_size,flush=True)
        self.tmp.cleanup()

zone='01 THE INTERIOR QUARTER'
land='09 LANDSCAPE'
bay='04 Ruang Bayang Wayang'
settings={
 'arrival': [
  (('00 SITE',), 'Site',None),
  (('08 RECEPTION',), 'Reception',None),
  ((land,'00 Design Garden'),'Garden',None),
  ((land,'00 The Five Senses Walk'),'Sensory Walk',None),
  ((land,'01 Courtyard of Listening'),'Listening Court',None),
  ((land,'02 Garden of Scent'),'Scent Garden',None),
  ((land,'03 Tropical Canopy'),'Canopy',None),
  ((zone,'00 Design Promenade'),'Promenade',None)
 ],
 'gallery': [
  ((zone,bay),'Ruang Bayang',lambda n: not file_number(n)),
  ((zone,bay,'WAYANG EPS'),'WayangCarving',None),
  ((zone,bay,'WAYANG LED'),'WayangLight',None),
  ((zone,bay,'Maker / Tracing Study'),'WayangDrawing',None),
  ((zone,bay,'Maker / EPS Blank'),'WayangBlank',None),
  ((zone,'02 Kitchen and Dining Atelier'),'Atelier',None),
  ((zone,'01 Warm Modern Salon'),'Salon',None),
  (('05 MATERIAL LIBRARY',),'Material Library',None),
  (('07 CAFE',),'Tea Pavilion',None)
 ],
 'teduh': [((zone,'03 Resort Suite and Dressing'),'Rumah Teduh',None)],
 'district': [
  (('02 COMPACT HOME','00 Shell and Context'),'Compact Home',None),
  (('03 FAMILY TOWNHOUSE','00 Shell and Context'),'Family Townhouse',None),
  (('04 GARDEN VILLA','00 Shell and Context'),'Garden Villa',None),
  (('06 KITCHEN BATH LAB','00 Pavilion Shell'),'Kitchen and Bath Lab',None),
 ]
}
for name, paths in settings.items():
    if len(sys.argv)>3 and name not in sys.argv[3:]:
        continue
    bundle=GLB(OUTPUT/f'{name}.glb')
    for path,label,include in paths:
        print('Exporting',label,flush=True)
        bundle.section(path,label,include)
    bundle.write()
