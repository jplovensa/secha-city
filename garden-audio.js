// A short, optional comparison. The canopy attenuates the high rustle in the same breeze.
export function makeGardenAudio() {
  let context;
  let current;
  let breeze;

  function stop() {
    if (!current) return;
    current.stop();
    current = undefined;
  }

  async function play(underCanopy) {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return false;
    try {
      context ??= new Audio();
      await context.resume();
      stop();
      if (!breeze) {
        breeze = context.createBuffer(1,context.sampleRate * 4,context.sampleRate);
        const samples = breeze.getChannelData(0);
        let air = 0;
        for (let i = 0; i < samples.length; i++) {
          air = (.96 * air + .04 * (Math.random() * 2 - 1));
          const seconds = i / context.sampleRate;
          samples[i] = air * (.5 + .3 * Math.sin(seconds * 3.1) + .15 * Math.sin(seconds * 8.7));
        }
      }
      const source = context.createBufferSource();
      source.buffer = breeze;
      const shelter = context.createBiquadFilter();
      shelter.type = 'lowpass';
      shelter.frequency.value = underCanopy ? 320 : 2100;
      const volume = context.createGain();
      const start = context.currentTime;
      volume.gain.setValueAtTime(0,start);
      volume.gain.linearRampToValueAtTime(underCanopy ? .20 : .38,start + .35);
      volume.gain.linearRampToValueAtTime(0,start + 3.9);
      source.connect(shelter).connect(volume).connect(context.destination);
      source.onended = () => {
        source.disconnect();
        shelter.disconnect();
        volume.disconnect();
        if (current === source) current = undefined;
      };
      current = source;
      source.start();
      return true;
    } catch {
      return false;
    }
  }

  return { play, stop };
}
