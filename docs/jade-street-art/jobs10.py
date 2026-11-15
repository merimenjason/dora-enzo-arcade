# Jade Street, tenth batch of paintings (the ninth pass): Little India and Kampong Glam over the Rochor River, and
# Sentosa over the harbour. Their own ground, shophouses and landmarks (a temple with a tall gopuram, a golden-domed
# mosque, Haji Lane, Tekka-style market, the All-Hours Emporium; the resort hotel, the theme park, the fort, the cable
# car and ferry stations), festival props for Deepavali and the Hari Raya bazaar, the beach, the cable car and ferry,
# the Kecoh Mynahs (a new gang of cheeky Javan mynahs) and Crow Number Nine, the chapter-seven cast (portraits and full
# bodies), three new townsfolk, the heroes' new festival and beach poses, map icons, the chapter card, the new ending,
# the cable car ride view and three market stall scenes. Warm and respectful: real festivals shown with care, no
# caricature. No lettering anywhere, no real brands or logos.
from jobs import STYLE, CHIN, DORA, ENZO, MAG, GRN, VIEW34, TOP, L, SQ, REF, SREF
from jobs6 import ISLE, CROW, MOODS4, CAST6, BLD, PANEL
from jobs7 import POSES, BODY
from jobs2 import STALL, SP

EAST = ("This part of the city is inspired by Singapore's LITTLE INDIA and KAMPONG GLAM and the resort island of SENTOSA, painted "
 "warmly and respectfully, celebrating the real cultures with care: no caricature, no stereotypes, no religious text or symbols "
 "painted as lettering, no real brands, logos or flags. ")
PROP = ("Each object is seen from a HIGH top-down game camera with a gentle 3/4 tilt, matching the attached prop sheets exactly in "
 "scale, ink outline, cel shading and warm night lighting. ")
MYNA = ("the KECOH MYNAHS, a gang of cheeky JAVAN MYNAH birds: glossy jet-black feathers with a little spiky tuft on the forehead, a "
 "bright yellow beak and yellow legs, a white patch on each wing and a white-tipped tail, big mischievous eyes, each wearing a small "
 "MUSTARD-YELLOW neck scarf with red polka dots; noisy show-offs, cartoon cute, never scary. ")
NINE = ("CROW NUMBER NINE, a skinny nervous young " + CROW + ", in a too-big slate-grey business suit with a purple tie, a big round "
 "badge with no writing on his lapel, clutching a clipboard, ")
J = {}

# ── ground: the new districts' pavements, the beach, the resort promenade, the lagoon and the fort
J['ground4'] = (L, SREF + ['ground.png', 'ground3.png'], STYLE + ISLE + EAST + "Six separate SQUARE seamless ground TEXTURES for a "
  "top-down city game, matching the attached ground textures exactly in scale and style, seen from directly above, flat, evenly lit "
  "at night, no objects, no lines, no kerbs, no borders: a 3 by 2 grid of six squares that each fill their cell completely, edge to "
  "edge, with thin black gaps between them. Top row: (1) a LITTLE INDIA five-foot-way pavement of small worn terracotta and ochre "
  "tiles with a few scattered marigold petals; (2) a KAMPONG GLAM pavement of pale sandstone pavers in a soft herringbone with faint "
  "turquoise-and-cream patterned tiles here and there; (3) soft golden BEACH SAND with tiny ripples and a few little shells. Bottom "
  "row: (4) a RESORT promenade of smooth warm cream and coral paving with wavy pale stripes; (5) shallow clear turquoise LAGOON water "
  "over pale sand, with gentle light ripples; (6) old weathered grey-green FORT stone flags with moss in the joints.")

