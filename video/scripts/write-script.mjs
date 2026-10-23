import d from '../data.js';
import {writeFileSync as write} from 'node:fs';
const v=d.display;
const chapters=[
 ['Hook',[
  'An agent making a thousand paid API calls should not need a thousand payment transactions.',
  'AgentPay combines a funded stream with Chainlink C R E supervision.'
 ]],
 ['The payment problem',[
  'Paying separately for every request couples useful work to repeated blockchain transactions.',
  'A funded stream separates the request loop from the payment lifecycle.',
  'The contract accrues earnings with time; it does not meter API calls.',
  'But that creates another problem: who decides when paying should start, continue, or stop?',
  'If a provider becomes unavailable while time keeps passing, funds can keep accruing.',
  'The stream handles settlement. The workflow supplies a decision about whether the session should remain open.'
 ]],
 ['Architecture',[
  'Follow the agent, its wallet, the escrow, and the paid service.',
  'The wallet funds escrow, then service requests reuse the active session.',
  'C R E connects a separate supervision loop to that payment lifecycle.',
  'Coinbase supplies an external U S D C quote. Chainlink supplies the Sepolia U S D C dollar feed.',
  'The supervisor also fetches service health and reads token balances and stream state on Sepolia.',
  'Those observations produce OPEN, CONTINUE, CLOSE, or DENY.',
  'The wallet C L I validates the local results before it signs.',
  'On the C R E network, a deployed workflow runs on a decentralized oracle network.',
  'This demonstration uses the local C L I simulator. It has no D O N authorization.'
 ]],
 ['Inside CRE',[
  'The H T T P capability fetches Coinbase. The E V M capability reads the Sepolia feed.',
  `This recording observed Coinbase at ${v.coinbase} dollars and Chainlink at ${v.chainlink} dollars.`,
  `Both the peg and source disagreement limits are ${v.pegBps} basis points.`,
  `The feed was ${v.feedAge} seconds old against a limit of ${v.feedLimit} seconds.`,
  'Fresh inputs can change the decision.',
  'Admission checks bind service health, the payment token, its decimals, balance, budget, and rate.',
  `The deposit is ${v.funded} test U S D C, below a ${v.cap} cap.`,
  `The actual rate is ${v.rate} U S D C per second, below the ${v.maxRate} maximum.`,
  'At checkpoints, the supervisor checks stream identity, accrued funds, availability, and failure counts.',
  'The saved simulator log shows compilation, the external quote, the chain observation, and the resulting approval.'
 ]],
 ['Recorded payment run',[
  'Now follow the recorded funded run. Waiting time is condensed.',
  'The agent is explicitly prompted to try an in-budget session and an over-budget session.',
  'After approval, the wallet signs a token allowance and opens the funded stream.',
  `The service records ${v.calls} successful requests, reusing the same stream.`,
  'A healthy checkpoint returns CONTINUE. Requests reuse the stream.',
  `The demo injects H T T P ${v.httpStatus} responses and records ${v.failures} failures.`,
  'C R E returns CLOSE. The wallet then signs cancellation; the contract settles elapsed earnings.',
  `${v.funded} test U S D C splits into ${v.earned} earned and ${v.refund} refunded.`,
  'This card comes from saved R P C verification, not an explorer screenshot.',
  `The premium quote is ${v.premium} against the ${v.cap} cap. DENY prevents that session opening.`,
  `The capture also contains ${v.auditCount} separate audit receipts. These are additional transactions.`,
  'No premium payment is signed; an audit receipt still follows the block.'
 ]],
 ['Dashboard replay',[
  'The dashboard reads the same saved event stream used to build this video.',
  'It displays decisions, request counters, transaction links, and the earnings and refund split.',
  'The interface computes no policy decision.',
  'A real browser recording belongs here. Capture access was unavailable, so this draft shows a labeled placeholder.'
 ]],
 ['Trust boundary',[
  'Be precise about enforcement: local C R E simulation proposes a decision; the wallet C L I gates signing.',
  'The stream contract does not verify C R E results. A different wallet client can bypass that gate.',
  'Localhost health snapshots and per-run configurations are demonstration shortcuts, not independent proof of service quality.',
  'This uses valueless test U S D C, is not a full x four oh two implementation, and is unaudited.',
  'A production path needs a deployed workflow, a public health endpoint, trigger payloads, and authenticated reports.',
  'A forwarder and onchain consumer would move authorization into the contract path. That is future work for this stream demo.'
 ]],
 ['Reproduce it',[
  'Follow the documented prerequisites.',
  'Start with the read-only C R E scenarios, then the preview agent demo.',
  'Use the funded command only with a prepared Sepolia wallet.',
  'Inspect the linked transactions. Built with Chainlink C R E.'
 ]]
];
const out=chapters.map(([title,sentences],i)=>({id:`ch${String(i).padStart(2,'0')}`,title,sentences}));
const words=out.flatMap(c=>c.sentences).join(' ').split(/\s+/).length;
if(words>700)throw Error(`${words} words`);
write('video/chapters.json',JSON.stringify(out,null,2)+'\n');
write('video/script.md',`# AgentPay narration\n\n${words} words. Spoken initialisms expanded for local pronunciation.\n\n`+out.map(c=>`## ${c.id} — ${c.title}\n\n${c.sentences.join(' ')}\n`).join('\n'));
console.log(`${words} words`);
