# Jade Street, the twenty-fifth pass's paintings: Punggol and Coney Island, north-east Singapore, and chapter sixteen.
# The ground (the Lorong Halus reed marsh, Coney Island's casuarina needle litter, the Punggol waterfront deck), the
# district's buildings (two Punggol HDB blocks, the MRT entrance under the LRT viaduct, the waterfront seafood kopitiam,
# the void-deck flat, the kayak hire kiosk; then the old tide-gauge house on stilts, the ruined pre-war beach villa and
# the Lorong Halus research hut), three prop sheets (the red footbridge and Madam Sutera's junk on a sheet of their own so
# neither is upscaled), the Brahman cattle of Coney Island (five frames of one cow on its own sheet, one scale), the
# calf, otters, hornbills and the owl, Abang Pucong's Pucong Boys, five new portraits (four in four moods, Abang Pucong's
# on his own sheet) then five full bodies, the heroes' new actions in their Punggol outfits (herding a cow, fishing off
# the jetty), map icons, the three new properties' stands, the market panel and the chapter card. The game uses real
# Singapore names in its TEXT, but the paintings keep the no-lettering rule: no text, letters, numbers, logos or flags
# anywhere. EVERY sheet is on MAGENTA (roof gardens, vines, casuarinas, reeds and the teal accents are green). Run with
# ~/arcade-protos/jade25-sheets/gen25.py (the prompt comes before the image flags; stdin closed); cut and packed by
# scripts/jade-art25.py. cast25 and cast25b need cast-ref25.png / pucong-ref25.png (cut from faces25 / faces25b with
# mkref.py) and chapter-16 needs dora-act25.png and enzo-act25.png, so those three are painted last.
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
PGL = ("This part of the world is PUNGGOL AND CONEY ISLAND, the north-east shore of SINGAPORE, on a warm clear NIGHT under a big "
 "bright MOON: PUNGGOL POINT and its seaside PROMENADE and timber JETTY looking out across the dark water at the low wooded hills of "
 "PULAU UBIN; an old white colonial TIDE-GAUGE HOUSE standing on stilts over the shore; CONEY ISLAND (Pulau Serangoon) with its "
 "tall feathery CASUARINA woods on carpets of brown needles, wild sandy beaches, free-roaming pale grey-white BRAHMAN CATTLE with "
 "humps and long droopy ears, and an overgrown roofless PRE-WAR BEACH VILLA; PUNGGOL TOWN of tall modern cream-and-white HDB flat "
 "blocks with teal and coral accents along the calm PUNGGOL WATERWAY, timber boardwalks, arched footbridges and the MRT station "
 "under the LRT viaduct; the LORONG HALUS WETLAND of reed ponds with its red timber bridge; the old sea-wall promenade and red "
 "park-connector cycle tracks. Moonlit silver-blue night, warm lamp light, cosy and adventurous, never spooky. ")
PROP = ("Each object is seen from a HIGH top-down game camera with a gentle 3/4 tilt, matching the attached prop sheets exactly in "
 "scale, ink outline, cel shading and warm night lighting. ")
BLD = ("Each building is seen from a HIGH top-down camera with a gentle 3/4 tilt at the SAME angle as the attached building sheets, so we "
 "look DOWN onto its whole ROOF (the roof takes up the top two thirds of each building) and see only a short strip of the front "
 "facade at the bottom. NOT a flat front elevation. No ground plate, no plaza and no pavement under or around a building: each "
 "building's outline is just its own roof, walls and steps (and its own stilts). Each building alone in its cell with space around it. ")
PEKAKA = ("PUAN PEKAKA, the precise kindly old keeper of the Punggol Point tide gauge, a STORK-BILLED KINGFISHER: a HUGE heavy bright "
 "RED dagger bill, a soft ochre-brown head, a warm buff-orange chest, turquoise-blue wings and back, small bright dark eyes, "
 "wearing a navy-blue knitted cardigan over a white blouse and a pair of round reading glasses on a chain round her neck")
