# Jade Street, third batch of paintings: new hero actions (leap, land, duck, shoo, collect, deal, mend, skid,
# tumble), Madame Glint on foot and her decoys, the chase set pieces (the smashed stall, the temple drums, the canal
# drawbridge, the dock crane and gate, the falling neon signs, Glint's drum float), impact debris, the six businesses
# at four levels each, and four portrait expressions for every speaking character.
from jobs import STYLE, CHIN, DORA, ENZO, MAG, VIEW34, TOP, L, SQ, REF, SREF

CAST = ("The cast (copy each one's face, species, colours and clothes exactly from the attached portraits sheet): ")
EXPR = ("Each ROW is one character shown four times as a head-and-shoulders PORTRAIT facing the viewer, in the same framing, size, "
 "clothes and colours as the attached portraits sheet, changing ONLY the facial expression, left to right: (1) HAPPY, a big warm open "
 "smile, eyes bright; (2) WORRIED, brows raised and tilted, mouth small and wobbly, ears or feathers drooping; (3) CROSS, brows down hard, "
 "frowning mouth, cheeks puffed; (4) SMUG, half-closed knowing eyes, one-sided grin. Every portrait is a separate head-and-shoulders bust "
 "with plenty of empty background around it. No speech bubbles, no symbols, no sweat drops, no text. ")
J = {}

def hero5(who, desc):
    return (L, REF + [f'{who}-act.png', f'{who}-act2.png'], STYLE + CHIN + desc + f"A game sprite sheet of {who.title()} only, matching the "
      "attached sprite sheets of the same character exactly (same proportions, same outfit, same scale). " + VIEW34 +
      "A 4 by 3 grid of twelve separate poses. Top row: (1) LEAP TAKE-OFF to the RIGHT in profile: crouched low, springing off one foot, arms "
      "swung back, ears flat; (2) LEAP mid-air to the RIGHT in profile: a long flying leap, body stretched out straight, both arms reaching "
      "forward, tail streaming behind; (3) LANDING facing the camera: squashed low in a deep crouch, knees bent wide, paws down for balance, "
      "ears bouncing; (4) DUCKING facing the camera: crouched with both paws over the head, eyes squeezed shut. Middle row: (5) SHOOING facing "
      "the camera: both arms waving high above the head, mouth open shouting; (6) SHOOING, arms swung the other way, one foot stamping; "
      "(7) COLLECTING coins facing the camera: holding a big double handful of gold coins against the chest, delighted; (8) POCKETING coins, "
      "facing the camera, patting a bulging jacket pocket, grinning. Bottom row: (9) SHAKING PAWS to the RIGHT in profile: one paw held out "
      "for a friendly handshake, a little bow; (10) MENDING facing the camera: kneeling and tapping with a small wooden mallet; (11) SKIDDING "
      "to the RIGHT in profile: leaning far back, both feet braced and sliding, arms out; (12) TUMBLING: curled into a rolling ball, dizzy. " + MAG)

J['dora-act5'] = hero5('dora', DORA)
J['enzo-act5'] = hero5('enzo', ENZO)
J['glint'] = (L, ['portraits.png', 'riders.png', 'magpies.png'], STYLE + "Madame Glint, the glamorous MAGPIE BOSS of the Magpie Crew: "
  "black-and-white plumage with glossy blue-green wing sheen, a gold chain, a purple-and-gold jacket, gold hoop earring; copy her exactly "
  "from the attached portraits sheet (third row, first portrait) and her scooter riding sprite. Cheeky and theatrical, never scary. "
  "A game sprite sheet. " + VIEW34 + "A 4 by 3 grid of twelve separate poses, all at the same scale. Top row: (1) Glint RUNNING to the "
  "RIGHT in profile, hugging a red-and-gold drum under one wing, legs apart; (2) the same, legs together, chain swinging; (3) Glint "
  "running TOWARD the camera, hugging the drum, left foot forward; (4) the same, right foot forward. Middle row: (5) Glint TAUNTING: "
  "one wing on her hip, the other waving, laughing; (6) Glint LEAPING mid-air to the RIGHT with wings spread wide, the drum held tight; "
  "(7) Glint standing proud facing the camera, waving both wings above her head; (8) Glint dizzy, sitting on the ground, feathers "
  "ruffled, eyes spiralled. Bottom row: (9) Glint sheepishly holding the red-and-gold drum OUT toward the camera to give it back; "
  "(10) a DECOY: a plain magpie of the crew wearing a cheap shiny imitation of Glint's jacket and a fake plastic chain, running to the "
  "RIGHT clutching a plain red paper drum; (11) the same decoy, legs together; (12) a decoy bursting into a puff of black-and-white "
  "feathers and torn red paper. " + MAG)
