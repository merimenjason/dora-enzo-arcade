# Jade Street, the fourteenth pass's paintings: three new districts on the south shore (Tiong Bahru's art-deco estate
# and market, Clarke Quay's painted godowns on the Singapore River, and Jurong with the Science Centre, the Chinese
# Garden's pagodas on Jurong Lake and Snow City), their stations, safe houses, props, the chapter-nine cast (portraits
# and full bodies), Towkay Hoot on the run, three new townsfolk, the heroes' new actions, map icons, the chapter card,
# the new ending, three stall scenes; and the art fixes: Katong Park and Changi Airport stations repainted in the game's
# top-down 3/4 view (the old ones were flat front views on a slab), calmer Katong and Kampong Glam ground, and the
# street-light switch box's own key. The game uses real Singapore names in its TEXT, but the paintings keep the
# no-lettering rule: no text, letters, numbers, logos or flags anywhere.
from jobs import STYLE, CHIN, DORA, ENZO, MAG, GRN, VIEW34, TOP, L, SQ, REF, SREF
from jobs6 import MOODS4, CAST6, BLD, PANEL
from jobs7 import POSES, BODY
from jobs2 import STALL, SP

SG = ("The setting is SINGAPORE at night, painted warmly and respectfully, celebrating its real neighbourhoods with care: no "
 "caricature, no stereotypes. Absolutely NO lettering anywhere: no text, letters, numbers, logos, brand marks or flags; every sign is "
 "a blank coloured shape. ")
NEW = ("This part of the city is inspired by three Singapore neighbourhoods: TIONG BAHRU (a 1930s ART DECO housing estate of white "
 "low-rise curved 'streamline moderne' flats with rounded balconies, spiral stairs and green-tiled roofs, a famous wet market and "
 "hawker centre, a songbird corner, little cafes and bookshops), CLARKE QUAY (rows of old riverside warehouses, godowns, painted in "
 "bright candy colours along the Singapore River, with giant translucent canopy umbrellas over the lanes, bumboats and riverside "
 "restaurants) and JURONG (the Science Centre with its dome theatre, a Chinese Garden with a seven-storey pagoda, twin pagodas, stone "
 "bridges and koi on a lake, an indoor snow hall, a modern mall and a mid-autumn lantern festival by the lake). ")
PROP = ("Each object is seen from a HIGH top-down game camera with a gentle 3/4 tilt, matching the attached prop sheets exactly in "
 "scale, ink outline, cel shading and warm night lighting. ")
HOOT = ("TOWKAY HOOT, a rich rival businessman: a stout BUFFY FISH OWL with tawny golden-brown streaked feathers, big yellow eyes, long "
 "sideways ear tufts, a sharp dark beak, wearing a cream silk changshan jacket with gold frog buttons and a jade ring, exactly the "
 "character in the attached portrait sheet (the buffy fish owl), ")
J = {}

# ── ground: calmer Katong and Kampong Glam (the old ones were too busy under the sprites), and the three new districts
J['ground6'] = (L, SREF + ['ground.png', 'ground3.png', 'ground5.png'], STYLE + SG + NEW + "Six separate SQUARE seamless ground "
  "TEXTURES for a top-down city game, matching the attached ground textures exactly in scale and style, seen from directly above, "
  "flat, evenly lit at night, no objects, no lines, no kerbs, no borders: a 3 by 2 grid of six squares that each fill their cell "
  "completely, edge to edge, with thin black gaps between them. Every texture must be CALM and LOW CONTRAST so that characters and "
  "buildings drawn on top stay easy to read: small even tiles, muted colours, no big motifs, no strong outlines. Top row: (1) a quiet "
  "KATONG pavement of SMALL plain square cement tiles in soft muted sage-teal and warm cream laid in a simple checker, each tile only "
  "faintly different from the next, with just a tiny pale four-petal dot at a few tile corners, very subtle; (2) a quiet KAMPONG GLAM "
  "pavement of small even warm sand-coloured brick pavers in a plain running bond, soft low-contrast joints, no feature tiles; (3) a "
  "TIONG BAHRU pavement of smooth pale grey-green TERRAZZO with tiny speckles of cream, grey and dusty pink chips, faint square "
  "dividing strips; Bottom row: (4) a CLARKE QUAY riverside promenade of small even dark warm-grey granite setts with a faint wet "
  "sheen; (5) a JURONG town pavement of plain pale warm-grey square concrete pavers with faint seams; (6) a CHINESE GARDEN path of "
  "small rounded pale grey river pebbles set in mortar with a little moss between them, even and soft.")