BUBUT = ("CIK BUBUT, the brisk cheerful ranger of Coney Island, a GREATER COUCAL: a glossy BLACK head and body, rich CHESTNUT-brown "
 "wings, fierce bright RED eyes, a stout black hooked bill and a long black tail, wearing a short-sleeved sand-khaki park ranger's "
 "shirt with shoulder tabs and pocket flaps, a little walkie-talkie clipped to the pocket, no hat")
TEMPUA = ("DR TEMPUA, a small eager wetland scientist, a BAYA WEAVER bird: a bright golden-YELLOW crown, a dark brown face mask, a stout "
 "conical pale bill, a streaky brown-and-buff back and a pale buff chest, wearing a sky-blue field shirt with the sleeves rolled up "
 "and a pencil behind one ear, holding a small brown field notebook")
BERANG = ("ENCIK BERANG, a jolly easy-going kayak-hire man, a SMOOTH-COATED OTTER: sleek glossy brown fur, a pale cream throat and "
 "chin, a flat round head with little round ears, a broad whiskery muzzle and a thick tapering tail, wearing a red baseball cap, a "
 "bright ORANGE life vest over a white tee and blue board shorts")
PUCONG = ("ABANG PUCONG, the swaggering vain boss of the Pucong Boys, a big GREY HERON: a long S-curved neck, a long dagger-sharp "
 "yellow-orange bill, a white face and neck with a bold BLACK stripe over the eye running back into a trailing black head PLUME, "
 "pale grey wings, yellow eyes with a smug look, wearing a loud orange-and-navy patterned short-sleeved shirt hanging open at the "
 "collar and a heavy GOLD CHAIN round his neck; pompous and comic, never scary")
# the heroes' Punggol outfits (written in full: DORA/ENZO in jobs.py describe the usual Jade Street clothes)
DORA_PG = ("Dora: cream-white fur, red eyes, wearing a light CORAL-ORANGE zip-up WINDBREAKER jacket, rolled-up blue DENIM SHORTS and "
 "white CANVAS SNEAKERS. No hat, no helmet: both big round ears always fully visible. ")
ENZO_PG = ("Enzo: soft grey fur, dark brown eyes, wearing a MUSTARD-YELLOW many-pocketed UTILITY VEST over a NAVY-BLUE T-shirt, KHAKI "
 "knee-length shorts and brown leather SANDALS. No hat, no helmet: both big round ears always fully visible. ")
NEWCLOTHES = (" The attached sprite sheets give ONLY this character's face, fur colour, body proportions, ink style and scale: IGNORE the "
 "clothes, hats and boots in them completely. In every frame the character wears ONLY the outfit described here, no hat, no "
 "boots, no bag, no green and no pink-purple clothing. ")
J = {}

# ── the ground: four seamless textures (the fourth is a spare)
J['ground25'] = (L, SREF + ['ground21.png', 'ground19.png'], STYLE + SG + PGL + "Four separate SQUARE seamless ground TEXTURES for a "
  "top-down game, matching the attached ground textures exactly in scale and style, seen from directly above, flat, evenly lit at "
  "night, no objects, no lines, no borders: a 2 by 2 grid of four squares that each fill their cell completely, edge to edge, with thin "
  "black gaps between them. Every texture must be CALM and LOW CONTRAST so characters drawn on top stay easy to read: no big motifs, "
  "no strong outlines. Top row: (1) a REED MARSH seen from above: still dark blue-black pond water with soft moonlit glints, thin "
  "olive and straw-coloured REED STEMS and a few narrow reed leaves standing up through it in loose even clumps all over; (2) "
  "CASUARINA NEEDLE LITTER: a soft even carpet of fallen thin brown and rust-coloured casuarina needles over sandy soil, a few tiny "
  "cones. Bottom row: (3) the PUNGGOL WATERFRONT DECK: straight even rows of warm honey-brown TIMBER DECK BOARDS running across, "
  "with a regular band of pale grey stone PAVERS every few boards, clean and even; (4) pale wild BEACH SAND with a few tiny shells.")

