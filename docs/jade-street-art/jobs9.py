# Jade Street, ninth batch of paintings: smarter guards, a partner who thinks for themselves, a harder stall, painted
# clues and three new choices. The guards' and wardens' new poses (look around, search, call for help, grumble and give
# up), the gangs peering at a noise and caught in a chase, sneaky raiders and their grab, the stall's damage, the
# detective's clue markers and distinct search spots, the heroes' partner poses (the psst warning and pointing, the
# wind-up before their own shot, scooping up loot, beckoning from the getaway, cowering in cover, peeking, offering a
# kopi, the commotion and bracing a stall), the state bubbles, and the cards for the new choices. No lettering anywhere.
from jobs import STYLE, CHIN, DORA, ENZO, MAG, VIEW34, L, SQ, REF, SREF
from jobs6 import ISLE, CROW

PROP = ("Each object is seen from a HIGH top-down game camera with a gentle 3/4 tilt, matching the attached prop sheets exactly in "
 "scale, ink outline, cel shading and warm night lighting. ")
J = {}

# ── the heroes' partner poses (both heroes, the same twelve)
def act11(who, desc):
    return (L, REF + [f'{who}-act.png', f'{who}-act10.png'], STYLE + ISLE + CHIN + desc + f"A game sprite sheet of {who.title()} only, "
      "matching the attached sprite sheets of the same character exactly (same proportions, same outfit, same scale). " + VIEW34 +
      "A 4 by 3 grid of twelve separate poses of ONE character, each alone in its cell. Top row: (1) CROUCHED low facing the camera, one "
      "paw cupped beside the mouth WHISPERING a warning, the other arm pointing out to the RIGHT, ears flat, eyes wide; (2) CROUCHED in "
      "profile to the RIGHT pointing ahead with the whole arm straight out, ears swivelled forward, alert; (3) braced in profile to the "
      "RIGHT, knees bent ready to spring, squinting one eye, ears back, both paws raised in front of the chest, determined, about to fire "
      "a toy; (4) RUNNING bent low in profile to the RIGHT, scooping something up off the ground with one paw. Middle row: (5) standing "
      "facing the camera holding up a small blank cloth bag high in both paws, proud; (6) standing facing the camera beckoning 'come on!' "
      "with one paw, looking back over the shoulder, impatient and excited; (7) CURLED into a tiny ball on the ground facing the camera, "
      "paws over the ears, eyes peeking out, hiding; (8) PEEKING round an unseen corner in profile to the RIGHT, leaning far over, only "
      "head and one paw forward, tail behind. Bottom row: (9) standing in profile to the RIGHT holding out a small takeaway cup of iced "
      "coffee in a clear plastic bag with a string handle, a sheepish bribing grin; (10) BANGING a wok lid like a gong with a wooden spoon, "
      "facing the camera, mouth wide open shouting, hopping, a deliberate silly commotion; (11) the same commotion, the other foot up, "
      "the lid raised high, eyes squeezed shut; (12) BRACING with both arms spread wide facing the camera, feet planted, guarding "
      "something behind them, fierce little frown. " + MAG)
J['dora-act11'] = act11('dora', DORA)
J['enzo-act11'] = act11('enzo', ENZO)

# ── the guards' new poses: look round, search, call for help, give up
J['aware-guards'] = (L, SREF + ['guards.png', 'lizards.png', 'magpies-crow.png'], STYLE + ISLE + "The rivals: " + CROW + ". A game "
  "sprite sheet matching the attached rival sheets exactly in size and style (the same crow security guard in a navy guard jacket, small "
  "peaked cap and little torch; the same Longkang Lizard; the same house crow in a purple windbreaker). " + VIEW34 + "A 4 by 3 grid of "
  "twelve poses, each alone in its cell. Top row, the crow SECURITY GUARD: (1) standing still LOOKING ROUND to the LEFT, torch swept "
  "left, head turned, suspicious squint; (2) the same LOOKING ROUND to the RIGHT; (3) SEARCHING: bent over in profile to the RIGHT "
  "shining the torch low under something unseen, peering; (4) SEARCHING: on tiptoe facing the camera shining the torch up high, neck "
  "stretched. Middle row: (5) the guard CALLING FOR HELP: blowing a small brass whistle hard, one wing waving overhead, cheeks puffed; "
  "(6) the guard GIVING UP: shrugging with both wings out, cap pushed back, grumpy pout, torch drooping; (7) the LIZARD guard looking "
  "round suspiciously, head turned sideways, tongue flicking; (8) the LIZARD searching, crouched low sniffing the ground. Bottom row: "
  "(9) the LIZARD calling for help, waving both arms over the head, mouth wide; (10) the HOUSE CROW lookout searching, bent forward "
  "peering under one raised wing; (11) the HOUSE CROW calling for help, beak wide open cawing, both wings flapping up; (12) the HOUSE "
  "CROW giving up, shrugging, feathers drooping, grumpy. " + MAG)

