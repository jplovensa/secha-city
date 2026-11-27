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
const { driveStep, routeCheckpoints, onRoad, roadLength, roadPoint }=await import('../traffic.js');
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
for (let distance=0; distance<roadLength; distance+=.5) {
  const {x,z} = roadPoint(distance);
  assert.ok(onRoad(x,z));
}
car = {x:-3,z:42,yaw:Math.PI/2,speed:0};
let checkpoint=0;
let distance=31;
const distanceToRoadPoint = distance => {
  const {x,z}=roadPoint(distance);
  return Math.hypot(car.x-x,car.z-z);
};
for (let tick=0; tick<1600 && distance<roadLength+31; tick++) {
  while (distanceToRoadPoint(distance+.25)<distanceToRoadPoint(distance)) distance+=.25;
  const target=roadPoint(distance+4);
  const heading=Math.atan2(target.x-car.x,target.z-car.z);
  const error=Math.atan2(Math.sin(heading-car.yaw),Math.cos(heading-car.yaw));
  car=driveStep(car,Math.max(-1,Math.min(1,error*4)),1,.02);
  assert.ok(onRoad(car.x,car.z));
  const next = routeCheckpoints[checkpoint];
  if (next && Math.hypot(car.x-next.x,car.z-next.z)<3.5) checkpoint++;
}
assert.equal(checkpoint,routeCheckpoints.length);
assert.ok(distance>=roadLength+31);
car = {x:0,z:45.23,yaw:.15,speed:2};
for (let i=0; i<70; i++) car=driveStep(car,Number(car.yaw<Math.PI/2),1,.05);
assert.ok(car.x>7 && onRoad(car.x,car.z), 'Car can turn and move away from a kerb');
const district=await modelManifest('district');
assert.ok(['Compact Home','Family Townhouse','Garden Villa','Kitchen and Bath Lab'].every(name=>district.nodes.some(node=>node.name===name)));
const { vehicleAssets } = await import('../garage-models.js');
for (const {file} of Object.values(vehicleAssets)) {
  const model = await modelManifest(file.replace(/\.glb$/,''));
  for (const part of ['wheel_FL','wheel_FR','wheel_RL','wheel_RR','steering_wheel','glass_windshield','interior']) {
    assert.ok(model.nodes.some(node=>node.name===part),file+' is missing '+part);
  }
}
assert.doesNotMatch(index,/voice-player|play-voice/);
console.log('Commission budget, city routing, driving and expanded models passed.');

const { freshCity,hire,beginPavilion,availableWorkers,simulate,furnish,openPavilion }=await import('../city-operations.js');
const city=freshCity();
assert.equal(hire(city,'Rani','builder'),'');
assert.equal(city.credits,1090);
assert.equal(beginPavilion(city,'pandan','materials','eps','crew-1',1000),'');
assert.equal(beginPavilion(city,'maker','living','oak','crew-1',1000),'Assign an available worker to build.');
assert.equal(availableWorkers(city).length,1);
assert.equal(simulate(city,6251),true);
assert.equal(city.plots.pandan.phase,'built');
assert.equal(availableWorkers(city).length,2);
assert.equal(furnish(city,'pandan','lounge'),'');
assert.equal(openPavilion(city,'pandan',6252),'');
assert.equal(city.visitors,3);
const initial=city.credits;
assert.equal(simulate(city,21252),true);
assert.equal(city.credits,initial+44);
assert.equal(city.visitors,6);
assert.ok((await readFile(new URL('garage/daylight.hdr',dist))).length>100000);
const {default:capture}=await import('../captured-walk.js');
assert.ok(capture.rate>1 && capture.rate<2);
assert.ok(capture.clip.tracks.some(track=>track.name==='calf_l.quaternion'));
console.log('Director operations, captured walk and street texture decoder passed.');

