# Jade Street, the twenty-second pass's paintings: Bukit Timah and the Botanic Gardens, west of Tiong Bahru, and chapter
# fourteen. The ground (the hill's root-laced summit trail, the Gardens' clipped lawns, the old rail corridor's gravel bed,
# Swan Lake's water), the district's buildings (the old Bukit Timah railway station, the Gardens' bandstand, the old
# herbarium and library, a black-and-white bungalow safe house, the Dairy Farm nature centre, the trail's rest shelter),
# the Bukit Timah truss bridge on its own sheet, a prop sheet, four new portraits in four moods then their full bodies
# (Big Kow among them, repainted for the hill so a standing Kow never holds a Chinatown atlas), the heroes' new actions
# (the climb's poses: stepping up the trail, winded, resting, the summit; and the macaques: a bag snatched, shooing),
# map icons, the three new properties' stands, the market panel and the chapter card. The game uses real Singapore
# names in its TEXT, but the paintings keep the no-lettering rule: no text, letters, numbers, logos or flags anywhere.
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
BT = ("This part of the world is BUKIT TIMAH and the SINGAPORE BOTANIC GARDENS on a warm clear NIGHT under a big moon: BUKIT TIMAH "
 "HILL, the island's highest point, a steep hill of old tall rainforest with a winding summit trail of root-laced earth and timber "
 "steps; the old HINDHEDE QUARRY's still green lake under granite cliffs; the old DAIRY FARM; the green RAIL CORRIDOR where the old "
 "railway line used to run, its sleepers gone and a gravel path left, with the old steel TRUSS BRIDGE over the road and the little "
 "old BUKIT TIMAH RAILWAY STATION; and the BOTANIC GARDENS with SWAN LAKE, a white Victorian BANDSTAND under rain trees, the "
 "colonial HERBARIUM and LIBRARY, and the orchid garden's arches of white and yellow orchids. Moonlit silver-blue night, warm lamp "
 "light, deep jungle greens, cosy and magical, never spooky. ")
PROP = ("Each object is seen from a HIGH top-down game camera with a gentle 3/4 tilt, matching the attached prop sheets exactly in "
 "scale, ink outline, cel shading and warm night lighting. ")
BLD = ("Each building is seen from a HIGH top-down camera with a gentle 3/4 tilt at the SAME angle as the attached building sheets, so we "
 "look DOWN onto its whole ROOF (the roof takes up the top two thirds of each building) and see only a short strip of the front "
 "facade at the bottom. NOT a flat front elevation. No ground plate, no plaza, no pavement, NO TREES, NO BUSHES and NO PLANTS under "
 "or around a building: each building's outline is just its own roof, walls and steps. Each building alone in its cell with space "
 "around it. ")
TENG = ("PAK TENGGILING, the gentle dignified retired STATIONMASTER of the old Bukit Timah railway station, a SUNDA PANGOLIN: "
 "overlapping warm brown-and-bronze scales like a pine cone, a small pointed pink face, tiny kind eyes, a long scaly tail, wearing "
 "an old faded navy railway uniform jacket with brass buttons, a stationmaster's peaked cap and a brass pocket watch on a chain, "
 "carrying a green signal lantern")
LOTONG = ("PUAN LOTONG, a brisk friendly NATURE RESERVE RANGER, a RAFFLES' BANDED LANGUR (a banded leaf monkey): sleek glossy "
 "BLACK fur with a white stripe down her chest and white rings round her eyes, a long black tail, wearing a khaki ranger's shirt "
 "with rolled sleeves, a wide ranger's hat and a walkie-talkie on her belt")
MERBAH = ("DR MERBAH, the fussy kind old keeper of the herbarium and library, a STRAW-HEADED BULBUL: a golden straw-yellow crown "
 "and cheeks, a black stripe through the eye, soft olive-brown wings and a pale throat, wearing a brown tweed waistcoat over a white "
 "shirt with sleeve garters, little half-moon reading spectacles, and holding a magnifying glass and a pressed-plant specimen sheet")
KOW = ("BIG KOW, the swaggering boss of the BUKIT BUNCH gang of long-tailed MACAQUES: a big burly long-tailed macaque with "
 "grey-brown fur, a pink face, bushy whiskers and a cheeky gap-toothed grin; copy his face exactly from the attached portrait; for "
 "the hill he wears a sleeveless khaki safari vest with lots of bulging pockets stuffed with stolen snack packets, a sweatband "
 "round his head and a stolen pair of binoculars round his neck")
