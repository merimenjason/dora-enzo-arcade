# Grumble Hunt weapon icons

24-10-2026. Generation attempted with the built-in imagegen tool. All three initial requests failed with `image generation failed: timeout` and returned no artwork. A retry of sheet 3 using the same exact prompt also failed with that timeout. This document records intended cell layouts and exact submitted prompts, not a claim that the files exist.

No placeholder art was made. No WebP exports exist, so dimension, alpha, cell alignment and visual quality checks could not be performed. The intended art direction follows section 2 of `docs/grumble-hunt/expansion-design.md`, `docs/grumble-hunt-art.md`, the hunt-camera screenshot and the Bristleback reference sheet. No commit, push or pull request was made, as requested.

The requested output is three 1024 × 1024 WebP sheets (quality 85, alpha retained), each with a 4 × 4 grid of 256 × 256 cells. Row and column indices below are 1-based. No existing art is replaced. No game code is changed.

## icons-weapons-3.webp

Intended file: `public/art/hunt/icons-weapons-3.webp`.

| Row | Column | Weapon |
| ---: | ---: | --- |
| 1 | 1 | Driftwood Greatsword — base |
| 1 | 2 | Driftwood Greatsword — upgraded |
| 1 | 3 | Driftwood Greatsword — final |
| 1 | 4 | Bamboo Katana — base |
| 2 | 1 | Bamboo Katana — upgraded |
| 2 | 2 | Bamboo Katana — final |
| 2 | 3 | Twig Sword and Acorn Shield — base |
| 2 | 4 | Twig Sword and Acorn Shield — upgraded |
| 3 | 1 | Twig Sword and Acorn Shield — final |
| 3 | 2 | Gourd Horn — base |
| 3 | 3 | Gourd Horn — upgraded |
| 3 | 4 | Gourd Horn — final |
| 4 | 1 | Puffcap Lance — base |
| 4 | 2 | Puffcap Lance — upgraded |
| 4 | 3 | Puffcap Lance — final |
| 4 | 4 | Glimmer Greatsword |

Exact generation prompt (`transparent_background: true`):

```text
Use case: stylized-concept. Create a finished game icon atlas for Grumble Hunt, a kind children's adventure. Warm hand-painted toon storybook look, chunky readable shapes inspired by Wind Waker and Monster Hunter Stories. Actual transparent background. Canvas 1024x1024, exactly 4 columns and 4 rows of invisible 256x256 cells. No grid lines, no text, logos, watermark, scenery or cast shadows. One complete centered icon in each cell, within 208x208 centered bounds, even padding, consistent three-quarter view and top-left light, thick dark-brown outline readable at 48px. All implements are harmless wooden botanical toys with rounded blunt edges; no metal blades, sharp tips or real guns.
Fill left to right top to bottom in this EXACT sequence:
Row 1: Driftwood Greatsword base (huge flat pale driftwood paddle, rounded end, wrapped grip); same paddle upgraded with iron bands and brighter colors; same paddle final with gold trim and small friendly boar motif; Bamboo Katana base (long slim slightly curved blunt bamboo stick, round leaf guard).
Row 2: Bamboo Katana upgraded with iron bands and brighter colors; Bamboo Katana final with gold trim and small friendly bird motif; Twig Sword and Acorn Shield base (short blunt twig club paired with small round acorn-cap shield, together one icon); same pair upgraded with iron bands and brighter colors.
Row 3: Twig Sword and Acorn Shield final with gold trim and small friendly boar motif; Gourd Horn base (big round gourd on short handle with pipe holes); same horn upgraded with iron bands and brighter colors; same horn final with gold trim and small friendly bird motif.
Row 4: Puffcap Lance base (wooden shaft with fat rounded puffball mushroom tip and leaf shield, together one icon); same lance upgraded with iron bands and brighter colors; same lance final with gold trim and small friendly boar motif; Glimmer Greatsword (same driftwood paddle shape softly glowing with small warm amber Glimmer Stone crystal set into it).
Maintain the same recognizable silhouette through each weapon's variants. Exactly sixteen icons.
```

## icons-weapons-4.webp

Intended file: `public/art/hunt/icons-weapons-4.webp`.

| Row | Column | Weapon |
| ---: | ---: | --- |
| 1 | 1 | Switch Spade — base |
| 1 | 2 | Switch Spade — upgraded |
| 1 | 3 | Switch Spade — final |
| 1 | 4 | Seedpod Blade — base |
| 2 | 1 | Seedpod Blade — upgraded |
| 2 | 2 | Seedpod Blade — final |
| 2 | 3 | Firefly Staff — base |
| 2 | 4 | Firefly Staff — upgraded |
| 3 | 1 | Firefly Staff — final |
| 3 | 2 | Acorn Slingshot — base |
| 3 | 3 | Acorn Slingshot — upgraded |
| 3 | 4 | Acorn Slingshot — final |
| 4 | 1 | Pumpkin Popper — base |
| 4 | 2 | Pumpkin Popper — upgraded |
| 4 | 3 | Pumpkin Popper — final |
| 4 | 4 | Glimmer Katana |

