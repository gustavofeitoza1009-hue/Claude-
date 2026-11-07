"""Gera a narração (Piper TTS neural, voz pt-BR) e a linha do tempo das legendas.

Saídas: build/voice.wav e build/timeline.json
"""
import json, subprocess, wave, os
import numpy as np

SR = 22050
OUT = "build"
os.makedirs(OUT, exist_ok=True)

# (início do segmento, fim do segmento, [(voz, texto falado, texto da legenda)])
NARR = "mb-br3"
MOM = "mb-br4"
HERO = "mb-br1"
SEGMENTS = [
    (0.3, 5.0, [
        (NARR, "E se você acordasse amanhã com todos os poderes do Superman?", "E se você acordasse amanhã com TODOS os poderes do Superman?"),
        (NARR, "Mas tem um pequeno problema...", "Mas tem um pequeno problema..."),
    ]),
    (5.2, 15.0, [
        (NARR, "Você acorda, olha para sua mão, e percebe que consegue destruir uma parede com apenas um dedo.", "Você acorda, olha para sua mão e percebe que consegue destruir uma parede com apenas UM DEDO."),
        (NARR, "Sua primeira reação? Testar se consegue abrir um pote de azeitona. Afinal, prioridades!", "Sua primeira reação? Testar se consegue abrir um pote de AZEITONA. Afinal, prioridades!"),
    ]),
    (15.2, 25.0, [
        (NARR, "Você sai na rua, e descobre que consegue voar. Em dez segundos, já está acima das nuvens.", "Você sai na rua e descobre que consegue VOAR. Em 10 segundos, já está acima das nuvens."),
        (NARR, "Só que lembra que deixou o celular carregando em casa... e volta desesperado!", "Só que lembra que deixou o CELULAR carregando em casa... e volta desesperado!"),
    ]),
    (25.2, 37.0, [
        (NARR, "Depois, você descobre que tem visão de raio X.", "Depois, você descobre que tem visão de RAIO X."),
        (NARR, "Mas cuidado! Sua mãe percebe, e fala:", "Mas cuidado! Sua mãe percebe e fala:"),
        (MOM, "Já que consegue enxergar através das paredes, vai procurar meu chinelo que sumiu!", "\"Já que consegue enxergar através das paredes, vai procurar meu CHINELO que sumiu!\""),
    ]),
    (37.2, 50.0, [
        (NARR, "Você também fica praticamente invulnerável.", "Você também fica praticamente INVULNERÁVEL."),
        (NARR, "Seu amigo te dá um soco para testar, e acaba machucando a própria mão.", "Seu amigo te dá um soco para testar e acaba machucando a própria mão."),
        (NARR, "Você olha para ele e pergunta:", "Você olha para ele e pergunta:"),
        (HERO, "Quer tentar de novo?", "\"Quer tentar de novo?\""),
    ]),
    (50.2, 62.0, [
        (NARR, "Mas existe um problema: você esqueceu que ainda precisa ir para a escola.", "Mas existe um problema: você esqueceu que ainda precisa ir para a ESCOLA."),
        (NARR, "Agora imagina voar até lá, e chegar três horas antes, porque esqueceu que não precisa mais pegar ônibus!", "Agora imagina voar até lá e chegar 3 HORAS ANTES porque esqueceu que não precisa mais pegar ônibus!"),
    ]),
    (62.2, 70.0, [
        (NARR, "Agora me responde: se você tivesse os poderes do Superman por apenas vinte e quatro horas, qual seria a primeira coisa que faria?", "Agora me responde: se você tivesse os poderes do Superman por apenas 24 HORAS, qual seria a primeira coisa que faria?"),
        (NARR, "Comenta aí!", "COMENTA AÍ! 👇"),
    ]),
]

GAP = 0.22


MODEL = "voices/pt-br-edresson-low.onnx"
SEMITONES = {NARR: 0, MOM: 5, HERO: 1.5}


def tts(voice, text, speed, pitch):
    raw = f"{OUT}/_raw.wav"; path = f"{OUT}/_tmp.wav"
    subprocess.run(["python3", "-m", "piper", "-m", MODEL, "-f", raw, "--length-scale", f"{172 / speed:.3f}",
                    "--noise-scale", "0.6", "--noise-w-scale", "0.7"], input=text.encode(), check=True, capture_output=True)
    k = 2 ** (SEMITONES[voice] / 12)
    af = f"asetrate={int(16000 * k)},aresample={SR},atempo={1 / k:.4f}," if k != 1 else f"aresample={SR},"
    af += "highpass=f=70,equalizer=f=3000:t=q:w=1:g=3,acompressor=threshold=-18dB:ratio=3:attack=5:release=80"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", raw, "-af", af, "-ac", "1", "-ar", str(SR), path], check=True)
    with wave.open(path) as w:
        a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    nz = np.where(np.abs(a) > 0.01)[0]
    if len(nz):
        a = a[max(0, nz[0] - 200): nz[-1] + 600]
    return a


PITCH = {NARR: 0, MOM: 0, HERO: 0}
SPEED = 200          # ~ length_scale 0.86: ritmo natural
OLD = [0, 5, 15, 25, 37, 50, 62, 70]   # limites das cenas na animação original
LEAD, GAPL, TAIL = 0.3, 0.35, 0.7
segs = []
for (start, end, lines), o0, o1 in zip(SEGMENTS, OLD, OLD[1:]):
    clips = [tts(v, t, SPEED, 0) for v, t, _ in lines]
    speech = sum(len(c) for c in clips) / SR
    tail = (1.6 if o1 == OLD[-1] else TAIL) + {25: 1.5, 37: 1.6}.get(o0, 0)
    dur = max(o1 - o0, LEAD + speech + GAPL * (len(clips) - 1) + tail)
    segs.append((o0, o1, dur, lines, clips, speech))
TOTAL = round(sum(x[2] for x in segs), 2)
track = np.zeros(int(TOTAL * SR) + SR, dtype=np.float32)
timeline, timemap = [], []
n0 = 0.0
for o0, o1, dur, lines, clips, speech in segs:
    timemap.append([round(n0, 3), o0, round(n0 + dur, 3), o1])
    gap = GAPL + max(0, (dur - LEAD - speech - GAPL * (len(clips) - 1) - TAIL - {25: 1.5, 37: 1.6}.get(o0, 0))) / max(1, len(clips))
    t = n0 + LEAD
    for (v, _, cap), c in zip(lines, clips):
        d = len(c) / SR; i = int(t * SR)
        track[i:i + len(c)] += c
        timeline.append({"start": round(t, 3), "end": round(t + d, 3), "text": cap,
                         "speaker": {NARR: "narr", MOM: "mom", HERO: "hero"}[v]})
        t += d + gap
    print(f"cena {o0:>2}-{o1:<2}s -> {n0:6.2f}-{n0 + dur:6.2f}s (fala {speech:.2f}s)")
    n0 += dur
json.dump({"total": TOTAL, "segments": timemap}, open(f"{OUT}/timemap.json", "w"), indent=1)
track = track[: int(TOTAL * SR)]
track /= max(1e-6, np.abs(track).max()) / 0.9
with wave.open(f"{OUT}/voice.wav", "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((track * 32767).astype(np.int16).tobytes())
json.dump(timeline, open(f"{OUT}/timeline.json", "w"), ensure_ascii=False, indent=1)
os.remove(f"{OUT}/_tmp.wav"); os.remove(f"{OUT}/_raw.wav")
