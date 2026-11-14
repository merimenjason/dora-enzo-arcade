# Jade Street painting jobs. Every prompt shares STYLE so the art stays consistent with the approved mock-ups.
STYLE = ("ART STYLE (match the attached mock-up screenshots exactly): polished hand-painted 2D game art with bold clean dark ink outlines and "
 "flat cel-shaded colour blocks, like a premium handheld top-down city game. Setting: an original, fictional night-time Chinatown-style "
 "harbour quarter of a Southeast Asian port city. Palette: deep indigo and teal night shadows lit by warm lantern red, vermilion, jade green, "
 "gold and pink neon glows. Cheerful, cosy, cartoonish and adventurous, never scary, no weapons, no blood. An entirely original design that "
 "copies no existing game. Absolutely no text anywhere: no letters, words, numbers, Chinese characters, logos or symbols, not even blurry fake "
 "writing; signs are blank coloured shapes. ")
CHIN = ("The heroes are two anthropomorphic CHINCHILLAS, NOT mice and NOT rats: short rounded blunt muzzle, very big round pink-lined ears, "
 "plump round soft body, big fluffy bushy tail, small paws, chubby cheeks. Copy ONLY their faces, eye colours and fur colours from the attached "
 "reference pair and IGNORE every accessory in it (no goggles, caps, headphones, scarves, jackets, sweaters, bags). ")
DORA = ("Dora: cream-white fur, red eyes, wearing a jade-green satin bomber jacket with a gold embroidered crane on the back and black cropped "
 "trousers. No hat, carries nothing. ")
ENZO = ("Enzo: soft grey fur, dark brown eyes, wearing a vermilion-red zip-up tracksuit top with white piping and baggy dark cargo shorts. "
 "No hat, carries nothing. ")
MAG = ("All on a perfectly flat solid pure magenta (#FF00FF) background with no ground, no floor, no shadows, no borders and no grid lines. "
 "Do not use magenta or pink-purple anywhere on the subjects (pink ears are a soft pale pink, never magenta). Each item centred in its own cell "
 "with plenty of empty background around it, never touching neighbours or the cell edge, never cropped. ")
GRN = ("All on a perfectly flat solid pure chroma green (#00FF00) background with no ground, no floor, no shadows, no borders and no grid lines. "
 "Do not use bright green on the subjects. Each item centred in its own cell with plenty of empty background around it, never touching "
 "neighbours or the cell edge, never cropped. ")
VIEW34 = ("Every figure is seen from a HIGH top-down game camera with a gentle 3/4 tilt (we look down on the top of the head and shoulders and "
 "still see the face when facing the camera), full body, all frames at the SAME scale. ")
TOP = "Seen from DIRECTLY ABOVE (strict bird's-eye top-down view, like a map), every vehicle pointing straight UP the image (front at the top). "
L = 'landscape 1536x1024'
SQ = 'square 1024x1024'
REF = ['ref-pair.png', 'play.png']
SREF = ['play.png']

