# Jade Street, fifth batch of paintings: Singapore flavour. A hawker centre (five stalls as businesses), a wet market, an
# HDB block with its void deck, a kopitiam and pastel shophouses, a mama shop, bumboats on the river, road-toll gantries,
# the karang guni man, aunties, a kopitiam uncle and an ah beng (walking townsfolk and portraits), a getai singer and a
# void-deck chess uncle, the Hungry Ghost getai stage, a Chinese New Year lion dance, a mooncake lantern walk, the kopi
# counter mini-game (its scene and every drink), and new hero poses (chope, kopi tray, durian, lantern, junk, storm, chess).
from jobs import STYLE, CHIN, DORA, ENZO, MAG, GRN, VIEW34, TOP, L, SQ, REF, SREF

SG = ("The setting has a warm SINGAPORE Chinatown feel (an invented quarter, no real places or brands): hawker food, kopitiam coffee "
 "shops, pastel shophouses, public housing blocks, tropical plants. Never use real brand names, company names, logos or flags. ")
J = {}

def act7(who, desc):
    return (L, REF + [f'{who}-act.png', f'{who}-act4.png'], STYLE + SG + CHIN + desc + f"A game sprite sheet of {who.title()} only, matching "
      "the attached sprite sheets of the same character exactly (same proportions, same outfit, same scale). " + VIEW34 +
      "A 4 by 3 grid of twelve separate poses of ONE character, each alone in its cell. Top row: (1) CHOPE facing the camera: leaning "
      "forward, placing a small white pocket packet of tissues down on an invisible table top with one paw, sly grin; (2) CHOPE DONE facing "
      "the camera: standing tall, one paw on the hip, the other pointing down at the spot, very pleased; (3) carrying a round metal TRAY "
      "of coffee cups and iced glasses at chest height with both paws, walking toward the camera, careful; (4) carrying the same tray, "
      "walking to the RIGHT in profile. Middle row: (5) SERVING facing the camera: holding out one cup on a saucer with both paws, "
      "smiling; (6) carrying a big spiky green DURIAN fruit held far out to the RIGHT at arm's length, the other paw pinching the nose, "
      "eyes watering, in profile; (7) the same durian carry facing the camera, nose pinched, cheeks puffed; (8) walking toward the camera "
      "holding up a glowing red paper LANTERN shaped like a rabbit on a short bamboo stick, delighted. Bottom row: (9) walking to the RIGHT "
      "in profile holding the rabbit lantern on its stick out in front; (10) HANDING OVER a bundle of old newspapers tied with string to "
      "the RIGHT in profile, both arms out; (11) SHAKING OFF RAIN facing the camera: soaked fur poofed out, shaking like a wet dog, water "
      "droplets flying off, eyes squeezed shut; (12) SITTING on a small round stool facing the camera, chin resting on one paw, thinking "
      "hard about a board game (no board drawn). " + MAG)

J['dora-act7'] = act7('dora', DORA)
J['enzo-act7'] = act7('enzo', ENZO)

CAST5 = ("Four NEW characters, anthropomorphic animals painted exactly in the style, framing and size of the attached portrait sheet. ")
MOODS4 = ("Each ROW is one character shown four times as a head-and-shoulders PORTRAIT facing the viewer, in the same framing, size, "
 "clothes and colours, changing ONLY the facial expression, left to right: (1) CALM, a friendly relaxed look; (2) HAPPY, a big warm open "
 "smile, eyes bright; (3) WORRIED, brows raised and tilted, mouth small and wobbly; (4) CROSS, brows down hard, frowning, cheeks puffed. "
 "Every portrait is a separate head-and-shoulders bust with plenty of empty background around it. No speech bubbles, no symbols, no "
 "sweat drops, no text. ")
J['sg-faces1'] = (SQ, ['portraits.png', 'expr1.png'], STYLE + SG + CAST5 + "A sheet of sixteen character portraits in a 4 by 4 grid. "
  + MOODS4 + "Row 1: AUNTIE HOON, a plump kindly GOOSE auntie with a short permed curly hairdo, a bright floral blouse and a small white "
  "pocket pack of tissues peeking from her breast pocket. Row 2: UNCLE TEO, a big round SUN BEAR coffee-shop uncle with a pale chest "
  "mark, in a white singlet with a small striped towel slung over one shoulder. Row 3: AH BENG, a young ROOSTER with a dyed orange spiky "
  "crest, sunglasses pushed up on his head and a loud short-sleeved printed shirt, cheeky and good-hearted. Row 4: MR ONG, an old BADGER "
  "rag-and-bone collector in a faded flat cap and a worn blue polo shirt, with a kind crinkly face. " + MAG)
