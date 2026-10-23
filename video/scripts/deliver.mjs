import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import d from '../data.js';
const timing=JSON.parse(fs.readFileSync('video/timing.json'));
const time=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
const chapters=timing.chapters.map(c=>`${time(c.start)} ${c.title}`).join('\n');
const text=`# AgentPay — fund once, keep working | Chainlink CRE demo

Fund one session, reuse it across paid API requests, and let Chainlink CRE connect
market observations, service health and onchain state to payment decisions.
Watch the recorded stream open, continue, close on an injected outage, settle
earnings and refund, then block an over-budget premium request.

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

Demo context: recorded Sepolia run; CRE executes locally and the wallet CLI applies
the signing policy. The agent is prompted to try basic and premium sessions.
The stream accrues with time. Onchain audit receipts are separate transactions.
Full architecture and execution evidence are linked above. Narration is synthetic.

Music: “Dreams Become Real” — Kevin MacLeod (incompetech.com).
Licensed under Creative Commons Attribution 4.0: https://creativecommons.org/licenses/by/4.0/
Source: https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1500027
Music trimmed, normalized and ducked under narration. Video/edit/narration are AgentPay's.

Built with Chainlink CRE.
`;
fs.writeFileSync('video/out/description.md',text);
fs.writeFileSync('video/description.md',text);
const times=timing.chapters.map(ch=>ch.start+ch.duration/2);
fs.mkdirSync('video/out/frames',{recursive:true});
for(const [i,t]of times.entries())execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss',String(t),'-i','video/out/agentpay-demo.mp4','-frames:v','1',`video/out/frames/ch${i}.png`]);
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i','video/out/frames/ch2.png','-frames:v','1','video/out/thumbnail.png']);
const inputs=times.flatMap((_,i)=>['-i',`video/out/frames/ch${i}.png`]);
const scales=times.map((_,i)=>`[${i}:v]scale=640:360[v${i}]`).join(';');
const layout='0_0|640_0|0_360|640_360|0_720|640_720|0_1080|640_1080';
fs.mkdirSync('docs/evidence',{recursive:true});
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...inputs,'-filter_complex',`${scales};${times.map((_,i)=>`[v${i}]`).join('')}xstack=inputs=8:layout=${layout}[out]`,'-map','[out]','-frames:v','1','docs/evidence/video-contact-sheet.png']);
console.log('Wrote MP4-derived thumbnail, eight-chapter contact sheet, and public description.');
