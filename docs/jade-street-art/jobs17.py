# Jade Street, the seventeenth pass's paintings: Pulau Ubin, the kampong island off Changi reached by bumboat, and
# chapter ten. The ground (laterite tracks, kampong yards, mangrove mud, forest floor, quarry water, granite), two
# building sheets (zinc-roofed kampong houses, the jetty shops and the bicycle rental, the temple and its wayang stage,
# the Chek Jawa viewing tower, House No. 1, the safe house, the Tuskers' den, a kelong), two prop sheets, the new gang
# (the Tusker Boys, wild boars) with a full animation set and their boss Tok Taring, three new givers' portraits in
# four moods (and Tok Taring's) then their full bodies, three new townsfolk, the heroes' new actions, map icons, the
# three Ubin properties' stands and the chapter card. The game uses real Singapore names in its TEXT, but the paintings
# keep the no-lettering rule: no text, letters, numbers, logos or flags anywhere.
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
UBIN = ("This part of the world is PULAU UBIN, a small rustic island off Singapore's north-east coast that still looks like a 1960s "
 "Malay and Chinese KAMPONG village: timber kampong houses on low stilts with rusty corrugated ZINC roofs, red laterite DIRT tracks "
 "through secondary forest, durian, rambutan and coconut trees, a little jetty with bumboats and bicycle rental shops, flooded "
 "granite QUARRY lakes with steep grey cliffs (Ketam Quarry), a small Chinese temple with a wayang opera stage, and at the east end "
 "CHEK JAWA, a wetland of mangroves and seagrass flats with a timber boardwalk and a tall viewing tower. Warm moonlit night, "
 "fireflies, kerosene lamps glowing amber. ")
PROP = ("Each object is seen from a HIGH top-down game camera with a gentle 3/4 tilt, matching the attached prop sheets exactly in "
 "scale, ink outline, cel shading and warm night lighting. ")
BLD = ("Each building is seen from a HIGH top-down camera with a gentle 3/4 tilt at the SAME angle as the attached building sheets, so we "
 "look DOWN onto its whole ROOF (the roof takes up the top two thirds of each building) and see only a short strip of the front "
 "facade at the bottom. NOT a flat front elevation. No ground plate, no yard and no pavement under or around a building: each "
 "building's outline is just its own roof, walls, stilts and steps. Each building alone in its cell with space around it. ")
BOAR = ("the TUSKER BOYS, a cheeky gang of anthropomorphic WILD BOARS (Malay babi hutan): stocky round bodies, dark bristly brown-grey "
 "fur with a spiky mane down the back, a long snout with a pale band across it, small curved white tusks, little dark eyes, a thin "
 "tufted tail, standing on their hind legs like the other cartoon animals; every one wears the SAME gang uniform: a faded ORANGE "
 "bandana tied over the head and a khaki utility VEST with bulging pockets, bare-trotted. They are mischievous and comic, never "
 "scary, no weapons. ")
TARING = ("TOK TARING, the boss of the Tusker Boys: a HUGE old WILD BOAR with a grizzled silver-grey mane, long curling ivory TUSKS, a "
 "notch in one ear, bushy white eyebrows, wearing a faded khaki rubber-tapper shirt open over a white singlet, a brown checked "
 "sarong, and an orange bandana knotted round his neck; proud, grumpy, secretly soft-hearted. ")
AYU = ("KAK AYU, a brisk cheerful RED JUNGLEFOWL hen who runs the bicycle rental by the jetty: glossy golden-brown and russet feathers, "
 "a small bright red comb and wattles, bright amber eyes, wearing a sky-blue work shirt with the sleeves rolled up, a grease-smudged "
 "canvas apron with a spanner in the pocket")
BELANGKAS = ("UNCLE BELANGKAS, a gentle old HORSESHOE CRAB nature guide at Chek Jawa: a smooth domed olive-brown shell like a helmet over "
 "his head and back, kind round eyes, a few barnacles, wearing a green volunteer polo shirt, a khaki bucket hat and a pair of "
 "binoculars on a strap round his neck")
