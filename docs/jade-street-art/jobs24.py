# Jade Street, the twenty-fourth pass's paintings: Kranji and Woodlands, the far north of Singapore, and chapter fifteen.
# The ground (the Sungei Buloh mudflats, the tea-dark water among the mangrove roots, the Kranji farms' tilled fields,
# Woodlands' paving), the district's buildings (the Sungei Buloh visitor centre and bird hide, Woodlands Checkpoint, the
# farms, the Woodlands blocks, kopitiam and station) and the Kranji War Memorial on its own sheet, two prop sheets, the
# wetland's and the farms' animals, the basking crocodile (four registered frames), Madam Sutera's limousine and a
# Malaysian lorry, Bos Belacak's Mudskipper Boys, five new portraits (four in four moods, Belacak's on his own sheet) then
# four full bodies, the heroes' new actions (wading the mud, frozen still by a crocodile, scrambling back, feeding a goat,
# bowing at the memorial), map icons, the three new properties' stands, the market panel and the chapter card. The game
# uses real Singapore names in its TEXT, but the paintings keep the no-lettering rule: no text, letters, numbers, logos or
# flags anywhere. Run with ~/arcade-protos/jade24-sheets/gen24.py (the prompt comes before the image flags; stdin closed),
# as pass 21 ran jobs21.py with its own gen21.py; cut and packed by scripts/jade-art24.py.
from jobs import STYLE, CHIN, DORA, ENZO, MAG, GRN, VIEW34, L, SQ, REF, SREF
from jobs6 import MOODS4, CAST6
from jobs7 import POSES, BODY
from jobs2 import PANEL
import importlib.util
from pathlib import Path

_f = Path(__file__).parent / 'jobs-empire.py'
_sp = importlib.util.spec_from_file_location('jobs_empire', _f); _emp = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(_emp)
EMP, GROWP = _emp.EMP, _emp.GROWP

SG = ("The setting is SINGAPORE at night, painted warmly and respectfully, celebrating its real places with care: no "
 "caricature, no stereotypes. Absolutely NO lettering anywhere: no text, letters, numbers, logos, brand marks or flags; every sign is "
 "a blank coloured shape. ")
KRJ = ("This part of the world is KRANJI AND WOODLANDS, the far north of SINGAPORE on the Strait of Johor, on a warm clear NIGHT "
 "under a big moon: the SUNGEI BULOH wetland reserve with its dense MANGROVES on arching stilt roots, wide glistening grey-brown "
 "MUDFLATS at low tide crossed by a timber boardwalk, wading shorebirds, mudskippers and basking estuarine crocodiles; KRANJI "
 "RESERVOIR and its long low dam; the KRANJI countryside farms (a frog farm, a goat dairy, vegetable fields, an old orchid "
 "greenhouse); the WOODLANDS new town of tall cream-and-teal HDB flat blocks, a kopitiam and an MRT station; WOODLANDS CHECKPOINT "
 "and the long CAUSEWAY across the strait to Johor, its lamps and car lights glittering on the water. Moonlit silver-blue night, "
 "warm lamp light, cosy and adventurous, never spooky. ")
# the Kranji War Memorial and its graves: quiet and dignified (STYLE's cheerful lanterns and neon do not apply here)
SOLEMN = ("This is a WAR MEMORIAL and war cemetery: paint it quietly, plainly and with great respect, in calm moonlight, cool "
 "silver-blue and white. NO lanterns, NO neon, NO festive lights, NO figures or characters of any kind, NO comedy, nothing cute "
 "added to it. ")
PROP = ("Each object is seen from a HIGH top-down game camera with a gentle 3/4 tilt, matching the attached prop sheets exactly in "
 "scale, ink outline, cel shading and warm night lighting. ")
BLD = ("Each building is seen from a HIGH top-down camera with a gentle 3/4 tilt at the SAME angle as the attached building sheets, so we "
 "look DOWN onto its whole ROOF (the roof takes up the top two thirds of each building) and see only a short strip of the front "
 "facade at the bottom. NOT a flat front elevation. No ground plate, no plaza and no pavement under or around a building: each "
 "building's outline is just its own roof, walls and steps. Each building alone in its cell with space around it. ")
