"""O Menino que Derrotou um Gigante — narração, trilha épica e efeitos.

Se existir vozes/narracao.mp3 (ex.: ElevenLabs), ele é usado no lugar da voz
sintética; os trechos de cada fala são definidos em CHUNKS.
Saídas em build/: narration.wav, music.wav, sfx.wav, timeline.json
"""
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "animacao"))
import build_audio as base  # noqa: E402
from build_audio import SR, add, env, midi, read_wav, tone, tts, write_wav  # noqa: E402

OUT = os.path.join(HERE, "build")
os.makedirs(OUT, exist_ok=True)
NARR = ("mb-br3", 145, 45)

# id, texto falado, legenda, pausa depois
SEGMENTS = [
    ("d1", "Imagine enfrentar um guerreiro tão grande, que todos os soldados tinham medo dele...",
     "Imagine enfrentar um guerreiro tão grande que todos os soldados tinham medo dele…", 0.5),
    ("d2", "Essa era a realidade de Israel.", "Essa era a realidade de Israel.", 0.45),
    ("d3", "Um gigante chamado Golias, desafiava o exército inteiro, e ninguém tinha coragem de enfrentá-lo.",
     "Um gigante chamado Golias desafiava o exército inteiro e ninguém tinha coragem de enfrentá-lo.", 0.5),
    ("d4", "Mas um jovem pastor chamado Davi, decidiu fazer algo que parecia impossível.",
     "Mas um jovem pastor chamado Davi decidiu fazer algo que parecia impossível.", 0.5),
    ("d5", "Enquanto todos viam um gigante invencível, Davi acreditava que Deus estava com ele.",
     "Enquanto todos viam um gigante invencível, Davi acreditava que Deus estava com ele.", 0.5),
    ("d6", "O rei tentou entregar uma armadura para protegê-lo, mas ela era pesada demais.",
     "O rei tentou entregar uma armadura para protegê-lo, mas ela era pesada demais.", 0.45),
    ("d7", "Então Davi pegou apenas sua funda, e cinco pedras.",
     "Então Davi pegou apenas sua funda e cinco pedras.", 0.5),
    ("d8", "Golias começou a rir, quando viu aquele menino se aproximando.",
     "Golias começou a rir quando viu aquele menino se aproximando.", 0.4),
    ("d9", "Mas Davi não recuou.", "Mas Davi não recuou.", 0.45),
    ("d10", "Ele colocou uma pedra na funda, girou com toda a força, e lançou!",
     "Ele colocou uma pedra na funda, girou com toda a força e lançou!", 0.6),
    ("d11", "A pedra atingiu a testa de Golias, que caiu no chão.",
     "A pedra atingiu a testa de Golias, que caiu no chão.", 0.6),
    ("d12", "O gigante que assustava um exército inteiro, havia sido derrotado por um jovem pastor!",
     "O gigante que assustava um exército inteiro havia sido derrotado por um jovem pastor!", 0.6),
    ("d13", "E essa história nos ensina uma coisa: não importa o tamanho do problema, a fé pode nos dar coragem para enfrentá-lo.",
     "E essa história nos ensina uma coisa: não importa o tamanho do problema, a fé pode nos dar coragem para enfrentá-lo.", 0.6),
    ("d14", "Agora me conta: você já conhecia essa história?",
     "Agora me conta: você já conhecia essa história?", 0.0),
]
LEAD_IN = 1.2
TAIL = 3.0

VOZ = os.path.join(HERE, "vozes", "narracao.mp3")
# trechos da narração gravada (ElevenLabs): (id, início, fim, pausa extra depois)
CHUNKS = [("d1", 0.00, 5.37, 0), ("d2", 5.37, 7.86, 0), ("d3", 7.86, 14.61, 0), ("d4", 14.61, 20.34, 0),
          ("d5", 20.34, 26.57, 0), ("d6", 26.57, 31.88, 0), ("d7", 31.88, 35.72, 0.2), ("d8", 35.72, 39.47, 0),
          ("d9", 39.47, 41.33, 0), ("d10", 41.33, 46.37, 0.6), ("d11", 46.37, 50.23, 0.5), ("d12", 50.23, 56.53, 0),
          ("d13", 56.53, 64.62, 0), ("d14", 64.62, 99.0, 0)]