TRAIL = (" For the hill trail this character wears sturdy little brown HIKING BOOTS, a small canvas DAYPACK on the back and a soft "
 "khaki sun visor; otherwise exactly the same outfit as the attached sheets. ")
J = {}

# ── the ground: four seamless textures
J['ground22'] = (L, SREF + ['ground21.png', 'ground19.png'], STYLE + SG + BT + "Four separate SQUARE seamless ground TEXTURES for a "
  "top-down game, matching the attached ground textures exactly in scale and style, seen from directly above, flat, evenly lit at "
  "night, no objects, no lines, no borders: a 2 by 2 grid of four squares that each fill their cell completely, edge to edge, with thin "
  "black gaps between them. Every texture must be CALM and LOW CONTRAST so characters drawn on top stay easy to read: no big motifs, "
  "no strong outlines. Top row: (1) a rainforest SUMMIT TRAIL seen from above: packed reddish-brown earth with a few thin tree roots "
  "and fallen leaves, soft and even; (2) the Botanic Gardens' clipped LAWN: short velvety dark green grass, very even, moonlit. "
  "Bottom row: (3) the old RAIL CORRIDOR's path: fine pale grey-brown gravel with a little grass coming through, very even; (4) the "
  "still dark water of SWAN LAKE at night: deep green-blue water with faint soft ripples, no reflections of objects.")

# ── buildings (green screen; the packer stretches each to its footprint)
J['bukit-bld'] = (L, SREF + ['islands-bld.png', 'mandai-bld.png', 'sg-bld.png'], STYLE + SG + BT + "A game sprite sheet of six "
  "separate BUKIT TIMAH and BOTANIC GARDENS buildings for a top-down game. " + BLD + "A 3 by 2 grid. Row 1: (1) the old BUKIT TIMAH "
  "RAILWAY STATION: a small low cream-and-white 1930s station house with a red-brown tiled hipped roof, green timber shutters and a "
  "covered platform canopy along its front, about twice as wide as deep; (2) the Botanic Gardens BANDSTAND: a white octagonal "
  "Victorian bandstand with slender white iron columns, lacy white ironwork and a pointed eight-sided red-tiled roof with a little "
  "finial, about as wide as deep; (3) the old HERBARIUM and LIBRARY: a handsome two-storey cream colonial building with tall "
  "windows, deep verandas and a dark red tiled roof, about twice as wide as deep. Row 2: (4) a cosy SAFE HOUSE where two young "
  "chinchilla heroes hide out: a colonial BLACK-AND-WHITE BUNGALOW (white walls, black timber frames) on short brick piers with a "
  "red tiled roof, a lamp by the door and a single paw-print shape on the door, about one and a half times as wide as deep; (5) the "
  "DAIRY FARM nature centre: a long low old farm shed with a curved green corrugated roof and white walls, about twice as wide as "
  "deep; (6) a rainforest trail REST SHELTER: an open-sided timber hut with a steep dark shingle roof over two benches, about one and "
  "a half times as wide as deep. " + GRN)
J['bukit-bridge'] = (L, SREF + ['sg-bld.png', 'islands-light.png'],
  STYLE + SG + BT + "ONE structure alone in the middle of the image for a top-down game: the old BUKIT TIMAH RAIL TRUSS BRIDGE, a "
  "long STEEL TRUSS railway bridge painted dark green-black, seen from a HIGH top-down camera with a gentle 3/4 tilt at the SAME angle "
  "as the attached building sheets, so we look DOWN onto it: its deck of pale gravel and timber runs straight from LEFT to RIGHT "
  "across the whole picture, with the criss-cross steel truss girders and rivets along both sides of the deck, square ends where the "
  "deck stops. It is about four times as wide as it is tall in the picture. Nothing under it, no road, no ground, no plants. " + MAG)

# ── the two MRT station entrances (green screen, like the other buildings)
J['bukit-stn'] = (L, SREF + ['bukit-bld.png', 'kallang-bld.png', 'mandai-bld.png'], STYLE + SG + BT + "A game sprite sheet of two "
  "separate MRT STATION ENTRANCE buildings for a top-down game. " + BLD + "A 2 by 1 grid. (1) BEAUTY WORLD MRT station's entrance: "
  "a modern low glass-and-steel entrance pavilion with a gently curved silver roof and a glowing lit escalator mouth going down, "
  "a blank round coloured sign disc on a pole, about one and a half times as wide as deep; (2) BOTANIC GARDENS MRT station's "
  "entrance: a low entrance pavilion with a flat roof planted as a green ROOF GARDEN of clipped grass (no flowers), timber-slatted "
  "sides, glass doors and a glowing escalator mouth going down, a blank round coloured sign disc on a pole, about one and a half "
  "times as wide as deep. " + GRN)

