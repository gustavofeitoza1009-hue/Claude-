"""Gera a narração (espeak-ng + mbrola pt-BR), trilha e efeitos sonoros.

Saídas em build/: narration.wav, music.wav, sfx.wav e timeline.json
(início/fim de cada fala, usado pela animação para sincronizar legendas e cenas).
"""
import json
import os
import subprocess
import wave

import numpy as np

SR = 22050
OUT = os.path.join(os.path.dirname(__file__), "build")
os.makedirs(OUT, exist_ok=True)

NARR = ("mb-br3", 152, 52)   # narrador
PRIMO = ("mb-br1", 150, 72)
MAE = ("mb-br4", 150, 62)
AMIGO = ("mb-br1", 150, 40)

# id, voz, texto falado, legenda, pausa depois (s)
SEGMENTS = [
    ("s1", NARR, "Imagina acordar amanhã, e descobrir que tem, um bilhão de reais, na sua conta!",
     "Imagina acordar amanhã e descobrir que tem UM BILHÃO de reais na sua conta!", 0.6),
    ("s2", NARR, "Primeira coisa: você ia olhar o saldo, umas quinze vezes, porque ia achar que o banco tava bugado.",
     "Primeira coisa: você ia olhar o saldo umas 15 vezes, porque ia achar que o banco tava bugado.", 0.55),
    ("s3", NARR, "Depois, compraria uma mansão, uma Ferrari, e provavelmente até um mercado...",
     "Depois, compraria uma mansão, uma Ferrari e provavelmente até um mercado…", 0.1),
    ("s4", NARR, "só pra nunca mais ouvir, que acabou o presunto.",
     "…só pra nunca mais ouvir que acabou o presunto.", 0.7),
    ("s5", NARR, "Mas calma, porque tem um problema...",
     "Mas calma, porque tem um problema…", 0.6),
    ("s6", NARR, "Seus parentes iam descobrir.",
     "Seus parentes iam descobrir.", 0.55),
    ("s7", NARR, "Aquele primo que você não vê há oito anos ia mandar:",
     "Aquele primo que você não vê há 8 anos ia mandar:", 0.1),
    ("s7b", PRIMO, "E aí, irmão! Saudades!",
     "\"E aí, irmão, saudades!\"", 0.6),
    ("s8", NARR, "Seu amigo que te deve vinte reais, ia aparecer com uma proposta de sociedade.",
     "Seu amigo que te deve 20 reais ia aparecer com uma proposta de sociedade.", 0.6),
    ("s9", NARR, "E sua mãe? Ia falar:",
     "E sua mãe? Ia falar:", 0.1),
    ("s9b", MAE, "Já que você tá rico, paga a conta de luz!",
     "\"Já que você tá rico, paga a conta de luz!\"", 0.75),
    ("s10", NARR, "Mas o pior, vem agora...",
     "Mas o pior vem agora…", 0.7),
    ("s11", NARR, "Você acorda, pega o celular, abre o aplicativo do banco...",
     "Você acorda, pega o celular, abre o aplicativo do banco…", 0.6),
    ("s12", NARR, "E percebe, que era tudo um sonho.",
     "E percebe que era tudo um sonho.", 0.7),
    ("s13", NARR, "E o pior: você ainda tá devendo os vinte reais pro seu amigo!",
     "E o pior: você ainda tá devendo os 20 reais pro seu amigo!", 0.0),
]
LEAD_IN = 1.4
TAIL = 3.0


def tts(voice, text, path):
    v, speed, pitch = voice
    subprocess.run(["espeak-ng", "-v", v, "-s", str(speed), "-p", str(pitch),
                    "-w", path, text], check=True, capture_output=True)


def read_wav(path):
    with wave.open(path) as w:
        sr = w.getframerate()
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    if sr != SR:
        idx = np.linspace(0, len(data) - 1, int(len(data) * SR / sr))
        data = np.interp(idx, np.arange(len(data)), data)
    # corta silêncio nas pontas
    nz = np.where(np.abs(data) > 0.01)[0]
    if len(nz):
        data = data[max(0, nz[0] - 200): nz[-1] + 400]
    return data