# ── buildings, all on MAGENTA (roof gardens, vines and teal accents are green). The packer stretches each to its footprint.
J['pg-bld'] = (L, SREF + ['islands-bld.png', 'mandai-bld.png', 'kallang-bld.png'], STYLE + SG + PGL + "A game sprite sheet of six "
  "separate PUNGGOL buildings for a top-down game. " + BLD + "A 3 by 2 grid. Row 1: (1) a tall modern PUNGGOL HDB FLAT BLOCK: a "
  "slab block of public flats painted CREAM-WHITE with TEAL and CORAL accent panels, rows of windows and balconies, and a flat roof "
  "with a little ROOF GARDEN of shrubs and a pergola, about one and a third times as wide as deep; (2) a second, different PUNGGOL "
  "WATERWAY HDB BLOCK: a stepped white block with curved balconies and pale BLUE and soft yellow accent stripes, a sky terrace "
  "and solar panels on the roof, about one and a third times as wide as deep; (3) the PUNGGOL MRT STATION ENTRANCE: a modern white "
  "canopy over stairs and escalators going down, with a long grey concrete LRT VIADUCT on round pillars passing right over the top "
  "of it, a small white LRT train on the viaduct, about one and a half times as wide as deep. Row 2: (4) a WATERFRONT SEAFOOD "
  "KOPITIAM: an open-sided seafood restaurant with a red tiled roof, round tables with red stools, glowing red paper LANTERNS "
  "under the eaves and big glass fish tanks at the front, about one and a third times as wide as deep; (5) a small HDB VOID DECK "
  "flat front: the open ground floor of a cream flat block with pale pillars, a stone table with stools, letterboxes and a front "
  "door with a lamp, about one and a half times as wide as deep; (6) a little KAYAK AND BICYCLE HIRE KIOSK: a square timber hut "
  "with a blue-and-white striped awning, a hatch counter, paddles and life vests hung on the wall, about as wide as deep. " + MAG)
J['pg-bld2'] = (L, SREF + ['islands-bld.png', 'mandai-bld.png', 'ubin-bld2.png'], STYLE + SG + PGL + "A game sprite sheet of four "
  "separate buildings for a top-down game. " + BLD + "A 2 by 2 grid. Row 1: (1) the OLD PUNGGOL TIDE-GAUGE HOUSE: a small square "
  "colonial-era hut painted WHITE with a pitched dark red tiled roof, raised high on four dark timber STILTS with cross braces "
  "standing in a little patch of shallow water, a narrow plank walkway and ladder up to its door, about as wide as deep; (2) a "
  "RUINED PRE-WAR BEACH VILLA: an old two-storey colonial bungalow with NO ROOF left, crumbling pale yellow plaster walls showing "
  "the room outlines from above, arched window holes, a broken stair, dark green VINES and creepers spilling over the walls, "
  "about one and a half times as wide as deep. Row 2: (3) the LORONG HALUS WETLAND RESEARCH HUT: a small grey-blue timber field "
  "hut on short stilts with a sloping zinc roof, a little verandah with a bench, a rain gauge and a weather vane, about one and a "
  "half times as wide as deep; (4) a small timber jetty shelter with a pitched roof (spare). " + MAG)

# ── props: the wide and green ones on a sheet of six, the small ones on a sheet of eight, the footbridge and the junk
# on a sheet of two (so none is upscaled)
J['props25a'] = (L, SREF + ['props1.png', 'props21.png', 'props19.png'], STYLE + SG + PGL + PROP + "A 3 by 2 grid of six separate "
  "items, each centred in its own cell, each ONE connected object standing on its own small patch of ground. Row 1: (1) the PUCONG "
  "BOYS' CAMP: a little lean-to of driftwood poles with a patched blue tarpaulin roof, wooden crates, a coil of rope and a glowing "
  "lantern, all on ONE small patch of sand, about one and a half times as wide as deep; (2) a tall feathery CASUARINA TREE: a slim "
  "dark trunk and a tall soft drooping crown of thin grey-green needle-like fronds, a few brown needles at its foot; (3) a clump of "
  "tall green-and-straw-coloured REEDS with feathery seed heads, growing from a little patch of dark water. Row 2: (4) a timber "
  "RACK of three beached KAYAKS side by side (red, yellow and blue) with paddles laid on top, on one patch of sand, about one and "
  "a half times as wide as deep; (5) a RACK of four HIRE BICYCLES parked side by side in a metal stand, colourful frames, about "
  "one and a half times as wide as deep; (6) a wooden five-bar CATTLE GATE between two posts. No text anywhere. " + MAG)
