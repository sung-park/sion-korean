"""Generate narration with ElevenLabs (Annie KR). Key is read from env ELEVENLABS_API_KEY only, never written anywhere.
Raw responses are cached by content hash in ../audio_raw so re-runs never bill twice.
Usage: node tools/dump_lines.mjs > /tmp/lines.json && ELEVENLABS_API_KEY=... python3 tools/gen_audio.py /tmp/lines.json"""
import os, sys, json, hashlib, time, requests, concurrent.futures as cf
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, '..', 'audio_raw'); OUT = os.path.join(ROOT, 'assets', 'audio')
KEY = os.environ['ELEVENLABS_API_KEY']; VOICE = 'Lb7qkOn5hF8p7qfCDH8q'; MODEL = 'eleven_multilingual_v2'
os.makedirs(RAW, exist_ok=True)
FX = {'ok1':'좋아!','ok2':'정답이야!','ok3':'잘했어!','ok4':'멋져!','ok5':'와, 최고야!','wrong':'괜찮아. 같이 알아보자.',
  'start':'오늘도 이음말 탐험을 떠나 볼까?','start1':'안녕, 시온아! 그리고, 그런데, 그래서를 같이 연습해 보자!','done':'오늘 연습 끝! 정말 잘했어!',
  'chest':'보물 상자를 눌러 봐!','m_0':'그리고는 더하기야. 비슷한 이야기를 하나 더 붙일 때 써.','m_1':'그런데는 생각과 다른 일이 생길 때 써.',
  'm_2':'그래서는 까닭과 결과야. 앞의 일 때문에 뒤의 일이 생길 때 써.'}
CONNS = ['그리고', '그런데', '그래서']
def tts(text, speed=0.9):
    vs = {'stability':0.6, 'similarity_boost':0.8, 'style':0.0, 'use_speaker_boost':True, 'speed':speed}
    h = hashlib.sha1(json.dumps([text, VOICE, MODEL, vs]).encode()).hexdigest()[:16]; path = os.path.join(RAW, h + '.mp3')
    if os.path.exists(path): return path
    for attempt in range(6):
        try: r = requests.post(f'https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_64', headers={'xi-api-key':KEY},
                               json={'text':text, 'model_id':MODEL, 'voice_settings':vs}, timeout=60)
        except requests.exceptions.RequestException: time.sleep(3*(attempt+1)); continue
        if r.status_code == 200: break
        if r.status_code == 429: time.sleep(3*(attempt+1)); continue
        raise RuntimeError(f'{r.status_code} {r.text[:200]} for {text!r}')
    open(path, 'wb').write(r.content); return path
lines = json.load(open(sys.argv[1]))
jobs = [('fx', k, f'fx/{k}.mp3', t, 0.9) for k, t in FX.items()]
jobs += [('c', c, f'c/{i}.mp3', c + '.', 0.85) for i, c in enumerate(CONNS)]
jobs += [('a', k, f'a/{k}.mp3', t, 0.88) for k, t in lines['a']]
jobs += [('b', k, f'b/{f}.mp3', t, 0.88) for k, f, t in lines['b']]
man = {}
def run(j):
    cat, key, rel, text, sp = j; src = tts(text, sp); dst = os.path.join(OUT, rel); os.makedirs(os.path.dirname(dst), exist_ok=True)
    open(dst, 'wb').write(open(src, 'rb').read()); return cat, key, rel
with cf.ThreadPoolExecutor(4) as ex:
    for cat, key, rel in ex.map(run, jobs): man.setdefault(cat, {})[key] = rel
for k, v in man.items():
    if k == 'fx': v.update({'m_' + c: v.pop('m_' + str(i)) for i, c in enumerate(CONNS)})
json.dump(man, open(os.path.join(OUT, 'manifest.json'), 'w'), ensure_ascii=False, indent=0)
print('clips', sum(len(v) for v in man.values()), 'chars', sum(len(j[3]) for j in jobs))
