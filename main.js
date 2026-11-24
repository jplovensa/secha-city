import './style.css';
import './driving.css';
import { defaults, finishes, stages, stops, updateDesign, dividerLayout } from './chapter.js';
import { createCity } from './scene.js';
import { encounters } from './characters.js';
import { handoverLine, newChapter, stageActions } from './gameplay.js';
import { chapterFor, chapters, commissionBudget, packages, quote } from './campaign.js';
import { routeCheckpoints } from './traffic.js';
import { cars, driftTarget, driftZones } from './drift.js';
import { makeDirector } from './director-ui.js';
import { makeRenovation } from './renovation-ui.js';

const $ = id => document.getElementById(id);
const experience = $('experience');
const canvas = $('world');
const base = import.meta.env.BASE_URL;
const keys = new Set();
const senseNotes = new Map();
const seen = new Set();
const chapter = newChapter();
const interactRadius = 1.62;
const storageKey = 'secha-city-room-v1';
let city;
let coverOpen = true;
let index = -1;
let activeStage = 3;
let wayangPlayback;
let stagePlaying = false;
let design = { ...defaults };
let comparison = false;
let handed = false;
let guided = false;
let tea = '';
let garden = '';
let transition = 0;
let drag;
let lastFrame = performance.now();
let lastDraw = 0;
let approaching = false;
let blockedFor = 0;
let campaignDone = false;
let managing=false;
let roaming = false;
let driving = false;
let mood = '';
let selections = {};
const guests = new Map();
let nextGuestId=0;
let loaded = false;
const director=makeDirector($('director'),()=>city);

try {
  design = updateDesign(defaults, JSON.parse(localStorage.getItem(storageKey) || '{}'));
} catch {
  // Local preferences are optional when storage is unavailable.
}

function setRenovationMode(useVisual) {
  coverOpen = false;
  guided = !useVisual;
  keys.clear();
  drag = null;
  experience.classList.add('renovating');
  experience.classList.toggle('guided',guided);
  document.querySelector('.top-actions').hidden = false;
  for (const id of ['manage-toggle','cast-toggle','city-toggle','story-toggle','map-toggle','cover','panel','roam','waypoint']) $(id).hidden = true;
  $('city-menu').hidden = false;
  $('reticle').hidden = guided;
  $('touch').hidden = guided;
  $('controls').hidden = guided;
  $('controls').innerHTML = '<b>W A S D</b> Walk <span>·</span> Drag to look <span>·</span> <b>E</b> Inspect';
  showNotice('');
}

const renovation = makeRenovation($('renovation'),$('waypoint'),() => city,setRenovationMode,resuming => {
  $('renovation-start').textContent = resuming ? 'Resume renovation mission' : 'Start renovation mission';
});

function startRenovation(useVisual) {
  ++transition;
  renovation.enter(useVisual);
}

$('renovation-start').addEventListener('click',() => startRenovation(true));
$('renovation-guided').addEventListener('click',() => startRenovation(false));
$('city-menu').addEventListener('click',() => {
  if (renovation.active) renovation.leave();
  if (driving) city.stopDrive();
  roaming = driving = false;
  $('roam').hidden = true;
  coverOpen = true;
  guided = false;
  keys.clear();
  drag = null;
  experience.classList.remove('renovating','guided');
  document.querySelector('.top-actions').hidden = true;
  $('city-menu').hidden = true;
  $('cover').hidden = false;
  $('map-toggle').hidden = false;
  $('reticle').hidden = $('touch').hidden = $('controls').hidden = true;
  updateDrivingUI();
  city?.lookFrom([2.35,-37.7,1.74],[-.4,-27.8,1.97]);
});

function button(text, onclick, pressed) {
  const el = document.createElement('button');
  el.type = 'button';
  el.textContent = text;
  el.addEventListener('click', onclick);
  if (pressed !== undefined) el.setAttribute('aria-pressed', String(pressed));
  return el;
}

function storyNote(text) {
  const p = document.createElement('p');
  p.className = 'note';
  p.textContent = text;
  return p;
}

function makeChoices(choices, selected, onSelect) {
  const row = document.createElement('div');
  row.className = 'stage';
  for (const [value, name] of choices) {
    row.append(button(name, () => onSelect(value), value === selected));
  }
  return row;
}

function sense(name, note) {
  senseNotes.set(name,note);
}

function stopWayangPlayback() {
  clearTimeout(wayangPlayback);
  stagePlaying = false;
}

function replayWayang() {
  if (stagePlaying) {
    stopWayangPlayback();
    renderStory();
    return;
  }
  stagePlaying = true;
  const play = (stage) => {
    if (stage === stages.length - 1) stopWayangPlayback();
    setStage(stage);
    if (stagePlaying) wayangPlayback = setTimeout(() => play(stage + 1), 1250);
  };
  play(0);
}

