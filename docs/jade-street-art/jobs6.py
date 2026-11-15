# Jade Street, sixth batch of paintings: the island. Chinatown grows into a fictional Singapore island: the HDB
# heartlands (Toa Payoh) with slab and point blocks, void decks, a neighbourhood centre, a kopitiam, a multi-storey car
# park, playgrounds and a wet market; the bay front (Marina Bay) with glass towers, a promenade, a parody resort tower
# trio and a floating stage; expressways, an MRT line (the train, stations, the ride view), taxis, ticket wardens on
# scooters, a new island gang (the Longkang Lizards, monitor lizards), the chapter six cast, new hero poses for the
# trains, taxis and the finale, the chapter card and the new ending. No real brands, no lettering anywhere.
from jobs import STYLE, CHIN, DORA, ENZO, MAG, GRN, VIEW34, TOP, L, SQ, REF, SREF

ISLE = ("The setting is an invented SINGAPORE-style tropical island city at night (no real brands, company names, logos, flags or "
 "famous landmarks copied): public housing estates, hawker food, tropical trees, glass towers by a bay. Never use real brand names, "
 "company names, logos or flags. ")
CAST6 = ("NEW characters, anthropomorphic animals painted exactly in the style, framing and size of the attached portrait sheet. ")
MOODS4 = ("Each ROW is one character shown four times as a head-and-shoulders PORTRAIT facing the viewer, in the same framing, size, "
 "clothes and colours, changing ONLY the facial expression, left to right: (1) CALM, a friendly relaxed look; (2) HAPPY, a big warm open "
 "smile, eyes bright; (3) WORRIED, brows raised and tilted, mouth small and wobbly; (4) CROSS, brows down hard, frowning. Every portrait "
 "is a separate head-and-shoulders bust with plenty of empty background around it. No speech bubbles, no symbols, no text. ")
LIZ = ("the LONGKANG LIZARDS, a gang of cheeky Malayan WATER MONITOR LIZARDS: long olive-brown scaly bodies with pale yellow speckled "
 "bands, long forked pink tongues, long tails, sleepy cheeky eyes, each wearing a small orange-and-teal checked bandana round the neck, "
 "lazy, greedy and silly, never scary. ")
CROW = ("Singapore HOUSE CROWS: glossy jet-black feathers on the wings, back, face and crown, a soft smoky ash-grey hood around the neck "
 "and chest, a stout black beak, cartoon cute and mischievous, never scary")
J = {}

# ── ground: expressway, heartland pavements, the playground mat, the promenade, the boardwalk and the bay
J['ground3'] = (L, SREF + ['ground.png', 'ground2.png'], STYLE + ISLE + "Six separate SQUARE seamless ground TEXTURES for a top-down city "
  "game, matching the attached ground textures exactly in scale and style, seen from directly above, flat, evenly lit at night, no "
  "objects, no lines, no kerbs, no borders: a 3 by 2 grid of six squares that each fill their cell completely, edge to edge, with thin "
  "black gaps between them. Top row: (1) smooth dark charcoal EXPRESSWAY asphalt, finer and darker than a street, with faint cool blue "
  "light sheen; (2) a public housing estate pavement of plain light warm-grey CONCRETE slabs with thin joints and a few leaf shadows; "
  "(3) a soft terracotta-red and leaf-green rubber PLAYGROUND safety mat with a speckled granular surface. Bottom row: (4) a waterfront "
  "PROMENADE of big pale granite paving slabs in cream and dove grey, polished, with warm gold light reflections; (5) a smooth pale "
  "timber BOARDWALK of long narrow deck boards; (6) deep calm BAY water, very dark blue-black with long shimmering gold, teal and pink "
  "reflections of city lights.")

# ── heartland buildings (green screen; the packer stretches each to its footprint)
BLD = ("Each building is seen from a HIGH top-down camera with a gentle 3/4 tilt so we see the flat roof and the front facade at the "
 "bottom, matching the attached building sheets exactly in style, ink outline and night lighting with warm lit windows. Each building "
 "fills its cell, front facing down the image. ")
