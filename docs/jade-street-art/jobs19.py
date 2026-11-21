# Jade Street, the nineteenth pass's paintings: Mandai, Singapore's wildlife parks on the Upper Seletar Reservoir, at
# night, and chapter twelve. The ground (the reservoir's dark water, the Mandai boardwalk, the night forest floor, the
# parks' red laterite paths), a sheet of the district's buildings (the Night Safari's entrance lodge, the Singapore Zoo's
# entrance, River Wonders' panda pavilion, the ranger-hut safe house, the Mandai Lake Road station, the Creatures of the
# Night amphitheatre) and Bird Paradise's aviary dome on its own sheet, a prop sheet, the night animals resting by the
# trails (resting, alert with their eyes shining, bolting), Madam Sutera's night watch (barn owls), four new portraits in
# four moods then their full bodies, the heroes' new actions (creeping along a dark trail by torch, listening, hush,
# startled, feeding a lory, clapping at the show, riding the tram), map icons, the three Mandai properties' stands, the
# market panel and the chapter card. The game uses real Singapore names in its TEXT, but the paintings keep the
# no-lettering rule: no text, letters, numbers, logos or flags anywhere.
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
MND = ("This part of the world is MANDAI, Singapore's wildlife parks in the rainforest on the edge of the UPPER SELETAR RESERVOIR, "
 "late at NIGHT: the NIGHT SAFARI's timber-and-thatch entrance lodge lit by flickering torches, its open-sided trams gliding along "
 "forest tracks, low amber trail lanterns under giant rain trees, tree ferns and bamboo; the SINGAPORE ZOO's leafy entrance; RIVER "
 "WONDERS' panda pavilion by a slow jungle river; BIRD PARADISE's huge airy mesh dome aviaries full of sleeping tropical birds; a "
 "timber BOARDWALK along the dark still reservoir with mist on the water and stars and a crescent moon overhead. Deep blue-green "
 "moonlit night, warm lantern pools of light, fireflies; cosy and magical, never spooky. ")
PROP = ("Each object is seen from a HIGH top-down game camera with a gentle 3/4 tilt, matching the attached prop sheets exactly in "
 "scale, ink outline, cel shading and warm night lighting. ")
BLD = ("Each building is seen from a HIGH top-down camera with a gentle 3/4 tilt at the SAME angle as the attached building sheets, so we "
 "look DOWN onto its whole ROOF (the roof takes up the top two thirds of each building) and see only a short strip of the front "
 "facade at the bottom. NOT a flat front elevation. No ground plate, no plaza and no pavement under or around a building: each "
 "building's outline is just its own roof, walls and steps. Each building alone in its cell with space around it. ")
KONGKANG = ("ENCIK KONGKANG, a soft-spoken patient SLOW LORIS night ranger at the Night Safari: round fluffy grey-brown body, a dark "
 "stripe down the back and a pale stripe between HUGE round shining amber eyes ringed with dark fur, tiny round ears, small careful "
 "hands, wearing a khaki ranger shirt with rolled sleeves, a green ranger's scarf, a wide-brimmed bush hat and a small red-filtered "
 "torch clipped to the shirt pocket")
ENGGANG = ("AUNTIE ENGGANG, a warm bustling RHINOCEROS HORNBILL bird keeper at Bird Paradise: glossy black feathers, a white tail "
 "band, a huge pale yellow bill with a curved orange-red casque on top, bright red-ringed eyes, wearing a sage-green keeper's apron "
 "full of pockets, a straw sun hat pushed back and a little pouch of seeds on her belt")
BINTU = ("DR BINTU, a cheerful sleepy-eyed BINTURONG (bearcat) wildlife vet and the host of the night show: long shaggy black fur "
 "with grey frosted tips, long white-edged whiskers, small tufted ears, a long thick bushy prehensile tail curled round, wearing a "
 "white vet's coat over a teal shirt, a stethoscope round the neck and round glasses")
HANTU = ("TUAN HANTU, the gloomy dignified BARN OWL boss of a night-watch gang for hire: a pale heart-shaped white face, big black "
 "eyes, golden-buff and grey speckled wings, long legs, wearing a long dark navy watchman's coat with brass buttons, a peaked "
 "watchman's cap and a small brass lantern; stern but a little vain, never scary")
J = {}

