# Midnight Kitchen painted art

Generated with the built-in imagegen tool. Sources copied unchanged into `public/art/kitchen`. Portraits reuse existing Saga art and never alter Saga progression. Runtime canvas crops use measured alpha bounds rather than dividing the chefs at the row seam: Pip and Ember's ears begin above the nominal second row. Rendering preserves complete tools, tails, ears and paws. No generated animation-frame swapping is used.

## Backdrop — generate

Source `exec-a3c25d91-9051-4529-8704-f610d3994c2d.png`; destination `room.png`. Reference: Saga `land-0.png` for painted style.

Exact prompt:

> Use case: stylized-concept. Production backdrop for EMBER & CLOVER: MIDNIGHT KITCHEN, a cozy storybook chinchilla bakery game. Wide1536x1024. Premium painterly timber interior with warm golden lanterns, clover motifs and midnight-indigo windows overlooking moonlit woodland roofs. Slightly elevated SIDE-ON stage view, playful lovingly detailed wood, stone and copper, rich painted storybook game materials. Back wall in upper45%: LEFT a stocked leafy pantry shelf and flour sacks; CENTER a small golden stone hearth oven with safely enclosed orange fire; RIGHT a wooden serving hatch and bell with a window to the stars. Lower55% is a broad CLEAN open honey-coloured wood floor with a long low foreground prep table only along BOTTOM EDGE so gameplay overlays and standing chinchilla chefs remain visible. Keep central60% uncluttered and softly lit; recognizable work stations across back wall, generous empty space for UI overlays. Dry kitchen, no sink, water, spilled drinks or bath. No characters, creatures, portraits, text, menus, signs, captions, labels, icons or UI. Background texture should support readable game labels placed later. Beautiful and inviting warm gold / clover green / indigo palette, no harsh neon.

## Chefs — generate, transparent

Source `exec-3d48ba96-d286-4fef-bb75-755e2bd69805.png`; initial chef source. References: Saga `heroes-0.png` and `heroes-2.png`.

Exact prompt:

> Use case: stylized-concept. Transparent RGBA production sprite atlas for a cozy woodland chinchilla kitchen game. EXACT 2 columns x2 rows, FOUR complete full-body chinchilla chefs, standing still in three-quarter view facing RIGHT. Same richly painted fur/material/identity as references, natural short paws, fluffy tails, rounded ears, generous transparent space at least12% in every cell, same scale, no objects crossing cell borders. No scene, floor, glow, shadows, text, labels or grid. Top LEFT DORA: white fur, very DARK burgundy RUBY eyes, green neckerchief, soft sage-green chef apron; holding a small wooden mixing bowl at belly, little whisk/spoon. Top RIGHT ENZO: grey fur, black eyes, orange neckerchief, tan apron; holding a flat wooden serving tray level with forepaws. Bottom LEFT PIP: warm cream-beige fur, black eyes, green neckerchief, cream apron with small green clover embroidery; holding a short wooden rolling pin horizontally at belly. Bottom RIGHT EMBER: reddish-brown fur, black eyes, orange neckerchief, dark forest-green apron; holding a safe wooden baker's peel/spatula angled forward, no flame on character. Aprons with simple gold buckles, gentle determined cheerful expressions. Exactly two forepaws and two hind paws, no swords, shields, bows, staves or jewellery except scarf/apron buckles. These are ONE stable standing artwork each, not multiple animation poses.

An edit requested darker eyes and additional gutters; it retained the original layout and was not adopted. Source transparency was checked directly: background alpha is zero, despite the image preview showing coloured RGB beneath transparent pixels. Only alpha-bearing artwork is drawn.

## Food — generate, transparent

Source `exec-c2b24801-d273-4103-ab86-84daceb6316a.png`; destination `food.png`. Reference: Saga `equipment.png`.

Exact prompt:

> Use case: stylized-concept. Transparent RGBA equipment-like FOOD ICON ATLAS for Ember & Clover: Midnight Kitchen. EXACT3 columns x2 rows, SIX separate fully complete icons centered with15% transparent margins in each cell. Polished painted storybook gold/brown/clover/berry textures matching reference. No characters, background, shadow, glow, text, labels, grid or frame. TOP LEFT one golden clover-shaped crisp biscuit with a small clover leaf; TOP MIDDLE one elegant little moonberry tart with purple berries and golden pastry crust; TOP RIGHT one closed-lid porcelain mug of herbal tea with a tiny clover motif and mint leaf, no spilled liquid or steam. BOTTOM LEFT one folded golden honey pastry with a tiny flower garnish; BOTTOM MIDDLE one leafy hay/herb wrap neatly tied with a chive; BOTTOM RIGHT one small woven basket containing a folded flour sack, moonberries and leafy herbs, pantry icon. Consistent scale, easy strong silhouettes, wholesome food and cozy game illustration, generous true transparency. First five are served treat recipes, last pantry supply basket.

## Refinement attempt — edit, transparent (not adopted)

Reference `chefs.png`; output `exec-e34a9101-f1cf-4c54-aff3-1224aa58f016.png`. Exact prompt:

> Edit this production chef atlas. Preserve all four exact character identities, tools, aprons, fur, pose and painted style. Remove ALL cloudy coloured background halos: actual fully transparent RGBA background, no glow, no backdrop, no ground shadow. Keep exactly 2 columns by 2 rows with generous transparent gutters; shrink each complete chef slightly to ensure full ears, tails, paws and tools stay well inside their cell with 8% margin all sides. Change ONLY Dora top-left eye colour to very DARK burgundy ruby red, nearly black in shadow, no pink or magenta. Enzo grey, Pip cream, Ember red-brown stay unchanged. No text or grid.

## Final chef refinement — edit, transparent (adopted)

Reference: original chef atlas. Source `exec-4f65dadb-efd2-42a4-b01e-5442e3b20a0f.png`; destination `chefs.png`. Darker ruby irises, stable poses and placement. Exact prompt:

> Precise single change: in the TOP LEFT white chinchilla Dora ONLY, recolour BOTH eye irises dark wine red, maroon #5b1018 with nearly-black shadows. They must not be pink, magenta, purple or glowing. Preserve black pupils and the tiny white highlights. Everything else, including all four chefs, exact 2x2 layout, scale, paws, aprons, tools and the existing alpha transparency, must remain pixel-consistent in placement. No new background, halos, shadows, text or added objects.
