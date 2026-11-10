#!/bin/zsh
# Paints one Salt & Dust job with Codex: zsh gen.sh <id>, run with ART_DIR set to the folder of paintings.
D=${ART_DIR:-$PWD}
cd $D
IFS='|' read -r id size refs prompt <<< "$(grep "^$1|" jobs.txt)"
[[ -f $D/$id.png ]] && { echo "$id exists"; exit 0; }
r=(); for f in ${=refs}; do r+=(-i $D/$f); done
codex exec --skip-git-repo-check -C $D -s workspace-write -o $D/last-$id.txt "Generate ONE image with your image generation tool and save it in this folder as $id.png ($size). Do not commit or push anything, and do not touch any git repository. $prompt" $r < /dev/null > $D/log-$id.txt 2>&1
echo "$id exit $? $(ls -la $D/$id.png 2>&1 | awk '{print $5}')"
