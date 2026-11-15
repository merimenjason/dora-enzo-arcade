# Jade Street, the empire batch of paintings (the tenth pass): fifteen new properties at four levels each (for sale,
# then three upgrades), the damage and repair dressing and the empire's props, the raiding gangs carrying off the
# till and smashing up a shop, Pak Duri the jaga (night watchman), the four new people (portraits in four moods and
# full bodies in the world), the heroes' empire poses (repairing, a handshake, sending the partner off, the coin bag,
# counting the takings), the empire's map pins and icons, the four rank badges, and the Empire tab's painted banner.
# Job ids all start with "emp-" (or are the heroes' act13 sheets and cast10) so they never collide with another
# pass's sheets. No lettering anywhere: signs, boards, badges and the ledger are blank painted shapes.
from jobs import STYLE, CHIN, DORA, ENZO, MAG, GRN, VIEW34, L, SQ, REF, SREF
from jobs6 import ISLE, CROW, MOODS4, CAST6, LIZ
from jobs7 import POSES, BODY

EMP = ("This batch is about the heroes' growing business empire across a fictional Singapore-style island: shophouses, hawker "
  "stalls, a kopitiam, a karaoke lounge, a bumboat service, a taxi company, bars and shops. Warm, cosy and cheerful; nothing scary. ")
GROWP = ("A game prop sheet of BUSINESSES for a top-down city game, every one seen from a HIGH top-down camera with a gentle 3/4 tilt, "
  "matching the attached business sheets EXACTLY in size, framing and style (each business about as big as one of theirs, a "
  "small shop front or kiosk, never a whole building). A 4 by 3 grid. Each ROW is ONE business shown four times, left to right, "
  "growing as it is upgraded, keeping the same base shape and colours so it is clearly the same place: (1) SHUTTERED and for sale: "
  "dusty, metal roller shutter or wooden shutters down, a blank plaque, a few dry leaves; (2) LEVEL 1, freshly opened: modest and "
  "clean, a few goods out, one warm lamp; (3) LEVEL 2: a bigger striped awning, more goods, a string of lanterns, a stool or bench "
  "for customers; (4) LEVEL 3, grand: gold trim, glowing lamps everywhere, potted plants, a little red carpet, busy-looking. Nobody "
  "standing at any of them. No text on any sign, plaque, board or banner: signs are blank coloured shapes. ")
def props(rows):
    return (L, SREF + ['biz1.png', 'biz3.png', 'sg-bld.png'], STYLE + ISLE + EMP + GROWP + rows + MAG)

J = {}
J['emp-props1'] = props("Row 1: a SHOPHOUSE FRONT on Pagoda Street: one bay of a pastel two-storey shophouse front (mint green with "
  "white plaster trim and louvred upper shutters) with a five-foot-way arch below and a souvenir counter. Row 2: a ZI CHAR KITCHEN "
  "by the harbour: an open-fronted seafood kitchen with a roaring wok burner, tanks of crabs and folding round tables. Row 3: a "
  "BUMBOAT SERVICE kiosk on a river jetty: a little wooden ticket hut on stilts with a striped canopy, life rings and a moored "
  "brightly painted wooden bumboat beside it. ")
J['emp-props2'] = props("Row 1: a KARAOKE LOUNGE on the riverside: a neon-trimmed purple and pink lounge front with a little stage "
  "window, a disco ball inside and velvet rope posts. Row 2: a heartland KOPITIAM corner: an open-air coffee shop corner with marble-top "
  "tables, wooden stools, a drinks counter with big kettles and ceiling fans above. Row 3: a TAXI COMPANY depot: a small booking "
  "office kiosk with a canopy, a row of blue-and-white taxi roof lights on a rack and a little parked taxi (a car with no markings). ")
J['emp-props3'] = props("Row 1: a VOID DECK PROVISION SHOP: a tiny old-style mama shop counter under an HDB block's pillars, with "
  "sweet jars, hanging snack packets, cooler box and newspapers. Row 2: a ROOFTOP BAR seen as its little bayside bar kiosk: a sleek "
  "glass-and-teak counter with high stools, a fairy-light canopy and potted palms. Row 3: an ICE KACANG CART: a little push cart "
  "with a hand-cranked ice shaver, bright red, green and yellow syrup bottles and a parasol. ")
J['emp-props4'] = props("Row 1: a PRATA SHOP in Little India: a narrow terracotta-tiled shop front with a flat griddle, stacks of "
  "golden prata and a tea counter. Row 2: a SPICE SHOPHOUSE: a deep ochre and turquoise shophouse front with sacks and pyramids of "
  "bright spices (turmeric yellow, chilli red, green cardamom) and brass scoops. Row 3: a HAJI LANE CAFE: a tiny cafe with a "
  "colourful mural-painted wall (abstract shapes only), a striped awning, bistro chairs and potted plants. ")
