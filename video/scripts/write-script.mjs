import {writeFileSync as write} from 'node:fs';
const chapters=[
 ['Fund once. Keep working.',[
  'An agent making a thousand paid API calls should not need a thousand payment transactions.',
  'AgentPay pairs reusable streams with deterministic payment guardrails from Chainlink C R E.'
 ]],
 ['Streaming payments',[
  'Fund one session, then reuse it across paid requests.',
  'The agent already has intelligence, but hallucinated payment instructions can waste money.',
  'Deterministic C R E rules guard the payment commitment, while the session stays reusable.'
 ]],
 ['Why CRE',[
  'Chainlink C R E brings external APIs and blockchain state into one workflow.',
  'It compares Coinbase and Chainlink U S D C prices, checks service health, and reads balances and stream state.',
  'Fixed budget, rate and session checks produce OPEN, CONTINUE, CLOSE, or DENY.',
  'A separate policy signer approves eligible actions. The contract verifies that signature before funding or closure.'
 ]],
 ['Real workflow execution',[
  'Here is the actual workflow source: an external H T T P fetch, followed by a Sepolia contract read.',
  'The contract checks the separate signer, exact intent, nonce and expiry. Unsigned and agent-forged approvals revert.'
 ]],
 ['Watch the stream work',[
  'This prompted demo tries a basic session and a premium request.',
  'A signed OPEN funds the stream. Ten successful API requests reuse that session.',
  'The healthy checkpoint returns CONTINUE.',
  'Then we inject an outage. C R E returns CLOSE. The contract accepts the signed closure.'
 ]],
 ['Settlement you can verify',[
  'Cancellation pays accrued earnings to the provider and returns the unused deposit to the agent.',
  'Receipts verify both consumed approvals and the recipient balance increase.',
  'The C L I also anchors decision records with onchain audit receipts.'
 ]],
 ['Budget stays in control',[
  'Next, the premium request exceeds the spending cap.',
  'C R E returns DENY. No funding approval is issued, and the premium session stays closed.'
 ]],
 ['Build with AgentPay',[
  'One funded stream. Reusable service access. Deterministic guardrails against avoidable spending.',
  'AgentPay: payment guardrails, built with Chainlink C R E. Explore the code and run the demo.'
 ]]
];
const out=chapters.map(([title,sentences],i)=>({id:`ch${String(i).padStart(2,'0')}`,title,sentences}));
const words=out.flatMap(c=>c.sentences).join(' ').split(/\s+/).length;
if(words>350)throw Error(`${words} words exceeds short-cut budget`);
write('video/chapters.json',JSON.stringify(out,null,2)+'\n');
write('video/script.md',`# AgentPay — short demo narration\n\n${words} words. Target 90–120 seconds.\n\n`+out.map(c=>`## ${c.id} — ${c.title}\n\n${c.sentences.join(' ')}\n`).join('\n'));
console.log(`${words} words`);