# ── the stations: Katong Park and Changi Airport repainted in the game's view, and the three new ones
J['stn14'] = (L, SREF + ['orchard-bld.png', 'bay-bld.png', 'hdb-bld.png'], STYLE + SG + NEW + "A game sprite sheet of six separate "
  "METRO STATION entrance buildings and one small dome for a top-down city game. " + BLD + "IMPORTANT: every building is a complete "
  "solid building seen from above at the SAME high 3/4 tilt as the attached building sheets, so we look DOWN onto its whole ROOF "
  "(the roof takes up the top two thirds of each building) and see only a short strip of the front facade at the bottom. NOT a flat "
  "front elevation. No floor slab, no pavement, no ground plate and no forecourt under or in front of any building: each building's "
  "outline is just its own roof and walls, with a soft irregular silhouette of roof overhangs, canopies and planting. A 3 by 2 grid. "
  "Row 1: (1) a seaside suburban METRO STATION entrance: a long curved white shell roof like a wave with skylights, a glass front "
  "with a lit entrance and bougainvillea planters hugging the walls, about twice as wide as deep; (2) an AIRPORT METRO STATION: a "
  "long sweeping jade-green metal roof with rows of skylights and a glass front, potted palms hugging the walls, about twice as wide "
  "as deep; (3) an ART DECO METRO STATION entrance: a low white streamline-moderne pavilion with rounded corners, a flat roof with a "
  "green-tiled rim, a curved glass-brick front and a round porthole window, about twice as wide as deep. Row 2: (4) a RIVERSIDE "
  "METRO STATION entrance: a pavilion with a translucent rainbow-tinted glass canopy roof on white steel branches and a glass front, "
  "about twice as wide as deep; (5) a big ELEVATED METRO STATION: a long barrel-vaulted silver roof over raised platforms on concrete "
  "pillars with stairs and an escalator down to the street, about twice as wide as deep; (6) a small white OBSERVATORY with a round "
  "silver dome, its slit open showing a telescope, about square. " + GRN)

# ── buildings (green screen; the packer stretches each to its footprint)
J['tiong-bld'] = (L, SREF + ['sg-bld.png', 'katong-bld.png', 'hdb-bld.png'], STYLE + SG + NEW + "A game sprite sheet of six separate "
  "TIONG BAHRU buildings for a top-down city game. " + BLD + "A 3 by 2 grid. Row 1: (1) the TIONG BAHRU MARKET and hawker centre: a "
  "big white two-storey art deco market with rounded corners, a flat roof with a planted roof garden, an open ground floor of market "
  "stalls with awnings and warm light, about one and a half times as wide as deep; (2) a long white 1930s ART DECO block of FLATS "
  "with rounded ends like the nose of an aeroplane, long curved balconies, a spiral staircase at one end and a green-tiled roof rim, "
  "three times as wide as deep; (3) another white ART DECO block of FLATS, horseshoe curved at the corner, with porthole windows, red "
  "brick trim, shops with awnings on the ground floor, twice as wide as deep. Row 2: (4) a cosy corner BAKERY CAFE in an art deco "
  "shop unit with a striped awning, big lit windows of bread and pastries and little tables outside, about one and a half times as "
  "wide as deep; (5) a small independent BOOKSHOP in an art deco shop unit, lit windows full of books, a cat on the step, potted "
  "plants, about square; (6) a small old Chinese TEMPLE with a sweeping red-tiled roof with dragons on the ridge, red lanterns and "
  "a brass incense urn at the door, about one and a half times as wide as deep. " + GRN)
