# Jade Street, the twenty-sixth pass's paintings: Bishan and Ang Mo Kio, north of Toa Payoh, and chapter seventeen.
# The ground (the naturalised Kallang River's rocky banks, Ang Mo Kio town paving, the river's pebbly shallows), the
# district's buildings (an Ang Mo Kio HDB slab, a Bishan HDB block with its pitched red roof, the elevated Ang Mo Kio MRT
# station, the Ang Mo Kio market and food centre, a void-deck flat front and Junction 8; then the Bishan MRT
# interchange, the Kebun Baru bird-singing corner's shelter, the Bishan Park cafe pavilion and AMK Hub), three prop
# sheets (the Kallang River footbridge and the old stone bridge on a sheet of their own so neither is upscaled), the
# Bishan Ten otters, Ah Wei's Koel Boys, five new portraits (four in four moods, Ah Wei's on his own sheet) then five full
# bodies, the heroes' new actions in their chapter outfits (hopping the stepping stones, void-deck chess, the dragon
# slide), map icons, the three new properties' stands, the market panel and the chapter card. The game uses real
# Singapore names in its TEXT, but the paintings keep the no-lettering rule: no text, letters, numbers, logos or flags
# anywhere. EVERY sheet is on MAGENTA (the park, roof gardens and riverbank plants are green). Run with
# ~/arcade-protos/jade26-sheets/gen26.py (the prompt comes before the image flags; stdin closed); cut and packed by
# scripts/jade-art26.py. cast26 and cast26b need cast-ref26.png / koel-ref26.png (cut from faces26 / faces26b with
# mkref.py) and chapter-17 needs dora-act26.png and enzo-act26.png, so those three are painted last.
from jobs import STYLE, CHIN, MAG, VIEW34, L, SQ, REF, SREF
from jobs6 import MOODS4, CAST6
from jobs7 import POSES, BODY
from jobs2 import PANEL, SP
import importlib.util
from pathlib import Path

_f = Path(__file__).parent / 'jobs-empire.py'
_sp = importlib.util.spec_from_file_location('jobs_empire', _f); _emp = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(_emp)
EMP, GROWP = _emp.EMP, _emp.GROWP

SG = ("The setting is SINGAPORE at night, painted warmly and respectfully, celebrating its real places with care: no "
 "caricature, no stereotypes. Absolutely NO lettering anywhere: no text, letters, numbers, logos, brand marks or flags; every sign is "
 "a blank coloured shape. ")
BSH = ("This part of the world is BISHAN AND ANG MO KIO, the leafy HDB heartland towns in the middle of SINGAPORE, on a warm humid "
 "monsoon NIGHT just after rain, puddles shining: BISHAN-ANG MO KIO PARK, a big green park of rolling lawns and rain trees where the "
 "old concrete canal was dug out and turned back into a winding NATURALISED RIVER, the KALLANG RIVER, with soft green banks of "
 "grasses and rocks, shallow rippling water over pebbles, rows of flat STEPPING STONES across it and a curved timber FOOTBRIDGE; "
 "families of SMOOTH-COATED OTTERS playing on the banks; ANG MO KIO TOWN of older 1970s and 80s HDB slab blocks in cream and pastel "
 "colours with open VOID DECKS of pillars, stone chess tables and letterboxes, a busy MARKET AND FOOD CENTRE of hawker stalls under "
 "a big pitched roof, the KEBUN BARU BIRD-SINGING CORNER of tall poles hung with little bamboo bird cages, a town garden with a "
 "pond; BISHAN with its HDB blocks topped by pitched RED-TILED roofs, the MRT INTERCHANGE and the elevated MRT viaduct, the Junction "
 "8 mall. Warm sodium street lamps and green park lamps on wet ground, cosy and lively, never spooky. ")
PROP = ("Each object is seen from a HIGH top-down game camera with a gentle 3/4 tilt, matching the attached prop sheets exactly in "
 "scale, ink outline, cel shading and warm night lighting. ")
BLD = ("Each building is seen from a HIGH top-down camera with a gentle 3/4 tilt at the SAME angle as the attached building sheets, so we "
 "look DOWN onto its whole ROOF (the roof takes up the top two thirds of each building) and see only a short strip of the front "
 "facade at the bottom. NOT a flat front elevation. No ground plate, no plaza and no pavement under or around a building: each "
 "building's outline is just its own roof, walls and steps. Each building alone in its cell with space around it. ")