function setStage(stage) {
  activeStage = stage;
  chapter.record(stageActions[stage]);
  if (!guided) city?.setStage(stage);
  if (stage === 3) sense('Sight','The wayang backlight');
  renderStory();
  renderObjective();
}

function saveDesign(change) {
  const previous = design;
  design = updateDesign(design, change);
  if (design.spacing !== previous.spacing || design.light !== previous.light) chapter.record('tune');
  try {
    localStorage.setItem(storageKey, JSON.stringify(design));
  } catch {
    // The draft still works in this session.
  }
  if (change.finish) {
    chapter.record('timber');
    sense('Touch', finishes[design.finish].label);
    renderStory();
  }
  comparison = false;
  refreshDesign();
  renderObjective();
}

function refreshDesign() {
  const id=stops[index]?.id;
  const draft = comparison ? defaults : id === 'commission' ? quote(selections).design ?? design : design;
  $('spacing-value').value = draft.spacing + ' cm';
  $('light-value').value = draft.light + '%';
  $('spacing').value = draft.spacing;
  $('daylight').value = draft.light;
  $('original').setAttribute('aria-pressed',String(comparison));
  $('current').setAttribute('aria-pressed',String(!comparison));
  if (!guided && ['teduh','commission'].includes(id)) city?.setDesign(draft);
  if (guided && ['teduh','commission'].includes(id) && !handed) {
    const view = $('divider-plan');
    if (view) {
      view.style.setProperty('--room-light', String(draft.light / 100));
      view.style.setProperty('--timber', finishes[draft.finish].color);
      view.replaceChildren(...dividerLayout(draft.spacing).map(() => document.createElement('i')));
    }
  }
}

function renderStory() {
  if (index < 0) return;
  const stop = stops[index];
  const story = $('story');
  story.replaceChildren();
  if (handed && stop.id === 'opening') {
    story.append(storyNote(guestsHere().length + ' guest' + (guestsHere().length === 1 ? '' : 's') + ' at the opening · ' + quote(selections).remaining + ' credits left from the commission.'));
    return;
  }
  if (handed) {
    const count = dividerLayout(design.spacing).length;
    story.append(storyNote(count + ' turned slats · ' + design.spacing + ' cm spacing · ' + finishes[design.finish].label));
    if (senseNotes.size) {
      const list = document.createElement('ul');
      list.className = 'handover-list';
      for (const [name,note] of senseNotes) {
        const row = document.createElement('li');
        row.textContent = name + ' · ' + note;
        list.append(row);
      }
      story.append(list);
    }
    return;
  }
  if (!chapter.met(stop.id)) return;
  if (stop.id === 'garden') {
    story.append(makeChoices([['breeze','Notice the breeze'],['leaves','Brush the pandan']],garden, choice => {
      garden = choice;
      chapter.record(choice === 'breeze' ? 'breeze' : 'pandan');
      if (choice === 'breeze') {
        sense('Sound','Breeze under the almond trees');
      } else {
        sense('Scent','Crushed pandan leaf');
      }
      renderStory();
      renderObjective();
    }));
    if (garden) story.append(storyNote(garden === 'breeze'
      ? 'Dina pauses under the canopy where the leaves catch the breeze. Add that sound to your room brief.'
      : 'Imagine the sweet, green scent on your fingers as you cross from garden to studio.'));
  }
  if (stop.id === 'worktable') {
    story.append(makeChoices(Object.entries(finishes).map(([key,item]) => [key,item.label]), design.finish,
      choice => saveDesign({finish:choice})));
    story.append(storyNote(finishes[design.finish].note));
  }
  if (stop.id === 'wayang') {
    const steps = makeChoices(stages.map((s,i) => [i,s.label]),activeStage,stage => {
      stopWayangPlayback();
      setStage(stage);
    });
    steps.append(button(stagePlaying ? 'Pause sequence' : 'Play sequence',replayWayang));
    story.append(steps);
    story.append(storyNote(stages[activeStage].note));
    if (guided) {
      const img = document.createElement('img');
      img.className = 'wayang-image';
      img.src = base + 'wayang-study.png';
      img.alt = 'The carved wayang panel with four profiles and a central gunungan';
      story.append(img);
    }
  }
  if (stop.id === 'tea') {
    story.append(makeChoices([['jasmine','Jasmine tea'],['ginger','Ginger and palm sugar']],tea,choice => {
      tea = choice;
      chapter.record('tea');
      sense('Taste',choice === 'jasmine' ? 'Jasmine tea' : 'Ginger and palm sugar');
      renderStory();
      renderObjective();
    }));
    if (tea) story.append(storyNote(tea === 'jasmine'
      ? 'A familiar cup, left warm on the side table.'
      : 'A little heat and sweetness before you open the door.'));
  }
  if (stop.id === 'library') {
    const names={finish:'Timber',screen:'Divider',lighting:'Light'};
    for(const [category,options] of Object.entries(packages)){
      const row=document.createElement('div');
      row.className='budget-row';
      const title=document.createElement('b');
      title.textContent=names[category];
      row.append(title,makeChoices(options.map(({id,label,cost})=>[id,label+' · '+cost]),selections[category],value=>{
        selections={...selections,[category]:value};
        chapter.forget('commission-before');
        chapter.forget('commission-after');
        if (quote(selections).ready) chapter.record('quote');
        else chapter.forget('quote');
        renderStory();
        renderObjective();
      }));
      story.append(row);
    }
    const price=quote(selections);
    const tally=document.createElement('p');
    tally.className='budget-total';tally.dataset.over=String(price.remaining<0);
    tally.textContent=price.total+' / '+commissionBudget+' credits'+(price.remaining<0?' · Over budget':' · '+price.remaining+' left');
    story.append(tally);
  }
  if (stop.id === 'commission') {
    const installed=quote(selections).design;
    if(installed) {
      story.append(storyNote(finishes[installed.finish].label+' · '+installed.spacing+' cm spacing · '+(installed.light===30?'Warm light':'Filtered daylight')));
    }
  }
  if (stop.id === 'courtyard') {
    story.append(makeChoices([['afternoon','Afternoon light'],['dusk','Dusk']],mood,next=>{
      mood=next;
      if (!guided) city.setMood(mood);
      chapter.record('mood');
      renderStory();renderObjective();
    }));
  }
  if (stop.id === 'opening') {
    const row=document.createElement('div');
    row.className='stage';
    row.append(button('Add a guest',openCast));
    story.append(row);
    if (guestsHere().length) story.append(storyNote('Guest list · '+guestsHere().map(x=>x.name).join(', ')));
  }
  if (['teduh','commission'].includes(stop.id) && guided) {
    const screen = document.createElement('div');
    screen.id = 'divider-plan';
    screen.className = 'divider-plan';
    screen.setAttribute('aria-label','Preview of the timber screen');
    story.append(screen);
  }
}

