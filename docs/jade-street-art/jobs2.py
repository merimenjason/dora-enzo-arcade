# Jade Street, second batch of paintings: the loading screen, the five market stalls, the painted map, the storybook
# (opening, chapter cards, ending), the jobs book and phone UI, the controls page, new hero actions, seated townsfolk,
# street events, traffic lights and plaza props, the festival, fireworks, and more buildings and landmarks.
from jobs import STYLE, CHIN, DORA, ENZO, MAG, GRN, VIEW34, TOP, L, SQ, REF, SREF

CAST = ("The cast (copy them exactly from the attached portraits sheet): Uncle Kee, an old TORTOISE grocer with round spectacles and a "
 "green apron; Auntie Pang, a PANGOLIN trader with a floral blouse and a flower in her scales; Kiri, a KINGFISHER boat lady with a woven "
 "conical hat; Big Bo, a WATER BUFFALO dock foreman in a hi-vis vest; Gizmo, a GECKO arcade DJ with big headphones and a neon jacket; "
 "Madame Glint, a glamorous MAGPIE boss with a gold chain and a purple-and-gold jacket; the Magpie Crew are cheeky magpies in purple "
 "windbreakers; the wardens are portly RACCOONS in navy uniforms. ")
PANEL = ("A full-bleed storybook illustration panel for the game's story, painted edge to edge (no border, no frame, no panel gutters), "
 "cinematic high 3/4 camera, rich lantern light. ")
STALL = ("A shop scene seen straight on from the customer's side of a wooden market counter, painted edge to edge. The counter runs across "
 "the bottom third of the image and holds six wooden trays of goods: green jade bangles, golden mooncakes, tea tins, blue-and-white "
 "porcelain bowls, painted silk fans and ripe mangoes. Behind the counter, centred and fully visible from the top of the head to the "
 "waist, stands the stall-keeper, friendly, smiling and leaning on the counter. Keep the stall-keeper's whole head and the goods inside "
 "the middle 70% of the width and away from the top and bottom edges. No other characters in front. ")
SP = ['portraits.png', 'trade.png']
J = {}
J['loading'] = (L, REF + ['title.png'], STYLE + CHIN + DORA + ENZO + "A wide painting for a loading screen: dusk over the tiled rooftops of the "
  "harbour quarter, Dora and Enzo standing on a flat rooftop lighting a long string of red paper lanterns that runs across the whole image, "
  "the first lanterns glowing, the rest still dark; the canal, the temple on its hill and the harbour cranes far behind under a violet sky. "
  "Keep the bottom quarter calm dark rooftop tiles (space for a progress bar added later). No text.")
for d, who, back in (
    ('market', 'Uncle Kee, an old TORTOISE grocer with round spectacles and a green apron', 'a red-and-white striped awning, red paper lanterns, the busy night-market street with food stalls and steam behind'),
    ('temple', 'Auntie Pang, a PANGOLIN auntie trader with a floral blouse and a flower in her scales, holding a wooden abacus', 'a jade-green tiled stall roof with incense smoke, the temple gate and pine trees on the hill behind'),
    ('canal', 'Kiri, a KINGFISHER boat lady with a woven conical hat, selling from the deck of her moored wooden canal boat (the counter is the boat\'s gunwale)', 'the canal with a stone arched bridge, lantern reflections in the water and canal-side houses behind'),
    ('docks', 'Big Bo, a big friendly WATER BUFFALO dock foreman in a hi-vis vest (the counter is a row of stacked wooden crates)', 'harbour cranes, stacked shipping containers, a warehouse door and the sea under the night sky behind'),
    ('arcade', 'Gizmo, a GECKO DJ with big headphones and a neon jacket, behind a glowing chrome counter', 'pink, purple and teal neon arcade signs (blank shapes), claw machines and a glowing street behind')):
    J[f'stall-{d}'] = (L, SP, STYLE + CAST + STALL + f"The stall-keeper is {who}. Behind: {back}. No text, signs are blank shapes.")
J['map-paper'] = (L, ['city.png'], STYLE + "A flat sheet of aged parchment map paper seen from directly above, warm cream with soft tea "
  "stains, faint paper fibres and two gentle fold creases, filling the whole image edge to edge, evenly lit. Nothing drawn on it: no "
  "drawings, no lines, no objects, no text, no border.")