LAN = ("AUNTIE LAN, a proud warm-hearted STRAW-HEADED BULBUL Chinese street-opera (wayang) singer: a golden straw-coloured crown, a "
 "black stripe through the eye and a black moustache stripe, olive-brown back, rosy painted cheeks, wearing a pink-and-gold opera "
 "costume with long flowing white water sleeves and a small jewelled hairpin")
J = {}

# ── the ground: six seamless textures
J['ground17'] = (L, SREF + ['ground6.png', 'ground5.png'], STYLE + SG + UBIN + "Six separate SQUARE seamless ground TEXTURES for a "
  "top-down game, matching the attached ground textures exactly in scale and style, seen from directly above, flat, evenly lit at "
  "night, no objects, no lines, no borders: a 3 by 2 grid of six squares that each fill their cell completely, edge to edge, with thin "
  "black gaps between them. Every texture must be CALM and LOW CONTRAST so characters drawn on top stay easy to read: no big motifs, "
  "no strong outlines. Top row: (1) a red-orange LATERITE DIRT track: packed reddish earth with tiny pale pebbles and faint tyre "
  "ruts, even all over; (2) a KAMPONG YARD: pale sandy packed earth with a few small fallen leaves and twigs, soft; (3) MANGROVE MUD: "
  "smooth glistening grey-brown wet mudflat with tiny crab holes and a faint sheen. Bottom row: (4) FOREST FLOOR: dark green moss and "
  "brown fallen leaf litter with small ferns, soft and even; (5) still deep JADE-GREEN QUARRY WATER seen from above, very calm, a few "
  "faint ripples and a soft moonlit sheen, no reflections of objects; (6) grey speckled GRANITE rock outcrop, smooth weathered stone "
  "with a few hairline cracks and lichen spots.")

# ── buildings (green screen; the packer stretches each to its footprint)
J['ubin-bld'] = (L, SREF + ['sg-bld.png', 'tiong-bld.png', 'changi-bld2.png'], STYLE + SG + UBIN + "A game sprite sheet of six separate "
  "PULAU UBIN buildings for a top-down game. " + BLD + "A 3 by 2 grid. Row 1: (1) a KAMPONG HOUSE on low timber stilts: plank walls "
  "painted pale sky blue, a rusty red-brown corrugated ZINC roof with a ridge, a small verandah with steps, potted plants and a "
  "glowing kerosene lamp, about one and a half times as wide as deep; (2) another bigger KAMPONG HOUSE: unpainted weathered timber "
  "walls, a zinc roof patched in silver and rust, an attap palm-thatch lean-to on one side, a hammock on the verandah, about twice as "
  "wide as deep; (3) the jetty village's row of three old timber SHOPS joined side by side: a provision shop, a little coffee shop "
  "with marble tables and a seafood shop with fish tanks, under one long zinc roof with an awning, three times as wide as deep. Row 2: "
  "(4) a BICYCLE RENTAL shop: an open-fronted timber shed with a zinc roof, dozens of brightly coloured rental bicycles hanging from "
  "the rafters and standing in rows in front, a pump and spare tyres, about twice as wide as deep; (5) a small CHINESE TEMPLE by a "
  "pond: red pillars, yellow walls, a curved green-glazed tiled roof with dragons on the ridge, red lanterns, a brass incense urn at "
  "the door, about one and a half times as wide as deep; (6) a WAYANG STAGE for Chinese street opera: a raised timber platform with a "
  "zinc roof on posts, red-and-gold curtains drawn back, a painted backdrop of peonies, lanterns along the eaves, about one and a "
  "half times as wide as deep. " + GRN)
