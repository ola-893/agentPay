"""Local Kokoro narration, sentence-boundary captions, no credentials/network.
Override recordings require matching chNN.timing.json; never overwrite user WAVs.
"""
import os
os.environ['OMP_NUM_THREADS']='2'
os.environ['ORT_LOG_SEVERITY_LEVEL']='3'
import json, pathlib, hashlib, subprocess
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro
root=pathlib.Path(__file__).resolve().parents[1]
chapters=json.loads((root/'chapters.json').read_text())
cache=root/'.cache/voice';cache.mkdir(parents=True,exist_ok=True)
assets=root/'assets/voiceover';assets.mkdir(parents=True,exist_ok=True)
models=pathlib.Path(os.environ.get('KOKORO_CACHE',str(pathlib.Path.home()/'.cache/hyperframes/tts')))
engine=Kokoro(str(models/'models/kokoro-v1.0.onnx'),str(models/'voices/voices-v1.0.bin'))
voice='bm_george';speed=float(os.environ.get('VOICE_SPEED','1.0'));tempo=float(os.environ.get('VOICE_TEMPO','1.28'))
results=[];cursor=0
for ch in chapters:
    timing_path=assets/(ch['id']+'.timing.json'); wav=assets/(ch['id']+'.wav')
    chunks=[];segments=[];pos=.25;sr=24000
    chunks.append(np.zeros(round(pos*sr),dtype=np.float32))
    for text in ch['sentences']:
        key=hashlib.sha256((voice+str(speed)+text).encode()).hexdigest()
        part=cache/(key+'.wav')
        if part.exists(): audio,sr=sf.read(part,dtype='float32')
        else:
            audio,sr=engine.create(text,voice=voice,speed=speed,lang='en-gb')
            sf.write(part,audio,sr)
        dur=len(audio)/sr
        segments.append({'text':text,'start':round(pos,4),'end':round(pos+dur,4)})
        chunks.extend([audio,np.zeros(round(.18*sr),dtype=np.float32)])
        pos+=dur+.18
    chunks.append(np.zeros(round(.47*sr),dtype=np.float32))
    generated=cache/(ch['id']+'.wav');sf.write(generated,np.concatenate(chunks),sr)
    # User replacement WAVs are authoritative, with explicit timings required.
    if wav.exists() and not timing_path.exists():
        raise SystemExit(f'{wav.name}: supply sentence timing sidecar before using a replacement')
    meta=json.loads(timing_path.read_text()) if timing_path.exists() else {}
    owned=meta.get('voice')==voice and meta.get('wavSha256')==hashlib.sha256(wav.read_bytes()).hexdigest() if wav.exists() else False
    if wav.exists() and meta.get('voice')==voice and not owned:
        raise SystemExit(f'{wav.name} changed: supply new sentence timings and mark voice user; refusing overwrite')
    if not wav.exists() or owned:
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(generated),'-af',f'atempo={tempo},loudnorm=I=-16:TP=-2:LRA=7','-ar','48000',str(wav)],check=True)
        segments=[{**s,'start':round(s['start']/tempo,4),'end':round(s['end']/tempo,4)} for s in segments]
        timing_path.write_text(json.dumps({'voice':voice,'speed':speed,'tempo':tempo,'segments':segments,'wavSha256':hashlib.sha256(wav.read_bytes()).hexdigest()},indent=2)+'\n')
    else: segments=json.loads(timing_path.read_text())['segments']
    duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(wav)]))
    flac=assets/(ch['id']+'.flac')
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(wav),'-c:a','flac',str(flac)],check=True)
    # Round scene slots up to whole frames; keep all original audio.
    duration=np.ceil(duration*30)/30
    results.append({**ch,'start':round(cursor,4),'duration':float(duration),'segments':segments,'voice':voice,'speed':speed,'tempo':tempo})
    cursor+=duration
    print(ch['id'],round(duration,2),'seconds',flush=True)
(root/'timing.json').write_text(json.dumps({'duration':round(cursor,4),'fps':30,'chapters':results},indent=2)+'\n')
print('TOTAL',round(cursor,2),flush=True)
if cursor>300: raise SystemExit('Narration exceeds five minutes; shorten or regenerate at a faster local speech rate.')