# ── buildings (green screen; the packer stretches each to its footprint)
J['india-bld'] = (L, SREF + ['sg-bld.png', 'buildings2.png', 'hdb-bld.png'], STYLE + ISLE + EAST + "A game sprite sheet of six "
  "separate LITTLE INDIA buildings for a top-down city game. " + BLD + "A 3 by 2 grid. Row 1: (1) a HINDU TEMPLE seen from above at a "
  "3/4 tilt: a walled courtyard with a tall ornate GOPURAM gate tower over the front entrance, the tower in tiers of many small "
  "colourful painted sculpted figures and pillars (pinks, blues, golds), a smaller domed shrine roof behind, oil lamps glowing at the "
  "door, about square; (2) a big round-the-clock DEPARTMENT STORE: a wide two-storey building crammed with goods, bright lights "
  "spilling from every open door, stacks of boxes and racks outside under a long awning, about twice as wide as deep; (3) a SARI SHOP "
  "shophouse: a two-storey colourful shophouse with tall shuttered windows, bolts of silk saris in jewel colours hanging in the open "
  "front, painted lime green and pink, about one and a half times as wide as deep. Row 2: (4) a small old VILLA with a red-tiled "
  "roof, white columns and a verandah, painted in bright stripes of colour, a little garden; (5) a row of two colourful SHOPHOUSES in "
  "turquoise, orange and violet with decorative plaster, louvred shutters and a covered five-foot way, twice as wide as deep; (6) "
  "another pair of SHOPHOUSES in yellow, red and sky blue with stained-glass fanlights and potted plants, twice as wide as deep. No "
  "text anywhere, signs are blank coloured shapes. " + GRN)
J['india-bld2'] = (L, SREF + ['india-bld.png', 'hdb-bld.png', 'sg-bld.png'], STYLE + ISLE + EAST + "A game sprite sheet of six "
  "separate LITTLE INDIA buildings for a top-down city game, matching the attached Little India sheet. " + BLD + "A 3 by 2 grid. Row "
  "1: (1) a big WET MARKET and HAWKER CENTRE hall: a wide pitched roof over an open hall with fish, vegetable and flower stalls at the "
  "sides and rows of tables, about one and a half times as wide as deep; (2) a SPICE SHOP shophouse: open front piled with sacks and "
  "baskets of red chilli, yellow turmeric, green cardamom and brown cinnamon, painted ochre and teal; (3) a FLOWER and GARLAND shop "
  "shophouse: strings of white jasmine and orange marigold garlands hanging in the open front, buckets of flowers, painted pink and "
  "white. Row 2: (4) a small corner PRATA shop: an open kitchen with a cook's griddle, round tables outside, warm yellow light, "
  "about square; (5) a little covered shopping ARCADE entrance with a row of tiny stalls of bangles and brass lamps, wider than deep; "
  "(6) a pair of SHOPHOUSES in mint green and coral with carved wooden shutters, twice as wide as deep. No text anywhere, signs are "
  "blank coloured shapes. " + GRN)
J['glam-bld'] = (L, SREF + ['sg-bld.png', 'buildings2.png', 'india-bld.png'], STYLE + ISLE + EAST + "A game sprite sheet of six "
  "separate KAMPONG GLAM buildings for a top-down city game. " + BLD + "A 3 by 2 grid. Row 1: (1) a grand MOSQUE seen from above at a "
  "3/4 tilt: a big shining GOLDEN ONION DOME on a cream building with a black band at its base, two slim minaret towers with small "
  "golden domes at the front corners, arched windows, a forecourt, about one and a quarter times as wide as deep; (2) a long narrow "
  "row of tiny HAJI LANE shophouses, each one painted with a different bright mural (abstract shapes, flowers, waves, no letters), "
  "little cafes and boutiques with fairy lights, about three times as wide as deep; (3) a TEXTILE shop shophouse: bolts of batik and "
  "songket cloth in gold, maroon and teal stacked in the open front, painted cream and green, twice as wide as deep. Row 2: (4) a "
  "small PERFUME shop: a tiny shophouse whose window glows with rows of jewel-coloured glass attar bottles on shelves, painted deep "
  "blue with gold trim, about square; (5) a MIDDLE-EASTERN restaurant shophouse with a lit terrace, brass lanterns, carpets and low "
  "cushions in front, twice as wide as deep; (6) a BUSSORAH STREET shophouse pair in pastel peach and turquoise with arched windows "
  "and green shutters, one and a half times as wide as deep. No text anywhere, signs are blank coloured shapes. " + GRN)