function renderObjective() {
  const stop=stops[index];
  if (!stop) return;
  const remaining=chapter.remaining(stop.id);
  const next = $('advance');
  if (handed) {
    $('objective').textContent = '';
    next.disabled = false;
  } else if (!chapter.met(stop.id)) {
    $('objective').textContent = guided ? 'Read the conversation to continue.' : 'Walk to the marker or use the approach button.';
    updateEncounterButton();
  } else {
    $('objective').textContent = remaining.length ? remaining.join(' · ') : 'Ready to continue.';
    next.disabled = remaining.length > 0;
  }
}

function updateEncounterButton() {
  const encounter=encounters[stops[index]?.id];
  if (!encounter || chapter.met(stops[index].id)) return;
  const near = guided || city.distanceTo(encounter.position) <= interactRadius;
  const action = $('advance');
  action.disabled = false;
  const label = approaching ? 'Cancel approach' : (near ? 'Talk to ' : 'Approach ') + encounter.name;
  if (action.textContent !== label) action.textContent = label;
}

function meet() {
  const stop=stops[index];
  if (!stop || chapter.met(stop.id)) return;
  const encounter=encounters[stop.id];
  if (!guided && city.distanceTo(encounter.position) > interactRadius) return;
  chapter.talk(stop.id);
  if (stop.id === 'wayang') chapter.record(stageActions[0]);
  approaching = false;
  showNotice('');
  $('waypoint').hidden = true;
  if (!guided && ['wayang','teduh','commission'].includes(stop.id)) city.lookFrom(stop.eye,stop.at);
  showPanel(true);
  renderUI();
}

