import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import d from '../data.js';
const timing=JSON.parse(fs.readFileSync('video/timing.json'));
const time=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
const chapters=timing.chapters.map(c=>`${time(c.start)} ${c.title}`).join('\n');
const text=`# AgentPay: funded streams supervised by Chainlink CRE (demo draft)

A narrated walkthrough of local CRE simulation, time-accruing escrow, a recorded
Circle test-USDC stream on Ethereum Sepolia, outage-driven cancellation, and premium denial.

${chapters}

Repository: https://github.com/ola-893/agentPay
Source and reproduction: https://github.com/ola-893/agentPay/tree/main/video
Recorded run: https://github.com/ola-893/agentPay/tree/main/${d.source.run}
RPC verification: https://github.com/ola-893/agentPay/blob/main/${d.source.rpc}

Transactions:
${d.transactions.map(t=>`- ${t.kind}: ${t.url}`).join('\n')}

Reproduce (after the README prerequisites):
\`\`\`sh
npm run cre:simulate
npm run cre:simulate -- --deny-budget
npm run --silent demo:agent
# Requires the configured Sepolia wallet, gas, and test USDC:
npm run --silent demo:agent -- --pay
\`\`\`

Disclosures: CRE runs in the local CLI simulator, with no DON authentication.
The wallet CLI validates decisions before signing; the stream contract does not
verify CRE results, and another client can bypass that gate. Localhost health and
per-run configuration are shortcuts. The prompted plan tries one in-budget and one
over-budget session. The stream accrues by time, not by successful API-call count.
This is valueless test USDC, not full x402, and an unaudited prototype. Extra audit
transactions are distinct from stream lifecycle transactions; no gas-savings figure
is claimed. Logs/stdout are labeled historical replays. RPC evidence is historical.
The dashboard chapter is an explicit placeholder because real browser capture was
blocked. Replace it and regenerate that chapter's final narration before submission.
No live CLI footage was available. Narration is local synthetic speech.

Music: “Dreams Become Real” — Kevin MacLeod (incompetech.com).
Licensed under Creative Commons Attribution 4.0: https://creativecommons.org/licenses/by/4.0/
Source: https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1500027
Music trimmed, normalized and ducked under narration. Video/edit/narration are AgentPay's.

Built with Chainlink CRE.
`;
fs.writeFileSync('video/out/description.md',text);
fs.writeFileSync('video/description.md',text);
const times=[2,16,42,83,179,208,225,264];
fs.mkdirSync('video/out/frames',{recursive:true});
for(const [i,t]of times.entries())execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss',String(t),'-i','video/out/agentpay-demo.mp4','-frames:v','1',`video/out/frames/ch${i}.png`]);
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i','video/out/frames/ch2.png','-frames:v','1','video/out/thumbnail.png']);
const inputs=times.flatMap((_,i)=>['-i',`video/out/frames/ch${i}.png`]);
const scales=times.map((_,i)=>`[${i}:v]scale=640:360[v${i}]`).join(';');
const layout='0_0|640_0|0_360|640_360|0_720|640_720|0_1080|640_1080';
fs.mkdirSync('docs/evidence',{recursive:true});
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...inputs,'-filter_complex',`${scales};${times.map((_,i)=>`[v${i}]`).join('')}xstack=inputs=8:layout=${layout}[out]`,'-map','[out]','-frames:v','1','docs/evidence/video-contact-sheet.png']);
console.log('Wrote MP4-derived thumbnail, eight-chapter contact sheet, and public description.');