J['hdb-bld'] = (L, SREF + ['sg-bld.png', 'buildings2.png', 'landmarks2.png'], STYLE + ISLE + "A game sprite sheet of six separate "
  "PUBLIC HOUSING ESTATE buildings for a top-down city game. " + BLD + "A 3 by 2 grid. Row 1: (1) a long SLAB BLOCK of flats, much "
  "WIDER than tall in the picture (about three times as wide as deep): a flat roof with water tanks and a lift motor room, long rows of "
  "lit windows, bamboo laundry poles with colourful clothes, cream walls with teal stripes, an open pillared VOID DECK along the ground "
  "floor; (2) the same kind of long slab block in peach and powder blue with yellow corridor lights, also about three times as wide as "
  "deep; (3) a tall square POINT BLOCK tower of flats seen from above: a square flat roof with a water tank and a little crown frame, "
  "balconies with potted plants on all sides, mint green and white. Row 2: (4) a MULTI-STOREY CAR PARK: an open concrete deck building "
  "with a striped ramp, parked cars visible on its open roof deck, painted lines, a stair tower at one corner; (5) a NEIGHBOURHOOD "
  "CENTRE: a long low row of small shops under a covered walkway, about twice as wide as deep, a bakery glow, a clinic, a provision "
  "shop with sacks, a hair salon, blank coloured signboards; (6) a heartland WET MARKET and food centre: a big square open hall with a "
  "pitched louvred roof, fans, fish and vegetable stalls showing at the open sides. No text anywhere, signs are blank coloured shapes. "
  + GRN)
J['hdb-bld2'] = (L, SREF + ['sg-bld.png', 'hdb-bld.png', 'landmarks2.png'], STYLE + ISLE + "A game sprite sheet of six separate "
  "buildings for a top-down city game. " + BLD + "A 3 by 2 grid. Row 1: (1) a second tall square POINT BLOCK of flats in lilac and "
  "cream with a striped crown on the roof; (2) a corner KOPITIAM coffee shop at the foot of a block: an open ground floor with round "
  "marble tables, folding stools and ceiling fans, a drinks stall counter glowing, about square; (3) an ELEVATED train STATION: a long "
  "concrete station on pillars with a curved silver-and-jade roof over the platforms, staircases down at each end, about twice as wide "
  "as deep. Row 2: (4) a COMMUNITY CLUB: a friendly two-storey civic building with a big covered forecourt, a badminton hall roof and "
  "potted palms, about square; (5) a small round-roofed HAWKER CENTRE pavilion with an open side, rows of tables and stools, lit stalls "
  "at the back; (6) a covered linkway BUS INTERCHANGE shelter with long benches and a zig-zag roof, wider than deep. No text anywhere, "
  "signs are blank coloured shapes. " + GRN)

# ── bay front buildings
J['bay-bld'] = (L, SREF + ['sg-bld.png', 'landmarks2.png', 'buildings2.png'], STYLE + ISLE + "A game sprite sheet of six separate "
  "BAY-FRONT business district buildings for a top-down city game. " + BLD + "A 3 by 2 grid. Row 1: (1) a sleek GLASS TOWER seen from "
  "above: a square roof with a rooftop garden, a tiny helipad circle (no letters) and lit edges, its glass sides reflecting teal and "
  "gold; (2) a second glass tower with a stepped crown and a crown of blue lights, deep blue glass; (3) a curved glass office tower "
  "with a sweeping roof and a jade-green glass skin. Row 2: (4) a parody RESORT of THREE tall hotel towers standing side by side, joined "
  "across the top by one long curved sky deck shaped like a surfboard with a long thin infinity pool and tiny palm trees, much WIDER "
  "than deep, warm gold windows; (5) a FLOATING STAGE: a big flat square performance platform floating on the water, a lit stage "
  "canopy and speakers at the back edge, rows of grandstand steps on the shore side at the bottom; (6) a waterfront THEATRE of two big "
  "rounded domes covered in spiky triangular sunshades, glowing softly gold, about twice as wide as deep. No text anywhere, signs are "
  "blank coloured shapes. " + GRN)
