# Jade Street, the twelfth pass's paintings: three new districts east along the coast (Katong and Joo Chiat with East
# Coast Park, Orchard Road, and Changi with the airport, a Jewel-style indoor waterfall, Changi Village and the beach),
# a new rival gang (the Atas Bats, posh lesser dog-faced fruit bats) and their boss Datin Ciku, the chapter-eight cast
# (portraits and full bodies), three new townsfolk, the heroes' new actions (cycling, laksa, hanging a bauble, flying a
# kite, plane spotting, wheeling a suitcase), map and phone icons, the chapter card, the new ending, three stall scenes
# and a repainted ferry. Warm and respectful, no caricature. The game now uses real Singapore names in its TEXT, but
# the paintings keep the no-lettering rule: no text, letters, numbers, logos or flags anywhere.
from jobs import STYLE, CHIN, DORA, ENZO, MAG, GRN, VIEW34, TOP, L, SQ, REF, SREF
from jobs6 import CROW, MOODS4, CAST6, BLD, PANEL
from jobs7 import POSES, BODY
from jobs2 import STALL, SP

SG = ("The setting is SINGAPORE at night, painted warmly and respectfully, celebrating its real neighbourhoods with care: no "
 "caricature, no stereotypes. Absolutely NO lettering anywhere: no text, letters, numbers, logos, brand marks or flags; every sign is "
 "a blank coloured shape. ")
NEW = ("This part of the city is inspired by Singapore's EAST COAST: KATONG and JOO CHIAT (colourful Peranakan terrace houses with "
 "ornate tiles, laksa stalls), EAST COAST PARK (beach, casuarina trees, a cycling track, a hawker centre), ORCHARD ROAD (glass "
 "shopping malls and a Christmas light-up, the old terraces of Emerald Hill) and CHANGI (the airport, a glass-domed garden with a "
 "huge indoor waterfall, Changi Village and the beach). ")
PROP = ("Each object is seen from a HIGH top-down game camera with a gentle 3/4 tilt, matching the attached prop sheets exactly in "
 "scale, ink outline, cel shading and warm night lighting. ")
BAT = ("the ATAS BATS, a gang of posh LESSER DOG-FACED FRUIT BATS: small furry warm-brown bats with fox-like faces, big dark shiny eyes, "
 "pointed ears with pale rims, leathery dark-brown wings, each wearing a tiny RED BOW TIE and a little string of PEARLS; snooty and "
 "show-offy, cartoon cute, never scary. ")
CIKU = ("DATIN CIKU, the boss of the fruit-bat gang: a plump elegant LESSER DOG-FACED FRUIT BAT matriarch with silvery-brown fur, big "
 "dark eyes behind jewelled cat-eye glasses, a ruby-red silk cape over her folded wings, three strings of pearls and a little gold "
 "tiara, ")
J = {}

# ── ground: Katong's Peranakan tiles, Orchard's mall pavement, the airport apron, the park's cycling track, the Jewel's
# garden floor, Changi Village's pavers
J['ground5'] = (L, SREF + ['ground.png', 'ground3.png', 'ground4.png'], STYLE + SG + NEW + "Six separate SQUARE seamless ground "
  "TEXTURES for a top-down city game, matching the attached ground textures exactly in scale and style, seen from directly above, "
  "flat, evenly lit at night, no objects, no lines, no kerbs, no borders: a 3 by 2 grid of six squares that each fill their cell "
  "completely, edge to edge, with thin black gaps between them. Top row: (1) a KATONG five-foot-way floor of small square PERANAKAN "
  "ENCAUSTIC TILES in a repeating floral pattern of soft teal, rose pink and cream; (2) an ORCHARD ROAD pavement of big polished pale "
  "grey and warm beige granite slabs with a faint sheen; (3) an AIRPORT APRON of smooth dark grey concrete slabs with faint seams and "
  "a few small oil marks. Bottom row: (4) a PARK CYCLING TRACK of smooth brick-red asphalt; (5) a lush INDOOR GARDEN floor: soft moss, "
  "ferns and small round stepping stones; (6) a CHANGI VILLAGE pavement of worn warm terracotta and grey interlocking pavers.")

