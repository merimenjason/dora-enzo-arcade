# Jade Street, fourth batch of paintings: both chinchillas together (tag-team poses, the passenger's riding poses),
# the six cartoon gadgets (fire poses for each hero, the toys themselves, their shots and what they do when they land),
# the props the duo works with (levers, gates, ropes, ledges, lookout windows, the loot bag), the gadget stall, its
# keeper Tock and a mock-up of the new look.
from jobs import STYLE, CHIN, DORA, ENZO, MAG, VIEW34, TOP, L, SQ, REF, SREF

TOY = ("The GADGETS are chunky, rounded, brightly painted CARTOON TOYS made of lacquered wood, bamboo, paper and brass, clearly toys for a "
 "festival game, never anything that looks like a real weapon or a gun: (a) SLINGSHOT: a forked bamboo catapult with a red rubber band that "
 "flings round white sticky-rice balls; (b) PAINT SQUIRTER: a fat red-and-gold paper-lantern-shaped squeeze bulb with a short brass nozzle "
 "that splats blobs of pink and teal paint; (c) POPPER BOX: a small red lacquer box of party poppers, each a little red paper tube with a "
 "gold fuse that bursts into gold sparks and paper curls; (d) NET LAUNCHER: a short wide bamboo tube with a spring that throws a bundled "
 "rope net that opens wide; (e) BUBBLE BLOWER: a round jade-green bellows toy with a brass ring that blows big soapy bubbles and puffs of "
 "water spray; (f) CONFETTI CANNON: a short fat gold-and-red festival paper tube that bursts with confetti and streamers. ")
J = {}

def acts(who, desc):
    return (L, REF + [f'{who}-act.png', f'{who}-act5.png'], STYLE + CHIN + desc + f"A game sprite sheet of {who.title()} only, matching the "
      "attached sprite sheets of the same character exactly (same proportions, same outfit, same scale). " + VIEW34 +
      "A 4 by 3 grid of twelve separate poses of ONE character, each alone in its cell. Top row: (1) BOOST GIVER facing the camera: crouched "
      "low with both paws cupped together in front of the knees as a step for a friend, braced and smiling; (2) BOOSTED UP: springing high "
      "straight up with both arms stretched above the head reaching for a ledge, legs kicking, tail streaming down; (3) HOLDING UP a heavy "
      "gate facing the camera: both arms raised straight above the head pushing up an invisible weight, knees bent, cheeks puffed with "
      "effort; (4) the same hold, straining harder, eyes squeezed shut, one knee lower. Middle row: (5) HAULING a rope to the RIGHT in profile: "
      "leaning far back, both paws gripping an invisible rope out in front, feet braced; (6) the same haul, leaning further, one foot lifted; "
      "(7) DISTRACTING facing the camera: jumping up waving both arms wide above the head, mouth wide open calling out, very silly; (8) "
      "DISTRACTING: doing a goofy dance, one leg kicked up, tongue out, paws waggling beside the ears. Bottom row: (9) POUNCING to the RIGHT "
      "in profile: a flat diving leap with both arms stretched forward and paws open to grab; (10) POUNCING toward the camera: diving forward "
      "with both paws open, ears flung back; (11) SNATCHING to the RIGHT in profile: one arm shooting out sideways to grab something, the "
      "other arm back; (12) RELOADING facing the camera: looking down, stuffing something into a small satchel at the hip with both paws. " + MAG)

def fire(who, desc):
    return (L, REF + [f'{who}-act.png', f'{who}-act5.png'], STYLE + CHIN + desc + TOY + f"A game sprite sheet of {who.title()} only, "
      "matching the attached sprite sheets of the same character exactly (same proportions, same outfit, same scale). " + VIEW34 +
      "A 4 by 3 grid of twelve separate poses of ONE character, each alone in its cell, each using one toy gadget. Top row, all to the RIGHT in "
      "profile: (1) pulling back the SLINGSHOT band with a rice ball in it, one eye closed; (2) squeezing the PAINT SQUIRTER with both paws, "
      "a small pink blob leaving the nozzle; (3) tossing a red POPPER tube overarm, fuse sparkling; (4) firing the NET LAUNCHER from the hip, "
      "leaning back from the spring's kick. Middle row: (5) to the RIGHT in profile pumping the BUBBLE BLOWER, a few bubbles coming out; (6) to "
      "the RIGHT in profile, CONFETTI CANNON held up on the shoulder bursting with confetti, eyes squeezed happily; (7) facing the camera "
      "pulling back the SLINGSHOT toward the viewer; (8) facing the camera squeezing the PAINT SQUIRTER toward the viewer. Bottom row, all "
      "facing the camera: (9) tossing a POPPER tube toward the viewer; (10) firing the NET LAUNCHER toward the viewer; (11) pumping the "
      "BUBBLE BLOWER toward the viewer; (12) CONFETTI CANNON bursting toward the viewer. " + MAG)

