# Jade Street, eighth batch of paintings: job variety. Seven new kinds of job step (case the joint, the heist with a
# quiet or loud approach and its safe, defend a stall in waves, blend in a disguise, the detective's questions and
# search, set a trap and spring it, swap fake goods into crates) need the heroes' new actions, a spy disguise with its
# own walk, the crows' security guards and office interns, a netted macaque, the heist and trap props, the safe
# mini-game and its interface icons. No lettering anywhere.
from jobs import STYLE, CHIN, DORA, ENZO, MAG, VIEW34, L, SQ, REF, SREF
from jobs6 import ISLE, CROW

PROP = ("Each object is seen from a HIGH top-down game camera with a gentle 3/4 tilt, matching the attached prop sheets exactly in "
 "scale, ink outline, cel shading and warm night lighting. ")
J = {}

# ── the heroes' new actions (both heroes, the same twelve poses)
def act10(who, desc):
    return (L, REF + [f'{who}-act.png', f'{who}-act9.png'], STYLE + ISLE + CHIN + desc + f"A game sprite sheet of {who.title()} only, "
      "matching the attached sprite sheets of the same character exactly (same proportions, same outfit, same scale). " + VIEW34 +
      "A 4 by 3 grid of twelve separate poses of ONE character, each alone in its cell. Top row: (1) CROUCHED low to the RIGHT in profile "
      "holding a small chunky blank instant CAMERA up to one eye, sneaky, about to take a photo; (2) the same crouch at the moment the "
      "photo is taken, a small round white-yellow FLASH of light bursting from the camera, ears twitching; (3) standing facing the camera "
      "scribbling in a small blank NOTEBOOK with a pencil, tongue poking out, thinking hard; (4) RUMMAGING head-first in a low pile of "
      "cardboard boxes facing the camera, bottom and fluffy tail in the air, paws digging. Middle row: (5) the same rummage pulling back "
      "out, holding up empty paws with a puzzled face; (6) KNEELING facing the camera and spreading a folded brown rope NET flat on the "
      "ground with both paws, careful; (7) YANKING a rope with both paws to the RIGHT in profile, leaning far back, determined, springing "
      "a trap; (8) CROUCHED by an unseen crate to the RIGHT in profile, lifting an invisible lid with one paw and slipping a small brown "
      "box in with the other, sly. Bottom row: (9) the same crouch closing the lid, looking back over the shoulder with a cheeky grin; (10) "
      "KNEELING to the RIGHT in profile with one ear pressed flat against an unseen safe door, one paw raised turning an unseen dial, "
      "eyes shut, listening; (11) LEAPING up facing the camera with both fists raised in triumph, a big grin; (12) standing facing the "
      "camera WHISTLING innocently with paws behind the back, eyes looking up and away, pretending nothing happened. " + MAG)
J['dora-act10'] = act10('dora', DORA)
J['enzo-act10'] = act10('enzo', ENZO)

# ── the spy disguise: a trench coat, big round sunglasses and a fake bushy moustache, with its own walk
def disguise(who, desc, coat):
    return (L, REF + [f'{who}-walk.png', f'{who}-act9.png'], STYLE + ISLE + CHIN + desc + f"A game sprite sheet of {who.title()} only, "
      f"now in a silly cartoon SPY DISGUISE worn over the usual outfit: a long {coat} TRENCH COAT belted at the waist with the collar "
      "turned up, big round dark SUNGLASSES and a big fake bushy black MOUSTACHE stuck on under the nose; the big round pink-lined ears and "
      "the fluffy tail still poke out, the fur colour is unchanged. Matching the attached sprite sheets of the same character exactly "
      "(same proportions, same scale). " + VIEW34 + "A 4 by 2 grid of eight separate poses of ONE character, each alone in its cell. Top "
      "row: (1) WALKING calmly toward the camera, left foot forward, trying to look casual; (2) the same, right foot forward; (3) walking "
      "AWAY from the camera seen from behind, the coat tails swinging, left foot forward; (4) the same from behind, right foot forward. "
      "Bottom row: (5) walking to the RIGHT in profile, casual stroll, left foot forward, nose in the air; (6) the same in profile, right "
      "foot forward; (7) standing still facing the camera pretending to read a blank folded newspaper held up high, peeking over it; (8) "
      "pulling the trench coat on facing the camera, one arm in a sleeve, the sunglasses pushed up, mid-twirl. " + MAG)