# ── buildings (green screen; the packer stretches each to its footprint)
J['katong-bld'] = (L, SREF + ['sg-bld.png', 'india-bld.png', 'glam-bld.png'], STYLE + SG + NEW + "A game sprite sheet of six separate "
  "KATONG and JOO CHIAT buildings for a top-down city game. " + BLD + "A 3 by 2 grid. Row 1: (1) a row of PERANAKAN TERRACE HOUSES: "
  "three narrow two-storey houses side by side in pastel mint, pink and lemon, each with ornate plaster, tall green shuttered windows, "
  "colourful glazed tiles between the doors and a tiled five-foot way, three times as wide as deep; (2) another row of PERANAKAN "
  "TERRACE HOUSES in powder blue, peach and lilac with carved timber pintu pagar half-doors, twice as wide as deep; (3) a corner "
  "LAKSA SHOP: an old two-storey corner coffee shop with open folding doors, round marble tables, big steaming pots at the front and "
  "warm yellow light, about one and a half times as wide as deep. Row 2: (4) a grand PERANAKAN MANSION: a two-storey heritage house "
  "with a red-tiled roof, a deep front porch with columns and a little garden with frangipani, about one and a half times as wide as "
  "deep; (5) a row of two JOO CHIAT SHOPHOUSES in teal and coral with kueh and beaded-shoe shops in the open fronts, twice as wide as "
  "deep; (6) a small heritage CORNER SHOPHOUSE in sunflower yellow with a curved corner and a balcony of potted plants, about square. "
  + GRN)
J['katong-bld2'] = (L, SREF + ['katong-bld.png', 'hdb-bld.png', 'resort-bld2.png'], STYLE + SG + NEW + "A game sprite sheet of six "
  "separate buildings for a top-down city game, matching the attached Katong sheet. " + BLD + "A 3 by 2 grid. Row 1: (1) a seaside "
  "HAWKER CENTRE: a low open pavilion with a big pitched roof, rows of food stalls along the back with steam rising and many round "
  "tables, palm trees beside it, about twice as wide as deep; (2) a BICYCLE RENTAL kiosk: a little wooden hut with a striped awning and "
  "a row of bicycles parked in front, about one and a half times as wide as deep; (3) a seaside SEAFOOD RESTAURANT: a long low "
  "pavilion with a red roof, glowing fish tanks and outdoor tables, twice as wide as deep. Row 2: (4) a big friendly suburban SHOPPING "
  "MALL: a wide low block with a glass entrance canopy, coloured panels and a car park ramp, twice as wide as deep; (5) a modern "
  "underground METRO STATION entrance building with a curved white roof and a glass front, about twice as wide as deep; (6) a small "
  "beach PAVILION shelter with a hip roof on timber posts and benches, about one and a half times as wide as deep. " + GRN)
J['orchard-bld'] = (L, SREF + ['bay-bld.png', 'bay-bld2.png', 'katong-bld.png'], STYLE + SG + NEW + "A game sprite sheet of six separate "
  "ORCHARD ROAD buildings for a top-down city game. " + BLD + "A 3 by 2 grid. Row 1: (1) a futuristic SHOPPING MALL with a curving "
  "silver-and-glass skin wrapped round a tall tower, a glowing lit plaza at the front with screens of blank colour, about twice as wide "
  "as deep; (2) a huge granite DEPARTMENT STORE MALL with twin dark towers on a wide podium, a big open forecourt with a fountain, "
  "about twice as wide as deep; (3) an elegant LUXURY MALL with a cream stone and glass facade and gold-lit display windows, about one "
  "and a half times as wide as deep. Row 2: (4) a busy older MALL block of many small shops with bright lit windows of phones and "
  "watches, about one and a half times as wide as deep; (5) a classic DEPARTMENT STORE with a green-tiled Chinese pagoda-style roof on "
  "top of a modern glass building, about square; (6) a modern METRO STATION entrance pavilion with a glass canopy and a green roof "
  "garden, about twice as wide as deep. " + GRN)