J['bay-bld2'] = (L, SREF + ['bay-bld.png', 'landmarks2.png'], STYLE + ISLE + "A game sprite sheet of six separate bay-front buildings "
  "and big structures for a top-down city game. " + BLD + "A 3 by 2 grid. Row 1: (1) an underground train STATION entrance: a sleek "
  "curved glass canopy over escalators going down, planters either side, about twice as wide as deep; (2) a giant OBSERVATION WHEEL "
  "seen from a high angle, a white ring of glass capsules lit pale blue on a slim stand by the water; (3) a low glass shopping "
  "ARCADE pavilion with a wavy glass roof, about three times as wide as deep. Row 2: (4) a GROVE of four giant metal tree sculptures, "
  "tall trunks of purple steel lattice covered in climbing plants, each topped with a wide glowing canopy of lights, seen from above; "
  "(5) a grand old white colonial-style HOTEL with columns and a red tiled roof, about twice as wide as deep; (6) a slim glass tower "
  "with a slanted roof and a crown of pink light. No text anywhere, signs are blank coloured shapes. " + GRN)

# ── props for both districts, the MRT line and the expressway
PROP = ("A game prop sheet for a top-down city game, every item seen from a HIGH top-down camera with a gentle 3/4 tilt, matching the "
 "attached art in size and style. ")
J['isle-props'] = (SQ, SREF + ['props1.png', 'sg-props.png', 'fines.png'], STYLE + ISLE + PROP + "A 4 by 4 grid of sixteen separate "
  "items, each centred in its own cell. Row 1: (1) a heartland PLAYGROUND shaped like a friendly sitting DRAGON made of terrazzo tiles "
  "with a slide coming out of its mouth and climbing rings in its tail; (2) a round stone void-deck TABLE with four drum stools; (3) a "
  "bank of grey metal LETTERBOXES on a wall stand; (4) a bicycle RACK with three parked bicycles. Row 2: (5) a frame of bamboo LAUNDRY "
  "POLES with colourful hanging clothes; (6) an outdoor EXERCISE corner with a sit-up bench and pedal machine; (7) a BUS STOP shelter "
  "with a bench and a blank route board; (8) a TAXI STAND: a short covered queue rail with a blank teal sign post. Row 3: (9) a small "
  "fruit stall piled with spiky DURIANS under a striped umbrella; (10) a big glazed pot of pink BOUGAINVILLEA; (11) a tall slim "
  "PROMENADE PALM tree; (12) an elegant curved PROMENADE LAMP post with a warm glow. Row 4: (13) a smooth stone PROMENADE BENCH; (14) a "
  "short white concrete EXPRESSWAY crash barrier segment, horizontal; (15) a little orange traffic cone stack with a striped barrier; "
  "(16) a giant shiny SPINNING TOP sculpture on a plinth, playful and original. No text anywhere. " + MAG)
J['isle-props2'] = (SQ, SREF + ['props1.png', 'sg-rides.png', 'tag.png'], STYLE + ISLE + PROP + "A 4 by 4 grid of sixteen separate "
  "items, each centred in its own cell. Row 1: (1) a straight section of ELEVATED TRAIN TRACK seen from DIRECTLY ABOVE running "
  "LEFT-RIGHT across the cell: a grey concrete viaduct deck with two silver rails and sleepers, side walls, much wider than tall; (2) a "
  "round concrete PILLAR top for the viaduct; (3) an MRT platform SCREEN DOOR panel row seen from above, glass and jade frames; (4) a "
  "fare GATE: a pair of grey ticket gates with jade flaps. Row 2: (5) a STORM DRAIN hideout: an open concrete canal drain mouth with a "
  "tunnel arch, a lizard-sized sofa made of old cushions and fairy lights inside; (6) an OTTER HOLT hideout: a pile of boulders on a "
  "breakwater with a cosy den opening, sea shells and a little striped flag; (7) a MACAQUE hideout: a big rain tree with a tree-house "
  "platform made of planks and a stolen umbrella roof; (8) a CROW hideout: a rooftop nest built of coat hangers, shiny trinkets and a "
  "satellite dish. Row 3: (9) a heap of stolen glittering CONCERT LIGHTS in a crate; (10) a ROLLED red event CARPET; (11) a small "
  "golden STATUETTE of a chinchilla holding a lantern (a prize trophy); (12) a wooden WATER TAXI jetty sign post, blank. Row 4: (13) a "
  "glowing MRT station entrance PILLAR marker with a blank round sign; (14) a lizard EGG basket of stolen golden eggs (mooncakes); (15) "
  "a bunch of event BALLOONS tied to a weight; (16) a tall stack of plastic STOOLS. No text anywhere. " + MAG)