J['ubin-bld2'] = (L, SREF + ['ubin-bld.png', 'south-bld.png', 'resort-bld.png'], STYLE + SG + UBIN + "A game sprite sheet of six "
  "separate PULAU UBIN buildings for a top-down game, matching the attached sheets. " + BLD + "A 3 by 2 grid. Row 1: (1) the CHEK "
  "JAWA VIEWING TOWER: a tall slim seven-storey tower of dark steel lattice and timber stair landings rising above mangrove "
  "treetops, a square timber lookout platform with railings on top, seen from above at a tilt so we look down onto the top platform, "
  "about square; (2) HOUSE NO. 1 at Chek Jawa: a 1930s English TUDOR-style seaside cottage with white walls, black timber beams, a "
  "steep red-tiled roof and a brick fireplace chimney, about one and a half times as wide as deep; (3) the UBIN JETTY shelter: a "
  "long covered timber jetty pavilion on piles with a zinc roof, benches and a lamp, twice as wide as deep. Row 2: (4) a cosy little "
  "SAFE HOUSE where two young chinchilla heroes hide out: a small kampong hut on stilts painted jade green with a rusty zinc roof, a "
  "hammock and a single paw-print shape on the door, about square; (5) the TUSKERS' DEN: a ruined old granite-quarry workers' shed "
  "of timber and rusted zinc with half its roof fallen in, heaps of dug-up earth and roots all around it, an orange bandana flag "
  "(plain, no symbol) on a stick, about twice as wide as deep; (6) a KELONG: a wooden fish-farm hut on tall stilts over the sea with "
  "a plank walkway, fishing nets hung to dry and a blue water tank, about twice as wide as deep. " + GRN)

# ── props
J['props17a'] = (SQ, SREF + ['props1.png', 'props14a.png', 'props14b.png'], STYLE + SG + UBIN + PROP + "A 4 by 4 grid of sixteen "
  "separate items, each centred in its own cell. Row 1 (trees): (1) a big leafy DURIAN tree hung with spiky green durian fruits, seen "
  "from above at a tilt; (2) a RAMBUTAN tree with clusters of bright red hairy fruit among the leaves; (3) a tall leaning COCONUT palm; "
  "(4) a clump of MANGROVE trees with arching stilt roots. Row 2: (5) a rental BICYCLE seen from DIRECTLY ABOVE pointing straight UP "
  "the image, a basket on the front; (6) a timber BICYCLE RACK holding three colourful bicycles side by side; (7) a blue plastic "
  "WATER DRUM with a zinc bucket and a dipper; (8) a bamboo CHICKEN COOP with a red junglefowl rooster standing on top. Row 3: (9) a "
  "small wooden SAMPAN rowing boat seen from DIRECTLY ABOVE pointing UP, two oars; (10) a bamboo FISH TRAP and a fishing net drying "
  "on a pole rack; (11) a big rounded grey GRANITE BOULDER with moss; (12) a wooden SIGNPOST with three blank arrow-shaped plaques. "
  "Row 4: (13) a HOLE freshly dug in red earth by a wild boar, seen from directly above, earth thrown out round it and roots poking up "
  "(a flat ground decal); (14) a trail of four cloven PIG HOOF PRINTS pressed into mud, seen from directly above, walking UP the image "
  "(a flat ground decal); (15) a pile of spiky green DURIAN fruits on a woven pandan mat; (16) an old rusty TIN CHEST with a brass "
  "clasp, half dug out of a mound of earth. No text anywhere. " + MAG)
J['props17b'] = (SQ, SREF + ['props1.png', 'props17a.png', 'isle-props.png'], STYLE + SG + UBIN + PROP + "A 4 by 4 grid of sixteen "
  "separate items, each centred in its own cell. Row 1 (Chek Jawa): (1) a HORSESHOE CRAB on wet sand seen from above; (2) a red "
  "KNOBBLY SEA STAR on sand; (3) a GREY HERON standing in shallow water; (4) a clump of SEAGRASS and little shells on a mudflat (flat "
  "decal). Row 2 (wildlife): (5) an ORIENTAL PIED HORNBILL perched on a short branch, big pale casque on its bill; (6) a sleeping "
  "striped wild BOAR PIGLET curled up, very cute; (7) a red JUNGLEFOWL hen with three fluffy chicks; (8) a WILD BANANA plant with "
  "big ragged leaves. Row 3 (kampong and wayang): (9) a red-and-gold Chinese opera HEADDRESS with pompoms and pheasant feathers on a "
  "wooden stand; (10) a row of four wooden folding CHAIRS; (11) a brass temple INCENSE URN with smoking joss sticks; (12) a KEROSENE "
  "LAMP glowing amber on a short timber post. Row 4 (the quarry): (13) a stack of cut grey GRANITE blocks; (14) an old rusted quarry "
  "WINCH with a coil of cable; (15) a woven HAMMOCK slung between two posts; (16) a tall clump of LALANG grass and reeds. No text "
  "anywhere. " + MAG)