J['set1'] = (L, SREF + ['props1.png', 'props3.png'], STYLE + "A game prop sheet of set-piece objects for a top-down city game, every "
  "object seen from a HIGH top-down camera with a gentle 3/4 tilt, matching the attached props. A 4 by 3 grid of twelve separate objects. "
  "Top row: (1) a night-market fruit stall with a red-and-white striped awning BURSTING APART as if a cart just smashed through it: planks "
  "splintering, awning ripping, oranges and mangoes flying; (2) the same stall WRECKED and flattened on the ground afterwards: a heap of "
  "broken planks, the torn awning, scattered fruit; (3) a big round red-and-gold temple drum lying on its side ROLLING, seen side-on; "
  "(4) the same rolling drum turned a quarter, its gold studs in a different place. Middle row: (5) a wooden rack holding a stack of four "
  "big red temple drums at the top of stone steps, one drum tipping over; (6) a brass canal warning bell on a red post with a round red "
  "warning lamp; (7) a wooden canal DRAWBRIDGE seen from directly above, LOWERED: a flat plank road deck crossing left to right with dark "
  "water at the top and bottom edges of the cell, red-and-white striped edges; (8) the same drawbridge HALF RAISED: its two leaves tilted "
  "up from the middle, a gap of water showing between them. Bottom row: (9) the same drawbridge fully RAISED: both leaves standing up at "
  "the banks, open water between; (10) a big shipping container hanging from four crane cables that meet at a hook, seen from directly "
  "above, swinging; (11) a tall steel dock yard GATE of two sliding mesh panels standing OPEN, pulled apart; (12) the same yard gate SHUT, "
  "the two panels closed together with a big padlock. No text on anything. " + MAG)
J['set2'] = (SQ, SREF + ['props3.png', 'riders.png', 'festival.png'], STYLE + "A game sprite sheet of set-piece objects for the neon "
  "Arcade Strip of a top-down city game, matching the attached art. A 3 by 3 grid of nine separate objects. Top row: (1) a big hanging NEON "
  "SIGN board on two short chains, glowing pink and teal tubes in blank abstract shapes (no letters), seen from a high 3/4 view; (2) the "
  "same neon sign FALLING, tilted, chains snapped, sparks flying; (3) the same neon sign SMASHED flat on the road, glass shards and fizzing "
  "sparks. Middle row: (4) Madame Glint's PARADE FLOAT seen from a high top-down 3/4 view: a long wheeled festival float shaped like a "
  "purple-and-gold phoenix with spread wings, a big empty round stage platform on its back, strings of little lights; (5) a decoy magpie in a "
  "cheap shiny purple jacket and fake gold chain riding a small purple scooter, " + TOP + " (6) the same decoy rider leaning the other way. "
  "Bottom row: (7) a puff of black-and-white feathers, torn red paper and a little cloud, bursting outward; (8) a long festival rope of red "
  "and gold triangle bunting with a big gold tassel at its centre, stretched horizontally; (9) a sturdy wooden plank springboard ramp on a "
  "flat rooftop edge, seen from a high 3/4 view. No text anywhere. " + MAG)