function renderUI() {
  const stop = stops[index];
  $('panel').hidden = !stop;
  if (!stop) return;
  const encounter=encounters[stop.id];
  const met=chapter.met(stop.id);
  const chapterNumber=chapterFor(stop.id);
  $('stop-type').textContent = handed ? 'Chapter ' + (chapterNumber+1) + ' complete' : 'Ch ' + (chapterNumber+1) + ' · ' + chapters[chapterNumber];
  $('stop-name').textContent = handed ? (stop.id==='opening' ? 'The studio is open.' : 'The room is yours.') : stop.area;
  const verdict = handoverLine(design.spacing,design.light);
  $('stop-copy').textContent = handed
    ? stop.id==='opening' ? 'The opening is underway. Take the city keys and explore the district.' : 'Ibu has seen your room. Your next assignment is waiting at the Material Library.'
    : met ? stop.copy : encounter.prompt;
  $('dialogue').hidden = !met || (handed && stop.id==='opening');
  $('speaker').textContent = encounter.name + ' · ' + encounter.role;
  $('speech').textContent = handed ? verdict : encounter.line;
  $('advance').textContent = handed ? stop.id==='opening' ? 'Explore the city' : 'Start Chapter 02' : stop.action;
  $('design').hidden = !['teduh','commission'].includes(stop.id) || handed || !met;
  for(const slider of document.querySelectorAll('#design .slider')) slider.hidden=stop.id==='commission';
  $('current').textContent=stop.id==='commission' ? 'Installed' : 'Your room';
  $('cast-toggle').hidden=guided || roaming;
  $('manage-toggle').hidden=guided;
  $('city-toggle').hidden=guided || !campaignDone;
  renderStory();
  refreshDesign();
  renderObjective();
  [...$('map').children].forEach((item,i) => {
    item.setAttribute('aria-current', String(i === index));
    item.disabled = !seen.has(stops[i].id);
    item.querySelector('span:last-child').textContent = seen.has(stops[i].id) ? '✓' : '';
  });
}

function showPanel(expanded) {
  $('panel-body').hidden = !expanded;
  $('panel-toggle').setAttribute('aria-expanded',String(expanded));
  $('panel-toggle').setAttribute('aria-label',expanded ? 'Minimise story' : 'Open story');
  $('panel-toggle').textContent = expanded ? '−' : '+';
}

function setMap(open) {
  $('map').hidden = !open;
  $('map-toggle').setAttribute('aria-expanded',String(open));
}

function showNotice(message) {
  $('route-status').textContent = message;
}

async function go(next) {
  const version = ++transition;
  if (driving) city.stopDrive();
  if(managing) director.close();
  managing=false;
  experience.classList.remove('management');
  roaming=false;
  driving=false;
  $('roam').hidden=true;
  $('story-toggle').hidden=true;
  $('city-menu').hidden=true;
  driftMode=false;
  updateDrivingUI();
  approaching = false;
  $('waypoint').hidden = true;
  stopWayangPlayback();
  keys.clear();
  setMap(false);
  const stop = stops[next];
  if (!stop) return;
  if (!guided) {
    const model = ['arrival','garden','courtyard'].includes(stop.id) ? 'arrival' : ['teduh','commission'].includes(stop.id) ? 'teduh' : 'gallery';
    $('advance').disabled = true;
    showNotice('Opening ' + stop.area + '…');
    try {
      await city.load(model);
      if (version !== transition) return;
      await city.showCast(stop.id);
      if (stop.id === 'worktable') city.load('teduh').catch(() => {});
    } catch (error) {
      console.warn(error);
      if (version !== transition) return;
      showNotice('This part of the 3D city could not load. Use Route to try again or open the guided edition.');
      enableGuidedRecovery();
      $('advance').disabled = false;
      return;
    }
    if (version !== transition) return;
    city.lookFrom(stop.eye,stop.at);
    city.draw();
  }
  index = next;
  seen.add(stop.id);
  handed = false;
  comparison = false;
  $('advance').disabled = false;
  if (stop.id === 'wayang') {
    activeStage = 0;
    if (!guided) city.setStage(activeStage);
  }
  showNotice('');
  showPanel(true);
  renderUI();
}

function begin(useGuided = false) {
  if (!useGuided && !loaded) return;
  coverOpen = false;
  guided = useGuided;
  experience.classList.toggle('guided',guided);
  $('cover').hidden = true;
  document.querySelector('.top-actions').hidden = false;
  $('controls').hidden = guided;
  $('reticle').hidden = guided;
  $('touch').hidden = guided;
  go(index < 0 ? 0 : index);
  if (!guided) {
    city.load('gallery').catch(() => {});
  }
}

function enableGuidedRecovery() {
  if (document.getElementById('recovery')) return;
  const recovery = button('Guided edition',() => {
    recovery.remove();
    begin(true);
  });
  recovery.id = 'recovery';
  document.querySelector('.top-actions').append(recovery);
}

function sceneIssue() {
  if (renovation.active) {
    $('renovation-start').disabled = true;
    renovation.recover();
  } else if (!coverOpen) {
    showNotice('The graphics connection paused. You can continue in the guided edition.');
    enableGuidedRecovery();
  } else {
    $('loader').textContent = 'The 3D city needs WebGL 2. You can play the mission without 3D.';
  }
}

