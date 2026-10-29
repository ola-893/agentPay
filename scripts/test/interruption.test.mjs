import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

for (const [signal,code] of [['SIGINT',130],['SIGTERM',143]]) {
  test(`${signal} reaches the safe-boundary cleanup path and preserves interruption status`, async () => {
    const url = new URL('../../demo/agent/interruption.mjs',import.meta.url).href;
    const script = `import {watchInterruption} from ${JSON.stringify(url)};
      const watch=watchInterruption();
      process.send('ready');
      const timer=setInterval(()=>{try{watch.assertRunning();}catch(e){
        clearInterval(timer);watch.dispose();
        process.send({code:e.code,exitCode:e.exitCode,intListeners:process.listenerCount('SIGINT'),termListeners:process.listenerCount('SIGTERM')});
        process.exitCode=e.exitCode;process.disconnect();
      }},10);`;
    const child=spawn(process.execPath,['--input-type=module','-e',script],{stdio:['ignore','ignore','pipe','ipc']});
    try {
      assert.equal((await once(child,'message'))[0],'ready');
      const message=once(child,'message'),exited=once(child,'exit');
      child.kill(signal);
      assert.deepEqual((await message)[0],{code:'INTERRUPTED',exitCode:code,intListeners:0,termListeners:0});
      assert.equal((await exited)[0],code);
    } finally { if(child.exitCode===null)child.kill('SIGKILL'); }
  });
}
