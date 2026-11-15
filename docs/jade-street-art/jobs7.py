# Jade Street, seventh batch: the job givers in the world. Every person in PEOPLE (bar the heroes) painted full-body for
# the top-down city, copied from their portrait (the attached cast-ref strip, left to right = rows top to bottom), each
# with an idle (two breathing frames), a wave or beckon (two frames, used when they have a job for you) and a talk pose
# (two frames, used during their dialogue). Everyone faces the camera (the street). No lettering anywhere.
from jobs import STYLE, MAG, VIEW34
from jobs6 import ISLE, CROW

POSES = ("A 6 by 4 grid of twenty-four frames; each ROW is one character, always FACING THE CAMERA, standing on the spot, the same "
 "size, clothes and colours in every frame of the row, left to right: (1) IDLE, standing relaxed, arms at the sides; (2) IDLE breathing, "
 "the same pose with the chest and shoulders very slightly raised and the head tilted a touch, a tiny fidget; (3) WAVING hello with one "
 "arm raised high above the head, paw or wing open, a happy face; (4) the same wave with the raised arm swung to the other side; (5) "
 "TALKING, mouth open mid-word, one paw or wing held out to the side palm up, explaining; (6) TALKING, mouth open, both paws or wings "
 "raised to the chest, expressive. ")
BODY = ("Cute chubby cartoon anthropomorphic animals with big heads (about a third of their height) and small round bodies, exactly the "
 "proportions, ink outline and cel shading of the attached townsfolk sheet. " + VIEW34 + "Each character must match its portrait in the "
 "attached reference strip EXACTLY: the same species, face, markings, eye colour, hair, hat and clothes, now shown full body. No props "
 "bigger than a hand, no speech bubbles, no symbols, no text. ")
def cast(ref, rows):
    return ('landscape 1536x1024', [ref, 'folk1.png', 'sg-npc.png', 'play.png'], STYLE + ISLE + "A game sprite sheet of four job-giver "
            "characters for a top-down city game, the characters in the attached portrait strip (left to right = rows 1 to 4). " + BODY
            + POSES + rows + MAG)
J = {}
J['cast1'] = cast('cast-ref1.png', "Row 1: UNCLE KEE, an old TORTOISE grocer with round spectacles, a big olive shell on his back and a green "
  "apron. Row 2: CHEF MO, an OTTER chef in a white double-breasted chef jacket with red piping and a tall white chef hat. Row 3: AUNTIE "
  "PANG, a PANGOLIN auntie with brown scales, a red hibiscus flower behind her ear and a red-and-cream floral cheongsam blouse. Row 4: "
  "BROTHER HERON, a tall gentle grey HERON temple keeper in saffron-orange robes with a wooden bead necklace. ")
J['cast2'] = cast('cast-ref2.png', "Row 1: MASTER REN, a RED PANDA lion-dance master in a black mandarin-collar jacket with gold trim and a "
  "red sash. Row 2: KIRI, a blue-and-orange KINGFISHER bumboat captain in a woven conical straw hat and a brown waistcoat. Row 3: MR LIM, "
  "a black MYNAH bird news-stand vendor with a yellow beak, a brown flat cap, braces and a cream shirt. Row 4: BIG BO, a big WATER BUFFALO "
  "dock foreman with curved horns, a navy work shirt and a yellow hi-vis vest, taller and broader than the others. ")
J['cast3'] = cast('cast-ref3.png', "Row 1: CAPTAIN BRISTLE, a RACCOON chief warden with a big moustache, a navy uniform and a peaked cap. Row "
  "2: GIZMO, a spotted orange-and-yellow GECKO arcade DJ with big teal headphones round his neck and a teal neon-trimmed jacket. Row 3: "
  "MADAME GLINT, the crow boss: a glamorous " + CROW + " with purple eyeshadow, a gold hoop earring, a gold chain and a deep violet-and-"
  "gold brocade jacket. Row 4: PIP, a young cheeky " + CROW + " in a violet zip-up windbreaker, smaller than the others. ")
J['cast4'] = cast('cast-ref4.png', "Row 1: AUNTIE HOON, a plump GOOSE auntie with a short curly grey perm, a bright green-and-red floral "
  "blouse and a small white tissue pack in her pocket. Row 2: UNCLE TEO, a big round black SUN BEAR coffee-shop uncle with a pale chest "
  "mark, a white singlet, a striped towel over one shoulder and loose shorts. Row 3: AH BENG, a young ROOSTER with a spiky dyed orange "
  "crest, sunglasses pushed up on his head and a loud green-and-yellow printed short-sleeved shirt. Row 4: MR ONG, an old BADGER in a "
  "faded flat cap and a worn blue polo shirt. ")
J['cast5'] = cast('cast-ref5.png', "Row 1: LILY SPARKLE, a glamorous PEACOCK singer with a fanned blue crest, big emerald earrings and a long "
  "sequined emerald-and-gold gown, a little tail train of peacock feathers. Row 2: UNCLE GOH, an old grey MACAQUE uncle with round reading "
  "glasses, a white singlet and loose grey trousers. Row 3: MA SLEEK, a sleek brown OTTER matriarch with a cream throat, a teal-and-orange "
  "striped neckerchief, a gold captain's cap and a shell earring. Row 4: BIG KOW, a MACAQUE gang boss with olive-grey fur, a pink face, "
  "a baggy lime-green vest and a gold bottle-cap chain, slouchy and bossy. ")
J['cast6'] = cast('cast-ref6.png', "Row 1: MR KAMAL, a fluffy round COLUGO station master with huge dark eyes, mottled grey-brown fur, a navy "
  "station uniform jacket, a peaked cap with a jade band and a whistle on a cord. Row 2: MS VANDA, a RHINOCEROS HORNBILL producer with a "
  "big orange-and-yellow casque, glossy black feathers, a white silk scarf and a headset microphone. Row 3: LORD LEPAK, a big lazy WATER "
  "MONITOR LIZARD boss standing on his hind legs, long tail on the ground, an orange-and-teal checked bandana, gold sunglasses pushed up "
  "and a bottle-cap medal. Row 4: DIRECTOR KAW, a " + CROW + " in a sharp slate-grey business suit with a purple tie and a gold lapel pin. ")
J['cast7'] = ('square 1024x1024', ['cast-ref7.png', 'folk1.png', 'play.png'], STYLE + "A game sprite sheet of TOCK, a kindly old MOLE "
  "toymaker copied exactly from the attached portrait: tiny round spectacles, a soft brown velvet nose, a leather apron over a mustard-"
  "yellow shirt with rolled sleeves, a pencil behind one ear. " + BODY + "A 3 by 2 grid of six frames, always FACING THE CAMERA, "
  "standing on the spot: Row 1: (1) IDLE, standing relaxed; (2) IDLE breathing, chest slightly raised, head tilted a touch; (3) WAVING "
  "hello with one arm raised high. Row 2: (4) the same wave with the arm swung the other way; (5) TALKING, mouth open, one paw held out "
  "palm up; (6) TALKING, mouth open, both paws raised to the chest. " + MAG)