J['map-frame'] = (L, ['city.png'], STYLE + "A wide ornate frame for a treasure map, seen flat from the front: a band of dark red "
  "lacquered wood with a thin gold inner trim and gold cloud-curl ornaments at the four corners, a small red paper lantern with a tassel "
  "hanging from each top corner. The frame band is even in width along all four sides. The whole inside of the frame is flat pure chroma "
  "green (#00FF00), and everything outside the frame is also flat pure chroma green. No text.")
J['map-icons'] = (SQ, ['city.png'], STYLE + "A sheet of sixteen painted MAP ICONS like the pins on the attached map, chunky and readable when "
  "small, NO text, in a 4 by 4 grid, each centred in its own cell. Row 1, round gold-rimmed map pins with a pointed tip at the bottom, each "
  "with a picture in its round badge: (1) a striped market stall awning; (2) a little teal house with a round moon door; (3) a spanner and a "
  "gear; (4) a small jade-green flag. Row 2, more pins: (5) a glowing red paper lantern; (6) a golden lucky cat; (7) a paintbrush with a dab of "
  "paint; (8) a gold compass star. Row 3, tiny painted map LANDMARKS seen from a high 3/4 view: (9) a temple with a curved jade roof; (10) a "
  "three-tier red pagoda; (11) a yellow harbour crane; (12) a neon arcade building. Row 4: (13) a stone arched canal bridge; (14) a "
  "red-and-white lighthouse; (15) a small ferry boat; (16) a lantern-lit food hall roof. " + MAG)
J['map-fog'] = (L, ['city.png'], STYLE + "Six separate fluffy painted FOG CLOUD banks for a map, soft lavender, pale violet and misty "
  "blue-white with gentle cel shading and soft curly edges, like the fog over the locked districts in the attached map, in a 3 by 2 grid, "
  "each a wide puffy cloud centred in its own cell. " + GRN.replace('Do not use bright green on the subjects. ', 'Do not use any green on the clouds. '))
J['story-1'] = (L, REF + ['portraits.png', 'city.png'], STYLE + CAST + PANEL + "The night before the Lantern Festival: a lantern-lit shophouse "
  "street in the harbour quarter being decorated, townsfolk animals hanging strings of red paper lanterns and paper dragons, Uncle Kee the "
  "tortoise grocer waving from his shop, the temple on its hill glowing in the distance. Warm, busy and happy. No text.")
J['story-2'] = (L, REF + ['portraits.png', 'city.png'], STYLE + CAST + PANEL + "Inside the temple hall at night: the quarter's five lucky "
  "heirlooms glowing on a red-and-gold altar (a carved jade dragon, a small golden temple bell, a pearl lantern, a silver koi fish statuette "
  "and a red-and-gold phoenix drum) while cheeky Magpie Crew magpies in purple windbreakers swoop down through the open roof to snatch them, "
  "Madame Glint the magpie boss directing them with a grin, a portly raccoon warden asleep on a bench. Mischievous, never scary. No text.")
J['story-3'] = (L, REF + ['portraits.png', 'city.png'], STYLE + CHIN + DORA + ENZO + CAST + PANEL + "The morning after: the empty altar "
  "cushions, worried townsfolk (Uncle Kee the tortoise, Auntie Pang the pangolin, a rabbit and a duck auntie) and Captain Bristle the "
  "raccoon warden scratching his head, while Dora and Enzo arrive on a little red scooter at the temple steps, curious and determined. No text.")
J['story-4'] = (L, REF + ['city.png'], STYLE + CHIN + DORA + ENZO + PANEL + "Dora and Enzo taking the case: the two chinchillas on a "
  "rooftop at night, side by side, Dora pointing out over the glowing harbour quarter and Enzo grinning with his fists ready, the five "
  "districts spread out below (night market lanterns, the temple hill, the canal, the dock cranes, the neon arcade strip), a magpie silhouette "
  "flying off with something shiny. Heroic and fun. No text.")
for i, (name, scene) in enumerate([
    ('Night Market', 'the busy Night Market street of food stalls, woks and steam, a magpie in a purple windbreaker pedalling off on a cargo cart with a carved jade dragon glinting on top'),
    ('Temple Hill', 'Temple Hill: the temple with a curved jade roof at the top of a hundred stone steps, a pagoda and pine trees, a small golden bell glinting on a magpie cart rolling down the hill road'),
    ('Canal Quarter', 'the Canal Quarter: a canal with stone arched bridges and lantern boats, a magpie on a small motorboat speeding away with a glowing pearl lantern'),
    ('the Docks', 'the Docks at night: yellow harbour cranes, stacked containers and warehouses by the sea, a silver koi statuette glinting on a crate'),
    ('Arcade Strip', 'the neon Arcade Strip: glowing purple, pink and teal blank signs, rooftops, Madame Glint the magpie boss on a neon-purple scooter holding a red-and-gold phoenix drum')], 1):
    J[f'chapter-{i}'] = (L, REF + ['portraits.png', 'city.png'], STYLE + CAST + PANEL + f"A chapter title painting: {scene}. Leave the top "
      "fifth of the image as calm night sky (space for a title added later). No text.")
