# Jade Street, the fifteenth pass's paintings: four new rides (a tandem bicycle at the East Coast Park racks, the
# ice-cream uncle's motorbike with its sidecar freezer on Orchard Road, a Skyline Luge cart on Sentosa and a dragon
# boat on the Singapore River at Clarke Quay), and both heroes' riding poses for them: the front and back saddles of
# the tandem, the motorbike and the sidecar, the luge, the paddle and the drum. The original source sheets live
# outside the repo, so these are packed into their own atlas by scripts/jade-art15.py (not the full rebuild).
from jobs import STYLE, CHIN, DORA, ENZO, MAG, TOP, L, REF, SREF

SG = ("The setting is SINGAPORE at night, painted warmly and respectfully. Absolutely NO lettering anywhere: no text, letters, "
 "numbers, logos, brand marks or flags; every sign or panel is a blank coloured shape. ")
J = {}

# ── the four rides, empty (top-down, facing up, like the attached vehicle sheet)
J['rides15'] = (L, SREF + ['vehicles.png', 'sg-rides.png'], STYLE + SG + "A game sprite sheet of four empty vehicles for a "
  "top-down city game, matching the attached vehicle sheet EXACTLY in viewing angle, ink outline, cel shading, chunky toy-like "
  "proportions and scale (the green bicycle in the attached sheet is the size guide). " + TOP + "A 4 by 1 grid: four tall cells side "
  "by side, one vehicle in each, nobody riding any of them. (1) a TANDEM BICYCLE: one long jade-green bicycle frame with TWO brown "
  "leather saddles one behind the other, curved handlebars with brown grips in front of EACH saddle, two sets of pedals, a front "
  "wheel at the top and a rear wheel at the bottom, a little brass bell and a small wire basket on the front, about twice as long "
  "as the attached single bicycle and just as narrow; (2) an old Singapore ICE-CREAM UNCLE'S MOTORBIKE with a SIDECAR on its RIGHT "
  "side: a small cream and sky-blue vintage motorbike with a round headlight, wide handlebars and a single brown seat, and bolted "
  "beside it a rounded sky-blue sidecar TUB with a padded cream seat for one passenger at its back and, at its front, a small white "
  "insulated FREEZER box with a pale blue lid and a stack of wafer biscuits on top; the whole thing about as wide as it is long; (3) "
  "a SKYLINE LUGE CART: a very low, small gravity cart like a plastic sled on four small black wheels, a bright orange moulded body "
  "with a scooped single seat, a chunky dark grey T-shaped steering handlebar at the front, white bumper rails round the sides, "
  "small and compact, a bit shorter than the attached bicycle and twice as wide; (4) a DRAGON BOAT: a very long, very NARROW "
  "wooden racing boat (about seven times as long as it is wide, filling the cell from top to bottom), a carved DRAGON HEAD with "
  "gold horns, big eyes and a curling red mane at the bow (at the top), a curled dragon TAIL at the stern (at the bottom), the "
  "hull's sides painted with red, gold and blue dragon scales, a row of plain empty wooden bench seats across the boat, a big ROUND "
  "RED DRUM with a gold rim set crosswise on a little stand just behind the dragon head, and a long wooden steering oar trailing "
  "from the stern. " + MAG)

# ── the heroes on the new rides (character only, no vehicle; the game draws them over the ride)
RIDER = ("seen from DIRECTLY ABOVE, pointing straight UP the image exactly like the scooter-riding and bicycle-riding poses in the "
 "attached sprite sheets (we see the top of the head, the big ears, the shoulders, the jacket's back, the knees and the tail), "
 "draw the CHARACTER ONLY, NO vehicle, no seat, no handlebars, ")
def rideA(who, desc):
    return (L, REF + [f'{who}-ride.png', f'{who}-act14.png'], STYLE + SG + CHIN + desc + f"A game sprite sheet of {who.title()} "
      "only, matching the attached sprite sheets of the same character exactly (same proportions, same outfit, same scale as the "
      "riding poses). A 4 by 2 grid of eight separate poses of ONE character, each alone in its cell, all at the SAME scale, each "
      + RIDER + "Top row: (1) pedalling on the FRONT saddle of a TANDEM bicycle, leaning forward with both paws out in front "
      "gripping handlebars, the LEFT knee up mid-pedal; (2) the same, the RIGHT knee up; (3) pedalling on the BACK saddle of a "
      "tandem, sitting more upright, both paws held close together in front at chest height gripping a short bar, head turned a "
      "little to one side to see past the rider in front, the LEFT knee up; (4) the same back-saddle pose, the RIGHT knee up. Bottom "
      "row: (5) riding a MOTORBIKE: sitting astride, arms spread wide forward on wide handlebars, big ears blown flat back by the "
      "wind; (6) the same, the ears flapping up in the wind and the body leaning a little to one side; (7) sitting snugly in a "
      "motorbike SIDECAR tub (only the upper body, arms and ears, the legs tucked out of sight), happily licking a pale vanilla "
      "ICE-CREAM in a light brown wafer cone held in one paw; (8) the same sidecar pose, holding the cone and waving the other paw "
      "out to the side, ears up. " + MAG)
def rideB(who, desc):
    return (L, REF + [f'{who}-ride.png', f'{who}-act14.png'], STYLE + SG + CHIN + desc + f"A game sprite sheet of {who.title()} "
      "only, matching the attached sprite sheets of the same character exactly (same proportions, same outfit, same scale as the "
      "riding poses). A 3 by 2 grid of six separate poses of ONE character, each alone in its cell, all at the SAME scale, each "
      + RIDER + "Top row: (1) riding a low LUGE cart: sitting very low with both legs stretched straight forward, both paws forward "
      "gripping a T-shaped steering bar, ears streaming back, the body leaning to the LEFT; (2) the same, leaning to the RIGHT; (3) "
      "PADDLING a dragon boat: sitting on a bench, holding a short plain wooden single-blade paddle with both paws, the blade "
      "plunging into the water on the LEFT side of the body. Bottom row: (4) the same, the paddle swung over to the RIGHT side; (5) "
      "the DRUMMER of a dragon boat, sitting FACING BACKWARD (head and face toward the BOTTOM of the image, tail toward the top), "
      "both arms raised high holding two plain wooden drumsticks, mouth open calling the beat; (6) the same drummer facing backward, "
      "both drumsticks swung down together striking in front (no drum drawn). Props are plain wood or pale colours only. " + MAG)
J['dora-ride15a'] = rideA('dora', DORA)
J['enzo-ride15a'] = rideA('enzo', ENZO)
J['dora-ride15b'] = rideB('dora', DORA)
J['enzo-ride15b'] = rideB('enzo', ENZO)