# ── the new gang, a full animation set, and its boss
J['boars'] = (L, SREF + ['bats.png', 'otters.png', 'emp-faces.png'], STYLE + SG + UBIN + "The rivals: " + BOAR + "Matching the attached "
  "rival sheets exactly in size and style. " + VIEW34 + "A 4 by 3 grid of twelve poses of the SAME boar, each alone in its cell. Row 1: "
  "(1) WALKING TOWARD the camera, left trotter forward; (2) the same, right trotter forward; (3) WALKING AWAY from the camera (seen from "
  "behind, the tufted tail and the vest's back), left foot forward; (4) the same walking away, right foot forward. Row 2: (5) RUNNING to "
  "the RIGHT in profile, left foot forward, ears back; (6) the same run, right foot forward; (7) CHARGING to the RIGHT: head down low, "
  "tusks forward, all four trotters off the ground, a puff of red dust behind; (8) the same charge, legs gathered under, dust "
  "spraying. Row 3: (9) ROOTING: bent over facing the camera, snout pushed into the earth digging, clods of red earth flying up; (10) "
  "the same rooting, snout up holding a dug-up root, delighted; (11) TAUNTING: standing on hind legs facing the camera, thumbs hooked "
  "in the vest, chin up, smirking; (12) DIZZY: sitting on the ground, bandana askew, little stars circling the head. " + MAG)
J['boars2'] = (L, SREF + ['boars.png', 'bats2.png', 'bats3.png'], STYLE + SG + UBIN + "The rivals: " + BOAR + "Exactly the boar in the "
  "first attached sheet, the same size and style. " + VIEW34 + "A 4 by 3 grid of twelve poses of the SAME boar, each alone in its cell. "
  "Row 1: (1) NETTED: tangled in a rope net, sitting, cross; (2) MUNCHING: sitting happily eating a split-open durian, eyes closed in "
  "bliss; (3) SNIFFING the air: standing facing the camera, snout raised high, nostrils flared; (4) SQUEALING for help: head thrown "
  "back, mouth wide open, arms up. Row 2: (5) CAUGHT: sitting sheepishly with both trotters up in surrender; (6) GRABBING: lunging to "
  "the RIGHT with an empty sack held open; (7) RUNNING to the RIGHT hugging a small metal CASH BOX, coins flying out; (8) the same run, "
  "the other leg forward, more coins spilling. Row 3: (9) KICKING over a wooden crate, facing the camera, gleeful; (10) GLOATING, "
  "holding up a gold coin, nose in the air; (11) SNEAKING on tiptoe to the RIGHT in profile, hunched; (12) the same sneak, the other "
  "foot forward. " + MAG)
J['taring'] = (L, SREF + ['boars.png', 'hoot.png', 'bats3.png'], STYLE + SG + UBIN + "A game sprite sheet of ONE character: " + TARING +
  "matching the attached rival sheets in size and style (he is bigger than his boars). " + VIEW34 + "A 4 by 2 grid of eight poses, each "
  "alone in its cell. Top row: (1) STANDING facing the camera, arms folded, proud and grumpy; (2) RUNNING to the RIGHT in profile, "
  "sarong flapping, clutching an old rusty tin chest under one arm, left foot forward; (3) the same run, right foot forward; (4) "
  "CHARGING to the RIGHT, head down, tusks forward, a cloud of red dust behind. Bottom row: (5) DIZZY, sitting, stars circling his "
  "head; (6) CAUGHT, sitting sheepishly with both trotters up; (7) LAUGHING, head thrown back, one trotter on his belly; (8) ROOTING, "
  "bent over digging with his snout, earth flying. " + MAG)

