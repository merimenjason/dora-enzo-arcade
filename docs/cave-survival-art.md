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
