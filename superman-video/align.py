"""Divide o áudio completo do narrador (ElevenLabs) nas 17 falas usando as pausas."""
import json, re, subprocess, sys
src = sys.argv[1]
out = subprocess.run(["ffmpeg", "-i", src, "-af", "silencedetect=noise=-35dB:d=0.22", "-f", "null", "-"], capture_output=True, text=True).stderr
st = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", out)]
en = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", out)]
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src], capture_output=True, text=True).stdout)
if len(st) > len(en): en.append(dur)
# trechos de fala entre silêncios
chunks, cur = [], 0.0
for s, e in zip(st, en):
    if s - cur > 0.05: chunks.append((cur, s))
    cur = e
if dur - cur > 0.05: chunks.append((cur, dur))
tl = json.load(open("build/timeline.json"))
exp = [x["end"] - x["start"] for x in tl]
k = sum(c[1] - c[0] for c in chunks) / sum(exp)
exp = [e * k for e in exp]
n, m = len(chunks), len(exp)
INF = 1e18
# DP: cada fala recebe um ou mais trechos consecutivos
best = [[INF] * (m + 1) for _ in range(n + 1)]; prv = [[None] * (m + 1) for _ in range(n + 1)]
best[0][0] = 0
for i in range(1, n + 1):
    for j in range(1, m + 1):
        for a in range(max(0, i - 8), i):
            if best[a][j - 1] == INF: continue
            d = chunks[i - 1][1] - chunks[a][0]
            c = best[a][j - 1] + ((d - exp[j - 1]) / (exp[j - 1] ** 0.5)) ** 2
            if c < best[i][j]: best[i][j] = c; prv[i][j] = a
segs, i = [], n
for j in range(m, 0, -1):
    a = prv[i][j]; segs.append((chunks[a][0], chunks[i - 1][1])); i = a
segs.reverse()
for (a, b), x, e in zip(segs, tl, exp):
    print(f"{a:6.2f}-{b:6.2f} ({b - a:5.2f}s, esperado {e:5.2f}) {x['text'][:60]}")
json.dump(segs, open("build/eleven_segments.json", "w"))
