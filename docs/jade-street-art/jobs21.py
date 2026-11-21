# Jade Street, the twenty-first pass's paintings: the Southern Islands, south of Marina Bay, and chapter thirteen. The
# ground (the exposed reef flats, the shallow turquoise shoals, white coral-sand beach, the islands' grassy paths), the
# islands' buildings (St John's marine lab, the Kusu temple, the hilltop keramat, the bungalow safe house, the lighthouse
# keeper's cottage, the jetty shelter) and Raffles Lighthouse on its own sheet, a prop sheet, the reef's creatures and
# Kusu's tortoises, Kapitan Umang's hermit-crab deckhands, four new portraits in four moods then their full bodies, the
# heroes' new actions (wading the reef, bracing on a rock as the tide runs in, washed back, peering into a rock pool,
# feeding a tortoise, floating in the lagoon, looking out from the lighthouse gallery), map icons, the three island
# properties' stands, the market panel and the chapter card. The game uses real Singapore names in its TEXT, but the
# paintings keep the no-lettering rule: no text, letters, numbers, logos or flags anywhere.
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
ISL = ("This part of the world is SINGAPORE'S SOUTHERN ISLANDS on a warm clear NIGHT with a big full moon: small tropical islands in "
 "a calm turquoise sea south of the city, with the city's lights glowing on the far horizon. ST JOHN'S ISLAND with old white "
 "colonial bungalows under rain trees and a jetty; LAZARUS ISLAND's quiet crescent LAGOON BEACH of pale sand with coconut palms; "
 "KUSU ISLAND with its small colourful Chinese temple, a pond of basking TORTOISES and, up a flight of steps on a little wooded "
 "hill, a small yellow hilltop shrine; the SISTERS' ISLANDS marine park with exposed REEF FLATS at low tide, rock pools full of "
 "sea stars and anemones; and far out on its own tiny rocky island, PULAU SATUMU, the tall white RAFFLES LIGHTHOUSE sweeping its "
 "beam across the water. Moonlit silver-blue night, warm lamp light, glowing jade-green shallows; cosy and magical, never spooky. ")
PROP = ("Each object is seen from a HIGH top-down game camera with a gentle 3/4 tilt, matching the attached prop sheets exactly in "
 "scale, ink outline, cel shading and warm night lighting. ")
BLD = ("Each building is seen from a HIGH top-down camera with a gentle 3/4 tilt at the SAME angle as the attached building sheets, so we "
 "look DOWN onto its whole ROOF (the roof takes up the top two thirds of each building) and see only a short strip of the front "
 "facade at the bottom. NOT a flat front elevation. No ground plate, no plaza and no pavement under or around a building: each "
 "building's outline is just its own roof, walls and steps. Each building alone in its cell with space around it. ")
CAMAR = ("PAK CAMAR, the kindly weather-beaten old keeper of Raffles Lighthouse, a BLACK-NAPED TERN: sleek pale silver-white "
 "feathers, a neat black band across the back of the head, a slim sharp black beak, bright dark eyes, wearing a dark navy "
 "lighthouse keeper's oilskin coat with brass buttons, a peaked keeper's cap and round wire spectacles, a big brass key on a cord")
LUMBA = ("KAK LUMBA, a bubbly sporty young marine-park guide, an INDO-PACIFIC HUMPBACK DOLPHIN standing upright on two short feet: "
 "smooth PINK-and-pale-grey skin, a long gentle smiling beak, a little dorsal fin on her back, flippers for hands, wearing a teal "
 "rash-guard shirt, a whistle on a cord, a dive mask pushed up on her head and a waterproof clipboard")
KU = ("AUNTIE KU, a tiny wise cheerful old TORTOISE who looks after the tortoises of Kusu Island: a high domed brown-and-amber "
 "patterned shell, a wrinkly kind face, small bright eyes, wearing a loose cream cotton blouse with a floral sarong, a woven "
 "straw basket of leafy greens on her arm and a little jade bangle")