# ── vehicles: the train, taxis, the ticket warden on a scooter and the lizards' trolley
J['isle-rides'] = (L, SREF + ['vehicles.png', 'traffic.png', 'sg-rides.png'], STYLE + ISLE + TOP + "A game sprite sheet of vehicles "
  "for a top-down city game, matching the attached vehicle sheets exactly in scale and view. A 4 by 2 grid of eight separate items, "
  "each centred in its own cell, every one pointing straight UP. Row 1: (1) the FRONT CAR of a sleek driverless metro TRAIN seen from "
  "directly above: a long silver-white roof with a rounded jade-green nose at the top, roof vents, a jade stripe down the sides, much "
  "taller than wide; (2) a MIDDLE CAR of the same train, the same width, flat ends, roof vents, much taller than wide; (3) a TAXI car: a "
  "rounded teal saloon with a white roof light box (blank), cream bumpers; (4) a second TAXI: a cheerful lemon-yellow saloon with a "
  "white roof light box. Row 2: (5) a portly RACCOON ticket warden in a navy uniform and white helmet riding a little navy-and-white "
  "patrol SCOOTER, seen from above; (6) the same warden scooter, front wheel turned and a ticket pad in one paw; (7) a cheeky MONITOR "
  "LIZARD in an orange-and-teal checked bandana riding a rattling metal SHOPPING TROLLEY loaded with stolen snacks, tail streaming; (8) "
  "the same lizard trolley, wheels turned the other way. No text anywhere. " + MAG)

# ── the new gang
J['lizards'] = (L, SREF + ['otters.png', 'macaques.png'], STYLE + ISLE + "The rivals: " + LIZ + "A game sprite sheet of one monitor "
  "lizard of the gang, matching the attached rival sheets exactly in size and style. " + VIEW34 + "A 4 by 3 grid of twelve poses, each "
  "alone in its cell. Top row: (1) waddle-walking toward the camera, left foot forward, tongue flicking; (2) the same, right foot "
  "forward; (3) walking away seen from behind, long tail swinging; (4) the same, other foot. Middle row: (5) SCURRYING to the RIGHT in "
  "profile, low to the ground, carrying a bag of snacks in its mouth; (6) the same, legs stretched; (7) SWIMMING seen from DIRECTLY "
  "ABOVE in dark water, head up, tail waving, pointing UP the image; (8) a lazy LEPAK pose: lying flat on its belly sunbathing, eyes "
  "half shut, very content. Bottom row: (9) a cheeky TAUNT standing up on its hind legs, tongue out; (10) DIZZY, sitting, little stars "
  "circling; (11) SLIPPING on a soap puddle, legs splayed, comic; (12) TANGLED in a brown rope net, grinning sheepishly. " + MAG)

# ── the chapter six cast
J['isle-faces'] = (SQ, ['portraits.png', 'expr1.png', 'sg-faces1.png'], STYLE + ISLE + "Four " + CAST6 + "A sheet of sixteen character "
  "portraits in a 4 by 4 grid. " + MOODS4 + "Row 1: MR KAMAL, a fluffy round COLUGO (flying lemur) train station master with huge dark "
  "eyes, mottled grey-brown fur, a neat navy station uniform jacket and a peaked cap with a jade band, a whistle on a cord. Row 2: MS "
  "VANDA, a glamorous RHINOCEROS HORNBILL events producer with a big orange-and-yellow casque, glossy black feathers, a white silk "
  "scarf and a headset microphone. Row 3: LORD LEPAK, the boss of a gang of WATER MONITOR LIZARDS: a big lazy lizard with sleepy "
  "half-shut eyes, an orange-and-teal checked bandana, gold sunglasses pushed up on his head and a bottle-cap medal. Row 4: DIRECTOR "
  "KAW, an ambitious " + CROW + ", in a sharp slate-grey business suit with a purple tie and a gold lapel pin, slicked crown feathers. "
  + MAG)

