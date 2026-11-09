# The River Remembers

Dora and Enzo reopen an Andean watershed from Reed Flats to Crown Spillway. The game is at `/river`. It has 42 hand-authored reaches, six two-phase guardians, 24 optional water marks and six Spring Run remixes after the ending.

## Play

Walk to a copper sluice as Dora and turn it. One arm fills as the other drains. Switch to Enzo at the launch and pole the skiff through the current to the far mooring. Tie off and start the wheel. Look for an intake beside the mill: on those reaches Dora must send water back into it after Enzo is safely ashore.

Six reaches have an island landing with a gate and a stone counterweight. Board Dora as a passenger first, then switch to Enzo and carry her across. Once ashore, Dora opens the island gate and Enzo fetches the weight for the far mill. You can tag back to Dora while Enzo is afloat. The skiff holds position while she works.

- **Reed Flats** introduces the fork and safe shallows, then asks you to ferry Dora to an island gate.
- **Red Sluices** uses narrow spill lips with stronger current when fed. Pole against the surge to keep your line.
- **Whitewater Steps** has circling currents with quiet landings in the middle.
- **Rain Cisterns** raises floating decks when the water is high. A deck that helps someone on foot may close a route for the skiff.
- **Blue Locks** fills one chamber while emptying its partner. A lowered waterline exposes a walkable shelf.
- **Crown Spillway** alternates strong releases between the inner basin and the outer spill.

Each guardian telegraphs its own sweep. Dora primes the first gate. Enzo waits out the attack and secures the exposed stake from the skiff. Then work the second gate and use the new approach to its second stake. On assist, an early Use press near an exposed stake can be buffered.

After Whitewater opens, Dora can brace at a sluice with the split handle to feed both branches. The long line extends Enzo’s docking reach. Revisit cleared reaches in the watershed chart to recover water marks, including four that need the late equipment. Spring Run changes the starting water in the last non-arena reach of each district.

## Controls

| Action | Keyboard default | Gamepad |
| --- | --- | --- |
| Move | Arrows or WASD | Stick or D-pad |
| Use, board, moor | E | A |
| Tag | Q | Y or left shoulder |
| Brace, pole, split handle | F | X |
| Hop low obstacles | Space | B |
| Pause | Escape | Start |

On a touch screen, drag **Move** and tap the action buttons. Settings rebind keyboard controls, choose difficulty, and control helping hand, music, effects and reduced motion. Helping hand starts enabled. Progress and bindings are stored in `river-remembers-v1` and `river-remembers-controls-v1`. Continue restarts at the last reached checkpoint. It keeps cleared reaches, water marks and Spring Run results.

## Build and check

```sh
npm run typecheck
npm test
npm run build
npx vinext start --port 3109
```

Against the built server, run `BASE_URL=http://localhost:3109 npm run test:e2e:river`. Set `RIVER_SHOTS` to a local directory to collect the screenshot set. `npm run test:river` checks deterministic replay, the save, the authored reaches and remixes, and sweeps the hop and boss windows. `npm run bot:river` samples four seeds per reach and difficulty with 12–18 frames of reaction delay and imperfect steering.

The art guide and the exact prompts are in [docs/river-art](river-art/style.md). The 33 source paintings are in the workspace’s **River Remembers Art** directory. Rebuild the keyed atlases with `python3 scripts/river-art.py "/path/to/River Remembers Art"`.