def music(total, seg):
    """Trilha épica: tambores graves, cordas sustentadas, trompas na vitória."""
    buf = np.zeros(int(total * SR))
    bpm = 92
    beat = 60 / bpm
    rng = np.random.default_rng(4)
    kn = int(0.5 * SR)
    kt = np.arange(kn) / SR
    drum = np.sin(2 * np.pi * (45 + 60 * np.exp(-kt * 18)) * kt) * env(kn, 0.002, 0.25)
    tom = np.sin(2 * np.pi * (90 + 70 * np.exp(-kt * 20)) * kt) * env(kn, 0.002, 0.15)
    shaker = rng.uniform(-1, 1, int(0.05 * SR)) * env(int(0.05 * SR), 0.002, 0.015)
    tense = [(50, 53, 57), (46, 50, 53), (48, 52, 55), (45, 49, 52)]     # Dm Bb C A
    hope = [(50, 53, 57), (55, 58, 62), (53, 57, 60), (57, 61, 64)]
    win = [(50, 54, 57), (55, 59, 62), (57, 61, 64), (50, 54, 57)]       # D G A D
    calm = [(50, 54, 57), (47, 50, 54), (55, 59, 62), (57, 61, 64)]
    t_hope = seg["d4"]["start"] - 0.3
    t_fight = seg["d8"]["start"] - 0.3
    t_hit = seg["d11"]["start"]
    t_win = seg["d12"]["start"] - 0.2
    t_calm = seg["d13"]["start"] - 0.2
    b = 0
    while b * beat < total - 0.5:
        t = b * beat
        if t < t_hope:
            prog, inten = tense, 0.8
        elif t < t_fight:
            prog, inten = hope, 0.6
        elif t < t_win:
            prog, inten = tense, 1.0
        elif t < t_calm:
            prog, inten = win, 1.0
        else:
            prog, inten = calm, 0.5
        if t_hit - 0.6 < t < t_win:      # silêncio antes do impacto
            b += 1
            continue
        chord = prog[(b // 4) % 4]
        if b % 4 == 0:
            for m in chord:
                add(buf, t, tone(midi(m), beat * 4.2, "tri", 0.4, 2.5), 0.03)
                add(buf, t, tone(midi(m + 12), beat * 4.2, "sin", 0.5, 2.5), 0.025)
            add(buf, t, tone(midi(chord[0] - 12), beat * 4, "sin", 0.1, 2.0), 0.08)
        if prog is win and b % 2 == 0:   # trompas
            for m in chord:
                add(buf, t, tone(midi(m + 12), beat * 1.8, "sq", 0.05, 0.8), 0.018)
        if t < t_calm:
            add(buf, t, drum, 0.45 * inten if b % 2 == 0 else 0.2 * inten)
            if b % 4 == 3:
                add(buf, t + beat * 0.5, tom, 0.25 * inten)
                add(buf, t + beat * 0.75, tom, 0.2 * inten)
            add(buf, t + beat * 0.5, shaker, 0.05 * inten)
        else:
            if b % 2 == 0:
                note = chord[(b // 2) % 3] + 24
                add(buf, t, tone(midi(note), beat * 1.5, "sin", 0.01, 0.8), 0.05)
        b += 1
    fo = int(2.0 * SR)
    buf[-fo:] *= np.linspace(1, 0, fo)
    return buf * 0.8


def sfx(total, seg):
    buf = np.zeros(int(total * SR))
    rng = np.random.default_rng(6)
    s = seg

    def filt_noise(d, lp):
        n = int(d * SR)
        x = rng.uniform(-1, 1, n)
        y = np.zeros(n)
        acc = 0.0
        for i in range(n):
            acc += lp * (x[i] - acc)
            y[i] = acc
        return y

    def whoosh(d=0.4):
        return filt_noise(d, 0.12) * np.sin(np.linspace(0, np.pi, int(d * SR))) * 2.5

    def boom(d=1.6, f=40):
        n = int(d * SR)
        t = np.arange(n) / SR
        return np.sin(2 * np.pi * (f + 50 * np.exp(-t * 5)) * t) * env(n, 0.003, 0.6) + filt_noise(d, 0.05) * env(n, 0.003, 0.3) * 2

    def laugh():
        c = np.zeros(int(1.8 * SR))
        for i in range(6):
            n = int(0.18 * SR)
            t = np.arange(n) / SR
            f = 110 - i * 4
            v = (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2 * t) + 0.3 * np.sign(np.sin(2 * np.pi * f * 3 * t))) * env(n, 0.01, 0.07)
            add(c, i * 0.24, v, 0.5)
        return c

    def swing(d=0.25):
        return filt_noise(d, 0.35) * np.sin(np.linspace(0, np.pi, int(d * SR))) * 1.4

    def clank():
        c = np.zeros(int(0.6 * SR))
        for f in [523, 1245, 2100]:
            add(c, 0, tone(f, 0.5, "sin", 0.001, 0.12), 0.25)
        n = int(0.05 * SR)
        add(c, 0, rng.uniform(-1, 1, n) * env(n, 0.001, 0.01), 0.4)
        return c

    def stone():
        n = int(0.06 * SR)
        return rng.uniform(-1, 1, n) * env(n, 0.001, 0.012)

    def baa():
        n = int(0.5 * SR)
        t = np.arange(n) / SR
        f = 380 + 30 * np.sin(t * 40)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.6 + 0.4 * np.sin(t * 60)) * env(n, 0.03, 0.25)

    def crowd(d=2.5):
        x = filt_noise(d, 0.25) * 1.6
        n = len(x)
        return x * np.minimum(1, np.arange(n) / (0.3 * SR)) * np.linspace(1, 0.2, n)

    def chime():
        c = np.zeros(int(1.6 * SR))
        for i, m in enumerate([74, 78, 81, 86]):
            add(c, i * 0.09, tone(midi(m), 1.0, "sin", 0.002, 0.5), 0.25)
        return c

    add(buf, 0.1, boom(2.0, 35), 0.6)                                 # passo do gigante
    add(buf, 0.9, boom(1.5, 38), 0.4)
    for k in ["d2", "d3", "d4", "d6", "d7", "d8", "d12", "d13"]:
        add(buf, s[k]["start"] - 0.3, whoosh(), 0.3)
    add(buf, s["d3"]["start"] + 0.3, boom(1.5, 36), 0.5)
    add(buf, s["d4"]["start"] + 0.5, baa(), 0.35)
    add(buf, s["d5"]["start"] + (s["d5"]["end"] - s["d5"]["start"]) * 0.5, chime(), 0.6)
    for i in range(3):
        add(buf, s["d6"]["start"] + 1.6 + i * 0.4, clank(), 0.4)
    for i in range(5):
        add(buf, s["d7"]["start"] + 1.4 + i * 0.32, stone(), 0.6)
    add(buf, s["d8"]["start"] + 0.2, laugh(), 0.8)
    d10 = s["d10"]
    t_spin = d10["start"] + (d10["end"] - d10["start"]) * 0.42
    t_rel = d10["end"] - 0.15
    for i in range(int((t_rel - t_spin) / 0.22)):
        add(buf, t_spin + i * 0.22, swing(), 0.5)
    add(buf, t_rel, whoosh(0.6), 0.6)
    add(buf, s["d11"]["start"] + 0.35, clank(), 0.9)                 # pedra na testa
    add(buf, s["d11"]["start"] + 0.35, boom(0.6, 80), 0.4)
    add(buf, s["d11"]["end"] - 0.2, boom(2.4, 30), 1.0)             # queda do gigante
    add(buf, s["d12"]["start"], crowd(3.5), 0.5)
    add(buf, s["d14"]["start"], chime(), 0.4)
    return buf


def finish(clips, timeline, total):
    print(f"duração total: {total:.2f}s")
    narr = np.zeros(int(total * SR))
    for start, d in clips:
        i = int(start * SR)
        narr[i:i + len(d)] += d * 0.95
    seg = {x["id"]: x for x in timeline}
    write_wav(os.path.join(OUT, "narration.wav"), narr)
    write_wav(os.path.join(OUT, "music.wav"), music(total, seg))
    write_wav(os.path.join(OUT, "sfx.wav"), sfx(total, seg))
    with open(os.path.join(OUT, "timeline.json"), "w") as f:
        json.dump({"duration": round(total, 3), "segments": timeline}, f, ensure_ascii=False, indent=1)


def main():
    caps = {sid: cap for sid, _, cap, _ in SEGMENTS}
    clips, timeline, t = [], [], LEAD_IN
    if os.path.exists(VOZ) and CHUNKS:
        src = base.load_mp3(VOZ)
        for sid, a, b, extra in CHUNKS:
            d = src[int(a * SR): int(min(b, len(src) / SR) * SR)]
            sa, sb = base.speech_bounds(d)
            timeline.append({"id": sid, "start": round(t + sa, 3), "end": round(t + sb, 3), "caption": caps[sid]})
            clips.append((t, d))
            t += len(d) / SR + extra
    else:
        for sid, spoken, caption, pause in SEGMENTS:
            p = os.path.join(OUT, f"{sid}.wav")
            tts(NARR, spoken, p)
            d = read_wav(p)
            dur = len(d) / SR
            clips.append((t, d))
            timeline.append({"id": sid, "start": round(t, 3), "end": round(t + dur, 3), "caption": caption})
            t += dur + pause
    finish(clips, timeline, t + TAIL)


if __name__ == "__main__":
    main()