J['end-1'] = (L, REF + ['portraits.png', 'city.png'], STYLE + CHIN + DORA + ENZO + CAST + PANEL + "The heirlooms come home: the five lucky "
  "heirlooms (a carved jade dragon, a golden bell, a pearl lantern, a silver koi and a phoenix drum) back on the red-and-gold temple altar, "
  "glowing; the townsfolk cheering and throwing petals; Dora and Enzo bowing happily in front; Madame Glint the magpie boss sheepishly "
  "handing over the last one next to a beaming raccoon warden captain with a big moustache. No text.")
J['end-2'] = (L, REF + ['city.png'], STYLE + CHIN + DORA + ENZO + PANEL + "The Lantern Festival: hundreds of glowing paper sky lanterns "
  "rising over the whole harbour quarter at night, reflected in the canal and the harbour; Dora and Enzo on a rooftop in the foreground "
  "letting go of their own sky lantern together. Magical and warm. No text.")
J['end-3'] = (L, REF + ['portraits.png', 'city.png'], STYLE + CHIN + DORA + ENZO + CAST + PANEL + "The festival party: fireworks of gold, "
  "red and violet bursting over the harbour, a red-and-gold lion dance in the lantern-lit street, the whole cast celebrating together "
  "(Uncle Kee, Auntie Pang, Kiri, Big Bo, Gizmo, the raccoon wardens and even the magpies in purple windbreakers dancing), Dora and Enzo in "
  "the middle cheering. No text.")
J['ui2'] = (L, SREF, STYLE + "A game UI sheet painted like enamel shop signs and lacquered wood with gold trim. A 4 by 3 grid of twelve "
  "separate elements, blank, NO text. Top row: (1) a bronze medal on a short red ribbon; (2) a silver medal on a jade ribbon; (3) a gold medal "
  "on a red-and-gold ribbon, shining; (4) an empty medal slot: a dull dark round dish. Middle row: (5) a small smartphone in a jade-green case "
  "with a gold rim, front view, the screen plain dark indigo; (6) a rounded cream speech-bubble plaque with a gold rim, blank; (7) a little "
  "retro car radio with two round dials and a blank glowing amber display; (8) a closed book with a red lacquer cover and gold corners. "
  "Bottom row: (9) a brass stopwatch; (10) an unlit calm paper lantern with a jade leaf; (11) a small carved jade charm on a red cord; "
  "(12) a painted wooden signpost with one arrow-shaped blank board. " + MAG)
J['controls'] = (L, SREF, STYLE + "A sheet of painted CONTROL pictures for a game's how-to-play page, chunky and friendly, NO text and no "
  "letters on any key. A 4 by 3 grid of twelve separate items. Top row: (1) a single blank square keyboard key cap, cream with a gold rim; "
  "(2) a wide blank space-bar key cap; (3) four blank arrow key caps in a T shape; (4) a blank wide shift key cap. Middle row: (5) a "
  "computer mouse; (6) a round jade joystick knob in a gold ring, seen from above; (7) a smartphone held sideways in two hands; (8) a "
  "soft round fluffy chinchilla paw with one finger tapping. Bottom row: (9) a bead-curtain doorway with two eyes peeking out; (10) a "
  "glowing red paper lantern with little heat waves; (11) a small red scooter with speed streaks; (12) a brass bulb horn. " + MAG)