NOPLANT = ("No trees, no bushes, no potted plants, no grass and no foliage on or around these buildings, and no bright green paint. ")
KEDIDI = ("KAK KEDIDI, a keen kind young bird ringer, a WHIMBREL: a brown-and-buff streaked shorebird with a long thin DOWN-CURVED "
 "bill, a striped crown, bright dark eyes, wearing a sand-coloured many-pocketed field vest over a pale shirt, a pair of binoculars "
 "round her neck and a small canvas pouch of ring pliers on her belt")
BIAWAK = ("PAK BIAWAK, the calm patient old warden of Sungei Buloh, a WATER MONITOR LIZARD: dark grey-brown scaly skin with rows of "
 "pale yellow spots, a long neck, a long forked-tongue snout (tongue in), wise heavy-lidded eyes, wearing a khaki park warden's "
 "uniform shirt with shoulder tabs and a khaki peaked warden's cap, a torch clipped to his belt")
KATAK = ("AUNTIE KATAK, a brisk cheerful frog farmer, an ASIAN BULLFROG: a plump olive-and-brown bullfrog with a broad smiling mouth, "
 "big golden eyes, a pale throat, wearing a blue rubber work apron over a floral blouse, yellow rubber gloves pushed up and a "
 "towel round her neck")
KAMBING = ("UNCLE KAMBING, a gentle chatty goat farmer, a white-and-brown dairy GOAT with a little white beard, floppy ears and small "
 "curved horns, wearing a wide woven straw hat and blue denim farm overalls over a checked shirt, a sprig of hay in his mouth")
BELACAK = ("BOS BELACAK, the swaggering vain boss of the Mudskipper Boys, a big MUDSKIPPER fish standing upright: a blunt rounded "
 "grey-brown head speckled with tiny bright blue spots, two bulging round eyes sitting high on TOP of the head, a wide grinning "
 "mouth, a spiny fin on his back, wearing a gold chain round his neck and a white-and-navy ship captain's cap; pompous and comic, "
 "never scary")
# the heroes' Kranji outfit: their usual Jade Street clothes plus wellies and a bucket hat (DORA/ENZO's "No hat" dropped)
KR = (" For the wetland and the farms this character ALSO wears a pair of tall GREEN RUBBER WELLINGTON BOOTS up to the knee and a soft "
 "dark KHAKI-OLIVE canvas BUCKET HAT that sits between the two big round ears (both ears always fully visible, never hidden or "
 "squashed by the hat); otherwise exactly the same outfit as the attached sheets, carrying nothing unless a pose says so. The "
 "accessory rule above does not apply to these boots and this hat. ")
DORA_KR, ENZO_KR = DORA.replace('No hat, carries nothing. ', ''), ENZO.replace('No hat, carries nothing. ', '')
J = {}

# ── the ground: four seamless textures
J['ground24'] = (L, SREF + ['ground21.png', 'ground19.png'], STYLE + SG + KRJ + "Four separate SQUARE seamless ground TEXTURES for a "
  "top-down game, matching the attached ground textures exactly in scale and style, seen from directly above, flat, evenly lit at "
  "night, no objects, no lines, no borders: a 2 by 2 grid of four squares that each fill their cell completely, edge to edge, with thin "
  "black gaps between them. Every texture must be CALM and LOW CONTRAST so characters drawn on top stay easy to read: no big motifs, "
  "no strong outlines. Top row: (1) a tidal MUDFLAT seen from above: smooth glistening grey-brown wet mud with a soft moonlit sheen, "
  "a scatter of tiny crab burrow holes and faint three-toed bird footprints; (2) dark TEA-COLOURED mangrove WATER, still and "
  "brown-black with faint amber glints, a few thin mangrove roots and fallen leaves just under the surface. Bottom row: (3) tilled "
  "FARM SOIL: dark brown earth in neat even furrows with small rows of young seedlings; (4) WOODLANDS town PAVING: square grey "
  "concrete paving slabs with a band pattern of terracotta-red bricks, even and clean.")