J['debris'] = (SQ, SREF + ['props1.png', 'events.png'], STYLE + "A sheet of sixteen small separate pieces of flying DEBRIS for impact "
  "effects in a top-down game, each piece chunky, bold and readable when tiny, seen from a high 3/4 view, in a 4 by 4 grid, each centred in "
  "its own cell. Row 1: (1) a round orange; (2) a ripe mango; (3) a wedge of watermelon; (4) a green cabbage leaf. Row 2: (5) a short broken "
  "wooden plank; (6) a jagged splinter of a wooden crate; (7) a tuft of straw; (8) a black magpie feather with a blue-green sheen. Row 3: "
  "(9) a white downy feather; (10) a bright gold four-pointed spark star; (11) a cyan electric spark star; (12) a torn scrap of red paper. "
  "Row 4: (13) a scrap of gold festival paper; (14) a torn shred of a red paper lantern; (15) a soft round puff of grey-white dust cloud; "
  "(16) a shiny gold coin with a white glint. " + MAG)
BIZ = ("A game prop sheet of market BUSINESSES for a top-down city game, every one seen from a HIGH top-down camera with a gentle 3/4 tilt, "
  "matching the attached props and stalls in size and style. A 4 by 3 grid. Each ROW is ONE business shown four times, left to right, "
  "growing as it is upgraded, keeping the same base shape and colours so it is clearly the same place: (1) SHUTTERED and for sale: dusty, "
  "awning rolled up, wooden shutters down, a blank hanging plaque; (2) LEVEL 1, freshly opened: modest, clean, a few goods out, one paper "
  "lantern; (3) LEVEL 2: a bigger striped awning, more goods, a string of red lanterns, a little stool or bench for customers; (4) LEVEL 3, "
  "grand: gold trim, a carved roof edge, lanterns everywhere, potted plants, a little red carpet, glowing and busy-looking. Nobody standing "
  "at any of them. No text on any sign, plaque or banner, signs are blank coloured shapes. ")
J['biz1'] = (L, SREF + ['props1.png', 'props3.png'], STYLE + BIZ + "Row 1: a NOODLE CART: a wooden hawker cart with a steaming pot of "
  "noodles. Row 2: a TEA HOUSE kiosk: a little jade-roofed pavilion counter with tea tins and a big teapot. Row 3: a FAN SHOP stall: a "
  "canal-side stall hung with painted silk folding fans. " + MAG)
J['biz2'] = (L, SREF + ['props1.png', 'props3.png'], STYLE + BIZ + "Row 1: a MOONCAKE BAKERY stall: a red bakery counter with trays of "
  "golden mooncakes and bamboo steamers. Row 2: a JADE COUNTER: a dark lacquered jeweller's booth with glass cases of green jade bangles. "
  "Row 3: a CLAW MACHINE booth: a chunky glowing arcade claw crane machine full of plush toys with a little neon canopy. " + MAG)
for i, row in enumerate((
    ('an old TORTOISE grocer with round spectacles and a green apron', 'a PANGOLIN auntie with a floral blouse and a red flower in her scales',
     'an OTTER chef in a white chef jacket and tall chef hat', 'a gentle grey HERON temple keeper in saffron robes with prayer beads'),
    ('a KINGFISHER boat lady with a woven conical hat', 'a big WATER BUFFALO dock foreman in a hi-vis vest',
     'a GECKO arcade DJ with big headphones and a neon jacket', 'a RED PANDA lion-dance troupe leader in a red sash'),
    ('the MAGPIE BOSS Madame Glint with a gold chain and a purple-and-gold jacket', 'Pip, a young magpie crew member in a purple windbreaker',
     'a RACCOON warden captain in navy uniform with a peaked cap and a big moustache', 'a MYNAH bird news vendor with a flat cap'))):
    J[f'expr{i + 1}'] = (SQ, ['portraits.png'], STYLE + CAST + "A sheet of sixteen character portraits in a 4 by 4 grid. " + EXPR +
      " ".join(f"Row {k + 1}: {who}." for k, who in enumerate(row)) + " " + MAG)
J['expr4'] = (L, REF + ['heroes-face.png', 'portraits.png'], STYLE + CHIN + DORA + ENZO + "A sheet of eight portraits in a 4 by 2 grid, "
  "copying the two chinchillas exactly from the attached heroes portrait sheet (same framing, fur, eyes and jackets). " + EXPR +
  "Row 1: Dora (cream-white fur, red eyes, jade-green bomber). Row 2: Enzo (soft grey fur, dark eyes, vermilion tracksuit top). " + MAG)