J['quay-bld'] = (L, SREF + ['sg-bld.png', 'bay-bld2.png', 'glam-bld.png'], STYLE + SG + NEW + "A game sprite sheet of six separate "
  "CLARKE QUAY buildings for a top-down city game. " + BLD + "A 3 by 2 grid. Row 1: (1) a row of four old riverside GODOWN "
  "warehouses joined side by side, each painted a different bright candy colour (turquoise, pink, yellow, lilac) with white trim, "
  "arched shuttered windows and red-tiled pitched roofs, restaurants with glowing doors below, three times as wide as deep; (2) "
  "another row of three painted GODOWN warehouses in orange, mint and sky blue with pitched tiled roofs and bar terraces, twice as "
  "wide as deep; (3) a grand old six-storey colonial building with long rows of windows whose SHUTTERS are painted in every colour "
  "of the RAINBOW, a courtyard arch in the middle, about one and a half times as wide as deep. Row 2: (4) a modern riverside "
  "SHOPPING MALL of glass with a stepped terrace of restaurants facing the water, about one and a half times as wide as deep; (5) "
  "a riverside SEAFOOD RESTAURANT pavilion with a red-tiled roof, glowing fish tanks and round tables under lanterns, twice as wide "
  "as deep; (6) a two-storey shophouse BAR with a lantern-lit terrace, a little stage with a piano and string lights, about one and a "
  "half times as wide as deep. " + GRN)
J['jurong-bld'] = (L, SREF + ['bay-bld.png', 'resort-bld.png', 'changi-bld.png'], STYLE + SG + NEW + "A game sprite sheet of six "
  "separate JURONG buildings for a top-down city game. " + BLD + "A 3 by 2 grid. Row 1: (1) a SCIENCE CENTRE: a low angular white "
  "and orange museum building with a pyramid skylight and, joined to it, a big round silver DOME theatre, a kinetic sculpture at the "
  "door, about twice as wide as deep; (2) a tall slim SEVEN-STOREY Chinese PAGODA with green-tiled eaves on every storey, white "
  "walls and red columns, glowing windows, seen from above at a tilt, about square; (3) a pair of TWIN three-storey Chinese PAGODAS "
  "with green roofs joined by a low zigzag covered walkway on a stone terrace, twice as wide as deep. Row 2: (4) a big modern "
  "suburban SHOPPING MALL with a curved glass front, a rooftop garden and a lit atrium, twice as wide as deep; (5) an INDOOR SNOW "
  "HALL: a big windowless ice-blue box building with a white snow-capped roofline, icicle trim and a glowing blue entrance with a "
  "snowman by the door, about one and a half times as wide as deep; (6) an industrial WAREHOUSE with a saw-tooth roof, roller doors, "
  "stacked crates and two slim chimneys, twice as wide as deep. " + GRN)
J['south-bld'] = (L, SREF + ['changi-bld2.png', 'safe-bld.png', 'tiong-bld.png'], STYLE + SG + NEW + "A game sprite sheet of six "
  "separate buildings for a top-down city game, matching the attached sheets. " + BLD + "A 3 by 2 grid. Row 1: (1) a cosy SAFE HOUSE "
  "in TIONG BAHRU where two young chinchilla heroes hide out: a small white art deco flat unit with a rounded balcony, a spiral "
  "stair, potted plants and a single paw-print shape on the door, about square; (2) a cosy SAFE HOUSE at CLARKE QUAY: a narrow old "
  "riverside godown painted jade green with a red-tiled roof and a single paw-print shape on the door, about square; (3) a cosy SAFE "
  "HOUSE in JURONG: a little Chinese garden pavilion house with a green-tiled roof, round moon gate door with a single paw-print "
  "shape on it, bamboo beside it, about square. Row 2: (4) a grand CHINESE GARDEN GATE: a wide ceremonial archway building with a "
  "green-tiled roof, red columns, stone lions either side and an open passage through the middle, twice as wide as deep; (5) a "
  "lakeside Chinese TEA HOUSE pavilion on stone piers with upturned eaves and glowing paper lanterns, about one and a half times as "
  "wide as deep; (6) an old corner KOPITIAM coffee shop in an art deco shop unit with marble tables, a kopi counter and ceiling fans "
  "seen through open folding doors, about one and a half times as wide as deep. " + GRN)