function advance(assist = true) {
  if ($('advance').disabled || index < 0) return;
  const id=stops[index].id;
  if (!chapter.met(id)) {
    const spot=encounters[id].position;
    if (guided || city.distanceTo(spot) <= interactRadius) {
      meet();
    } else if (assist) {
      approaching = !approaching;
      blockedFor = 0;
      if (!approaching) showNotice('');
      updateEncounterButton();
    } else {
      showNotice('Move closer to the marker to talk.');
    }
    return;
  }
  if (handed) {
    if(id==='opening') {
      if (!guided) openCity();
      return;
    }
    go(index+1);
    return;
  }
  if (!chapter.finish(id)) return;
  if(id==='teduh' || id==='opening'){
    handed=true;
    comparison=false;
    if(id==='opening') campaignDone=true;
    renderUI();
    if(id==='opening' && guided) {
      $('advance').disabled=true;
      $('advance').textContent='Campaign complete';
    }
  } else {
    if (id==='commission') saveDesign(quote(selections).design);
    go(index+1);
  }
}

for (const [i,stop] of stops.entries()) {
  const link = button('',() => { if (seen.has(stop.id)) go(i); });
  const label = document.createElement('span');
  label.textContent = stop.area;
  link.append(label,document.createElement('span'));
  $('map').append(link);
}

$('enter').addEventListener('click', () => begin(false));
$('guided').addEventListener('click', () => begin(true));
$('manage-start').addEventListener('click',openManagement);
$('manage-toggle').addEventListener('click',openManagement);
$('map-toggle').addEventListener('click',() => setMap($('map').hidden));
$('panel-toggle').addEventListener('click',() => showPanel($('panel-body').hidden));
$('advance').addEventListener('click',() => advance());
$('spacing').addEventListener('input',event => saveDesign({spacing:Number(event.target.value)}));
$('daylight').addEventListener('input',event => saveDesign({light:Number(event.target.value)}));
$('original').addEventListener('click',() => {
  chapter.record(stops[index].id==='commission'?'commission-before':'before');
  comparison=true;refreshDesign();renderObjective();
});
$('current').addEventListener('click',() => {
  if(comparison) chapter.record(stops[index].id==='commission'?'commission-after':'after');
  comparison=false;refreshDesign();renderObjective();
});

function guestsHere() {
  return guests.get(stops[index]?.id)??[];
}

function renderGuests() {
  const list=$('cast-list');
  list.replaceChildren(...guestsHere().map(({id,name})=>{
    const row=document.createElement('li');
    const title=document.createElement('span');
    title.textContent=name;
    const remove=button('Remove',()=>{
      if(!guided) city.removePerson(id);
      const records=guestsHere().filter(person=>person.id!==id);
      guests.set(stops[index].id,records);
      if(stops[index].id==='opening' && !records.length && !campaignDone) chapter.forget('guest');
      renderGuests();renderStory();renderObjective();
    });
    remove.setAttribute('aria-label','Remove '+name);
    row.append(title,remove);
    return row;
  }));
}

function openCast() {
  if (roaming || !stops[index]) return;
  keys.clear();
  approaching=false;
  $('cast-status').textContent='';
  renderGuests();
  $('cast-dialog').showModal();
}

$('cast-toggle').addEventListener('click',openCast);
$('cast-close').addEventListener('click',()=>$('cast-dialog').close());
$('cast-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const stop=stops[index].id;
  const entries=guestsHere();
  const name=$('guest-name').value.trim();
  if(!name) return;
  if(entries.length>=4) {
    $('cast-status').textContent='This stop has space for four added characters.';
    return;
  }
  const submit=$('add-guest');
  submit.disabled=true;
  try {
    const id=guided ? 'guided-' + (++nextGuestId) : await city.addPerson(stop,name,$('guest-kind').value);
    if(!id) {
      $('cast-status').textContent='The places near this stop are occupied. Walk farther into the room and try again.';
      return;
    }
    guests.set(stop,[...entries,{id,name}]);
    if(stop==='opening') chapter.record('guest');
    $('cast-status').textContent=name+' joined this stop.';
    $('guest-name').value='';
    renderGuests();renderStory();renderObjective();
  } catch {
    $('cast-status').textContent='The character could not load. Try again.';
  } finally {
    submit.disabled=false;
  }
});

let circuitProgress=0;
let driftMode=false;
let cockpitView=false;
let selectedCar=cars[0].id;
const garage = $('garage-dialog');

try {
  const saved = localStorage.getItem('secha-city-car');
  if (cars.some(car=>car.id===saved)) selectedCar = saved;
} catch { /* The garage still works for this session. */ }