# ── buildings. Sheet 1 on GREEN (none of them green, no plants); sheet 2 on MAGENTA (the frog sign, the greenhouse's
# plants, the teal HDB and the MRT sign are green); the memorial alone on GREEN. The packer stretches each to its footprint.
J['kranji-bld'] = (L, SREF + ['islands-bld.png', 'mandai-bld.png', 'kallang-bld.png'], STYLE + SG + KRJ + "A game sprite sheet of "
  "four separate KRANJI buildings for a top-down game. " + BLD + "A 2 by 2 grid. Row 1: (1) the SUNGEI BULOH VISITOR CENTRE: a long "
  "low timber pavilion with a broad dark shingled hipped roof with deep overhanging eaves, timber posts and a wide open verandah, "
  "warm lamps under the eaves, about one and two-thirds times as wide as deep; (2) WOODLANDS CHECKPOINT: a big modern grey-and-white "
  "customs building with a huge flat white canopy roof spanning over a row of small inspection booths with barrier arms, pale "
  "concrete and grey glass, bright white floodlights, about one and a half times as wide as deep. Row 2: (3) a wooden BIRD HIDE on "
  "stilts: a small plain timber hut raised on posts with a sloping tin roof and long thin horizontal slit windows, a few steps up "
  "to it, about one and a half times as wide as deep; (4) the HAY DAIRIES GOAT BARN: a long raised timber barn on short stilts with "
  "a pitched red zinc roof, slatted wooden walls, a ramp up to a wide door, about one and a third times as wide as deep. " + NOPLANT + GRN)
J['kranji-bld2'] = (L, SREF + ['islands-bld.png', 'mandai-bld.png', 'ubin-bld2.png'], STYLE + SG + KRJ + "A game sprite sheet of "
  "six separate KRANJI and WOODLANDS buildings for a top-down game. " + BLD + "A 3 by 2 grid. Row 1: (1) a FROG FARM shed: a long "
  "low open-sided shed with a grey corrugated ZINC roof, concrete frog tanks inside, and a big round painted sign board of a "
  "smiling green frog (no letters), about one and a third times as wide as deep; (2) an OLD ORCHID GREENHOUSE: glass panes in a "
  "white-painted iron frame with a curved glass roof, a few panes cracked, orchids and creepers inside and climbing up one "
  "corner, a little overgrown, about one and a third times as wide as deep; (3) a WOODLANDS HDB FLAT BLOCK: a tall slab block of "
  "public flats painted CREAM with TEAL bands, rows of windows and corridors, laundry poles, a flat roof with water tanks, about "
  "one and a third times as wide as deep. Row 2: (4) a KOPITIAM: an open-fronted corner coffee shop with a red tiled awning, no "
  "front wall, round white MARBLE-topped tables and stools inside, a drinks counter at the back, warm fluorescent light, about one "
  "and a third times as wide as deep; (5) a small HDB VOID DECK flat front: the open ground floor of a flat block with pale pillars, "
  "a stone table with stools, letterboxes and a front door with a lamp, about one and a half times as wide as deep; (6) an MRT "
  "STATION ENTRANCE: a modern curved white canopy over an escalator and stairs going down, with a tall round sign post of a red "
  "and green circle (no letters), about as wide as deep. " + MAG)
J['kranji-memorial'] = (L, SREF + ['islands-bld.png', 'sg-bld.png', 'mandai-bld.png'], STYLE + SG + SOLEMN +
  "ONE building alone in the middle of the image for a top-down game: the KRANJI WAR MEMORIAL, seen from a HIGH top-down camera "
  "with a gentle 3/4 tilt at the SAME angle as the attached building sheets, so we look DOWN onto it: a long dignified structure of "
  "plain WHITE concrete: a single straight ROW OF TWELVE slender square white COLUMNS, carrying a thin FLAT ROOF shaped like a long "
  "aeroplane WING spread across them, and rising from the middle of it a TALL slim white central PILLAR topped with a small STAR; "
  "all standing on a wide low STEPPED white stone base. The whole memorial is about TWICE as wide as deep in the picture. Plain, "
  "calm and beautiful, softly lit by moonlight. No people, no flags, no wreaths, no writing. No ground plate, no lawn, no plants "
  "round it. " + GRN)