J['resort-bld'] = (L, SREF + ['bay-bld.png', 'bay-bld2.png', 'buildings2.png'], STYLE + ISLE + EAST + "A game sprite sheet of six "
  "separate RESORT ISLAND buildings for a top-down city game (all invented, no real attractions copied). " + BLD + "A 3 by 2 grid. Row "
  "1: (1) a long low BEACH RESORT HOTEL with white terraces, palm gardens, a curved infinity pool in front glowing turquoise, about "
  "two and a half times as wide as deep; (2) an old coastal FORT: grey-green stone walls and ramparts, an arched gate, a little "
  "lookout tower with a flagpole without a flag, a grassy top, about one and a quarter times as wide as deep; (3) a THEME PARK "
  "ROLLER COASTER: a twisting loop of coloured track on white supports with a little train of cars, about one and a half times as "
  "wide as deep. Row 2: (4) a THEME PARK ENTRANCE gate: a big fun arch made of a ringed planet and stars over turnstiles, flags "
  "without designs, about one and a third times as wide as deep; (5) an AQUARIUM: a round glass dome building with glowing blue "
  "water and fish shapes inside, coral sculptures by the doors, a bit wider than deep; (6) a CABLE CAR STATION: a modern station "
  "building with a big wheel housing on top where the cables leave, a cabin waiting inside, one and a half times as wide as deep. No "
  "text anywhere, signs are blank coloured shapes. " + GRN)
J['resort-bld2'] = (L, SREF + ['resort-bld.png', 'bay-bld2.png'], STYLE + ISLE + EAST + "A game sprite sheet of six separate RESORT "
  "ISLAND buildings for a top-down city game, matching the attached resort sheet. " + BLD + "A 3 by 2 grid. Row 1: (1) a small "
  "open-air MONORAIL-style beach STATION on stilts with a curved jade-and-white roof, twice as wide as deep; (2) a tall SKY TOWER "
  "ride: a slim white column with a ring-shaped viewing cabin near the top, about square; (3) a holiday VILLA with a thatched roof, a "
  "deck and a hammock, one and a half times as wide as deep. Row 2: (4) a FERRY TERMINAL: a small white building with a blue wave-"
  "shaped roof and a covered gangway, one and a half times as wide as deep; (5) a BEACH BAR: a bamboo shack with a palm-leaf roof, "
  "stools, fairy lights, wider than deep; (6) a KAMPONG GLAM SHOPHOUSE in lilac and cream with a carved wooden balcony and a "
  "lantern, one and a half times as wide as deep. No text anywhere, signs are blank coloured shapes. " + GRN)