J['emp-props5'] = props("Row 1: a TEXTILE HOUSE on Arab Street: a cream shophouse front with arched windows and bolts of jewel-coloured "
  "batik and songket cloth draped outside. Row 2: a BEACH BAR on the sand: a thatched-roof bamboo beach bar with coconut drinks, "
  "surfboards leaning on it and a string of shell lights. Row 3: a KAYAK HIRE hut on a lagoon jetty: a small wooden hut with stacked "
  "colourful kayaks, paddles in a rack and life jackets on hooks. ")
J['emp-dmg'] = (L, SREF + ['biz1.png', 'props1.png', 'fines.png'], STYLE + ISLE + EMP + "A game prop sheet for a top-down city game, "
  "every item seen from a HIGH top-down camera with a gentle 3/4 tilt, matching the attached prop sheets exactly in scale, ink outline "
  "and cel shading. A 4 by 3 grid of twelve separate items, each alone in its cell. Row 1: (1) RAID DAMAGE dressing to lay over a shop "
  "front: two crossed boarded-up planks with nails and a torn awning flap hanging down; (2) a heap of knocked-over crates, spilled "
  "fruit and a cracked lantern on the ground; (3) a smashed little shop sign lying broken in two (blank, no writing) with scattered "
  "black feathers and muddy paw prints; (4) BAMBOO REPAIR SCAFFOLDING: a small square frame of lashed bamboo poles with a plank and a "
  "paint pot on it. Row 2: (5) a blank wooden A-frame FOR-SALE board with a big gold coin painted on it; (6) a jaga's (night "
  "watchman's) folding stool with a thermos flask and a torch beside it; (7) a thick red cloth-bound LEDGER book lying open with blank "
  "columns and a brass abacus beside it; (8) a small metal CASH BOX with its lid open and gold coins inside. Row 3: (9) a fat cloth "
  "COIN BAG tied with red string, coins spilling out; (10) a green ROSETTE ribbon award (a clean-shop award, no writing); (11) a pile "
  "of honest blank price boards tied with string; (12) a little pile of fake bright-yellow sale boards torn in half. " + MAG)
RAIDROW = ("Each ROW is one gang member raiding a shop, four poses left to right: (1) RUNNING to the RIGHT in profile hugging a small "
  "metal CASH BOX, coins flying out, cheeky grin; (2) the same run, the other leg forward, more coins spilling; (3) KICKING over a crate "
  "of a shop display, facing the camera, gleeful; (4) TAUNTING, holding up a gold coin and sticking its tongue out. ")
J['emp-raid1'] = (L, SREF + ['magpies-crow.png', 'macaques.png', 'otters.png'], STYLE + ISLE + "The raiding rival gangs, matching the "
  "attached rival sprite sheets EXACTLY in size, species, clothes and style. " + VIEW34 + "A 4 by 3 grid of twelve poses, each alone in "
  "its cell. " + RAIDROW + "Row 1: a KAYPOH CROW (" + CROW + "). Row 2: a BUKIT BUNCH MACAQUE (a long-tailed macaque in the gang's "
  "outfit from the attached macaque sheet). Row 3: a RIVERSIDE ROMP OTTER (a smooth-coated otter in the gang's outfit from the "
  "attached otter sheet). " + MAG)
DURI = ("PAK DURI, an elderly, kindly MALAYAN PORCUPINE night watchman (a jaga) with a crest of long black-and-white quills, a round "
  "nose and grey whiskers, wearing a faded navy security guard shirt with blank patches (no writing), khaki trousers, a navy peaked "
  "cap and a silver whistle on a cord, ")
J['emp-raid2'] = (L, SREF + ['lizards.png', 'magpies-crow.png', 'folk1.png'], STYLE + ISLE + "The raiding rival gangs and a night "
  "watchman, matching the attached sprite sheets EXACTLY in size and style. " + VIEW34 + "A 4 by 3 grid of twelve poses, each alone in "
  "its cell. Rows 1 and 2: " + RAIDROW + "Row 1: a LONGKANG LIZARD (" + LIZ + "). Row 2: a KECOH MYNAH, a cheeky JAVAN MYNAH bird: "
  "glossy jet-black feathers with a little spiky tuft on the forehead, a bright yellow beak and yellow legs, a white wing patch, a "
  "small mustard-yellow neck scarf with red polka dots. Row 3: " + DURI + "four poses left to right: (9) WALKING his beat to the RIGHT "
  "in profile, torch in paw; (10) the same, the other foot forward; (11) ALERT, facing the camera, blowing his whistle hard, quills "
  "standing up; (12) SHOOING, facing right, flapping his cap at a pest, quills bristling. " + MAG)