def ride2(who, desc):
    return (L, REF + [f'{who}-ride.png'], STYLE + CHIN + desc + TOY + f"A game sprite sheet of {who.title()} only, for a top-down game, "
      "matching the attached riding sprite sheet of the same character exactly (same scale, same top-down view). Every figure is seen from "
      "DIRECTLY ABOVE (strict bird's-eye view, we see the top of the head, both big round ears from above, the shoulders and back of the "
      "jacket and the fluffy tail), riding as the PASSENGER on the back seat of a vehicle that points UP the image, but draw ONLY the "
      "character, no vehicle and no driver. A 4 by 2 grid of eight poses, all at the same scale. Top row: (1) sitting as a passenger, paws "
      "resting on the knees, leaning slightly left; (2) the same, leaning slightly right, ears bouncing; (3) leaning far out to the RIGHT "
      "side, one arm stretched out grabbing; (4) sitting and aiming the SLINGSHOT out to the RIGHT side. Bottom row: (5) sitting low in a "
      "seat, holding on with both paws, looking ahead; (6) sitting cheering with both arms up; (7) sitting turned, waving one arm back over "
      "the shoulder; (8) ducking low, both paws over the head. " + MAG)

J['dora-act6'] = acts('dora', DORA)
J['enzo-act6'] = acts('enzo', ENZO)
J['dora-fire'] = fire('dora', DORA)
J['enzo-fire'] = fire('enzo', ENZO)
J['dora-ride2'] = ride2('dora', DORA)
J['enzo-ride2'] = ride2('enzo', ENZO)
J['gear'] = (SQ, SREF + ['props2.png', 'events.png'], STYLE + TOY + "A game prop sheet of the toy gadgets, their ammunition and their "
  "shots, every object seen from a high top-down camera with a gentle 3/4 tilt, matching the attached props in style. A 4 by 4 grid of "
  "sixteen separate objects, each centred in its own cell. Row 1: (1) the SLINGSHOT; (2) the PAINT SQUIRTER; (3) the POPPER BOX, lid open "
  "with red tubes inside; (4) the NET LAUNCHER. Row 2: (5) the BUBBLE BLOWER; (6) the CONFETTI CANNON; (7) a small wooden SUPPLY CRATE "
  "with rope handles, lid shut, painted red with a gold band; (8) the same crate, lid off, full of rice balls, paint pots and red tubes. "
  "Row 3: (9) a single round white STICKY-RICE BALL with a little green leaf; (10) a single round glossy blob of PINK PAINT in flight with "
  "a teal swirl; (11) a single red POPPER tube in flight, its gold fuse fizzing with a little spark; (12) a tightly BUNDLED brown rope NET "
  "ball in flight. Row 4: (13) a single big shiny SOAP BUBBLE with rainbow sheen; (14) a spinning gold-and-red CONFETTI tube in flight, "
  "trailing streamers; (15) a brown rope NET opened out wide flat in the air, round with weighted corners; (16) a little cloth satchel of "
  "ammunition with rice balls and red tubes peeking out. No text anywhere. " + MAG)
J['splat'] = (SQ, SREF + ['magpies.png', 'wardens.png', 'riders.png', 'props1.png'], STYLE + TOY + "A game sheet of IMPACT effects and "
  "comic reactions for a cheerful top-down city game, every one seen from a high top-down camera with a gentle 3/4 tilt, matching the "
  "attached characters exactly. A 4 by 4 grid of sixteen separate items, each centred in its own cell. Row 1: (1) a squashed splat of "
  "white sticky rice on the ground; (2) a big flat SPLAT of pink paint on the ground with droplets; (3) a big flat SPLAT of teal paint on "
  "the ground with droplets; (4) a cheerful BURST of gold sparks, stars and red paper curls from a party popper. Row 2: (5) an empty rope "
  "NET lying spread flat on the ground; (6) a big soap BUBBLE POPPING into droplets and a splash of water; (7) a flat shiny PUDDLE of "
  "soapy water with a few bubbles on it; (8) a round BURST of colourful confetti and curly streamers. Row 3: (9) a cheeky magpie of the "
  "crew in a purple windbreaker TANGLED in a brown rope net, sitting dizzy; (10) the magpies' little wooden hand CART seen from directly "
  "above, wrapped up in a brown rope net, one wheel wobbling; (11) a portly raccoon market WARDEN in navy uniform SLIPPING on soap, legs "
  "flying up, cap flying off, comic; (12) the raccoon warden standing with PINK PAINT splattered across his face and uniform, cross, "
  "hands on hips. Row 4: (13) the raccoon warden DAZED, sitting down, little gold stars circling his head; (14) a cheeky magpie of the crew "
  "DIZZY in mid-air, dropping a lumpy cloth loot bag; (15) a striped market stall awning seen from above SPLATTERED with pink and teal "
  "paint blobs (only the splattered awning cloth, no stall frame); (16) the glamorous magpie boss in her purple-and-gold jacket and gold "
  "chain TANGLED in a brown rope net, indignant. Cheeky and funny, never hurt, no blood. No text anywhere. " + MAG)