Exact generation prompt (`transparent_background: true`):

```text
Use case: stylized-concept. Finished game icon atlas for Grumble Hunt, a kind children's adventure. Warm hand-painted toon storybook look inspired by Wind Waker and Monster Hunter Stories. Actual transparent background, 1024x1024, exactly four columns and four rows of invisible 256x256 cells. No grid lines, text, logo, watermark, scenery or cast shadows. One centered complete icon per cell inside a centered 208x208 area, even padding, consistent three-quarter angle, top-left lighting, thick dark-brown outline readable at 48px. Harmless botanical toy implements, rounded edges, no sharp points, real blades or real guns. Same silhouette across variants. Upgraded means iron bands and brighter colors; final means grander with gold trim and small friendly beast motif.
Exact left-to-right top-to-bottom order:
Row 1: Switch Spade base (long-handled broad rounded wooden garden spade, flower-bud hinge); Switch Spade upgraded; Switch Spade final with friendly boar motif; Seedpod Blade base (short blunt seedpod paddle paired with bean-pod shield visibly holding three seeds).
Row 2: Seedpod Blade upgraded; Seedpod Blade final with friendly beetle motif; Firefly Staff base (slim wooden staff with lantern-flower head and small glowing firefly); Firefly Staff upgraded.
Row 3: Firefly Staff final with friendly moth motif; Acorn Slingshot base (Y-shaped twig slingshot with acorn in band); Acorn Slingshot upgraded; Acorn Slingshot final with friendly bird motif.
Row 4: Pumpkin Popper base (chunky little round pumpkin popcorn puffer with stem handle, blowing tiny popcorn puffs, looks like a whimsical vegetable toy not a firearm); Pumpkin Popper upgraded; Pumpkin Popper final with friendly beetle motif; Glimmer Katana (slim slightly curved blunt bamboo stick with round leaf guard, softly glowing, small warm amber Glimmer Stone crystal inset).
Exactly sixteen icons.
```

## icons-weapons-5.webp

Intended file: `public/art/hunt/icons-weapons-5.webp`.

| Row | Column | Weapon |
| ---: | ---: | --- |
| 1 | 1 | Glimmer Twig Sword and Acorn Shield |
| 1 | 2 | Glimmer Gourd Horn |
| 1 | 3 | Glimmer Puffcap Lance |
| 1 | 4 | Glimmer Switch Spade |
| 2 | 1 | Glimmer Seedpod Blade |
| 2 | 2 | Glimmer Firefly Staff |
| 2 | 3 | Glimmer Acorn Slingshot |
| 2 | 4 | Glimmer Pumpkin Popper |
| 3 | 1 | Empty (transparent) |
| 3 | 2 | Empty (transparent) |
| 3 | 3 | Empty (transparent) |
| 3 | 4 | Empty (transparent) |
| 4 | 1 | Empty (transparent) |
| 4 | 2 | Empty (transparent) |
| 4 | 3 | Empty (transparent) |
| 4 | 4 | Empty (transparent) |

Exact generation prompt (`transparent_background: true`):

```text
Use case: stylized-concept. Finished game icon atlas for Grumble Hunt, kind children's adventure. Warm hand-painted toon storybook style inspired by Wind Waker and Monster Hunter Stories. Actual transparent background, 1024x1024. Invisible exact four-column four-row grid of 256x256 cells. Only first EIGHT cells occupied; bottom two rows completely transparent and empty. No text, grid lines, logo, watermark, scenery or cast shadows. One complete centered icon per occupied cell within centered 208x208 bounds. Consistent three-quarter view and top-left lighting, thick dark-brown outline readable at 48px. Rounded harmless botanical toys; no sharp edges, real blades or real guns. Each is a Glimmer version: preserve wooden botanical shape, soft warm glow and small warm amber Glimmer Stone crystal set into implement, gentle gold details.
Exact left-to-right order:
Row 1: Glimmer Twig Sword and Acorn Shield (short blunt twig club paired with small round acorn-cap shield); Glimmer Gourd Horn (big round gourd with pipe holes on short handle); Glimmer Puffcap Lance (wooden shaft tipped with fat rounded puffball mushroom cap paired with leaf shield); Glimmer Switch Spade (long-handled broad rounded wooden spade with flower-bud hinge).
Row 2: Glimmer Seedpod Blade (short blunt seedpod paddle paired with bean-pod shield visibly showing three seeds); Glimmer Firefly Staff (slim wood staff, lantern-flower head and small glowing firefly); Glimmer Acorn Slingshot (Y-shaped twig with acorn in band); Glimmer Pumpkin Popper (chunky little pumpkin popcorn puffer with stem handle blowing tiny popcorn puffs, whimsical vegetable toy not a firearm).
Rows 3 and 4 entirely empty transparent. Exactly eight icons.
```

