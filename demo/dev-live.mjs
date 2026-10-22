import { spawn } from 'node:child_process';
const children=[spawn(process.execPath,['demo/run-server.mjs'],{stdio:'inherit'}),spawn('npm',['--prefix','vite-project','run','dev','--','--host','127.0.0.1','--port','5317','--strictPort'],{stdio:'inherit'})];
let stopping=false;
function stop(){if(stopping)return;stopping=true;for(const child of children)child.kill('SIGTERM');}
for(const child of children){child.once('error',stop);child.once('exit',()=>{if(!stopping)stop();});}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
