"""Gera a narração (espeak-ng + MBROLA pt-BR) e a linha do tempo das legendas.

Saídas: build/voice.wav e build/timeline.json
"""
import json, subprocess, wave, os
import numpy as np

SR = 22050  # taxa nativa do mbrola br
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
TOTAL = 70.0
GAP = 0.22


def tts(voice, text, speed, pitch):
    path = f"{OUT}/_tmp.wav"
    subprocess.run(["espeak-ng", "-v", voice, "-s", str(speed), "-p", str(pitch), "-w", path, text],
                   check=True, capture_output=True)
    with wave.open(path) as w:
        sr = w.getframerate()
        a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    if sr != SR:
        idx = np.linspace(0, len(a) - 1, int(len(a) * SR / sr))
        a = np.interp(idx, np.arange(len(a)), a)
    # remove silêncio nas pontas
    nz = np.where(np.abs(a) > 0.01)[0]
    if len(nz):
        a = a[max(0, nz[0] - 200): nz[-1] + 600]
    return a


PITCH = {NARR: 55, MOM: 70, HERO: 45}
track = np.zeros(int(TOTAL * SR) + SR, dtype=np.float32)
timeline = []
for start, end, lines in SEGMENTS:
    speed = 172
    while True:
        clips = [tts(v, t, speed + (8 if v != NARR else 0), PITCH[v]) for v, t, _ in lines]
        dur = sum(len(c) for c in clips) / SR + GAP * (len(clips) - 1)
        if dur <= (end - start) - 0.15 or speed > 260:
            break
        speed += 8
    speech = sum(len(c) for c in clips) / SR
    gap = max(GAP, min(1.0, ((end - start) - 0.3 - speech) / max(1, len(clips))))
    t = start
    for (v, _, cap), c in zip(lines, clips):
        d = len(c) / SR
        i = int(t * SR)
        track[i:i + len(c)] += c * (1.0 if v == NARR else 1.1)
        timeline.append({"start": round(t, 3), "end": round(t + d, 3), "text": cap,
                         "speaker": {NARR: "narr", MOM: "mom", HERO: "hero"}[v]})
        t += d + gap
    print(f"seg {start:5.1f}-{end:5.1f}: speed {speed}, fala {dur:.2f}s")

track = track[: int(TOTAL * SR)]
track /= max(1e-6, np.abs(track).max()) / 0.9
with wave.open(f"{OUT}/voice.wav", "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((track * 32767).astype(np.int16).tobytes())
json.dump(timeline, open(f"{OUT}/timeline.json", "w"), ensure_ascii=False, indent=1)
os.remove(f"{OUT}/_tmp.wav")
