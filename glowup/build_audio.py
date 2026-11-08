"""Glow Up - Ep. 1: narração (espeak-ng + mbrola pt-BR), trilha e efeitos.

Reaproveita os sintetizadores de ../animacao/build_audio.py.
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

NARR = ("mb-br3", 145, 55)

# id, texto falado, legenda, pausa depois
SEGMENTS = [
    ("g1", "A Júlia aceitou sair com esse macaquinho, mas existe um pequeno problema...",
     "A Júlia aceitou sair com esse macaquinho, mas existe um pequeno problema…", 0.45),
    ("g2", "Ele tem apenas um mês, e está precisando de um glow up, URGENTE!",
     "Ele tem apenas 1 mês e está precisando de um glow up URGENTE!", 0.4),
    ("g3", "Temos trinta dias para transformar esse cidadão, no maior tchéd da história.",
     "Temos 30 dias para transformar esse cidadão no maior CHAD da história.", 0.45),
    ("g4", "E vamos começar pelo básico: um banho!",
     "E vamos começar pelo básico: um banho!", 0.5),
    ("g5", "Porque, sinceramente, ele está parecendo que passou os últimos seis meses, dentro de uma lata de lixo.",
     "Porque, sinceramente, ele está parecendo que passou os últimos 6 meses dentro de uma lata de lixo.", 1.0),
    ("g6", "Depois do banho, já dá pra perceber uma pequena evolução!",
     "Depois do banho, já dá pra perceber uma pequena evolução!", 0.35),
    ("g7", "Mas ainda estamos longe, de chegar ao nível de beleza da Júlia.",
     "Mas ainda estamos longe de chegar ao nível de beleza da Júlia.", 0.45),
    ("g8", "Agora precisamos decidir o próximo passo!",
     "Agora precisamos decidir o próximo passo!", 0.3),
    ("g9", "O que vocês escolhem?",
     "O que vocês escolhem?", 0.35),
    ("g10", "Um skincare, para acabar com essas espinhas, ou um corte de cabelo, para deixar esse macaquinho estiloso?",
     "Um skincare para acabar com essas espinhas ou um corte de cabelo para deixar esse macaquinho estiloso?", 0.45),
    ("g11", "A escolha mais votada, será feita no próximo episódio!",
     "A escolha mais votada será feita no próximo episódio!", 0.35),
    ("g12", "E lembrem-se: temos apenas trinta dias!",
     "E lembrem-se: temos apenas 30 dias!", 0.0),
]
LEAD_IN = 0.5
TAIL = 2.6


def music(total, seg):
    buf = np.zeros(int(total * SR))
    bpm = 118
    beat = 60 / bpm
    prog = [(60, 64, 67), (64, 67, 71), (57, 60, 64), (65, 69, 72)]   # C Em Am F
    rng = np.random.default_rng(3)
    hat = rng.uniform(-1, 1, int(0.04 * SR)) * env(int(0.04 * SR), 0.001, 0.012)
    kn = int(0.25 * SR)
    kt = np.arange(kn) / SR
    kick = np.sin(2 * np.pi * (50 + 90 * np.exp(-kt * 30)) * kt) * env(kn, 0.001, 0.12)
    clap = rng.uniform(-1, 1, int(0.12 * SR)) * env(int(0.12 * SR), 0.001, 0.04)
    t_choice = seg["g8"]["start"] - 0.2
    b = 0
    while b * beat < total - 0.8:
        t = b * beat
        chord = prog[(b // 4) % 4]
        if b % 4 == 0:
            for m in chord:
                add(buf, t, tone(midi(m), beat * 4, "sin", 0.05, 1.2), 0.045)
        add(buf, t, tone(midi(chord[0] - 24), beat * 0.8, "tri", 0.005, 0.16), 0.2)
        if t < t_choice or b % 2 == 0:
            note = chord[(b * 5) % 3] + 12 + (12 if b % 8 == 7 else 0)
            add(buf, t + beat * 0.5, tone(midi(note), beat * 0.35, "sq", 0.003, 0.07), 0.03)
        add(buf, t, kick, 0.33 if b % 2 == 0 else 0.0)
        if b % 4 in (1, 3):
            add(buf, t, clap, 0.07)
        add(buf, t + beat / 2, hat, 0.07)
        b += 1
    fo = int(1.2 * SR)
    buf[-fo:] *= np.linspace(1, 0, fo)
    return buf * 0.8


def sfx(total, seg):
    buf = np.zeros(int(total * SR))
    rng = np.random.default_rng(5)
    s = seg

    def noise_burst(d, lp=0.2):
        n = int(d * SR)
        x = rng.uniform(-1, 1, n)
        y = np.zeros(n)
        acc = 0.0
        for i in range(n):
            acc += lp * (x[i] - acc)
            y[i] = acc
        return y

    def whoosh(d=0.35):
        return noise_burst(d, 0.15) * np.sin(np.linspace(0, np.pi, int(d * SR))) * 2.5

    def buzz(d):
        n = int(d * SR)
        t = np.arange(n) / SR
        f = 210 + 25 * np.sin(t * 9) + 15 * np.sin(t * 23)
        w = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.4
        return w * (0.5 + 0.5 * np.sin(t * 3) ** 2)

    def bubble():
        n = int(0.09 * SR)
        t = np.arange(n) / SR
        f0 = 500 + rng.uniform(0, 600)
        return np.sin(2 * np.pi * (f0 + 3000 * t) * t) * env(n, 0.002, 0.03)

    def ding(f=1320):
        return tone(f, 0.6, "sin", 0.002, 0.18) + tone(f * 1.5, 0.6, "sin", 0.002, 0.12) * 0.5

    def sparkle():
        c = np.zeros(int(1.0 * SR))
        for i, m in enumerate([84, 88, 91, 96, 100]):
            add(c, i * 0.07, tone(midi(m), 0.5, "sin", 0.002, 0.18), 0.25)
        return c

    def boing():
        n = int(0.4 * SR)
        t = np.arange(n) / SR
        return np.sin(2 * np.pi * (180 + 120 * np.sin(t * 40) * np.exp(-t * 6)) * t) * env(n, 0.002, 0.15)

    def tick():
        n = int(0.03 * SR)
        return rng.uniform(-1, 1, n) * env(n, 0.0005, 0.006)

    def pop():
        n = int(0.08 * SR)
        t = np.arange(n) / SR
        return np.sin(2 * np.pi * (900 - 6000 * t) * t) * env(n, 0.001, 0.03)

    # moscas zumbindo enquanto ele está sujo
    t_clean = s["g6"]["start"]
    add(buf, 0.0, buzz(s["g4"]["start"]), 0.05)
    add(buf, s["g5"]["start"], buzz(s["g5"]["end"] - s["g5"]["start"]), 0.08)
    add(buf, s["g1"]["start"] + 0.2, ding(1568), 0.35)          # coração da Júlia
    add(buf, s["g1"]["end"] - 0.3, boing(), 0.5)                # "problema"
    for k in ["g2", "g3", "g4", "g5", "g6", "g7", "g8", "g10"]:
        add(buf, s[k]["start"] - 0.25, whoosh(), 0.35)
    add(buf, s["g3"]["start"] + 0.6, ding(), 0.35)              # HUD aparece
    for i in range(40):                                          # banho: bolhas
        add(buf, s["g4"]["start"] + 0.8 + i * 0.09 + rng.uniform(0, 0.05), bubble(), 0.18)
    for i in range(30):
        add(buf, t_clean - 0.2 + i * 0.07, bubble(), 0.15)
    add(buf, t_clean + 0.5, sparkle(), 0.6)                     # evolução
    for i in range(10):                                          # barra enchendo
        add(buf, t_clean + 0.7 + i * 0.07, pop(), 0.18)
    add(buf, s["g9"]["start"] + 0.1, ding(1046), 0.4)
    add(buf, s["g10"]["start"] + 0.1, pop(), 0.4)
    add(buf, s["g10"]["start"] + (s["g10"]["end"] - s["g10"]["start"]) * 0.45, pop(), 0.4)
    for i in range(int(TAIL * 2) + 6):                           # relógio no final
        add(buf, s["g12"]["start"] + i * 0.5, tick(), 0.4)
    return buf


def main():
    clips, timeline = [], []
    t = LEAD_IN
    for sid, spoken, caption, pause in SEGMENTS:
        p = os.path.join(OUT, f"{sid}.wav")
        tts(NARR, spoken, p)
        d = read_wav(p)
        dur = len(d) / SR
        clips.append((t, d))
        timeline.append({"id": sid, "start": round(t, 3), "end": round(t + dur, 3), "caption": caption, "speaker": "narrador"})
        t += dur + pause
    total = t + TAIL
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


if __name__ == "__main__":
    main()
