# Jade Street, the twenty-third pass's paintings: no new district, chapter or cast. The new side jobs and Hawker Tales
# reuse their districts' givers, rivals and most props; what is new is the heroes' mangrove-planting action at Chek Jawa
# (Pulau Ubin) and eight small things for the new jobs: a plate of satay (Clarke Quay), a mangrove seedling (Ubin), a pair
# of cups of iced water (Kallang), a tangle of washed-up flotsam and a steel tiffin carrier (the Southern Islands) and three
# painted wall panels for the Kampong Glam mural walk. The game's TEXT uses real Singapore names; the paintings keep the
# no-lettering rule.
from jobs import STYLE, CHIN, DORA, ENZO, MAG, L, SQ, REF, SREF

SG = ("The setting is SINGAPORE at night, painted warmly and respectfully, celebrating its real places with care: no "
 "caricature, no stereotypes. Absolutely NO lettering anywhere: no text, letters, numbers, logos, brand marks or flags; every sign is "
 "a blank coloured shape. ")
PROP = ("Each object is seen from a HIGH top-down game camera with a gentle 3/4 tilt, matching the attached prop sheets exactly in "
 "scale, ink outline, cel shading and warm night lighting. ")
MUD = (" For the mudflats this character keeps its usual outfit exactly as in the attached sheets, with the trouser legs or shorts "
 "rolled up and small dark green RUBBER BOOTS on its feet, a few splashes of grey mud on the boots; ")
J = {}

# ── the heroes' new action (both heroes, the same four frames): planting a mangrove seedling on the Chek Jawa mudflat
def act23(who, desc):
    return (SQ, REF + [f'{who}-act.png', f'{who}-act20.png', f'{who}-act17.png'], STYLE + SG + CHIN + desc + MUD + f"A game sprite "
      f"sheet of {who.title()} only, matching the attached sprite sheets of the same character exactly (same proportions, same outfit, "
      "same scale). A 2 by 2 grid of four separate poses of ONE character, each alone in its cell, full body, all at the SAME scale, "
      "all seen from a high top-down game camera with a gentle 3/4 tilt, all facing the camera. Top row: (1) PLANTING: kneeling on one "
      "knee, leaning forward, both paws holding a long thin green-brown mangrove seedling upright and pushing its tip down into a small "
      "patch of dark wet mud in front of the knees, eyes on it, careful; (2) PATTING IT IN: still kneeling, the seedling now standing "
      "in the little mound of mud on its own, both paws patting the mud down round its base, a small proud smile. Bottom row: "
      "(3) WATERING: standing, holding a small plain watering can tilted forward in both paws, a thin stream of water falling onto a "
      "little seedling in a mound of mud in front of the feet; (4) DONE: standing, wiping one muddy paw on the front of the jacket, "
      "the other paw raised in a happy thumbs-up, grinning, a little smear of mud on one cheek. " + MAG)
J['dora-act23'] = act23('dora', DORA)
J['enzo-act23'] = act23('enzo', ENZO)

# ── eight small things (the packer files each with the zone of the district its job is in)
J['props23'] = (L, SREF + ['props1.png', 'props20.png', 'props18.png'], STYLE + SG + PROP + "A 4 by 2 grid of eight separate items, "
  "each centred in its own cell. Row 1, each about the size a chinchilla could carry in both paws: (1) an oval plate of SATAY: a fan "
  "of eight bamboo skewers of grilled, glazed chicken and beef satay, a small bowl of thick peanut sauce, chunks of cucumber and red "
  "onion; (2) a MANGROVE SEEDLING: one long thin green-brown mangrove propagule standing upright in a small brown pot of dark wet "
  "mud, two small glossy leaves at its top; (3) TWO plain white paper CUPS of iced water side by side in a little cardboard holder, "
  "ice cubes and cold droplets; (4) a tangle of washed-up FLOTSAM on a little patch of wet sand: an old blue fishing net knotted round "
  "an empty plastic bottle and a single lost rubber flip-flop, a strand of seaweed. Row 2: (5) a three-tier stainless steel TIFFIN "
  "CARRIER with a carrying handle and side clips, a wisp of steam from under the lid; then three flat rectangular painted WALL PANELS, "
  "each a piece of colourful Kampong Glam street art about twice as wide as it is tall, seen straight on with a gentle tilt, a thin "
  "dark edge: (6) bold abstract shapes, waves and flowers in hot pink, teal and sunflower yellow; (7) a giant hornbill with a "
  "golden casque among huge tropical leaves in jade green and orange; (8) a sleepy tabby cat curled on a shophouse window ledge with "
  "pastel shutters and a pot of bougainvillea, in soft pinks and mint. No text, letters or signatures anywhere. " + MAG)
