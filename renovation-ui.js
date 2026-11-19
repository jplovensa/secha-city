import './renovation.css';
import { makeGardenAudio } from './garden-audio.js';
import { mission } from './renovation-data.js';
import { consultationBrief, dateText, money, renovationPlan } from './renovation-mission.js';

const saveKey = 'secha-city-renovation-v1';
const steps = ['arrival','walk','inspect','design','quote','delay','brief'];
const fresh = () => ({step:'arrival',scope:'',finish:'',response:''});

function readSave() {
  try {
    const data = JSON.parse(localStorage.getItem(saveKey));
    if (!steps.includes(data?.step)) return fresh();
    const scope = mission.scopes.find(item => item.id === data.scope)?.id ?? '';
    const finish = mission.finishes.find(item => item.id === data.finish)?.id ?? '';
    const response = mission.responses.find(item => item.id === data.response)?.id ?? '';
    let {step} = data;
    if (steps.indexOf(step) >= steps.indexOf('quote') && !renovationPlan(scope,finish)) step = 'design';
    if (step === 'brief' && !response) step = 'delay';
    return {step,scope,finish,response};
  } catch {
    return fresh();
  }
}

const span = (start,end) => dateText(start) + ' → ' + dateText(end);
const dayCount = days => days + (days === 1 ? ' day' : ' days');
const difference = (after,before,format) => after === before ? 'no change' :
  (after > before ? '+' : '−') + format(Math.abs(after - before));
const primary = (label,action) => `<button type="button" class="primary" data-action="${action}">${label}</button>`;
const secondary = (label,action) => `<button type="button" class="soft" data-action="${action}">${label}</button>`;

function choices(group,options,selected,caption) {
  return `<fieldset><legend>${caption}</legend>${options.map(item => `
    <label class="renovation-choice">
      <input type="radio" name="${group}" value="${item.id}" ${item.id === selected ? 'checked' : ''}>
      <span><b>${item.label}</b><small>${item.detail ?? item.note}</small></span>
    </label>`).join('')}</fieldset>`;
}

function schedule(plan) {
  const fitting = `<li><b>Fit screen${plan.deferred ? ' in a later visit' : ''}</b>
    <span>${plan.deferred ? 'Earliest ' + dateText(plan.fitStart) : span(plan.fitStart,plan.fitEnd)}</span></li>`;
  const handover = `<li><b>Check room and hand over</b><span>${dateText(plan.completion)}</span></li>`;
  return `<ol class="renovation-schedule">
    <li><b>Prep the room</b><span>${span(mission.start,plan.prepEnd)}</span></li>
    <li><b>Source the finish in parallel</b><span>Delivery ${dateText(plan.finishArrival)}</span></li>
    ${plan.deferred ? handover + fitting : fitting + handover}
  </ol>`;
}

function estimate(plan) {
  return `<dl class="renovation-estimate">
    <div><dt>${plan.scope.label}</dt><dd>${money(plan.scope.cost)}</dd></div>
    <div><dt>Screen in ${plan.selected.label.toLowerCase()}</dt><dd>${plan.deferred ? 'Deferred' : money(plan.selected.cost)}</dd></div>
    <div><dt>Cost before move-in</dt><dd>${money(plan.cost)}</dd></div>
    ${plan.deferred ? `<div><dt>Later screen and return visit</dt><dd>${money(plan.later)}</dd></div>` : ''}
    <div><dt>Budget range with contingency</dt><dd>${money(plan.total)}–${money(plan.high)}</dd></div>
    <div><dt>Handover · ${dayCount(plan.days)}</dt><dd>${dateText(plan.completion)}</dd></div>
  </dl>
  <p class="renovation-target" data-missed="${!plan.onTime}">${plan.onTime ? 'Meets move-in target' : 'Misses move-in target'} of ${dateText(mission.target)}.
  ${plan.high > mission.budget ? 'The high estimate exceeds the budget cap.' : 'Within the budget cap.'}</p>`;
}

