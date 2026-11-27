import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';

const directory = new URL('../public/garage/',import.meta.url);
const assets = [
  ['classic-coupe','4d9a56a83a279a2808a080a5c88b3ffe28338e0cbd5be6e792d83747fa0b78f5'],
  ['estate-car','38be587aa4fdebbabefa0cf290c2ac4bae14bbf08b65940dde8baea1b27d1f9e'],
  ['daylight.hdr','5477b7dbb2aea4a6947cb36b96339c119f90bf36a03b039af3254b5e6a22896d',
    'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kloofendal_48d_partly_cloudy_1k.hdr'],
];
const hash = data => createHash('sha256').update(data).digest('hex');

await mkdir(directory,{recursive:true});
await Promise.all(assets.map(async ([name,expected,source]) => {
  const destination = new URL(source ? name : name+'.glb',directory);
  const existing = await readFile(destination).catch(error => {
    if (error.code !== 'ENOENT') throw error;
  });
  if (existing && hash(existing) === expected) return;
  const url = source ?? 'https://tevy.dev/models/'+name+'/v1/lod0.glb';
  const response = await fetch(url,{signal:AbortSignal.timeout(30_000)});
  if (!response.ok) throw new Error(name+' download failed ('+response.status+')');
  const data = Buffer.from(await response.arrayBuffer());
  if (hash(data) !== expected) throw new Error(name+' does not match the pinned model checksum');
  const temporary = new URL(name+'.'+process.pid+'.tmp',directory);
  await writeFile(temporary,data);
  await rename(temporary,destination);
}));