J['orchard-bld2'] = (L, SREF + ['orchard-bld.png', 'katong-bld.png', 'bay-bld2.png'], STYLE + SG + NEW + "A game sprite sheet of six "
  "separate buildings for a top-down city game, matching the attached Orchard Road sheet. " + BLD + "A 3 by 2 grid. Row 1: (1) a row "
  "of EMERALD HILL heritage terrace houses on a gentle slope: three pastel two-storey houses with ornate gables, carved doors and "
  "shutters, frangipani trees, three times as wide as deep; (2) a heritage terrace house turned into a cosy BAR with a lantern-lit "
  "front terrace and little tables, about one and a half times as wide as deep; (3) a tall elegant HOTEL tower with a lit porte "
  "cochere and a row of flags poles without flags, about square. Row 2: (4) a festive CHRISTMAS MARKET of white peaked tents with "
  "fairy lights and gift stalls, twice as wide as deep; (5) a slim modern glass MALL with a lit atrium and a rooftop garden, about "
  "one and a half times as wide as deep; (6) a cosy two-storey shophouse CAFE with a striped awning and potted plants, about square. "
  + GRN)
J['changi-bld'] = (L, SREF + ['bay-bld.png', 'resort-bld.png', 'hdb-bld.png'], STYLE + SG + NEW + "A game sprite sheet of six separate "
  "CHANGI buildings for a top-down city game. " + BLD + "A 3 by 2 grid. Row 1: (1) a big modern AIRPORT TERMINAL: a long low building "
  "with a gently curved white roof of skylight panels, a glass front and covered jet bridges reaching out the back, about two and a "
  "half times as wide as deep; (2) an airport CONTROL TOWER: a slim tall white tower with a glass cab on top and a red light, about "
  "square; (3) a big CARGO HANGAR with a curved metal roof and wide open doors with crates inside, about one and a half times as wide "
  "as deep. Row 2: (4) the CHANGI VILLAGE HAWKER CENTRE: an old open food centre with a low roof, stalls round the edge and many "
  "tables, steam and warm light, about twice as wide as deep; (5) a row of two low old VILLAGE SHOPHOUSES with bright shopfronts, a "
  "provision shop and a bike shop, twice as wide as deep; (6) an AIRPORT METRO STATION: a long glass box with a sweeping green roof, "
  "about twice as wide as deep. " + GRN)
J['changi-bld2'] = (L, SREF + ['changi-bld.png', 'safe-bld.png', 'resort-bld2.png'], STYLE + SG + NEW + "A game sprite sheet of six "
  "separate buildings for a top-down city game, matching the attached sheets. " + BLD + "A 3 by 2 grid. Row 1: (1) a little FERRY "
  "TERMINAL for bumboats: a low timber shed with a tin roof and a short jetty, about twice as wide as deep; (2) a cosy SAFE HOUSE in "
  "KATONG where two young chinchilla heroes hide out: a narrow pastel-pink Peranakan terrace house with a carved door, potted plants "
  "and a single paw-print shape on the door, about square; (3) a cosy SAFE HOUSE off ORCHARD ROAD: a small white colonial-style "
  "bungalow with a garden and a lit verandah, a single paw-print shape on the door, about square. Row 2: (4) a cosy SAFE HOUSE in "
  "CHANGI VILLAGE: an old black-and-white bungalow on low stilts with a timber verandah and palm trees, a single paw-print shape on "
  "the door, about square; (5) a small seaside VILLAGE HOTEL, three storeys, white with blue balconies, about one and a half times as "
  "wide as deep; (6) a JEWEL-LIKE GLASS DOME seen from above at a tilt: a huge round glass-and-steel torus dome with a lit garden "
  "inside and a round opening at the top, about one and a quarter times as wide as deep. " + GRN)