MERBOK = ("UNCLE MERBOK, a gentle proud old bird-singing club uncle, a ZEBRA DOVE: a soft grey-brown body finely barred with thin "
 "black-and-white ZEBRA stripes on the neck and chest, a pale blue-grey face with a ring of blue bare skin round the eyes, a "
 "slim grey bill, wearing a loose white cotton SINGLET under an open pale blue short-sleeved shirt and a little old gold "
 "wristwatch")
PUYUH = ("AUNTIE PUYUH, a fast loud warm-hearted hokkien mee hawker auntie, a plump KING QUAIL: a round little body, a chestnut-red "
 "belly, a blue-grey chest, a bold BLACK-AND-WHITE throat pattern, a short dark bill and bright eyes, wearing a faded floral "
 "short-sleeved samfu top in yellow and orange, a white hawker APRON and a little elastic hairnet over her head feathers")
KURA = ("DR KURA, a calm patient river engineer from the water agency, a RIVER TERRAPIN: a smooth olive-brown domed SHELL on her back, "
 "grey-olive skin, a rounded snout and wise little dark eyes, wearing a high-visibility ORANGE safety vest with silver stripes over a "
 "pale blue work shirt, a clipboard tucked under her arm, no helmet")
KIJANG = ("MAK ANDAM KIJANG, a graceful bustling wedding planner and bridal dresser, a BARKING DEER (muntjac): warm russet-brown fur, "
 "a slim face with dark V-shaped stripes, big dark eyes and large ears, two tiny short antler stubs, wearing a rich MAROON baju "
 "kurung with fine gold embroidery at the cuffs and a pale gold selendang scarf draped over one shoulder")
AHWEI = ("AH WEI, the loud show-off boss of the Koel Boys, a big male ASIAN KOEL: GLOSSY blue-black feathers all over, bright "
 "blood-RED eyes, a pale greenish-ivory bill, a long tail, wearing a shiny SILVER satin bomber jacket with orange cuffs, a thin "
 "chain with a little silver whistle round his neck and dark sunglasses pushed up on his head; cocky and comic, never scary")
# the heroes' chapter-seventeen outfits (written in full: DORA/ENZO in jobs.py describe the usual Jade Street clothes)
DORA_BS = ("Dora: cream-white fur, red eyes, wearing a light SKY-BLUE hooded RAIN JACKET with the hood DOWN on her back, white "
 "knee-length shorts and YELLOW canvas SNEAKERS. No hat, no helmet: both big round ears always fully visible. ")
ENZO_BS = ("Enzo: soft grey fur, dark brown eyes, wearing a BRICK-RED short-sleeved checked SHIRT open over a plain WHITE T-shirt, "
 "dark charcoal-grey cargo shorts and blue rubber SLIPPERS. No hat, no helmet: both big round ears always fully visible. ")
NEWCLOTHES = (" The attached sprite sheets give ONLY this character's face, fur colour, body proportions, ink style and scale: IGNORE the "
 "clothes, hats and boots in them completely. In every frame the character wears ONLY the outfit described here, no hat, no "
 "boots, no bag, no green and no pink-purple clothing. ")
J = {}

# ── the ground: four seamless textures (the fourth is a spare)
J['ground26'] = (L, SREF + ['ground25.png', 'ground21.png'], STYLE + SG + BSH + "Four separate SQUARE seamless ground TEXTURES for "
  "a top-down game, matching the attached ground textures exactly in scale and style, seen from directly above, flat, evenly lit at "
  "night, no objects, no lines, no borders: a 2 by 2 grid of four squares that each fill their cell completely, edge to edge, with thin "
  "black gaps between them. Every texture must be CALM and LOW CONTRAST so characters drawn on top stay easy to read: no big motifs, "
  "no strong outlines. Top row: (1) a NATURALISED RIVERBANK seen from above: soft short grass and low tufts mixed evenly with "
  "smooth rounded grey and buff RIVER ROCKS half sunk in the turf, damp and dark; (2) ANG MO KIO TOWN PAVING: small rectangular "
  "warm terracotta-red and pale grey concrete PAVERS laid in an even herringbone, a little wet sheen. Bottom row: (3) SHALLOW RIVER "
  "WATER over a bed of smooth round PEBBLES: clear dark blue-green water with soft moonlit ripples, the brown and grey pebbles "
  "showing through; (4) a plain dark rubber PLAYGROUND floor with tiny speckles.")