# ── the ground: four seamless textures
J['ground19'] = (L, SREF + ['ground18.png', 'ground17.png'], STYLE + SG + MND + "Four separate SQUARE seamless ground TEXTURES for a "
  "top-down game, matching the attached ground textures exactly in scale and style, seen from directly above, flat, evenly lit at "
  "night, no objects, no lines, no borders: a 2 by 2 grid of four squares that each fill their cell completely, edge to edge, with thin "
  "black gaps between them. Every texture must be CALM and LOW CONTRAST so characters drawn on top stay easy to read: no big motifs, "
  "no strong outlines. Top row: (1) the dark still water of a RESERVOIR at night seen from above: deep blue-green with soft faint "
  "ripples and a gentle moonlit sheen, no reflections of objects; (2) a dark TEAK BOARDWALK: weathered warm brown planks running left "
  "to right with faint gaps and a few nail heads. Bottom row: (3) a RAINFOREST FLOOR at night: dark green-brown leaf litter, moss "
  "and tiny ferns, low contrast; (4) a red-brown LATERITE PARK PATH: compacted reddish earth with fine gravel, soft and even.")

# ── buildings (green screen; the packer stretches each to its footprint)
J['mandai-bld'] = (L, SREF + ['kallang-bld.png', 'ubin-bld2.png', 'south-bld.png'], STYLE + SG + MND + "A game sprite sheet of six "
  "separate MANDAI buildings for a top-down game. " + BLD + "A 3 by 2 grid. Row 1: (1) the NIGHT SAFARI entrance lodge: a long "
  "low timber lodge with a big steep THATCHED roof of dark attap palm and carved timber posts, warm lantern light glowing under the "
  "eaves, flaming torches either side of the entrance, about twice as wide as deep; (2) the SINGAPORE ZOO entrance: a wide open "
  "pavilion with a leafy green living roof and timber beams, ticket windows glowing, potted palms, about twice as wide as deep; (3) "
  "RIVER WONDERS' panda pavilion: a round pavilion with a pale bamboo-lattice dome roof and misty glass walls, bamboo all round, "
  "about one and a half times as wide as deep. Row 2: (4) a cosy little SAFE HOUSE where two young chinchilla heroes hide out: a "
  "jade-green timber RANGER HUT on short stilts with a tin roof, a lantern by the door and a single paw-print shape on the door, about "
  "one and a half times as wide as deep; (5) a small MRT station entrance: a low curved green-glass canopy over an escalator going "
  "down, on slim white columns, with a few potted ferns, about twice as wide as deep; (6) an open-air night-show AMPHITHEATRE: a "
  "small timber stage with a thatched backdrop and warm spotlights, curved rows of log benches in front of it seen from above, about "
  "one and a half times as wide as deep. " + GRN)
J['mandai-aviary'] = (L, SREF + ['sg-bld.png', 'kallang-dome.png'],
  STYLE + SG + MND + "ONE building alone in the middle of the image for a top-down game: a huge BIRD PARADISE walk-through AVIARY "
  "seen from a HIGH top-down camera with a gentle 3/4 tilt at the SAME angle as the attached building sheets, so we look DOWN onto "
  "it: a big soft rounded DOME of fine dark mesh net held up by tall slender white masts, and through the net we see the tops of "
  "tropical trees, a little waterfall and pool, and sleeping colourful birds on branches, all in moonlight; at the bottom edge a short "
  "strip of its glass-and-timber entrance. A little wider than deep. No ground plate, no plaza round it. " + GRN)

# ── props
J['props19'] = (SQ, SREF + ['props1.png', 'props18.png', 'props17a.png'], STYLE + SG + MND + PROP + "A 4 by 4 grid of sixteen "
  "separate items, each centred in its own cell. Row 1 (the Night Safari): (1) a NIGHT SAFARI TRAM seen from DIRECTLY ABOVE pointing "
  "straight UP the image: a small green tractor unit pulling two open-sided carriages with canvas roofs and rows of benches, a soft "
  "lamp at the front; (2) a little thatched TRAM STOP shelter with a bench; (3) a low bamboo TRAIL LANTERN post with a warm amber "
  "glow; (4) a small round glowing TRAIL STUD set in the ground, pale green and gently luminous. Row 2 (the parks): (5) a tall "
  "clump of GIANT BAMBOO; (6) a section of rustic ZOO ROPE FENCE on timber posts; (7) a RIVER BOAT for a jungle river ride seen from "
  "DIRECTLY ABOVE pointing UP the image, with a canvas canopy and benches; (8) a FEEDING PERCH with three bright rainbow LORIKEETS on "
  "it. Row 3 (the mystery): (9) a wooden survey CRATE with a single black feather tucked under the rope; (10) an old 1930s concrete "
  "SURVEY TRIG PILLAR with a round brass plate on top; (11) a brass SEXTANT lying on an old rolled star chart; (12) a ranger's "
  "TORCH (flashlight) switched on with a short beam. Row 4: (13) a rustic LOG BENCH; (14) an ORANG-UTAN TREE PLATFORM: a timber "
  "platform high on a tree with ropes and hammocks; (15) a little tray of NECTAR CUPS for feeding birds; (16) a rolled paper RUBBING "
  "of a round brass plate, tied with string. No text anywhere. " + MAG)