J['props25b'] = (L, SREF + ['props1.png', 'props21.png', 'props19.png'], STYLE + SG + PGL + PROP + "A 4 by 2 grid of eight separate "
  "items, each centred in its own cell, each ONE connected object. Row 1: (1) a plain timber PARK BENCH; (2) a tall slim TIDE "
  "STAFF post: a white board painted with plain alternating BLACK and WHITE bands (absolutely NO numbers, no marks other than the "
  "bands), standing upright in a small ring of dark rippled sea water at its foot; (3) a short square grey STONE SURVEY POST with a "
  "small round brass plate set in its top (blank); (4) a long concrete CATTLE WATER TROUGH full of water. Row 2: (5) a single WET "
  "OLD BOOK PAGE, yellowed and crinkled with damp edges, its lines of writing only shown as faint blank grey smudges (no letters); "
  "(6) a small round BRASS BENCH-MARK PLATE, tarnished, a blank arrow-like notch shape on it, no letters; (7) a round covered "
  "TUB of CHILLI CRAB: a red crab claw poking out from under the lid, red chilli sauce; (8) an old CLOTH-BOUND LEDGER book, faded "
  "maroon cloth with worn corners, closed, blank cover. No text anywhere. " + MAG)
J['props25c'] = (L, SREF + ['props1.png', 'props21.png', 'traffic.png'], STYLE + SG + PGL + "A 2 by 1 grid of two separate large "
  "items, each centred in its own half of the image and filling most of it. (1) LEFT half: the LORONG HALUS RED BRIDGE seen from "
  "DIRECTLY ABOVE (strict bird's-eye top-down view, like a map): a straight timber footbridge running straight UP and DOWN the "
  "image, about TWICE as long as wide, warm brown deck planks running across it and a bright RED painted railing along both long "
  "sides, short grey timber posts, NO water and NO ground drawn around it; (2) RIGHT half: MADAM SUTERA'S CHINESE JUNK at anchor "
  "seen from a high 3/4 view from the side: a black-hulled traditional Chinese junk with a high carved stern, three tall DARK "
  "battened sails (charcoal and deep maroon), a glowing lantern at the stern, a little anchor chain down to a small ring of dark "
  "water at the bow, about one and a half times as wide as tall, no flags. No text anywhere. " + MAG)

# ── the Brahman cattle: five frames of ONE cow on their own sheet (one scale), then the smaller animals
COW = ("a real BRAHMAN COW (a natural animal, NOT dressed, NOT standing upright), pale silvery GREY-WHITE coat, a big rounded "
  "SHOULDER HUMP, LONG DROOPY floppy ears hanging down, a loose wrinkly DEWLAP under the neck, short stubby horns, dark gentle eyes, "
  "a long thin tail with a dark tassel, gentle and cute")
J['cows25'] = (L, ['folk1.png', 'beasts19.png', 'beasts24.png'], STYLE + SG + PGL + "A game sprite sheet of ONE animal in six frames: "
  + COW + ", the SAME cow at the SAME size in every frame, matching the attached animal sheets in ink outline and cel shading, seen "
  "from a high top-down game camera with a gentle 3/4 tilt, each frame alone in its cell. A 3 by 2 grid. Row 1: (1) WALKING to the "
  "RIGHT in side view, LEFT front leg and right back leg stepping forward, head level; (2) the same walk, the OTHER legs forward "
  "(right front and left back), so the two frames make a walk cycle; (3) STANDING side-on facing RIGHT, its head turned round to "
  "LOOK BACK straight at the viewer, ears swinging. Row 2: (4) standing side-on facing RIGHT with its head DOWN, GRAZING, muzzle "
  "at the ground; (5) STARTLED and BOLTING: spinning away mid-gallop to the LEFT, hind legs kicked up, tail flying, eyes wide; (6) "
  "lying down resting (spare). " + MAG)
