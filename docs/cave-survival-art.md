# Cave-survival style references

These are visual development references for a proposed cosy cave-survival arcade game starring Dora and Enzo. They are ready for comparison with the gameplay mock-up; no game integration or new menu entry is included.

## Files

- `public/art/cave-survival/gameplay-style-test.png`: 1536 × 1024 gameplay concept showing the purple cave arena, warm lighting, heroes, approaching critters, diggable gold-flecked blocks, dust puffs and blue crystal drops.
- `public/art/cave-survival/sprites-0.png`: 1536 × 1024 RGBA sprite concept sheet with eight subjects in four columns and two rows. The background contains actual alpha-zero pixels; inspect edge alpha and framing before treating the sheet as a production atlas.
- `docs/cave-survival-image-prompts.md`: prompts and layout refinements used with the built-in OpenAI image generation tool.

## Sprite order

Each equal grid cell is 384 × 512 pixels. Read left to right, then top to bottom:

1. Enzo: grey chinchilla, white chest, black eyes, yellow miner helmet and acorn.
2. Dora: ivory-white chinchilla, very dark ruby-burgundy eyes, tiny pickaxe.
3. Fuzzy black soot sprite with white eyes.
4. Pink cave mite with two antennae.
5. Mossy-green shelled beetle.
6. Grey stone rock wyrm with moss and a sleepy grumpy face.
7. Blue crystal.
8. Brown rock cube flecked with gold.

## Review before implementation

Preserve the soft gouache treatment, thin dark-plum outlines, rounded silhouettes and cosy mood. Dora's eyes must stay nearly black burgundy, never pink. Review the camera angle against the actual game mock-up and test silhouette readability with cells displayed at 50 pixels tall. The concept scene does not establish final gameplay scale or production-ready animation frames. Decide which floor, wall, block and effect assets are needed separately before implementation.

## Enzo animation draft — correction required

`public/art/cave-survival/enzo-animation-draft.png` is the first animation generation: 1536 × 1024 RGBA, six columns by four rows of 256 × 256 cells. It is a review draft, not a production atlas. The complete seven-image brief is saved in `docs/cave-survival-animation-prompts.md`, and the normalized prompt actually used for this first generation is in `docs/cave-survival-enzo-generation-prompt.md`.

The brief explicitly requests Enzo first and a correction prompt if his frames drift. This draft fails that gate, so Dora, critters, effects, environment, floor and boss have not been generated yet.

Observed issues:

- Walk frames occupy about 180–193 px in width and 190–202 px in height, exceeding the requested 180 × 180 maximum in most frames.
- Walk frame silhouette bottoms range from local y=237 to y=243 (exclusive bounds), versus the requested foot line at local y=226. Most non-hopping frames in subsequent rows also move relative to the requested line.
- Some spin-frame content reaches cell boundaries, so crops cannot safely be treated as independent sprites.
- Spin poses face left/back despite the requested right-facing rule. Some special frames include motion lines, and the throw release frame does not clearly show the released acorn.

`docs/cave-survival-enzo-frame-review.json` records the per-cell visible bounds measured at alpha > 128. These bounds include tools, tails, acorns and stars; they are silhouette measurements rather than semantic foot coordinates. Background transparency exists, but edge/low-alpha cleanup still needs inspection.

Next step: write a correction prompt for Enzo's grid, frame size, anchoring and pose details before generating the remaining sheets. No animation integration has been attempted.