# ── props: the festivals and the streets
J['east-props'] = (SQ, SREF + ['props1.png', 'isle-props.png', 'sg-props.png'], STYLE + ISLE + EAST + PROP + "A 4 by 4 grid of "
  "sixteen separate items, each centred in its own cell. Row 1: (1) a GARLAND STALL: a small wooden stall hung with strings of white "
  "jasmine and orange marigold garlands; (2) a cluster of round woven FLOWER BASKETS full of marigolds, roses and jasmine; (3) a group "
  "of open SPICE SACKS with rolled-down tops full of red chilli, yellow turmeric and green cardamom; (4) a KOLAM: a round symmetrical "
  "floor pattern of white rice flour with coloured petals and dots, lying flat on the ground, seen from directly above. Row 2: (5) a "
  "CARPET STALL with rolled and folded patterned rugs in reds and blues; (6) a TEXTILE STALL with bolts of batik and gold songket "
  "cloth on a table; (7) a group of round cafe TABLES with brass lanterns and floor cushions; (8) a festive LIGHT-UP ARCH spanning a "
  "road, seen from above: a wide ornate arch of strings of coloured lights shaped like peacock feathers and lotus flowers, much wider "
  "than tall. Row 3: (9) a small clay oil lamp DIYA, unlit; (10) the same DIYA lit with a warm flame; (11) a festive BAZAAR STALL "
  "with a striped awning, trays of colourful kuih cakes and hanging green woven ketupat; (12) the same stall closed, covered with a "
  "tarpaulin. Row 4: (13) a PELITA: a small traditional oil lamp on a bamboo pole with a flame; (14) a big shady RAIN TREE full of "
  "little bird nests, scarves and stolen shiny trinkets (a mynah gang's roost hideout); (15) a tall white steel CABLE CAR TOWER pylon "
  "seen from above with its cable wheels; (16) a round CABLE CAR CABIN: a little jade-and-white gondola with big windows hanging from "
  "its arm. No text anywhere. " + MAG)
J['resort-props'] = (SQ, SREF + ['props1.png', 'isle-props.png', 'east-props.png'], STYLE + ISLE + EAST + PROP + "A 4 by 4 grid of "
  "sixteen separate items, each centred in its own cell. Row 1: (1) an old black iron fort CANNON on a wooden carriage; (2) a "
  "CAROUSEL merry-go-round with painted animals under a striped canopy; (3) a big striped BEACH UMBRELLA, open; (4) a wooden DECK "
  "CHAIR with a striped canvas seat. Row 2: (5) a LIFEGUARD tower: a little wooden hut on stilts with a ladder; (6) a SANDCASTLE "
  "with towers, a moat and a shell on top; (7) a small white island FERRY boat seen from DIRECTLY ABOVE pointing UP, a blue roof over "
  "the passenger deck, benches at the back; (8) a straight section of steel CABLE CAR WIRE seen from directly above running LEFT-"
  "RIGHT, a pair of thin dark cables with a small clamp, much wider than tall. Row 3: (9) a small plate of colourful KUIH layer cakes "
  "and pastries; (10) a sturdy red FIREWORKS FIRING BOX with a big plunger and coiled wires; (11) a coiled GARLAND of white jasmine "
  "and orange marigold; (12) a small bunch of green woven palm-leaf KETUPAT. Row 4: (13) a small wooden crate of glass PERFUME "
  "bottles in jewel colours packed in straw; (14) a stripy BEACH BALL; (15) a bright SURFBOARD lying flat; (16) a row of five "
  "cheeky black JAVAN MYNAH birds with yellow beaks and little mustard polka-dot scarves perched along a short wire, gossiping. No "
  "text anywhere. " + MAG)

# ── the Kecoh Mynahs and Crow Number Nine
J['mynahs'] = (L, SREF + ['lizards.png', 'otters.png', 'magpies-crow.png'], STYLE + ISLE + "The rivals: " + MYNA + "A game sprite "
  "sheet of one mynah of the gang, matching the attached rival sheets exactly in size and style. " + VIEW34 + "A 4 by 3 grid of twelve "
  "poses, each alone in its cell. Top row: (1) HOPPING toward the camera, both feet together, a little kuih cake in its beak; (2) "
  "landing from the hop, wings half out; (3) hopping away seen from behind, white tail tips showing; (4) the same, landing. Middle "
  "row: (5) HOPPING fast to the RIGHT in profile, leaning forward cheekily; (6) the same, legs tucked mid-hop; (7) FLYING seen from "
  "DIRECTLY ABOVE, wings spread wide with white wing patches, pointing UP the image; (8) FLYING seen from directly above, wings swept "
  "down, pointing UP. Bottom row: (9) a cheeky TAUNT: standing, sticking its tongue out, one wing on its hip; (10) DIZZY, sitting, "
  "little stars circling, feathers ruffled; (11) TANGLED in a brown rope net, sheepish grin; (12) happily MUNCHING a white rice ball "
  "held in both wings. " + MAG)
