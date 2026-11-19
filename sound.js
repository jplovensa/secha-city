export function makeVoice(player, baseURL) {
  let enabled=false;
  let activeKey='';
  let clips={};
  let utterance=null;
  const synth=window.speechSynthesis;
  const storageKey='secha-city-voices-v1';
  const relativeURL=path=>new URL(baseURL+path,document.baseURI).href;
  try { enabled=localStorage.getItem(storageKey)==='on'; } catch { /* use session state */ }

  async function load() {
    try {
      const response=await fetch(relativeURL('voices.json'));
      if(!response.ok) return;
      const manifest=await response.json();
      if(manifest.provider!=='heygen' || !manifest.clips) return;
      clips=Object.fromEntries(Object.entries(manifest.clips).filter(([,path])=>
        typeof path==='string' && /^voice-[a-z0-9-]+\.(mp3|wav)$/.test(path)));
    } catch {
      // Built-in speech remains available when the clip manifest cannot load.
    }
  }

  function setEnabled(value) {
    enabled=value;
    if(!value) stop();
    try { localStorage.setItem(storageKey,value?'on':'off'); } catch { /* use session state */ }
  }

  function stop() {
    const hadSpeech=Boolean(utterance);
    utterance=null;
    activeKey='';
    if(hadSpeech) synth.cancel();
    player.pause();
    if(player.readyState>0) player.currentTime=0;
  }

  const names={
    josephine:['Google UK English Female','Serena','Karen','Samantha'],
    dina:['Samantha','Google US English','Sandy (English (US))','Karen'],
    ibu:['Grandma (English (UK))','Moira','Google UK English Female','Samantha'],
  };

  function chooseVoice(actor) {
    const voices=synth.getVoices();
    for(const name of names[actor]??names.josephine) {
      const match=voices.find(voice=>voice.name===name);
      if(match) return match;
    }
    return voices.find(voice=>/^en[-_]/i.test(voice.lang) && voice.localService)
      ?? voices.find(voice=>/^en[-_]/i.test(voice.lang));
  }

  async function play(key,text,actor,onChange) {
    if(!enabled || !key) return false;
    stop();
    activeKey=key;
    if(Object.hasOwn(clips,key)) {
      const source=relativeURL(clips[key]);
      if(player.src!==source) player.src=source;
      try { await player.play();return true; }
      catch(error) { if(activeKey===key && error.name!=='AbortError') throw error;return false; }
    }
    if(!synth || !text) return false;
    const line=new SpeechSynthesisUtterance(text);
    const chosen=chooseVoice(actor);
    if(chosen) line.voice=chosen;
    line.lang=chosen?.lang??'en-GB';
    line.rate=actor==='ibu'?.88:actor==='dina'?1.01:.94;
    line.pitch=actor==='ibu'?.92:actor==='dina'?1.06:1;
    utterance=line;
    const clear=()=>{
      if(utterance!==line) return;
      utterance=null;
      activeKey='';
      onChange();
    };
    line.onend=clear;
    line.onerror=clear;
    line.onstart=onChange;
    synth.speak(line);
    return true;
  }

  return { get enabled(){return enabled;},setEnabled,play,stop,load,
    has:key=>Boolean(key && (synth || Object.hasOwn(clips,key))),
    get available(){return Boolean(synth)||Object.keys(clips).length>0;},
    isPlaying:()=>Boolean(utterance || (activeKey && !player.paused && !player.ended)) };
}