# ── props: Katong, East Coast Park and Orchard Road's Christmas light-up
J['props12a'] = (SQ, SREF + ['props1.png', 'isle-props.png', 'east-props.png'], STYLE + SG + NEW + PROP + "A 4 by 4 grid of sixteen "
  "separate items, each centred in its own cell. Row 1: (1) a LAKSA hawker CART with a big steaming pot and stacked bowls; (2) a "
  "small PERANAKAN porcelain KAMCHENG jar with a lid, pink and green with a phoenix pattern; (3) a tall pole with three hanging "
  "SONGBIRD CAGES of carved bamboo; (4) a NYONYA KUEH stall: a little table of colourful layered kueh cakes under a parasol. Row 2: (5) "
  "a BICYCLE RACK with four rental bicycles; (6) a park BARBECUE PIT of stone with a grill; (7) a flying KITE: a diamond-shaped bright "
  "kite with a long ribbon tail, seen from below as it flies; (8) a tall feathery CASUARINA tree. Row 3: (9) a big decorated "
  "CHRISTMAS TREE with gold baubles and warm fairy lights and a star on top; (10) a festive CHRISTMAS LIGHT-UP ARCH spanning a road, "
  "seen from above: a wide arch of strings of white and gold lights shaped like stars and snowflakes, much wider than tall; (11) a "
  "shining golden CHRISTMAS STAR ornament; (12) a pile of wrapped GIFT BOXES with ribbons. Row 4: (13) a single shiny red Christmas "
  "BAUBLE; (14) a glowing light-up REINDEER sculpture made of white fairy lights; (15) a cluster of paper SHOPPING BAGS in bright "
  "colours (blank, no logos); (16) the fruit-bat gang's ROOST hideout: a huge old gnarled tree with dozens of little brown fruit bats "
  "in red bow ties hanging upside down from its branches among stolen shopping bags and strings of pearls. No text anywhere. " + MAG)
J['props12b'] = (SQ, SREF + ['props1.png', 'isle-props.png', 'resort-props.png'], STYLE + SG + NEW + PROP + "A 4 by 4 grid of sixteen "
  "separate items, each centred in its own cell. Row 1: (1) a big white passenger AIRLINER parked, seen from DIRECTLY ABOVE pointing UP "
  "the image, wings spread, plain white with a jade-green tail (no logo); (2) an airport BAGGAGE TUG pulling two little luggage carts "
  "piled with suitcases, seen from DIRECTLY ABOVE pointing UP; (3) an airport luggage TROLLEY with two suitcases; (4) a single rolling "
  "SUITCASE, jade green with a handle. Row 2: (5) a tall curved GLASS WALL panel of a domed garden: steel frame and glass, seen from "
  "above at a tilt, wider than tall; (6) a lush terraced FOREST PLANTER of ferns, palms and hanging vines on stepped rocks; (7) a "
  "blue-and-white airfield RUNWAY LIGHT on a short post; (8) an orange-and-white striped airfield WINDSOCK on a pole. Row 3: (9) a "
  "woven BASKET of brown CIKU fruit (sapodilla), some cut open; (10) a plate of NASI LEMAK: coconut rice, a fried egg, sambal, "
  "peanuts and anchovies on a banana leaf; (11) a beach WOODEN BENCH under a sea almond tree; (12) a small bumboat jetty SIGN post "
  "with a blank board. Row 4: (13) a white passenger AIRLINER FLYING overhead, seen from DIRECTLY BELOW, wings spread, landing lights "
  "glowing; (14) a festive light-up GIFT-BOX sculpture of fairy lights; (15) a mall's tall glass CHRISTMAS TREE of white lights; (16) "
  "a cluster of fallen golden STAR ornaments. No text anywhere. " + MAG)