# ── the night animals by the trails (real, four-legged wild animals, not dressed): resting, alert, bolting
J['beasts19'] = (L, ['folk1.png', 'boars.png', 'props18.png'], STYLE + SG + MND + "A game sprite sheet of FOUR real wild NIGHT "
  "ANIMALS of the Night Safari, natural animals on four legs (NOT dressed, NOT standing upright), cute and gentle, matching the "
  "attached sheets in size, ink outline and cel shading, each seen from a high top-down game camera with a gentle 3/4 tilt. A 3 by 4 "
  "grid of twelve frames; each ROW is one animal, left to right: (1) RESTING curled up asleep, eyes closed; (2) ALERT: head up, "
  "ears up, looking at the camera, its eyes SHINING bright in the dark (eyeshine); (3) BOLTING away to the RIGHT in profile, startled. "
  "Row 1: a FISHING CAT (stocky, olive-grey with dark spots and stripes). Row 2: a SUNDA PANGOLIN (brown overlapping scales; resting "
  "it is curled into a ball). Row 3: an INDIAN CRESTED PORCUPINE (long black-and-white quills; alert, its quills raised). Row 4: a "
  "RED GIANT FLYING SQUIRREL (russet fur, a big bushy tail; bolting, it glides with its skin flaps spread). " + MAG)

# ── Madam Sutera's night watch: barn owls in caps (the case and swap steps' guards in Mandai)
J['owls19'] = (L, ['bats.png', 'boars.png', 'play.png'], STYLE + SG + MND + "A game sprite sheet of ONE kind of character in ten "
  "poses: a cute anthropomorphic BARN OWL night watchman (pale heart-shaped face, big black eyes, golden-buff speckled wings, wearing "
  "a dark navy watchman's coat and a peaked cap), the same owl in every frame, matching the attached gang sheets exactly in size, "
  "style and layout. " + VIEW34 + "A 5 by 2 grid. Row 1: (1) walking TOWARD the camera, left foot forward; (2) the same, right foot "
  "forward; (3) walking AWAY from the camera, left foot; (4) the same, right foot; (5) hurrying to the RIGHT in profile, wings half "
  "open. Row 2: (6) hurrying to the RIGHT, the other foot; (7) HOOTING a call, head thrown back, beak open; (8) PEERING suspiciously, "
  "head turned almost upside down the way owls do; (9) MUNCHING a snack from a paper bag, distracted; (10) TAUNTING, wings on hips, "
  "smug. " + MAG)

# ── the chapter-twelve cast: portraits (four moods each), then full bodies copied from them
J['faces19'] = (SQ, ['portraits.png', 'faces18.png', 'faces17.png'], STYLE + SG + MND + "Four " + CAST6 + "A sheet of sixteen "
  "character portraits in a 4 by 4 grid. " + MOODS4 + "Row 1: " + KONGKANG + ". Row 2: " + ENGGANG + ". Row 3: " + BINTU + ". Row 4: "
  + HANTU + ". " + MAG)
J['cast19'] = (L, ['cast-ref19.png', 'folk1.png', 'sg-npc.png', 'play.png'], STYLE + SG + MND + "A game sprite sheet of four "
  "characters for a top-down game, the characters in the attached portrait strip (left to right = rows 1 to 4). " + BODY + POSES +
  "Row 1: " + KONGKANG + ", full body, khaki shorts and hiking boots. Row 2: " + ENGGANG + ", full body, standing upright on two "
  "feet, the apron to the knees. Row 3: " + BINTU + ", full body, the bushy tail curling behind. Row 4: " + HANTU + ", full body, the "
  "long navy coat to the knees, the lantern in one hand. " + MAG)