# ── props (on magenta: the orchids are white and yellow, never pink or purple)
J['props22'] = (SQ, SREF + ['props1.png', 'props21.png', 'props19.png'], STYLE + SG + BT + PROP + "A 4 by 4 grid of sixteen "
  "separate items, each centred in its own cell. Row 1 (the hill): (1) the SUMMIT MARKER: a low rough granite boulder with a blank "
  "bronze plaque set in it; (2) an old white concrete SURVEY TRIG PILLAR, a short square pillar with a brass plate on top; (3) a "
  "wooden TRAIL SIGNPOST with two blank arrow boards; (4) a mossy granite BOULDER. Row 2 (the gardens): (5) a graceful WHITE SWAN "
  "gliding on dark water, seen from above; (6) an ARCH of WHITE and YELLOW ORCHIDS on a green iron frame (no pink, no purple); (7) a "
  "clump of tall yellow-and-white ORCHIDS in a stone urn (no pink, no purple); (8) a green iron GARDEN BENCH. Row 3 (the herbarium "
  "and railway): (9) a wooden PLANT PRESS strapped tight; (10) an old yellowed SPECIMEN SHEET with a pressed leafy sprig and a blank "
  "label; (11) a short SECTION OF OLD RAILWAY TRACK, two rusty rails on dark timber sleepers, running LEFT to RIGHT; (12) an old "
  "black iron RAILWAY SIGNAL post with a red-and-white arm and a lamp. Row 4 (the trail's trouble): (13) a crinkly SNACK PACKET "
  "torn open, crisps spilling out; (14) a bunch of yellow BANANAS; (15) a green MACAQUE-PROOF BIN with a heavy clamped lid; (16) an "
  "old brass SURVEYOR'S THEODOLITE on a wooden tripod. No text anywhere. " + MAG)

# ── the chapter-fourteen cast: portraits (four moods each), then full bodies copied from them
J['faces22'] = (SQ, ['portraits.png', 'faces21.png', 'kow-ref22.png'], STYLE + SG + BT + "Three " + CAST6 + "and one returning "
  "character copied from the attached single portrait. A sheet of sixteen character portraits in a 4 by 4 grid. " + MOODS4 + "Row 1: "
  + TENG + ". Row 2: " + LOTONG + ". Row 3: " + MERBAH + ". Row 4: " + KOW + ". " + MAG)
J['cast22'] = (L, ['cast-ref22.png', 'folk1.png', 'sg-npc.png', 'play.png'], STYLE + SG + BT + "A game sprite sheet of four "
  "characters for a top-down game, the characters in the attached portrait strip (left to right = rows 1 to 4). " + BODY + POSES +
  "Row 1: " + TENG + ", full body, standing upright on two short legs, the scaly tail behind. Row 2: " + LOTONG + ", full body, "
  "standing upright, khaki shorts, the long tail curling behind. Row 3: " + MERBAH + ", full body, standing upright on two thin "
  "legs, brown trousers. Row 4: " + KOW + ", full body, standing upright, baggy cargo shorts, the long tail behind. " + MAG)

# ── the heroes' new actions (both heroes, the same eight)
def act22(who, desc):
    return (L, REF + [f'{who}-act.png', f'{who}-act21.png', f'{who}-act19.png'], STYLE + SG + CHIN + desc + TRAIL + f"A game sprite "
      f"sheet of {who.title()} only, matching the attached sprite sheets of the same character exactly (same proportions, same outfit, "
      "same scale). A 4 by 2 grid of eight separate poses of ONE character, each alone in its cell, all seen from a high top-down game "
      "camera with a gentle 3/4 tilt. Top row: (1) CLIMBING steep trail steps AWAY from the camera, leaning forward into the hill, "
      "left knee high stepping up, one paw pushing on the left knee; (2) the same climb, right knee high, the other paw on the right "
      "knee; (3) WINDED: bent over facing the camera, paws on knees, tongue out panting, sweat drops flying, ears drooping; (4) "
      "RESTING on a log facing the camera, sipping from a water bottle, eyes closed, relieved. Bottom row: (5) at the SUMMIT: standing "
      "tall facing the camera with both arms thrown up in triumph, huge grin; (6) BAG SNATCHED: spun round in surprise, one paw "
      "grabbing at the empty air where the daypack strap was, mouth open in an 'oi!'; (7) SHOOING: facing the camera, stamping one "
      "foot and flapping both arms wide to scare something off, cross face; (8) READING an old specimen sheet held up close in both "
      "paws, peering through a magnifying glass, fascinated. " + MAG)
