# Jade Street, the sixteenth pass's paintings: the ride jobs and the weak spots. Two new job givers (Uncle Buaya, the
# Orchard Road ice-cream uncle, a saltwater crocodile, and Coach Kerbau, the Clarke Quay dragon-boat coach, a water
# buffalo): portraits in four moods, then full bodies copied from them; both heroes' new ride actions (tossing a parcel
# from the tandem's back saddle, ringing the ice-cream bell on the motorbike, the dragon boat's power stroke, handing a
# cone out of the sidecar); calmer Katong ground (the fourteenth pass's was still a visible checker); a smooth bank for
# Jurong Lake (its tiles step round the shore); and the six fourteenth-pass properties' own stands at four levels (they
# borrowed older paintings). Packed into their own atlases by scripts/jade-art16.py (not the full rebuild).
import importlib.util
from pathlib import Path
from jobs import STYLE, CHIN, DORA, ENZO, MAG, L, SQ, REF, SREF
from jobs6 import MOODS4, CAST6
from jobs7 import POSES, BODY

_f = Path(__file__).parent / 'jobs-empire.py'
_sp = importlib.util.spec_from_file_location('jobs_empire', _f); _emp = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(_emp)
EMP, GROWP = _emp.EMP, _emp.GROWP

SG = ("The setting is SINGAPORE at night, painted warmly and respectfully, celebrating its real neighbourhoods with care: no "
 "caricature, no stereotypes. Absolutely NO lettering anywhere: no text, letters, numbers, logos, brand marks or flags; every sign is "
 "a blank coloured shape. ")
J = {}

# ── calmer Katong ground: six candidates, one is picked (the old one was a two-colour checker that showed at full zoom)
J['ground7'] = (L, SREF + ['ground5.png', 'ground6.png'], STYLE + SG + "Six separate SQUARE seamless ground TEXTURES for a "
  "top-down city game, matching the attached ground textures exactly in scale and style, seen from directly above, flat, evenly lit "
  "at night, no objects, no lines, no kerbs, no borders: a 3 by 2 grid of six squares that each fill their cell completely, edge to "
  "edge, with thin black gaps between them. These are pavements for KATONG, an old Peranakan seaside neighbourhood. Every texture "
  "must be VERY CALM, LOW CONTRAST and ALL ONE COLOUR, so that characters and buildings drawn on top stay easy to read: NO checker "
  "pattern, NO alternating colours, NO motifs, NO strong outlines; the tiles differ from each other only by a faint natural "
  "variation in tone. Top row: (1) small plain square cement floor tiles all the SAME warm cream colour, thin soft grey seams; (2) "
  "small plain square tiles all the SAME muted sage green, thin soft seams; (3) small plain square clay tiles all the SAME soft faded "
  "terracotta, thin soft seams. Bottom row: (4) smooth pale warm-grey TERRAZZO with tiny speckles of cream and soft green chips, no "
  "dividing strips; (5) small plain HEXAGONAL tiles all the SAME pale cream, thin soft seams; (6) small even rectangular pavers in "
  "one warm sandstone colour laid in a plain running bond.")

# ── a smooth bank for Jurong Lake, laid over the lake's tiles as one ground decal (the water shows through its middle)
J['lake16'] = (L, SREF + ['ground6.png', 'props14b.png'], STYLE + SG + "ONE flat GROUND DECAL for a top-down city game, seen "
  "from DIRECTLY ABOVE like a map, matching the attached textures in scale and style: the smooth natural BANK round an OVAL Chinese "
  "garden lake. Draw a single closed smooth OVAL RING, about 1.6 times as wide as it is tall, that fills the image from edge to edge "
  "(its outer edge touches all four sides of the picture). The ring is a NARROW band (its width about one tenth of the oval's height) "
  "of rounded grey and tan river stones and a few mossy rocks along the water's edge, blending outward into a soft fringe of short "
  "dark green grass and small pebbles, with a few tufts of reeds and two or three small lily pads tucked against the stones. Smooth "
  "flowing curves all round, NO corners, NO steps, NO straight sections. At the TOP MIDDLE the ring has a narrow GAP where a little "
  "stream flows in, the stones curving neatly round into the stream's two banks. IMPORTANT: the whole INSIDE of the ring (where the "
  "lake water is) and everything OUTSIDE the ring are flat solid pure magenta (#FF00FF): do NOT paint any water, only the bank. "
  "No shadows outside the ring, no text.")

# ── the six fourteenth-pass properties, each its own stand at four levels (shuttered, then three upgrades)
def props(rows):
    return (L, SREF + ['emp-props4.png', 'emp-props5.png', 'tiong-bld.png'], STYLE + SG + EMP + GROWP + rows + MAG)
