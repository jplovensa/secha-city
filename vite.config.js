import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

function textureDecoder() {
  return {
    name:'pack-basis-textures',
    generateBundle() {
      for(const name of ['basis_transcoder.js','basis_transcoder.wasm']) {
        const source=readFileSync(new URL('./node_modules/three/examples/jsm/libs/basis/'+name,import.meta.url));
        this.emitFile({type:'asset',fileName:'basis/'+name,source});
      }
    },
  };
}

export default defineConfig({
  base:'./',
  plugins:[textureDecoder()],
  build:{assetsDir:'assets'},
});