for (const car of cars) {
  const label = document.createElement('label');
  label.className = 'garage-car';
  label.style.setProperty('--car-color',car.color);
  label.innerHTML = `<input type="radio" name="city-car" value="${car.id}"><span><b>${car.name}</b><small>${car.description}</small></span>`;
  $('garage-cars').append(label);
}

function openGarage() {
  keys.clear();
  garage.querySelector(`input[value="${selectedCar}"]`).checked = true;
  $('drive-swap').hidden = !roaming;
  garage.showModal();
}

function chooseCar(mode) {
  selectedCar = garage.querySelector('input:checked').value;
  try { localStorage.setItem('secha-city-car',selectedCar); }
  catch { /* The selection can still be used. */ }
  garage.close();
  if (!roaming) {
    openCity(true,mode);
    return;
  }
  city.setVehicle(selectedCar);
  if (mode !== 'swap') {
    driftMode = mode === 'drift';
    city.resetDrive(driftMode);
    if (!driving) {
      // Refresh the player's position at the starting line before entering.
      city.stopDrive();
      toggleVehicle();
    }
    updateDrivingUI();
  }
}

function changeDrivingCamera() {
  if (!driving) return;
  cockpitView = !cockpitView;
  city.setCameraView(cockpitView);
  $('road-camera').textContent = cockpitView ? 'Chase view' : 'Cockpit view';
}

$('road-garage').addEventListener('click',openGarage);
$('garage-close').addEventListener('click',()=>garage.close());
$('drift-start').addEventListener('click',()=>chooseCar('drift'));
$('drive-free').addEventListener('click',()=>chooseCar('free'));
$('drive-swap').addEventListener('click',()=>chooseCar('swap'));
$('road-camera').addEventListener('click',changeDrivingCamera);
$('road-retry').addEventListener('click',()=>{
  keys.clear();
  city.resetDrive(true);
  if (!driving) city.stopDrive();
  updateDrivingUI();
});
function updateDrivingUI(speed=0) {
  $('speedometer').parentElement.hidden=!driving;
  $('speedometer').textContent=speed+' km/h';
  $('road-distance').textContent='';
  $('road-car').textContent=driving?'Get out':'Get in the car';
  $('road-camera').hidden = !driving;
  $('road-camera').textContent = cockpitView ? 'Chase view' : 'Cockpit view';
  $('touch-drift').hidden = !driving;
  $('road-retry').hidden = !driftMode;
  $('drift-score').hidden = !driftMode;
  $('roam-title').textContent = driftMode ? 'Perimeter drift' : 'The perimeter drive';
  if (driftMode && !driving) $('road-task').textContent = 'Get in the car to continue the drift mission.';
  $('touch').setAttribute('aria-label',driving ? 'Driving controls' : 'Walking controls');
  const labels = driving ? ['Accelerate','Steer left','Reverse','Steer right'] : ['Walk forward','Step left','Walk back','Step right'];
  [...$('touch').children].forEach((control,index) => control.setAttribute('aria-label',labels[index]));
  $('controls').innerHTML=driving ? '<b>W S</b> Accelerate / reverse <span>·</span> <b>A D</b> Steer <span>·</span> <b>Space</b> Handbrake <span>·</span> <b>C</b> Camera <span>·</span> <b>E</b> Exit'
    : roaming ? '<b>W A S D</b> Walk <span>·</span> Drag to look <span>·</span> <b>E</b> Get in'
    : '<b>W A S D</b> Walk <span>·</span> Drag to look <span>·</span> <b>E</b> Interact';
}

async function openCity(fromCover=false,mode='walk') {
  const driveNow = mode !== 'walk';
  if(guided || (!campaignDone && !fromCover && !managing) || roaming || !loaded) return;
  const now=++transition;
  keys.clear();
  $('advance').disabled=true;
  $('city-toggle').disabled=true;
  $('free-start').disabled=true;
  $('drive-start').disabled=true;
  if(fromCover) $('loader').textContent='Opening the city streets…';
  showNotice('Opening the city streets…');
  try {
    await city.openDistrict(true);
    if(now!==transition) return;
    if(managing) director.close();
    managing=false;
    experience.classList.remove('management');
    roaming=true;driving=false;
    coverOpen=false;
    $('cover').hidden=true;
    $('controls').hidden=false;
    $('touch').hidden=false;
    document.querySelector('.top-actions').hidden=false;
    $('story-toggle').hidden=false;
    $('city-menu').hidden=false;
    $('map-toggle').hidden=index<0;
    $('manage-toggle').hidden=false;
    $('city-toggle').hidden=true;
    $('waypoint').hidden=true;
    $('panel').hidden=true;
    $('roam').hidden=false;
    $('cast-toggle').hidden=true;
    driftMode = mode === 'drift';
    city.setVehicle(selectedCar);
    city.setCameraView(cockpitView);
    city.resetDrive(driftMode);
    circuitProgress=0;
    if (driveNow) {
      toggleVehicle();
    } else updateDrivingUI();
    $('road-task').textContent = driftMode ? 'Follow the gold markers around the circuit.' : 'Follow the perimeter road through three gold checkpoints.';
    showNotice('');
  } catch (error) {
    console.warn(error);
    showNotice('The district could not load. Try City streets again.');
    if(fromCover) $('loader').textContent='The district could not load. Try Free roam again.';
    $('advance').disabled=false;
  } finally {
    $('city-toggle').disabled=false;
    $('free-start').disabled=false;
    $('drive-start').disabled=false;
  }
}

