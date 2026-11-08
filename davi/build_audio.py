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
LEAD_IN = 0.75
KEEP_TIMING = {"d13", "d14"}   # encerramento: tempos originais
TAIL = 3.0

VOZ = os.path.join(HERE, "vozes", "narracao.mp3")
# trechos da narração gravada (ElevenLabs): (id, início, fim, pausa extra depois)
CHUNKS = [("d1", 0.00, 5.37, 0), ("d2", 5.37, 7.86, 0), ("d3", 7.86, 14.61, 0), ("d4", 14.61, 20.34, 0),
          ("d5", 20.34, 26.57, 0), ("d6", 26.57, 31.88, 0), ("d7", 31.88, 35.72, 0.2), ("d8", 35.72, 39.47, 0),
          ("d9", 39.47, 41.33, 0), ("d10", 41.33, 46.37, 0.6), ("d11", 46.37, 50.23, 0.5), ("d12", 50.23, 56.53, 0),
          ("d13", 56.53, 64.62, 0), ("d14", 64.62, 99.0, 0)]


ENDING_ID = "d13"            # do d13 em diante é o encerramento original (não é refeito)


def saw(freq, dur, a=0.05, r=1.0, det=0.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for h in range(1, 9):                       # dente-de-serra suave (aditivo)
        out += np.sin(2 * np.pi * freq * (1 + det) * h * t + h) / h
    return out * 0.5 * np.minimum(1, t / a) * np.minimum(1, (dur - t) / r).clip(0, 1)


def choir(m, dur, a=0.6, r=0.8):
    """Pad de coral: 3 vozes desafinadas com vibrato."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for d in (-0.004, 0, 0.005):
        f = midi(m) * (1 + d) * (1 + 0.004 * np.sin(2 * np.pi * 5.2 * t))
        ph = 2 * np.pi * np.cumsum(f) / SR
        out += np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.15 * np.sin(3 * ph)
    return out / 3 * np.minimum(1, t / a) * np.minimum(1, (dur - t) / r).clip(0, 1)


def music(total, seg):
    """Trilha épica: abertura impactante, tensão, esperança e um confronto que cresce até o impacto."""
    buf = np.zeros(int(total * SR))
    rng = np.random.default_rng(4)
    kn = int(0.6 * SR)
    kt = np.arange(kn) / SR
    taiko = np.sin(2 * np.pi * (48 + 70 * np.exp(-kt * 16)) * kt) * env(kn, 0.002, 0.28)
    tom = np.sin(2 * np.pi * (95 + 80 * np.exp(-kt * 22)) * kt) * env(kn, 0.002, 0.14)
    snare = rng.uniform(-1, 1, int(0.18 * SR)) * env(int(0.18 * SR), 0.001, 0.05)
    tense = [(50, 53, 57), (46, 50, 53), (48, 52, 55), (45, 49, 52)]     # Dm Bb C A
    hope = [(50, 53, 57), (55, 58, 62), (53, 57, 60), (57, 61, 64)]
    win = [(50, 54, 57), (55, 59, 62), (57, 61, 64), (50, 54, 57)]       # D G A D
    t_hope = seg["d4"]["start"] - 0.3
    t_fight = seg["d8"]["start"] - 0.3
    d10 = seg["d10"]
    t_rel = d10["end"] - 0.15
    t_hit = seg["d11"]["start"] + 0.35
    t_win = seg["d12"]["start"] - 0.2
    t_end = seg[ENDING_ID]["start"] - 0.12
    bpm = 96
    beat = 60 / bpm
    # golpe de abertura
    add(buf, 0.0, taiko, 1.0); add(buf, 0.0, saw(midi(38), 2.5, 0.005, 2.0) * env(int(2.5 * SR), 0.005, 1.2), 0.09)
    b = 0
    while b * beat < t_end:
        t = b * beat
        if t < t_hope:
            prog, inten = tense, 0.75
        elif t < t_fight:
            prog, inten = hope, 0.55
        elif t < t_win:
            prog, inten = tense, 0.8 + 0.6 * min(1, (t - t_fight) / max(0.1, t_rel - t_fight))   # cresce
        else:
            prog, inten = win, 1.2
        if t_rel - 0.05 < t < t_hit + 0.15:       # respiro antes do impacto (câmera lenta)
            b += 1
            continue
        chord = prog[(b // 4) % 4]
        if b % 4 == 0:
            for m in chord:
                add(buf, t, saw(midi(m), beat * 4.1, 0.3, 0.6, 0.003), 0.012 * inten)
                add(buf, t, saw(midi(m + 12), beat * 4.1, 0.3, 0.6, -0.004), 0.008 * inten)
            add(buf, t, tone(midi(chord[0] - 12), beat * 4, "sin", 0.08, 2.0), 0.09)
            if t >= t_fight or t < t_hope:
                for m in chord:
                    add(buf, t, choir(m + 12, beat * 4.2), 0.02 * inten)
        # ostinato de cordas no confronto
        if t_fight <= t < t_win:
            for k in range(4):
                n = chord[(b * 4 + k) % 3] + 12
                add(buf, t + k * beat / 4, saw(midi(n), beat / 4 * 0.9, 0.005, 0.05), 0.02 * inten)
        if prog is win:                            # metais na vitória
            for m in chord:
                add(buf, t, saw(midi(m + 12), beat * 0.95, 0.03, 0.2), 0.022)
        # percussão
        if t < t_hope or t >= t_fight:
            add(buf, t, taiko, (0.5 if b % 2 == 0 else 0.25) * inten)
            if t >= t_fight:
                add(buf, t + beat * 0.5, tom, 0.18 * inten)
                if b % 2 == 1:
                    add(buf, t, snare, 0.12 * inten)
            if b % 4 == 3:
                for k in range(3):
                    add(buf, t + beat * (0.25 + k * 0.25), tom, 0.2 * inten)
        else:
            add(buf, t, taiko, 0.18 if b % 4 == 0 else 0.0)
        b += 1
    # riser antes do lançamento e golpe no impacto
    rn = int((t_rel - (t_rel - 2.2)) * SR)
    rt = np.arange(rn) / SR
    riser = rng.uniform(-1, 1, rn) * (rt / rt[-1]) ** 2 * 0.5 + np.sin(2 * np.pi * np.cumsum(200 + 900 * (rt / rt[-1]) ** 2) / SR) * (rt / rt[-1]) ** 2 * 0.3
    add(buf, t_rel - 2.2, riser, 0.25)
    add(buf, t_hit, taiko, 1.2)
    for m in (38, 45, 50, 57):
        add(buf, t_hit, saw(midi(m), 2.6, 0.005, 2.0), 0.03)
    # corta exatamente onde começa o encerramento original
    cut = int(t_end * SR)
    fo = int(0.25 * SR)
    buf[cut - fo:cut] *= np.linspace(1, 0.6, fo)
    buf[cut:] = 0
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

    def giant_step():
        c = boom(1.0, 34)
        add(c, 0.0, filt_noise(0.25, 0.3) * env(int(0.25 * SR), 0.001, 0.05), 0.6)       # terra
        for f in (420, 980):                                                             # armadura balançando
            add(c, 0.05, tone(f, 0.25, "sin", 0.001, 0.06), 0.08)
        return c

    def step():                                                                          # passo do Davi (terra)
        n = int(0.12 * SR)
        return filt_noise(0.12, 0.25) * env(n, 0.002, 0.03) * 1.5

    def laugh():
        c = np.zeros(int(1.8 * SR))
        for i in range(6):
            n = int(0.18 * SR)
            t = np.arange(n) / SR
            f = 110 - i * 4
            v = (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2 * t) + 0.3 * np.sign(np.sin(2 * np.pi * f * 3 * t))) * env(n, 0.01, 0.07)
            add(c, i * 0.24, v, 0.5)
        return c

    def swing(d=0.22, bright=0.35):
        return filt_noise(d, bright) * np.sin(np.linspace(0, np.pi, int(d * SR))) * 1.6

    def clank(g=1.0):
        c = np.zeros(int(0.8 * SR))
        for f in [523, 1245, 2100, 3170]:
            add(c, 0, tone(f, 0.7, "sin", 0.001, 0.15), 0.22 * g)
        n = int(0.05 * SR)
        add(c, 0, rng.uniform(-1, 1, n) * env(n, 0.001, 0.01), 0.4 * g)
        return c

    def crack():                                                                         # pedra na testa
        c = np.zeros(int(2.0 * SR))
        n = int(0.03 * SR)
        add(c, 0, rng.uniform(-1, 1, n) * env(n, 0.0005, 0.008), 1.0)
        add(c, 0, clank(1.2), 0.9)
        add(c, 0, boom(1.6, 55), 0.8)
        for k in range(4):                                                                # eco
            add(c, 0.12 + k * 0.13, rng.uniform(-1, 1, n) * env(n, 0.0005, 0.01), 0.25 / (k + 1))
        return c

    def stone():
        n = int(0.06 * SR)
        return rng.uniform(-1, 1, n) * env(n, 0.001, 0.012)

    def baa():
        n = int(0.5 * SR)
        t = np.arange(n) / SR
        f = 380 + 30 * np.sin(t * 40)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.6 + 0.4 * np.sin(t * 60)) * env(n, 0.03, 0.25)

    def crowd(d=2.5, fade=True):
        x = filt_noise(d, 0.25) * 1.6
        n = len(x)
        e = np.minimum(1, np.arange(n) / (0.3 * SR))
        return x * e * (np.linspace(1, 0.2, n) if fade else 1)

    def horn(d=1.8):
        n = int(d * SR)
        t = np.arange(n) / SR
        f = midi(45) * (1 + 0.006 * np.sin(2 * np.pi * 5 * t))
        ph = 2 * np.pi * np.cumsum(f) / SR
        return (np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.3 * np.sin(3 * ph) + 0.2 * np.sin(4 * ph)) * np.minimum(1, t / 0.2) * np.minimum(1, (d - t) / 0.5)

    def chime():
        c = np.zeros(int(1.6 * SR))
        for i, m in enumerate([74, 78, 81, 86]):
            add(c, i * 0.09, tone(midi(m), 1.0, "sin", 0.002, 0.5), 0.25)
        return c

    def battle_bed(d):                                                                   # ambiente de batalha
        c = crowd(d, fade=False) * 0.35
        t = 0.3
        while t < d - 0.5:
            add(c, t, clank(0.35), rng.uniform(0.15, 0.35))
            t += rng.uniform(0.6, 1.4)
        return c

    b = lambda k: s[k]["start"] - 0.12
    # gancho: pisadas do gigante (sincronizadas com o passo da animação)
    for k in range(3):
        add(buf, 0.05 + k * (np.pi / 4), giant_step(), 0.9 - k * 0.1)
    add(buf, 0.42, horn(1.2), 0.15)
    add(buf, b("d2"), battle_bed(b("d4") - b("d2")), 0.5)
    add(buf, b("d3") + 0.1, horn(1.8), 0.22)
    add(buf, s["d3"]["start"] + 0.3, boom(1.5, 36), 0.5)
    add(buf, s["d4"]["start"] + 0.5, baa(), 0.35)
    add(buf, s["d5"]["start"] + (s["d5"]["end"] - s["d5"]["start"]) * 0.5, chime(), 0.6)
    for i in range(3):
        add(buf, s["d6"]["start"] + 1.6 + i * 0.4, clank(), 0.4)
    for i in range(5):
        add(buf, s["d7"]["start"] + 1.4 + i * 0.32, stone(), 0.6)
    add(buf, b("d8"), battle_bed(b("d10") - b("d8")), 0.35)
    add(buf, s["d8"]["start"] + 0.2, laugh(), 0.8)
    # passos do Davi (walkLegs: velocidade 7 na cena 8, 5 na cena 9)
    t = b("d8")
    while t < b("d9"):
        add(buf, t, step(), 0.45); t += np.pi / 7
    t = b("d9")
    while t < b("d10"):
        add(buf, t, step(), 0.5); t += np.pi / 5
    # funda girando: um "vush" a cada volta, acelerando como na animação
    d10 = s["d10"]
    t_spin = d10["start"] + (d10["end"] - d10["start"]) * 0.42
    t_rel = d10["end"] - 0.15
    t_hit = s["d11"]["start"] + 0.35
    tt, last = t_spin, 0
    while tt < t_rel:
        sp = 6 + 14 * min(1, (tt - t_spin) / (t_rel - t_spin))
        ang = (tt - t_spin) * sp
        if ang >= last:
            add(buf, tt, swing(0.2, 0.3 + 0.2 * min(1, (tt - t_spin) / (t_rel - t_spin))), 0.55)
            last += 2 * np.pi
        tt += 0.005
    add(buf, t_rel, whoosh(0.7), 0.8)                                  # soltou a pedra
    add(buf, t_hit, crack(), 1.0)                                      # impacto na testa
    fall_end = s["d11"]["end"] - 0.1
    add(buf, t_hit + 1.1, clank(0.8), 0.5)                             # lança cai
    add(buf, fall_end, boom(2.6, 28), 1.1)                             # queda do gigante
    add(buf, fall_end, clank(1.0), 0.5)
    add(buf, fall_end, filt_noise(1.5, 0.08) * env(int(1.5 * SR), 0.005, 0.5), 0.8)
    add(buf, s["d12"]["start"], crowd(3.5), 0.6)
    # transições
    for k in ["d2", "d3", "d4", "d5", "d6", "d7", "d8", "d9", "d12"]:
        add(buf, b(k) - 0.2, whoosh(0.35), 0.3)
    cut = int((s[ENDING_ID]["start"] - 0.12) * SR)
    buf[cut:] = 0
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
            if sid not in KEEP_TIMING:          # tira o silêncio sobrando antes/depois da fala
                sa0, sb0 = base.speech_bounds(d)
                d = d[int(max(0, sa0 - 0.06) * SR): int(min(len(d) / SR, sb0 + 0.2) * SR)]
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