# ── props: the wide ones on a sheet of six (so none is upscaled), the small ones on a sheet of twelve
J['props24a'] = (L, SREF + ['props1.png', 'props21.png', 'props19.png'], STYLE + SG + KRJ + PROP + "A 3 by 2 grid of six separate "
  "items, each centred in its own cell. Row 1: (1) a row of FIVE plain low WHITE HEADSTONES side by side in a straight line, "
  "rounded tops, seen from above at 3/4, with nothing else: no flowers, no writing, quiet and respectful, the row about four "
  "times as wide as deep; (2) the MUDSKIPPERS' CAMP: a little driftwood lean-to with a patched tarpaulin roof, wooden crates, a "
  "coil of rope and a glowing lantern, sitting on a patch of mud, about one and a half times as wide as deep; (3) a small concrete "
  "DAM SLUICE HOUSE: a squat grey concrete hut with a flat roof, a big iron wheel valve and a steel sluice gate frame beside it, "
  "about one and a half times as wide as deep. Row 2: (4) a MANGROVE TREE: a rounded crown of dark glossy green leaves on a "
  "tangle of ARCHING STILT ROOTS standing in the mud; (5) a NIPA PALM: a clump of long feathery upright green fronds rising "
  "straight from the mud, no trunk; (6) a clump of young MANGROVE SEEDLINGS and pencil-like breathing roots poking up from a patch "
  "of grey mud, about one and a half times as wide as deep. No text anywhere. " + MAG)
J['props24b'] = (L, SREF + ['props1.png', 'props21.png', 'props19.png'], STYLE + SG + KRJ + PROP + "A 4 by 3 grid of twelve separate "
  "items, each centred in its own cell. Row 1: (1) an old weathered WOODEN POST standing in a patch of mud, silver-grey timber, a "
  "small brass plate screwed to it (blank); (2) a plain timber PARK BENCH; (3) one section of timber GOAT-PEN FENCE: two posts and "
  "three horizontal rails; (4) three short ROWS OF VEGETABLES in dark soil: okra plants, long beans on little sticks and red chilli "
  "plants. Row 2: (5) a neat SQUARE CLIPPED HEDGE block, flat-topped and dark green; (6) a FRANGIPANI bush with dark green leaves "
  "and clusters of white-and-yellow flowers; (7) a small round WREATH of white-and-yellow frangipani flowers lying on a grey stone "
  "slab, simple and respectful; (8) a bundle of golden HAY tied with twine. Row 3: (9) an old 1930s square BISCUIT TIN, dented and "
  "rusty, faded red and gold paint, blank lid; (10) a battered old pocket NOTEBOOK with a stained buckram cover tied with string; "
  "(11) a hawker's TRAY of four glasses of milky brown KOPI in a looped plastic bag-holder with a handle; (12) a small rubber "
  "dinghy oar (spare). No text anywhere. " + MAG)

