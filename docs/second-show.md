# The Second Show

Play at `/second-show`. The inspector is here to close the troupe. Dora can bow, roll in a painted wave, or draw back the curtain from the matching mark. A different cue earns applause and makes the inspector look away this beat. Repeating the last cue does neither. Enzo uses that cover to carry the murals, one at a time, to Stage door and hand them to the troupe. He can rig a trapdoor when the route permits. The forecast names the spot the inspector will watch on the next beat.

- **Quay theater:** Practice cueing while carrying a mural out. Later, decide whether rigging the trapdoor saves a trip.
- **Picture gallery:** Work around the inspector's new route and keep enough applause for the full act.
- **Carriage stage:** Thread the fly loft and wings on a moving theater train.
- **Civic gala:** Move the last murals under the audience's eyes and give the city a final curtain.

Sixteen authored acts, three difficulties and three ribbons per act. Clear the act, meet par, and find the old playbill. Settings can move playbills and reset the current attempt while preserving progression. Progress uses `second-show-v1` in the browser.

Choose one action per hero. **Queue beat** lets you plan up to three pairs, showing the forecast at the next queued positions. **Play the scene** (Enter) commits the scene; Z removes the last queued pair or undoes the last committed beat. Q switches heroes. The helping hand uses the current binding. On touch, use the buttons; on a gamepad, use D-pad up/down to browse, left/right to change hero, A to select, B to undo, X to queue, Start to play or advance from results, and Select for the menu. The inspector only moves after a beat commits.

`npm run test:second-show` covers all 48 act/difficulty pairs and save replay. `npm run bot:second-show` measures recoverability with 12–18 frames to react and imperfect choices. Use `BASE_URL=http://localhost:3109 npm run test:e2e:second-show` against a production preview for real keyboard/touch actions, gamepad mapping, queuing and a finale clear.

See the [art guide](arcade-originals-art.md) for source paint and conversion.