# ── the ticket warden and the gangs: listening, peering, caught; a sneaky crow raider
J['aware-folk'] = (L, SREF + ['wardens.png', 'macaques.png', 'otters.png', 'magpies-crow.png'], STYLE + ISLE + "The rivals: " + CROW +
  ". A game sprite sheet matching the attached sheets exactly in size and style (the same portly raccoon ticket warden in a navy "
  "uniform with a small notebook; the same Bukit Bunch macaque with brown fur, pink face and an orange bandana; the same Riverside "
  "Romp otter; the same house crow in a purple windbreaker). " + VIEW34 + "A 4 by 3 grid of twelve poses, each alone in its cell. Top "
  "row, the raccoon WARDEN: (1) LISTENING facing the camera, one paw cupped behind a round ear, eyebrows raised; (2) LOOKING ROUND to "
  "the LEFT, notebook held to the chest; (3) LOOKING ROUND to the RIGHT; (4) SEARCHING bent over in profile to the RIGHT peering at the "
  "ground with a magnifying glass. Middle row: (5) the WARDEN giving up, shrugging, palms up, a grumpy pout; (6) the MACAQUE peering "
  "toward a noise in profile to the RIGHT, one hand shading the eyes, crouched; (7) the OTTER peering toward a noise, standing up tall "
  "on its hind legs in profile to the RIGHT, whiskers twitching; (8) the HOUSE CROW peering toward a noise, head cocked sideways. "
  "Bottom row: (9) the MACAQUE CAUGHT: sitting down facing the camera with both hands up in surrender, a sheepish grin, a little dizzy; "
  "(10) the OTTER CAUGHT: sitting facing the camera, paws up in surrender, sheepish; (11) the HOUSE CROW SNEAKING on foot, crouched "
  "low tiptoeing to the RIGHT under a dark hooded cloak, one foot raised; (12) the same sneaking crow, the other foot raised. " + MAG)

# ── the stall raids: sneaky macaques and otters, the gangs grabbing at a stall, and the stall's damage
J['raiders9'] = (L, SREF + ['macaques.png', 'otters.png', 'magpies-crow.png', 'props1.png'], STYLE + ISLE + "The rivals: " + CROW +
  ". A game sprite sheet matching the attached sheets exactly in size and style. " + VIEW34 + "A 4 by 3 grid of twelve separate items, "
  "each alone in its cell. Top row: (1) the MACAQUE SNEAKING to the RIGHT hunched under an upturned empty cardboard box, only the feet "
  "and a peeking face showing, left foot forward; (2) the same, right foot forward; (3) the OTTER SNEAKING to the RIGHT flat on its "
  "belly under a leafy branch held over its head, left paw forward; (4) the same, right paw forward. Middle row: (5) the HOUSE CROW "
  "GRABBING greedily at something unseen in front of it with both wings, rummaging, feathers flying; (6) the MACAQUE GRABBING, both "
  "arms deep in something unseen, shaking it, cheeky grin; (7) the OTTER GRABBING, standing on tiptoe pulling at something unseen with "
  "both paws; (8) a small pile of DAMAGE: a few knocked-over takeaway boxes, a torn paper lantern and scattered fruit. Bottom row: (9) "
  "a bigger pile of DAMAGE: a snapped bamboo pole, a ripped striped awning flap, spilled noodles and toppled stools; (10) the worst "
  "DAMAGE: a flattened broken crate, shards of a cracked bowl, torn bunting and a dented pot, feathers and fur tufts; (11) a few drifting "
  "loose FEATHERS and fur tufts, a puff of dust; (12) a small cartoon DUST CLOUD scuffle puff. No text anywhere. " + MAG)

# ── the detective: clue markers that appear after the matching clue
J['clues9'] = (L, SREF + ['heist-props.png', 'props1.png'], STYLE + ISLE + PROP + "A 4 by 3 grid of twelve separate small GROUND "
  "MARKERS, each centred in its own cell, all painted lying flat on the pavement, small and readable. Top row: (1) a short trail of "
  "small wet three-toed BIRD FOOTPRINTS in a curve; (2) two loose smoky-grey FEATHERS lying crossed; (3) a scatter of golden flaky "
  "pastry CRUMBS; (4) a little puddle of spilled brown KOPI coffee with a toppled paper cup. Middle row: (5) a few torn scraps of blank "
  "white PAPER; (6) a few long green PANDAN LEAF pieces; (7) small claw SCRATCH marks scuffed on a dusty patch; (8) a dropped bright "
  "red KOPI-STRAW and a bottle cap. Bottom row: (9) a trail of muddy PAW PRINTS; (10) a single long black FEATHER standing up stuck in "
  "a crack; (11) a few drips of sweet green pandan SYRUP; (12) a little pile of curry-puff paper wrappers. No text anywhere. " + MAG)