# ── the wetland's and the farms' animals, real animals (not dressed, not standing upright)
J['beasts24'] = (L, ['folk1.png', 'beasts19.png', 'reef21.png'], STYLE + SG + KRJ + "A game sprite sheet of fourteen real ANIMALS, "
  "natural animals (NOT dressed, NOT standing upright), cute and gentle, matching the attached sheets in size, ink outline and cel "
  "shading, each seen from a high top-down game camera with a gentle 3/4 tilt, each alone in its cell. A 5 by 3 grid. Row 1: (1) "
  "a MUDSKIPPER fish perched on a little dab of mud, facing RIGHT, grey-brown with tiny blue spots, bulging eyes on top of its head; "
  "(2) the same mudskipper mid-HOP to the right, body flicked up off the mud; (3) a WATER MONITOR LIZARD walking to the RIGHT in "
  "profile from above, long tail, dark scaly skin with pale yellow spots, left legs forward; (4) the same lizard, right legs "
  "forward; (5) a small dark brown OWL perched on a short branch stub, round watchful yellow eyes, facing the camera. Row 2: (6) a "
  "WHIMBREL (brown streaked shorebird with a long down-curved bill) standing facing RIGHT, bending to PROBE the mud with its bill; "
  "(7) the same whimbrel WALKING to the right, head up; (8) the same whimbrel FLYING to the right seen from above, wings raised UP; "
  "(9) the same, wings swept DOWN; (10) a little white egret (spare). Row 3: (11) a white-and-brown dairy GOAT standing facing "
  "RIGHT, head up; (12) the same goat with its head DOWN, EATING; (13) a small green-and-brown FROG sitting, facing RIGHT; (14) the "
  "same frog mid-LEAP to the right, legs stretched out behind; (15) a kingfisher (spare). " + MAG)
# the crocodile: four frames that must lie on top of each other in the game (the packer aligns them on the body)
J['croc24'] = (L, ['beasts19.png', 'reef21.png', 'folk1.png'], STYLE + SG + KRJ + "A game sprite sheet of ONE real ESTUARINE "
  "CROCODILE basking on the mud (a natural animal, not dressed), seen from a high top-down game camera with a gentle 3/4 tilt, "
  "lying stretched out lengthways with its head pointing to the RIGHT and its long tail to the LEFT, dark olive-grey knobbly "
  "armoured back, pale belly edge, matching the attached sheets in ink outline and cel shading; drawn a little goofy and sleepy "
  "rather than scary, no teeth dripping, no blood. A 2 by 2 grid of four frames of the SAME crocodile in EXACTLY the same place, "
  "size and body position in every cell (only the head, eyes and jaw change), centred in each cell: (1) DOZING, eyes shut, jaw "
  "closed, a tiny bubble at the nostril; (2) PEEKING: still lying flat, ONE eye open a slit; (3) WATCHING: head raised a little off "
  "the mud, BOTH eyes wide open, alert; (4) SNAPPING: head lunging forward to the right, jaws wide open (blunt cartoon teeth), a "
  "splash of mud. " + MAG)
# Madam Sutera's limousine and a Malaysian lorry, painted like the traffic sheet's cars
J['cars24'] = (L, SREF + ['traffic.png'], STYLE + SG + "A game sprite sheet of two empty VEHICLES for a top-down city game, matching "
  "the attached traffic sheet's cars EXACTLY in style, ink outline, chunky toy-like proportions and view: seen from DIRECTLY ABOVE "
  "(strict bird's-eye top-down view, like a map), every vehicle pointing straight UP the image (front with its headlights at the "
  "TOP, red tail lights at the bottom). A 2 by 1 grid. (1) a long sleek BLACK LIMOUSINE with dark tinted windows, a glossy black "
  "roof, chrome trim and a long bonnet, about two and a half times as long as wide; (2) a colourful MALAYSIAN LORRY: a small flat-"
  "nosed blue truck cab with a long open cargo deck behind it covered by a bright orange-and-yellow striped tarpaulin roped down, "
  "painted with colourful stripes and flowers (no letters), about two and a half times as long as wide. Nobody visible. " + MAG)

