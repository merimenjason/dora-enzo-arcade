# The Glacier Stair

After calming the Mother of Grafts, climb the ladder at the east end of her chamber and use the root lift by the mural. The lift returns to the same spot. Phuyu’s camp is the first travel candle. The Stair adds 24 map screens in 12 hand-drawn rooms, with separate discovery totals so the older endings keep their original requirements.

The **Ice Falls** look out over a sunlit Andean pass. White snow caps stone and cyan marks slick ice; at speed, either hero coasts farther and carries the extra speed through take-off. Release early to settle, steer back to slow down, or plant Dora’s Ice Pick. In the **Blue Hollows**, light comes through blue ice and old bronze fittings catch gold reflections. Walkable lips stay bright in both areas.

| Room | Route and lesson |
| --- | --- |
| Root Lift Landing | Talk to Phuyu beside the lift, then hop up onto a stone platform and down onto a safe sheet of ice that ends at a second platform. Ladders climb to lookout ledges without asking for a jump. |
| Phuyu’s Camp | Rest by the candle and pass Phuyu to collect Enzo’s Sun Mirror. Two sheltered ledges look back toward the trail, and a low stone mesa beyond the candle carries a plant. |
| First Thaw | A broad white plug blocks the passage. Turn the brass socket as Enzo, then walk through the blue fall. Low stone blocks at either end break up the floor. |
| The Slide | Climb a short stone stair onto an ice shelf, slide off it in two steps, then coast to a short cut in the ice and land before the lower shaft. Dora can try the tethered practice pick at the two stops; the short catch floor lets either hero retry. |
| Glass-Horn Vicuña | Descend onto the east bank. Turn the sun into the plug on the far side, then let the vicuña skid into the fall. Two ledges above the floor give a place to wait. Jump its low charge if needed and tag to Dora to strike while it is drenched. |
| Serac Walk | Collect the Ice Pick at the east approach. Watch hanging ice shake before it falls. A ribbed ice wall gives Dora an upper perch, and a stone gap has a catch step below. |
| Frozen Fall | Enzo melts the plug, then taps Frost Fan at the running water. Dora climbs the ribbed ice to the shelf and descends the west ladder. |
| Mirror Gallery | Turn the lower sunlit mirror. Climb the brass ladder to the shadowed socket and turn it once it catches the beam. The path through the fall leads to the west shaft, past a raised outcrop. |
| Serac Osjollo | Enzo melts the cat’s perch and freezes the fall. Dora climbs and waits for the cat’s next leap to land beside her. Use the ladder beyond the perch to get back down after the fight. |
| Meltwater Run | A warm channel refreezes by itself, then closes. Cast Frost Fan early to choose when the climb begins. Cross the upper shelf and descend by the vault door and travel candle. |
| Cold Vault | An optional door off Meltwater Run leads to a separate fall climb. The high ledge holds the Saffron Pass Coat, the Indigo Drift Parka, a heart and a mural. Two one-way ledges by the entrance climb to a lookout above the mirror. The entrance door returns to the run. |
| Sun Gate | Rest by the candle. When the Warden’s eye shines, Enzo catches its beam in the mirror and forces shadow early. Dora crosses the floor and strikes the face. The unreflected sweep runs low enough to jump. |

Use **Up** by a socket as Enzo. The helping hand names the correct hero and uses the current key bindings. When water is running, **tap Spell** as Enzo near the fall to freeze it. That terrain cast uses no MP and does no damage, so an empty lantern can’t strand the pair. As Dora, hold **Up** on ribbed ice to climb, or hold **Down + Attack** on slick ground to stop. Step off the ice before tagging. In Meltwater Run the waterfall lasts 4.5 seconds in Strict (7 with the helping hand). Frozen ice lasts about 7.2 seconds (11.3 with help) before it closes; the plug waits until the lead is clear.

Untimed puzzle states are saved. Timed and guardian terrain resets when the room is entered. The engine and route planner both read the authored fall rectangles and use the same movement code; an icy ladder is only a ladder to Dora with the pick. Timed actions are proven in the full engine replay, which plays at level 16 in starting gear (the level the route bot reaches by the Foundry's last guardian) and repeats each guardian's opening until it is calmed: two openings each. Every single-tile step is swept for both heroes from take-off points 4 px apart; the narrowest window is 28 px.

Slick ice is drawn as the area's own floor stone under a pale glaze, with lit edges on its one-way ledges, so it matches the painted backdrops.

The art sources are in `~/bellspire-art-src`. [Production prompts](bellspire-art/glacier-jobs.txt) accompany the normal `python3 scripts/bellspire-art.py ~/bellspire-art-src` pipeline. Add `--glacier` to rebuild only Glacier assets when iterating. Both outfits repaint the full 96-frame Bellspire set and have separate painted frames for the new moves.

Run `npm run test:bellspire` for the shared terrain, guardian and jump checks and full root-lift-to-ending replay. The browser suite is `BASE_URL=http://localhost:3109 node tests/e2e/bellspire-glacier.mjs`. Set `GLACIER_SHOTS` to an external folder to capture all rooms and a Night Orchard reference at desktop and phone sizes.

[Desktop contact sheet](ideas/glacier-contact-desktop.jpg) · [Portrait contact sheet](ideas/glacier-contact-portrait.jpg). Both include the Night Orchard at the same viewport.
