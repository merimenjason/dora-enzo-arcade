#!/bin/zsh
# Paints every After Dark job that is still missing (4 at a time), then keys and packs them into arcade/img.
# Run after the Codex usage limit resets:  zsh /Users/jasonchua/arcade-protos/arcade-tools/run-art.sh
# Review: python3 sheet.py ../arcade-art/packed.jpg <atlas names>  (one downscaled contact sheet per batch)
T=/Users/jasonchua/arcade-protos/arcade-tools
R=/Users/jasonchua/arcade-protos/arcade-art/raw
HR="ref-pair.png ref-hub.png ref-castle.png ref-sea.png"
typeset -A REFS
REFS=(
  enzo-cloud    "$HR dora-cloud.png"
  dora-cloud2   "$HR dora-cloud.png"
  enzo-cloud2   "$HR enzo-cloud.png"
  dora-hubx     "$HR"
  enzo-hubx     "$HR"
  dora-seax     "$HR"
  enzo-seax     "$HR"
  dora-castlex  "$HR"
  enzo-castlex  "$HR"
  cloud-bg      "ref-cabs.png ref-bgs.png"
  cloud-props   "ref-cabs.png ref-castleprops.png cloud-bg.png"
  castle-wall   "ref-castleprops.png ref-bgs.png"
  castle-props2 "ref-castleprops.png ref-bgs.png"
  armour        "ref-castleprops.png"
  sea-props2    "ref-seaprops.png ref-bgs.png"
  giant         "ref-static.png ref-bgs.png"
  ui2           "ref-ui.png"
  pearls        "ref-seaprops.png ref-ui.png"
)
# order matters: enzo-cloud2 needs enzo-cloud as a reference
ORDER=(enzo-cloud dora-cloud2 dora-hubx enzo-hubx cloud-props castle-wall castle-props2 armour sea-props2 ui2 pearls enzo-cloud2 dora-seax enzo-seax dora-castlex enzo-castlex)
n=0
for id in $ORDER; do
  [[ -f $R/$id.png ]] && continue
  zsh $T/gen.sh $id ${=REFS[$id]} &
  (( ++n % 4 == 0 )) && wait
  [[ $id == ui2 ]] && wait
done
wait
grep -l "usage limit" $R/log-*.txt 2>/dev/null | while read f; do b=${f:t:r}; [[ -f $R/${b#log-}.png ]] || echo "still missing (limit): ${b#log-}"; done
python3 $T/art.py