J['sg-faces2'] = (L, ['portraits.png', 'expr1.png'], STYLE + SG + "Two NEW characters, anthropomorphic animals painted exactly in the "
  "style, framing and size of the attached portrait sheet. A sheet of eight character portraits in a 4 by 2 grid. " + MOODS4 + "Row 1: "
  "LILY SPARKLE, a glamorous PEACOCK stage singer with a fanned crest, big sparkly earrings and a sequined emerald-and-gold gown. Row 2: "
  "UNCLE GOH, an old MACAQUE monkey uncle with round reading glasses and a white singlet, a retired board-game champion. " + MAG)

J['folk4'] = (L, ['folk1.png', 'folk2.png', 'play.png'], STYLE + SG + "A game sprite sheet of three NEW cute anthropomorphic animal "
  "townsfolk pedestrians, matching the attached townsfolk sheets exactly in size, style and layout. " + VIEW34 + "A 5 by 3 grid of fifteen "
  "frames; each ROW is one character, left to right: (1) walking TOWARD the camera; (2) walking AWAY from the camera (seen from behind); "
  "(3) walking to the RIGHT in profile, left foot forward; (4) walking to the RIGHT in profile, right foot forward; (5) a startled little "
  "JUMP with both arms up. Row 1: an AUNTIE GOOSE with a short permed hairdo, a bright floral blouse, dark slacks and a woven rattan "
  "market basket on one arm. Row 2: a big SUN BEAR coffee-shop UNCLE in a white singlet, shorts and slippers with a small striped towel "
  "over one shoulder. Row 3: a young ROOSTER 'ah beng' with a dyed orange spiky crest, sunglasses pushed up on his head, a loud printed "
  "short-sleeved shirt and slim jeans. " + MAG)

J['sg-npc'] = (L, ['folk1.png', 'events.png', 'play.png'], STYLE + SG + "A game sprite "
  "sheet of townsfolk doing things, cute anthropomorphic animals matching the attached townsfolk sheet exactly in size and style. " + VIEW34 +
  "A 4 by 3 grid of twelve separate items, each alone in its cell. Top row: (1) a plump AUNTIE GOOSE with a permed hairdo and floral "
  "blouse leaning forward placing a small white pocket pack of tissues on an invisible table to reserve it, sly smile; (2) the same goose "
  "auntie SITTING on a round stool fanning herself with a woven palm-leaf fan; (3) an old MACAQUE uncle with round glasses and a white "
  "singlet SITTING at a small round stone table with a square game board of plain round wooden discs (no symbols on the discs), "
  "scratching his chin, thinking; (4) the same uncle slapping a disc down on the board, triumphant. Middle row: (5) an old BADGER in a "
  "faded flat cap pedalling a rusty three-wheeled CARGO TRICYCLE to the RIGHT in profile, its front basket piled with flattened cardboard, "
  "old newspapers and an old radio; (6) the same, the other pedal down, squeezing a rubber bulb horn; (7) a glamorous PEACOCK singer in a "
  "sequined emerald-and-gold gown singing into a gold microphone, one wing raised high; (8) the same singer swaying the other way, eyes "
  "closed. Bottom row: (9) a two-person red-and-gold festival LION DANCE costume (a big fluffy lion head with mirror and pompoms, a long "
  "fringed body, four furry legs) dancing with its head raised high; (10) the same lion dance with its head swooping low; (11) a little "
  "RABBIT child walking toward the camera holding up a glowing orange CARP paper lantern on a stick; (12) a cheerful young DOG drummer "
  "beating a big red lion-dance DRUM on a little wooden stand. " + MAG)