# ── buildings, all on MAGENTA (roof gardens are green). The packer stretches each to its footprint.
J['bs-bld'] = (L, SREF + ['pg-bld.png', 'kallang-bld.png', 'mandai-bld.png'], STYLE + SG + BSH + "A game sprite sheet of six "
  "separate BISHAN and ANG MO KIO buildings for a top-down game. " + BLD + "A 3 by 2 grid. Row 1: (1) an older ANG MO KIO HDB "
  "SLAB BLOCK: a long block of public flats painted CREAM with soft PEACH and pale blue bands, rows of windows with laundry poles "
  "sticking out, a flat roof with water tanks and a lift motor room, about one and a half times as wide as deep; (2) a BISHAN HDB "
  "BLOCK: a tall white-and-pale-yellow point block of flats topped by a distinctive pitched RED-TILED ROOF with a little gable, "
  "about as wide as deep; (3) the elevated ANG MO KIO MRT STATION: a long raised station building on a concrete viaduct with a "
  "long curved pale grey metal ROOF over the platforms, a red MRT train on the track, about twice as wide as deep. Row 2: (4) an "
  "ANG MO KIO MARKET AND FOOD CENTRE: a big open-sided hawker centre with a wide pitched dark-red tiled roof with a raised "
  "ventilation ridge, rows of stalls and tables seen at the open edges, ceiling fans, about one and a half times as wide as deep; "
  "(5) a HDB VOID DECK flat front: the open ground floor of a cream flat block with pale pillars, a stone table with stools, a row "
  "of letterboxes and a lift lobby with a lamp, about one and a half times as wide as deep; (6) the JUNCTION 8 shopping mall: a "
  "rounded modern mall with a glass curtain wall, a big curved roof with skylights and a bright entrance canopy, about one and a "
  "third times as wide as deep. " + MAG)
J['bs-bld2'] = (L, SREF + ['pg-bld.png', 'pg-bld2.png', 'kallang-bld.png'], STYLE + SG + BSH + "A game sprite sheet of four "
  "separate buildings for a top-down game. " + BLD + "A 2 by 2 grid. Row 1: (1) the BISHAN MRT INTERCHANGE: a modern station with "
  "a big sweeping wave-shaped white ROOF over the entrance, glass sides and escalators going down, about one and a half times as "
  "wide as deep; (2) the KEBUN BARU BIRD-SINGING CORNER SHELTER: an open-sided square pavilion with a pyramid dark green-grey roof, "
  "benches inside, and around it a ring of tall thin metal POLES with crossbars, about as wide as deep. Row 2: (3) a BISHAN PARK "
  "CAFE PAVILION: a low timber-and-glass cafe with a flat grass-covered roof, deck tables with umbrellas along its front, about "
  "one and a half times as wide as deep; (4) the AMK HUB shopping mall: a big boxy modern mall with a stepped roof terrace, "
  "skylights and a covered bus interchange beside it, about one and a third times as wide as deep. " + MAG)

# ── props: six wide or green ones, eight small ones, then the footbridge and the old stone bridge on a sheet of two (so
# neither is upscaled)
J['props26a'] = (L, SREF + ['props1.png', 'props21.png', 'props25a.png'], STYLE + SG + BSH + PROP + "A 3 by 2 grid of six separate "
  "items, each centred in its own cell, each ONE connected object standing on its own small patch of ground. Row 1: (1) the KOEL "
  "BOYS' HANGOUT: a big old RAIN TREE stump with a low spreading crown, a battered portable speaker, upturned crates and a string of "
  "bulb lights in its branches, all on ONE small patch of grass, about one and a half times as wide as deep; (2) a BIRD-SINGING "
  "POLE: a tall thin grey metal pole with a crossbar at the top, THREE little round BAMBOO BIRD CAGES with cloth covers pulled back "
  "hanging from hooks on the crossbar, a tiny bird in each; (3) a big leafy RAIN TREE with a wide umbrella crown. Row 2: (4) a "
  "VOID-DECK STONE CHESS TABLE: a round grey terrazzo table with a chessboard pattern of plain squares on top (no symbols) and four "
  "round stone stools, a few round wooden pieces on it; (5) a MALAY WEDDING DAIS (pelamin): a small raised platform with two "
  "ornate gilded chairs, rich gold and cream drapes, flower stands and a garland arch, about one and a half times as wide as deep; "
  "(6) a clump of tall riverbank GRASSES and reeds with a few lilies, on a little muddy bank. No text anywhere. " + MAG)