const { mission } = await import('../renovation-data.js');
const { renovationPlan, consultationBrief } = await import('../renovation-mission.js');
assert.equal(renovationPlan('unknown','oak'),null);
assert.equal(renovationPlan('refresh',''),null);
for (const scope of mission.scopes) {
  for (const finish of mission.finishes) {
    const approved = renovationPlan(scope.id,finish.id);
    const waiting = renovationPlan(scope.id,finish.id,'wait');
    const switched = renovationPlan(scope.id,finish.id,'switch');
    const deferred = renovationPlan(scope.id,finish.id,'defer');

    assert.ok(approved.onTime && approved.high <= mission.budget);
    assert.equal(waiting.cost,approved.cost);
    assert.equal(waiting.days,finish.lead + mission.delay + mission.install + mission.handover);
    assert.equal(waiting.onTime,false);
    assert.equal(switched.selected.id,'umber');
    assert.equal(switched.cost,scope.cost + mission.substitute.cost);
    assert.equal(switched.days,scope.prep + mission.install + mission.handover);
    assert.ok(switched.onTime);
    assert.equal(deferred.cost,scope.cost);
    assert.equal(deferred.later,finish.cost + mission.returnVisit);
    assert.equal(deferred.days,scope.prep + mission.handover);
    assert.ok(deferred.fitStart > deferred.completion);
    assert.ok(deferred.onTime);
    assert.match(consultationBrief(deferred),/Outstanding decision · Approve a separate access window/);
    assert.match(consultationBrief(switched),/Prices and dates are illustrative/);
  }
}
assert.ok(renovationPlan('layered','walnut','defer').high > mission.budget);
console.log('Renovation estimates, move-in impacts, dependencies and exported brief passed.');

const { cars, createDriftRun, driftTarget, driftZones, scoreDrift } = await import('../drift.js');
for (const profile of cars) {
  for (const handbrake of [false,true]) {
    let car = {x:-3,z:42,yaw:Math.PI/2,speed:0};
    const run = createDriftRun();
    let progress = 31;
    const distanceTo = distance => {
      const point = roadPoint(distance);
      return Math.hypot(car.x-point.x,car.z-point.z);
    };
    for (let tick=0; tick<2000 && run.next<driftZones.length; tick++) {
      while (distanceTo(progress+.2)<distanceTo(progress)) progress+=.2;
      const entry = driftZones[run.next].distance-12;
      const sliding = handbrake && progress>entry-.6 && progress<entry+2;
      const target = roadPoint(progress+(sliding?5:3));
      const angle = Math.atan2(target.x-car.x,target.z-car.z)-car.yaw;
      const steer = Math.max(-1,Math.min(1,Math.atan2(Math.sin(angle),Math.cos(angle))*3.5));
      car = driveStep(car,steer,1,.025,sliding,profile);
      scoreDrift(run,car,.025);
      assert.ok(onRoad(car.x,car.z));
    }
    assert.equal(run.next,driftZones.length,profile.id+' can complete all bends');
    if (handbrake) assert.ok(run.points>=driftTarget,profile.id+' can achieve the drift target');
    else assert.equal(run.points,0,'Ordinary steering earns no drift points');
  }
}
console.log('All three cars can complete and score the drift circuit.');

const { advanceJob, choices: commissionChoices, objective, restoreJob, sites } = await import('../neighbourhood/mission.js');
const preview = await readFile(new URL('neighbourhood.html',dist),'utf8');
assert.match(index,/The House Opens at Dusk/);
assert.match(preview,/url=\.\//);
for (const site of Object.values(sites)) assert.ok(onRoad(...site.parking));
for (const choice of commissionChoices) {
  let job = restoreJob(null);
  assert.equal(advanceJob(job,'client'),job);
  job=advanceJob(job,'studio');
  assert.equal(objective(job).site,'client');
  job=advanceJob(job,'client');
  assert.equal(advanceJob(job,'lab','unknown'),job);
  assert.equal(objective(job).site,'lab');
  job=advanceJob(job,'lab',choice.id);
  assert.deepEqual(restoreJob(job),job);
  job=advanceJob(job,'client');
  assert.equal(job.step,'complete');
  assert.equal(job.choice,choice.id);
  assert.equal(objective(job).site,null);
  assert.deepEqual(restoreJob(job),job);
}
assert.deepEqual(restoreJob({step:'complete',choice:'bad'}),{step:'source',choice:null});
console.log('Babylon.js city entry, old-link redirect, street parking and all three commission outcomes passed.');

const { makeNavigation } = await import('../neighbourhood/navigation.js');
const navigation = makeNavigation([[-1,1,-1,1]]);
assert.deepEqual(navigation.walk(-1.31,0,.2,0),[-1.31,0]);
const from={x:-3,z:0}, to={x:3,z:0};
assert.equal(navigation.line(from,to),false);
const route=navigation.route(from,to);
assert.ok(route.length>=2);
for (const [i,point] of route.entries()) assert.ok(navigation.line(i?route[i-1]:from,point));
assert.ok(Math.hypot(route.at(-1).x-to.x,route.at(-1).z-to.z)<1.2);
console.log('Navigation collision and route following around obstructions passed.');