J['dora-disguise'] = disguise('dora', DORA, 'tan beige')
J['enzo-disguise'] = disguise('enzo', ENZO, 'olive green')

# ── the crows' security guards, office interns and a netted macaque
J['guards'] = (L, SREF + ['magpies-crow.png', 'macaques.png', 'lizards.png'], STYLE + ISLE + "The rivals: " + CROW + ". A game "
  "sprite sheet matching the attached rival sheets exactly in size and style. " + VIEW34 + "A 4 by 3 grid of twelve poses, each alone "
  "in its cell. Top row: a crow SECURITY GUARD in a navy guard jacket, a small peaked cap and a little torch held in one wing: (1) "
  "patrolling toward the camera, left foot forward, torch pointing ahead; (2) the same, right foot forward; (3) patrolling AWAY seen "
  "from behind, left foot forward; (4) the same from behind, right foot forward. Middle row, the same guard: (5) patrolling to the RIGHT "
  "in profile, torch ahead, left foot forward; (6) the same, right foot forward; (7) raising the ALARM: wings up, beak wide open "
  "squawking, a small brass hand bell ringing in one wing, feathers puffed; (8) DAZED and covered in colourful CONFETTI and streamers, "
  "sitting down, swirly eyes, cap askew. Bottom row: (9) a cheeky MACAQUE monkey of the Bukit Bunch (brown fur, pink face, small orange "
  "bandana) TANGLED in a brown rope net, grinning sheepishly; (10) a crow office INTERN in a white shirt, a little red necktie and "
  "round glasses, carrying a blank folder, walking toward the camera; (11) the same intern walking to the RIGHT in profile, left foot "
  "forward, sipping from a paper cup; (12) the same intern walking to the RIGHT in profile, right foot forward. " + MAG)

# ── the heist and trap props
J['heist-props'] = (SQ, SREF + ['props1.png', 'isle-props2.png', 'tag.png'], STYLE + ISLE + PROP + "A 4 by 4 grid of sixteen "
  "separate objects, each centred in its own cell. Row 1: (1) a small SECURITY CAMERA on a short wall bracket, its round body shaped "
  "like a cute crow's head with the lens as a beak-eye, a tiny red light; (2) the same camera SPLATTERED with a big blob of jade-green "
  "paint over the lens, drips running down; (3) a big old-fashioned black iron SAFE with gold trim, a round dial and a handle, its door "
  "shut, front facing down the image; (4) the same safe with its door swung OPEN, gold light glowing from inside, a rolled-up blank "
  "paper and coins inside. Row 2: (5) a small wooden SERVICE DOOR in a strip of brick wall, slightly ajar, with a crate wedged against "
  "it; (6) a cork NOTICE BOARD on legs with pinned blank papers, little photos with no faces, red string between pins and a blank clock; "
  "(7) a wooden market CRATE with its lid shut, rope handles, stencilled blank shapes; (8) the same crate with its lid OPEN showing it "
  "full of obviously fake wooden painted MANGOES and shiny plastic jade, cheeky decoys. Row 3: (9) a folded brown rope NET TRAP laid "
  "flat on the ground, pegged at the corners, a rope running off to one side, lightly hidden with leaves; (10) a sprung net TRAP: the "
  "rope net pulled up into a closed empty bundle hanging from a little wooden frame; (11) BAIT: a small plate of green-and-white "
  "layered pandan KUEH cakes with a few crumbs; (12) a DISGUISE RACK: a wooden clothes stand with a trench coat, round sunglasses and a "
  "fake moustache hanging on hooks. Row 4: (13) a brass ALARM BELL on a wall bracket, ringing, little motion lines; (14) a bulging "
  "heap of cardboard BOXES and sacks that could hide something, slightly messy; (15) a small brown cardboard DECOY BOX tied with "
  "string, the size a chinchilla can carry; (16) a scattered MESS of torn takeaway bags, spilled noodles and a toppled cup, a raid's "
  "aftermath. No text anywhere. " + MAG)