J['emp16-props1'] = props("Row 1: a CHWEE KUEH STALL in TIONG BAHRU MARKET: a hawker stall counter with a pale green and cream art "
  "deco tiled front, round metal steamer trays stacked with little white steamed rice cakes topped with brown preserved radish, a "
  "big aluminium steamer. Row 2: a BOOKSHOP CAFE on Yong Siak Street: a small white art deco shop unit with a rounded corner, a lit "
  "window of book shelves, a little coffee counter with a machine and a bistro table outside. Row 3: a RIVERSIDE SATAY STALL at Clarke "
  "Quay: a long charcoal satay grill under a small red canopy beside a strip of river railing, rows of skewers, smoke, little round "
  "tables. ")
J['emp16-props2'] = props("Row 1: a JAZZ LOUNGE at Clarke Quay: the front of a lilac-painted riverside godown with arched shuttered "
  "windows, a lit little stage inside with a double bass and a microphone stand, velvet rope posts and string lights. Row 2: a "
  "LANTERN SHOP by Jurong Lake: a wooden shop front with a green-tiled eave hung with paper lanterns shaped like rabbits, fish and "
  "lotus flowers, a craft table of brushes, paper and bamboo frames. Row 3: a LAKESIDE TEA GARDEN: an open tea pavilion with an "
  "upturned green-tiled roof, round stone tables with clay teapots and cups, a bamboo screen and a potted pine. ")

# ── two new job givers: portraits in four moods (bodies follow in 'cast16', from these)
BUAYA = ("UNCLE BUAYA, a big friendly old SALTWATER CROCODILE ice-cream uncle with a long green snout, a toothy kind grin, small "
  "amber eyes and laugh lines, wearing a white short-sleeved shirt, a sky-blue apron and a little white paper cap")
KERBAU = ("COACH KERBAU, a strong cheerful WATER BUFFALO dragon-boat coach with grey-black hide, wide curved horns, a broad pink "
  "nose and kind dark eyes, wearing a red paddling vest over a white team singlet with a whistle on a cord and a red headband")
J['faces16'] = (L, ['portraits.png', 'faces14.png', 'east-faces.png'], STYLE + SG + "Two " + CAST6 + "A sheet of eight character "
  "portraits in a 4 by 2 grid. " + MOODS4 + "Row 1: " + BUAYA + ". Row 2: " + KERBAU + ". " + MAG)
J['cast16'] = (L, ['cast-ref16.png', 'folk1.png', 'sg-npc.png', 'play.png'], STYLE + SG + "A game sprite sheet of two job-giver "
  "characters for a top-down city game, the characters in the attached portrait strip (left = row 1, right = row 2). " + BODY +
  POSES.replace('A 6 by 4 grid of twenty-four frames', 'A 6 by 2 grid of twelve frames') + "Row 1: " + BUAYA + ", full body, short "
  "legs and a long tail. Row 2: " + KERBAU + ", full body, in dark shorts and sports sandals. " + MAG)

# ── the heroes' new ride actions (character only; the game draws them over the ride, as in the attached riding sheets)
RIDER = ("seen from DIRECTLY ABOVE, pointing straight UP the image exactly like the riding poses in the attached sprite sheets (we "
 "see the top of the head, the big ears, the shoulders, the jacket's back, the knees and the tail), draw the CHARACTER ONLY, NO "
 "vehicle, no seat, no handlebars, no boat, ")
def act16(who, desc):
    return (L, REF + [f'{who}-ride15a.png', f'{who}-ride15b.png'], STYLE + SG + CHIN + desc + f"A game sprite sheet of "
      f"{who.title()} only, matching the attached sprite sheets of the same character exactly (same proportions, same outfit, same "
      "scale as the riding poses). A 4 by 2 grid of eight separate poses of ONE character, each alone in its cell, all at the SAME "
      "scale, each " + RIDER + "Top row: (1) on the BACK saddle of a tandem bicycle, TOSSING a parcel: the body twisted to the LEFT, "
      "the right arm drawn back across the chest holding a small brown paper parcel tied with string, the left paw on a short bar; "
      "(2) the same, the right arm flung out wide to the LEFT side, the paw open, the parcel just leaving it; (3) riding a MOTORBIKE, "
      "the left paw on the handlebar, the RIGHT paw raised high ringing a small brass hand BELL, mouth open singing; (4) the same, "
      "the bell swung the other way, ears bouncing. Bottom row: (5) a dragon-boat POWER STROKE: leaning far forward, both paws "
      "gripping a short plain wooden paddle plunged deep on the LEFT side, ears flat back with effort; (6) the same power stroke, "
      "the paddle deep on the RIGHT side; (7) sitting in a motorbike SIDECAR tub (upper body only, legs tucked out of sight), "
      "HOLDING OUT a pale vanilla ice-cream in a wafer cone at arm's length to the RIGHT side, smiling; (8) the same, holding out "
      "a pink ice-cream sandwich in a slice of bread to the RIGHT, the other paw waving. Props are plain wood or pale colours only. "
      + MAG)
J['dora-act16'] = act16('dora', DORA)
J['enzo-act16'] = act16('enzo', ENZO)
