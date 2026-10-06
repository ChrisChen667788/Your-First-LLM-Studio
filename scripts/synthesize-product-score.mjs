#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';

const rate = 48000, seconds = 30;
const pcm = Buffer.alloc(rate * seconds * 4);
const roots = [73.416,73.416,58.270,87.307,65.406,73.416];
const arp = [0,7,12,15,19,15,12,7];
let noiseSeed = 321667;
const noise = () => { noiseSeed = (1664525 * noiseSeed + 1013904223) >>> 0; return noiseSeed / 2147483648 - 1; };
const osc = (frequency,time) => Math.sin(2 * Math.PI * frequency * time);
for (let i = 0; i < rate * seconds; i++) {
  const t = i / rate, section = Math.min(5,Math.floor(t / 5));
  const beat = t % .5, tick = t % .25, step = Math.floor(t / .25);
  const root = roots[section];
  const fade = Math.min(1,t / .8,(seconds - t) / 1.8);
  const bass = (.075 * osc(root,t) + .022 * osc(root * 2,t)) * Math.exp(-beat * 3);
  const pitch = root * 4 * Math.pow(2,arp[step % arp.length] / 12);
  const pluck = (osc(pitch,tick) + .22 * osc(pitch * 2.001,tick)) * Math.exp(-tick * 17) * .047;
  const kick = osc(49,beat) * Math.exp(-beat * 26) * .16;
  const hat = noise() * Math.exp(-tick * 100) * .012;
  const chord = (.019 * osc(root * 2,t) + .015 * osc(root * 2 * Math.pow(2,3/12),t) + .012 * osc(root * 3,t)) * (.65 + .35 * Math.sin(t * .7));
  const transition = t % 5;
  const whoosh = transition > 4.7 ? noise() * .06 * Math.sin((transition - 4.7) / .3 * Math.PI) : 0;
  const left = (bass + pluck + kick + hat + chord + whoosh) * fade;
  const right = (bass + pluck * .86 + kick + hat + chord * 1.12 + whoosh) * fade;
  pcm.writeInt16LE(Math.round(Math.max(-1,Math.min(1,left)) * 32767),i * 4);
  pcm.writeInt16LE(Math.round(Math.max(-1,Math.min(1,right)) * 32767),i * 4 + 2);
}
const header = Buffer.alloc(44);
header.write('RIFF'); header.writeUInt32LE(36 + pcm.length,4); header.write('WAVE',8);
header.write('fmt ',12); header.writeUInt32LE(16,16); header.writeUInt16LE(1,20); header.writeUInt16LE(2,22);
header.writeUInt32LE(rate,24); header.writeUInt32LE(rate * 4,28); header.writeUInt16LE(4,32); header.writeUInt16LE(16,34);
header.write('data',36); header.writeUInt32LE(pcm.length,40);
await writeFile(process.argv[2],Buffer.concat([header,pcm]));
console.log('Original 30-second stereo score synthesized at 48 kHz.');