# ── the interface: the new job icons and the two approach cards for a heist
J['ui8'] = (L, SREF + ['icons.png', 'ui2.png', 'isle-ui.png'], STYLE + ISLE + "A game UI icon sheet painted like enamel shop signs "
  "and lacquered wood with gold trim, matching the attached icons in style, chunky and readable at small size. A 4 by 2 grid of eight "
  "separate round badges. Row 1: (1) a chunky instant CAMERA; (2) a brass MAGNIFYING GLASS over a little paw print; (3) a coiled brown "
  "rope NET; (4) a wooden crate with a shiny fake mango popping out of it. Row 2: (5) a round jade SHIELD with a gold rim; (6) a pair of "
  "big round dark SUNGLASSES above a fake bushy moustache; (7) a round brass SAFE DIAL with tick marks only, no numbers; (8) an empty "
  "rounded SPEECH BUBBLE, blank inside, with a tiny ear beside it. No text, no letters, no numbers, no question marks. " + MAG)
J['cards8'] = (L, REF + ['story-2.png', 'icons.png'], STYLE + ISLE + CHIN + DORA + ENZO + "Two separate painted CARDS side by "
  "side, each a tall rounded rectangle plaque of lacquered wood with a gold rim, painted like a playing card for a game menu, with a "
  "wide empty margin around each. LEFT card, the QUIET approach: a deep indigo and teal night scene, Dora and Enzo tiptoeing in the "
  "shadows along a wall on tiptoe, paws raised, a crow guard's torch beam passing just over their heads, cool moonlight. RIGHT card, "
  "the LOUD approach: a warm vermilion and gold scene, a huge burst of colourful CONFETTI and streamers exploding from a party cannon, "
  "crow guards tumbling about dazed, Dora and Enzo dashing past grinning. No text anywhere, no letters, no numbers. " + MAG)

# ── the safe mini-game: the scene and its parts
J['mg-safe'] = (L, SREF + ['mg-lock.png'], STYLE + ISLE + "A full-screen MINI-GAME scene matching the attached lock-picking scene "
  "exactly in style and framing: a close-up of the front of a big old black iron SAFE door in a crows' office at night, gold trim and "
  "rivets, a big empty round recessed hole in the CENTRE where a dial will sit (leave it as a plain dark round recess), a chunky brass "
  "handle to the right, a small round empty lamp socket above the recess, warm desk-lamp light from the left, a stethoscope and a cup "
  "of tea on the desk edge at the bottom. No text anywhere, no numbers on anything.")
J['mg-parts2'] = (L, SREF + ['mg-parts.png'], STYLE + ISLE + "A game sprite sheet of mini-game parts matching the attached parts "
  "sheet exactly in style, seen straight on. A 4 by 2 grid of eight separate items, each centred in its own cell. Row 1: (1) a big round "
  "brass COMBINATION DIAL seen straight on, with evenly spaced tick marks around the rim and a raised grip knob in the middle, NO "
  "numbers; (2) a small brass pointer NOTCH, a downward triangle; (3) a round glass LAMP, unlit, dark amber; (4) the same lamp LIT, "
  "bright warm gold glow. Row 2: (5) a round green TUMBLER light lit up; (6) a small brass STETHOSCOPE chest piece; (7) the safe "
  "HANDLE turned open; (8) a little puff of gold sparkle. No text, no numbers. " + MAG)