# ── the chapter-ten cast: portraits (four moods each), then full bodies copied from them
J['faces17'] = (SQ, ['portraits.png', 'faces14.png', 'emp-faces.png'], STYLE + SG + UBIN + "Four " + CAST6 + "A sheet of sixteen "
  "character portraits in a 4 by 4 grid. " + MOODS4 + "Row 1: " + AYU + ". Row 2: " + BELANGKAS + ". Row 3: " + LAN + ". Row 4: "
  + TARING + MAG)
J['cast17'] = (L, ['cast-ref17.png', 'folk1.png', 'sg-npc.png', 'play.png'], STYLE + SG + UBIN + "A game sprite sheet of four "
  "characters for a top-down game, the characters in the attached portrait strip (left to right = rows 1 to 4). " + BODY + POSES +
  "Row 1: " + AYU + ", full body, in dark work trousers and rubber boots. Row 2: " + BELANGKAS + ", full body, the shell over his "
  "back, khaki shorts and sandals. Row 3: " + LAN + ", full body, the long water sleeves hanging down. Row 4: " + TARING + "full body, "
  "short legs, bare trotters. " + MAG)

# ── three new townsfolk for the island
J['folk9'] = (L, ['folk1.png', 'folk8.png', 'play.png'], STYLE + SG + UBIN + "A game sprite sheet of three NEW cute anthropomorphic "
  "animal townsfolk pedestrians, matching the attached townsfolk sheets exactly in size, style and layout. " + VIEW34 + "A 5 by 3 grid "
  "of fifteen frames; each ROW is one character, left to right: (1) walking TOWARD the camera; (2) walking AWAY from the camera (seen "
  "from behind); (3) walking to the RIGHT in profile, left foot forward; (4) walking to the RIGHT in profile, right foot forward; (5) "
  "a startled little JUMP with both arms up. Row 1: an old RED JUNGLEFOWL rooster villager in a white singlet and a checked sarong, "
  "carrying a rattan basket of eggs. Row 2: a weekend-cyclist ORIENTAL PIED HORNBILL in a bright cycling jersey and a cap, with a "
  "water bottle. Row 3: a kindly MALAYAN BOX TURTLE grandmother in a floral blouse with a wide woven sun hat and a basket of "
  "rambutans. " + MAG)

# ── the heroes' new actions (both heroes, the same twelve)
def act17(who, desc):
    return (L, REF + [f'{who}-act.png', f'{who}-act15.png', f'{who}-act14.png'], STYLE + SG + CHIN + desc + f"A game sprite sheet of "
      f"{who.title()} only, matching the attached sprite sheets of the same character exactly (same proportions, same outfit, same "
      "scale). A 4 by 3 grid of twelve separate poses of ONE character, each alone in its cell, all seen from a high top-down game "
      "camera with a gentle 3/4 tilt. Top row: (1) READING HOOF PRINTS: crouched low facing the camera, nose close to the ground, one "
      "paw touching the ground, eyes narrowed, studying; (2) the same crouch, now pointing ahead to the RIGHT with the other paw, ears "
      "up, eureka; (3) SHAKING A TREE: facing the camera, both paws gripping an invisible tree trunk at chest height, leaning back "
      "and shaking hard, ears flapping (draw the character only, NO tree); (4) the same shake, leaning the other way. Middle row: (5) "
      "CATCHING: facing the camera holding a woven rattan basket up above the head with both paws, looking up; (6) the same, the "
      "basket hugged to the chest with a spiky green durian in it, proud; (7) LOOKING THROUGH BINOCULARS: facing the camera holding a "
      "pair of binoculars to the eyes; (8) the same, binoculars lowered, pointing far off to the RIGHT, amazed. Bottom row: (9) WAVING "
      "DOWN A BOAT: standing facing the camera waving both arms high over the head; (10) the same, paws cupped round the mouth, "
      "calling out; (11) EATING DURIAN: sitting cross-legged facing the camera holding a split-open green durian, lifting a pale "
      "golden pod to the mouth; (12) the same, cheeks bulging, eyes closed in bliss, the durian in the lap. " + MAG)
