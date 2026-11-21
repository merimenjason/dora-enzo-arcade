# Jade Street, the eighteenth pass's paintings: Kallang, the Singapore Sports Hub on the Kallang Basin, and chapter
# eleven. The ground (the Sports Hub's paving, the riverside boardwalk, the old airport's apron, the basin's water), the
# National Stadium's dome on its own sheet and a sheet of the district's other buildings (the Old Kallang Airport
# terminal, the Singapore Indoor Stadium, Kallang Wave Mall, the rowing club, the safe house, Stadium station), a prop
# sheet, a sheet of match-night fans for the crowds, four new portraits in four moods (the three givers and Madam
# Sutera) then their full bodies, the heroes' new actions (squeezing through a crowd, the Kallang Wave), map icons, the
# three Kallang properties' stands, the market panel and the chapter card. The game uses real Singapore names in its
# TEXT, but the paintings keep the no-lettering rule: no text, letters, numbers, logos or flags anywhere.
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
KAL = ("This part of the world is KALLANG, Singapore's sports district on the KALLANG BASIN, on a big MATCH NIGHT: the NATIONAL "
 "STADIUM under its huge silver-white retractable DOME (a smooth shallow shell of diamond-patterned panels that glows from inside), "
 "the concourse of the SPORTS HUB with crowds of fans, the pagoda-roofed SINGAPORE INDOOR STADIUM, the curving glass KALLANG WAVE "
 "MALL, the calm wide basin with dragon boats and rowing shells, a timber riverside promenade with lamps and rain trees, and across the "
 "boulevard the white 1937 art-deco OLD KALLANG AIRPORT terminal with its round glass control tower. Warm floodlit night, city "
 "lights reflected in the water. ")
PROP = ("Each object is seen from a HIGH top-down game camera with a gentle 3/4 tilt, matching the attached prop sheets exactly in "
 "scale, ink outline, cel shading and warm night lighting. ")
BLD = ("Each building is seen from a HIGH top-down camera with a gentle 3/4 tilt at the SAME angle as the attached building sheets, so we "
 "look DOWN onto its whole ROOF (the roof takes up the top two thirds of each building) and see only a short strip of the front "
 "facade at the bottom. NOT a flat front elevation. No ground plate, no plaza and no pavement under or around a building: each "
 "building's outline is just its own roof, walls and steps. Each building alone in its cell with space around it. ")
BIRU = ("COACH BIRU, a brisk loud cheerful COLLARED KINGFISHER dragon-boat and rowing coach: bright turquoise-blue wings and cap, a "
 "crisp white collar and chest, a big black dagger bill, beady black eyes, wearing a red team windbreaker, a whistle on a cord round "
 "the neck and a stopwatch")
TENUK = ("MS TENUK, a calm unflappable MALAYAN TAPIR events manager at the Sports Hub: a black head, shoulders and legs with a white "
 "saddle across the middle, a short wiggly trunk-nose, small kind eyes, round white-tipped ears, wearing a smart black blazer over a "
 "teal staff polo shirt, a lanyard with a blank pass and a headset with a little microphone")
KUBUNG = ("UNCLE KUBUNG, a gentle elderly SUNDA COLUGO (flying lemur), caretaker and archivist of the old Kallang Airport: soft "
 "mottled grey-brown fur, big round dark eyes, a little pink nose, the furry gliding membrane draped from his arms like a cape, "
 "wearing round wire spectacles, a 1930s pilot's leather cap with the flaps up and a brown cardigan")
SUTERA = ("MADAM SUTERA, an elegant and mysterious BLACK SWAN lady: glossy jet-black feathers with frilled curled wing plumes, a long "
 "graceful neck, a bright scarlet bill with a white band near the tip, red eyes, wearing a long black silk cheongsam embroidered "
 "with tiny silver waves, pearl earrings and a black lace veil hat; aloof and silky, never scary")
J = {}

