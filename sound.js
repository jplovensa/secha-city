export function makeVoice(player, baseURL) {
  let enabled = false;
  let activeKey = '';
  let clips = {};
  const storageKey = 'secha-city-voices-v1';
  const relativeURL = path => new URL(baseURL + path, document.baseURI).href;
  try { enabled = localStorage.getItem(storageKey) === 'on'; } catch { /* use session state */ }

  async function load() {
    try {
      const response = await fetch(relativeURL('voices.json'));
      if (!response.ok) return;
      const manifest = await response.json();
      if (manifest.provider !== 'heygen' || !manifest.clips) return;
      clips = Object.fromEntries(Object.entries(manifest.clips).filter(([,path]) =>
        typeof path === 'string' && /^voice-[a-z0-9-]+\.(mp3|wav)$/.test(path)));
    } catch {
      // The chapter's written dialogue is available without the audio pack.
    }
  }

  function setEnabled(value) {
    enabled = value;
    if (!value) stop();
    try { localStorage.setItem(storageKey,value ? 'on' : 'off'); } catch { /* use session state */ }
  }

  function stop() {
    player.pause();
    if (player.readyState > 0) player.currentTime = 0;
    activeKey = '';
  }

  async function play(key) {
    if (!enabled || !Object.hasOwn(clips,key)) return false;
    const source = relativeURL(clips[key]);
    if (player.src !== source) player.src = source;
    else if (player.readyState > 0) player.currentTime = 0;
    activeKey = key;
    try {
      await player.play();
      return true;
    } catch (error) {
      if (activeKey === key && error.name !== 'AbortError') throw error;
      return false;
    }
  }

  return { get enabled() { return enabled; }, setEnabled, play, stop, load,
    has: key => Object.hasOwn(clips,key),
    get available() { return Object.keys(clips).length > 0; },
    isPlaying: () => Boolean(activeKey && !player.paused && !player.ended) };
}
