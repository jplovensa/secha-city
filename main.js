import './style.css';
import { defaults, finishes, stages, stops, updateDesign, dividerLayout } from './chapter.js';
import { makeSound } from './sound.js';
import { createCity } from './scene.js';

const $ = id => document.getElementById(id);
const experience = $('experience');
const canvas = $('world');
const audio = makeSound();
const keys = new Set();
const senseNotes = new Map();
const seen = new Set();
const storageKey = 'secha-city-room-v1';
const base = import.meta.env.BASE_URL;
let city;
let coverOpen = true;
let index = -1;
let activeStage = 3;
let design = { ...defaults };
let comparison = false;
let handed = false;
let guided = false;
let tea = '';
let garden = '';
let transition = 0;
let drag;
let lastStep = 0;
let lastFrame = performance.now();
let loaded = false;

try {
  design = updateDesign(defaults, JSON.parse(localStorage.getItem(storageKey) || '{}'));
} catch {
  // Local preferences are optional when storage is unavailable.
}

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

function setStage(stage) {
  activeStage = stage;
  if (!guided) city?.setStage(stage);
  if (stage === 3) sense('Sight','The wayang backlight');
  audio.tick('chime');
  renderStory();
}

function saveDesign(change) {
  design = updateDesign(design, change);
  try {
    localStorage.setItem(storageKey, JSON.stringify(design));
  } catch {
    // The draft still works in this session.
  }
  if (change.finish) {
    sense('Touch', finishes[design.finish].label);
    renderStory();
  }
  comparison = false;
  refreshDesign();
}

function refreshDesign() {
  const draft = comparison ? defaults : design;
  $('spacing-value').value = draft.spacing + ' cm';
  $('light-value').value = draft.light + '%';
  $('spacing').value = draft.spacing;
  $('daylight').value = draft.light;
  $('original').setAttribute('aria-pressed',String(comparison));
  $('current').setAttribute('aria-pressed',String(!comparison));
  if (!guided && stops[index]?.id === 'teduh') city?.setDesign(draft);
  if (guided && stops[index]?.id === 'teduh' && !handed) {
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
  if (stop.id === 'garden') {
    story.append(makeChoices([['breeze','Notice the breeze'],['leaves','Brush the pandan']],garden, choice => {
      garden = choice;
      if (choice === 'breeze') {
        sense('Sound','Breeze under the almond trees');
        audio.tick('chime');
      } else {
        sense('Scent','Crushed pandan leaf');
      }
      renderStory();
    }));
    if (garden) story.append(storyNote(garden === 'breeze'
      ? 'The garden carries a low rustle. Switch sound on to hear it as you walk.'
      : 'Imagine the sweet, green scent on your fingers as you cross from garden to studio.'));
  }
  if (stop.id === 'worktable') {
    story.append(makeChoices(Object.entries(finishes).map(([key,item]) => [key,item.label]), design.finish,
      choice => saveDesign({finish:choice})));
    story.append(storyNote(finishes[design.finish].note));
  }
  if (stop.id === 'wayang') {
    story.append(makeChoices(stages.map((s,i) => [i,s.label]),activeStage,setStage));
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
      sense('Taste',choice === 'jasmine' ? 'Jasmine tea' : 'Ginger and palm sugar');
      renderStory();
    }));
    if (tea) story.append(storyNote(tea === 'jasmine'
      ? 'A familiar cup, left warm on the side table.'
      : 'A little heat and sweetness before you open the door.'));
  }
  if (stop.id === 'teduh' && guided) {
    const screen = document.createElement('div');
    screen.id = 'divider-plan';
    screen.className = 'divider-plan';
    screen.setAttribute('aria-label','Preview of the timber screen');
    story.append(screen);
  }
}

