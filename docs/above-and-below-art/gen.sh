#!/bin/zsh
# zsh gen.sh <id> [refs...]  — paints one job from jobs.txt (<id>|<size>|<prompt>) with Codex image gen
D=${ART_DIR:-$PWD}   # the folder of paintings (and jobs.txt)
cd $D
IFS='|' read -r id size prompt <<< "$(grep "^$1|" jobs.txt)"
out=${OUT:-$id}
[[ -f $D/$out.png ]] && { echo "$out exists"; exit 0; }
shift
refs=()
for r in "$@"; do refs+=(-i $D/$r); done
codex exec --skip-git-repo-check -C $D -s workspace-write -o $D/last-$out.txt "Generate ONE image with your image generation tool and save it in this folder as $out.png ($size). Do not write or edit any other files. $prompt" $refs < /dev/null > $D/log-$out.txt 2>&1
echo "$out exit $? $(ls -la $D/$out.png 2>&1 | awk '{print $5}')"
