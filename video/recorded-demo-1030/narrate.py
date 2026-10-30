"""Generate only this recording's narration with the already installed local voice.

No network, keys, changes to original media or to the earlier HyperFrames film.
"""
import os
os.environ['OMP_NUM_THREADS'] = '2'
os.environ['ORT_LOG_SEVERITY_LEVEL'] = '3'
import hashlib, json, pathlib, subprocess
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

root = pathlib.Path(__file__).resolve().parents[2]
spec = json.loads((pathlib.Path(__file__).parent / 'edit.json').read_text())
work = root / '.local/recorded-demo-1030'
voice_dir = work / 'voice'
voice_dir.mkdir(parents=True, exist_ok=True)
models = pathlib.Path.home() / '.cache/hyperframes/tts'
engine = Kokoro(str(models/'models/kokoro-v1.0.onnx'), str(models/'voices/voices-v1.0.bin'))
sample_rate = 24000
full = np.zeros(120 * sample_rate, dtype=np.float32)
timings = []
for chapter in spec['chapters']:
    parts = []
    sentence_times = []
    position = 0
    for sentence in chapter['sentences']:
        digest = hashlib.sha256((spec['voice'] + '|1.0|' + sentence).encode()).hexdigest()
        cache = voice_dir / f'{digest}.wav'
        if cache.exists():
            data, sr = sf.read(cache, dtype='float32')
        else:
            data, sr = engine.create(sentence, voice=spec['voice'], speed=1.0, lang='en-gb')
            sf.write(cache, data, sr)
        assert sr == sample_rate
        # Keep breaths but remove surplus generator padding at sentence ends.
        active = np.flatnonzero(np.abs(data) > 0.008)
        if active.size:
            data = data[max(0, active[0]-1200):min(len(data), active[-1]+2400)]
        duration = len(data) / sr
        sentence_times.append({'text': sentence, 'start': position, 'end': position+duration})
        parts.extend([data, np.zeros(round(.18*sr), dtype=np.float32)])
        position += duration+.18
    raw = np.concatenate(parts)
    raw_path = voice_dir / f'{chapter["id"]}-raw.wav'
    sf.write(raw_path, raw, sample_rate)
    target = chapter['duration'] - .8
    # Match speech to each scene, allowing restrained natural tempo correction.
    tempo = max(.90, len(raw)/sample_rate/target)
    if tempo > 1.20:
        raise SystemExit(f'Chapter {chapter["id"]} needs shorter writing: tempo {tempo:.3f}')
    adjusted = voice_dir / f'{chapter["id"]}.wav'
    subprocess.run(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y','-i',str(raw_path),'-af',f'atempo={tempo:.8f}','-ar',str(sample_rate),str(adjusted)],check=True)
    data, sr = sf.read(adjusted, dtype='float32')
    offset = chapter['start'] + .3
    end = offset + len(data)/sr
    assert end <= chapter['start']+chapter['duration']-.25
    full[round(offset*sr):round(offset*sr)+len(data)] = data
    timings.append({'id':chapter['id'],'start':offset,'end':end,'tempo':tempo,'sentences':[
        {**s,'start':offset+s['start']/tempo,'end':offset+s['end']/tempo} for s in sentence_times
    ]})
    print(chapter['id'],f'{len(data)/sr:.2f}s / {chapter["duration"]}s slot, tempo {tempo:.3f}',flush=True)
sf.write(work/'narration-raw.wav', full, sample_rate)
(work/'voice-timing.json').write_text(json.dumps(timings,indent=2)+'\n')
print('Narration assembled: exactly120seconds',flush=True)