J['mynahs2'] = (L, SREF + ['mynahs.png', 'magpies-crow.png', 'aware-guards.png'], STYLE + ISLE + "The rivals: " + MYNA + "and " +
  NINE + "matching the attached sheets exactly in size and style. " + VIEW34 + "A 4 by 3 grid of twelve poses, each alone in its "
  "cell. Top row, the MYNAH: (1) PREENING, twisting its head to tidy teal paint splotches on its wing, fussy; (2) delightedly "
  "chasing a soap BUBBLE above its head, hopping; (3) SINGING loudly, beak wide open, chest puffed, head thrown back, copying a "
  "sound; (4) PEERING with its head cocked sideways, one eye wide, suspicious. Middle row, the MYNAH: (5) CAUGHT, sitting with both "
  "wings up in surrender, embarrassed grin; (6) GRABBING greedily at something unseen with its beak and feet, feathers flying; (7) "
  "SNEAKING low on tiptoe to the RIGHT under a big leaf held over its head, left foot forward; (8) the same, right foot forward. "
  "Bottom row: (9) CROW NUMBER NINE standing, hugging his clipboard, nervous smile; (10) Crow Number Nine RUNNING to the RIGHT in "
  "profile, wings flailing, tie flying; (11) the same run, the other foot forward; (12) a MYNAH perched on a short wooden post, "
  "looking around, a lookout. " + MAG)

# ── the chapter-seven cast: portraits (four moods each), then full bodies copied from them
J['east-faces'] = (SQ, ['portraits.png', 'isle-faces.png', 'sg-faces1.png'], STYLE + ISLE + EAST + "Four " + CAST6 + "A sheet of "
  "sixteen character portraits in a 4 by 4 grid. " + MOODS4 + "Row 1: MR RAJU, a friendly middle-aged INDIAN GREY MONGOOSE spice "
  "merchant with grizzled grey-brown fur, a neat moustache, a cream kurta shirt, a checked cotton scarf over one shoulder and reading "
  "glasses on his nose. Row 2: AUNTIE MALAR, a kind SPOTTED DOVE garland seller with soft pink-brown feathers and a speckled collar, "
  "in a cotton sari of marigold orange with a magenta border, a small fresh jasmine string tucked by her head. Row 3: ABANG KANCIL, a "
  "slim gentle MOUSEDEER textile trader with big dark eyes, in a deep teal baju Melayu shirt with a gold-thread sampin cloth round "
  "his waist and a black songkok cap. Row 4: PUAN WANGI, an elegant BINTURONG (bearcat) perfumer with shaggy black fur, long white "
  "whiskers and kind amber eyes, in a soft lilac baju kurung with a matching tudung headscarf and a small gold brooch. " + MAG)
J['east-faces2'] = (SQ, ['portraits.png', 'isle-faces.png', 'east-faces.png'], STYLE + ISLE + EAST + "Four " + CAST6 + "A sheet of "
  "sixteen character portraits in a 4 by 4 grid. " + MOODS4 + "Row 1: KAPTEN DUYUNG, a big gentle old DUGONG ferry captain with a "
  "round whiskery snout, a navy captain's cap with a gold band and a navy peacoat over a striped shirt. Row 2: SERGEANT HELANG, a "
  "proud WHITE-BELLIED SEA EAGLE fort ranger with a white head and chest and grey wings, a khaki ranger shirt with pockets and a "
  "wide-brimmed khaki hat. Row 3: BOSS BISING, the boss of the mynah gang: a big plump JAVAN MYNAH with glossy black feathers, a tall "
  "spiky forehead tuft, a bright yellow beak, a big mustard-yellow polka-dot scarf and a gold whistle on a chain. Row 4: " + NINE +
  "anxious eyes. " + MAG)
