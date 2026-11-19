import { readFile, writeFile } from 'node:fs/promises';
import { encounters } from '../characters.js';
import { handoverCue } from '../voice-cues.js';

const voiceIds = {
  josephine: '776f9d2ff401499a8f1f2bcb4ca46004', // Joanna
  dina: '0989cd9eec9e485da0d7945fe142dfb9', // Yuki
  ibu: '836a2bfda0144ea5ac67740880cdf7a3', // Marilla
};
const speed = { josephine:.96,dina:1,ibu:.93 };
const apiKey = process.env.HEYGEN_API_KEY;
if (!apiKey) throw new Error('Set HEYGEN_API_KEY in the environment of this local command.');
const dir=new URL('../public/',import.meta.url);
const index=new URL('voices.json',dir);
const manifest=JSON.parse(await readFile(index,'utf8'));
const clips=Object.entries(encounters).map(([key,data]) => ({key,text:data.line,actor:data.actor}));
for (const spacing of [12,26]) {
  for (const light of [20,80]) clips.push({...handoverCue(spacing,light),actor:'ibu'});
}
const requested = process.argv.slice(2);
for (const {key,text,actor} of clips) {
  if ((requested.length && !requested.includes(key)) || Object.hasOwn(manifest.clips,key)) continue;
  const response=await fetch('https://api.heygen.com/v3/voices/speech',{
    method:'POST',headers:{'X-Api-Key':apiKey,'Content-Type':'application/json'},
    body:JSON.stringify({text,voice_id:voiceIds[actor],language:'en',engine:'heygen_voice',speed:speed[actor]}),
    signal:AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`HeyGen speech request for ${key} returned HTTP ${response.status}.`);
  const {data}=await response.json();
  const audio=new URL(data.audio_url);
  if (audio.protocol !== 'https:') throw new Error('HeyGen returned an invalid speech URL.');
  const file=await fetch(audio,{signal:AbortSignal.timeout(60000)});
  if (!file.ok) throw new Error(`HeyGen audio download for ${key} returned HTTP ${file.status}.`);
  const bytes=Buffer.from(await file.arrayBuffer());
  const wav=bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WAVE';
  const mp3=bytes.toString('ascii',0,3)==='ID3' || (bytes[0]===0xff && (bytes[1]&0xe0)===0xe0);
  if (!wav && !mp3) throw new Error(`Unexpected audio format for ${key}.`);
  const filename=`voice-${key}.${wav ? 'wav' : 'mp3'}`;
  await writeFile(new URL(filename,dir),bytes);
  manifest.clips[key]=filename;
  await writeFile(index,JSON.stringify(manifest,null,2)+'\n');
  console.log('Rendered',key);
}