def act4(who, desc):
    return (L, REF + [f'{who}-act.png'], STYLE + CHIN + desc + f"A game sprite sheet of {who.title()} only, exactly like the attached sheet of "
      f"{who.title()} (same face, fur, outfit and scale). " + VIEW34 + "A 4 by 3 grid of twelve separate poses. Top row: (1) PUSHING to the "
      "RIGHT in profile: both paws pressed forward against something heavy (not drawn), leaning hard, back foot braced; (2) the same push with "
      "the other foot forward; (3) PUSHING away from the camera, seen from behind, both paws forward, leaning; (4) the same with the other foot "
      "forward. Middle row: (5) letting go of a small glowing paper sky lantern upward with both paws, facing the camera, joyful; (6) looking up "
      "in wonder at fireworks, one paw pointing up, facing the camera; (7) reading a small smartphone held in both paws, facing the camera; "
      "(8) sitting on a low stool eating noodles from a bowl with chopsticks, facing the camera. Bottom row: (9) dancing happily, both arms "
      "up, one leg kicked; (10) kneeling down to pat something small on the ground in front, facing the camera; (11) clapping with delight, "
      "facing the camera; (12) walking toward the camera holding an open red umbrella overhead. " + MAG)
J['dora-act4'] = act4('dora', DORA)
J['enzo-act4'] = act4('enzo', ENZO)
J['folk3'] = (L, ['folk1.png', 'folk2.png', 'play.png'], STYLE + "A game sprite sheet of the SAME six animal townsfolk as the two attached "
  "sheets (copy their species, clothes and colours exactly). " + VIEW34 + "A 4 by 3 grid of twelve frames: each character SITTING on a low "
  "round wooden stool, facing the camera, eating noodles, two frames each (chopsticks raised to the mouth; bowl lowered, chewing happily). "
  "Row 1: (1, 2) the rabbit in a floral shirt; (3, 4) the beagle dog in an apron. Row 2: (5, 6) the squirrel girl in a yellow cardigan and "
  "green skirt; (7, 8) the ginger cat in a blue shirt. Row 3: (9, 10) the duck auntie (basket on the ground); (11, 12) the little hedgehog "
  "boy in a striped tee. " + MAG)
J['events'] = (L, ['folk2.png', 'play.png', 'vehicles.png'], STYLE + "A game sprite sheet for street events. " + VIEW34 + "A 4 by 3 grid "
  "of twelve separate items. Top row: (1) a fluffy yellow DUCKLING waddling toward the camera, left foot forward; (2) the same, right foot "
  "forward; (3) the duckling waddling to the RIGHT in profile; (4) the duckling sitting, lost, a little teary. Middle row: (5) a cheerful "
  "old MONKEY busker in a waistcoat sitting on a crate playing a two-string erhu fiddle, bow to the left; (6) the same, bow to the right; "
  "(7) an upturned straw hat with a few gold coins in it; (8) a puff of grey engine smoke. Bottom row: (9) a small boxy white delivery van "
  "with a jade stripe seen from DIRECTLY ABOVE, front pointing UP, its bonnet propped open with steam rising; (10) a magpie in a purple "
  "windbreaker running to the RIGHT with a ripe mango in its beak; (11) the same magpie flapping, mango in beak, mid-hop; (12) a little "
  "paper bag of spilled oranges. " + MAG)
J['street'] = (L, SREF, STYLE + "A game prop sheet for a top-down city game, every object seen from a HIGH top-down camera with a gentle 3/4 "
  "tilt. A 4 by 3 grid of twelve separate objects. Top row: (1) a black traffic-light pole with three round lamps, the RED lamp lit; (2) the "
  "same pole, the AMBER lamp lit; (3) the same pole, the GREEN lamp lit; (4) a round stone fountain with a jade dragon spout and water. "
  "Middle row: (5) a huge banyan tree canopy seen from above; (6) a round food-court table with two little stools; (7) an open red umbrella "
  "seen from DIRECTLY ABOVE; (8) an open jade-green umbrella seen from directly above. Bottom row: (9) a curved stone plaza bench; (10) a "
  "clump of bamboo seen from above; (11) a round koi pond with lily pads seen from above; (12) a bronze crane statue on a stone plinth. " + MAG)
J['festival'] = (L, SREF, STYLE + "A game prop sheet for the Lantern Festival in a top-down city game, objects seen from a HIGH top-down camera "
  "with a gentle 3/4 tilt. A 4 by 3 grid of twelve separate objects. Top row: (1) a big red festival arch made of paper lanterns; (2) a long "
  "paper dragon lantern carried on poles, seen from above; (3) one small glowing paper sky lantern, warm gold; (4) a cluster of three "
  "glowing sky lanterns. Middle row: (5) a festival stage with two red drums; (6) a giant glowing rabbit lantern; (7) a giant glowing carp "
  "lantern; (8) a string of colourful triangular bunting flags, horizontal. Bottom row: (9) a lantern-lit pagoda parade float; (10) a "
  "festival food stall with a gold awning; (11) a tall pole with three hanging gold lanterns; (12) a pile of red paper confetti and petals. " + MAG)