# ── props
J['props14a'] = (SQ, SREF + ['props1.png', 'isle-props.png', 'props12a.png'], STYLE + SG + NEW + PROP + "A 4 by 4 grid of sixteen "
  "separate items, each centred in its own cell. Row 1 (Tiong Bahru): (1) a hawker's CHWEE KUEH cart: a steamer of little round "
  "white steamed rice cakes in tin cups topped with brown preserved radish, stacked plates; (2) a tall steel POLE FRAME hung with "
  "six ornate bamboo SONGBIRD CAGES high up, a songbird corner; (3) a little round CAFE TABLE with two bentwood chairs, two cups and "
  "a small parasol; (4) a street BOOK CART: a wooden barrow of second-hand books with a little lamp. Row 2: (5) an ART DECO street "
  "LAMP: a slim green post with a round frosted globe; (6) a friendly COMMUNITY CAT, a tabby with a clipped ear, sitting neatly; (7) "
  "a wall FOUNTAIN with a small bronze dancing-girl statue, art deco; (8) a big glazed POT of flowering frangipani. Row 3 (Clarke "
  "Quay): (9) a REVERSE BUNGY thrill ride: two very tall slanted steel towers with elastic ropes holding a small open round capsule "
  "seat between them near the ground, seen at a tilt; (10) the same ride's CAPSULE alone: an open round steel cage seat for two with "
  "padded harness bars, seen from above at a tilt; (11) a giant translucent CANOPY UMBRELLA seen from DIRECTLY ABOVE: a huge round "
  "frilled canopy like a jellyfish, softly glowing pink and blue; (12) a riverside SATAY grill: a long charcoal grill with skewers and "
  "a fan, smoke rising. Row 4: (13) a small busker's STAGE: a low platform with a microphone on a stand, a double bass, an amp and "
  "string lights; (14) a moored wooden BUMBOAT river taxi with a red-and-green hull, painted eyes on the bow, a canopy roof and red "
  "lanterns, seen from DIRECTLY ABOVE pointing UP; (15) a small bronze STATUE of a sitting short-haired cat on a stone plinth; (16) a "
  "wooden BARREL table with two tall stools and two glasses. No text anywhere. " + MAG)
J['props14b'] = (SQ, SREF + ['props1.png', 'resort-props.png', 'props12b.png'], STYLE + SG + NEW + PROP + "A 4 by 4 grid of sixteen "
  "separate items, each centred in its own cell. Row 1 (a Chinese garden): (1) a Chinese guardian STONE LION on a plinth; (2) a "
  "carved STONE LANTERN with a glowing candle; (3) a BONSAI pine in a blue ceramic tray on a stone stand; (4) a patch of pink "
  "LOTUS flowers and round lily pads seen from above. Row 2: (5) a red-lacquered ARCHED footbridge with railings, seen from above "
  "at a tilt, running left to right, much wider than tall; (6) three orange and white KOI fish swimming seen from directly above, "
  "with little ripples; (7) a TERRAPIN turtle basking on a round rock; (8) a graceful WEEPING WILLOW tree. Row 3 (a science centre): "
  "(9) a brass TELESCOPE on a wooden tripod pointing up at the sky; (10) a big KINETIC SCULPTURE of an ATOM: shiny rings round a "
  "glowing ball on a pole; (11) a small model ROCKET on a launch stand, white and red; (12) a cheerful SNOWMAN with a red scarf and "
  "a bucket hat, a little pile of snowballs beside it. Row 4 (a lantern festival): (13) a GIANT glowing paper LANTERN shaped like a "
  "white MOON RABBIT sitting up, taller than a person, lit from inside, on a little wheeled stand; (14) a GIANT glowing round paper "
  "LANTERN like a golden FULL MOON on a short stand; (15) a small pink paper LOTUS LANTERN with a candle, floating; (16) a wooden "
  "CRATE packed with folded coloured paper lanterns and candles. No text anywhere. " + MAG)