J['beasts25'] = (L, ['folk1.png', 'beasts19.png', 'beasts24.png'], STYLE + SG + PGL + "A game sprite sheet of real ANIMALS, natural "
  "animals (NOT dressed, NOT standing upright), cute and gentle, matching the attached sheets in size, ink outline and cel shading, "
  "each seen from a high top-down game camera with a gentle 3/4 tilt, each alone in its cell. A 4 by 2 grid. Row 1: (1) a BRAHMAN "
  "CALF trotting to the RIGHT in side view: pale grey-white, a tiny hump, long droopy ears, LEFT front leg forward; (2) the same "
  "calf, the OTHER legs forward; (3) a SMOOTH-COATED OTTER swimming to the RIGHT seen from above, sleek brown back and head out of "
  "the water, its body in a small ring of rippled dark water touching it, front paws paddling; (4) the same otter, the tail "
  "flicked the other way, the ripples changed. Row 2: (5) an ORIENTAL PIED HORNBILL perched on a short branch stub facing RIGHT: "
  "black body and wings, white belly, a big pale yellow bill with a large casque on top; (6) the same hornbill on the same stub, "
  "TURNING its head to look back to the left; (7) a small dark brown OWL perched on a short branch stub, round watchful yellow "
  "eyes, facing the camera; (8) a little crab (spare). " + MAG)

# ── Abang Pucong's Pucong Boys (the case and swap steps' guards in Punggol)
J['pucong25'] = (L, ['skippers24.png', 'crabs21.png', 'owls19.png', 'play.png'], STYLE + SG + PGL + "A game sprite sheet of ONE kind of "
  "character in eleven poses: a cute cheeky anthropomorphic GREY HERON standing upright on two long thin yellowish legs (a long "
  "S-curved neck, a long pointed yellow-orange bill, a white face with a black stripe over the eye and a scruffy black head plume, "
  "pale grey wings used like arms), in a scruffy crew look: a ragged sleeveless faded DENIM vest and a red BANDANA knotted round "
  "the neck, the same heron in every frame, cheeky and never scary, matching the attached gang sheets exactly in size, style and "
  "layout. " + VIEW34 + "A 4 by 3 grid. Row 1: (1) walking TOWARD the camera, left leg forward; (2) the same, right leg forward; "
  "(3) walking AWAY from the camera (we see its back and plume), left leg; (4) the same, right leg. Row 2: (5) RUNNING fast to the "
  "RIGHT in profile, wings out, long stride; (6) running to the RIGHT, the other stride; (7) CALLING the others: neck stretched up, "
  "beak WIDE OPEN squawking, wings raised; (8) PEERING suspiciously: the long neck stretched far forward, eyes narrowed. Row 3: (9) "
  "MUNCHING: a little silver fish half down its beak, distracted and happy; (10) TAUNTING: wings on hips, smug, chest puffed out; "
  "(11) DIZZY and DAZED: wobbling, eyes swirly, a small ring of little yellow STARS circling right on top of its head, touching the "
  "plume; (12) a heron feather (spare). " + MAG)

# ── the chapter-sixteen cast: portraits (four moods each), Abang Pucong's on their own, then full bodies copied from them
J['faces25'] = (SQ, ['portraits.png', 'faces21.png', 'faces19.png'], STYLE + SG + PGL + "Four " + CAST6 + "A sheet of sixteen "
  "character portraits in a 4 by 4 grid. " + MOODS4 + "Row 1: " + PEKAKA + ". Row 2: " + BUBUT + ". Row 3: " + TEMPUA + ". Row 4: "
  + BERANG + ". " + MAG)