# ── Bos Belacak's Mudskipper Boys (the case and swap steps' guards in Kranji)
J['skippers24'] = (L, ['crabs21.png', 'owls19.png', 'play.png'], STYLE + SG + KRJ + "A game sprite sheet of ONE kind of character in "
  "ten poses: a cute cheeky anthropomorphic MUDSKIPPER standing upright on its two front FINS like little legs (a blunt grey-brown "
  "fish body speckled with tiny bright blue spots, two big BULGING round eyes sitting high on TOP of the head, a wide grin, a spiny "
  "back fin, a tail behind), wearing a little brown flat cap and a dark waistcoat vest, the same mudskipper in every frame, cheeky "
  "and never scary, matching the attached gang sheets exactly in size, style and layout. " + VIEW34 + "A 5 by 2 grid. Row 1: (1) "
  "waddling TOWARD the camera, left fin forward; (2) the same, right fin forward; (3) waddling AWAY from the camera, left fin; (4) "
  "the same, right fin; (5) hopping fast to the RIGHT in profile. Row 2: (6) hopping to the RIGHT, the other bounce; (7) CALLING "
  "the others, both fins raised high, mouth wide open; (8) PEERING suspiciously, eyes stretched up tall on top of the head; (9) "
  "MUNCHING a little worm, distracted; (10) TAUNTING, fins on hips, smug. " + MAG)

# ── the chapter-fifteen cast: portraits (four moods each), Belacak's on their own, then full bodies copied from them
J['faces24'] = (SQ, ['portraits.png', 'faces21.png', 'faces19.png'], STYLE + SG + KRJ + "Four " + CAST6 + "A sheet of sixteen "
  "character portraits in a 4 by 4 grid. " + MOODS4 + "Row 1: " + KEDIDI + ". Row 2: " + BIAWAK + ". Row 3: " + KATAK + ". Row 4: "
  + KAMBING + ". " + MAG)
J['faces24b'] = (SQ, ['portraits.png', 'faces21.png', 'faces19.png'], STYLE + SG + KRJ + "One " + CAST6 + "A sheet of four character "
  "portraits of the SAME character in a 2 by 2 grid, each a separate head-and-shoulders bust facing the viewer in the same framing, "
  "size, clothes and colours, each portrait the same size as one portrait on the attached sheets, changing ONLY the facial "
  "expression: top left CALM, a smug relaxed look; top right HAPPY, a big gloating grin; bottom left WORRIED, eyes darting, mouth "
  "wobbly; bottom right CROSS, brows down hard, scowling. No speech bubbles, no symbols, no text. The character: " + BELACAK + ". " + MAG)
J['cast24'] = (L, ['cast-ref24.png', 'folk1.png', 'sg-npc.png', 'play.png'], STYLE + SG + KRJ + "A game sprite sheet of four "
  "characters for a top-down game, the characters in the attached portrait strip (left to right = rows 1 to 4). " + BODY + POSES +
  "Row 1: " + KEDIDI + ", full body, standing upright on two thin long bird legs. Row 2: " + BIAWAK + ", full body, standing "
  "upright on two short legs, his long tail behind, khaki shorts. Row 3: " + KATAK + ", full body, standing upright on two stout "
  "legs in short black rubber boots. Row 4: " + KAMBING + ", full body, standing upright on two legs with little hooves. " + MAG)

# ── the heroes' new actions (both heroes, the same six)
def act24(who, desc):
    return (L, REF + [f'{who}-act.png', f'{who}-act21.png', f'{who}-act19.png'], STYLE + SG + CHIN + desc + KR + f"A game sprite "
      f"sheet of {who.title()} only, matching the attached sprite sheets of the same character exactly (same proportions, same outfit, "
      "same scale). A 3 by 2 grid of six separate poses of ONE character, each alone in its cell, all seen from a high top-down game "
      "camera with a gentle 3/4 tilt. Top row: (1) WADING KNEE-DEEP through sticky grey-brown MUD to the RIGHT in profile: a heavy "
      "slow step, the LEFT boot hauled up out of the mud with a gloopy string of mud, leaning forward, arms out, a little patch of "
      "mud round the other leg; (2) the same wade, the RIGHT boot hauled up, the other foot sunk; (3) FROZEN stock-still mid-step on "
      "the mud facing the camera, arms tucked tight to the body, eyes wide and round, holding the breath, one boot lifted a little. "
      "Bottom row: (4) SCRAMBLING BACKWARDS in a hurry away from something to the right, leaning back, arms flailing, splattered "
      "with blobs of mud, a splash of mud at the boots; (5) standing facing the camera holding out a handful of golden HAY in one "
      "paw at waist height to the side, as if feeding a goat beside (NO goat in the picture), smiling gently; (6) a QUIET MOMENT OF "
      "RESPECT: standing perfectly still facing the camera, head BOWED, eyes closed, the bucket hat taken OFF and held in both paws "
      "clasped in front of the tummy, the two big round ears free; solemn and calm, NO smile. " + MAG)