# ── Towkay Hoot on the run (the chapter's boss; his portrait and standing body were painted in the tenth pass)
J['hoot'] = (L, SREF + ['emp-faces.png', 'cast10.png', 'bats3.png'], STYLE + SG + "A game sprite sheet of ONE character: " + HOOT +
  "matching the attached rival sheets in size and style. " + VIEW34 + "A 4 by 2 grid of eight poses, each alone in its cell. Top "
  "row: (1) STANDING facing the camera, wings folded behind his back, smug; (2) RUNNING to the RIGHT in profile, jacket flapping, "
  "clutching a small glowing round golden moon lantern under one wing, left foot forward; (3) the same run, right foot forward; (4) "
  "DIZZY, sitting on the ground, feathers ruffled, little stars circling his head. Bottom row: (5) CAUGHT: sitting sheepishly with "
  "both wings up in surrender; (6) FLYING seen from DIRECTLY ABOVE, wings spread wide, pointing UP the image; (7) FLYING seen from "
  "directly above, wings swept down, pointing UP; (8) LAUGHING, standing with his head thrown back and one wing on his belly. " + MAG)

# ── the chapter-nine cast: portraits (four moods each), then full bodies copied from them
J['faces14'] = (SQ, ['portraits.png', 'east-faces.png', 'faces12a.png'], STYLE + SG + NEW + "Four " + CAST6 + "A sheet of sixteen "
  "character portraits in a 4 by 4 grid. " + MOODS4 + "Row 1: UNCLE SENG, a kindly old DUSKY LANGUR (a leaf monkey with dark grey "
  "fur and big white rings round his eyes and mouth) who sells steamed rice cakes, in a white singlet with a Good Morning towel "
  "(plain white, no lettering) round his neck and a flat cap. Row 2: KAK MELATI, a glamorous SINGAPURA CAT jazz singer with sepia "
  "ticked fur, big green eyes, a jasmine flower behind one ear and a midnight-blue sequinned dress with a silver shawl. Row 3: DR "
  "SURIA, a shy clever SLOW LORIS astronomer with huge round brown eyes with dark rings, round wire glasses, a white lab coat over a "
  "saffron sari blouse and a pencil behind her ear. Row 4: SIFU MUSANG, a gentle old PALM CIVET lantern maker with a grey masked "
  "face, long whiskers, a faded indigo tunic with paint spots and a paper lantern brush tucked in his headband. " + MAG)
J['cast13'] = ('landscape 1536x1024', ['cast-ref13.png', 'folk1.png', 'sg-npc.png', 'play.png'], STYLE + SG + NEW + "A game sprite "
  "sheet of four job-giver characters for a top-down city game, the characters in the attached portrait strip (left to right = rows 1 "
  "to 4). " + BODY + POSES + "Row 1: UNCLE SENG, a DUSKY LANGUR in a white singlet, a white towel round his neck, a flat cap and "
  "checked shorts. Row 2: KAK MELATI, a SINGAPURA CAT singer in a midnight-blue sequinned dress with a silver shawl and a jasmine "
  "flower behind her ear. Row 3: DR SURIA, a SLOW LORIS astronomer in round glasses and a white lab coat over a saffron blouse. Row "
  "4: SIFU MUSANG, a PALM CIVET lantern maker in a faded indigo tunic and a headband. " + MAG)

# ── three new townsfolk, one for each new district
J['folk8'] = (L, ['folk1.png', 'folk7.png', 'play.png'], STYLE + SG + NEW + "A game sprite sheet of three NEW cute anthropomorphic "
  "animal townsfolk pedestrians, matching the attached townsfolk sheets exactly in size, style and layout. " + VIEW34 + "A 5 by 3 grid "
  "of fifteen frames; each ROW is one character, left to right: (1) walking TOWARD the camera; (2) walking AWAY from the camera (seen "
  "from behind); (3) walking to the RIGHT in profile, left foot forward; (4) walking to the RIGHT in profile, right foot forward; (5) "
  "a startled little JUMP with both arms up. Row 1: a TABBY CAT neighbour in a linen shirt and round glasses carrying a canvas tote "
  "bag of books and a paper coffee cup. Row 2: a BANDED BULLFROG night-owl in a shiny teal bomber jacket and white sneakers, out "
  "for the evening. Row 3: a young PLANTAIN SQUIRREL schoolchild in a white school shirt and navy shorts with a big backpack and a "
  "toy rocket. " + MAG)

