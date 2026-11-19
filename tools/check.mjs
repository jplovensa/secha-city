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

const { newChapter, stageActions } = await import('../gameplay.js');
const { furnitureLayout } = await import('../layout.js');
const { encounters } = await import('../characters.js');
const game = newChapter();
for (const stop of stops) {
  assert.ok(encounters[stop.id], 'Missing encounter for ' + stop.id);
  assert.equal(game.finish(stop.id), false);
  game.talk(stop.id);
  if (stop.id !== 'arrival') assert.equal(game.finish(stop.id), false);
  const objectives = {
    arrival:[],garden:['breeze','pandan'],worktable:['timber'],wayang:stageActions,
    tea:['tea'],teduh:['tune','before','after'],library:['quote'],commission:['commission-before','commission-after'],courtyard:['mood'],opening:['guest'],
  };
  for (const action of objectives[stop.id]) game.record(action);
  assert.equal(game.finish(stop.id), true);
}
assert.equal(game.cleared,stops.length);

async function modelManifest(name) {
  const buffer = await readFile(new URL(name + '.glb',dist));
  assert.equal(buffer.toString('ascii',0,4),'glTF');
  assert.equal(buffer.readUInt32LE(8),buffer.length);
  return JSON.parse(buffer.toString('utf8',20,20+buffer.readUInt32LE(12)));
}
for (const name of ['studio-human','garden-visitor']) {
  const gltf = await modelManifest(name);
  assert.ok(gltf.skins.some(skin => skin.joints.length >= 50));
  const clips = gltf.animations.map(a => a.name);
  assert.ok(clips.some(name => /idle/i.test(name)));
  assert.ok(clips.some(name => /walk/i.test(name)));
}
for (const [name, edits] of Object.entries(furnitureLayout)) {
  const gltf = await modelManifest(name);
  for (const [id,edit] of Object.entries(edits)) assert.equal(gltf.nodes[id].name,edit.name);
}
const boxOverlap = (a,b) => a.min < b.max && b.min < a.max;
assert.ok(!boxOverlap({min:3.5+1.12,max:4.5+1.12},{min:3.25,max:4.01}));
assert.ok(!boxOverlap({min:10.7-1.12,max:11.7-1.12},{min:11.16,max:11.92}));
assert.ok(11.15 + furnitureLayout.teduh[21].delta[2] - 10.76 > .9);
console.log('Character rigs, chapter objectives and corrected furniture clearances passed.');

const { quote, chapters }=await import('../campaign.js');
const { driveStep, routeCheckpoints, onRoad }=await import('../traffic.js');
assert.equal(chapters.length,3);
const over=quote({finish:'walnut',screen:'private',lighting:'daylight'});
assert.equal(over.ready,false);
assert.ok(over.remaining<0);
const ordered=quote({finish:'oak',screen:'private',lighting:'warm'});
assert.equal(ordered.ready,true);
assert.equal(ordered.total,850);
assert.deepEqual(ordered.design,{finish:'oak',spacing:14,light:30});
let car={x:-3,z:42,yaw:Math.PI/2,speed:0};
for(let i=0;i<46;i++) car=driveStep(car,0,1,.05);
assert.ok(car.x>5 && car.speed>8);
assert.ok(onRoad(car.x,car.z));
assert.equal(onRoad(0,0),false);
for(const item of routeCheckpoints) assert.ok(onRoad(item.x,item.z));
const district=await modelManifest('district');
assert.ok(['Compact Home','Family Townhouse','Garden Villa','Kitchen and Bath Lab'].every(name=>district.nodes.some(node=>node.name===name)));
const carModel=await modelManifest('city-car');
assert.ok(['wheel_FL','wheel_FR','wheel_RL','wheel_RR'].every(name=>carModel.nodes.some(node=>node.name===name)));
const voiceManifest=JSON.parse(await readFile(new URL('voices.json',dist),'utf8'));
assert.equal(voiceManifest.provider,'heygen');
for(const clip of Object.values(voiceManifest.clips)) {
  assert.match(clip,/^voice-[a-z0-9-]+\.(mp3|wav)$/);
  assert.ok((await readFile(new URL(clip,dist))).length>1000);
}
console.log('Commission budget, city routing, driving, expanded models and optional HeyGen audio passed.');