J['sg-props'] = (SQ, SREF + ['props1.png', 'props3.png', 'events.png'], STYLE + SG + "A game prop sheet for a top-down city game, every "
  "object seen from a HIGH top-down camera with a gentle 3/4 tilt, matching the attached props in size and style. A 4 by 4 grid of "
  "sixteen separate objects, each centred in its own cell. Row 1: (1) a small white pocket PACK OF TISSUES lying flat (plain wrapper); (2) "
  "a round white marble-topped HAWKER TABLE with four round stools fixed around it, a small white pack of tissues lying on the table top; "
  "(3) the same table and stools with nothing on it; (4) a single spiky green DURIAN fruit. Row 2: (5) a wooden crate brimming with spiky "
  "green durians; (6) a round tray of colourful KUEH: striped layer cakes, green coconut balls and pink tortoise-shaped cakes; (7) a big "
  "black carbon-steel WOK with a long handle; (8) a sparkly gold stage MICROPHONE with a sequin tassel. Row 3: (9) a small temporary "
  "outdoor GETAI STAGE: a raised platform with rows of bright bulbs round a sparkly blank backdrop, two big loudspeakers and a red carpet "
  "front edge; (10) a row of red plastic stools with little plates of oranges on the front ones (seats kept for the spirits); (11) a "
  "bundle of old newspapers tied with string; (12) a little heap of junk: an old transistor radio, a dented kettle and flattened cardboard. "
  "Row 4: (13) a round metal tray with white cups of coffee on saucers and tall glasses of iced tea; (14) a wavy cartoon SMELL CLOUD, pale "
  "yellow-green and curly, like a strong fruit smell; (15) a festive ENTRANCE ARCH for a hawker centre: red-and-jade painted posts and a "
  "curved roof with hanging lanterns and a blank sign board; (16) a little red festive envelope with a gold border, blank. No text "
  "anywhere, every label and sign is a blank coloured shape. " + MAG)

J['sg-rides'] = (L, SREF + ['vehicles.png', 'traffic.png'], STYLE + SG + TOP + "A game sprite sheet of vehicles and road things for a "
  "top-down city game, matching the attached vehicle sheet exactly in scale and view. A 3 by 2 grid of six separate items, each centred in "
  "its own cell. Row 1: (1) a traditional wooden river BUMBOAT seen from directly above, pointing up: a broad wooden hull painted red and "
  "white with a big painted eye on each side of the bow, a green-and-white striped canopy roof over benches in the middle, a little "
  "outboard motor at the back; (2) a second bumboat, the same shape, hull painted blue and yellow, a red canopy roof; (3) a rusty "
  "three-wheeled CARGO TRICYCLE from directly above, pointing up, its big front box piled with cardboard and old newspapers. Row 2: (4) a "
  "little wooden lion-dance DRUM CART from directly above, pointing up, a big red drum with gold studs on it and cymbals; (5) a road TOLL "
  "GANTRY seen from directly above: a long slim grey steel beam spanning sideways across the whole cell, with two small blank white "
  "sensor boxes on it and a post at each end, nothing else (no road); (6) a small floating wooden river LANDING PONTOON with rope bumpers "
  "and two mooring posts. No text on anything. " + MAG)

def bizrow(t):
    return ("A game prop sheet of hawker-centre food STALLS for a top-down city game, every one seen from a HIGH top-down camera with a gentle "
      "3/4 tilt, matching the attached businesses sheet exactly in size and style. A 4 by 3 grid. " + t + " No text on any sign, plaque or "
      "banner, signs are blank coloured shapes. Nobody standing at any of them. " + MAG)
GROW = ("Each of the first rows is ONE stall shown four times, left to right, growing as it is upgraded, keeping the same base shape and "
  "colours: (1) SHUTTERED and for sale: metal roller shutter pulled down, a blank plaque; (2) LEVEL 1, freshly opened: a modest clean "
  "stall, a few dishes out, one lamp; (3) LEVEL 2: a bigger lit menu board (blank), more food, a small queue rope and a stool; (4) LEVEL 3, "
  "grand: gold trim, glowing lamps, potted plants, a little red carpet, busy-looking. ")
J['biz3'] = (L, SREF + ['biz1.png', 'biz2.png'], STYLE + SG + bizrow(GROW + "Row 1: a CHAR KWAY TEOW stall: a big black wok over a "
  "roaring flame, plates of glossy flat noodles with cockles and greens. Row 2: a CHICKEN RICE stall: a glass display case with golden "
  "roast chickens, a chopping board and mounds of fragrant rice. Row 3: a SATAY stall: a long charcoal grill of skewers with curling "
  "smoke, a woven fan and a pot of peanut sauce."))