def write_wav(path, data):
    data = np.clip(data, -1, 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((data * 32767).astype(np.int16).tobytes())


def main():
    clips, timeline = [], []
    t = LEAD_IN
    for sid, voice, spoken, caption, pause in SEGMENTS:
        p = os.path.join(OUT, f"{sid}.wav")
        tts(voice, spoken, p)
        d = read_wav(p)
        dur = len(d) / SR
        clips.append((t, d))
        timeline.append({"id": sid, "start": round(t, 3), "end": round(t + dur, 3), "caption": caption,
                         "speaker": "primo" if voice is PRIMO else "mae" if voice is MAE else "narrador"})
        t += dur + pause
    total = t + TAIL
    print(f"duração total: {total:.2f}s")
    assert total <= 55.0, "passou de 55 segundos!"

    n = int(total * SR)
    narr = np.zeros(n)
    for start, d in clips:
        i = int(start * SR)
        narr[i:i + len(d)] += d * 0.95
    write_wav(os.path.join(OUT, "narration.wav"), narr)

    seg = {s["id"]: s for s in timeline}
    write_wav(os.path.join(OUT, "music.wav"), music(total, seg))
    write_wav(os.path.join(OUT, "sfx.wav"), sfx(total, seg))
    with open(os.path.join(OUT, "timeline.json"), "w") as f:
        json.dump({"duration": round(total, 3), "segments": timeline}, f, ensure_ascii=False, indent=1)


# ---------------- trilha sintetizada ----------------
def env(n, a=0.005, r=0.2):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-t / r)


def tone(freq, dur, kind="tri", a=0.005, r=0.25):
    n = int(dur * SR)
    t = np.arange(n) / SR
    ph = (freq * t) % 1
    if kind == "tri":
        w = 2 * np.abs(2 * ph - 1) - 1
    elif kind == "sq":
        w = np.sign(np.sin(2 * np.pi * freq * t)) * 0.5
    else:
        w = np.sin(2 * np.pi * freq * t)
    return w * env(n, a, r)


def add(buf, t, clip, g=1.0):
    i = int(t * SR)
    if i >= len(buf):
        return
    clip = clip[: len(buf) - i]
    buf[i:i + len(clip)] += clip * g


def midi(m):
    return 440 * 2 ** ((m - 69) / 12)