# ── the heroes' new actions (both heroes, the same twelve)
def act15(who, desc):
    return (L, REF + [f'{who}-act.png', f'{who}-act14.png', f'{who}-act12.png'], STYLE + SG + CHIN + desc + f"A game sprite sheet of "
      f"{who.title()} only, matching the attached sprite sheets of the same character exactly (same proportions, same outfit, same "
      "scale). A 4 by 3 grid of twelve separate poses of ONE character, each alone in its cell, all seen from a high top-down game "
      "camera with a gentle 3/4 tilt. Top row: (1) standing facing the camera EATING steamed rice cakes: holding a small paper "
      "parcel in one paw and lifting a little round white cake on a toothpick to the mouth; (2) the same, cheeks puffed, eyes closed "
      "in bliss, the toothpick held up; (3) LISTENING TO SONGBIRDS: facing the camera with the head tipped up and to one side, one "
      "paw cupped behind a big ear, smiling; (4) the same, WHISTLING upward with lips pursed, both paws clasped behind the back. "
      "Middle row: (5) STRAPPED INTO A THRILL RIDE SEAT: sitting facing the camera with a padded harness bar over the shoulders, "
      "gripping it tight, eyes wide, cheeks blown back (draw the character and the harness bar only, no seat); (6) the same, both "
      "arms flung up in the air, mouth wide open in a delighted scream, ears streaming upward; (7) FEEDING FISH: crouching facing "
      "the camera at the edge of a pond, scattering a pinch of fish food from one paw, a little paper bag in the other; (8) the same, "
      "leaning forward pointing down with delight. Bottom row: (9) STARGAZING: standing in profile facing RIGHT, bent to look "
      "through the eyepiece of a telescope with one eye shut (draw the character only, NO telescope); (10) the same, straightened up "
      "facing the camera, pointing up at the sky amazed; (11) CARRYING A LANTERN: walking to the RIGHT in profile holding a short "
      "stick with a small glowing white rabbit-shaped paper lantern hanging from it, left foot forward; (12) the same, right foot "
      "forward. " + MAG)
J['dora-act15'] = act15('dora', DORA)
J['enzo-act15'] = act15('enzo', ENZO)

# ── the interface: map landmarks, a pin, and the switch box's own key
J['ui14'] = (L, SREF + ['icons.png', 'ui12.png', 'ui10.png'], STYLE + SG + "A game UI icon sheet painted like enamel shop signs and "
  "lacquered wood with gold trim, matching the attached icons in style, chunky and readable at small size. A 4 by 2 grid of eight "
  "separate items. Row 1: (1) a small map landmark icon of a white art deco block of flats with rounded ends and a green roof rim; "
  "(2) a small map landmark icon of a row of three candy-coloured riverside warehouses with a strip of blue river in front; (3) a "
  "small map landmark icon of a seven-storey Chinese pagoda with green eaves; (4) a small map landmark icon of a silver dome with a "
  "little ringed planet above it. Row 2: (5) a map PIN shaped like a teardrop with a little golden owl face inside; (6) a round icon "
  "of a white RABBIT LANTERN glowing, in a gold ring; (7) a round icon of a SONGBIRD in a bamboo cage, in a gold ring; (8) a round "
  "icon of a KOI fish, orange and white, in a gold ring. No text, no letters, no numbers. " + MAG)
