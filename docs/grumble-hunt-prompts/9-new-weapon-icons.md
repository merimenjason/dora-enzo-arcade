# Grumble Hunt: hand-painted icons for the four post-game weapons

Done 25-10-2026: Codex painted these through the plugin, one row per request after full two-row requests timed out. The prompts it actually used are in the last section of `docs/grumble-hunt-weapon-icons.md`. This brief replaced the first, model-rendered placeholder icons.

**Where the icons go:**
- `public/art/hunt/icons-weapons-5.webp`, rows 3–4 (cells 8–15): the Tickle Feather in row 3 and the Dandelion Puffer in row 4. **Rows 1–2 must stay pixel-identical**: paste the new cells into the existing image and save it losslessly.
- `public/art/hunt/icons-weapons-6.webp`, rows 1–2 (cells 0–7): the Pogo Spring in row 1 and the Leaf Umbrella in row 2. Rows 3–4 stay fully transparent.
- In each row: column 1 is tier 1, column 2 is tier 2, column 3 is the tier 3–4 final (one cell for both branches), column 4 is Glimmer.
- The cell maps in `docs/grumble-hunt-weapon-icons.md` and `WEAPON_ICONS` in `app/hunt/page.tsx` already point at these cells. Don't change any code.

**Style, matching the existing sheets:**
- Warm hand-painted toon storybook style, like Wind Waker and Monster Hunter Stories, for a kind children's game.
- Each icon is centred in its 256 × 256 cell within 208 × 208, on a transparent background.
- Three-quarter view, light from the top left, and a thick dark-brown outline that reads at 48 px.
- Every tool is a rounded botanical toy. Nothing looks like a real blade or gun.
- No text, logos, grid lines or watermarks.
- **Tier marks**, as on the other sheets:
  - tier 2 adds twine or ribbon binding;
  - the final adds gold trim plus small frost-fur and shell-plate motifs;
  - Glimmer adds a small warm amber Glimmer Stone crystal and a soft warm glow.

**Look at these first:** the in-game models in `lib/grumble-hunt-weapons.ts`, and the rendered icons in the two sheets. Keep the same silhouettes.

## Prompt, sheet 5 rows 3–4

```text
Use case: stylized-concept. Game icon atlas for Grumble Hunt, a kind children's adventure. Warm hand-painted toon storybook style inspired by Wind Waker and Monster Hunter Stories. Transparent background, 1024x1024, an invisible four-column four-row grid of 256x256 cells. Only the BOTTOM TWO ROWS are occupied; the top two rows are completely transparent and empty. One complete centered icon per occupied cell within centered 208x208 bounds. Consistent three-quarter view and top-left lighting, thick dark-brown outline readable at 48px. Rounded harmless botanical toys; no sharp edges, no real blades or guns. No text, grid lines, logo, watermark, scenery or cast shadows.
Row 3, left to right: Tickle Feather (a big soft curled pink feather plume on a short brown twig handle); Ribbon Feather (the same feather with teal ribbon wound round the twig); Snowcurl Feather (the feather with gold trim at the grip, a tuft of pale blue frost fur and a little grey shell plate); Glimmer Feather (the feather with a small warm amber Glimmer Stone set at the grip, gold details and a soft warm glow).
Row 4, left to right: Dandelion Puffer (a round white dandelion seed clock on a long green stem with one leaf); Twine Puffer (the same with twine binding on the stem); Snowclock Puffer (gold trim, a frost-fur tuft and a shell plate at the stem's grip); Glimmer Puffer (a small warm amber Glimmer Stone at the grip, gold details, soft warm glow).
```

## Prompt, sheet 6 rows 1–2

```text
Use case: stylized-concept. Game icon atlas for Grumble Hunt, a kind children's adventure. Warm hand-painted toon storybook style inspired by Wind Waker and Monster Hunter Stories. Transparent background, 1024x1024, an invisible four-column four-row grid of 256x256 cells. Only the TOP TWO ROWS are occupied; the bottom two rows are completely transparent and empty. One complete centered icon per occupied cell within centered 208x208 bounds. Consistent three-quarter view and top-left lighting, thick dark-brown outline readable at 48px. Rounded harmless botanical toys; no sharp edges, no real blades or guns. No text, grid lines, logo, watermark, scenery or cast shadows.
Row 1, left to right: Pogo Spring (a green reed pogo stick with a wooden T-bar handle, a golden coiled spring and a red-and-cream spotted mushroom-cap foot); Banded Pogo (the same with twine bands on the reed); Snowcap Pogo (gold trim, a frost-fur tuft and a shell plate on the T-bar); Glimmer Pogo (a small warm amber Glimmer Stone on the T-bar, gold details, soft warm glow).
Row 2, left to right: Leaf Umbrella (an open canopy of six soft green leaves on a curved brown twig handle with a hooked end); Twine Umbrella (the same with twine on the handle); Snowleaf Umbrella (gold trim, a frost-fur tuft and a shell plate on the handle); Glimmer Umbrella (a small warm amber Glimmer Stone on the handle, gold details, soft warm glow).
```

## Packing

- Downscale each generated sheet to 1024 × 1024, keeping the alpha.
- Check that every occupied cell's drawing sits inside its own 256 × 256 cell.
- For sheet 5: paste only the cells from rows 3–4 into the existing file, then check that rows 1–2 are pixel-identical to `git show HEAD:public/art/hunt/icons-weapons-5.webp`.
- Save both sheets as lossless WebP.
- Update the "Post-game weapon icons" section of `docs/grumble-hunt-weapon-icons.md` to say the icons are painted.