J['props26b'] = (L, SREF + ['props1.png', 'props21.png', 'props25b.png'], STYLE + SG + BSH + PROP + "A 4 by 2 grid of eight separate "
  "items, each centred in its own cell, each ONE connected object. Row 1: (1) a HIGH STEPPING STONE: a big flat-topped grey "
  "granite boulder with green MOSS on its sides, its dry top well above a small ring of rippling river water round its foot; (2) a "
  "LOW STEPPING STONE: a flat round pale grey stone sitting just above the surface, its top WET and shining, in a small ring of "
  "rippling water; (3) an OLD SURVEY STONE: a short square weathered GRANITE marker post with a round blank brass cap on top and "
  "a little moss, very old; (4) a small round BAMBOO BIRD CAGE with a hook on top and a blue cloth cover half pulled back, a little "
  "grey-brown zebra dove inside. Row 2: (5) a white plate of HOKKIEN MEE: yellow noodles with prawns and squid, a slice of lime and "
  "a dab of red sambal chilli; (6) a WEDDING BERKAT gift: a little woven basket with a red-dyed egg on a gold paper flower, wrapped "
  "in clear cellophane with a gold ribbon; (7) an old SURVEYOR'S FIELD BOOK: a small worn brown leather notebook tied with a cord, "
  "closed, blank cover; (8) a long glossy black KOEL tail FEATHER. No text anywhere. " + MAG)
J['props26d'] = (SQ, SREF + ['props1.png', 'props21.png', 'props25b.png'], STYLE + SG + BSH + PROP + "ONE item, centred, "
  "filling about half the image: a KOPI IN A BAG, the coffee-shop takeaway of Singapore: a small CLEAR PLASTIC BAG full of milky "
  "brown kopi and a few ice cubes, a pink straw poking out of the knot at the top, tied with a loop of red RAFFIA STRING for a "
  "handle, a few beads of condensation on the plastic. One connected object. No text anywhere. " + MAG)
J['props26c'] = (L, SREF + ['props1.png', 'props25c.png', 'traffic.png'], STYLE + SG + BSH + "A 2 by 1 grid of two separate large "
  "items, each centred in its own half of the image and filling most of it. (1) LEFT half: a BISHAN PARK FOOTBRIDGE over the river "
  "seen from DIRECTLY ABOVE (strict bird's-eye top-down view, like a map): a straight timber footbridge running straight UP and DOWN "
  "the image, about TWICE as long as wide, warm brown deck planks running across it and a slim grey STEEL railing along both long "
  "sides, NO water and NO ground drawn around it; (2) RIGHT half: an OLD STONE BRIDGE ruin seen from a high 3/4 view: a small "
  "low single ARCH of old weathered grey granite blocks, moss and ferns in the joints, one end crumbled, a little wild fig "
  "growing on top, about one and a half times as wide as tall, no water drawn. No text anywhere. " + MAG)

# ── the Bishan Ten: the park's smooth-coated otters (real animals), and a kingfisher
OTTER = ("a real SMOOTH-COATED OTTER (a natural animal, NOT dressed, NOT standing like a person), sleek glossy dark brown fur, a "
  "pale cream throat, a flat round head with little round ears, a broad whiskery muzzle and a thick tapering tail, cute and lively")