J['dora-act24'] = act24('dora', DORA_KR)
J['enzo-act24'] = act24('enzo', ENZO_KR)

# ── the interface: round icons and map landmarks
J['ui24'] = (L, SREF + ['icons.png', 'ui21.png', 'ui19.png'], STYLE + SG + "A game UI icon sheet painted like enamel shop signs and "
  "lacquered wood with gold trim, matching the attached icons in style, chunky and readable at small size. A 4 by 2 grid of eight "
  "separate items. Row 1: (1) a round icon of a small shiny ALUMINIUM BIRD LEG RING (a little open metal band), in a gold ring; (2) "
  "a round icon of a friendly CROCODILE HEAD seen from the side, in a gold ring; (3) a round icon of a WHIMBREL shorebird with a "
  "long down-curved bill, in a gold ring; (4) a round icon of a cheerful FROG, in a gold ring. Row 2: (5) a small map landmark "
  "icon of a MANGROVE tree on stilt roots beside a timber BOARDWALK; (6) a small map landmark icon of a simple dignified WAR "
  "MEMORIAL: a row of slim white columns under a flat roof with a tall central pillar, plain and calm, no lanterns; (7) a small map "
  "landmark icon of a long low CAUSEWAY bridge over water with tiny cars on it; (8) a map PIN shaped like a teardrop with a little "
  "MUDSKIPPER face (bulging eyes on top) inside. No text, no letters, no numbers. " + MAG)

# ── the three Kranji properties, each its own stand at four levels (shuttered, then three upgrades)
J['emp24-props'] = (L, SREF + ['emp-props4.png', 'emp21-props.png', 'emp19-props.png'], STYLE + SG + KRJ + EMP + GROWP + "Row 1: a "
  "KRANJI FARM PRODUCE STALL: a little timber farm stall with a zinc roof, baskets of okra, long beans, chillies, eggs and jars of "
  "honey, a chalkboard (blank). Row 2: a WOODLANDS WATERFRONT SNACK KIOSK: a white-and-teal seaside kiosk with a striped awning, "
  "ice cream, drinks and curry puffs, a lifebuoy hung on it. Row 3: a KRANJI BICYCLE HIRE stand: a timber hut with a rack of "
  "colourful bicycles, helmets on hooks and a little pump. " + MAG)

# ── the chapter card (chapter fifteen is not an ending: no new end panel)
J['chapter-15'] = (L, REF + ['portraits.png', 'faces24.png', 'chapter-13.png'], STYLE + SG + KRJ + CHIN + DORA_KR + ENZO_KR + KR +
  PANEL + "A chapter title painting for 'spring tide': at DUSK, the sky glowing apricot and violet over the strait, Dora and Enzo "
  "in their green wellies and bucket hats lean side by side on the rail of the SUNGEI BULOH timber boardwalk among the mangroves, "
  "watching a big flock of WHIMBRELS lift off the shining grey-brown MUDFLATS in a swirl of wings; far off on the mud a big "
  "CROCODILE basks with its eyes shut. Across the calm water of the Strait of Johor the long low CAUSEWAY glitters with a string "
  "of lamps and car lights, and beyond it the low lights of Johor on the far shore. Leave the top fifth of the image as calm "
  "evening sky. No text.")