J['emp-faces'] = (SQ, ['portraits.png', 'isle-faces.png', 'sg-faces1.png'], STYLE + ISLE + EMP + "Four " + CAST6 + "A sheet of "
  "sixteen character portraits in a 4 by 4 grid. " + MOODS4 + "Row 1: AH HUAT, a burly cheerful WILD BOAR wholesale supplier with "
  "bristly brown fur, small tusks, a sweat towel round his neck, a grey singlet and a canvas apron. Row 2: INSPECTOR SIEW, a tall neat "
  "MILKY STORK health inspector with white feathers, a long pale-yellow beak, small round glasses, a crisp pale-blue uniform shirt "
  "with blank badges and a clipboard held to her chest. Row 3: TOWKAY HOOT, a smug portly BUFFY FISH OWL rival businessman with tufty "
  "ear feathers, huge yellow eyes, a loud gold-and-green batik shirt and a gold chain. Row 4: " + DURI + "head and shoulders. " + MAG)
J['cast10'] = ('landscape 1536x1024', ['emp-ref.png', 'folk1.png', 'sg-npc.png', 'play.png'], STYLE + ISLE + EMP + "A game sprite "
  "sheet of four characters for a top-down city game, the characters in the attached portrait strip (left to right = rows 1 to 4). "
  + BODY + POSES + "Row 1: AH HUAT, a burly WILD BOAR supplier in a grey singlet, canvas apron and a towel round his neck. Row 2: "
  "INSPECTOR SIEW, a tall MILKY STORK health inspector in a pale-blue uniform shirt with round glasses. Row 3: TOWKAY HOOT, a portly "
  "BUFFY FISH OWL in a gold-and-green batik shirt and a gold chain. Row 4: PAK DURI, an elderly MALAYAN PORCUPINE night watchman in a "
  "navy guard shirt, khaki trousers and a peaked cap. " + MAG)
def act13(who, desc):
    return (L, REF + [f'{who}-act.png', f'{who}-act11.png'], STYLE + ISLE + CHIN + desc + f"A game sprite sheet of {who.title()} only, "
      "matching the attached sprite sheets of the same character exactly (same proportions, same outfit, same scale). " + VIEW34 +
      "A 4 by 2 grid of eight separate poses of ONE character, each alone in its cell. Top row: (1) REPAIRING, facing the camera, "
      "swinging a small wooden mallet down at a plank held in the other paw, tongue out in concentration; (2) the same, mallet raised "
      "high; (3) a firm friendly HANDSHAKE, in profile facing RIGHT, one paw held out to shake, smiling; (4) SENDING someone off, facing "
      "the camera, one arm pointing far off to the side, the other paw cupped by the mouth calling. Bottom row: (5) holding out a fat "
      "cloth COIN BAG tied with red string in both paws toward the camera, proud; (6) the same, the bag held up high over the head, "
      "cheering; (7) COUNTING coins, facing the camera, holding a small stack of gold coins in one paw and flicking one up with the "
      "other, eyes on the coins; (8) the same, hugging an open red ledger book to the chest, grinning. " + MAG)
J['dora-act13'] = act13('dora', DORA)
J['enzo-act13'] = act13('enzo', ENZO)
J['emp-ui'] = (L, SREF + ['icons.png', 'isle-ui.png', 'ui9.png'], STYLE + ISLE + "A game UI icon sheet painted like enamel shop "
  "signs and lacquered wood with gold trim, matching the attached icons in style, chunky and readable at small size. A 4 by 3 grid of "
  "twelve separate items. Row 1: (1) a map PIN shaped like a teardrop with a little SHOP FRONT with a gold coin inside (a property for "
  "sale); (2) a map PIN shaped like a teardrop with a little shop front with a red lantern and a jade roof inside (a property you "
  "own); (3) a map PIN shaped like a teardrop, glowing red, with a little cracked cash box and a crow footprint inside (a raid!); (4) a "
  "round EMPIRE icon: a little row of three shophouses under a gold crown in a gold ring. Row 2: (5) a round LEDGER icon: an open red "
  "ledger book with a brass abacus; (6) a round REPAIR icon: a wooden mallet crossed with a bamboo pole; (7) a round JAGA icon: a navy "
  "peaked cap with a silver whistle; (8) a round icon of a fat cloth COIN BAG with a little running chinchilla paw print (the partner's "
  "round of the tills). Row 3: four RANK BADGES, round enamel medallions with a ribbon, each grander than the last, all without any "
  "writing: (9) a plain bronze medallion with a little wooden hawker stall on it; (10) a silver medallion with a steaming kopi cup on it "
  "and a jade ribbon; (11) a gold medallion with a two-storey shophouse front on it and a red ribbon; (12) a big ornate jade-and-gold "
  "medallion with a little island skyline (shophouses, a pagoda roof and a palm) under a crown, with a gold-tasselled red ribbon. " + MAG)
J['empire'] = (L, SREF + ['stall-market.png'], STYLE + ISLE + EMP + "A full-bleed painted scene (no magenta, no border) for the "
  "banner of a game's business screen: at night, looking along a row of colourful two-storey shophouses and hawker stalls, all lit up "
  "and busy, red lanterns strung overhead, and in the foreground a wooden shop counter with an open red ledger book (blank columns), a "
  "brass abacus, a cash box and stacks of gold coins under a warm lamp. Nobody in the scene. No text anywhere.")