UMANG = ("KAPITAN UMANG, the blustering vain boss of a hermit-crab deck crew for hire: a big red-orange HERMIT CRAB with one huge "
 "claw and one small one, black eyes on tall stalks, living in a grand pearly spiral CONCH SHELL he wears like a cloak, plus a "
 "battered gold-braided sea captain's coat and a tricorn-like captain's hat; pompous, never scary")
REEF = (" For the reef and the beach this character's trouser legs or shorts are rolled up and it wears small dark rubber REEF SHOES; "
 "otherwise exactly the same outfit as the attached sheets. ")
J = {}

# ── the ground: four seamless textures
J['ground21'] = (L, SREF + ['ground19.png', 'ground18.png'], STYLE + SG + ISL + "Four separate SQUARE seamless ground TEXTURES for a "
  "top-down game, matching the attached ground textures exactly in scale and style, seen from directly above, flat, evenly lit at "
  "night, no objects, no lines, no borders: a 2 by 2 grid of four squares that each fill their cell completely, edge to edge, with thin "
  "black gaps between them. Every texture must be CALM and LOW CONTRAST so characters drawn on top stay easy to read: no big motifs, "
  "no strong outlines. Top row: (1) an exposed REEF FLAT at low tide seen from above: wet sand-coloured coral rubble and flat rock "
  "with a thin film of water, a few tiny pale seaweed tufts, glistening in moonlight; (2) clear SHALLOW SEA over white sand at night: "
  "glowing turquoise-jade water with faint soft ripples, no reflections of objects. Bottom row: (3) pale COCONUT-WHITE CORAL SAND "
  "beach, fine and even with faint ripples; (4) an island FOOTPATH of sandy earth and short grass, soft and even.")

# ── buildings (green screen; the packer stretches each to its footprint)
J['islands-bld'] = (L, SREF + ['mandai-bld.png', 'kallang-bld.png', 'ubin-bld2.png'], STYLE + SG + ISL + "A game sprite sheet of six "
  "separate SOUTHERN ISLANDS buildings for a top-down game. " + BLD + "A 3 by 2 grid. Row 1: (1) the ST JOHN'S ISLAND MARINE "
  "LABORATORY: a long low white building with a pale blue tin roof, big round sea-water tanks beside it and a little blue-lit "
  "aquarium window, about twice as wide as deep; (2) the KUSU ISLAND temple: a small Chinese island temple with curved orange-and-"
  "green glazed tiled roofs, upswept eaves, red pillars, lanterns glowing and a stone incense urn in front, about one and a half "
  "times as wide as deep; (3) a small HILLTOP SHRINE painted bright yellow with a little dome, under frangipani trees at the top of a "
  "short flight of stone steps, about as wide as deep. Row 2: (4) a cosy little SAFE HOUSE where two young chinchilla heroes hide "
  "out: an old white colonial HOLIDAY BUNGALOW on short stilts with jade-green shutters and a red tiled roof, a lamp by the door and a "
  "single paw-print shape on the door, about one and a half times as wide as deep; (5) the LIGHTHOUSE KEEPER'S COTTAGE: a small "
  "whitewashed cottage with a red roof and a rain-water tank, about one and a half times as wide as deep; (6) a FERRY JETTY "
  "SHELTER: an open-sided white shelter with a curved roof over benches, about twice as wide as deep. " + GRN)
J['islands-light'] = (L, SREF + ['sg-bld.png', 'mandai-aviary.png'],
  STYLE + SG + ISL + "ONE building alone in the middle of the image for a top-down game: RAFFLES LIGHTHOUSE on Pulau Satumu, "
  "seen from a HIGH top-down camera with a gentle 3/4 tilt at the SAME angle as the attached building sheets, so we look DOWN onto "
  "it: a tall slender round WHITE stone lighthouse tower with a black iron gallery rail round its top and a glass LANTERN ROOM with "
  "a domed black cap, the lamp glowing warm gold inside, a soft beam of light starting out to one side; at its foot a ring of grey "
  "granite rocks. The tower is about one and a half times as tall as it is wide in the picture. No ground plate, no plaza round it. "
  + GRN)