J['faces25b'] = (SQ, ['portraits.png', 'faces21.png', 'faces24b.png'], STYLE + SG + PGL + "One " + CAST6 + "A sheet of four character "
  "portraits of the SAME character in a 2 by 2 grid, each a separate head-and-shoulders bust facing the viewer in the same framing, "
  "size, clothes and colours, each portrait the same size as one portrait on the attached sheets, changing ONLY the facial "
  "expression: top left CALM, a smug relaxed look; top right HAPPY, a big gloating grin; bottom left WORRIED, eyes darting, beak "
  "wobbly; bottom right CROSS, brows down hard, scowling. No speech bubbles, no symbols, no text. The character: " + PUCONG + ". " + MAG)
J['cast25'] = (L, ['cast-ref25.png', 'folk1.png', 'sg-npc.png', 'play.png'], STYLE + SG + PGL + "A game sprite sheet of four "
  "characters for a top-down game, the characters in the attached portrait strip (left to right = rows 1 to 4). " + BODY + POSES +
  "Row 1: " + PEKAKA + ", full body, standing upright on two short red bird legs, a navy skirt. Row 2: " + BUBUT + ", full body, "
  "standing upright on two dark bird legs, khaki shorts, his long black tail behind. Row 3: " + TEMPUA + ", full body, standing "
  "upright on two thin pinkish bird legs, brown shorts. Row 4: " + BERANG + ", full body, standing upright on two short webbed "
  "feet, his thick tail behind. " + MAG)
J['cast25b'] = (L, ['pucong-ref25.png', 'cast24.png', 'pucong25.png', 'folk1.png'], STYLE + SG + PGL + "A game sprite sheet "
  "of ONE character for a top-down game, the character in the FIRST attached portrait, now shown full body. " + BODY + "He is "
  "drawn at the SAME size, ink outline and cel shading as one character on the second attached sheet (four other characters), and "
  "his body is a grey heron like the third attached sheet's little ones but bigger, older and grander. A 3 by 2 grid of six frames, "
  "the SAME character ALWAYS FACING THE CAMERA, standing on the spot, the same size, clothes and colours in every frame, left to right "
  "and top to bottom: (1) IDLE, standing relaxed and smug, wings at the sides; (2) IDLE breathing, the same pose with the chest puffed "
  "very slightly and the head tilted a touch, a tiny fidget; (3) WAVING hello with one wing raised high above the head, a big "
  "gloating look; (4) the same wave with the raised wing swung to the other side; (5) TALKING, beak open mid-word, one wing held out "
  "to the side, explaining grandly; (6) TALKING, beak open, both wings raised to the chest, expressive. The character: " + PUCONG +
  ", full body, standing upright on two long thin yellowish legs, the SAME loud orange-and-navy open shirt, the same heavy gold chain "
  "and the same black head plume as his portrait, dark trousers rolled at the ankle. " + MAG)

# ── the heroes' new actions (both heroes, the same six), in their Punggol outfits
def act25(who, desc):
    return (L, REF + [f'{who}-act24.png', f'{who}-act21.png', f'{who}-act.png'], STYLE + SG + CHIN + desc + NEWCLOTHES + f"A game "
      f"sprite sheet of {who.title()} only, matching the attached sprite sheets of the same character exactly in proportions, face, fur "
      "colour and scale (the same size as the figures on the first attached sprite sheet). A 3 by 2 grid of six separate poses of ONE "
      "character, each alone in its cell, all seen from a high top-down game camera with a gentle 3/4 tilt, both big round ears fully "
      "visible in every pose, NO cow, NO jetty, NO ground and NO water drawn. Top row: (1) HERDING: walking slowly and carefully to the "
      "RIGHT in 3/4 profile, both arms spread WIDE and LOW to the sides with open paws, coaxing an animal along, the LEFT leg stepping "
      "forward; (2) the same herding walk, now the RIGHT leg stepping forward and the left leg behind, so the two frames clearly show "
      "DIFFERENT legs forward; (3) CROUCHED perfectly STILL, knees bent low, both paws held out flat palms-forward in front, calm "
      "and soothing, eyes soft. Bottom row: (4) THROWN BACK in surprise: leaning far back off balance, both arms flung UP, mouth open, "
      "ears flying back, as if a big animal just bolted past; (5) FISHING: facing RIGHT, CASTING a fishing rod held in both paws "
      "swung forward over the head, the thin line looping out from the rod tip a little way to the right (rod and line one connected "
      "shape); (6) FISHING: facing RIGHT, leaning back and holding the rod with both paws, the rod BENT in a deep curve, a SHORT taut "
      "line from its tip down to a small silver FISH wriggling right at the end of it, close to the rod tip, delighted face. " + MAG)