def hero(who, desc):
    return {
      f'{who}-walk': (L, REF, STYLE + CHIN + desc + f"A game sprite sheet of {who.title()} only. " + VIEW34 +
        "A 4 by 3 grid of twelve frames forming smooth looping walk cycles. Top row: four frames walking TOWARD the camera (facing down the screen), "
        "legs alternating: left foot forward, passing, right foot forward, passing. Middle row: four frames walking AWAY from the camera "
        "(seen from behind, back of the jacket and the big fluffy tail visible), legs alternating the same way. Bottom row: four frames walking to the "
        "RIGHT in profile, legs alternating, tail bobbing. " + MAG),
      f'{who}-run': (L, REF, STYLE + CHIN + desc + f"A game sprite sheet of {who.title()} only. " + VIEW34 +
        "A 4 by 3 grid of twelve frames forming fast looping RUN cycles, body leaning forward, ears swept back, big strides, paws pumping. Top row: four "
        "frames running TOWARD the camera. Middle row: four frames running AWAY from the camera (seen from behind, tail flying). Bottom row: four frames "
        "running to the RIGHT in profile, one frame with both feet off the ground. " + MAG),
      f'{who}-act': (L, REF, STYLE + CHIN + desc + f"A game sprite sheet of {who.title()} only. " + VIEW34 +
        "A 4 by 3 grid of twelve separate poses. Top row: (1) standing idle facing the camera, relaxed smile; (2) standing idle seen from behind; "
        "(3) standing idle facing RIGHT in profile; (4) bumped: knocked off balance, arms flung out, eyes squeezed shut, ears flopping. "
        "Middle row: (5) DASH toward the camera: a low fast lunge, body stretched, ears flat; (6) DASH away from the camera seen from behind, low lunge; "
        "(7) DASH to the RIGHT in profile, stretched low lunge, tail streaming; (8) HOP: a springy little jump mid-air facing the camera, knees tucked, "
        "ears up. Bottom row: (9) HOP mid-air seen from behind; (10) HOP mid-air facing RIGHT; (11) PICKING UP: bending down, both paws scooping up "
        "something from the ground in front; (12) HIDING: crouched very small, curled into a ball, paws over the eyes, peeking through fingers. " + MAG),
      f'{who}-act2': (L, REF, STYLE + CHIN + desc + f"A game sprite sheet of {who.title()} only. " + VIEW34 +
        "A 4 by 3 grid of twelve separate poses. Top row: (1) CELEBRATING: jumping with both fists up, huge grin, eyes closed happily; "
        "(2) CELEBRATING: landing with a twirl, one paw pointing up, tail fluffed; (3) CAUGHT: startled, both paws raised, ears straight up, "
        "sweat drop; (4) CAUGHT: sitting on the ground sheepish and dizzy, little swirl above the head. Middle row: (5) CLIMBING ON: leaping up and "
        "sideways to the RIGHT, one leg lifted high as if swinging onto a seat; (6) CLIMBING OFF: landing from a little jump facing the camera, knees "
        "bent, arms out for balance; (7) WAVING hello to someone, facing the camera, friendly; (8) TALKING: one paw raised explaining, mouth open, "
        "facing the camera. Bottom row: (9) SWAPPING JACKET: pulling the jacket off over one shoulder, mid-change, playful; (10) CARRYING a plain "
        "wooden crate held up in both arms, walking toward the camera; (11) CARRYING the crate walking to the RIGHT; (12) SNEAKING on tiptoe to the "
        "RIGHT, hunched, one finger to the lips. " + MAG),
      f'{who}-ride': (L, REF, STYLE + CHIN + desc + f"A game sprite sheet of {who.title()} only, for a top-down game. " +
        "Every figure is seen from DIRECTLY ABOVE (strict bird's-eye view, we see the top of the head, both big round ears from above, the "
        "shoulders and back of the jacket and the fluffy tail), sitting or standing as if on a vehicle that points UP the image, but draw ONLY the "
        "character, no vehicle. A 4 by 2 grid of eight poses, all at the same scale. Top row: (1) seated riding a scooter, paws forward on invisible "
        "handlebars, leaning slightly left; (2) the same, leaning slightly right; (3) seated pedalling a tricycle, left knee up; (4) the same, right "
        "knee up. Bottom row: (5) standing pushing a long punting pole on the left side; (6) standing pushing the pole on the right side; "
        "(7) seated on a scooter cheering, one fist raised; (8) seated wobbling, bumped, ears flung sideways. " + MAG),
    }

JOBS = {}
JOBS.update(hero('dora', DORA))
JOBS.update(hero('enzo', ENZO))

