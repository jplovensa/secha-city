export function makeSound() {
  let context;
  let volume;
  let breeze;
  let enabled = false;

  function init() {
    context = new AudioContext();
    volume = context.createGain();
    volume.gain.value = 0;
    volume.connect(context.destination);
    const noise = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
    const data = noise.getChannelData(0);
    let prev = 0;
    for (let i = 0; i < data.length; i++) {
      prev = (prev + .023 * (Math.random() * 2 - 1)) / 1.023;
      data[i] = prev * 3;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    breeze = context.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    source.buffer = noise;
    source.loop = true;
    source.connect(filter).connect(breeze).connect(volume);
    breeze.gain.value = .46;
    source.start();
  }

  return {
    async toggle() {
      if (!context) init();
      await context.resume();
      enabled = !enabled;
      volume.gain.setTargetAtTime(enabled ? .17 : 0, context.currentTime, .12);
      return enabled;
    },
    setRoom(outdoors) {
      breeze?.gain.setTargetAtTime(outdoors ? .8 : .17, context.currentTime, .4);
    },
    tick(kind = 'step') {
      if (!enabled) return;
      const voice = context.createOscillator();
      const envelope = context.createGain();
      const start = context.currentTime;
      const chime = kind !== 'step';
      voice.type = chime ? 'sine' : 'triangle';
      voice.frequency.setValueAtTime(chime ? 520 : 100, start);
      voice.frequency.exponentialRampToValueAtTime(chime ? 348 : 46, start + .1);
      envelope.gain.setValueAtTime(.001, start);
      envelope.gain.exponentialRampToValueAtTime(chime ? .23 : .06, start + .019);
      envelope.gain.exponentialRampToValueAtTime(.001, start + (chime ? .3 : .13));
      voice.connect(envelope).connect(volume);
      voice.start(start);
      voice.stop(start + .34);
    }
  };
}