function renderUI() {
  const stop = stops[index];
  $('panel').hidden = !stop;
  if (!stop) return;
  $('stop-type').textContent = handed ? 'Chapter complete' : stop.kind;
  $('stop-name').textContent = handed ? 'The room is yours.' : stop.area;
  $('stop-copy').textContent = handed
    ? 'A room for quiet evenings, a familiar cup and a softer arrival. Walk through once more and see what your choices made possible.'
    : stop.copy;
  $('advance').textContent = handed ? 'Return to your room' : stop.action;
  $('design').hidden = stop.id !== 'teduh' || handed;
  renderStory();
  refreshDesign();
  [...$('map').children].forEach((item,i) => {
    item.setAttribute('aria-current', String(i === index));
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
  keys.clear();
  setMap(false);
  const stop = stops[next];
  if (!stop) return;
  if (!guided) {
    const model = ['arrival','garden'].includes(stop.id) ? 'arrival' : stop.id === 'teduh' ? 'teduh' : 'gallery';
    $('advance').disabled = true;
    showNotice('Opening ' + stop.area + '…');
    try {
      await city.load(model);
      if (stop.id === 'worktable') await city.load('teduh');
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
  audio.setRoom(['arrival','garden','tea'].includes(stop.id));
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
  if (!coverOpen) {
    showNotice('The graphics connection paused. You can continue in the guided edition.');
    enableGuidedRecovery();
  } else {
    $('loader').textContent = 'The 3D city needs WebGL 2. You can read the guided edition below.';
  }
}

function advance() {
  if ($('advance').disabled || index < 0) return;
  if (handed) {
    handed = false;
    renderUI();
    return;
  }
  if (index < stops.length - 1) {
    if (stops[index].id === 'worktable') sense('Touch', finishes[design.finish].label);
    go(index + 1);
  } else {
    handed = true;
    comparison = false;
    audio.tick('chime');
    renderUI();
  }
}

for (const [i,stop] of stops.entries()) {
  const link = button('',() => go(i));
  const label = document.createElement('span');
  label.textContent = stop.area;
  link.append(label,document.createElement('span'));
  $('map').append(link);
}

$('enter').addEventListener('click', () => begin(false));
$('guided').addEventListener('click', () => begin(true));
$('sound').addEventListener('click', async () => {
  try {
    const on = await audio.toggle();
    $('sound').textContent = on ? 'Sound on' : 'Sound off';
    $('sound').setAttribute('aria-pressed', String(on));
    audio.setRoom(['arrival','garden','tea'].includes(stops[index]?.id));
  } catch {
    showNotice('Audio is unavailable on this device.');
  }
});
$('map-toggle').addEventListener('click',() => setMap($('map').hidden));
$('panel-toggle').addEventListener('click',() => showPanel($('panel-body').hidden));
$('advance').addEventListener('click',advance);
$('spacing').addEventListener('input',event => saveDesign({spacing:Number(event.target.value)}));
$('daylight').addEventListener('input',event => saveDesign({light:Number(event.target.value)}));
$('original').addEventListener('click',() => { comparison = true;refreshDesign(); });
$('current').addEventListener('click',() => { comparison = false;refreshDesign(); });

const motionKeys = new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
window.addEventListener('keydown',event => {
  if (coverOpen || event.altKey || event.metaKey || event.ctrlKey || event.target.closest?.('input,textarea,select')) return;
  if (event.code === 'KeyE' && !event.repeat) {
    if ($('panel-body').hidden) showPanel(true);
    else advance();
  }
  if (!guided && motionKeys.has(event.code)) {
    event.preventDefault();
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
    control.setPointerCapture(event.pointerId);
    keys.add(code);
  });
  for (const type of ['pointerup','pointercancel','lostpointercapture']) {
    control.addEventListener(type,() => keys.delete(code));
  }
}
canvas.addEventListener('pointerdown',event => {
  if (coverOpen || guided || event.button !== 0) return;
  canvas.focus({preventScroll:true});
  canvas.setPointerCapture(event.pointerId);
  drag = {id:event.pointerId,x:event.clientX,y:event.clientY};
});
canvas.addEventListener('pointermove', event => {
  if (drag?.id !== event.pointerId) return;
  city.turn(event.clientX - drag.x,event.clientY - drag.y);
  drag.x = event.clientX;
  drag.y = event.clientY;
});
canvas.addEventListener('lostpointercapture', () => { drag = null; });

function frame(now) {
  requestAnimationFrame(frame);
  const delta = Math.min(.08,(now - lastFrame) / 1000);
  lastFrame = now;
  if (!city || !loaded || guided || document.hidden) return;
  if (!coverOpen) {
    const forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
    const right = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
    const turn = Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft'));
    if (turn) city.turn(turn * delta * 320,0);
    if ((forward || right) && city.walk(right,forward,delta) && now - lastStep > 460) {
      audio.tick();
      lastStep = now;
    }
  }
  city.draw();
}

async function start() {
  try {
    city = createCity(canvas,sceneIssue);
    city.lookFrom([2.35,-37.7,1.74],[-.4,-27.8,1.97]);
    await city.load('arrival', event => {
      if (coverOpen && event.lengthComputable) $('loader').textContent = 'Opening the garden · ' + Math.round(event.loaded / event.total * 100) + '%';
    });
    loaded = true;
    $('enter').disabled = false;
    $('enter').textContent = 'Enter SECHA City';
    $('loader').textContent = 'Walk with the keyboard or touch controls.';
  } catch (error) {
    console.warn(error);
    $('enter').textContent = '3D city unavailable';
    sceneIssue();
  }
}
requestAnimationFrame(frame);
start();