JOBS.update({
 'vehicles': (L, SREF, STYLE + "A game sprite sheet of empty vehicles for a top-down city game. " + TOP + "Cute, chunky, toy-like proportions. "
   "A 4 by 2 grid of eight separate vehicles, nobody riding them. Top row: (1) a small bright red retro motor scooter with a round headlight and a "
   "little front basket; (2) a trishaw: a bicycle rickshaw with a padded passenger bench and a striped canopy folded back, bicycle at the back; "
   "(3) a yellow-and-blue three-wheeled tuk-tuk with an open-sided canopy roof; (4) a small boxy white delivery van with a jade stripe and a roof "
   "rack. Bottom row: (5) a long narrow wooden canal boat with a little arched cabin roof and lanterns at the stern; (6) a rickety three-wheeled "
   "delivery cargo cart piled with wooden crates; (7) a plain bicycle; (8) a small wooden rowing skiff. " + MAG),
 'riders': (L, SREF, STYLE + "The rivals are cheeky anthropomorphic MAGPIES in black-and-white plumage with glossy blue-green wing sheen wearing "
   "matching purple windbreakers; the comic market wardens are portly RACCOONS in navy uniforms with whistles. A game sprite sheet for a "
   "top-down city game. " + TOP + "A 4 by 2 grid of eight separate sprites, each a rider ON its vehicle, two animation frames per pair. "
   "Top row: (1) a magpie in a purple windbreaker pedalling a rickety three-wheeled cargo cart piled with crates and a sack, left foot down; (2) the "
   "same, right foot down; (3) a portly raccoon warden in navy uniform on a bicycle, left pedal down, whistle in beak; (4) the same, right pedal "
   "down. Bottom row: (5) a big glamorous magpie boss with a gold chain and a purple-and-gold jacket on a sleek neon-purple scooter; (6) the same, "
   "leaning; (7) a magpie in a purple windbreaker steering a small fast motorboat with a wake; (8) the same, wake splashing the other side. " + MAG),
 'traffic': (L, SREF, STYLE + "A game sprite sheet of cute toy-like traffic for a top-down city game. " + TOP +
   "A 4 by 2 grid of eight separate vehicles, nobody visible: (1) a small mint-green rounded hatchback car; (2) a small cream retro car; (3) a "
   "small sky-blue van; (4) a small orange taxi with a blank roof light; (5) a stubby red-and-cream city bus; (6) a little purple mini car; "
   "(7) a pastel-yellow fruit truck carrying oranges; (8) a teal motorbike. " + MAG),
 'magpies': (L, SREF, STYLE + "The rivals: cheeky anthropomorphic MAGPIES in black-and-white plumage with glossy blue-green wing sheen, wearing "
   "matching purple windbreakers, mischievous but cute, never scary. A game sprite sheet of one magpie. " + VIEW34 +
   "A 4 by 3 grid of twelve poses. Top row: (1) walking toward the camera, left foot forward; (2) walking toward the camera, right foot forward; "
   "(3) walking away seen from behind, left foot; (4) walking away, right foot. Middle row: (5) running to the RIGHT in profile holding a small "
   "cloth loot sack, legs apart; (6) running to the RIGHT, legs together; (7) looking around suspiciously over its LEFT shoulder; (8) looking "
   "around suspiciously over its RIGHT shoulder. Bottom row: (9) cheeky taunt, tongue out, wing at the eye; (10) dizzy, stars around the head, "
   "sitting; (11) flying seen from DIRECTLY ABOVE with wings spread wide, claws reaching down to snatch; (12) flying from above, wings up. " + MAG),
 'wardens': (L, SREF, STYLE + "The comic market wardens: portly anthropomorphic RACCOONS in navy uniforms with brass buttons, peaked caps and "
   "whistles, more bumbling than mean. A game sprite sheet. " + VIEW34 + "A 4 by 3 grid of twelve items. Top row: (1) raccoon warden walking toward "
   "the camera, left foot; (2) right foot; (3) walking to the RIGHT in profile, left foot; (4) right foot. Middle row: (5) blowing the whistle "
   "hard, cheeks puffed; (6) arms wide 'gotcha' pose, pleased; (7) panting, bent over, hands on knees, tired; (8) pointing ahead, stern. Bottom "
   "row: (9) a warden blimp seen from DIRECTLY ABOVE: a chubby navy-and-gold airship balloon with little fins; (10) a roadblock: a low barricade "
   "of stacked fruit crates full of oranges seen from a high top-down angle; (11) a barricade of stacked watermelon crates, high top-down; "
   "(12) a striped orange-and-white warden traffic cone. " + MAG),
 'folk1': (L, SREF, STYLE + "A game sprite sheet of cute anthropomorphic animal townsfolk pedestrians, casual night-market clothes. " + VIEW34 +
   "A 5 by 3 grid. Each ROW is one character with five frames: (1) walking toward the camera; (2) walking away seen from behind; (3) walking to "
   "the RIGHT, left foot forward; (4) walking to the RIGHT, right foot forward; (5) startled hop sideways in the air, arms up. Row 1: a rabbit in a "
   "floral shirt. Row 2: a beagle dog in an apron. Row 3: a squirrel girl in a yellow cardigan and green skirt. " + MAG),
 'folk2': (L, SREF, STYLE + "A game sprite sheet of cute anthropomorphic animal townsfolk pedestrians, casual night-market clothes. " + VIEW34 +
   "A 5 by 3 grid. Each ROW is one character with five frames: (1) walking toward the camera; (2) walking away seen from behind; (3) walking to "
   "the RIGHT, left foot forward; (4) walking to the RIGHT, right foot forward; (5) startled hop sideways in the air, arms up. Row 1: a ginger cat "
   "in a blue shirt. Row 2: a duck auntie with a shopping basket. Row 3: a little hedgehog boy in a striped tee. " + MAG),
 'portraits': (SQ, REF, STYLE + "A sheet of sixteen character PORTRAITS (head and shoulders, facing the viewer, expressive, friendly) in a 4 by 4 "
   "grid, each on its own. Row 1: (1) an old TORTOISE grocer with round spectacles and a green apron; (2) a PANGOLIN auntie with a floral blouse "
   "and a flower in her scales; (3) an OTTER chef in white chef jacket and tall chef hat; (4) a gentle grey HERON temple keeper in saffron robes. "
   "Row 2: (5) a KINGFISHER boat lady with a woven conical hat; (6) a big WATER BUFFALO dock foreman in a hi-vis vest; (7) a GECKO arcade DJ with "
   "big headphones and neon jacket; (8) a RED PANDA lion-dance troupe leader in a red sash. Row 3: (9) the MAGPIE BOSS: a glamorous magpie with a "
   "gold chain and purple-and-gold jacket, smug; (10) a young magpie crew member in a purple windbreaker, cheeky; (11) a RACCOON warden captain in "
   "navy uniform, peaked cap, big moustache; (12) a MYNAH bird news vendor with a cap. Row 4: (13) Dora, happy; (14) Enzo, happy; (15) Dora, "
   "determined; (16) Enzo, surprised. " + CHIN + DORA + ENZO + MAG),
 'ground': (L, SREF, STYLE + "Six separate SQUARE seamless ground TEXTURES for a top-down city game, seen from directly above, flat, evenly lit at "
   "night with soft lantern reflections, no objects, no lines, no kerbs, no borders: a 3 by 2 grid of six squares that each fill their cell "
   "completely, edge to edge, with thin black gaps between them. Top row: (1) wet dark indigo asphalt road with faint warm and pink light "
   "reflections; (2) pavement of small warm-grey square paving tiles; (3) a plaza of big worn red-brown stone flags. Bottom row: (4) lush park "
   "grass with tiny flowers; (5) dark teal canal water with gentle ripples and lantern reflections; (6) weathered wooden dock planks."),
 'ground2': (L, SREF, STYLE + "Six separate SQUARE seamless ground TEXTURES for a top-down city game, seen from directly above, flat, evenly lit at "
   "night, no objects, no lines, no borders: a 3 by 2 grid of six squares that each fill their cell completely, edge to edge, with thin black "
   "gaps between them. Top row: (1) grey temple stone paving with moss in the joints; (2) deep harbour sea water, dark blue with small waves; "
   "(3) concrete dock apron with faint painted wear. Bottom row: (4) shiny wet neon-lit pavement with purple and teal reflections; (5) packed "
   "earth path with pebbles; (6) mossy cobblestones."),
 'decals': (L, SREF, STYLE + "A sheet of road and street DECALS for a top-down city game, seen from DIRECTLY ABOVE, flat on the ground. A 4 by 3 "
   "grid of twelve items. Top row: (1) a zebra pedestrian crossing: a horizontal strip of white painted stripes, worn; (2) a single short white "
   "dashed lane line segment, horizontal; (3) a round iron manhole cover; (4) a square drain grate. Middle row: (5) a long horizontal granite "
   "kerb stone strip; (6) a puddle reflecting red and pink lights; (7) a puddle reflecting gold light; (8) scattered fallen pink petals. "
   "Bottom row: (9) a wide stone stairway seen from above, steps running across; (10) a stone arched footbridge seen from directly above, deck "
   "running left to right with balustrades on both long sides; (11) a wooden plank bridge from above, deck running left to right, rope rails; "
   "(12) a round painted lucky-circle mosaic on stone. " + MAG),
 'props1': (L, SREF, STYLE + "A game prop sheet for a top-down city game, every object seen from a HIGH top-down camera with a gentle 3/4 tilt. "
   "A 4 by 3 grid of twelve separate objects. Top row: (1) a night-market food stall with a red-and-white striped awning seen from above; (2) a "
   "noodle stall with a steaming wok and stools; (3) a fruit stall heaped with oranges and mangoes under a green striped awning; (4) a tea stall "
   "with a jade awning and stacked tins. Middle row: (5) a cast-iron street lamp with a warm glowing lantern head; (6) a cluster of potted plants "
   "and bougainvillea; (7) a stack of wooden crates and woven baskets; (8) a slatted wooden bench. Bottom row: (9) a round leafy tree canopy seen "
   "from above; (10) a frangipani tree canopy with white flowers seen from above; (11) a palm tree from above; (12) a stone lion statue on a "
   "plinth. " + MAG),
 'props2': (L, SREF, STYLE + "A game prop sheet for a top-down city game, objects seen from a HIGH top-down camera with a gentle 3/4 tilt. A 4 by "
   "4 grid of sixteen separate objects. Row 1: (1) a small golden beckoning LUCKY CAT figurine, one paw raised, shiny; (2) a FADED, peeling, "
   "washed-out painted wall panel mural of a carp and waves in a wooden frame; (3) the SAME mural panel freshly restored, vivid colours; (4) a "
   "doorway with a bead curtain, a good hiding spot. Row 2: five lucky HEIRLOOMS each glowing softly: (5) a carved jade dragon; (6) a small golden "
   "temple bell; (7) a pearl lantern; (8) a silver koi fish statuette. Row 3: (9) a red-and-gold ceremonial drum; (10) a small cloth loot sack "
   "tied with string; (11) a tall white wedding cake in a clear box; (12) a wobbly tower of stacked clay pots tied with rope. Row 4: (13) a "
   "red-and-gold lion-dance lion costume with two dancers underneath, prancing, head up; (14) the same lion dance, head down, tail swishing; "
   "(15) a little stack of gold coins; (16) a woven rattan hiding basket big enough to hide in. " + MAG),
 'props3': (L, SREF, STYLE + "A game prop sheet for a top-down city game, objects seen from a HIGH top-down camera with a gentle 3/4 tilt. A 4 by "
   "3 grid of twelve separate objects. Top row: (1) a string of red paper lanterns hanging on a wire, horizontal, seen from above; (2) a string of "
   "gold paper lanterns; (3) a tall harbour crane, yellow, seen from above; (4) a stack of three shipping containers in red, teal and blue. "
   "Middle row: (5) a bamboo scaffold; (6) a neon arcade claw machine; (7) a big red post box style newspaper kiosk; (8) a stone incense burner "
   "urn with smoke. Bottom row: (9) a small moored sampan boat seen from above; (10) a stone bollard with rope; (11) a vending machine glowing "
   "teal; (12) a small shrine with candles. " + MAG),
 'shops1': (L, SREF, STYLE + "Six separate BUILDING tiles for a top-down city game, each one shophouse seen from a HIGH top-down camera with a "
   "slight 3/4 tilt: the terracotta tiled ROOF fills the top two thirds of the square seen from above, and the bottom third shows the front "
   "facade at street level: a five-foot-way arcade with columns, painted shutters, a glowing shop window, blank coloured sign plaques, potted "
   "plants and a hanging red lantern. Each building is a SQUARE footprint that fills its own cell. A 3 by 2 grid of six different shophouses: "
   "(1) pink facade with green shutters; (2) mint facade with red shutters; (3) yellow facade with blue shutters; (4) cream facade with a noodle "
   "shop window; (5) peach facade with a tea shop window; (6) sky-blue facade with a herbal shop window. " + MAG),
 'roofs': (L, SREF, STYLE + "Six separate ROOFTOP tiles for a top-down city game, seen from almost DIRECTLY ABOVE: the backs of shophouse roofs, "
   "each a SQUARE that fills its cell: terracotta tiled roofs with ridges, little skylights, water tanks, air-conditioner boxes, laundry lines, "
   "potted rooftop gardens, satellite dishes, cats napping, no walls visible. A 3 by 2 grid of six different rooftops, two of them with "
   "jade-green glazed tiles and one with grey slate. " + MAG),
 'landmarks': (L, SREF, STYLE + "Six separate LANDMARK BUILDINGS for a top-down city game, each seen from a HIGH top-down camera with a slight 3/4 "
   "tilt: the roof seen from above fills the top two thirds and the bottom third shows the front facade at ground level with a big entrance. "
   "Each one fills its own SQUARE cell. A 3 by 2 grid: (1) a grand temple with sweeping curved jade-green tiled roof, red columns, gold ridge "
   "ornaments, wide entrance steps; (2) a three-tier pagoda with red roofs; (3) a harbour warehouse with a blue corrugated metal roof and a big "
   "rolling door; (4) a bright neon video-arcade building with glowing purple, pink and teal blank sign shapes; (5) a cosy SAFE HOUSE: a small "
   "teal shophouse with a jade lantern and a round moon door; (6) a GARAGE workshop with a roll-up door half open, tyres stacked, tools. " + GRN),
 'buildings2': (L, SREF, STYLE + "Six separate BUILDING tiles for a top-down city game, each seen from a HIGH top-down camera with a slight 3/4 "
   "tilt: roof seen from above fills the top two thirds, bottom third shows the front facade at ground level. Each one fills its own SQUARE "
   "cell. A 3 by 2 grid: (1) a canal-side house with teal shutters and a little balcony over water stairs; (2) a canal teahouse with a curved "
   "roof and round windows; (3) a temple-hill house with green glazed roof tiles and a courtyard gate; (4) a dockside office with a blue roof and "
   "stacked crates; (5) a neon noodle bar with a purple awning and glowing blank signs; (6) a neon karaoke house with teal and gold lights. " + GRN),
 'ui': (L, SREF, STYLE + "A game UI sheet painted like enamel shop signs and lacquered wood with gold trim. A 4 by 3 grid of twelve separate "
   "elements, blank, NO text. Top row: (1) a long rounded jade-green enamel plaque with gold trim and cloud-curl ends; (2) a long rounded "
   "vermilion-red lacquer plaque with gold trim; (3) a round red lacquer button with a gold ring; (4) a round jade lacquer button with a gold ring. "
   "Middle row: (5) a glowing red paper lantern, lit; (6) the same lantern unlit, dark plum and grey; (7) a shiny gold coin with a flower emboss; "
   "(8) a gold reputation star medallion. Bottom row: (9) a round gold-rimmed minimap frame ring with an empty dark centre; (10) a yellow glowing "
   "chevron arrow marker pointing up; (11) a gold map pin; (12) a small brass padlock. " + MAG),
 'icons': (SQ, SREF, STYLE + "A sheet of sixteen game ICONS, painted, chunky, readable at small size, NO text. A 4 by 4 grid. Row 1: six trade goods "
   "begin: (1) a pair of jade bangles; (2) a mooncake with a pattern; (3) a tea tin with tea leaves; (4) a blue-and-white porcelain bowl. Row 2: "
   "(5) a painted silk folding fan; (6) a ripe mango; (7) a little teal safe house with a moon door; (8) a garage spanner and gear. Row 3: (9) a "
   "red paper scooter key tag; (10) a hanging jacket; (11) a trophy cup; (12) a rolled paper map. Row 4: (13) a lock and pick; (14) a wok with "
   "flames; (15) a dumpling; (16) a pair of crossed wires. " + MAG),
 'mg-lock': (L, SREF, STYLE + "A close-up mini-game scene painting, no characters: the cut-away inside of an ornate brass Chinese padlock bolted to a "
   "red lacquered door, viewed straight on. The lock body is large in the centre and shows FOUR empty vertical pin channels in a row with a "
   "horizontal keyway along the bottom, gold and brass, warm lantern light. Leave the pin channels empty. No text."),
 'mg-parts': (L, SREF, STYLE + "A mini-game parts sheet, close-up objects, NO text. A 4 by 3 grid of twelve separate items. Top row: (1) a small "
   "brass lock pin with a spring above it, vertical; (2) the same pin glowing gold; (3) a thin hairpin lock pick, horizontal; (4) a brass tension "
   "wrench. Middle row: (5) a red wire connector plug end; (6) a blue wire connector; (7) a yellow wire connector; (8) a green wire connector. "
   "Bottom row: (9) a spark burst; (10) a scooter ignition key; (11) a small open padlock; (12) a closed padlock. " + MAG),
 'mg-wire': (L, SREF, STYLE + "A close-up mini-game scene painting, no characters: the open side panel of a little red scooter under a street lamp at "
   "night, seen straight on, showing a dark wiring panel with four empty connector sockets in a column on the left and four empty sockets in a "
   "column on the right, brass screws, a small headlight bulb at the top. No wires connected. No text."),
 'mg-wok': (L, SREF, STYLE + "A close-up mini-game scene painting, no characters: a night-market street-food stall kitchen counter seen straight "
   "on, a big gas burner with blue flame ring in the centre bottom, bowls of ingredients at the sides, steam, hanging ladles, lanterns behind. "
   "Leave the centre above the burner empty for a wok. No text."),
 'mg-food': (L, SREF, STYLE + "A mini-game parts sheet, close-up, NO text. A 4 by 3 grid of twelve separate items. Top row: (1) a big black wok "
   "seen from the side, handle to the right; (2) a tangle of noodles; (3) a pink prawn; (4) a green bok choy leaf. Middle row: (5) a red chilli "
   "pepper; (6) a fried egg; (7) a flat round dumpling wrapper; (8) a dumpling wrapper with a spoonful of filling in the middle. Bottom row: "
   "(9) a dumpling half folded; (10) a dumpling with three neat pleats, perfect; (11) a lumpy messy dumpling; (12) a bamboo steamer basket, open, "
   "seen from above. " + MAG),
 'mg-board': (L, SREF, STYLE + "A close-up mini-game scene painting, no characters: a floured wooden kitchen board on a counter seen from above at a "
   "slight angle, a bowl of filling to one side, a bamboo steamer, a small dish of soy sauce, warm lantern light, in a night-market kitchen. The "
   "centre of the board is empty. No text."),
 'mg-haggle': (L, SREF, STYLE + "A mini-game scene painting: a night-market trading counter seen straight on from the customer's side, heaped with "
   "goods (jade bangles, mooncakes, tea tins, porcelain bowls, silk fans, mangoes) under a striped awning and lanterns; behind the counter stands "
   "a friendly PANGOLIN merchant auntie with a floral blouse, holding a wooden abacus. The bottom third of the image is the empty wooden counter "
   "top. No text, signs are blank."),
 'title': (L, REF + ['city.png'], STYLE + CHIN + DORA + ENZO + "A wide key-art title painting for the game: Dora and Enzo riding together on a "
   "small bright red scooter (Enzo driving, Dora behind, waving) down a glowing night-market street of shophouses with red lanterns strung "
   "overhead, a cheeky magpie in a purple windbreaker flying off ahead with a golden heirloom, raccoon wardens on bikes far behind, steam and "
   "neon. The camera is a high 3/4 angle. Leave the TOP THIRD of the image as calm night sky and lanterns (space for a title added later). No text."),
})

