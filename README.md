# FPS Chess

A browser prototype that combines legal chess moves with first-person capture duels.

## Run it
This is a static ES-module project. Serve the repository root with any local static server (ES modules do not work reliably from a `file://` URL).

For example, with Node.js:
```bash
npx serve .
```
Then open the local URL printed by the server.

## Controls
### Chess
- Click a white piece, then a highlighted legal destination.
- Red highlighted destinations start a capture duel.
- Black is controlled by a lightweight chess opponent that prioritises captures and checks.
- Flip board and New game are available in the side panel.

### FPS duel
- Click the arena to lock the mouse.
- WASD move, mouse look, Shift sprint, Space is reserved for jump.
- Left click attacks, E uses the piece ability, R uses its special.
- Escape pauses / releases the pointer lock; click the arena to resume.
- Win the duel to confirm the capture; lose to cancel the capture.

## Current prototype scope
- Real chess legality, check, checkmate, stalemate, castling, en passant, and promotion are handled by chess.js.
- Captures are held pending until the duel resolves.
- Six piece classes have distinct attack, ability, and special effects; the opponent also uses piece-specific combat actions.
- 3D board and arena use Three.js with procedural geometry.

This is an early playable prototype, not a finished competitive game. The chess opponent is heuristic rather than a full-strength engine. Combat uses lightweight procedural geometry and simplified movement; obstacle collision, polished animations, sound, advanced AI, online multiplayer, and full physics remain future work.
