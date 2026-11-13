#!/bin/zsh
# zsh gen.sh <id> [extra refs] -> paints <id>.png from prompts/<id>.txt ({SHEET} expands) + prompts/_style.txt
# size comes from the first line of the prompt file: portrait or landscape
D=/Users/jasonchua/arcade-protos/cloudpop/art-src
cd $D; id=$1; shift
[[ -f $D/$id.png ]] && { echo "$id exists"; exit 0; }
size=$(head -1 prompts/$id.txt); p=$(tail -n +2 prompts/$id.txt)
p=${p//\{SHEET\}/$(cat prompts/_sheet.txt)}
[[ $size == portrait ]] && dim="1024x1536 portrait" || dim="1536x1024 landscape"
refs=(-i $D/mock-play.png -i $D/mock-upgrade.png -i $D/ref-pair.png)
[[ $size == map ]] && refs=(-i $D/mock-play.png -i $D/guide-${id#map-}.png)
for r in "$@"; do refs+=(-i $D/$r); done
codex exec --skip-git-repo-check -C $D -s workspace-write -o $D/last-$id.txt "Generate ONE image with your image generation tool and save it in this folder as $id.png ($dim). Do not commit or push anything and do not touch any git repository. Do not edit or post-process the image with code; save exactly what the image tool produced. $p $(cat prompts/_style.txt)" $refs < /dev/null > $D/log-$id.txt 2>&1
echo "$id exit $? $(ls -la $D/$id.png 2>&1 | awk '{print $5}')"