J['tag'] = (L, SREF + ['props3.png', 'ladders.png', 'set1.png'], STYLE + "A game prop sheet of street objects for a top-down city game, "
  "every object seen from a HIGH top-down camera with a gentle 3/4 tilt, matching the attached props. A 4 by 3 grid of twelve separate "
  "objects, each centred in its own cell. Top row: (1) a cast-iron canal LEVER on a stone plinth, the red-handled lever pushed UP; (2) the "
  "same lever pulled DOWN, a little gold glint; (3) a heavy wooden canal SLUICE GATE with iron bands seen from above, SHUT across a narrow "
  "channel of dark water; (4) the same sluice gate RAISED open, water flowing through. Middle row: (5) a roll-down metal SHOP SHUTTER "
  "gate in a red frame, SHUT; (6) the same shutter rolled UP open, showing a dark gap; (7) a wooden PULLEY post with a thick rope coiled "
  "at its foot and a hanging hook; (8) a stack of wooden crates and a drainpipe against a wall corner, a good spot for a friend to boost "
  "someone up to the roof, a chalk-free plain look. Bottom row: (9) an upstairs shophouse WINDOW with open wooden shutters and a cheeky "
  "magpie LOOKOUT in a purple windbreaker peering out with binoculars; (10) the same window with its glass SPLATTERED with pink paint, "
  "the lookout behind it waving its wings blindly; (11) a lumpy cloth LOOT BAG tied with gold cord hanging from a string; (12) a small "
  "festival TOY-STALL cart with a red-and-gold striped awning, hung with toy slingshots, paper lanterns, party poppers and confetti tubes, "
  "nobody at it. No text on anything, signs are blank coloured shapes. " + MAG)
J['tock'] = (L, ['portraits.png', 'expr1.png'], STYLE + "Tock, a new character: a kindly old MOLE toymaker with tiny round spectacles, a "
  "soft brown velvet nose, a leather apron over a mustard-yellow shirt with rolled sleeves, a pencil behind one ear, little brass tools in "
  "the apron pocket; cheerful and clever. Paint him in exactly the style, framing and size of the attached portrait sheets. A sheet of six "
  "head-and-shoulders PORTRAITS of Tock facing the viewer in a 3 by 2 grid, the same framing in each, changing only the expression: Row 1: "
  "(1) CALM, a gentle friendly smile; (2) HAPPY, a big warm open smile, eyes bright; (3) WORRIED, brows raised and tilted, mouth small. "
  "Row 2: (4) CROSS, brows down hard, frowning; (5) SMUG, half-closed knowing eyes, one-sided grin; (6) SURPRISED, eyebrows up, mouth a "
  "small round O. Every portrait is a separate bust with plenty of empty background around it. No text, no symbols. " + MAG)
J['gadget-shop'] = ('landscape 1536x1024', ['stall-market.png', 'tock.png', 'gear.png'], STYLE + TOY + "A full-screen painted scene, "
  "matching the attached night-market stall scene exactly in style and framing: Tock the old MOLE toymaker (copy him from the attached "
  "portrait sheet: round spectacles, leather apron over a mustard-yellow shirt) stands behind the counter of his cosy festival TOY "
  "STALL at night, smiling and holding up a toy slingshot. The stall is hung with toy slingshots, paint squirters, net launchers, bubble "
  "blowers, confetti cannons and strings of red paper lanterns, with boxes of party poppers and baskets of white rice balls on the "
  "counter, little drawers of brass parts behind him, warm lantern light, a striped red-and-gold awning at the top. Leave the lower third "
  "of the picture as calm dark counter wood so a menu can sit over it. No text anywhere, every label and sign is a blank coloured shape. "
  "Full bleed, no border.")
J['mock-duo'] = ('landscape 1536x1024', ['play.png', 'ref-pair.png', 'dora-act5.png', 'enzo-act5.png'], STYLE + CHIN + DORA + ENZO + TOY +
  "A gameplay MOCK-UP screenshot of the top-down city game, matching the attached gameplay screenshot exactly in camera, scale and "
  "style: a lantern-lit night-market street from a high top-down 3/4 camera. Dora is crouched in a boost giving Enzo a leg-up toward a "
  "shophouse roof edge on the left; in the middle of the street the two chinchillas ride one red scooter together (Dora driving, Enzo "
  "sitting behind her flinging a rice ball from the slingshot at a magpie flying overhead with a loot bag); a raccoon warden slips on a "
  "soapy puddle near a fruit stall, confetti and paint splats scattered on the wet road. Small blank HUD plaques in the corners (no text, "
  "no numbers). No text anywhere.")