J['otters26'] = (L, ['folk1.png', 'beasts25.png', 'beasts19.png'], STYLE + SG + BSH + "A game sprite sheet of real ANIMALS, natural "
  "animals (NOT dressed), cute and gentle, matching the attached sheets in size, ink outline and cel shading, each seen from a high "
  "top-down game camera with a gentle 3/4 tilt, each alone in its cell. A 4 by 2 grid. Row 1: (1) " + OTTER + ", BOUNDING to the "
  "RIGHT on land in side view, back arched, front paws reaching forward; (2) the SAME otter, the next bound: back stretched long, "
  "hind paws pushing off; (3) the same otter SITTING UP on its hind legs, front paws held at its chest, looking round curiously; "
  "(4) the same otter SWIMMING to the RIGHT seen from above, head and back out of the water in a small ring of rippled dark water "
  "touching it. Row 2: (5) a small otter PUP bounding to the RIGHT; (6) the same pup, the other bound; (7) the adult otter ROLLING "
  "on its back on the grass, paws up, playful; (8) a WHITE-THROATED KINGFISHER perched on a short stick: a chocolate-brown head, a "
  "white bib, bright turquoise-blue wings and a big red bill. " + MAG)

# ── Ah Wei's Koel Boys (the case and chase steps' crew in Bishan and Ang Mo Kio)
J['koel26'] = (L, ['pucong25.png', 'crabs21.png', 'owls19.png', 'play.png'], STYLE + SG + BSH + "A game sprite sheet of ONE kind of "
  "character in eleven poses: a cute cheeky anthropomorphic ASIAN KOEL standing upright on two short dark legs (glossy blue-black "
  "feathers, bright RED eyes, a pale ivory bill, a long tail, wings used like arms), in a heartland crew look: a loose WHITE "
  "singlet and a pair of baggy orange-and-black tracksuit shorts, the same koel in every frame, cheeky and never scary, matching the "
  "attached gang sheets exactly in size, style and layout. " + VIEW34 + "A 4 by 3 grid. Row 1: (1) walking TOWARD the camera, left "
  "leg forward; (2) the same, right leg forward; (3) walking AWAY from the camera (we see its back and long tail), left leg; (4) the "
  "same, right leg. Row 2: (5) RUNNING fast to the RIGHT in profile, wings out, long stride; (6) running to the RIGHT, the other "
  "stride; (7) CALLING loudly: head thrown back, beak WIDE OPEN, wings raised, chest puffed; (8) PEERING suspiciously: head pushed "
  "forward, red eyes narrowed. Row 3: (9) MUNCHING: a little red fig in its beak, distracted and happy; (10) TAUNTING: wings on "
  "hips, smug, chest out; (11) DIZZY and DAZED: wobbling, eyes swirly, a small ring of little yellow STARS circling right on top "
  "of its head, touching it; (12) a black feather (spare). " + MAG)

# ── the chapter-seventeen cast: portraits (four moods each), Ah Wei's on their own, then full bodies copied from them
J['faces26'] = (SQ, ['portraits.png', 'faces25.png', 'faces21.png'], STYLE + SG + BSH + "Four " + CAST6 + "A sheet of sixteen "
  "character portraits in a 4 by 4 grid. " + MOODS4 + "Row 1: " + MERBOK + ". Row 2: " + PUYUH + ". Row 3: " + KURA + ". Row 4: "
  + KIJANG + ". " + MAG)
J['faces26b'] = (SQ, ['portraits.png', 'faces25b.png', 'faces21.png'], STYLE + SG + BSH + "One " + CAST6 + "A sheet of four character "
  "portraits of the SAME character in a 2 by 2 grid, each a separate head-and-shoulders bust facing the viewer in the same framing, "
  "size, clothes and colours, each portrait the same size as one portrait on the attached sheets, changing ONLY the facial "
  "expression: top left CALM, a cocky relaxed look; top right HAPPY, a big show-off grin; bottom left WORRIED, eyes darting, beak "
  "wobbly; bottom right CROSS, brows down hard, scowling. No speech bubbles, no symbols, no text. The character: " + AHWEI + ". " + MAG)
J['cast26'] = (L, ['cast-ref26.png', 'folk1.png', 'sg-npc.png', 'play.png'], STYLE + SG + BSH + "A game sprite sheet of four "
  "characters for a top-down game, the characters in the attached portrait strip (left to right = rows 1 to 4). " + BODY + POSES +
  "Row 1: " + MERBOK + ", full body, standing upright on two short pinkish bird legs, loose grey trousers. Row 2: " + PUYUH +
  ", full body, standing upright on two short orange bird legs, black trousers. Row 3: " + KURA + ", full body, standing upright on "
  "two short stout legs, navy work trousers, her shell on her back. Row 4: " + KIJANG + ", full body, standing upright on two slim "
  "legs with small hooves, the long maroon kurung skirt. " + MAG)