# ── props
J['props21'] = (SQ, SREF + ['props1.png', 'props19.png', 'props18.png'], STYLE + SG + ISL + PROP + "A 4 by 4 grid of sixteen "
  "separate items, each centred in its own cell. Row 1 (the sea): (1) an ISLAND FERRY seen from DIRECTLY ABOVE pointing straight UP "
  "the image: a white-and-blue passenger ferry boat with a covered upper deck and rows of seats, a lamp at the bow; (2) a timber "
  "jetty BOLLARD with a coil of rope; (3) a red-and-white striped marker BUOY bobbing; (4) a CORAL HEAD: a raised dome of rounded "
  "brain coral and dark rock sticking up out of shallow water, flat-topped like a stepping stone. Row 2 (the reef): (5) a ROCK POOL "
  "seen from above: a little round pool of clear water in dark rock with a sea star and an anemone in it; (6) a stone TORTOISE "
  "STATUE on a low plinth in a lily pond; (7) a big old glowing LIGHTHOUSE LENS (a beehive of glass rings) with warm light inside; "
  "(8) a leather-bound old KEEPER'S LOGBOOK, open, its pages yellowed, with a fountain pen. Row 3 (the mystery): (9) a wooden "
  "CRATE tied with rope with a single black feather tucked under the rope; (10) a wooden crate brimming with SEA SHELLS; (11) a "
  "hermit crabs' CAMP: a little driftwood lean-to with a patched sail for a roof and a lantern; (12) a fresh green young COCONUT "
  "with a paper straw. Row 4: (13) a COCONUT PALM seen from above, its fronds spread; (14) a striped BEACH UMBRELLA over a "
  "deck chair, from above; (15) a SNORKEL MASK and a pair of FINS on a towel; (16) a sleek BLACK-SAILED JUNK seen from DIRECTLY "
  "ABOVE pointing UP the image, its ribbed sails black, no lamps lit. No text anywhere. " + MAG)

# ── the reef's creatures (the rock pools) and Kusu's tortoises, real animals (not dressed)
J['reef21'] = (L, ['folk1.png', 'beasts19.png', 'props19.png'], STYLE + SG + ISL + "A game sprite sheet of twelve real sea-shore "
  "ANIMALS, natural animals (NOT dressed, NOT standing upright), cute and gentle, matching the attached sheets in size, ink outline "
  "and cel shading, each seen from a high top-down game camera with a gentle 3/4 tilt, each alone in its cell. A 4 by 3 grid. Row "
  "1 (Kusu's tortoises, the same big gentle TORTOISE with a high domed brown-and-amber shell): (1) RESTING, legs and head tucked in, "
  "eyes closed; (2) WALKING slowly to the RIGHT in profile, head out; (3) MUNCHING a green leaf, head stretched up happily; (4) a tiny "
  "HAWKSBILL TURTLE HATCHLING scuttling to the right. Row 2 (rock-pool life): (5) a knobbly orange-and-red SEA STAR; (6) a GIANT "
  "CLAM half open with a wavy blue-green mantle; (7) a SEA ANEMONE with a little orange CLOWNFISH; (8) a small curious OCTOPUS. Row "
  "3: (9) a yellow SEAHORSE; (10) a BLUE-SPOTTED STINGRAY; (11) a bright NUDIBRANCH sea slug; (12) a little FIDDLER CRAB with one "
  "big claw (a plain real crab, no clothes). " + MAG)

