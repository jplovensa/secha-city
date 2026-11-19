import { finishes } from './chapter.js';

export const mission = {
  room: 'Rumah Teduh bedroom',
  budget: 30_000_000,
  start: '2027-03-01',
  target: '2027-03-16',
  goals: 'A quiet bedroom for everyday use and overnight visits from Ibu. Keep daylight, add privacy around the bed, and keep the route from the doorway clear.',
  existing: 'Keep the bed, timber floor, headwall and wardrobe. The proposed screen sits beside the bed, clear of the doorway. SECHA will verify the fixing points and clearance on site.',
  scopes: [
    { id: 'refresh', label: 'Privacy & paint', detail: 'Prep and repaint the room. Install a more open timber screen (24 cm spacing). Keep the bedside lighting.', cost: 11_000_000, prep: 5, spacing: 24, light: 55 },
    { id: 'layered', label: 'Privacy & bedside lighting', detail: 'Prep and repaint, add shielded bedside lighting and install a denser timber screen (14 cm spacing).', cost: 18_000_000, prep: 8, spacing: 14, light: 30 },
  ],
  finishes: [
    { id: 'oak', ...finishes.oak, cost: 6_000_000, lead: 7 },
    { id: 'walnut', ...finishes.walnut, cost: 9_000_000, lead: 11 },
  ],
  substitute: { id: 'umber', ...finishes.umber, cost: 7_500_000, lead: 3 },
  delay: 10,
  install: 2,
  handover: 1,
  returnVisit: 1_500_000,
  contingency: .10,
  responses: [
    { id: 'wait', label: 'Wait for the selected finish', dependency: 'SECHA holds the screen fitting and room handover until the original finish arrives.', next: 'SECHA confirms the revised delivery and rebooks the installer.' },
    { id: 'switch', label: 'Use available burnt umber', dependency: 'The client signs off the substitute in this simulation. SECHA then reserves local stock and books fitting after room prep.', next: 'SECHA reserves the substitute and confirms the fitting date.' },
    { id: 'defer', label: 'Fit the screen after move-in', dependency: 'Room handover follows prep. Screen fitting needs a separate access window after the original finish arrives.', next: 'SECHA hands over the room and proposes a return visit for the client to approve.' },
  ],
  positions: {
    garden: { eye: [-7.62,-24.1,1.68], at: [-3.25,-16.12,2.34] },
    canopy: { eye: [-.25,-29.8,1.79], at: [-.20,-24.2,2.25] },
    entrance: { eye: [-.95,-10.55,1.93], at: [3.65,-10.55,1.88] },
    inspection: [3.15,.32,10.55],
    preview: { eye: [8.75,-13.25,1.95], at: [9.62,-9.4,1.52] },
  },
};