# ── the detective: search spots that each look like what they are
J['spots9'] = (L, SREF + ['heist-props.png', 'props1.png', 'isle-props2.png'], STYLE + ISLE + PROP + "A 4 by 3 grid of twelve "
  "separate objects, each centred in its own cell. Top row: (1) a stack of three wooden STALL CRATES with paper bags of curry puffs on "
  "top; (2) two big blue wheeled RECYCLING BINS side by side; (3) a blue picnic COOLER BOX on the ground; (4) a row of three terracotta "
  "FLOWER PLANTERS with leafy plants. Middle row: (5) a blue metal BICYCLE RACK with one parked bicycle; (6) two woven bamboo BASKETS "
  "full of long green pandan leaves; (7) a tied BUNDLE of old newspapers with blank pages; (8) a tall stack of round bamboo STEAMER "
  "baskets. Bottom row: (9) a wooden SHELF with blank cake boxes on its top board; (10) a green litter BIN with a swing lid; (11) a "
  "folded striped canvas AWNING roll leaning against a pole; (12) a takeaway bag of iced KOPI in a clear plastic bag with a string "
  "handle (the kind you hang on a hook). No text anywhere. " + MAG)

# ── the interface: state bubbles, the partner's warning pointer and the noise badge
J['ui9'] = (L, SREF + ['icons.png', 'ui8.png'], STYLE + ISLE + "A game UI sheet painted like enamel shop signs and lacquered wood "
  "with gold trim, matching the attached icons in style, chunky and readable at small size. A 4 by 2 grid of eight separate items. Row "
  "1: (1) a round cream-yellow THOUGHT BUBBLE with a little tail of two dots, completely EMPTY inside; (2) a red-orange spiky SHOUT "
  "BUBBLE like a burst star, completely EMPTY inside; (3) a round lilac bubble with a small brass MAGNIFYING GLASS inside; (4) a grey "
  "little STORM CLOUD bubble with a tiny scribbled squiggle of grumpiness and a small drop. Row 2: (5) a round bubble with a small "
  "brass WHISTLE and little sound lines; (6) a jade-green bubble with a small cupped PAW held beside a mouth, whispering; (7) a chunky "
  "gold POINTING PAW, one finger pointing straight UP, with a jade cuff, for a pointer; (8) a round badge of three curved SOUND WAVES "
  "ripples, for a noise. No text, no letters, no numbers, no question marks, no exclamation marks. " + MAG)

# ── the new choices: two cards a sheet, painted like the heist's
CARD = ("Two separate painted CARDS side by side, each a tall rounded rectangle plaque of lacquered wood with a gold rim, painted like a "
  "playing card for a game menu, matching the attached heist cards exactly in shape and style, with a wide empty margin around each. ")
J['cards9a'] = (L, REF + ['cards8.png', 'dora-disguise.png'], STYLE + ISLE + CHIN + DORA + ENZO + CARD + "LEFT card, the DISGUISE: a "
  "cool teal scene of a strolling evening crowd of animal townsfolk, Dora in a tan trench coat, round sunglasses and a fake moustache "
  "walking calmly among them, a crow lookout looking right past her. RIGHT card, the COMMOTION: a warm vermilion scene, Enzo banging a "
  "wok lid like a gong and hopping about, crow lookouts all turning to stare at him, Dora tiptoeing past behind their backs. No text "
  "anywhere, no letters, no numbers. " + MAG)
J['cards9b'] = (L, REF + ['cards8.png', 'macaques.png'], STYLE + ISLE + CHIN + DORA + ENZO + CARD + "LEFT card, the NETS: a deep "
  "indigo night scene, Dora and Enzo hiding behind a bush holding a rope, a brown rope net laid on the path ahead and a cheeky macaque "
  "tiptoeing toward a plate of kueh bait. RIGHT card, the CHASE: a bright gold and vermilion scene, Dora and Enzo sprinting after "
  "three scattering macaques who look back over their shoulders, dust flying. No text anywhere, no letters, no numbers. " + MAG)
J['cards9c'] = (L, REF + ['cards8.png'], STYLE + ISLE + CHIN + DORA + ENZO + CARD + "LEFT card, ASK AROUND: a calm teal "
  "hawker-centre scene, Dora with a little notebook listening politely to a kindly old auntie townsfolk (a tortoise in a floral blouse) "
  "at a kopi stall, Enzo nodding beside her. RIGHT card, the KOPI BRIBE: a warm amber scene, Enzo grinning and holding out a takeaway kopi "
  "in a plastic bag on a string to a shifty-eyed sparrow in a cap, who leans in to whisper a secret, Dora cupping her ear. No text "
  "anywhere, no letters, no numbers. " + MAG)