J['cast8'] = ('landscape 1536x1024', ['cast-ref8.png', 'folk1.png', 'sg-npc.png', 'play.png'], STYLE + ISLE + EAST + "A game sprite "
  "sheet of four job-giver characters for a top-down city game, the characters in the attached portrait strip (left to right = rows 1 "
  "to 4). " + BODY + POSES + "Row 1: MR RAJU, an INDIAN GREY MONGOOSE spice merchant in a cream kurta with a checked scarf and reading "
  "glasses. Row 2: AUNTIE MALAR, a SPOTTED DOVE garland seller in a marigold-orange sari with a magenta border. Row 3: ABANG KANCIL, a "
  "MOUSEDEER textile trader in a teal baju Melayu with a gold sampin and a black songkok. Row 4: PUAN WANGI, a BINTURONG perfumer in "
  "a lilac baju kurung and tudung. " + MAG)
J['cast9'] = ('landscape 1536x1024', ['cast-ref9.png', 'folk1.png', 'sg-npc.png', 'play.png'], STYLE + ISLE + EAST + "A game sprite "
  "sheet of four job-giver characters for a top-down city game, the characters in the attached portrait strip (left to right = rows 1 "
  "to 4). " + BODY + POSES + "Row 1: KAPTEN DUYUNG, a big DUGONG ferry captain in a navy cap and peacoat, taller and rounder than the "
  "others. Row 2: SERGEANT HELANG, a WHITE-BELLIED SEA EAGLE fort ranger in khaki with a wide-brimmed hat. Row 3: BOSS BISING, a plump "
  "JAVAN MYNAH gang boss with a tall spiky tuft, a mustard polka-dot scarf and a gold whistle. Row 4: " + NINE + "without the "
  "clipboard. " + MAG)

# ── three new townsfolk, one for each new district
J['folk6'] = (L, ['folk1.png', 'folk5.png', 'play.png'], STYLE + ISLE + EAST + "A game sprite sheet of three NEW cute anthropomorphic "
  "animal townsfolk pedestrians, matching the attached townsfolk sheets exactly in size, style and layout. " + VIEW34 + "A 5 by 3 grid "
  "of fifteen frames; each ROW is one character, left to right: (1) walking TOWARD the camera; (2) walking AWAY from the camera (seen "
  "from behind); (3) walking to the RIGHT in profile, left foot forward; (4) walking to the RIGHT in profile, right foot forward; (5) "
  "a startled little JUMP with both arms up. Row 1: a SPOTTED DEER auntie in a peacock-blue sari with a gold border and a cloth "
  "shopping bag of flowers. Row 2: a SLOW LORIS uncle with huge round eyes in a maroon baju Melayu with a checked sampin and a black "
  "songkok cap. Row 3: a GREEN SEA TURTLE tourist in a bright flowery holiday shirt, shorts, a sun hat and a little camera on a strap. "
  + MAG)

# ── the heroes' festival and beach poses (both heroes, the same twelve)
def act12(who, desc):
    return (L, REF + [f'{who}-act.png', f'{who}-act11.png'], STYLE + ISLE + CHIN + desc + f"A game sprite sheet of {who.title()} only, "
      "matching the attached sprite sheets of the same character exactly (same proportions, same outfit, same scale). " + VIEW34 +
      "A 4 by 3 grid of twelve separate poses of ONE character, each alone in its cell. Top row: (1) KNEELING facing the camera, "
      "carefully holding a lit taper toward a little clay oil lamp on the ground, concentrating; (2) the same, sitting back on the heels, "
      "both paws together in front of the chest, smiling at the little flame; (3) standing facing the camera nibbling a colourful layer "
      "cake held in both paws, cheeks full, eyes closed happily; (4) the same, holding the cake out and grinning, a crumb on the nose. "
      "Middle row: (5) standing facing the camera with BOTH PAWS PRESSED OVER THE EARS, eyes squeezed shut, wincing at a racket; (6) the "
      "same, ears folded down, peeking with one eye, cross; (7) leaning forward in profile to the RIGHT SNIFFING something wonderful, "
      "eyes closed, nose up; (8) the same, rocking back with a big blissful smile, paw on chest. Bottom row: (9) LYING BACK relaxed "
      "facing the camera with the paws behind the head and legs crossed, eyes shut, smiling; (10) the same, one eye open, a lazy wave; "
      "(11) KNEELING facing the camera patting a mound of sand into a tower with both paws; (12) the same, holding up a little scallop "
      "shell to put on top, proud. " + MAG)