J['fireworks'] = (L, SREF, STYLE + "Six separate painted FIREWORK bursts on a night-sky game layer, round, bright, cel-shaded sparks with "
  "trails, in a 3 by 2 grid, each centred in its own cell: (1) a big gold chrysanthemum burst; (2) a red peony burst; (3) a violet and "
  "white ring burst; (4) a blue willow burst with drooping trails; (5) an orange crackle burst; (6) a small white-gold sparkle star. "
  + GRN.replace('Do not use bright green on the subjects. ', 'Do not use any green in the fireworks. '))
SHOP = ("each one shophouse seen from a HIGH top-down camera with a slight 3/4 tilt: the tiled ROOF fills the top two thirds of the square "
  "seen from above, and the bottom third shows the front facade at street level with a five-foot-way arcade, shutters, a glowing shop "
  "window, blank coloured sign plaques and potted plants. Each building is a SQUARE footprint that fills its own cell. ")
J['shops2'] = (L, ['shops1.png', 'play.png'], STYLE + "Six separate BUILDING tiles for a top-down city game, painted exactly like the "
  "attached sheet of shophouses, " + SHOP + "A 3 by 2 grid of six different shophouses: (1) a lilac facade with a bakery window; (2) a "
  "terracotta facade with a tailor's window of hanging cloth; (3) a dark green facade with a herbal pharmacy of jars; (4) a blue-tiled "
  "corner coffee shop with marble tables under the arcade; (5) a white facade with a goldsmith's glowing window; (6) a red facade with a "
  "lantern-maker's workshop, lanterns hanging. " + MAG)
J['roofs2'] = (L, ['roofs.png', 'play.png'], STYLE + "Six separate ROOFTOP tiles for a top-down city game, painted exactly like the attached "
  "rooftop sheet, seen from almost DIRECTLY ABOVE, each a SQUARE that fills its cell: the backs of shophouse roofs, no walls visible. A 3 by "
  "2 grid of six different rooftops: (1) terracotta roof with a vine-covered pergola garden; (2) a roof with a wooden water tower and a "
  "pigeon coop; (3) jade-green glazed tiles around a small square light-well courtyard; (4) grey slate with rooftop laundry and potted "
  "chillies; (5) terracotta with skylights and a sleeping cat; (6) dark tiles with the back of a big neon sign frame. " + MAG)
BLD = ("each seen from a HIGH top-down camera with a slight 3/4 tilt: roof seen from above fills the top two thirds, the bottom third shows "
  "the front facade at ground level. Each one fills its own SQUARE cell. ")
J['bld3'] = (L, ['buildings2.png', 'play.png'], STYLE + "Six separate BUILDING tiles for a top-down city game, painted like the attached "
  "sheet, " + BLD + "A 3 by 2 grid: (1) a temple-hill tea pavilion with a curved green roof and a round moon gate; (2) an incense shop with "
  "drying racks of incense coils; (3) a calligraphy school with a little garden courtyard; (4) a canal boathouse with a slipway; (5) a canal "
  "flower-seller's house dripping with hanging plants; (6) a canal noodle house with a turning waterwheel. " + GRN)
J['bld4'] = (L, ['buildings2.png', 'play.png'], STYLE + "Six separate BUILDING tiles for a top-down city game, painted like the attached "
  "sheet, " + BLD + "A 3 by 2 grid: (1) a dockside fish-market hall with an open front and ice crates; (2) a rope and net store with coils "
  "of rope and hanging nets; (3) a ship chandlery with lifebuoys and lanterns; (4) a neon hotel with little balconies and glowing windows; "
  "(5) a toy-robot shop with glowing purple windows; (6) a bubble-tea parlour with pastel pink and teal neon. " + GRN)
J['landmarks2'] = (L, ['landmarks.png', 'play.png'], STYLE + "Six separate LANDMARK BUILDINGS for a top-down city game, painted like the "
  "attached landmark sheet, " + BLD + "A 3 by 2 grid: (1) a grand covered night-market FOOD HALL with a red-and-gold curved roof and open "
  "sides full of lantern light; (2) a temple BELL TOWER pavilion with a big bronze bell; (3) an old canal-side CLOCK TOWER with a blank "
  "clock face; (4) a red-and-white striped LIGHTHOUSE on a stone base; (5) a neon CINEMA palace with a glowing blank marquee; (6) a "
  "Chinese OPERA theatre with a curved stage roof and red pillars. " + GRN)