# the Jewel's waterfall: the finale set piece. Big props seen from above at the game's tilt
J['jewel'] = (SQ, SREF + ['props12b.png', 'resort-props.png', 'east-props.png'], STYLE + SG + NEW + PROP + "A 2 by 2 grid of four "
  "separate big items, each centred in its own cell. (1) a huge INDOOR WATERFALL seen from high above at the game's tilt: a round dark "
  "pool ringed with lush terraced forest, and a wide circular curtain of falling white water pouring down from a round opening above "
  "into the middle of the pool, mist rising, cool blue night light; (2) the same INDOOR WATERFALL during its LIGHT SHOW: the falling "
  "water curtain glowing purple, pink and blue, sparkles in the mist; (3) a narrow glass-floored CANOPY BRIDGE with steel railings, "
  "seen from above, running left to right, much wider than tall; (4) a lush STEPPED FOREST VALLEY terrace of ferns, palms and "
  "flowering plants on grey rocks with a little winding path, about square. No text anywhere. " + MAG)
J['ferry2'] = (SQ, SREF + ['vehicles.png', 'resort-props.png'], STYLE + SG + TOP + "A game sprite of ONE vehicle in the centre of the "
  "image, seen from DIRECTLY ABOVE (strict bird's-eye view, like a map), pointing straight UP the image: a small white harbour "
  "PASSENGER FERRY BOAT, clearly a BOAT: a long hull that narrows to a sharp pointed V BOW at the top with a curl of white foam around "
  "it, a white upper deck with rows of blue bench seats seen from above, a small raised wheelhouse with a dark windscreen towards the "
  "front, orange lifebuoys on the rails, an open rear deck, and a wide white churning WAKE trailing off the square stern at the "
  "bottom. It is about three times as long as wide. No text anywhere. " + MAG)

# ── the Atas Bats and Datin Ciku
J['bats'] = (L, SREF + ['mynahs.png', 'lizards.png', 'otters.png'], STYLE + SG + "The rivals: " + BAT + "A game sprite sheet of one bat "
  "of the gang, matching the attached rival sheets exactly in size and style. " + VIEW34 + "A 4 by 3 grid of twelve poses, each alone "
  "in its cell. Top row: (1) SCURRYING toward the camera on its wing-thumbs and feet, a mango slice in its mouth; (2) the same, the "
  "other wing forward; (3) scurrying away seen from behind, wings folded like a cape; (4) the same, the other wing forward. Middle "
  "row: (5) a low swooping HOP to the RIGHT in profile, wings half open; (6) the same, wings down; (7) FLYING seen from DIRECTLY ABOVE, "
  "wings spread wide, pointing UP the image; (8) FLYING seen from directly above, wings swept down, pointing UP. Bottom row: (9) a "
  "snooty TAUNT: standing, nose in the air, one wing on its hip, eyes closed; (10) DIZZY, sitting, little stars circling, bow tie "
  "crooked; (11) TANGLED in a brown rope net, sheepish; (12) happily MUNCHING a ripe fig held in both wings. " + MAG)
J['bats2'] = (L, SREF + ['bats.png', 'mynahs2.png', 'emp-raid2.png'], STYLE + SG + "The rivals: " + BAT + "matching the attached bat "
  "sheet exactly in size and style. " + VIEW34 + "A 4 by 3 grid of twelve poses, each alone in its cell. Top row: (1) HANGING UPSIDE "
  "DOWN by its feet from a short horizontal bar, wings wrapped round itself like a cloak, eyes half shut; (2) the same, hanging upside "
  "down, one wing open waving cheekily; (3) PREENING, fussily licking teal paint splotches off its wing; (4) delightedly batting at a "
  "soap BUBBLE above its head. Middle row: (5) CAUGHT, sitting with both wings up in surrender, embarrassed; (6) GRABBING greedily at "
  "something unseen, wings out; (7) SNEAKING low to the RIGHT on tiptoe with a wing held over its face, left foot forward; (8) the "
  "same, right foot forward. Bottom row: (9) PEERING with its head cocked, one eye wide, suspicious; (10) PERCHED upright on a short "
  "post, looking around, a lookout; (11) " + CIKU + "standing, wings folded under her cape, smug; (12) Datin Ciku RUNNING to the "
  "RIGHT in profile, cape flying, clutching her tiara. " + MAG)
