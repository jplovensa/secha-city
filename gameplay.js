const requirements = {
  arrival: [],
  garden: ['breeze','pandan'],
  worktable: ['timber'],
  wayang: ['trace','blank','cut','light'],
  tea: ['tea'],
  teduh: ['tune','before','after'],
  library: ['quote'], commission: ['commission-before','commission-after'],
  courtyard:['mood'], opening:['guest'],
};

const labels = {
  breeze:'Notice the breeze', pandan:'Brush the pandan', timber:'Choose a timber finish',
  trace:'View the tracing', blank:'View the EPS blank', cut:'View the cutwork', light:'Switch on the backlight',
  quote:'Choose three items within budget', 'commission-before':'View Before', 'commission-after':'View Installed',
  mood:'Choose the opening light',guest:'Add a guest',
  tea:'Choose a drink', tune:'Change the spacing or light', before:'View Before', after:'View Your room',
};

export const stageActions = ['trace','blank','cut','light'];

export function newChapter() {
  const met = new Set();
  const choices = new Set();
  const cleared = new Set();
  return {
    met: id => met.has(id),
    talk: id => met.add(id),
    record: action => choices.add(action),
    forget: action => choices.delete(action),
    remaining(id) { return (requirements[id] ?? []).filter(key => !choices.has(key)).map(key => labels[key]); },
    finish(id) {
      if (!met.has(id) || this.remaining(id).length) return false;
      cleared.add(id);
      return true;
    },
    get cleared() { return cleared.size; },
  };
}