export function makeRenovation(panel, marker, getCity, onMode, onResumeLabel) {
  const audio = makeGardenAudio();
  let state = readSave();
  let active = false;
  let visual = false;
  let roomReady = false;
  let loading = false;
  let approaching = false;
  let blocked = 0;
  let near = false;
  let soundRequest = 0;
  let collapsed = false;
  let before = false;
  let version = 0;

  function writeSave() {
    try { localStorage.setItem(saveKey,JSON.stringify(state)); }
    catch { /* Decisions still work for this session. */ }
    onResumeLabel(state.step !== 'arrival');
  }

  function aim(position) {
    getCity().lookFrom(position.eye,position.at);
  }

  function previewPlan() {
    if (!visual || !roomReady || steps.indexOf(state.step) < steps.indexOf('design')) return;
    const plan = renovationPlan(state.scope,state.finish,state.response);
    const scope = mission.scopes.find(item => item.id === state.scope);
    if (before || !scope) {
      getCity().clearDesign();
      return;
    }
    getCity().setDesign({
      spacing:scope.spacing,light:scope.light,showScreen:!plan?.deferred,
      finish:plan?.selected.id ?? mission.finishes[0].id,
    });
  }

  function render(focusHeading = false) {
    if (!active) return;
    const base = renovationPlan(state.scope,state.finish);
    const plan = renovationPlan(state.scope,state.finish,state.response);
    let title;
    let body;
    let footer;
    let owner;

    switch (state.step) {
      case 'arrival':
        title = 'Pandan Walk';
        body = `<p>Jo’s starting point is how a place feels when you arrive. Beside the pandan, the breeze rustles. Under the timber canopy, it softens. Take that sense of calm into the bedroom.</p>
          <div class="renovation-actions">${secondary('Hear the garden','garden')} ${secondary('Hear under the canopy','canopy')}</div>`;
        footer = primary('Go to Rumah Teduh','room');
        owner = 'Client · Visit the room and decide what should change.';
        break;
      case 'walk':
        title = 'Enter Rumah Teduh';
        body = loading ? '<p role="status">Opening the bedroom…</p>' : visual
          ? '<p>Walk straight through the portal to the bedroom marker, or use Walk to the room.</p>'
          : '<p>Enter the bedroom to read the site notes and see what you can keep.</p>';
        footer = loading ? '' : primary(near || !visual ? 'Inspect the bedroom' : 'Walk to the room','inspect');
        owner = 'Client · Look at the room before choosing your scope.';
        break;
      case 'inspect':
        title = 'Look around the bedroom';
        body = `<p>${mission.goals}</p><p>${mission.existing}</p>`;
        footer = primary('Choose scope and finish','design');
        owner = 'SECHA · Checks the room and identifies which elements can stay.';
        break;
      case 'design':
        title = 'Scope and finish';
        body = choices('scope',mission.scopes.map(item => ({...item,detail:item.detail + ' ' + money(item.cost)})),state.scope,'Choose the work') +
          choices('finish',mission.finishes.map(item => ({...item,note:item.note + ' ' + money(item.cost)})),state.finish,'Choose a screen finish') +
          `<p id="renovation-selection" aria-live="polite">${base ? money(base.total) + ' before contingency.' : 'Choose one scope and one finish to see your estimate.'}</p>`;
        footer = primary('Review quote and timeline','quote');
        owner = 'Client · Select the scope and finish. SECHA prices and schedules the work.';
        break;
      case 'quote':
        title = 'Review the plan';
        body = estimate(base) + schedule(base) + '<p>SECHA can start prep while the timber is sourced. Fitting needs both the room and the finish ready.</p>';
        footer = primary('Approve simulated plan','approve') + secondary('Edit choices','design');
        owner = 'Client · Approve the plan. SECHA books trades and places the order.';
        break;
      case 'delay': {
        title = 'The screen finish is delayed';
        const options = mission.responses.map(item => {
          const option = renovationPlan(state.scope,state.finish,item.id);
          const change = difference(option.cost,base.cost,money);
          const time = difference(option.days,base.days,dayCount);
          return {...item,detail:`Cost before move-in ${change} · Handover ${time}. ${item.dependency}`};
        });
        body = `<p>After approval, the supplier moved delivery of ${base.finish.label.toLowerCase()} back by ${mission.delay} days. SECHA has checked three ways forward.</p>
          ${choices('response',options,state.response,'Choose how to proceed')}
          <div id="renovation-outcome">${responseDetails(plan,base)}</div>`;
        footer = primary('Confirm and create brief','brief');
        owner = 'Client · Approve the trade-off. SECHA coordinates stock, trades and the schedule.';
        break;
      }
      case 'brief':
        title = 'Your Studio+ consultation brief';
        body = '<p>Take this to a Studio+ consultation so the designer can pick up from the decisions you’ve made.</p>' +
          '<pre id="renovation-brief" tabindex="0" aria-label="Consultation brief"></pre>';
        footer = primary('Copy brief','copy') + secondary('Download brief','download') +
          secondary('Compare delay options','delay') + secondary('Start a new plan','restart');
        owner = plan.response.next;
        break;
    }

    const stage = state.step === 'arrival' ? 'Arrival' : ['walk','inspect'].includes(state.step) ? 'Inspect' :
      state.step === 'design' ? 'Design' : state.step === 'quote' ? 'Approve' : state.step === 'delay' ? 'Resolve' : 'Consultation';
    const viewButton = visual && roomReady && !['walk','arrival','inspect'].includes(state.step)
      ? secondary(before ? 'Show planned room' : 'Show existing room','compare') : '';
    panel.dataset.step = state.step;
    panel.innerHTML = `<header class="renovation-header">
      <div><p class="eyebrow">Renovation mission · ${stage}</p><h2 id="renovation-title" tabindex="-1">${title}</h2></div>
      ${visual && state.step !== 'walk' ? `<button type="button" class="icon" data-action="collapse" aria-controls="renovation-content" aria-expanded="${!collapsed}" aria-label="${collapsed ? 'Open mission panel' : 'Minimise mission panel'}">${collapsed ? '+' : '−'}</button>` : ''}
    </header>
    <div id="renovation-content" ${collapsed ? 'hidden' : ''}>
      <div class="renovation-context"><b>${money(mission.budget)} cap</b><span>Move in by ${dateText(mission.target)}</span></div>
      <small class="renovation-illustrative">Prices and dates are illustrative.</small>
      ${body}
      ${viewButton ? `<div class="renovation-actions">${viewButton}</div>` : ''}
      <p class="renovation-owner"><b>Next action</b> ${owner}</p>
      <div class="renovation-footer">${footer}</div>
      <p class="renovation-feedback" role="status"></p>
    </div>`;
    if (state.step === 'brief') panel.querySelector('#renovation-brief').textContent = consultationBrief(plan);
    if (state.step === 'design') panel.querySelector('[data-action="quote"]').disabled = !base;
    if (state.step === 'delay') panel.querySelector('[data-action="brief"]').disabled = !state.response;
    if (focusHeading) {
      panel.scrollTop = 0;
      panel.querySelector('h2').focus({preventScroll:true});
    }
  }

  function responseDetails(plan,base) {
    if (!plan.response) return '<p>Choose an option to see the revised quote and schedule before confirming.</p>';
    return `<p class="renovation-change" role="status">Originally ${money(base.cost)} before move-in · ${dayCount(base.days)} to handover.
      Now ${money(plan.cost)} before move-in · ${dayCount(plan.days)} to handover.</p>` +
      estimate(plan) + schedule(plan) + `<p>${plan.response.next}</p>`;
  }

  async function loadRoom() {
    const request = ++version;
    loading = true;
    render();
    try {
      await getCity().load('teduh');
      if (!active || request !== version) return;
      roomReady = true;
      getCity().clearDesign();
      aim(state.step === 'walk' ? mission.positions.entrance : mission.positions.preview);
      previewPlan();
    } catch (error) {
      if (!active || request !== version) return;
      console.warn(error);
      recover();
      return;
    }
    loading = false;
    render(true);
  }

  function enter(useVisual) {
    active = true;
    visual = useVisual;
    collapsed = false;
    roomReady = near = before = false;
    onMode(visual);
    panel.hidden = false;
    if (visual) {
      getCity().showCast('renovation');
      getCity().clearDesign();
      getCity().setMood('afternoon');
      if (state.step === 'arrival') {
        aim(mission.positions.garden);
        getCity().load('teduh').catch(() => {});
      }
      else loadRoom();
    }
    render(true);
  }

  function recover() {
    if (!active || !visual) return;
    ++version;
    visual = loading = approaching = collapsed = false;
    audio.stop();
    marker.hidden = true;
    onMode(false);
    render(true);
    feedback('The 3D view is unavailable. You can finish the mission here.');
  }

  function leave() {
    ++version;
    active = loading = approaching = collapsed = false;
    audio.stop();
    panel.hidden = marker.hidden = true;
    getCity()?.clearDesign();
  }

  function changeStep(step) {
    state.step = step;
    collapsed = before = false;
    marker.hidden = true;
    writeSave();
    previewPlan();
    render(true);
  }

  function feedback(text) {
    const node = panel.querySelector('.renovation-feedback');
    if (node) node.textContent = text;
  }

  async function compareSound(under) {
    const request = ++soundRequest;
    if (visual) aim(mission.positions[under ? 'canopy' : 'garden']);
    const played = await audio.play(under);
    if (!active || state.step !== 'arrival' || request !== soundRequest) {
      if (!active || state.step !== 'arrival') audio.stop();
      return;
    }
    const description = under ? 'Under the canopy, the high rustle softens.' : 'In the garden, the leaf rustle is brighter.';
    feedback(played ? description : 'Audio unavailable. ' + description);
  }

  function inspect(assist) {
    if (!visual || near) {
      approaching = false;
      changeStep('inspect');
      return;
    }
    if (assist) {
      approaching = !approaching;
      blocked = 0;
      updateWalkAction();
    }
  }

  function updateWalkAction() {
    const action = panel.querySelector('[data-action="inspect"]');
    if (!action) return;
    const label = approaching ? 'Stop walking' : near ? 'Inspect the bedroom' : 'Walk to the room';
    if (action.textContent !== label) action.textContent = label;
  }

  function tick(delta) {
    if (!active || !visual || !roomReady || state.step !== 'walk') return;
    const city = getCity();
    const spot = mission.positions.inspection;
    near = city.distanceTo(spot) < 1.05;
    if (approaching && near) {
      inspect(false);
      return;
    }
    if (approaching) {
      const moved = city.approach(spot,delta);
      blocked = moved ? 0 : blocked + delta;
      if (blocked > .5) {
        approaching = false;
        feedback('Walk around the obstruction or use Return to the doorway.');
        if (!panel.querySelector('[data-action="doorway"]')) {
          panel.querySelector('.renovation-footer').insertAdjacentHTML('beforeend',secondary('Return to the doorway','doorway'));
        }
      }
    }
    const point = city.marker(spot);
    marker.hidden = !point.visible;
    if (point.visible) {
      marker.style.left = point.x + '%';
      marker.style.top = point.y + '%';
      marker.firstElementChild.textContent = 'Inspect bedroom';
    }
    updateWalkAction();
  }

  panel.addEventListener('change', event => {
    const {name,value} = event.target;
    if (name === 'response') {
      state.response = value;
      writeSave();
      const base = renovationPlan(state.scope,state.finish);
      panel.querySelector('#renovation-outcome').innerHTML = responseDetails(renovationPlan(state.scope,state.finish,value),base);
      panel.querySelector('[data-action="brief"]').disabled = false;
    } else if (name === 'scope' || name === 'finish') {
      state[name] = value;
      writeSave();
      const plan = renovationPlan(state.scope,state.finish);
      panel.querySelector('#renovation-selection').textContent = plan ? money(plan.total) + ' before contingency.' : 'Choose one scope and one finish to see your estimate.';
      panel.querySelector('[data-action="quote"]').disabled = !plan;
    }
    before = false;
    const compare = panel.querySelector('[data-action="compare"]');
    if (compare) compare.textContent = 'Show existing room';
    previewPlan();
  });

  panel.addEventListener('click', async event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    switch (action) {
      case 'garden':
      case 'canopy':
        compareSound(action === 'canopy');
        break;
      case 'room':
        audio.stop();
        changeStep('walk');
        if (visual) loadRoom();
        break;
      case 'inspect':
        inspect(true);
        break;
      case 'doorway':
        aim(mission.positions.entrance);
        render(true);
        break;
      case 'design':
        state.response = '';
        if (visual) aim(mission.positions.preview);
        changeStep('design');
        break;
      case 'quote':
        changeStep('quote');
        break;
      case 'approve':
      case 'delay':
        changeStep('delay');
        break;
      case 'brief':
        changeStep('brief');
        break;
      case 'compare':
        before = !before;
        aim(mission.positions.preview);
        previewPlan();
        event.target.textContent = before ? 'Show planned room' : 'Show existing room';
        break;
      case 'collapse':
        collapsed = !collapsed;
        render();
        panel.querySelector('[data-action="collapse"]').focus();
        break;
      case 'copy': {
        const content = panel.querySelector('#renovation-brief');
        try {
          await navigator.clipboard.writeText(content.textContent);
          feedback('Brief copied.');
        } catch {
          const range = document.createRange();
          range.selectNodeContents(content);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          feedback('Brief selected. Use your device’s copy command or download it.');
        }
        break;
      }
      case 'download': {
        const file = new Blob([panel.querySelector('#renovation-brief').textContent + '\n'], {type:'text/plain;charset=utf-8'});
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'studio-plus-rumah-teduh-brief.txt';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url),1000);
        feedback('Brief downloaded.');
        break;
      }
      case 'restart':
        state = fresh();
        changeStep('arrival');
        if (visual) {
          getCity().clearDesign();
          aim(mission.positions.garden);
        }
        break;
    }
  });

  onResumeLabel(state.step !== 'arrival');
  return {enter,leave,recover,tick,
    stopApproach() {
      approaching = false;
      if (state.step === 'walk') updateWalkAction();
    },
    interact() {
      if (state.step === 'walk' && !loading) inspect(false);
    },
    get active() { return active; },
    get canWalk() { return visual && !loading; },
  };
}