async function openManagement() {
  if(!loaded || managing) return;
  const version=++transition;
  const start=$('manage-start');
  const switcher=$('manage-toggle');
  start.disabled=true;switcher.disabled=true;
  if(coverOpen) $('loader').textContent='Opening the development sites…';
  showNotice('Opening the development sites…');
  try {
    if(driving) city.stopDrive();
    await city.openDirector();
    if(version!==transition) return;
    keys.clear();
    approaching=false;
    roaming=false;driving=false;managing=true;guided=false;coverOpen=false;
    experience.classList.remove('guided');
    experience.classList.add('management');
    $('cover').hidden=true;$('panel').hidden=true;$('roam').hidden=true;$('waypoint').hidden=true;
    $('controls').hidden=true;$('touch').hidden=true;$('touch-drift').hidden=true;
    $('controls').innerHTML='<b>W A S D</b> Walk <span>·</span> Drag to look';
    document.querySelector('.top-actions').hidden=false;
    $('cast-toggle').hidden=true;$('story-toggle').hidden=false;$('city-menu').hidden=true;
    $('city-toggle').hidden=false;$('map-toggle').hidden=true;
    switcher.hidden=true;
    director.open();
    showNotice('');
  } catch(error) {
    console.warn(error);
    showNotice('The development sites could not load. Try again.');
    if(coverOpen) $('loader').textContent='The development sites could not load. Try again.';
  } finally {
    start.disabled=false;switcher.disabled=false;
  }
}

function toggleVehicle() {
  if(!roaming) return;
  if(driving) {
    city.stopDrive();
    driving=false;
  } else {
    driving=city.beginDrive();
    if(!driving) showNotice('Walk closer to the parked car.');
    else showNotice('');
  }
  keys.clear();
  updateDrivingUI();
}
$('city-toggle').addEventListener('click',()=>openCity());
$('free-start').addEventListener('click',()=>openCity(true));
$('drive-start').addEventListener('click',openGarage);
$('story-toggle').addEventListener('click',()=>{
  $('map-toggle').hidden=false;
  go(Math.max(index,0));
});
$('road-car').addEventListener('click',toggleVehicle);

const motionKeys = new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
window.addEventListener('keydown',event => {
  if (garage.open || coverOpen || $('cast-dialog').open || event.altKey || event.metaKey || event.ctrlKey || event.target.closest?.('input,textarea,select')) return;
  if (driving && event.code === 'KeyC' && !event.repeat) changeDrivingCamera();
  if (driving && event.code === 'Space') {
    event.preventDefault();
    keys.add('Space');
  }
  if (event.code === 'KeyE' && !event.repeat) {
    if (renovation.active) renovation.interact();
    else if (roaming) toggleVehicle();
    else if(managing) return;
    else if ($('panel-body').hidden) showPanel(true);
    else advance(false);
  }
  if (!guided && motionKeys.has(event.code)) {
    event.preventDefault();
    approaching = false;
    renovation.stopApproach();
    keys.add(event.code);
  }
});
window.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur',() => keys.clear());
document.addEventListener('visibilitychange', () => { if (document.hidden) keys.clear(); });
for (const control of document.querySelectorAll('[data-move]')) {
  const code = control.dataset.move;
  control.addEventListener('pointerdown',event => {
    event.preventDefault();
    approaching = false;
    renovation.stopApproach();
    control.setPointerCapture(event.pointerId);
    keys.add(code);
  });
  for (const type of ['pointerup','pointercancel','lostpointercapture']) {
    control.addEventListener(type,() => keys.delete(code));
  }
}
canvas.addEventListener('pointerdown',event => {
  if (coverOpen || guided || driving || event.button !== 0) return;
  approaching = false;
  renovation.stopApproach();
  canvas.focus({preventScroll:true});
  canvas.setPointerCapture(event.pointerId);
  drag = {id:event.pointerId,x:event.clientX,y:event.clientY};
});
canvas.addEventListener('pointermove', event => {
  if (drag?.id !== event.pointerId) return;
  const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
  if(managing && !director.onFoot) city.orbitPlot(dx,dy);
  else city.turn(dx,dy);
  drag.x = event.clientX;
  drag.y = event.clientY;
});
canvas.addEventListener('lostpointercapture', () => { drag = null; });
canvas.addEventListener('wheel',event=>{
  if(!managing || director.onFoot) return;
  event.preventDefault();
  city.orbitPlot(0,0,event.deltaY);
},{passive:false});