J['cast26b'] = (L, ['koel-ref26.png', 'cast25.png', 'koel26.png', 'folk1.png'], STYLE + SG + BSH + "A game sprite sheet "
  "of ONE character for a top-down game, the character in the FIRST attached portrait, now shown full body. " + BODY + "He is "
  "drawn at the SAME size, ink outline and cel shading as one character on the second attached sheet (four other characters), and "
  "his body is an Asian koel like the third attached sheet's little ones but bigger, older and flashier. A 3 by 2 grid of six frames, "
  "the SAME character ALWAYS FACING THE CAMERA, standing on the spot, the same size, clothes and colours in every frame, left to right "
  "and top to bottom: (1) IDLE, standing relaxed and cocky, wings at the sides; (2) IDLE breathing, the same pose with the chest puffed "
  "very slightly and the head tilted a touch, a tiny fidget; (3) WAVING hello with one wing raised high above the head, a big "
  "show-off look; (4) the same wave with the raised wing swung to the other side; (5) TALKING, beak open mid-word, one wing held out "
  "to the side, bragging; (6) TALKING, beak open, both wings raised to the chest, expressive. The character: " + AHWEI +
  ", full body, standing upright on two short dark legs, the SAME silver bomber jacket, the same whistle on its chain and the same "
  "sunglasses on his head as his portrait, black track pants with an orange stripe. " + MAG)

# ── the heroes' new actions (both heroes, the same six), in their chapter-seventeen outfits
def act26(who, desc):
    return (L, REF + [f'{who}-act25.png', f'{who}-act24.png', f'{who}-act.png'], STYLE + SG + CHIN + desc + NEWCLOTHES + f"A game "
      f"sprite sheet of {who.title()} only, matching the attached sprite sheets of the same character exactly in proportions, face, fur "
      "colour and scale (the same size as the figures on the first attached sprite sheet). A 3 by 2 grid of six separate poses of ONE "
      "character, each alone in its cell, all seen from a high top-down game camera with a gentle 3/4 tilt, both big round ears fully "
      "visible in every pose, NO stones, NO water, NO furniture and NO ground drawn. Top row: (1) HOPPING: in mid-air LEAPING to the "
      "RIGHT in 3/4 profile, both knees tucked up, both arms swung forward and up for balance, ears streaming back, eyes on the "
      "landing; (2) LANDING and BALANCING: standing on ONE foot with the other leg lifted behind, both arms flung out wide to the sides "
      "and wobbling, tongue out in concentration; (3) SWEPT OFF: knocked sideways off balance, falling to the LEFT with both arms "
      "flailing up, one leg kicked up, mouth wide open in a yelp, ears flying. Bottom row: (4) PLAYING CHESS, THINKING: SITTING on a low "
      "round stool facing RIGHT, leaning forward with elbows on knees and chin in one paw, frowning in deep thought; (5) PLAYING "
      "CHESS, MOVING: sitting on the same low stool facing RIGHT, leaning forward and reaching out one paw to push a small round "
      "wooden game piece (the piece in the paw, nothing else drawn), a sly grin; (6) SLIDING: sitting on the ground sliding down feet "
      "FIRST toward the RIGHT, legs straight out in front, leaning back, both arms raised high above the head, mouth open laughing, "
      "ears flying back. " + MAG)
J['dora-act26'] = act26('dora', DORA_BS)
J['enzo-act26'] = act26('enzo', ENZO_BS)

