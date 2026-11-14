# Jade Street, fifth batch part two (owner's additions on 15-11): the magpies become Singapore HOUSE CROWS (the Kaypoh
# Crows), two new cheeky rival gangs (the Riverside Romp otter family on the quays, the Bukit Bunch macaque mob), the
# "fine city" props (pigeons, bird seed, gum, litter, the warden's ticket book) and new hero poses for them.
# Every crow sheet is a repaint of the original sheet, which is attached as the first reference so the layout, scale and
# everything that is not a crow stay the same (the packer only takes the crow frames from the repaint).
import re
from jobs import STYLE, CHIN, DORA, ENZO, MAG, VIEW34, TOP, L, SQ, REF, SREF

SG = ("The setting has a warm SINGAPORE Chinatown feel (an invented quarter, no real brands): hawker food, kopitiam coffee "
 "shops, pastel shophouses, tropical plants. Never use real brand names, company names, logos or flags. ")
CROW = ("Singapore HOUSE CROWS: glossy jet-black feathers on the wings, back, face and crown, a soft smoky ash-grey hood around the neck, "
 "nape and chest, a stout black beak and bright cheeky eyes, cartoon cute and mischievous, never scary")

def crowify(p: str) -> str:
    p = p.replace("MAGPIES in black-and-white plumage with glossy blue-green wing sheen", CROW)
    p = p.replace("black-and-white plumage with glossy blue-green wing sheen", "glossy jet-black feathers with a smoky ash-grey hood and nape")
    p = p.replace("black magpie feather with a blue-green sheen", "glossy black crow feather with a grey base")
    p = p.replace("black-and-white feathers", "black-and-grey crow feathers")
    p = p.replace("Magpie Crew", "Kaypoh Crows crew").replace("MAGPIE", "HOUSE CROW").replace("Magpie", "House crow").replace("magpie", "house crow")
    return p

def repaint(J0, ids):
    out = {}
    for i in ids:
        size, refs, prompt = J0[i]
        out[f'{i}-crow'] = (size, [f'{i}.png'] + refs, "REPAINT the FIRST attached image exactly: keep its layout, grid, cell positions, "
          "framing, scale, colours and every character, object and background that is not a bird of the rival crew, unchanged. The ONLY "
          f"change: every MAGPIE (black-and-white bird with blue-green sheen) becomes a {CROW}, keeping its pose, clothes and props. "
          + crowify(prompt))
    return out

J = {}
CROW_IDS = ['magpies', 'riders', 'portraits', 'glint', 'set2', 'splat', 'events', 'expr3', 'tag', 'debris',
            'title', 'chapter-1', 'chapter-2', 'chapter-3', 'chapter-5', 'end-3', 'story-2']

def add_repaints(JOBS):
    J.update(repaint(JOBS, CROW_IDS))

# ── the two new gangs
OTTER = ("the RIVERSIDE ROMP, a cheeky family of smooth-coated OTTERS: sleek glossy brown fur, pale cream throats, small round ears, "
 "whiskery grins, thick tapering tails, each wearing a little teal-and-orange striped sailor neckerchief, playful smugglers, never scary. ")
MONK = ("the BUKIT BUNCH, a mob of cheeky long-tailed MACAQUE monkeys: olive-grey fur, pink faces, tufty crowns, long tails, each in a "
 "baggy lime-green vest, greedy for snacks and shiny bags, mischievous and silly, never scary. ")
J['otters'] = (L, SREF + ['magpies.png', 'folk1.png'], STYLE + SG + "The rivals: " + OTTER + "A game sprite sheet of one otter of the "
  "family. " + VIEW34 + "A 4 by 3 grid of twelve poses, each alone in its cell. Top row: (1) waddle-walking toward the camera, left foot "
  "forward; (2) the same, right foot forward; (3) walking away seen from behind, tail swinging; (4) the same, other foot. Middle row: (5) "
  "galloping to the RIGHT in profile, back arched, hugging a small wooden crate; (6) the same, legs stretched out; (7) SWIMMING seen from "
  "DIRECTLY ABOVE, head and back above dark water with a V-shaped ripple wake, pointing UP the image; (8) the same swim, tail flicking, "
  "ripples the other way. Bottom row: (9) a cheeky TAUNT standing on its hind legs, paws on the belly, giggling; (10) DIZZY, sitting, little "
  "stars circling; (11) playing JOYFULLY with a big soap bubble on its nose, forgetting everything; (12) TANGLED in a brown rope net, "
  "wriggling with a grin. " + MAG)
J['macaques'] = (L, SREF + ['magpies.png', 'folk1.png'], STYLE + SG + "The rivals: " + MONK + "A game sprite sheet of one macaque of "
  "the mob. " + VIEW34 + "A 4 by 3 grid of twelve poses, each alone in its cell. Top row: (1) knuckle-walking toward the camera, left paw "
  "forward; (2) the same, right paw forward; (3) walking away seen from behind, long tail curled up; (4) the same, other paw. Middle row: "
  "(5) RUNNING to the RIGHT in profile on all fours clutching a stolen plastic bag of bread buns in its mouth; (6) the same, legs stretched; "
  "(7) a sudden SNATCH: lunging forward facing the camera with both arms out grabbing; (8) MUNCHING a fluffy white steamed bun with both "
  "paws, cheeks stuffed, eyes closed, blissful. Bottom row: (9) a cheeky TAUNT pulling down one eyelid and sticking out its tongue; (10) "
  "STARTLED high in the air, all four limbs spread, fur on end, comic; (11) DIZZY sitting, stars circling; (12) SPLATTERED with pink paint "
  "and wiping its eyes, cross. " + MAG)