J['dora-act25'] = act25('dora', DORA_PG)
J['enzo-act25'] = act25('enzo', ENZO_PG)

# ── the interface: round icons and map landmarks
J['ui25'] = (L, SREF + ['icons.png', 'ui21.png', 'ui24.png'], STYLE + SG + "A game UI icon sheet painted like enamel shop signs and "
  "lacquered wood with gold trim, matching the attached icons in style, chunky and readable at small size. A 4 by 2 grid of eight "
  "separate items. Row 1: (1) a round icon of a friendly pale grey BRAHMAN COW's head with long droopy ears and a little hump behind, "
  "in a gold ring; (2) a round icon of a silver FISH leaping on a curved fishing line, in a gold ring; (3) a round icon of a black "
  "and white banded TIDE STAFF post standing in blue wavy water (NO numbers), in a gold ring; (4) a round icon of an old yellowed "
  "torn BOOK PAGE with blank grey smudge lines, in a gold ring. Row 2: (5) a small map landmark icon of CONEY ISLAND: a tall "
  "feathery CASUARINA tree on a little sandy beach with a small pale cow; (6) a small map landmark icon of a timber JETTY pier "
  "running out over blue water with a lamp post at its end; (7) a small map landmark icon of a little RED footbridge over a pond "
  "with tall REEDS; (8) a map PIN shaped like a teardrop with a little GREY HERON face (long yellow bill, black eye stripe) inside. "
  "No text, no letters, no numbers. " + MAG)

# ── the three Punggol properties, each its own stand at four levels (shuttered, then three upgrades)
J['emp25-props'] = (L, SREF + ['emp-props4.png', 'emp21-props.png', 'emp24-props.png'], STYLE + SG + PGL + EMP + GROWP + "Row 1: a "
  "PUNGGOL POINT CRAB HOUSE: a little seaside seafood stall with a red tiled roof, a glass tank of live crabs, steaming woks and "
  "plates of chilli crab, red lanterns. Row 2: a CONEY ISLAND DRINKS KIOSK: a rustic timber beach kiosk with a thatched roof, a "
  "cooler of coconuts with straws, bottles of drinks and a striped umbrella. Row 3: a WATERWAY KAYAK HIRE stand: a blue-and-white "
  "timber hut with a rack of colourful kayaks, paddles, life vests on hooks and a little floating pontoon. " + MAG)

# the market panel's scene: the Punggol Point seafood kopitiam at night (empty: no stall-keeper, no characters)
J['stall-punggol'] = (L, SP + ['stall-islands.png', 'stall-mandai.png', 'stall-kranji.png'], STYLE + SG + PGL + "A shop scene seen "
  "straight on from the customer's side of a counter, painted edge to edge, matching the attached market panels in framing and style "
  "but with NOBODY in it: no stall-keeper, no customers, no characters or animals at all. Inside the PUNGGOL POINT SEAFOOD KOPITIAM "
  "at night: the counter runs across the bottom third of the image holding a big plate of CHILLI CRAB, a steaming claypot, a basket "
  "of fried mantou buns, a jug of iced lime juice and a stack of plates; behind it glowing glass FISH TANKS of live crabs and lobsters, "
  "a blank menu board, red paper LANTERNS, a slow ceiling fan and warm light; to the sides round tables with red plastic stools; "
  "through the open side a glimpse of the moonlit sea, the promenade lamps and the dark hills of Pulau Ubin across the water. Keep "
  "the middle of the image clear and calm behind the counter. No text, signs are blank shapes.")

