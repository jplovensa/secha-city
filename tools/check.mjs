import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { defaults, dividerLayout, stops, updateDesign } from '../chapter.js';

assert.equal(new Set(stops.map(s => s.id)).size, stops.length);
assert.equal(updateDesign(defaults, { spacing: 900 }).spacing, 28);
assert.equal(updateDesign(defaults, { light: -50 }).light, 0);
assert.equal(updateDesign(defaults, { finish: 'unknown' }).finish, 'walnut');
assert.ok(dividerLayout(12).length > dividerLayout(28).length);
assert.ok(Math.abs(dividerLayout(16).reduce((sum, x) => sum+x, 0)) < 1e-6);

const dist = new URL('../dist/', import.meta.url);
const index = await readFile(new URL('index.html',dist), 'utf8');
for (const [, file] of index.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)) {
  const url = new URL(file, 'https://jplovensa.github.io/secha-city/');
  assert.ok(url.pathname.startsWith('/secha-city/'));
  await readFile(new URL(file, dist));
}
assert.match(index, /src="\.\/assets\//);
for (const name of ['arrival','gallery','teduh']) {
  const payload = await readFile(new URL(name + '.glb',dist));
  assert.equal(payload.toString('ascii',0,4),'glTF');
  assert.equal(payload.readUInt32LE(8),payload.length);
  assert.ok(payload.length < 20_000_000, name + ' exceeds chapter budget');
  const manifest = JSON.parse(payload.toString('utf8',20,20 + payload.readUInt32LE(12)));
  assert.ok(manifest.meshes.length > 0);
  if (name === 'gallery') {
    for (const stage of ['WayangDrawing','WayangBlank','WayangCarving','WayangLight']) {
      assert.ok(manifest.nodes.some(node => node.name === stage), stage + ' is missing');
    }
  }
}
const files = await readdir(new URL('assets/',dist));
assert.ok(files.some(file => file.endsWith('.js')));
console.log('Chapter logic, model files, and project URL paths passed.');
