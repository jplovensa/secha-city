export function handoverCue(spacing,light) {
  const tight = spacing <= 18;
  const low = light < 40;
  const privacy = tight ? 'I like how the tighter screen lets the light through in little pieces.'
    : 'I like how the wider screen lets me see the room before I step inside.';
  return {
    key:'end-' + (tight ? 'tight' : 'wide') + '-' + (low ? 'low' : 'high'),
    text:privacy + (low ? ' It feels quiet in here.' : ' There’s enough light for my tea.'),
  };
}