J['folk5'] = (L, ['folk1.png', 'folk4.png', 'play.png'], STYLE + ISLE + "A game sprite sheet of three NEW cute anthropomorphic animal "
  "townsfolk pedestrians, matching the attached townsfolk sheets exactly in size, style and layout. " + VIEW34 + "A 5 by 3 grid of "
  "fifteen frames; each ROW is one character, left to right: (1) walking TOWARD the camera; (2) walking AWAY from the camera (seen from "
  "behind); (3) walking to the RIGHT in profile, left foot forward; (4) walking to the RIGHT in profile, right foot forward; (5) a "
  "startled little JUMP with both arms up. Row 1: a MALAYAN TAPIR auntie in a flowery blouse pulling a little tartan shopping trolley "
  "bag. Row 2: a slim MOUSEDEER office worker in a pale blue shirt, dark trousers and a lanyard with a blank card. Row 3: a young PALM "
  "CIVET student in a white school shirt, navy shorts and a backpack. " + MAG)

J['isle-npc'] = (L, ['folk1.png', 'sg-npc.png', 'isle-faces.png', 'play.png'], STYLE + ISLE + "A game sprite sheet of characters doing "
  "things, cute anthropomorphic animals matching the attached townsfolk sheet exactly in size and style, the four new characters copied "
  "from the attached portrait sheet. " + VIEW34 + "A 4 by 3 grid of twelve separate items, each alone in its cell. Top row: (1) MR KAMAL "
  "the colugo station master standing, paws behind his back; (2) Mr Kamal waving a small green flag and blowing his whistle; (3) MS "
  "VANDA the hornbill producer holding a clipboard, talking into her headset; (4) Ms Vanda pointing ahead with a wing, excited. Middle "
  "row: (5) LORD LEPAK the monitor lizard boss lounging on a striped deck chair, sunglasses on; (6) Lord Lepak standing up cross, tail "
  "lashing; (7) DIRECTOR KAW the crow in a grey suit holding a briefcase, smug; (8) Director Kaw flapping off with a sack of loot, "
  "cackling. Bottom row: (9) two noisy MYNAH birds squabbling over a chip; (10) a cheeky little striped WILD BOAR piglet trotting; (11) "
  "a crowd of three townsfolk cheering with glow sticks; (12) a crow in a purple windbreaker holding a blank clipboard like a salesman. "
  + MAG)

# ── new hero poses: trains, taxis, the playground and the finale
def act9(who, desc):
    return (L, REF + [f'{who}-act.png', f'{who}-act7.png'], STYLE + ISLE + CHIN + desc + f"A game sprite sheet of {who.title()} only, "
      "matching the attached sprite sheets of the same character exactly (same proportions, same outfit, same scale). " + VIEW34 +
      "A 4 by 3 grid of twelve separate poses of ONE character, each alone in its cell. Top row: (1) HAILING a taxi facing the camera: one "
      "arm stretched high, waving, on tiptoe; (2) hailing a taxi to the RIGHT in profile, arm out sideways, other paw on hip; (3) TAPPING "
      "a small blank card on a reader to the RIGHT in profile, leaning in; (4) standing in a train holding an overhead grab POLE with one "
      "paw facing the camera, swaying a little. Middle row: (5) the same pole pose swaying the other way, ears flopping; (6) SITTING on a "
      "train bench seat facing the camera, feet dangling, happy; (7) looking at a small blank PHONE in both paws facing the camera, "
      "tapping it with a thumb; (8) whooshing down a playground SLIDE seen facing the camera, arms up, ears flying. Bottom row: (9) "
      "POINTING ahead to the RIGHT in profile, determined; (10) DANCING facing the camera, one arm up, one leg kicked, joyful; (11) "
      "dancing, the other arm up and other leg kicked; (12) out of breath, PANTING with paws on knees facing the camera, tongue out, "
      "sweaty and proud. " + MAG)
J['dora-act9'] = act9('dora', DORA)
J['enzo-act9'] = act9('enzo', ENZO)

