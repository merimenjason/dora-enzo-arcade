#!/bin/zsh
# Paints one Brinelight job with Codex: zsh gen.sh <id> [extra reference images ...], run inside the folder of
# paintings (or set ART_DIR). The job's line in jobs.txt is <id>|<size>|<prompt>. Every job gets the two mock-ups
# (brine-play.png, brine-boss.png) as style references; hero jobs add ref-pair.png (copied from
# docs/bellspire-art/) and the first hero sheet, foe jobs add the foe's first sheet. Then:
# python3 scripts/brinelight-art.py <this folder>.
D=${ART_DIR:-$PWD}
cd $D
IFS='|' read -r id size prompt <<< "$(grep "^$1|" jobs.txt)"
[[ -z $id ]] && { echo "no job $1"; exit 1; }
[[ -f $D/$id.png ]] && { echo "$id exists"; exit 0; }
shift
refs=(-i $D/brine-play.png -i $D/brine-boss.png)
for r in "$@"; do refs+=(-i $D/$r); done
codex exec --skip-git-repo-check -C $D -s workspace-write -o $D/last-$id.txt "Generate ONE image with your image generation tool and save it in this folder as $id.png ($size). Do not write any other files and do not draw it with code. $prompt" $refs < /dev/null > $D/log-$id.txt 2>&1
echo "$id exit $? $(ls -la $D/$id.png 2>&1 | awk '{print $5}')"