# ── the chapter card (chapter sixteen, "King Tide"; not an ending): painted last, with the heroes' Punggol sheets attached
J['chapter-16'] = (L, REF + ['dora-act25.png', 'enzo-act25.png', 'chapter-13.png'], STYLE + SG + PGL + CHIN + DORA_PG + ENZO_PG +
  "Both wear exactly the outfits described here and seen on the second and third attached sheets (Dora cream-white in the coral "
  "windbreaker, Enzo grey in the mustard vest), no hats. " + PANEL + "A chapter title painting for 'king tide': at NIGHT under a huge "
  "bright full MOON, Dora and Enzo stand side by side at the end of the timber PUNGGOL POINT JETTY, seen from behind and a little to "
  "the side so we see both their faces in three-quarter view and BOTH big round ears on each of them, looking out over a VERY LOW "
  "TIDE: the sea has drawn far back, wide shining wet sand and mud flats glisten in the moonlight with pools and stranded boats; a "
  "tall black-and-white banded TIDE STAFF post (no numbers) stands on the bared flats beside the jetty, its foot dry; across the "
  "water the low dark wooded hills of PULAU UBIN with a few warm lights; far off on the silver water a small black CHINESE JUNK with "
  "dark sails rides at anchor. Leave the top fifth of the image as calm moonlit sky. No text.")

# ── the two walk cycles repainted on their own (the six-frame sheets put the SAME legs forward in both walk frames, as
# pass 24's wade did; for the heroes a stride and a passing pose, since two strides came back identical twice): the packer takes the herd walk and the cow walk from these, brought to the first sheets' scale
def herd25(who, desc):
    return (L, REF + [f'{who}-act25.png', f'{who}-act24.png'], STYLE + SG + CHIN + desc + NEWCLOTHES + f"A game sprite sheet of "
      f"{who.title()} only, matching the FIRST attached sprite sheet of the same character exactly (same proportions, same outfit, same "
      "scale: the figures the same size as in its top row). A 2 by 1 grid of TWO frames of ONE slow walk, each alone in its half of the "
      "image, seen from a high top-down game camera with a gentle 3/4 tilt, both facing RIGHT in 3/4 profile, HERDING: walking slowly "
      "and carefully with both arms spread WIDE and LOW to the sides, open paws, both big round ears fully visible, NO animal, NO ground "
      "drawn: (1) the STRIDE: a long step, the front foot far forward with the heel down and the back foot far behind on its toes, "
      "legs wide apart; (2) the PASSING pose: the legs together right under the body, ONE foot planted flat under the hips and the "
      "OTHER foot LIFTED clearly up off the ground with the knee bent high as it swings through, the body a touch higher. The two "
      "frames must look clearly different at the feet (legs apart in frame 1, legs together with one foot raised in frame 2). " + MAG)
J['dora-herd25'] = herd25('dora', DORA_PG)
J['enzo-herd25'] = herd25('enzo', ENZO_PG)
J['cowwalk25'] = (L, ['cows25.png', 'beasts19.png', 'folk1.png'], STYLE + SG + PGL + "A game sprite sheet of TWO frames of ONE "
  "animal walking: " + COW + ", EXACTLY the same cow as the first attached sheet, at the same size, in the same ink outline and cel "
  "shading, seen from a high top-down game camera with a gentle 3/4 tilt. A 2 by 1 grid, each frame alone in its half of the image, "
  "both WALKING to the RIGHT in side view with the head level: (1) the NEAR-SIDE FRONT leg reaching far FORWARD and the near-side "
  "back leg pushed far BACK, the far-side legs under the body; (2) the OPPOSITE: the near-side front leg now swung BACK under the "
  "chest and the FAR-SIDE front leg reaching forward, the near-side back leg stepping forward under the belly, so the two frames "
  "clearly show DIFFERENT legs forward and make a walk cycle. " + MAG)
