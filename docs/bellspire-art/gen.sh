#!/bin/zsh
# Paints one Bellspire job with Codex: zsh gen.sh <id> [reference images ...], run inside the folder of paintings.
# The job's line in jobs.txt is <id>|<size>|<prompt>. References are earlier paintings to edit or match (a hero
# outfit is an edit of the hero's base sheet; a boss's second form is painted from its first), plus ref-pair.png for
# Dora's and Enzo's faces and fur. Then: python3 scripts/bellspire-art.py <this folder>.
D=${ART_DIR:-$PWD}
cd $D
IFS='|' read -r id size prompt <<< "$(grep "^$1|" jobs.txt)"
[[ -f $D/$id.png ]] && { echo "$id exists"; exit 0; }
shift
refs=()
for r in "$@"; do refs+=(-i $D/$r); done
codex exec --skip-git-repo-check -C $D -s workspace-write -o $D/last-$id.txt "Generate ONE image with your image generation tool and save it in this folder as $id.png ($size). $prompt" $refs < /dev/null > $D/log-$id.txt 2>&1
echo "$id exit $? $(ls -la $D/$id.png 2>&1 | awk '{print $5}')"