# the market panel's scene: the Woodlands kopitiam at night (empty: no stall-keeper, no characters)
from jobs2 import SP
J['stall-kranji'] = (L, SP + ['stall-islands.png', 'stall-mandai.png'], STYLE + SG + KRJ + "A shop scene seen straight on from the "
  "customer's side of a drinks counter, painted edge to edge, matching the attached market panels in framing and style but with "
  "NOBODY in it: no stall-keeper, no customers, no characters or animals at all. Inside a WOODLANDS KOPITIAM at night: the counter "
  "runs across the bottom third of the image holding a tall kopi pot, a row of thick white cups and saucers, a glass jar of "
  "biscuits, kaya toast on a plate and a tray of soft-boiled eggs; behind it a tiled wall with a blank menu board, shelves of tins "
  "and condensed milk, a slow ceiling fan and warm fluorescent light; to the sides round white MARBLE-topped tables with red "
  "plastic stools; through the open front a glimpse of a cream-and-teal HDB block and the night sky. Keep the middle of the image "
  "clear and calm behind the counter. No text, signs are blank shapes.")

# ── the mud wade's two frames repainted on their own (the six-pose sheets lifted the same boot in both): the packer
# takes mud-wade-0/1 from these when they exist, at the six-pose sheet's scale
def wade24(who, desc):
    return (L, REF + [f'{who}-act24.png', f'{who}-act21.png', f'{who}-act.png'], STYLE + SG + CHIN + desc + KR + f"A game sprite "
      f"sheet of {who.title()} only, matching the attached sprite sheets of the same character exactly (same proportions, same outfit "
      "with the bucket hat and green wellies, same scale as the first attached sheet). A 2 by 1 grid of TWO frames of ONE walk, each "
      "alone in its cell, seen from a high top-down game camera with a gentle 3/4 tilt, both facing RIGHT in profile, sunk KNEE-DEEP "
      "in sticky grey-brown MUD (the mud is a low lumpy pool round the legs, the boots hidden in it up to the knees except the "
      "lifted one), leaning forward with effort, arms out for balance: (1) the FRONT leg (the one nearer the right edge) hauled UP "
      "out of the mud, knee high, the boot dripping a gloopy string of mud, the back leg sunk; (2) the OPPOSITE: the BACK leg (the "
      "one nearer the left edge) now hauled up and swinging forward, knee high, dripping mud, the front leg sunk deep. The two "
      "frames must clearly show DIFFERENT legs lifted. " + MAG)
J['dora-wade24'] = wade24('dora', DORA_KR)
J['enzo-wade24'] = wade24('enzo', ENZO_KR)

# ── Bos Belacak's body (he is a job giver, so he stands in the world like the four above): his six standing frames on a
# sheet of their own, copied from his calm portrait (belacak-ref24.png, the top-left quarter of faces24b) and drawn at the
# size of the cast sheet's givers
J['cast24b'] = (L, ['belacak-ref24.png', 'cast24.png', 'skippers24.png', 'folk1.png'], STYLE + SG + KRJ + "A game sprite sheet "
  "of ONE character for a top-down game, the character in the FIRST attached portrait, now shown full body. " + BODY + "He is "
  "drawn at the SAME size, ink outline and cel shading as one character on the second attached sheet (the four other givers), and "
  "his body is a mudskipper like the third attached sheet's little ones but bigger, older and grander. A 3 by 2 grid of six frames, "
  "the SAME character ALWAYS FACING THE CAMERA, standing on the spot, the same size, clothes and colours in every frame, left to right "
  "and top to bottom: (1) IDLE, standing relaxed and smug, fins at the sides; (2) IDLE breathing, the same pose with the chest puffed "
  "very slightly and the head tilted a touch, a tiny fidget; (3) WAVING hello with one front fin raised high above the head, a big "
  "gloating grin; (4) the same wave with the raised fin swung to the other side. (5) TALKING, mouth open mid-word, one fin held out "
  "to the side palm up, explaining grandly; (6) TALKING, mouth open, both fins raised to the chest, expressive. The character: "
  + BELACAK + ", full body, standing upright on his two stubby front FINS like little legs, a short tail behind, wearing the SAME "
  "navy double-breasted captain's jacket over an open cream shirt collar, the same heavy gold chain and the same white-and-navy "
  "captain's cap with a gold cord as his portrait. " + MAG)
