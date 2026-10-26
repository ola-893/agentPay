import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const read=async f=>readFile(new URL('../'+f,import.meta.url));
const chapters=JSON.parse(await read('video/chapters.json'));
const timing=JSON.parse(await read('video/timing.json'));
const narration=await read('video/script.md');
const captions=(await read('video/agentpay-demo/compositions/captions.html')).toString();
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
assert.ok(timing.duration>=90&&timing.duration<=120);
assert.deepEqual(chapters.map(c=>c.sentences),timing.chapters.map(c=>c.sentences));
for(const c of chapters){
 const sidecar=JSON.parse(await read(`video/assets/voiceover/${c.id}.timing.json`));
 assert.deepEqual(sidecar.segments.map(s=>s.text),c.sentences);
 for(const s of c.sentences){assert.ok(narration.toString().includes(s));assert.ok(captions.includes(escape(s)));}
}
const record=JSON.parse(await read('video/verification.json'));
assert.ok(record.sourceManifest&&Object.keys(record.sourceManifest).length>20,'Missing verified render source manifest');
for(const [file,hash] of Object.entries(record.sourceManifest)){
 assert.equal(createHash('sha256').update(await read(file)).digest('hex'),hash,`Video changed since verified render: ${file}`);
}
assert.ok(Math.abs(record.durationSeconds-timing.duration)<.1);
console.log('Verified committed narration/timings/captions and source/audio hashes against the last measured video render. No new render performed.');
