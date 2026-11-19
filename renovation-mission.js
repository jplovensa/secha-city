import { mission } from './renovation-data.js';

const find = (items, id) => items.find(item => item.id === id);
const rupiah = new Intl.NumberFormat('en-GB');
const dateLabel = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' });

export const money = value => 'IDR ' + rupiah.format(value);
export const dateText = iso => dateLabel.format(new Date(iso + 'T00:00:00Z'));

function dateAfter(days) {
  const date = new Date(mission.start + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0,10);
}

export function renovationPlan(scopeId, finishId, responseId) {
  const scope = find(mission.scopes,scopeId);
  const finish = find(mission.finishes,finishId);
  if (!scope || !finish) return null;
  const response = find(mission.responses,responseId);
  const deferred = response?.id === 'defer';
  const selected = response?.id === 'switch' ? mission.substitute : finish;
  const lead = selected.lead + (response && selected === finish ? mission.delay : 0);
  const fitStart = Math.max(scope.prep,lead);
  const fitEnd = fitStart + mission.install;
  const days = (deferred ? scope.prep : fitEnd) + mission.handover;
  const cost = scope.cost + (deferred ? 0 : selected.cost);
  const later = deferred ? finish.cost + mission.returnVisit : 0;
  const total = cost + later;
  const completion = dateAfter(days);
  return {
    scope, finish, selected, response, deferred, cost, later, total, days, completion,
    finishArrival: dateAfter(lead),
    fitStart: dateAfter(fitStart),
    fitEnd: dateAfter(fitEnd),
    prepEnd: dateAfter(scope.prep),
    high: total + Math.round(total * mission.contingency),
    onTime: completion <= mission.target,
  };
}

export function consultationBrief(plan) {
  const postponed = plan.deferred ? [
    'Outstanding decision · Approve a separate access window for screen fitting. Earliest illustrative fitting: ' + dateText(plan.fitStart) + '.',
    'Deferred allowance · ' + money(plan.later) + ' for the screen and return visit, included in the full budget range.',
  ] : [];
  return [
    'Studio+ consultation brief',
    'Room · ' + mission.room,
    'Goal · ' + mission.goals,
    'Keep · Existing bed, timber floor, headwall and wardrobe.',
    'Scope · ' + plan.scope.label + '. ' + plan.scope.detail,
    'Screen finish · ' + plan.selected.label + (plan.deferred ? ' (deferred until after move-in)' : ''),
    'Budget cap · ' + money(mission.budget),
    'Simulated budget range · ' + money(plan.total) + ' to ' + money(plan.high) + ' including up to 10% contingency.',
    'Target move-in · ' + dateText(mission.target),
    'Simulated room handover · ' + dateText(plan.completion) + (plan.onTime ? ' (meets target)' : ' (after target)'),
    'Supply decision · ' + plan.response.label + '.',
    ...postponed,
    'For consultation · SECHA checks measurements, fixing points, actual availability and pricing. Client approves the physical sample and final quote.',
    'Next action · ' + plan.response.next,
    'Prices and dates are illustrative simulation figures.',
  ].join('\n');
}