# ── Kapitan Umang's deck crew: hermit crabs in sailor caps (the case and swap steps' guards in the islands)
J['crabs21'] = (L, ['owls19.png', 'boars.png', 'play.png'], STYLE + SG + ISL + "A game sprite sheet of ONE kind of character in ten "
  "poses: a cute anthropomorphic HERMIT CRAB DECKHAND standing upright (red-orange shell-armoured body, two claws, black eyes on "
  "stalks, wearing a spiral sea shell on its back like a rucksack, a little blue sailor's cap and a blue-and-white striped vest), the "
  "same crab in every frame, matching the attached gang sheets exactly in size, style and layout. " + VIEW34 + "A 5 by 2 grid. Row 1: "
  "(1) walking TOWARD the camera, left foot forward; (2) the same, right foot forward; (3) walking AWAY from the camera, left foot; (4) "
  "the same, right foot; (5) scuttling fast to the RIGHT in profile. Row 2: (6) scuttling to the RIGHT, the other legs; (7) CALLING "
  "the others, both claws raised high clacking, mouth open; (8) PEERING suspiciously, eye stalks stretched up tall and bent forward; "
  "(9) MUNCHING a strand of seaweed, distracted; (10) TAUNTING, claws on hips, smug. " + MAG)

# ── the chapter-thirteen cast: portraits (four moods each), then full bodies copied from them
J['faces21'] = (SQ, ['portraits.png', 'faces19.png', 'faces18.png'], STYLE + SG + ISL + "Four " + CAST6 + "A sheet of sixteen "
  "character portraits in a 4 by 4 grid. " + MOODS4 + "Row 1: " + CAMAR + ". Row 2: " + LUMBA + ". Row 3: " + KU + ". Row 4: "
  + UMANG + ". " + MAG)
J['cast21'] = (L, ['cast-ref21.png', 'folk1.png', 'sg-npc.png', 'play.png'], STYLE + SG + ISL + "A game sprite sheet of four "
  "characters for a top-down game, the characters in the attached portrait strip (left to right = rows 1 to 4). " + BODY + POSES +
  "Row 1: " + CAMAR + ", full body, standing upright on two thin legs, the oilskin coat to the knees. Row 2: " + LUMBA + ", full "
  "body, standing upright on two short feet, board shorts. Row 3: " + KU + ", full body, standing upright on two stumpy feet, the "
  "sarong to the ankles. Row 4: " + UMANG + ", full body, standing upright on his legs, the conch shell on his back. " + MAG)

# ── the heroes' new actions (both heroes, the same eight)
def act21(who, desc):
    return (L, REF + [f'{who}-act.png', f'{who}-act19.png', f'{who}-act18.png'], STYLE + SG + CHIN + desc + REEF + f"A game sprite "
      f"sheet of {who.title()} only, matching the attached sprite sheets of the same character exactly (same proportions, same outfit, "
      "same scale). A 4 by 2 grid of eight separate poses of ONE character, each alone in its cell, all seen from a high top-down game "
      "camera with a gentle 3/4 tilt. Top row: (1) WADING across a wet reef flat to the RIGHT in profile: stepping high and careful "
      "through ankle-deep water, arms out for balance, left foot forward, little splashes round the feet; (2) the same wade, right "
      "foot forward; (3) BRACING on a coral rock facing the camera as the tide rushes in: crouched low, feet planted wide, arms out, "
      "ears blown back, a little foam round the rock; (4) WASHED BACK: tumbling backwards in a splash of white surf, paws flailing, "
      "eyes squeezed shut. Bottom row: (5) PEERING INTO A ROCK POOL: crouched facing the camera, hands on knees, nose close to the "
      "water, eyes wide with wonder; (6) FEEDING A TORTOISE: kneeling facing the camera, holding out a big green leaf to a gentle "
      "brown tortoise beside, smiling; (7) FLOATING in a calm lagoon on the back seen from above, arms spread, eyes closed, blissful, "
      "a little ring of ripples round the body; (8) LOOKING OUT from a lighthouse gallery: standing facing away to the right in three "
      "quarter view, holding a pair of binoculars up to the eyes, one foot on a rail. " + MAG)