J['bats3'] = (L, SREF + ['bats.png', 'emp-raid1.png', 'emp-raid2.png'], STYLE + SG + "The rivals: " + BAT + "matching the attached "
  "sheets exactly in size and style. " + VIEW34 + "A 4 by 2 grid of eight poses, each alone in its cell. Top row, a bat RAIDING a shop: "
  "(1) RUNNING to the RIGHT in profile hugging a small metal CASH BOX, coins flying out, cheeky grin; (2) the same run, the other leg "
  "forward, more coins spilling; (3) KICKING over a crate of a shop display, facing the camera, gleeful; (4) TAUNTING, holding up a "
  "gold coin, nose in the air. Bottom row: (5) " + CIKU + "running to the RIGHT the other foot forward, cape flying; (6) Datin Ciku "
  "DIZZY, sitting, tiara askew, stars circling; (7) a bat FLYING low seen from directly above pointing UP, a golden star ornament in "
  "its feet; (8) a bat SINGING showily, wings spread, mouth wide open, head thrown back. " + MAG)

# ── the chapter-eight cast: portraits (four moods each), then full bodies copied from them
J['faces12a'] = (SQ, ['portraits.png', 'east-faces.png', 'emp-faces.png'], STYLE + SG + NEW + "Four " + CAST6 + "A sheet of sixteen "
  "character portraits in a 4 by 4 grid. " + MOODS4 + "Row 1: NYONYA ROSIE, a warm, bossy LEOPARD CAT auntie, golden fur with dark "
  "spots, in a white lace-trimmed sarong KEBAYA blouse with a floral embroidered edge and three gold kerosang brooches, her hair in a "
  "neat bun with a gold pin. Row 2: UNCLE BALA, a cheerful sun-browned MUDSKIPPER with big bulging eyes on top of his head, a wide "
  "grin, a faded orange cycling cap and a white singlet with a whistle on a cord. Row 3: MS TIARA, an elegant CRIMSON SUNBIRD with a "
  "scarlet head and chest and a long thin curved beak, in a smart emerald-green blazer with a gold star pin and a headset. Row 4: "
  "CAPTAIN FAIZ, a calm, kind STORK-BILLED KINGFISHER airline pilot with a huge red beak, teal-blue wings and a buff chest, in a "
  "navy pilot's jacket with gold stripes on the cuffs and a pilot's cap. " + MAG)
J['faces12b'] = (L, ['portraits.png', 'east-faces2.png', 'faces12a.png'], STYLE + SG + NEW + "Two " + CAST6 + "A sheet of eight "
  "character portraits in a 4 by 2 grid. " + MOODS4 + "Row 1: PAK UBIN, a wise old SAMBAR DEER bumboat man with short antlers, a grey "
  "beard, a faded checked sarong over a blue work shirt and a straw hat pushed back. Row 2: " + CIKU + "head and shoulders. " + MAG)
J['cast11'] = ('landscape 1536x1024', ['cast-ref11.png', 'folk1.png', 'sg-npc.png', 'play.png'], STYLE + SG + NEW + "A game sprite "
  "sheet of four job-giver characters for a top-down city game, the characters in the attached portrait strip (left to right = rows 1 "
  "to 4). " + BODY + POSES + "Row 1: NYONYA ROSIE, a LEOPARD CAT auntie in a white lace sarong kebaya with gold brooches and a "
  "batik sarong. Row 2: UNCLE BALA, a MUDSKIPPER in an orange cycling cap, a white singlet and shorts. Row 3: MS TIARA, a CRIMSON "
  "SUNBIRD in an emerald-green blazer with a headset. Row 4: CAPTAIN FAIZ, a STORK-BILLED KINGFISHER pilot in a navy pilot's uniform "
  "and cap. " + MAG)
