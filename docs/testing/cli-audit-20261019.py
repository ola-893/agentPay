# Evidence generator; run only against a disposable clean clone.
# Usage: python3 docs/testing/cli-audit-20261019.py /absolute/path/to/disposable/clone
import subprocess,pathlib,json,os,datetime,shutil,sys
root=pathlib.Path(sys.argv[1]).resolve(); out=root/'.local/cli-audit/verification';out.mkdir(parents=True,exist_ok=True)
env=dict(os.environ,PATH=os.environ['PATH'],PRIVATE_KEY='',PRIVATE_KEY_1='',DEMO_PRIVATE_KEY='',ALLOW_SIMULATION_DEMO='false',GEMINI_API_KEY='',CLI_FIXTURE='')
env.pop('CRE_BIN',None);env.pop('CRE_ETH_PRIVATE_KEY',None)
rows=[];head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip();clean=not subprocess.check_output(['git','status','--porcelain'],cwd=root).strip()
def run(name,args,expected=0,kind='verification',extra=None):
 print(name+': '+' '.join(args),flush=True)
 try:
  p=subprocess.run(args,cwd=root,env=dict(env,**(extra or {})),stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=300)
  stdout,stderr,code=p.stdout,p.stderr,p.returncode
 except subprocess.TimeoutExpired as e: stdout,stderr,code=str(e.stdout or ''),str(e.stderr or ''),124
 stdout=stdout.replace(str(root),'<checkout>');stderr=stderr.replace(str(root),'<checkout>')
 number=len(rows)+1; stem=f'{number:02d}-{name}'
 (out/(stem+'.stdout.log')).write_text(stdout);(out/(stem+'.stderr.log')).write_text(stderr)
 row=dict(name=name,command=' '.join(args),kind=kind,expectedExit=expected,exitCode=code,passed=code==expected,stdout=stem+'.stdout.log',stderr=stem+'.stderr.log');rows.append(row)
 print('  exit '+str(code)+(' PASS' if code==expected else ' UNEXPECTED'),flush=True)
 if code!=expected:print((stdout+stderr)[-1200:],flush=True)
 return row
for name,args in [('install-root',['npm','ci','--no-audit','--no-fund']),('install-sdk',['npm','ci','--prefix','sdk','--no-audit','--no-fund']),('install-server',['npm','ci','--prefix','server','--no-audit','--no-fund']),('install-web',['npm','ci','--prefix','vite-project','--no-audit','--no-fund']),('install-cre',['bun','install','--frozen-lockfile','--cwd','cre/payment-guard']),('docs',['npm','run','docs:check']),('demo-types',['npx','tsc','--noEmit','--project','demo/tsconfig.json']),('tests',['npm','test']),('sdk-build',['npm','run','build:sdk']),('cre-types',['npm','run','typecheck:cre']),('web-build',['npm','run','build:web']),('lint',['npm','--prefix','vite-project','run','lint'])]:run(name,args)
for command in ['cre:simulate','cre:capture','cre:dry-run','cre:simulate:write','demo:check','demo:consumer','demo:provider','deploy:sepolia','deploy:guard','deploy:cre-demo']:run('help-'+command.replace(':','-'),['npm','run','--silent',command,'--','--help'])
for command in ['demo:check','demo:consumer','demo:provider','cre:simulate:write']:run('missing-'+command.replace(':','-'),['npm','run','--silent',command,'--','--json'],2,'failure-path')
run('unknown-flag',['npm','run','--silent','cre:simulate','--','--captur','--json'],2,'failure-path')
run('missing-cre',['npm','run','--silent','cre:simulate','--','--json'],1,'failure-path',{'CRE_BIN':'/definitely-missing-cre'})
run('bad-wallet',['npm','run','--silent','demo:check','--','--json'],2,'failure-path',{'PRIVATE_KEY_1':'malformed-test-wallet'})
run('missing-guard-key',['npm','run','--silent','deploy:guard'],1,'failure-path',{'CRE_FORWARDER_ADDRESS':'0x0000000000000000000000000000000000000011'})
run('missing-stream-key',['npm','run','--silent','deploy:sepolia'],1,'failure-path')
run('missing-demo-opt-in',['npm','run','--silent','deploy:cre-demo'],1,'failure-path')
config=root/'cre/payment-guard/config.staging.json';original=config.read_bytes();base=json.loads(original)
try:
 cases=[('six-vs-eighteen',dict(base,tokenDecimals=18)),('human-units',dict(base,request=dict(base['request'],amount='0.01'))),('wrong-token',dict(base,request=dict(base['request'],token='0x0000000000000000000000000000000000000011'))),('publish-in-read-runner',dict(base,publishReport=True))]
 for name,data in cases:
  config.write_text(json.dumps(data,indent=2)+'\n');run(name,['npm','run','--silent','cre:simulate','--','--json'],2,'failure-path')
 config.write_text('{bad json');run('malformed-config',['npm','run','--silent','cre:simulate','--','--json'],2,'failure-path')
finally:config.write_bytes(original)
for name,args in [('live-allow',['npm','run','--silent','cre:simulate','--','--json']),('live-deny',['npm','run','--silent','cre:simulate','--','--deny-budget','--json']),('live-dry-run',['npm','run','--silent','cre:dry-run','--','--recording-window','900','--json'])]:
 row=run(name,args,0,'live-read-only')
 if not row['passed']:run(name,args,0,'live-read-only-retry')
# Exercise the capture alias in this disposable checkout, then restore its tracked files.
files=[root/'docs/evidence/cre-allow.json',root/'docs/evidence/cre-allow.log',root/'vite-project/public/evidence/cre-allow.json'];originals=[p.read_bytes() for p in files]
backupRoot=root/'docs/evidence/backups/allow';before=set(backupRoot.iterdir()) if backupRoot.exists() else set()
try:
 row=run('live-capture',['npm','run','--silent','cre:capture','--','--json'],0,'live-read-only-capture')
 if row['passed']:
  for p in files: shutil.copy2(p,out/('captured-'+('public-' if 'public' in p.parts else '')+p.name))
  run('capture-integrity',['node','scripts/check-doc-evidence.mjs'])
finally:
 for p,b in zip(files,originals):p.write_bytes(b)
 if backupRoot.exists():
  for p in set(backupRoot.iterdir())-before:
   destination=out/'capture-backup'/p.name;destination.parent.mkdir(parents=True,exist_ok=True);shutil.move(p,destination)
last={r['name']:r for r in rows};cleanAfter=not subprocess.check_output(['git','status','--porcelain'],cwd=root).strip()
summary=dict(checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),commit=head,cleanBefore=clean,cleanAfter=cleanAfter,allRequiredPassed=all(r['passed'] for r in last.values()),toolVersions={'node':subprocess.check_output(['node','--version'],env=env,text=True).strip(),'npm':subprocess.check_output(['npm','--version'],env=env,text=True).strip(),'bun':subprocess.check_output(['bun','--version'],env=env,text=True).strip()},results=rows)
(out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print('SUMMARY '+json.dumps({k:summary[k] for k in ['commit','cleanBefore','cleanAfter','allRequiredPassed']}),flush=True)
raise SystemExit(0 if summary['allRequiredPassed'] and cleanAfter else 1)