function frame(now) {
  requestAnimationFrame(frame);
  const delta = Math.min(.08,(now - lastFrame) / 1000);
  lastFrame = now;
  if (!city || !loaded || guided || document.hidden) return;
  if (!coverOpen && driving) {
    if (garage.open) { city.draw(); return; }
    const throttle=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'));
    const steer=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
    const hud=city.drive(steer,throttle,delta,keys.has('Space'));
    if(hud) {
      $('speedometer').textContent=hud.speed+' km/h';
      circuitProgress=hud.checkpoint;
      const zone = hud.run && driftZones[hud.run.next];
      const destination = routeCheckpoints[circuitProgress];
      const task = hud.run ? zone ? `${hud.run.next} / ${driftZones.length} corners · ${zone.name}. Tap the handbrake while turning.`
        : hud.run.points >= driftTarget ? 'Mission complete.' : 'Circuit complete. Restart to beat the drift target.'
        : destination ? circuitProgress+' / 3 landmarks · Next: '+destination.name : '3 / 3 landmarks visited. Keep driving to explore.';
      if ($('road-task').textContent !== task) $('road-task').textContent=task;
      $('road-distance').textContent = hud.distance === null ? 'Circuit complete' :
        hud.run?.inside ? 'Drift zone' : hud.distance + (hud.run ? ' m to drift zone' : ' m to checkpoint');
      if (hud.run) {
        const points = Math.round(hud.run.slide);
        $('drift-score').textContent = `${hud.run.points} / ${driftTarget} pts${points ? ' · +' + points + ' sliding' : ''}`;
      }
    }
  } else if (!coverOpen) {
    city.animate(delta);
    if(managing) {
      director.step(now);
      $('controls').hidden=!director.onFoot;
      $('touch').hidden=!director.onFoot;
    }
    const stop = stops[index];
    const encounter = encounters[stop?.id];
    if (!renovation.active && !managing && !roaming && encounter && !chapter.met(stop.id)) {
      if (approaching) {
        if (city.distanceTo(encounter.position) <= interactRadius) {
          meet();
        } else {
          const moved = city.approach(encounter.position,delta);
          blockedFor = moved ? 0 : blockedFor + delta;
          if (blockedFor > .45) {
            approaching = false;
            showNotice('The path is blocked here. Walk around the furniture and try again.');
          }
        }
      }
      if (!chapter.met(stop.id)) {
        const marker=city.marker(encounter.position);
        const el=$('waypoint');
        el.hidden=!marker.visible;
        if (marker.visible) {
          el.style.left=marker.x + '%';
          el.style.top=marker.y + '%';
          if (el.firstElementChild.textContent !== encounter.name) el.firstElementChild.textContent=encounter.name;
        }
        updateEncounterButton();
      }
    }
    const forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
    const right = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
    const turn = Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft'));
    if (turn && (!renovation.active || renovation.canWalk)) {
      if(managing && !director.onFoot) city.orbitPlot(turn*delta*320,0);
      else city.turn(turn*delta*320,0);
    }
    if ((forward || right) && (!managing || director.onFoot) && (!renovation.active || renovation.canWalk)) city.walk(right,forward,delta);
    renovation.tick(delta);
  }
  if (now-lastDraw > 1000/35) {
    city.draw();
    lastDraw=now;
  }
}

async function start() {
  try {
    city = createCity(canvas,sceneIssue);
    city.lookFrom([2.35,-37.7,1.74],[-.4,-27.8,1.97]);
    city.preloadCast().catch(console.warn);
    await city.load('arrival', event => {
      if (coverOpen && event.lengthComputable) $('loader').textContent = 'Opening the garden · ' + Math.round(event.loaded / event.total * 100) + '%';
    });
    loaded = true;
    $('enter').disabled = false;
    $('renovation-start').disabled = false;
    $('free-start').disabled = false;
    $('drive-start').disabled = false;
    $('manage-start').disabled=false;
    $('manage-start').textContent='Run Central City';
    $('loader').textContent = 'Walk with WASD or the on-screen arrows. Drag to look.';
  } catch (error) {
    console.warn(error);
    $('manage-start').textContent = '3D city unavailable';
    sceneIssue();
  }
}
requestAnimationFrame(frame);
start();