# ── the ground: four seamless textures
J['ground18'] = (L, SREF + ['ground17.png', 'ground6.png'], STYLE + SG + KAL + "Four separate SQUARE seamless ground TEXTURES for a "
  "top-down game, matching the attached ground textures exactly in scale and style, seen from directly above, flat, evenly lit at "
  "night, no objects, no lines, no borders: a 2 by 2 grid of four squares that each fill their cell completely, edge to edge, with thin "
  "black gaps between them. Every texture must be CALM and LOW CONTRAST so characters drawn on top stay easy to read: no big motifs, "
  "no strong outlines. Top row: (1) the SPORTS HUB concourse: pale grey and warm white large square granite pavers in a soft even "
  "grid; (2) a timber riverside BOARDWALK: warm honey-brown planks running left to right with faint gaps. Bottom row: (3) an old "
  "AIRFIELD APRON: weathered pale concrete slabs with faint tar seams and soft stains, no markings; (4) calm dark teal-blue RIVER "
  "BASIN water seen from above, gentle ripples with a soft floodlit sheen, no reflections of objects.")

# ── buildings (green screen; the packer stretches each to its footprint)
J['kallang-dome'] = (L, SREF + ['sg-bld.png', 'bay-bld.png', 'changi-bld2.png'], STYLE + SG + KAL + "ONE building alone in the "
  "middle of the image for a top-down game: the NATIONAL STADIUM of Singapore seen from a HIGH top-down camera with a gentle 3/4 tilt "
  "at the SAME angle as the attached building sheets, so we look DOWN onto the whole of its huge shallow silver-white DOME roof: a "
  "smooth rounded shell of fine diamond-patterned panels, the middle of the roof slid open in an oval showing the floodlit green "
  "pitch and the red seats of the bowl inside; a ring of glowing lights round the rim; at the bottom edge a short strip of the "
  "stadium's front: glass entrance halls and a ring of slender pale columns. A little wider than deep. No ground plate, no plaza, "
  "no crowd round it. " + GRN)
J['kallang-bld'] = (L, SREF + ['sg-bld.png', 'south-bld.png', 'ubin-bld2.png'], STYLE + SG + KAL + "A game sprite sheet of six "
  "separate KALLANG buildings for a top-down game. " + BLD + "A 3 by 2 grid. Row 1: (1) the OLD KALLANG AIRPORT terminal: a long low "
  "white 1937 art-deco building with rounded ends, long ribbon windows and a flat roof, a ROUND GLASS CONTROL TOWER rising from the "
  "middle of the roof, about twice as wide as deep; (2) the SINGAPORE INDOOR STADIUM: a big square hall with a sweeping PAGODA-like "
  "roof of pale metal that curves up at the four corners, glass walls glowing at the bottom, about square; (3) KALLANG WAVE MALL: a "
  "curving glass-and-white mall with a wavy flowing roof line and shop windows glowing, about square. Row 2: (4) the ROWING CLUB "
  "boathouse: a long timber shed with a pale green zinc roof and wide open doors, rowing shells and oars racked inside, about one and "
  "a half times as wide as deep; (5) a cosy little SAFE HOUSE where two young chinchilla heroes hide out: an old 1930s hangar office "
  "with a curved corrugated roof painted jade green and one round porthole window, a single paw-print shape on the door, about one "
  "and a half times as wide as deep; (6) STADIUM MRT station entrance: a low curved glass canopy over an escalator going down, on "
  "slim white columns, about twice as wide as deep. " + GRN)

# ── props
J['props18'] = (SQ, SREF + ['props1.png', 'props17a.png', 'props14b.png'], STYLE + SG + KAL + PROP + "A 4 by 4 grid of sixteen "
  "separate items, each centred in its own cell. Row 1 (the river): (1) a RACK of three slim racing ROWING SHELLS stacked on a timber "
  "frame; (2) a big red DRAGON-BOAT DRUM on a short wooden stand with two drumsticks; (3) a round orange racing BUOY bobbing on dark "
  "water; (4) a sleek BLACK SEAPLANE with two floats seen from DIRECTLY ABOVE pointing straight UP the image, wings spread, propeller "
  "blurred. Row 2 (the old airport): (5) a VINTAGE 1930s silver twin-engine biplane airliner seen from DIRECTLY ABOVE pointing UP the "
  "image, parked; (6) a striped orange-and-white WINDSOCK on a pole, blowing to the right; (7) a little VINTAGE red FUEL BOWSER truck "
  "from the 1930s seen from above at a tilt; (8) a stack of old leather SUITCASES and a steamer trunk with travel stickers that are "
  "blank coloured shapes. Row 3 (match night): (9) a row of three silver TICKET TURNSTILE gates side by side; (10) a tall stadium "
  "FLOODLIGHT mast with a bank of bright white lamps; (11) a short run of blue metal CROWD BARRIERS; (12) a small outdoor fan-zone "
  "STAGE with a truss frame, coloured spotlights and speakers. Row 4: (13) a colourful street-food TRUCK with its hatch open and a "
  "glowing counter; (14) a big outdoor SCREEN on legs showing a blurry green pitch; (15) a red-and-white supporter's SCARF coiled "
  "on the ground (no lettering); (16) a tied bundle of old rolled-up FLIGHT CHARTS and a sepia aerial PHOTOGRAPH of a small island. "
  "No text anywhere. " + MAG)

