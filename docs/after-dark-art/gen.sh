#!/bin/zsh
# Paints one job with Codex: zsh gen.sh <id> [reference images in raw/ ...]
# jobs.txt lines are <id>|<size>|<prompt>; {PRE}, {HERO}, {SHEET}, {GSHEET} expand from the lines starting with @.
D=/Users/jasonchua/arcade-protos/arcade-art/raw
J=/Users/jasonchua/arcade-protos/arcade-tools/jobs.txt
cd $D
line="$(grep "^$1|" $J)"
[[ -z $line ]] && { echo "no job $1"; exit 1; }
[[ -f $D/$1.png ]] && { echo "$1 exists"; exit 0; }
IFS='|' read -r id size prompt <<< "$line"
for k in PRE HERO SHEET GSHEET; do v="$(grep "^@$k|" $J | cut -d'|' -f2-)"; prompt="${prompt//\{$k\}/$v}"; done
shift
refs=()
for r in "$@"; do refs+=(-i $D/$r); done
codex exec --skip-git-repo-check -C $D -s workspace-write -o $D/last-$id.txt "Generate ONE image with your image generation tool and save it in this folder as $id.png ($size). Do not write any other files and do not draw it with code. $prompt" $refs < /dev/null > $D/log-$id.txt 2>&1
echo "$id exit $? $(ls -la $D/$id.png 2>&1 | awk '{print $5}')"
