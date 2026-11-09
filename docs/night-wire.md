# The Night Wire

Play at `/night-wire`. A ferry is approaching in rough water, and the harbor crews can only talk through the old exchange. Answer the named caller as Enzo to learn their destination, then patch those two stations. A crew's dispatch sometimes unlocks another call. Use Dora to get to a cut relay. A fuse fixes it for the rest of the case; a jumper fixes it for two turns. A late case has more cuts than fuses, so you may need Dora to bridge a relay on the same turn Enzo answers or patches.

- **Tidal harbor:** Learn to listen before patching, and bring the first cut lines back.
- **Island service loop:** Restore two crews' routes before they can agree on a plan.
- **Cliff cable:** Walk the exposed relays and use a temporary connection where a repair would take too long.
- **Outer breakwater:** Deliver bearings, a pump and the crew list in order to bring the ferry in.

Sixteen authored cases and three difficulties. Clear a case for one ribbon, meet par for a second, and listen to a hidden archive recording for a third. Settings can move hidden recordings and reset the current attempt while preserving progression. Progress uses `night-wire-v1` in the browser.

Plan each hero on the map: glowing rings mark the spots the selected hero can pick, ◆ markers sit on paths they can act on, and dashed arrows show the plan. Picking Dora's move hands over to Enzo, and a numbered guide above the hero cards says which step is next. When the turn plays, Dora acts first, then Enzo, then the night line answers, with the result shown on the board. The first mission opens with a short card on how a turn works (once per browser). The action list still offers every choice. **Advance calls** plays the turn (Enter), **Undo** rolls one back (Z), and Q switches between Dora's field work and Enzo's exchange. The helping hand uses the current binding. On touch, use the buttons; on a gamepad, use D-pad up/down to browse, left/right to change hero, A to select, B to undo, Start to advance or continue from results, and Select for the menu. Calls do not age while you plan.

`npm run test:night-wire` covers all 48 case/difficulty pairs and save replay. `npm run bot:night-wire` measures recoverability with 12–18 frames to react and imperfect choices. Use `BASE_URL=http://localhost:3109 npm run test:e2e:night-wire` against a production preview for real keyboard/touch actions, gamepad mapping, progression and a finale clear.

See the [art guide](arcade-originals-art.md) for source paint and conversion.