J['cast12'] = ('landscape 1536x1024', ['cast-ref12.png', 'folk1.png', 'sg-npc.png', 'play.png'], STYLE + SG + NEW + "A game sprite "
  "sheet of two job-giver characters for a top-down city game, the characters in the attached portrait strip (left to right = rows 1 "
  "and 2). " + BODY + POSES.replace('6 by 4 grid of twenty-four', '6 by 2 grid of twelve') + "Row 1: PAK UBIN, a SAMBAR DEER bumboat "
  "man in a checked sarong, a blue work shirt and a straw hat. Row 2: DATIN CIKU, a plump FRUIT BAT matriarch with jewelled cat-eye "
  "glasses, a ruby-red silk cape over her folded wings, pearls and a little gold tiara. " + MAG)

# ── three new townsfolk, one for each new district
J['folk7'] = (L, ['folk1.png', 'folk6.png', 'play.png'], STYLE + SG + NEW + "A game sprite sheet of three NEW cute anthropomorphic "
  "animal townsfolk pedestrians, matching the attached townsfolk sheets exactly in size, style and layout. " + VIEW34 + "A 5 by 3 grid "
  "of fifteen frames; each ROW is one character, left to right: (1) walking TOWARD the camera; (2) walking AWAY from the camera (seen "
  "from behind); (3) walking to the RIGHT in profile, left foot forward; (4) walking to the RIGHT in profile, right foot forward; (5) "
  "a startled little JUMP with both arms up. Row 1: an ORIENTAL MAGPIE-ROBIN uncle (black and white feathers) in a white singlet and "
  "striped shorts, carrying a small bamboo songbird cage. Row 2: a PINK-NECKED GREEN PIGEON shopper in a trendy pastel dress with two "
  "blank paper shopping bags. Row 3: a LITTLE EGRET traveller (white feathers, black beak) in a smart travel jacket pulling a small "
  "wheeled suitcase. " + MAG)

# ── the heroes' new actions (both heroes, the same twelve)
def act14(who, desc):
    return (L, REF + [f'{who}-act.png', f'{who}-ride.png', f'{who}-act12.png'], STYLE + SG + CHIN + desc + f"A game sprite sheet of "
      f"{who.title()} only, matching the attached sprite sheets of the same character exactly (same proportions, same outfit, same "
      "scale). A 4 by 3 grid of twelve separate poses of ONE character, each alone in its cell. Top row: (1) RIDING A BICYCLE seen from "
      "DIRECTLY ABOVE, pointing straight UP the image like the scooter-riding pose in the attached ride sheet, the character on the "
      "saddle leaning on the handlebars, the left knee up mid-pedal (draw the character only, NO bicycle); (2) the same, the right knee "
      "up; then, seen from a high top-down game camera with a gentle 3/4 tilt: (3) sitting facing the camera SLURPING a bowl of laksa "
      "noodles with chopsticks, cheeks puffed; (4) the same, holding the bowl up, eyes closed in bliss, a noodle on the chin. Middle row "
      "(3/4 tilt): (5) standing on tiptoe facing away from the camera reaching up high to HANG a shiny red Christmas bauble on a branch; "
      "(6) the same, stepping back facing the camera, both paws clasped, delighted; (7) FLYING A KITE: facing the camera, both paws "
      "holding the string of a kite out of view high above, leaning back; (8) the same, tugging the string, grinning upward. Bottom row "
      "(3/4 tilt): (9) PLANE SPOTTING: facing the camera, head tipped right back, pointing straight up at the sky, mouth open in wonder; "
      "(10) the same, waving both arms over the head at the sky; (11) WHEELING a small jade-green SUITCASE by its handle, walking to the "
      "RIGHT in profile, left foot forward; (12) the same, right foot forward. " + MAG)
J['dora-act14'] = act14('dora', DORA)
J['enzo-act14'] = act14('enzo', ENZO)