def act3(who, desc):
    return (L, REF, STYLE + CHIN + desc + f"A game sprite sheet of {who.title()} only. " + VIEW34 +
        "A 4 by 3 grid of twelve separate poses. Top row: (1) PAINTING a wall with a big brush held up high, facing away from the camera toward "
        "a wall (seen from behind); (2) the same with the brush swept low; (3) PICKING A LOCK: kneeling, seen from behind, both paws at a keyhole "
        "at chest height, ears forward, concentrating; (4) the same, one paw twisting, tongue out in concentration. Middle row: (5) SHOULDER "
        "BARGE to the RIGHT in profile, leaning into a shove, determined; (6) SHOULDER BARGE toward the camera; (7) STEPPING INTO a doorway, seen "
        "from behind, one foot lifted; (8) SLEEPING curled up on a little mat, eyes closed, tail wrapped around. Bottom row: (9) STIRRING a wok "
        "with a ladle, side view facing RIGHT; (10) FOLDING a dumpling with both paws at chest height, facing the camera, tongue out; (11) "
        "READING a big unfolded paper map held in both paws, facing the camera; (12) thumbs up with a wink, facing the camera. " + MAG)
JOBS['dora-act3'] = act3('dora', DORA)
JOBS['enzo-act3'] = act3('enzo', ENZO)
JOBS['flatroofs'] = (L, SREF, STYLE + "Six separate FLAT ROOF TERRACE tiles for a top-down city game, seen from DIRECTLY ABOVE, each a SQUARE that "
   "fills its cell edge to edge: flat concrete and terracotta-tiled roof terraces with a low parapet wall around the edge, water tanks, potted "
   "plants, washing lines, a skylight, air-con units, a little rooftop garden, warm light spilling from a hatch. Walkable open floor in the middle. "
   "A 3 by 2 grid of six different terraces. " + MAG)