MOODS4 = ("Each ROW is one character shown four times as a head-and-shoulders PORTRAIT facing the viewer, in the same framing, size, "
 "clothes and colours, changing ONLY the facial expression, left to right: (1) CALM, a sly relaxed look; (2) HAPPY, a big cheeky open "
 "grin; (3) WORRIED, brows tilted up, mouth wobbly; (4) CROSS, brows down hard, frowning. Every portrait is a separate head-and-shoulders "
 "bust with plenty of empty background around it. No speech bubbles, no symbols, no text. ")
J['gang-faces'] = (L, ['portraits.png', 'expr1.png'], STYLE + SG + "Two NEW rival gang bosses, anthropomorphic animals painted exactly "
  "in the style, framing and size of the attached portrait sheet. A sheet of eight character portraits in a 4 by 2 grid. " + MOODS4 +
  "Row 1: MA SLEEK, the matriarch of a family of smooth-coated OTTERS: sleek glossy brown fur, cream throat, a teal-and-orange striped "
  "neckerchief, a gold captain's cap tilted back, a little shell earring. Row 2: BIG KOW, the boss of a mob of long-tailed MACAQUE "
  "monkeys: olive-grey fur, pink face, a tufty crown, a baggy lime-green vest, a gold chain made of bottle caps. " + MAG)
J['gang-rides'] = (L, SREF + ['riders.png', 'sg-rides.png'], STYLE + SG + "A game sprite sheet for a top-down city game. " + TOP +
  "A 3 by 2 grid of six separate sprites, two animation frames each. Top row: (1) a little OTTER in a teal-and-orange striped neckerchief "
  "paddling a small LOG RAFT loaded with two wooden crates and a sack, ripples around it; (2) the same raft, the paddle on the other side. "
  "(3) a long-tailed MACAQUE in a lime-green vest riding on top of a rattling three-wheeled hawker pushcart, tail streaming behind. "
  "Bottom row: (4) the same macaque cart, wheels turned; (5) MA SLEEK, a smooth-coated otter matriarch in a gold captain's cap, at the "
  "tiller of a small chugging wooden motor sampan with crates, wake behind; (6) the same sampan, wake splashing the other side. " + MAG)

# ── the fine city
J['fines'] = (SQ, SREF + ['props1.png', 'events.png', 'wardens.png'], STYLE + SG + "A game prop sheet for a top-down city game, every "
  "item seen from a HIGH top-down camera with a gentle 3/4 tilt, matching the attached art in size and style. A 4 by 4 grid of sixteen "
  "separate items, each centred in its own cell. Row 1: (1) a plump grey city PIGEON with an iridescent green-purple neck standing; "
  "(2) the same pigeon PECKING at the ground; (3) a pigeon FLAPPING up into the air, wings wide; (4) a small paper BAG of bird seed "
  "spilling a few seeds. Row 2: (5) a small flat stick of CHEWING GUM in a plain mint-green wrapper with no writing; (6) a squashed pink "
  "blob of gum stuck on the pavement; (7) a small heap of LITTER: a crumpled paper cup, a scrunched tissue and a soft drink can with no "
  "logo; (8) a blank cream paper TICKET slip with a torn perforated edge and a red stripe along the top, no writing. Row 3: (9) a portly "
  "RACCOON market warden in navy uniform and peaked cap facing the camera WRITING in a small notebook with a pencil, stern but comic; "
  "(10) the same raccoon warden holding OUT a paper ticket at arm's length toward the camera, eyebrows raised; (11) a wooden smuggling "
  "CRATE bobbing half-sunk in dark water with ripples; (12) a bunch of ripe yellow BANANAS. Row 4: (13) a small red handbag with a gold "
  "clasp; (14) a white steamed BUN in a little paper wrapper; (15) a green metal street litter BIN with a domed lid; (16) a small woven "
  "basket of silver fish. No text anywhere. " + MAG)

def act8(who, desc):
    return (L, REF + [f'{who}-act.png', f'{who}-act7.png'], STYLE + SG + CHIN + desc + f"A game sprite sheet of {who.title()} only, "
      "matching the attached sprite sheets of the same character exactly (same proportions, same outfit, same scale). " + VIEW34 +
      "A 4 by 2 grid of eight separate poses of ONE character, each alone in its cell. Top row: (1) FEEDING PIGEONS facing the camera: "
      "scattering a pawful of seeds from a little paper bag, happy; (2) CHEWING GUM facing the camera: blowing a big pink bubble, cross-eyed; "
      "(3) PAYING A FINE facing the camera: holding out a few gold coins with both paws, ears drooping, sheepish; (4) READING A TICKET "
      "facing the camera: holding a long blank paper slip that unrolls to the floor, jaw dropped, fur on end. Bottom row: (5) TOSSING a "
      "bunch of yellow bananas to the RIGHT in profile, arm swinging; (6) BENDING to pick up a crumpled paper cup from the ground, facing "
      "the camera; (7) dropping the paper cup into an invisible bin to the RIGHT in profile, proud; (8) a big THUMBS UP facing the camera, "
      "eyes shut with delight, as if after tasting something delicious. " + MAG)
J['dora-act8'] = act8('dora', DORA)
J['enzo-act8'] = act8('enzo', ENZO)