J['dora-act22'] = act22('dora', DORA)
J['enzo-act22'] = act22('enzo', ENZO)

# ── the interface: map landmarks and round icons
J['ui22'] = (L, SREF + ['icons.png', 'ui21.png', 'ui19.png'], STYLE + SG + "A game UI icon sheet painted like enamel shop signs and "
  "lacquered wood with gold trim, matching the attached icons in style, chunky and readable at small size. A 4 by 2 grid of eight "
  "separate items. Row 1: (1) a small map landmark icon of a green jungle HILL with a little flag-less summit boulder on top; (2) a "
  "small map landmark icon of a white BANDSTAND with a white swan; (3) a small map landmark icon of an old steel TRUSS BRIDGE; (4) a "
  "map PIN shaped like a teardrop with a cheeky MACAQUE face inside. Row 2: (5) a round icon of a pair of LUNGS with a little puff "
  "of breath (stamina), in a gold ring; (6) a round icon of a white-and-yellow ORCHID flower, in a gold ring; (7) a round icon of a "
  "pressed-leaf SPECIMEN sheet, in a gold ring; (8) a round icon of a HIKING BOOT, in a gold ring. No text, no letters, no "
  "numbers. " + MAG)

# ── the three new properties, each its own stand at four levels (shuttered, then three upgrades)
J['emp22-props'] = (L, SREF + ['emp-props4.png', 'emp21-props.png', 'bukit-bld.png'], STYLE + SG + BT + EMP + GROWP + "Row 1: a "
  "BEAUTY WORLD hawker stall: a little food-centre stall with a steaming wok, plates of nasi lemak and a hanging lamp. Row 2: an "
  "ORCHID FLORIST kiosk: a white-and-green garden kiosk with buckets and sprays of WHITE and YELLOW orchids (no pink, no purple), "
  "ribbons and a lamp. Row 3: a RAIL CORRIDOR BICYCLE HIRE: a timber shed with a rack of bicycles, helmets on hooks, a pump and a "
  "lamp. " + MAG)

# ── the chapter card (chapter fourteen is not an ending: no new end panel)
J['chapter-14'] = (L, REF + ['portraits.png', 'faces22.png', 'chapter-13.png'], STYLE + SG + BT + CHIN + DORA + ENZO + TRAIL + PANEL +
  "A chapter title painting for 'bukit timah': Dora and Enzo in hiking boots and daypacks climb the moonlit root-laced timber steps "
  "of the Bukit Timah summit trail through tall dark rainforest, Dora pointing up the trail with a lantern, Enzo holding an old "
  "yellowed map; on a branch above them a cheeky long-tailed MACAQUE in a khaki vest dangles by its tail, reaching for Enzo's "
  "daypack with a grin. Through a gap in the trees far below, the white bandstand of the Botanic Gardens glows by a lake, and the "
  "old steel truss bridge of the railway crosses a road. Leave the top fifth of the image as calm night sky. No text.")

# the market panel's scene: the district's market (every district's market has one)
from jobs2 import STALL, SP
J['stall-bukit'] = (L, SP + ['stall-islands.png', 'faces22.png'], STYLE + SG + BT + STALL + "The stall-keeper is Puan Lotong, a "
  "black banded leaf monkey nature ranger in a khaki shirt and a wide ranger's hat (copy her from the attached portrait sheet, second "
  "row), behind the counter of a cheerful little trailhead shop by the Bukit Timah visitor centre at night. Behind her: shelves of "
  "water bottles, rain ponchos, hiking poles, insect repellent, packets of kaya biscuits, a rack of trail maps (blank), a bunch of "
  "bananas kept in a cage away from the macaques, and through the open side a glimpse of dark rainforest and a moonlit hill. No "
  "text, signs are blank shapes.")