J['biz4'] = (L, SREF + ['biz1.png', 'biz2.png'], STYLE + SG + bizrow(GROW + "Row 1: a LAKSA stall: big pots of orange curry noodle soup, "
  "stacks of bowls, bunches of laksa leaves. Row 2: a KOPI stall: an old coffee counter with tall long-spouted kettles, cloth coffee "
  "socks, stacks of thick white cups and saucers and blank milk tins. Row 3 is four DIFFERENT separate items: (9) a WET MARKET fish "
  "stall: a tiled counter of fish on crushed ice under a hanging bulb, a wet floor; (10) a wet market VEGETABLE stall with baskets of "
  "leafy greens, red chillies and limes; (11) a tiny MAMA SHOP provision kiosk with racks of snacks, glass jars of sweets, a newspaper "
  "rack and a cooler box, all labels blank; (12) a round stone CHESS TABLE with a plain square board and four stone stools."))

J['sg-bld'] = (L, SREF + ['buildings2.png', 'shops1.png', 'landmarks2.png'], STYLE + SG + "A game sprite sheet of six separate BUILDINGS "
  "for a top-down city game, each seen from a HIGH top-down camera with a gentle 3/4 tilt so we see the roof and the front facade, matching "
  "the attached building sheets exactly in style. Each building fills its cell, front facing down the image. A 3 by 2 grid. Row 1: (1) a "
  "public HOUSING BLOCK: a tall slab apartment block with a flat roof and water tank, rows of windows with bamboo laundry poles sticking "
  "out hung with colourful clothes, pastel cream and teal paint, and an open VOID DECK at ground level with pillars; (2) a KOPITIAM: a "
  "corner two-storey shophouse whose ground floor is an open coffee shop with marble tables, folding stools and ceiling fans, a blank "
  "signboard; (3) a mint-green pastel PERANAKAN SHOPHOUSE with ornate painted tiles, tall louvred windows and arched FIVE-FOOT WAY "
  "arcades at ground level. Row 2: (4) the same style of shophouse in pastel pink and powder blue with a covered five-foot way; (5) a "
  "WET MARKET hall: a long low market roof with a raised louvred ridge and open sides showing fish and vegetable stalls; (6) a little "
  "clan-association house with a green-glazed tiled roof, red double doors and lanterns. No text anywhere, signs are blank coloured "
  "shapes. " + GRN)

J['sg-drinks'] = (SQ, SREF + ['icons.png', 'props1.png'], STYLE + SG + "A game icon sheet of kopitiam DRINKS, each seen from a gentle 3/4 "
  "angle, matching the attached icons in style. A 4 by 4 grid of sixteen separate items. Hot drinks are in a thick white cup on a saucer "
  "with a thin green rim; iced drinks are in a tall clear glass with ice cubes. Row 1: (1) hot black coffee, very dark; (2) hot coffee "
  "with sweet condensed milk, caramel brown; (3) hot coffee with evaporated milk, lighter with a cream swirl; (4) hot milky tea, "
  "orange-brown. Row 2: (5) hot clear amber tea, no milk; (6) hot tea with evaporated milk, pale with a cream swirl; (7) iced coffee with "
  "condensed milk in a tall glass; (8) iced milky tea in a tall glass. Row 3: (9) iced black coffee; (10) iced clear amber tea; (11) iced "
  "coffee with a white layer of evaporated milk on top; (12) iced tea in three layers: dark tea, orange, cream. Row 4: (13) a small tin "
  "of sweet CONDENSED MILK with a plain red label; (14) a small tin of EVAPORATED MILK with a plain blue label; (15) a glass jar of white "
  "sugar with a spoon in it; (16) a little metal bucket of ice cubes. No text on any label. " + MAG)

J['mg-kopi'] = ('landscape 1536x1024', ['mg-wok.png', 'stall-market.png'], STYLE + SG + "A close-up mini-game scene "
  "painting, matching the attached kitchen scene exactly in style and framing: the counter of an old KOPITIAM coffee shop at night, seen "
  "straight on. Behind the counter a big friendly SUN BEAR uncle in a white singlet with a striped towel on his shoulder pours a long "
  "stream of coffee from a tall long-spouted kettle through a cloth sock; shelves of thick white cups, blank tins and glass jars, ceiling "
  "fans, a marble-topped table and folding stools in the background, warm lamps. Leave the lower third of the picture as a calm empty "
  "marble counter top so cups and buttons can sit over it. No text anywhere, every label and sign is a blank coloured shape. Full bleed, "
  "no border.")
