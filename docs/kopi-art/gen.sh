#!/bin/zsh
# Paints one Kopi Peng Brawl job with Codex: zsh gen.sh <id> [extra reference images ...], run inside the folder of
# paintings (or set ART_DIR). The job's line in jobs.txt is <id>|<size>|<prompt>. Every job gets the approved mock-up
# (kopi-play.png, the kung-fu comic style) as its style reference; hero jobs add ref-pair.png and the hero's model sheet.
D=${ART_DIR:-$PWD}
cd $D
IFS='|' read -r id size prompt <<< "$(grep "^$1|" jobs.txt)"
[[ -z $id ]] && { echo "no job $1"; exit 1; }
[[ -f $D/$id.png ]] && { echo "$id exists"; exit 0; }
shift
refs=(-i $D/kopi-play.png)
for r in "$@"; do refs+=(-i $D/$r); done
codex exec --skip-git-repo-check -C $D -s workspace-write -o $D/last-$id.txt "Generate ONE image with your image generation tool and save it in this folder as $id.png ($size). Do not write any other files and do not draw it with code. STYLE (match the attached kopi-play.png exactly): a 1980s Hong Kong kung-fu comic (manhua) come alive: bold black brush-ink outlines with weight variation, flat printed colours slightly off-register, light halftone-dot shading, no soft gradients, no painterly blending. $prompt" $refs < /dev/null > $D/log-$id.txt 2>&1
echo "$id exit $? $(ls -la $D/$id.png 2>&1 | awk '{print $5}')"