J['dora-act12'] = act12('dora', DORA)
J['enzo-act12'] = act12('enzo', ENZO)

# ── the interface: the cable car and ferry, and the new landmarks on the map
J['ui10'] = (L, SREF + ['icons.png', 'isle-ui.png'], STYLE + ISLE + "A game UI icon sheet painted like enamel shop signs and lacquered "
  "wood with gold trim, matching the attached icons in style, chunky and readable at small size. A 4 by 2 grid of eight separate "
  "items. Row 1: (1) a round CABLE CAR icon: a little jade-and-white gondola hanging from a cable in a gold ring; (2) a map PIN shaped "
  "like a teardrop with a little cable car gondola inside; (3) a map PIN shaped like a teardrop with a little ferry boat inside; (4) a "
  "small map landmark icon of a golden-domed mosque with two slim minarets. Row 2: (5) a small map landmark icon of a tall colourful "
  "temple gopuram gate tower; (6) a small map landmark icon of an old stone fort with a cannon; (7) a small map landmark icon of a "
  "looping roller coaster; (8) a round FESTIVAL icon: a little clay oil lamp and a green woven ketupat together. No text, no letters, "
  "no numbers. " + MAG)

# ── the chapter card, the new ending, the cable car ride view
J['chapter-7'] = (L, REF + ['portraits.png', 'east-faces.png', 'east-faces2.png', 'chapter-6.png'], STYLE + ISLE + EAST + CHIN + DORA +
  ENZO + PANEL + "A chapter title painting for 'island lights': Dora and Enzo walk hand in paw beneath a glowing festive LIGHT-UP ARCH "
  "of peacock and lotus shapes over a busy street of colourful shophouses at night, garland stalls and flower baskets either side, "
  "families strolling; beyond, across a little river, a golden-domed mosque glows over pastel shophouses hung with lanterns; far off "
  "over the harbour, a cable car gondola glides toward a resort island with a beach and a coaster. A flock of cheeky black mynah "
  "birds in mustard polka-dot scarves swoops overhead copying the music. Leave the top fifth of the image as calm night sky. No text.")
J['end-5'] = (L, REF + ['portraits.png', 'east-faces.png', 'east-faces2.png', 'end-4.png'], STYLE + ISLE + EAST + CHIN + DORA + ENZO +
  PANEL + "The new ending: a joyful night on a palm-fringed BEACH, fireworks bursting gold, pink and teal over the sea, an old stone "
  "fort on the headland. Dora and Enzo sit on the sand in the middle, laughing. Around them the friends of the new districts: a "
  "mongoose spice merchant in a kurta, a spotted dove auntie in a marigold sari, a mousedeer in a teal baju Melayu and songkok, a "
  "binturong in a lilac baju kurung and tudung, a dugong ferry captain, a sea eagle ranger, a flock of black mynahs in mustard scarves "
  "singing; at the side a skinny crow in a too-big grey suit and an older crow in a sharp suit share a little lantern stall. Clay lamps "
  "and pelita glow along the sand. Happy, warm, together. No text.")