JOBS['heroes-face'] = (SQ, REF, STYLE + CHIN + DORA + ENZO + "A sheet of four PORTRAITS (head and shoulders, facing the viewer) in a 2 by 2 grid, "
   "big and detailed. They must read clearly as CHINCHILLAS: a wide round head, very short blunt rounded muzzle with a tiny nose, plump round "
   "cheeks, VERY big round ears as wide as the head with pale pink insides, dense soft fluffy fur, long whiskers. NOT a mouse: no pointed snout, "
   "no long nose. Row 1: (1) Dora happy, smiling, in her jade-green satin bomber jacket; (2) Enzo happy in his vermilion tracksuit top with "
   "white piping. Row 2: (3) Dora determined, a confident smirk; (4) Enzo surprised, mouth open. " + MAG)
JOBS['ladders'] = (L, SREF, STYLE + "A game prop sheet, objects seen from a HIGH top-down camera with a gentle 3/4 tilt. A 4 by 2 grid of eight "
   "separate objects. Top row: (1) a wooden ladder leaning up against a wall, short; (2) an iron fire-escape ladder; (3) a wooden plank laid "
   "flat as a little gangway seen from above; (4) a coil of rope. Bottom row: (5) a golden glowing race checkpoint ring standing up like a "
   "lantern arch; (6) a jade glowing waypoint flag; (7) a red paper lantern lying on the ground; (8) a small sack of rice. " + MAG)
