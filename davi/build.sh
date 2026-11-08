#!/usr/bin/env bash
# Edição final: renderiza a parte nova e cola o ENCERRAMENTO ORIGINAL intacto
# (encerramento_original.mp4: vídeo + áudio exatamente como estavam).
set -euo pipefail
cd "$(dirname "$0")"
[ -d node_modules/three ] || npm install
python3 build_audio.py
CUT=$(python3 -c "import json;d=json.load(open('build/timeline.json'));s={x['id']:x for x in d['segments']};print(s['d13']['start']-0.12)")
FR=$(python3 -c "import math;print(math.ceil($CUT*30-1e-6))")
FRONT=$(python3 -c "print($FR/30)")
echo "parte nova: 0 .. ${FRONT}s ($FR quadros)"
if [ "${SKIP_RENDER:-0}" != "1" ]; then
  for i in 0 1 2; do node render.mjs --part $i/3 --until "$FRONT" & done
  wait
fi
printf "file 'part0.mp4'\nfile 'part1.mp4'\nfile 'part2.mp4'\n" > build/parts.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i build/parts.txt -c copy build/front_video.mp4
# mixagem da parte nova: narração clara e na frente, música abaixando sob a voz
ffmpeg -y -loglevel error -i build/narration.wav -i build/music.wav -i build/sfx.wav -filter_complex "\
[0]highpass=f=90,equalizer=f=3000:t=q:w=1.2:g=3,acompressor=threshold=-20dB:ratio=3.5:attack=5:release=120,volume=2.2,asplit[n1][n2];\
[1]volume=0.6[m];[m][n2]sidechaincompress=threshold=0.03:ratio=8:attack=10:release=350[md];\
[2]volume=0.9[fx];[md][n1][fx]amix=inputs=3:normalize=0,alimiter=limit=0.95,atrim=0:${FRONT},afade=t=out:st=$(python3 -c "print($FRONT-0.04)"):d=0.04[a]" \
  -map "[a]" -ar 44100 -ac 2 build/front_audio_raw.wav
ffmpeg -y -loglevel error -i build/front_audio_raw.wav -af loudnorm=I=-14:TP=-1.5:LRA=9 -ar 44100 -ac 2 build/front_audio.wav
# junta: parte nova + encerramento original (sem alterações)
ffmpeg -y -loglevel error -i build/front_video.mp4 -i build/front_audio.wav -i encerramento_original.mp4 -filter_complex "\
[0:v]trim=end_frame=${FR},setpts=PTS-STARTPTS,fps=30,format=yuv420p[v0];[1:a]aformat=sample_rates=44100:channel_layouts=stereo,apad,atrim=0:${FRONT}[a0];\
[2:v]fps=30,format=yuv420p,setpts=PTS-STARTPTS[v1];[2:a]aformat=sample_rates=44100:channel_layouts=stereo,asetpts=PTS-STARTPTS[a1];\
[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]" -map "[v]" -map "[a]" -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart davi-e-golias.mp4
echo "Pronto: $(pwd)/davi-e-golias.mp4"
