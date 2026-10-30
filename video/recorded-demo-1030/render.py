"""Render the120-second edit from source footage and the explicit edit list."""
from concurrent.futures import ThreadPoolExecutor
import hashlib, json, pathlib, re, subprocess

here = pathlib.Path(__file__).resolve().parent
root = here.parents[1]
work = root / '.local/recorded-demo-1030'
out = root / 'video/out/recorded-demo-1030'
out.mkdir(parents=True, exist_ok=True)
segments = work / 'segments'
segments.mkdir(exist_ok=True)
spec = json.loads((here/'edit.json').read_text())
source = pathlib.Path(spec['source'])
assert source.exists()
fps=spec['fps']
assert sum(c['duration'] for c in spec['chapters']) == 120
jobs=[]
cursor=0
for ch in spec['chapters']:
    assert ch['start']==cursor
    assert abs(sum((v['out']-v['in'])/v['speed'] for v in ch['clips'])-ch['duration'])<1e-8
    cursor+=ch['duration']
    for i,clip in enumerate(ch['clips']):
        jobs.append((ch,i,clip))

def run(args):
    return subprocess.run(args,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)

def render(job):
    ch,i,clip=job
    path=segments/f'{ch["id"]}-{i}.mp4'
    duration=(clip['out']-clip['in'])/clip['speed']
    frame_count=round(duration*fps)
    command=['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y','-threads','3','-ss',str(clip['in']),'-t',str(clip['out']-clip['in']),'-i',str(source)]
    temporal=f'setpts=(PTS-STARTPTS)/{clip["speed"]},fps={fps},tpad=stop_mode=clone:stop_duration=1'
    if ch['layout']=='cli':
        panel=work/f'panel-{ch["id"]}.png'
        command+=['-loop','1','-framerate',str(fps),'-i',str(panel)]
        graph=f'[0:v]crop=1250:940:2030:420,{temporal},scale=1200:902:flags=lanczos,setsar=1[clip];[1:v][clip]overlay=650:110:shortest=1,format=yuv420p[out]'
    else:
        x,y,w,h=clip['crop']
        graph=f'[0:v]crop={w}:{h}:{x}:{y},{temporal},scale=1920:1080:flags=lanczos,setsar=1,format=yuv420p[out]'
    command+=['-filter_complex_threads','2','-filter_complex',graph,'-map','[out]','-an','-frames:v',str(frame_count),'-r',str(fps),'-c:v','libx264','-preset','fast','-crf','18','-threads','3','-pix_fmt','yuv420p','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-video_track_timescale','15360',str(path)]
    stamp=path.with_suffix('.sha256')
    signature=hashlib.sha256(json.dumps({'command':command,'source_size':source.stat().st_size,'source_mtime':source.stat().st_mtime_ns,'panel':hashlib.sha256(panel.read_bytes()).hexdigest() if ch['layout']=='cli' else None}).encode()).hexdigest()
    if not path.exists() or not stamp.exists() or stamp.read_text()!=signature:
        try:run(command)
        except subprocess.CalledProcessError as e:raise RuntimeError(e.stderr) from e
        stamp.write_text(signature)
    probe=json.loads(run(['ffprobe','-v','error','-show_entries','stream=nb_frames,duration','-of','json',str(path)]).stdout)
    assert int(probe['streams'][0]['nb_frames'])==frame_count,(path,probe)
    print(f'{path.name}: {duration:.2f}s, {clip["speed"]}x, {frame_count}frames',flush=True)
    return path

with ThreadPoolExecutor(max_workers=2) as pool:
    paths=list(pool.map(render,jobs))
concat=work/'concat.txt'
concat.write_text(''.join(f"file '{p}'\n" for p in paths))

raw=work/'narration-raw.wav'
measured=run(['ffmpeg','-nostdin','-hide_banner','-i',str(raw),'-af','loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','-'])
levels=json.loads(re.search(r'\{\s*"input_i".*?\}',measured.stderr,re.S).group())
(work/'loudness-input.json').write_text(json.dumps(levels,indent=2)+'\n')
normalization='loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={input_i}:measured_TP={input_tp}:measured_LRA={input_lra}:measured_thresh={input_thresh}:offset={target_offset}:linear=true'.format(**levels)
voice=out/'AgentPay-voiceover.wav'
run(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y','-i',str(raw),'-af',normalization,'-ar','48000','-ac','1','-t','120',str(voice)])

def srt_time(value):
    ms=round(value*1000)
    return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
timings=json.loads((work/'voice-timing.json').read_text())
subtitle_lines=[]
for timing in timings:
    for sentence in timing['sentences']:
        line=sentence['text'].replace('C R E','CRE').replace('U S D C','USDC')
        subtitle_lines.append(f'{len(subtitle_lines)+1}\n{srt_time(sentence["start"])} --> {srt_time(sentence["end"])}\n{line}\n')
srt=out/'AgentPay-2min.srt'
srt.write_text('\n'.join(subtitle_lines))
metadata=work/'chapters.ffmeta'
metadata.write_text(';FFMETADATA1\n'+''.join(f'[CHAPTER]\nTIMEBASE=1/1000\nSTART={ch["start"]*1000}\nEND={(ch["start"]+ch["duration"])*1000}\ntitle={ch["title"].replace(chr(10)," ")}\n' for ch in spec['chapters']))
final=out/'AgentPay-2min.mp4'
run(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(concat),'-i',str(voice),'-map','0:v:0','-map','1:a:0','-map_metadata','-1','-map_chapters','-1','-c:v','copy','-c:a','aac','-b:a','192k','-metadata','title=AgentPay - Deterministic payment guardrails with Chainlink CRE','-metadata:s:a:0','language=eng','-t','120','-movflags','+faststart',str(final)])
probe=json.loads(run(['ffprobe','-v','error','-show_format','-show_streams','-show_chapters','-of','json',str(final)]).stdout)
video=next(s for s in probe['streams'] if s['codec_type']=='video')
assert video['width']==1920 and video['height']==1080
assert int(video['nb_frames'])==3600
assert float(video['duration'])==120
assert abs(float(probe['format']['duration'])-120)<.001
run(['ffmpeg','-nostdin','-v','error','-i',str(final),'-map','0:v','-map','0:a','-f','null','-'])
manifest={'source':{'name':source.name,'sha256':hashlib.file_digest(source.open('rb'),'sha256').hexdigest()},'output':{'name':final.name,'sha256':hashlib.file_digest(final.open('rb'),'sha256').hexdigest(),'bytes':final.stat().st_size},'edit':spec,'voice_timing':timings,'output_probe':probe,'decode_check':'passed'}
(out/'verification.json').write_text(json.dumps(manifest,indent=2)+'\n')
script='\n\n'.join(f'{ch["start"]//60}:{ch["start"]%60:02d} — {ch["title"].replace(chr(10)," ")}\n'+ ' '.join(ch['sentences']).replace('C R E','CRE').replace('U S D C','USDC') for ch in spec['chapters'])
(out/'Narration.txt').write_text(script+'\n')
(here/'script.md').write_text('# AgentPay — recorded demo narration\n\nExactly 120 seconds; the edit list maps each shot back to 1030.mp4.\n\n'+script+'\n')
print(f'FINAL: {final}\n1920×1080,30fps,3600frames,120.000seconds; complete decode passed',flush=True)
