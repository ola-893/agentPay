import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import d from '../data.js';
const timing=JSON.parse(fs.readFileSync('video/timing.json'));
assert(timing.duration<=300);
assert.equal(createHash('sha256').update(fs.readFileSync(`${d.source.run}/events.ndjson`)).digest('hex'),d.source.sha256);
assert.equal(BigInt(d.end.fundedRaw),BigInt(d.end.earnedRaw)+BigInt(d.end.refundedRaw));
assert.equal(BigInt(d.end.balances.after.recipientBalanceRaw)-BigInt(d.end.balances.before.recipientBalanceRaw),BigInt(d.end.earnedRaw));
for(const [i,ch]of timing.chapters.entries()){
 assert(i===0||Math.abs(ch.start-timing.chapters[i-1].start-timing.chapters[i-1].duration)<.001);
 assert(ch.segments.every((s,n)=>s.start>=0&&s.end>s.start&&s.end<=ch.duration+.03&&(n===0||s.start>=ch.segments[n-1].end)));
 const a=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','json',`video/assets/voiceover/${ch.id}.flac`]));
 assert(Math.abs(Number(a.format.duration)-ch.duration)<1/30+.001);
}
for(const file of ['index.html',...timing.chapters.map(ch=>`compositions/${ch.id}.html`),'compositions/captions.html']){
 const html=fs.readFileSync(`video/agentpay-demo/${file}`,'utf8');
 assert(!html.includes('/Users/'),'local path on screen');
 assert(!/https?:\/\/[^"']+\.(?:js|woff2)/.test(html),'render-time remote asset');
 assert(!/sk-[A-Za-z0-9]{20,}|PRIVATE KEY|\.env content/.test(html),'secret-like screen content');
}
if(fs.existsSync('video/out/agentpay-demo.mp4')){
 const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json','video/out/agentpay-demo.mp4']));
 const v=probe.streams.find(s=>s.codec_type==='video'),a=probe.streams.find(s=>s.codec_type==='audio');
 assert.equal(v.codec_name,'h264');assert.equal(v.width,1920);assert.equal(v.height,1080);assert.equal(v.r_frame_rate,'30/1');assert.equal(a.codec_name,'aac');assert(Number(probe.format.duration)<=300);assert(Math.abs(Number(probe.format.duration)-timing.duration)<.1);
 fs.writeFileSync('video/out/ffprobe.json',JSON.stringify(probe,null,2)+'\n');
}
console.log('Verified evidence hash, unit conservation, recipient delta, narration/caption bounds, local assets and available output codecs.');
