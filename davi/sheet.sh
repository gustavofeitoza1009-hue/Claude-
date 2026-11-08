#!/usr/bin/env bash
# uso: ./sheet.sh 1.5,3.6,...  -> build/sheet.jpg (prévia em grade)
set -e; cd "$(dirname "$0")"
node render.mjs --preview "$1" 2>&1 | grep -i "error" || true
args=(); f=""; i=0
IFS=',' read -ra T <<< "$1"
for t in "${T[@]}"; do args+=(-i "build/preview/t$(printf '%.2f' $t).jpg"); f="$f[$i]scale=240:-1[v$i];"; i=$((i+1)); done
ins=$(for j in $(seq 0 $((i-1))); do printf "[v$j]"; done)
lay=$(python3 -c "print('|'.join(f'{(k%6)*240}_{(k//6)*427}' for k in range($i)))")
ffmpeg -y -loglevel error "${args[@]}" -filter_complex "${f}${ins}xstack=inputs=$i:layout=$lay:fill=black" build/sheet.jpg
