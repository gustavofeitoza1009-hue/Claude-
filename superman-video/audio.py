"""Trilha musical + efeitos sonoros sintetizados e mixagem com a narração -> build/mix.wav"""
import wave, numpy as np

SR = 44100
DUR = 70.0
N = int(SR * DUR)
rs = np.random.default_rng(7)


def t_(d): return np.arange(int(SR * d)) / SR
def env(n, a=0.005, r=0.2):
    e = np.ones(n); na = max(1, int(a * SR)); e[:na] = np.linspace(0, 1, na)
    return e * np.exp(-np.arange(n) / SR / r)
def add(buf, x, at, g=1.0):
    i = int(at * SR); j = min(len(buf), i + len(x))
    if j > i: buf[i:j] += x[: j - i] * g
def note(f): return 440 * 2 ** ((f - 69) / 12)


# ---------------- música (128 BPM) ----------------
bpm = 128; beat = 60 / bpm; bar = beat * 4
music = np.zeros(N)
def kick():
    t = t_(0.35); f = 50 + 120 * np.exp(-t * 30); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
def clap():
    t = t_(0.2); return rs.standard_normal(len(t)) * np.exp(-t * 22) * 0.6
def hat():
    t = t_(0.05); x = rs.standard_normal(len(t)); x = np.diff(x, prepend=0); return x * np.exp(-t * 80) * 0.25
def pluck(f, d=0.28):
    t = t_(d); x = np.sign(np.sin(2 * np.pi * f * t)) * 0.4 + np.sin(2 * np.pi * f * 2 * t) * 0.3
    return x * env(len(t), 0.003, 0.09)
def bass(f, d):
    t = t_(d); x = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t); return x * env(len(t), 0.005, 0.25)
prog = [(60, [60, 64, 67]), (55, [55, 59, 62]), (57, [57, 60, 64]), (53, [53, 57, 60])]  # C G Am F
K, C, Hh = kick(), clap(), hat()
t = 0.0; b = 0
while t < DUR:
    root, ch = prog[b % 4]
    intense = not (t < 0.0)
    for i in range(4):
        bt = t + i * beat
        add(music, K, bt, 0.9)
        if i % 2 == 1: add(music, C, bt, 0.5)
        for h in (0, 0.5): add(music, Hh, bt + h * beat, 0.6)
        for h in (0, 0.5): add(music, bass(note(root - 24), beat * 0.45), bt + h * beat, 0.45)
    arp = ch + [ch[1] + 12, ch[2] + 12, ch[0] + 12, ch[2]]
    for k in range(8):
        add(music, pluck(note(arp[k % len(arp)] + 12)), t + k * beat / 2, 0.22)
    t += bar; b += 1
# filtro passa-baixa simples para suavizar
music = np.convolve(music, np.ones(6) / 6, mode='same')

# ---------------- efeitos ----------------
sfx = np.zeros(N)
def whoosh(d=0.6, up=True):
    t = t_(d); n = rs.standard_normal(len(t)); e = np.sin(np.pi * t / d) ** 2
    out = np.zeros_like(n); a = 0.0; c = np.linspace(0.02, 0.4, len(t)) if up else np.linspace(0.4, 0.02, len(t))
    for i in range(len(n)): a += c[i] * (n[i] - a); out[i] = a
    return out * e * 1.6
def boom(d=0.8):
    t = t_(d); f = 40 + 90 * np.exp(-t * 12); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4) + rs.standard_normal(len(t)) * np.exp(-t * 14) * 0.4
def crash():
    x = boom(1.2); t = t_(1.2)
    for k in range(14): add_t = rs.uniform(0.05, 0.9); x += np.roll(np.sin(2 * np.pi * rs.uniform(300, 900) * t) * np.exp(-t * 40) * 0.25, int(add_t * SR))
    return x
def pop():
    t = t_(0.15); f = 900 * np.exp(-t * 25) + 200; return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 20)
def ding(f=1320, d=0.8):
    t = t_(d); return (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2.01 * t)) * np.exp(-t * 4) * 0.6
def sweep(f0, f1, d, trem=0):
    t = t_(d); f = np.linspace(f0, f1, len(t)); x = np.sin(2 * np.pi * np.cumsum(f) / SR)
    if trem: x *= 0.6 + 0.4 * np.sin(2 * np.pi * trem * t)
    return x * np.sin(np.pi * t / d) ** 0.5