J['mg-swkey'] = (SQ, ['mg-parts.png', 'mg-switch.png'], STYLE + "A game sprite of ONE object in the centre of the image, painted in "
  "exactly the style, lighting and scale of the key in the attached mini-game parts sheet: a street-light SWITCH BOX KEY seen "
  "straight on, standing upright with its shaft pointing DOWN: a chunky grey-green enamelled steel T-HANDLE utility key, a wide "
  "flat bar handle across the top with a small brass tag ring, a short thick round shaft and a square brass socket tip at the "
  "bottom, with a tiny lightning-bolt-shaped notch cut in the handle (a shape, not a letter). It is clearly NOT a car or scooter "
  "key: no teeth, no plastic fob. About twice as tall as wide. No text, no letters, no numbers. " + MAG)

# ── the chapter card, the new ending, the stall scenes
J['chapter-9'] = (L, REF + ['portraits.png', 'faces14.png', 'chapter-8.png'], STYLE + SG + NEW + CHIN + DORA + ENZO + PANEL + "A "
  "chapter title painting for 'lights by the lake': Dora and Enzo walk side by side over a red arched bridge in a Chinese garden at "
  "night, each carrying a small glowing rabbit lantern on a stick, laughing; behind them a tall seven-storey pagoda with green eaves "
  "is reflected in a lake dotted with floating lotus lanterns; to one side a row of candy-coloured riverside warehouses under giant "
  "glowing canopy umbrellas, to the other white art deco flats with rounded balconies; a full golden moon above. High on the pagoda "
  "the small dark shape of an owl in a cream jacket watches. Leave the top fifth of the image as calm night sky. No text.")
J['end-7'] = (L, REF + ['portraits.png', 'faces14.png', 'emp-faces.png', 'end-6.png'], STYLE + SG + NEW + CHIN + DORA + ENZO + PANEL +
  "The new ending: the lakeside lawn of a Chinese garden at night under a huge full moon, a tall pagoda behind, hundreds of glowing "
  "lanterns in the trees and floating on the lake. In the middle Dora and Enzo together hold up a GIANT glowing round golden MOON "
  "LANTERN, laughing. Around them: an old dusky langur in a flat cap holding a plate of little steamed rice cakes, a Singapura cat "
  "singer in a midnight-blue dress singing into a microphone, a slow loris astronomer in a lab coat with a telescope, an old palm "
  "civet lantern maker holding a white rabbit lantern; at the side a stout buffy fish owl in a cream silk jacket sheepishly lights "
  "a small lantern of his own while two otters and a monitor lizard cheer. Happy, warm, together. No text.")
J['stall-tiong'] = (L, SP + ['stall-market.png', 'faces14.png'], STYLE + SG + NEW + STALL + "The stall-keeper is Uncle Seng, an old "
  "DUSKY LANGUR in a white singlet, a white towel round his neck and a flat cap (copy him from the attached portrait sheet, top "
  "row), behind his counter in an art deco wet market. Behind: steamers of little white rice cakes, hanging baskets, a tiled wall, "
  "songbird cages and ceiling fans under warm light. No text, signs are blank shapes.")
J['stall-quay'] = (L, SP + ['stall-bay.png', 'faces14.png'], STYLE + SG + NEW + STALL + "The stall-keeper is Kak Melati, a "
  "SINGAPURA CAT singer in a midnight-blue sequinned dress with a silver shawl and a jasmine flower behind her ear (copy her from "
  "the attached portrait sheet, second row), behind a riverside bar counter. Behind: candy-coloured warehouses across a river with "
  "bumboats and red lanterns, a giant glowing canopy umbrella overhead, a double bass and a microphone. No text, signs are blank "
  "shapes.")
J['stall-jurong'] = (L, SP + ['stall-resort.png', 'faces14.png'], STYLE + SG + NEW + STALL + "The stall-keeper is Sifu Musang, an "
  "old PALM CIVET lantern maker in a faded indigo tunic and a headband (copy him from the attached portrait sheet, bottom row), "
  "behind a wooden lantern workshop counter in a Chinese garden. Behind: dozens of glowing paper lanterns shaped like rabbits, "
  "fish and lotus flowers, a pagoda and a lake under a full moon. No text, signs are blank shapes.")