# ── match-night fans (the crowd you squeeze through)
J['fans18'] = (L, ['folk1.png', 'folk9.png', 'play.png'], STYLE + SG + KAL + "A game sprite sheet of three NEW cute anthropomorphic "
  "animal FOOTBALL FANS heading to a big match, matching the attached townsfolk sheets exactly in size, style and layout. " + VIEW34 +
  "A 5 by 3 grid of fifteen frames; each ROW is one character, left to right: (1) walking TOWARD the camera; (2) walking AWAY from the "
  "camera (seen from behind); (3) walking to the RIGHT in profile, left foot forward; (4) walking to the RIGHT in profile, right foot "
  "forward; (5) CHEERING, both arms up. Every fan wears a plain RED-and-WHITE home team football jersey with no lettering and no numbers. "
  "Row 1: a big jolly SUN BEAR uncle with a red-and-white scarf round his neck and a plastic drum. Row 2: a young excited MOUSE DEER "
  "with face paint stripes (red and white) and a foam finger that is a blank shape. Row 3: a chatty SMOOTH-COATED OTTER auntie with a "
  "red bucket hat and a little flag that is a plain red-and-white shape on a stick. " + MAG)

# ── the chapter-eleven cast: portraits (four moods each), then full bodies copied from them
J['faces18'] = (SQ, ['portraits.png', 'faces17.png', 'emp-faces.png'], STYLE + SG + KAL + "Four " + CAST6 + "A sheet of sixteen "
  "character portraits in a 4 by 4 grid. " + MOODS4 + "Row 1: " + BIRU + ". Row 2: " + TENUK + ". Row 3: " + KUBUNG + ". Row 4: "
  + SUTERA + ". " + MAG)
J['cast18'] = (L, ['cast-ref18.png', 'folk1.png', 'sg-npc.png', 'play.png'], STYLE + SG + KAL + "A game sprite sheet of four "
  "characters for a top-down game, the characters in the attached portrait strip (left to right = rows 1 to 4). " + BODY + POSES +
  "Row 1: " + BIRU + ", full body, in red track trousers and trainers. Row 2: " + TENUK + ", full body, black trousers, a clipboard. "
  "Row 3: " + KUBUNG + ", full body, the gliding membrane draped from his arms, brown trousers. Row 4: " + SUTERA + ", full body, the "
  "long black cheongsam to the ankles. " + MAG)

# ── the heroes' new actions (both heroes, the same eight)
def act18(who, desc):
    return (L, REF + [f'{who}-act.png', f'{who}-act17.png', f'{who}-act15.png'], STYLE + SG + CHIN + desc + f"A game sprite sheet of "
      f"{who.title()} only, matching the attached sprite sheets of the same character exactly (same proportions, same outfit, same "
      "scale). A 4 by 2 grid of eight separate poses of ONE character, each alone in its cell, all seen from a high top-down game "
      "camera with a gentle 3/4 tilt. Top row: (1) SQUEEZING THROUGH A CROWD sideways to the RIGHT in profile: shoulders turned, "
      "elbows tucked in, belly sucked in, tiptoeing, left foot forward, an apologetic look; (2) the same squeeze, right foot forward, "
      "one paw raised in a polite 'excuse me'; (3) SHOVED: stumbling backwards off balance facing the camera, arms windmilling, "
      "eyes wide; (4) HOLDING UP A TICKET at a gate: facing the camera, one paw holding a small blank paper ticket up high, the "
      "other on the hip, proud. Bottom row: (5) THE MEXICAN WAVE, first half: crouched low facing the camera, paws on the knees, "
      "grinning, ready to spring; (6) THE MEXICAN WAVE, second half: leaping up facing the camera with both arms flung straight up "
      "high, mouth open cheering, ears flying; (7) LOOKING UP AT THE SKY: facing the camera, head tilted right back, one paw shading "
      "the eyes, gazing up, amazed; (8) POINTING UP at the sky with one arm straight up, the other paw on the cheek, startled. " + MAG)