J['cable-ride'] = (L, REF + ['play.png', 'mrt-ride.png'], STYLE + ISLE + EAST + CHIN + DORA + ENZO + PANEL + "Inside a round glass "
  "CABLE CAR gondola high over a harbour at night: Dora presses her nose to the big curved window, Enzo sits on the little bench "
  "holding on and peeking down nervously. Through the window: the dark sea far below with ships' lights, the glowing harbour docks "
  "behind, and ahead a resort island with a lit beach, palm trees, a looping roller coaster and an old fort. Cosy, a bit dizzying, "
  "fun. No text, no signs.")

# ── the three new markets' stall scenes, in the same framing as the others
J['stall-india'] = (L, SP + ['stall-market.png', 'east-faces.png'], STYLE + ISLE + EAST + STALL + "The stall-keeper is Mr Raju, a "
  "friendly INDIAN GREY MONGOOSE in a cream kurta with a checked scarf and reading glasses (copy him from the attached portrait sheet), "
  "behind his counter in a bustling covered wet market. Behind: flower stalls of marigolds and jasmine, hanging garlands, sacks of "
  "spices and warm light. No text, signs are blank shapes.")
J['stall-glam'] = (L, SP + ['stall-market.png', 'east-faces.png'], STYLE + ISLE + EAST + STALL + "The stall-keeper is Abang Kancil, a "
  "gentle MOUSEDEER in a teal baju Melayu and black songkok (copy him from the attached portrait sheet), behind his counter in a lively "
  "street market. Behind: stacked bolts of batik and gold songket cloth, rolled carpets, brass lanterns and a golden dome glowing far "
  "off. No text, signs are blank shapes.")
J['stall-resort'] = (L, SP + ['stall-bay.png', 'east-faces2.png'], STYLE + ISLE + EAST + STALL + "The stall-keeper is Kapten Duyung, a "
  "big gentle DUGONG in a navy captain's cap and peacoat (copy him from the attached portrait sheet), behind a bamboo beach kiosk "
  "counter strung with fairy lights. Behind: a moonlit beach with palms, beach umbrellas and the sea. No text, signs are blank shapes.")

# ── playtest fixes: a safe house of its own in each new district (they borrowed Chinatown's), and a Jade Line entrance
J['safe-bld'] = (L, SREF + ['landmarks.png', 'hdb-bld.png', 'bay-bld.png', 'india-bld.png'], STYLE + ISLE + EAST + "A game sprite "
  "sheet of six separate items for a top-down city game. " + BLD + "A 3 by 2 grid. Each of the first five is a cosy SAFE HOUSE where "
  "two young chinchilla heroes hide out, about square, with a small lit doorway, a potted plant and a single paw-print shape painted "
  "on the door, each in the style of its own neighbourhood: (1) a TOA PAYOH HDB flat: a ground-floor corner unit of a cream and "
  "pastel-green public housing block, a metal gate, shoe rack and potted plants along the corridor; (2) a MARINA BAY LOFT: a sleek "
  "small glass-and-timber penthouse box on a rooftop terrace with fairy lights and a deck; (3) a LITTLE INDIA shophouse unit on Buffalo "
  "Road: a narrow two-storey shophouse in turquoise and marigold with carved shutters and a jasmine garland over the door; (4) a "
  "KAMPONG GLAM shophouse on Kandahar Street: a narrow two-storey shophouse in pale green and cream with arched windows, patterned tiles "
  "and a brass lantern; (5) a SENTOSA beach hut: a raised wooden hut with a thatched roof, a little verandah with a hammock, palm "
  "trees and a surfboard leaning on it. (6) not a building but a PROP: a covered METRO STATION ENTRANCE seen from the same camera, a "
  "small glass canopy over a stairway going down, with jade-green steel frame, a glowing jade-green round sign plate (blank, no "
  "letters) on a short post beside it, and tiled steps, about one and a half times as wide as deep. No text anywhere, signs are blank "
  "coloured shapes. " + GRN)