# ── the interface: round icons and map landmarks
J['ui26'] = (L, SREF + ['icons.png', 'ui25.png', 'ui24.png'], STYLE + SG + "A game UI icon sheet painted like enamel shop signs and "
  "lacquered wood with gold trim, matching the attached icons in style, chunky and readable at small size. A 4 by 2 grid of eight "
  "separate items. Row 1: (1) a round icon of three flat grey STEPPING STONES in a row across blue rippling water, in a gold ring; "
  "(2) a round icon of a stack of round plain wooden GAME PIECES on a chequered board corner (no symbols on the pieces), in a gold "
  "ring; (3) a round icon of a curly red-and-white mosaic DRAGON playground slide, in a gold ring; (4) a round icon of a little "
  "BAMBOO BIRD CAGE with a small dove inside, in a gold ring. Row 2: (5) a small map landmark icon of a curved timber FOOTBRIDGE over "
  "a winding blue river with green banks; (6) a small map landmark icon of a cute brown OTTER sitting up on a rock; (7) a small map "
  "landmark icon of three tall thin poles with little bird cages hanging from them; (8) a map PIN shaped like a teardrop with a "
  "little black KOEL face (red eye, pale bill) inside. No text, no letters, no numbers. " + MAG)

# ── the three Bishan and Ang Mo Kio properties, each its own stand at four levels (shuttered, then three upgrades)
J['emp26-props'] = (L, SREF + ['emp-props4.png', 'emp25-props.png', 'emp24-props.png'], STYLE + SG + BSH + EMP + GROWP + "Row 1: an "
  "ANG MO KIO HOKKIEN MEE stall: a hawker stall with a stainless steel counter, a huge flaming WOK, plates of yellow noodles, a "
  "blank menu board and a fluorescent light. Row 2: a BIRD-SINGING CORNER KOPI stall: a little kopi kiosk with a green-grey roof, "
  "kopi pots, cups and saucers, a row of covered bird cages hung under the eaves. Row 3: a BISHAN PARK BICYCLE AND SCOOTER HIRE: a "
  "timber kiosk with a rack of colourful hire bicycles and kick scooters, helmets on hooks and a park map board (blank). " + MAG)

# the market panel's scene: the Ang Mo Kio market and food centre at night (empty: no stall-keeper, no characters)
J['stall-bishan'] = (L, SP + ['stall-punggol.png', 'stall-kranji.png', 'stall-islands.png'], STYLE + SG + BSH + "A shop scene seen "
  "straight on from the customer's side of a counter, painted edge to edge, matching the attached market panels in framing and style "
  "but with NOBODY in it: no stall-keeper, no customers, no characters or animals at all. A HOKKIEN MEE STALL in the ANG MO KIO "
  "MARKET AND FOOD CENTRE late at night: a stainless steel counter runs across the bottom third of the image holding plates of "
  "hokkien mee, a bowl of lime halves, a pot of red sambal and a stack of melamine plates; behind it a huge black WOK on a roaring "
  "gas flame, a big stock pot steaming, a blank menu board and a fluorescent tube light; to the sides rows of round tables and "
  "plastic stools under ceiling fans; through the open side of the hall a glimpse of wet night streets and lit HDB blocks. Keep "
  "the middle of the image clear and calm behind the counter. No text, signs are blank shapes.")

# ── the chapter card (chapter seventeen, "the red-haired man's bridge"; not an ending): painted last, with the heroes'
# chapter sheets attached
J['chapter-17'] = (L, REF + ['dora-act26.png', 'enzo-act26.png', 'chapter-16.png'], STYLE + SG + BSH + CHIN + DORA_BS + ENZO_BS +
  "Both wear exactly the outfits described here and seen on the second and third attached sheets (Dora cream-white in the sky-blue "
  "rain jacket, Enzo grey in the brick-red checked shirt), no hats. " + PANEL + "A chapter title painting for 'the red-haired man's "
  "bridge': at NIGHT just after monsoon rain, Dora and Enzo crouch side by side on flat STEPPING STONES in the middle of the winding "
  "naturalised KALLANG RIVER in BISHAN-ANG MO KIO PARK, seen from a little behind and to the side so we see both their faces in "
  "three-quarter view and BOTH big round ears on each of them, looking at a small OLD SURVEY STONE of weathered granite half "
  "uncovered in the bank, its brass cap glinting in a torch beam; a little family of SMOOTH-COATED OTTERS watches curiously from a "
  "rock; the water runs high and fast; behind, a curved timber footbridge, rain trees, and the lit windows of HDB blocks with "
  "pitched red roofs; far off on the footbridge stands a tall elegant BLACK SWAN in a black dress, watching. Leave the top fifth of "
  "the image as calm night sky with thinning rain clouds and a glimpse of the moon. No text.")
