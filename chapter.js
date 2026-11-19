export const defaults = Object.freeze({ spacing: 16, light: 55, finish: 'walnut' });

export const finishes = {
  walnut: { label: 'Smoked walnut', color: '#86563b', note: 'A deep grain with warmer contrast against the linen.' },
  oak: { label: 'Honey oak', color: '#b28a5c', note: 'An open grain that carries more light across the screen.' },
  umber: { label: 'Burnt umber', color: '#61422f', note: 'A darker edge that makes the slats read as shadow.' },
};

export const stops = [
  {
    id: 'arrival', area: 'Reception', kind: 'Arrival', eye: [-.25,-36.1,1.67], at: [-.4,-27.4,1.86],
    copy: 'You are making a room with two lives in mind. It should feel quiet when you come home and familiar when your mother comes to stay.',
    action: 'Take the garden path',
  },
  {
    id: 'garden', area: 'Under the almond trees', kind: 'Sound & scent', eye: [-7.62,-24.1,1.68], at: [-3.25,-16.12,2.34],
    copy: 'Josephine learnt renovation by watching her mother run family projects. Begin the way a maker does, by noticing what is already there.',
    action: 'Visit the worktable',
  },
  {
    id: 'worktable', area: 'The maker’s worktable', kind: 'Touch', eye: [-3.14,3.05,1.83], at: [-3.13,5.42,1.24],
    copy: 'Choose the timber you would reach for in the dark. Your sample will carry forward to the divider in Rumah Teduh.',
    action: 'Step into Ruang Bayang',
  },
  {
    id: 'wayang', area: 'Ruang Bayang', kind: 'Sight', eye: [7.55,3.58,1.83], at: [7.63,8.39,2.23],
    copy: 'Watch the wayang wall take shape in four passes. The carved EPS carries four museum-sourced puppet profiles around a central gunungan.',
    action: 'Bring a guest in',
  },
  {
    id: 'tea', area: 'A cup before the room', kind: 'Taste', eye: [-29.2,-17.2,1.68], at: [-29.4,-14.8,1.15],
    copy: 'Before you show her the room, there is a small ritual. What would you put on the table when your mother arrives?',
    action: 'Enter Rumah Teduh',
  },
  {
    id: 'teduh', area: 'Rumah Teduh', kind: 'Design the room', eye: [7.02,-13.52,1.74], at: [8.01,-8.97,1.65],
    copy: 'Change the distance between the timber slats and the light that falls through them. Minimise this panel to walk around and see how your choices feel.',
    action: 'Hand over the room',
  },
];

export const stages = [
  { label: 'Tracing', note: 'The profiles and corner work are set out at full size.' },
  { label: 'Blank EPS', note: 'The pattern is transferred to the foam before the cutwork.' },
  { label: 'Cutwork', note: 'The silhouettes and openings are cut into the panel.' },
  { label: 'Backlight', note: 'Warm light from the concealed LED picks out the edges and perforations.' },
];

export function updateDesign(previous, change) {
  const next = { ...previous, ...change };
  return {
    spacing: Math.round(Math.min(28, Math.max(12, Number.isFinite(next.spacing) ? next.spacing : defaults.spacing))),
    light: Math.round(Math.min(100, Math.max(0, Number.isFinite(next.light) ? next.light : defaults.light))),
    finish: Object.hasOwn(finishes, next.finish) ? next.finish : defaults.finish,
  };
}

export function dividerLayout(spacing) {
  const step = updateDesign(defaults, { spacing }).spacing / 100;
  const count = Math.floor(2.28 / step) + 1;
  return Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * step);
}
