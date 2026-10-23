#!/usr/bin/env bash
# Builds the Grumble Hunt look test into one self-contained HTML page, then optionally takes
# screenshots. Run from the repo root:
#   bash docs/grumble-hunt/look-test/build.sh                 # page only, path printed at the end
#   bash docs/grumble-hunt/look-test/build.sh '[["idle","?portrait=0.9"],["slam","?portrait=-4&pose=0.22"]]'
# URL options: ?portrait=<side offset> puts the camera in front of Dora; ?pose=<seconds> freezes
# her hammer swing at that time (0.12 wind-up, 0.22 slam, 0.35 follow-through).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$HERE/../../.." && pwd)"
OUT="${OUT:-$(mktemp -d)}"; SHOTS="${SHOTS:-$OUT}"; export OUT SHOTS
NODE_PATH="$REPO/node_modules" "$REPO/node_modules/.bin/esbuild" "$HERE/main.ts.txt" --loader:.txt=ts --bundle --minify --format=iife --target=es2020 --outfile="$OUT/bundle.js" --log-level=warning
node -e "const fs=require('fs');const b=fs.readFileSync(process.env.OUT+'/bundle.js','utf8').replace(/<\/script/gi,'<\\\\/script');fs.writeFileSync(process.env.OUT+'/grumble-hunt-look-test.html',fs.readFileSync('$HERE/shell.html','utf8').replace('/*BUNDLE*/',()=>{const d='$REPO/public/art/hunt/',art={};for(const f of fs.readdirSync(d))if(!f.startsWith('ref-')&&f.endsWith('.webp'))art[f.slice(0,-5)]='data:image/webp;base64,'+fs.readFileSync(d+f).toString('base64');return 'window.HUNT_ART='+JSON.stringify(art)+';\\n'+b;}));"
if [ -n "${1:-}" ]; then node "$HERE/shots.cjs" "$1"; fi
echo "$OUT/grumble-hunt-look-test.html"