J['dora-act21'] = act21('dora', DORA)
J['enzo-act21'] = act21('enzo', ENZO)

# ── the interface: map landmarks and round icons
J['ui21'] = (L, SREF + ['icons.png', 'ui19.png', 'ui18.png'], STYLE + SG + "A game UI icon sheet painted like enamel shop signs and "
  "lacquered wood with gold trim, matching the attached icons in style, chunky and readable at small size. A 4 by 2 grid of eight "
  "separate items. Row 1: (1) a small map landmark icon of a tall white LIGHTHOUSE on a rock with a golden beam; (2) a small map "
  "landmark icon of a little Chinese island TEMPLE roof with a TORTOISE in front; (3) a small map landmark icon of a crescent LAGOON "
  "beach with a coconut palm; (4) a map PIN shaped like a teardrop with a little HERMIT CRAB face inside. Row 2: (5) a round icon of "
  "a curling WAVE over a rock (the tide), in a gold ring; (6) a round icon of a spiral SEA SHELL, in a gold ring; (7) a round icon "
  "of a friendly TORTOISE, in a gold ring; (8) a round icon of an old leather LOGBOOK, in a gold ring. No text, no letters, no "
  "numbers. " + MAG)

# ── the three island properties, each its own stand at four levels (shuttered, then three upgrades)
J['emp21-props'] = (L, SREF + ['emp-props4.png', 'emp19-props.png', 'islands-bld.png'], STYLE + SG + ISL + EMP + GROWP + "Row 1: a "
  "LAGOON COCONUT BAR: a little thatched beach bar on the sand with green coconuts, straws, fairy lights and a palm beside it. Row 2: "
  "a JETTY CAFE: a white timber kiosk on a jetty with a kopi urn, cups, kaya toast, a striped awning and a lifebuoy hung on it. Row "
  "3: a SNORKEL HIRE hut: a blue-painted beach hut with racks of masks, fins and little kayaks, a towel line and a lamp. " + MAG)

# ── the chapter card (chapter thirteen is not an ending: no new end panel)
J['chapter-13'] = (L, REF + ['portraits.png', 'faces21.png', 'chapter-12.png'], STYLE + SG + ISL + CHIN + DORA + ENZO + REEF + PANEL +
  "A chapter title painting for 'raffles lighthouse': Dora and Enzo, trouser legs rolled up and in little reef shoes, wade hand "
  "in hand across a moonlit reef flat at low tide between glowing rock pools, a sea star and a tiny turtle hatchling at their feet; "
  "behind them the tall white RAFFLES LIGHTHOUSE on its tiny rocky island throws a long golden beam over the sea; far out on the "
  "silver water, very small, a sleek BLACK-SAILED JUNK with no lamps, a tall figure in black feathers at its rail, and a hermit "
  "crab in a captain's hat beside her. On the far horizon the warm lights of the city. Leave the top fifth of the image as calm night "
  "sky. No text.")

# the market panel's scene: the islands' market (every district's market has one)
from jobs2 import STALL, SP
J['stall-islands'] = (L, SP + ['stall-mandai.png', 'faces21.png'], STYLE + SG + ISL + STALL + "The stall-keeper is Kak Lumba, a "
  "bubbly pink HUMPBACK DOLPHIN marine-park guide in a teal rash-guard with a dive mask on her head (copy her from the attached "
  "portrait sheet, second row), behind the counter of a cheerful little island canteen by the St John's jetty under a striped "
  "awning at night. Behind her: shelves of sun hats and reef shoes, snorkels, jars of keropok, green coconuts, bunches of bananas, "
  "fairy lights, and through the open side a glimpse of the moonlit sea and a lighthouse beam far away. No text, signs are blank "
  "shapes.")