# ── the heroes' new actions (both heroes, the same eight)
def act19(who, desc):
    return (L, REF + [f'{who}-act.png', f'{who}-act18.png', f'{who}-act17.png'], STYLE + SG + CHIN + desc + f"A game sprite sheet of "
      f"{who.title()} only, matching the attached sprite sheets of the same character exactly (same proportions, same outfit, same "
      "scale). A 4 by 2 grid of eight separate poses of ONE character, each alone in its cell, all seen from a high top-down game "
      "camera with a gentle 3/4 tilt. Top row: (1) CREEPING ALONG A DARK TRAIL BY TORCH to the RIGHT in profile: crouched low, "
      "stepping softly on tiptoe, left foot forward, holding a small switched-on TORCH (flashlight) low in front pointing at the "
      "ground; (2) the same creep, right foot forward; (3) LISTENING: crouched still facing the camera, one paw cupped behind a big "
      "ear, the torch held down, eyes wide; (4) HUSH: standing frozen facing the camera, one paw finger to the lips, the torch "
      "switched off at the side. Bottom row: (5) STARTLED: jumping back with a gasp facing the camera, both paws up, ears straight "
      "up; (6) FEEDING A LORY: facing the camera, one arm held out holding a little nectar cup, a bright rainbow lorikeet perched on "
      "the wrist drinking from it, a delighted smile; (7) CLAPPING at a show: sitting on a log bench facing the camera, paws "
      "clapping, laughing; (8) RIDING A TRAM: sitting sideways facing the camera, one paw holding a rail at the side, the other "
      "pointing out at something amazing. " + MAG)
J['dora-act19'] = act19('dora', DORA)
J['enzo-act19'] = act19('enzo', ENZO)

# ── the interface: map landmarks and round icons
J['ui19'] = (L, SREF + ['icons.png', 'ui18.png', 'ui17.png'], STYLE + SG + "A game UI icon sheet painted like enamel shop signs and "
  "lacquered wood with gold trim, matching the attached icons in style, chunky and readable at small size. A 4 by 2 grid of eight "
  "separate items. Row 1: (1) a small map landmark icon of a THATCHED-ROOF jungle lodge with two flaming torches; (2) a small map "
  "landmark icon of a big mesh-dome AVIARY with a parrot; (3) a small map landmark icon of a round bamboo pavilion with a GIANT PANDA "
  "peeking out; (4) a map PIN shaped like a teardrop with a little BARN OWL face inside. Row 2: (5) a round icon of a switched-on "
  "TORCH (flashlight) with its beam, in a gold ring; (6) a round icon of two glowing animal EYES shining in the dark, in a gold ring; "
  "(7) a round icon of a bright rainbow LORIKEET, in a gold ring; (8) a round icon of a little open-sided SAFARI TRAM, in a gold ring. "
  "No text, no letters, no numbers. " + MAG)

# ── the three Mandai properties, each its own stand at four levels (shuttered, then three upgrades)
J['emp19-props'] = (L, SREF + ['emp-props4.png', 'emp18-props.png', 'mandai-bld.png'], STYLE + SG + MND + EMP + GROWP + "Row 1: a "
  "SAFARI SOUVENIR SHOP: a timber kiosk with a thatched awning, shelves of soft toy animals (a tiger, a panda, an elephant, an "
  "orang-utan), torches and ranger hats, no lettering. Row 2: a BOARDWALK KOPI STALL: a little timber stall on stilts by the water "
  "with a kopi urn, cups, kaya toast and lantern light. Row 3: a BIRD PARADISE NECTAR BAR: a bright cheerful juice bar with "
  "tropical fruit, cups of nectar and fruit juice, and a colourful parrot perch beside it. " + MAG)

# ── the chapter card (chapter twelve is not an ending: no new end panel)
J['chapter-12'] = (L, REF + ['portraits.png', 'faces19.png', 'chapter-11.png'], STYLE + SG + MND + CHIN + DORA + ENZO + PANEL + "A "
  "chapter title painting for 'night safari': Dora and Enzo creep side by side along a dark rainforest trail at night, both "
  "holding small torches low, ears up, listening; beside the trail in the ferns a sleepy fishing cat and a curled pangolin glow "
  "softly in a pool of lantern light, two pairs of animal eyes shine from the dark; behind them giant rain trees and bamboo, "
  "fireflies, an open-sided safari tram's lamp far off between the trees. Through a gap in the trees, the still Upper Seletar "
  "Reservoir under a crescent moon, and on it, very small, a sleek black seaplane with its lights off, a tall figure in black "
  "feathers on its float and a barn owl in a cap beside her. Leave the top fifth of the image as calm night sky. No text.")

# the market panel's scene: the Mandai market (every district's market has one)
from jobs2 import STALL, SP
J['stall-mandai'] = (L, SP + ['stall-kallang.png', 'faces19.png'], STYLE + SG + MND + STALL + "The stall-keeper is Auntie Enggang, a "
  "warm bustling RHINOCEROS HORNBILL keeper in a sage-green apron and straw sun hat (copy her from the attached portrait sheet, "
  "second row), behind the timber counter of a cosy jungle-lodge market stall under a thatched roof at night. Behind her: shelves of "
  "soft toy animals, jars of honey and nectar, bunches of bananas and rambutans, ranger torches, bird seed sacks, warm lanterns, and "
  "through the open side a glimpse of a moonlit mesh aviary dome. No text, signs are blank shapes.")