J['dora-act17'] = act17('dora', DORA)
J['enzo-act17'] = act17('enzo', ENZO)

# ── the interface: map landmarks and round icons
J['ui17'] = (L, SREF + ['icons.png', 'ui14.png', 'ui12.png'], STYLE + SG + "A game UI icon sheet painted like enamel shop signs and "
  "lacquered wood with gold trim, matching the attached icons in style, chunky and readable at small size. A 4 by 2 grid of eight "
  "separate items. Row 1: (1) a small map landmark icon of a timber KAMPONG HOUSE on stilts with a rusty zinc roof; (2) a small map "
  "landmark icon of a tall lattice VIEWING TOWER above mangrove treetops; (3) a small map landmark icon of a WAYANG opera stage with "
  "red curtains; (4) a small map landmark icon of a jade-green QUARRY lake with grey cliffs. Row 2: (5) a map PIN shaped like a "
  "teardrop with a little wild boar face with tusks inside; (6) a round icon of a spiky green DURIAN, in a gold ring; (7) a round "
  "icon of a BICYCLE, in a gold ring; (8) a round icon of two cloven HOOF PRINTS, in a gold ring. No text, no letters, no numbers. "
  + MAG)

# ── the three Ubin properties, each its own stand at four levels (shuttered, then three upgrades)
J['emp17-props'] = (L, SREF + ['emp-props4.png', 'emp16-props1.png', 'ubin-bld.png'], STYLE + SG + UBIN + EMP + GROWP + "Row 1: a "
  "BICYCLE RENTAL stall by the jetty: a timber stand with a zinc roof and rows of colourful rental bicycles, a tyre pump and a tin "
  "of spare bells. Row 2: a KAMPONG DURIAN STALL: a low timber stall under a durian tree heaped with spiky durians on woven mats, a "
  "parang-free cleaver-shaped blank board, plastic stools and a bucket of water for washing hands. Row 3: a KELONG SEAFOOD shack on "
  "short stilts at the shore: a timber counter, a blue tank of live crabs, a charcoal grill and lanterns. " + MAG)

# ── the chapter card (chapter ten is not an ending: no new end panel)
J['chapter-10'] = (L, REF + ['portraits.png', 'faces17.png', 'chapter-9.png'], STYLE + SG + UBIN + CHIN + DORA + ENZO + PANEL + "A "
  "chapter title painting for 'kampong spirit': Dora and Enzo cycle side by side on two colourful rental bicycles down a red "
  "laterite dirt track on Pulau Ubin at night, laughing, the moon above; on one side a timber kampong house on stilts with a zinc "
  "roof and a glowing kerosene lamp, durian trees heavy with fruit, fireflies; on the other a jade-green quarry lake under grey "
  "granite cliffs; far off a lattice viewing tower above the mangroves. In the bushes by the track, three cheeky wild boars in orange "
  "bandanas peek out, and on a far rock a big old boar with long tusks watches. Out on the dark sea, very small, a single junk with "
  "black sails and no lights. Leave the top fifth of the image as calm night sky. No text.")

# the market panel's scene: the Ubin Town provision shop (every district's market has one)
from jobs2 import STALL, SP
J['stall-pulau'] = (L, SP + ['stall-changi.png', 'faces17.png'], STYLE + SG + UBIN + STALL + "The stall-keeper is Kak Ayu, a "
  "cheerful RED JUNGLEFOWL hen in a blue work shirt and a canvas apron with a spanner in its pocket (copy her from the attached "
  "portrait sheet, top row), behind the wooden counter of a 1960s kampong provision shop by a jetty. Behind her: shelves of tins "
  "and glass jars of sweets, sacks of rice, hanging bunches of bananas, a basket of rambutans, a bicycle pump and spare tyres on "
  "a hook, a zinc roof edge and a glimpse of bumboats on the sea. No text, signs are blank shapes.")
