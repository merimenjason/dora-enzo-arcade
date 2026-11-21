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