def music(total, seg):
    buf = np.zeros(int(total * SR))
    bpm = 112
    beat = 60 / bpm
    happy = [(60, 64, 67), (57, 60, 64), (65, 69, 72), (67, 71, 74)]   # C Am F G
    tense = [(57, 60, 64), (53, 57, 60), (52, 56, 59), (57, 60, 64)]   # Am F E Am
    rng = np.random.default_rng(1)
    hat = rng.uniform(-1, 1, int(0.04 * SR)) * env(int(0.04 * SR), 0.001, 0.012)
    kick_n = int(0.25 * SR)
    kt = np.arange(kick_n) / SR
    kick = np.sin(2 * np.pi * (50 + 90 * np.exp(-kt * 30)) * kt) * env(kick_n, 0.001, 0.12)

    t_tense = seg["s5"]["start"] - 0.2
    t_dream = seg["s10"]["start"] - 0.2
    t_end = seg["s12"]["start"]
    b = 0
    while b * beat < total - 1.0:
        t = b * beat
        if t_dream <= t < t_end:      # silêncio de suspense
            b += 1
            continue
        mood = tense if t >= t_tense else happy
        if t >= t_end:
            mood = [(57, 60, 63), (56, 59, 62)]   # tristinho
        chord = mood[(b // 4) % len(mood)]
        if b % 4 == 0:
            for m in chord:
                add(buf, t, tone(midi(m), beat * 4, "sin", 0.05, 1.2), 0.05)
        add(buf, t, tone(midi(chord[0] - 24), beat * 0.9, "tri", 0.005, 0.18), 0.22)
        if t < t_tense:
            # melodia bobinha
            note = chord[(b * 7) % 3] + 12
            add(buf, t + beat * 0.5, tone(midi(note), beat * 0.4, "sq", 0.003, 0.08), 0.035)
        add(buf, t, kick, 0.35 if b % 2 == 0 else 0.0)
        add(buf, t + beat / 2, hat, 0.08)
        b += 1
    # fade out
    fo = int(1.5 * SR)
    buf[-fo:] *= np.linspace(1, 0, fo)
    return buf * 0.8


def sfx(total, seg):
    buf = np.zeros(int(total * SR))
    rng = np.random.default_rng(2)

    def whoosh(d=0.35):
        n = int(d * SR)
        noise = rng.uniform(-1, 1, n)
        # filtro passa-baixa variável simples
        out = np.zeros(n)
        a = np.linspace(0.02, 0.4, n) * np.sin(np.linspace(0, np.pi, n))
        acc = 0
        for i in range(n):
            acc += a[i] * (noise[i] - acc)
            out[i] = acc
        return out * np.sin(np.linspace(0, np.pi, n)) * 1.5

    def ding(f=1320):
        return tone(f, 0.5, "sin", 0.002, 0.15) + tone(f * 1.5, 0.5, "sin", 0.002, 0.1) * 0.5

    def kaching():
        c = np.zeros(int(0.8 * SR))
        for i, f in enumerate([2093, 2637, 3136, 4186]):
            add(c, i * 0.05, tone(f, 0.6, "sin", 0.001, 0.2), 0.3)
        n = int(0.1 * SR)
        add(c, 0, rng.uniform(-1, 1, n) * env(n, 0.001, 0.03), 0.4)
        return c

    def boom():
        n = int(1.2 * SR)
        t = np.arange(n) / SR
        return np.sin(2 * np.pi * (35 + 60 * np.exp(-t * 6)) * t) * env(n, 0.002, 0.5)

    def scratch():
        n = int(0.5 * SR)
        t = np.arange(n) / SR
        f = 400 + 900 * np.sin(t * 25) ** 2
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * rng.uniform(0.5, 1, n) * env(n, 0.002, 0.25)

    def sad_trombone():
        c = np.zeros(int(2.4 * SR))
        for i, m in enumerate([55, 54, 53, 52]):
            d = 0.45 if i < 3 else 1.1
            add(c, i * 0.45, tone(midi(m), d, "sq", 0.02, d), 0.35)
        return c

    def pop():
        n = int(0.08 * SR)
        t = np.arange(n) / SR
        return np.sin(2 * np.pi * (900 - 6000 * t) * t) * env(n, 0.001, 0.03)

    s = seg
    add(buf, 0.0, tone(880, 0.12, "sq", 0.001, 0.05), 0.15)            # despertador
    add(buf, 0.15, tone(880, 0.12, "sq", 0.001, 0.05), 0.15)
    add(buf, s["s1"]["start"] + 2.3, kaching(), 0.9)
    for i in range(15):                                                 # 15 checagens
        add(buf, s["s2"]["start"] + 0.9 + i * 0.22, pop(), 0.35)
    for k in ["s3", "s5", "s6", "s10", "s11"]:
        add(buf, s[k]["start"] - 0.25, whoosh(), 0.5)
    add(buf, s["s3"]["start"] + 1.2, kaching(), 0.5)
    add(buf, s["s5"]["start"], boom(), 0.8)
    add(buf, s["s7b"]["start"] - 0.1, ding(), 0.5)
    add(buf, s["s8"]["start"] + 0.2, ding(1500), 0.5)
    add(buf, s["s9"]["start"], ding(1100), 0.5)
    add(buf, s["s12"]["start"] - 0.1, scratch(), 0.7)
    add(buf, s["s13"]["end"] + 0.1, sad_trombone(), 0.7)
    return buf


if __name__ == "__main__":
    main()
