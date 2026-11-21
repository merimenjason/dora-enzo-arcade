# Jade Street, the twentieth pass's paintings: no new district, chapter or cast. The side jobs added round the later
# districts reuse their givers and most of their props; what is new is the heroes' two new actions for the `rounds`
# side jobs (draping a flower garland at Little India's temple and shop doors; reaching up to hang a songbird cage at
# Tiong Bahru's bird corner or a lantern in the Chinese Garden, then stepping back to admire it) and six carried things
# (a Tiong Bahru Bakery box, a songbird cage, a plate of chwee kueh, a bolt of batik, a bowl of Katong laksa and a box
# of Uncle Buaya's potong). The game's TEXT uses real Singapore names; the paintings keep the no-lettering rule.
from jobs import STYLE, CHIN, DORA, ENZO, MAG, L, SQ, REF, SREF

SG = ("The setting is SINGAPORE at night, painted warmly and respectfully, celebrating its real places with care: no "
 "caricature, no stereotypes. Absolutely NO lettering anywhere: no text, letters, numbers, logos, brand marks or flags; every sign is "
 "a blank coloured shape. ")
PROP = ("Each object is seen from a HIGH top-down game camera with a gentle 3/4 tilt, matching the attached prop sheets exactly in "
 "scale, ink outline, cel shading and warm night lighting. ")
J = {}

# ── the heroes' new actions (both heroes, the same four)
def act20(who, desc):
    return (SQ, REF + [f'{who}-act.png', f'{who}-act18.png', f'{who}-act17.png'], STYLE + SG + CHIN + desc + f"A game sprite sheet of "
      f"{who.title()} only, matching the attached sprite sheets of the same character exactly (same proportions, same outfit, same "
      "scale). A 2 by 2 grid of four separate poses of ONE character, each alone in its cell, full body, all at the SAME scale, all seen "
      "from a high top-down game camera with a gentle 3/4 tilt. Top row: (1) HOLDING UP A FLOWER GARLAND: facing the camera, both paws "
      "raised to chest height holding a long thick garland of white jasmine buds and orange marigolds that hangs down in a loop, a "
      "gentle proud smile; (2) DRAPING THE GARLAND: facing the camera, leaning forward a little, both arms stretched out forward and "
      "down, laying the same jasmine-and-marigold garland down over something in front of them, eyes on it, careful. Bottom row: "
      "(3) HANGING SOMETHING UP HIGH: seen from BEHIND (facing away from the camera), up on tiptoe, both arms stretched straight up "
      "over the head with the paws together as if hooking something onto a high hook, tail fluffed, ears tall (the paws are EMPTY); "
      "(4) ADMIRING IT: facing the camera, one step back, head tilted up, paws clasped together under the chin, delighted. " + MAG)
J['dora-act20'] = act20('dora', DORA)
J['enzo-act20'] = act20('enzo', ENZO)

# ── six carried things (the packer files each with the zone of the district its side job is in)
J['props20'] = (L, SREF + ['props1.png', 'props18.png', 'props17a.png'], STYLE + SG + PROP + "A 3 by 2 grid of six separate items, "
  "each centred in its own cell, each about the size a chinchilla could carry in both paws. Row 1 (Tiong Bahru): (1) a white "
  "BAKERY BOX with the lid half open, showing golden flaky CROISSANTS and two round kouign-amann pastries, tied with plain twine; "
  "(2) a domed bamboo SONGBIRD CAGE with a hook on top, a little white-rumped shama bird inside on a perch, a small porcelain water "
  "cup; (3) a round plate of CHWEE KUEH: six little white steamed rice cakes in a ring, each topped with brown preserved radish, a "
  "dab of red chilli at the side. Row 2: (4) a folded BOLT of BATIK cloth in deep indigo, jade and gold with flower patterns, tied "
  "with a ribbon; (5) a bowl of KATONG LAKSA: orange coconut curry soup with short cut noodles, prawns, cockles and fishcake slices, "
  "a spoon in it and no chopsticks; (6) a small open cool-box of POTONG ICE CREAM: rectangular ice-cream bars on wooden sticks, "
  "some wrapped in plain paper, in red bean, yam and durian colours, wisps of cold. No text anywhere. " + MAG)