J['dora-act18'] = act18('dora', DORA)
J['enzo-act18'] = act18('enzo', ENZO)

# ── the interface: map landmarks and round icons
J['ui18'] = (L, SREF + ['icons.png', 'ui17.png', 'ui12.png'], STYLE + SG + "A game UI icon sheet painted like enamel shop signs and "
  "lacquered wood with gold trim, matching the attached icons in style, chunky and readable at small size. A 4 by 2 grid of eight "
  "separate items. Row 1: (1) a small map landmark icon of a silver STADIUM DOME glowing from inside; (2) a small map landmark icon "
  "of a white art-deco AIRPORT terminal with a round glass control tower; (3) a small map landmark icon of a red DRAGON BOAT with "
  "paddles; (4) a map PIN shaped like a teardrop with a little black swan head inside. Row 2: (5) a round icon of a jostling CROWD "
  "of three little heads, in a gold ring; (6) a round icon of two arms raised in a cheering WAVE, in a gold ring; (7) a round icon of "
  "a blank paper match TICKET, in a gold ring; (8) a round icon of a small black SEAPLANE, in a gold ring. No text, no letters, no "
  "numbers. " + MAG)

# ── the three Kallang properties, each its own stand at four levels (shuttered, then three upgrades)
J['emp18-props'] = (L, SREF + ['emp-props4.png', 'emp17-props.png', 'kallang-bld.png'], STYLE + SG + KAL + EMP + GROWP + "Row 1: a "
  "MALL KIOSK selling team SCARVES and jerseys: a curved white kiosk with rails of red-and-white scarves and folded jerseys, no "
  "lettering. Row 2: a STADIUM FOOD STALL: a stall with a striped awning, satay sticks on a charcoal grill, cups of iced drinks and "
  "a stack of paper trays. Row 3: a RIVERSIDE ROWING CAFE: a small timber cafe on the boardwalk with an oar crossed over the door, "
  "a coffee machine, cakes under glass and two little tables by the water. " + MAG)

# ── the chapter card (chapter eleven is not an ending: no new end panel)
J['chapter-11'] = (L, REF + ['portraits.png', 'faces18.png', 'chapter-10.png'], STYLE + SG + KAL + CHIN + DORA + ENZO + PANEL + "A "
  "chapter title painting for 'kallang roar': Dora and Enzo squeeze, laughing, through a cheerful river of football fans in "
  "red-and-white jerseys on the floodlit Sports Hub concourse at night, a fan with a drum and another with a scarf held high; behind "
  "them the huge glowing silver dome of the National Stadium, floodlight beams criss-crossing the sky; to one side the calm Kallang "
  "Basin with dragon boats moored at a pontoon. Far off on the water, very small, a sleek black seaplane waits with its lights off, "
  "and on its float a tall figure in black feathers looks back. Leave the top fifth of the image as calm night sky. No text.")

# the market panel's scene: the Kallang Wave Mall market (every district's market has one)
from jobs2 import STALL, SP
J['stall-kallang'] = (L, SP + ['stall-pulau.png', 'faces18.png'], STYLE + SG + KAL + STALL + "The stall-keeper is Ms Tenuk, a calm "
  "MALAYAN TAPIR in a black blazer over a teal staff polo with a headset (copy her from the attached portrait sheet, second row), "
  "behind the glossy white counter of a busy match-night market stall inside a modern curving glass mall. Behind her: rails of "
  "red-and-white scarves and folded jerseys, a fridge of cold drinks, stacked boxes of snacks, a rack of foam fingers that are blank "
  "shapes, and through the glass a glimpse of the glowing stadium dome. No text, signs are blank shapes.")
