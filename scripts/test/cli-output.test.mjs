import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {stripVTControlCharacters} from "node:util";
import {createAgentOutput} from "../../demo/agent/output.mjs";
import {eventOutput} from "../../demo/agent/events.mjs";
import {renderRecordedOutput} from "./fixtures/render-cli-output.mjs";

test("judge-facing output matches the recorded workflow snapshot", () => {
  const text = renderRecordedOutput();
  assert.equal(text,readFileSync(new URL("./snapshots/agent-output-80.txt",import.meta.url),"utf8"));
  for(const word of ["Chainlink CRE","PRICE SAFETY","STREAM ADMISSION","SPEND REVIEW","ALLOW","CONTINUE","CLOSE","DENY","0.0012","0.0088"])
    assert.ok(text.includes(word),word+" must stay visible");
  assert.doesNotMatch(text,/Config SHA256|raw deposit|health\/|cumulative receipt|report preview only/);
  assert.match(text,/Separate policy signer; contract verifies/);
  assert.match(text,/Audit receipt\s+CONFIRMED/);
  assert.match(text,/3 receipts confirmed here/);
  assert.ok(text.indexOf("closure requested") < text.indexOf("Cancellation mined"));
});

test("default output fits narrow and wide terminals, including NO_COLOR and JSON progress", () => {
  for(const columns of [44,80,120]) for(const options of [
    {stream:{isTTY:false,columns}},
    {stream:{isTTY:true,columns},env:{TERM:"xterm",NO_COLOR:""}},
    {stream:{isTTY:true,columns},json:true},
  ]) {
    const text=renderRecordedOutput({columns,...options});
    assert.doesNotMatch(text,/\x1b/);
    for(const line of text.split("\n")) assert.ok(line.length<=columns,`${columns} columns: ${line}`);
  }
});

test("colored terminal output preserves the same facts and never trusts model control sequences", () => {
  const plain=renderRecordedOutput();
  const colored=renderRecordedOutput({stream:{isTTY:true,columns:80}});
  assert.match(colored,/\x1b\[/);
  assert.equal(stripVTControlCharacters(colored),plain);
});

test("spinner shows elapsed time only on an interactive terminal and is disposed", context => {
  context.mock.timers.enable({apis:["setInterval","Date"]});
  const frames=[];
  const output=createAgentOutput({stream:{isTTY:true,columns:80,write:text=>frames.push(text)},
    env:{TERM:"xterm"},write:()=>{}});
  output.preflight();
  context.mock.timers.tick(1200);
  assert.ok(frames.some(frame=>frame.includes("1s")));
  output.dispose();
  const count=frames.length;
  context.mock.timers.tick(1200);
  assert.equal(frames.length,count);
  assert.ok(frames.at(-1).includes("\x1b[2K"));
});

test("an audit error before a structured callback is still visible", () => {
  const lines=[];
  createAgentOutput({write:line=>lines.push(line)}).auditProgress("Spend ERROR: REVIEW_UNAVAILABLE; risk 100/100");
  assert.match(lines.join("\n"),/ERROR: REVIEW_UNAVAILABLE/);
});

test("human spend-review formatting does not add duplicate machine events", () => {
  const events=[];
  const output=eventOutput(createAgentOutput({write:()=>{}}),(...args)=>events.push(args),{});
  const invocation={command:["cre","workflow","simulate","payment-guard","--target","spend-settings"],cwd:"cre",configPath:"config.json",transcriptPath:"transcript.log"};
  output.spendReview({phase:"start",invocation});
  assert.equal(events.length,0,"The existing auditor callback owns spend-review events");
  output.creInvocation(invocation);
  assert.equal(events.length,1);
  assert.equal(events[0][0],"step.start");
});
