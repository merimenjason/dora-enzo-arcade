# Jade Street, a small polish on the nineteenth pass: the perched RAINBOW LORIKEETS round Bird Paradise's feeding perch
# in Mandai. Until now the game drew them with the round UI icon (i-lory, a lorikeet in a gold ring); this sheet paints
# the birds themselves in a few poses (perched, preening, wings half open) so the ones on the perch can vary and move a
# little, and the feeding perch again without the birds the prop sheet painted onto it. Painted on MAGENTA (the birds
# are green, so never on chroma green). Packed by scripts/jade-art19b.py.
#
# Run it as its own small runner (the shared gen.py is never edited): python3 jobs19b.py <folder>
# The folder holds the reference sheets (play.png, props19.png, beasts19.png) and gets lory19b.png and perch19b.png. As
# in gen.py the prompt comes BEFORE the image flags and stdin is closed (a prompt piped through stdin is dropped).
from jobs import STYLE, MAG, L, SQ, SREF

SG = ("The setting is SINGAPORE at night, painted warmly and respectfully. Absolutely NO lettering anywhere: no text, letters, "
 "numbers, logos or flags. ")
LORY = ("a real RAINBOW LORIKEET (a small parrot, NOT dressed, NOT anthropomorphic, on two feet): a bright violet-BLUE head, a "
 "short curved orange-RED beak, a red-orange eye, a yellow-green collar, an orange-red and yellow barred breast, a deep blue belly, "
 "bright GRASS-GREEN back, wings and a long pointed green tail, grey feet; ")
J = {}
J['lory19b'] = (L, SREF + ['props19.png', 'beasts19.png'], STYLE + SG + "A game sprite sheet of ONE kind of bird in six poses: "
  + LORY + "the same bird in every frame, matching the lorikeets on the feeding perch in the attached prop sheet exactly in style, "
  "ink outline, cel shading and colours, and the attached animal sheet in finish, seen from a high top-down game camera with a "
  "gentle 3/4 tilt, softly lit by warm lantern light at night. Each bird is alone in its own cell with space around it, standing "
  "on NOTHING (no branch, no perch, no ground, no shadow): the feet gripping an invisible bar at the bottom of the cell. All six at "
  "the SAME scale. A 3 by 2 grid. Row 1: (1) PERCHED, side view facing RIGHT, upright and alert, wings folded, tail hanging down; "
  "(2) PERCHED, facing the camera, head tilted a little, wings folded; (3) PREENING, side view facing RIGHT, the head turned back "
  "over the shoulder, the beak tucked into the feathers of its folded wing. Row 2: (4) WINGS HALF OPEN, side view facing RIGHT, "
  "both wings lifted and half spread showing green above and the red-and-yellow underwing, as if stretching or about to hop; "
  "(5) WINGS HALF OPEN, facing the camera, both wings half spread out to the sides, beak open in a happy chirp; (6) BOBBING, side "
  "view facing RIGHT, leaning forward low with the head down and tail up, wings folded, as if about to nibble. No text. " + MAG)

# the feeding perch itself with NO birds on it, so the painted lorikeets above are the only birds on it (the pass's prop
# sheet painted three birds onto the perch; the game now draws its own, moving)
J['perch19b'] = (SQ, SREF + ['props19.png'], STYLE + SG + "ONE object alone in the middle of the image for a top-down game, "
  "seen from a HIGH top-down game camera with a gentle 3/4 tilt: an EMPTY bird FEEDING PERCH, copied exactly from the perch in the "
  "attached prop sheet (second row, last item) in shape, size, ink outline, cel shading and colours: a sturdy upright timber post "
  "on a round pale stone base with a few tropical leaves round its foot, rope lashed round the top of the post, and a long rustic "
  "horizontal BRANCH lashed across the top as the perching bar, a short stub of branch on one side. NO birds and nothing else on "
  "it: the bar is bare. The object fills most of the image. No text. " + MAG)

if __name__ == '__main__':
    import subprocess, sys
    from pathlib import Path
    D = Path(sys.argv[1]).resolve()
    for i, (size, refs, prompt) in J.items():
        if (D / f'{i}.png').exists(): print(i, 'exists'); continue
        cmd = ['codex', 'exec', '--skip-git-repo-check', '-C', str(D), '-s', 'workspace-write', '-o', str(D / f'last-{i}.txt'),
               f'Generate ONE image with your image generation tool and save it in this folder as {i}.png ({size}). Do not write or edit any other files, do not post-process the image with code, and do not touch any git repository. Save exactly what the image tool produced. {prompt}']
        for r in refs: cmd += ['-i', str(D / r)]
        with open(D / f'log-{i}.txt', 'w') as lg:
            p = subprocess.run(cmd, stdin=subprocess.DEVNULL, stdout=lg, stderr=subprocess.STDOUT, timeout=1500)
        f = D / f'{i}.png'
        print(i, 'exit', p.returncode, f.stat().st_size if f.exists() else 'MISSING', flush=True)