# ── the interface: map landmarks and pins, the new district icons
J['ui12'] = (L, SREF + ['icons.png', 'isle-ui.png', 'ui10.png'], STYLE + SG + "A game UI icon sheet painted like enamel shop signs and "
  "lacquered wood with gold trim, matching the attached icons in style, chunky and readable at small size. A 4 by 2 grid of eight "
  "separate items. Row 1: (1) a round BICYCLE icon in a gold ring; (2) a map PIN shaped like a teardrop with a little fruit bat in a "
  "red bow tie inside; (3) a small map landmark icon of a round glass dome with a waterfall pouring down inside it; (4) a small map "
  "landmark icon of a curvy futuristic glass shopping mall tower. Row 2: (5) a small map landmark icon of a row of three pastel "
  "Peranakan terrace houses; (6) a small map landmark icon of an airliner over an airport control tower; (7) a round CHRISTMAS icon: a "
  "little decorated tree with a gold star; (8) a small map landmark icon of a beach with a casuarina tree and a kite. No text, no "
  "letters, no numbers. " + MAG)

# ── the chapter card, the new ending, the stall scenes
J['chapter-8'] = (L, REF + ['portraits.png', 'faces12a.png', 'chapter-7.png'], STYLE + SG + NEW + CHIN + DORA + ENZO + PANEL + "A "
  "chapter title painting for 'the east coast': Dora and Enzo ride bicycles side by side along a seaside cycling track at night under "
  "casuarina trees, laughing; to one side a row of pastel Peranakan terrace houses with glowing windows, a laksa stall steaming; "
  "beyond, a city road strung with Christmas lights between glass shopping malls; far off on the horizon an airliner climbs with its "
  "lights blinking over an airport and a great glass dome glowing from within. A flock of little fruit bats in red bow ties swoops "
  "across the moon. Leave the top fifth of the image as calm night sky. No text.")
J['end-6'] = (L, REF + ['portraits.png', 'faces12a.png', 'faces12b.png', 'end-5.png'], STYLE + SG + NEW + CHIN + DORA + ENZO + PANEL +
  "The new ending: inside a vast glass dome garden at night, a giant circular INDOOR WATERFALL pours from an opening in the roof into "
  "a pool, glowing purple and blue in a light show; terraced forest all around. Dora and Enzo stand on a stone ledge by the pool in "
  "the middle, holding up a shining golden star together, laughing. Around them: a leopard-cat auntie in a lace kebaya, a mudskipper "
  "uncle in a cycling cap, a crimson sunbird in a green blazer, a stork-billed kingfisher pilot, an old sambar deer bumboat man; at the "
  "side a plump fruit bat in a ruby cape and tiara sulks, wrapped in a net, while little fruit bats in bow ties cheer anyway. Happy, "
  "warm, together. No text.")
J['stall-katong'] = (L, SP + ['stall-market.png', 'faces12a.png'], STYLE + SG + NEW + STALL + "The stall-keeper is Nyonya Rosie, a "
  "LEOPARD CAT auntie in a white lace sarong kebaya with gold brooches (copy her from the attached portrait sheet), behind her counter "
  "in a Peranakan shop. Behind: shelves of pastel porcelain kamcheng jars, beaded slippers, trays of colourful kueh and a steaming "
  "laksa pot, under warm light. No text, signs are blank shapes.")
J['stall-orchard'] = (L, SP + ['stall-bay.png', 'faces12a.png'], STYLE + SG + NEW + STALL + "The stall-keeper is Ms Tiara, a CRIMSON "
  "SUNBIRD in an emerald-green blazer with a headset (copy her from the attached portrait sheet), behind a glossy pop-up counter in a "
  "shopping mall atrium. Behind: a tall Christmas tree of white lights, gift boxes and glass shopfronts glowing. No text, signs are "
  "blank shapes.")
J['stall-changi'] = (L, SP + ['stall-resort.png', 'faces12b.png'], STYLE + SG + NEW + STALL + "The stall-keeper is Pak Ubin, an old "
  "SAMBAR DEER bumboat man in a checked sarong and a straw hat (copy him from the attached portrait sheet), behind a weathered wooden "
  "village shop counter by the sea. Behind: a little jetty with bumboats, coconut palms and an airliner's lights crossing the night "
  "sky. No text, signs are blank shapes.")