# ── the interface: the taxi app, MRT, map icons and pins
J['isle-ui'] = (L, SREF + ['icons.png', 'ui2.png'], STYLE + ISLE + "A game UI icon sheet painted like enamel shop signs and lacquered "
  "wood with gold trim, matching the attached icons in style, chunky and readable at small size. A 4 by 2 grid of eight separate "
  "items. Row 1: (1) a phone APP icon: a rounded jade square with a cute cartoon teal taxi with a little smile; (2) a round MRT icon: a "
  "jade-and-silver train front in a gold ring; (3) a map PIN shaped like a teardrop with a little train inside; (4) a map PIN shaped "
  "like a teardrop with a little taxi inside. Row 2: (5) a map PIN shaped like a teardrop with a cheeky monitor lizard face inside; "
  "(6) a small map landmark icon of three hotel towers joined by a sky deck; (7) a small map landmark icon of a public housing slab "
  "block with laundry poles; (8) a small map landmark icon of a giant observation wheel. No text, no letters, no numbers. " + MAG)

PANEL = ("A full-bleed storybook illustration panel for the game's story, painted edge to edge (no border, no frame, no panel gutters), "
 "cinematic high 3/4 camera, rich night light. ")
J['chapter-6'] = (L, REF + ['portraits.png', 'isle-faces.png', 'chapter-5-crow.png'], STYLE + ISLE + CHIN + DORA + ENZO + PANEL +
  "A chapter title painting for 'the island': Dora and Enzo stand on an elevated train platform at night looking out over the whole "
  "invented island city spread below: public housing slab blocks with lit windows on the left, glass towers and a resort of three towers "
  "joined by a sky deck by a glowing bay on the right, a lit expressway curving between them, a jade-and-silver train gliding in. A "
  "flock of " + CROW + " in purple windbreakers flies off toward the towers led by one crow in a grey business suit. Leave the top "
  "fifth of the image as calm night sky (space for a title added later). No text.")
J['end-4'] = (L, REF + ['portraits.png', 'isle-faces.png', 'end-3-crow.png'], STYLE + ISLE + CHIN + DORA + ENZO + PANEL + "The new "
  "ending: a joyful night show on a FLOATING STAGE on a glowing bay, fireworks bursting over glass towers and a resort of three towers "
  "joined by a sky deck. Dora and Enzo dance in the middle of the stage under spotlights. Around them cheer the friends they made: a "
  "colugo station master in a navy uniform, a hornbill producer with a headset, a family of otters in striped neckerchiefs, macaque "
  "monkeys in lime-green vests and monitor lizards in checked bandanas all dancing together; a sheepish house crow in a grey suit "
  "sits in a little rowing boat in the foreground holding a mop. Happy, triumphant, warm. No text.")
J['mrt-ride'] = (L, REF + ['play.png'], STYLE + ISLE + CHIN + DORA + ENZO + PANEL + "Inside a clean modern driverless metro TRAIN "
  "carriage at night, seen from inside looking along the car: long jade-green bench seats on both sides, silver grab poles and "
  "hanging handles, a big window on the left showing the night city blurred with speed (public housing blocks with lit windows and "
  "tropical trees), soft white ceiling light. Dora holds a grab pole, grinning, and Enzo sits on the bench swinging his feet. A few "
  "sleepy animal commuters: a mousedeer office worker dozing, a tapir auntie with a shopping trolley. Calm, cosy, fun. No text, no "
  "signs, no route maps.")

# ── the two new markets' stall scenes (the trade panel's painting), in the same framing as the first five
from jobs2 import STALL, SP, CAST
J['stall-heartland'] = (L, SP + ['stall-market.png', 'isle-faces.png'], STYLE + ISLE + CAST + STALL + "The stall-keeper is Mr Kamal, a "
  "fluffy round COLUGO (flying lemur) with huge dark eyes and mottled grey-brown fur, in a neat navy station-master jacket, minding his "
  "sister's provision shop at the void deck of a public housing block (copy him from the attached portrait sheet). Behind: the open void "
  "deck with pillars, letterboxes, a round stone table, bicycles and the lit windows of the flats above. No text, signs are blank shapes.")
J['stall-bay'] = (L, SP + ['stall-arcade.png', 'isle-faces.png'], STYLE + ISLE + CAST + STALL + "The stall-keeper is Ms Vanda, a "
  "glamorous RHINOCEROS HORNBILL with a big orange-and-yellow casque, a white silk scarf and a headset microphone (copy her from the "
  "attached portrait sheet), behind a sleek polished marble kiosk counter on a waterfront promenade. Behind: a glowing bay at night with "
  "glass towers, a resort of three towers joined by a sky deck and gold reflections in the water. No text, signs are blank shapes.")