# ── the vehicle perks (the lead's scope addition): owned vehicle businesses give the heroes a ride. Two new rides, both
# empty, each in three liveries (business levels 1, 2 and 3): a Singapore taxi cab with a big open sunroof over the
# driver's seat (so the driver is seen from above) and a sit-on-top sea kayak from the Siloso hire.
TOP = "Seen from DIRECTLY ABOVE (strict bird's-eye top-down view, like a map), every vehicle pointing straight UP the image (front at the top). "
J['rides20'] = (L, SREF + ['vehicles.png', 'rides15.png'], STYLE + SG + "A game sprite sheet of six empty vehicles for a top-down "
  "city game, matching the attached vehicle sheets EXACTLY in viewing angle, ink outline, cel shading, chunky toy-like proportions "
  "and scale. " + TOP + "A 3 by 2 grid: six tall cells, one vehicle in each, nobody in any of them. Row 1: three versions of the SAME "
  "Singapore TAXI CAB, a compact four-door saloon (about as long as the attached delivery van is, a little narrower), with a "
  "LARGE OPEN SUNROOF cut in the roof over the front seats so the empty driver's seat, the steering wheel and the dashboard show "
  "through it, a blank roof-sign box behind the sunroof, small round headlights at the top and red tail lights at the bottom, "
  "black tyres just showing at the corners; (1) painted bright sky BLUE with a white roof sign; (2) the same cab painted deep "
  "JADE GREEN with a thin gold stripe down each side; (3) the same cab painted glossy BLACK with a gold stripe, gold wheel trims "
  "and a gold roof sign. Row 2: three versions of the SAME sit-on-top SEA KAYAK for one, long and narrow (about four times as long "
  "as it is wide), pointed at both ends, a moulded seat with a little backrest in the middle, a small bungee cord net on the front "
  "deck, a double-bladed paddle resting ACROSS it beside the seat; (4) bright ORANGE; (5) TURQUOISE; (6) violet PURPLE with a "
  "gold stripe. No text anywhere. " + MAG)
RIDER = ("seen from DIRECTLY ABOVE, pointing straight UP the image exactly like the riding poses in the attached sprite sheets (we "
 "see the top of the head, the big ears, the shoulders, the jacket's back, the knees and the tail), draw the CHARACTER ONLY, NO "
 "vehicle, no seat, ")
def ride20(who, desc):
    return (L, REF + [f'{who}-ride.png', f'{who}-ride15b.png'], STYLE + SG + CHIN + desc + f"A game sprite sheet of {who.title()} "
      "only, matching the attached sprite sheets of the same character exactly (same proportions, same outfit, same scale as the "
      "riding poses). A 3 by 2 grid of six separate poses of ONE character, each alone in its cell, all at the SAME scale. Top row, "
      "each " + RIDER + "(1) DRIVING a car: sitting, both paws held up in front at the sides of a round steering wheel (draw the plain "
      "grey steering WHEEL in the paws, nothing else), ears up, looking ahead; (2) the same, turning the wheel, one paw over the "
      "top of it, the body leaning a little to that side; (3) PADDLING A KAYAK: sitting with legs out in front, both paws gripping a "
      "long plain wooden DOUBLE-BLADED paddle held crosswise, the LEFT blade dipped down into the water on the left. Bottom row: (4) "
      "the same kayak pose with the RIGHT blade dipped down on the right; then two poses seen from a high top-down game camera "
      "with a gentle 3/4 tilt, full body: (5) GETTING INTO A CAR: side-on, one foot lifted high stepping in, one paw raised gripping "
      "the top edge of a plain open car door (draw only the door, a plain flat sky-blue panel), ducking the head; (6) WAVING THE "
      "CAR OVER: standing facing the camera, holding up a small plain phone in one paw, the other paw raised high waving, smiling. "
      "Props are plain grey, wood or pale colours only. " + MAG)
J['dora-ride20'] = ride20('dora', DORA)
J['enzo-ride20'] = ride20('enzo', ENZO)
