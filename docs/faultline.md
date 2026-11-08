# Faultline Rescue

Play at `/faultline`. Every third turn after the first shock, one of three vulnerable spans takes the strain. Dora can take one neighbor's paw and guide them to Relief camp. Enzo can set one brace at a time from either anchor or from the district winch. A brace applies before the crossing. A stone kit reopens a fallen span; Enzo has to reach an anchor to use one. If a span drops while Dora crosses it, she and her passenger step back. It costs a turn, and you can undo it.

- **Pottery terraces:** Learn to brace the upper walk, then choose between a short trip over fragile spans and a longer loop down the stairs.
- **Millrace:** Two banks and the old mill race give you a choice of routes. The shelters are close; the crossings are the hard part.
- **Copper drift:** Reach miners on different levels. A stone kit can reopen a useful shortcut, or you can save it and work around the collapse.
- **Headwater dam:** Escort the last crew across the headworks. Reposition the cable between trips and watch the forecast when you change plans.

Sixteen authored rescues, three difficulties and three ribbons per rescue. Clear the rescue for the first ribbon, meet par for the second, and recover the village ledger for the third. Settings can move hidden collectibles and reset the current attempt without dropping unlocked rescues or ribbons. Progress uses `faultline-v1` in the browser.

Choose one action per hero. **Advance aftershock** plays the turn (Enter), **Undo** rolls one back (Z), and Q switches the action list between heroes. The helping hand uses the current binding. On touch, use the buttons; on a gamepad, use D-pad up/down to browse, left/right to change hero, A to select, B to undo and Start to advance. No decision expires while you read.

`npm run test:faultline` covers all 48 mission/difficulty pairs and save replay. `npm run bot:faultline` measures recoverability with 12–18 frames to react and imperfect choices. Use `BASE_URL=http://localhost:3109 npm run test:e2e:faultline` against a production preview for real keyboard/touch actions, gamepad mapping, progression and a finale clear.

See the [art guide](arcade-originals-art.md) for source paint and conversion.