def punch():
    t = t_(0.4); return boom(0.4) * 1.2 + rs.standard_normal(len(t)) * np.exp(-t * 30) * 0.8
def boing():
    t = t_(0.6); f = 220 + 140 * np.sin(2 * np.pi * 9 * t) * np.exp(-t * 4); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4) * 0.8
def alarm(d=1.8):
    t = t_(d); x = np.sin(2 * np.pi * 2200 * t) * (np.sin(2 * np.pi * 18 * t) > 0) * 0.35; return x * ((t % 0.5) < 0.35)
def cricket(at):
    for k in range(3):
        t = t_(0.06); add(sfx, np.sin(2 * np.pi * 4300 * t) * np.sin(np.pi * t / 0.06) * 0.25, at + k * 0.08)
def horn():
    t = t_(0.7); x = (np.sign(np.sin(2 * np.pi * 330 * t)) + np.sign(np.sin(2 * np.pi * 415 * t))) * 0.2; return x * np.minimum(1, (0.7 - t) * 10)
def tada():
    out = np.zeros(int(SR * 1.2))
    for i, m in enumerate([72, 76, 79, 84]): add(out, pluck(note(m), 0.9) * 1.2, i * 0.09)
    return out

for c in [5, 15, 25, 37, 50, 62]: add(sfx, whoosh(0.5), c - 0.3, 0.7)
add(sfx, boom(1.0), 0.05, 0.8); add(sfx, sweep(200, 900, 2.5), 0.2, 0.15)
add(sfx, ding(1800, 0.6), 7.0, 0.35)
add(sfx, crash(), 8.6, 0.9)
add(sfx, sweep(300, 500, 0.8, trem=20), 10.6, 0.15)
add(sfx, pop(), 11.6, 0.9); add(sfx, boing(), 11.7, 0.4)
add(sfx, boom(0.8), 17.3, 0.8); add(sfx, whoosh(1.6), 17.3, 0.9)
add(sfx, ding(1560, 0.4), 21.2, 0.5); add(sfx, ding(1560, 0.4), 21.45, 0.5)
add(sfx, sweep(1500, 300, 2.4), 22.5, 0.2); add(sfx, whoosh(2.2), 22.5, 0.8)
add(sfx, sweep(600, 1400, 1.2, trem=30), 25.3, 0.22)
add(sfx, sweep(600, 1400, 0.8, trem=30), 35.0, 0.22); add(sfx, tada(), 35.4, 0.6)
for k, m in enumerate([84, 88, 91, 96]): add(sfx, ding(note(m), 0.6), 37.4 + k * 0.08, 0.25)
add(sfx, whoosh(0.35), 41.0, 0.7); add(sfx, punch(), 41.35, 1.0); add(sfx, boing(), 41.9, 0.6)
add(sfx, sweep(400, 1600, 0.5), 47.4, 0.2)
for k in range(10): add(sfx, whoosh(0.15), 47.5 + k * 0.12, 0.25)
add(sfx, alarm(2.0), 51.2, 0.6)
add(sfx, whoosh(2.4), 54.4, 0.9)
add(sfx, boom(0.5), 57.3, 0.7)
for k in range(6): cricket(59.6 + k * 0.4)
add(sfx, horn(), 61.0, 0.4)
add(sfx, pop(), 62.1, 0.6); add(sfx, tada(), 62.2, 0.6)
add(sfx, pop(), 68.5, 0.8); add(sfx, ding(1760, 0.8), 68.55, 0.5)

# ---------------- voz + ducking ----------------
with wave.open('build/voice.wav') as w:
    vsr = w.getframerate(); v = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
v = np.interp(np.arange(N) * vsr / SR, np.arange(len(v)), v)
envv = np.convolve(np.abs(v), np.ones(int(0.25 * SR)) / int(0.25 * SR), mode='same')
duck = 1 - 0.55 * np.clip(envv / 0.04, 0, 1)
fade = np.ones(N); fade[-int(1.2 * SR):] = np.linspace(1, 0, int(1.2 * SR))
music /= np.abs(music).max(); sfx /= max(1e-9, np.abs(sfx).max())
mix = v * 1.0 + music * 0.30 * duck + sfx * 0.45
mix *= fade
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix /= np.abs(mix).max() / 0.95
st = np.stack([mix, mix], axis=1)
with wave.open('build/mix.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype(np.int16).tobytes())
print('ok')
