#!/usr/bin/env bash
# Gera o vídeo final: áudio -> render 3D (3 partes em paralelo) -> junta tudo.
# Requisitos: node, playwright (chromium), ffmpeg, python3 + numpy, espeak-ng + mbrola-br1/br3/br4
set -euo pipefail
cd "$(dirname "$0")"
[ -d node_modules/three ] || npm install
python3 build_audio.py
if [ "${SKIP_RENDER:-0}" != "1" ]; then
  for i in 0 1 2; do node render.mjs --part $i/3 & done
  wait
fi
printf "file 'part0.mp4'\nfile 'part1.mp4'\nfile 'part2.mp4'\n" > build/parts.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i build/parts.txt -c copy build/video_only.mp4
ffmpeg -y -loglevel error -i build/video_only.mp4 -i build/narration.wav -i build/music.wav -i build/sfx.wav \
  -filter_complex "[1]volume=1.6,acompressor=threshold=-18dB:ratio=3,asplit[n1][n2];[2]volume=0.55[m];[m][n2]sidechaincompress=threshold=0.05:ratio=6:release=300[md];[md][n1][3]amix=inputs=3:normalize=0,loudnorm=I=-14:TP=-1.5[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -ar 44100 -shortest -movflags +faststart um-bilhao.mp4
echo "Pronto: $(pwd)/um-bilhao.mp4"
