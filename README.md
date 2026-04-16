# website-anya

Personal site + four original browser games.

## Getting started

```
npm install
npm run dev
```

Then visit:
- `/` — personal homepage (static)
- `/games` — game lobby (Voltpath, Nullcore, Swarm, Wallbreak)
- `/tictactoe.html` — Ultimate Tic-Tac-Toe

## Games

All four games are self-contained React pages under `pages/games/`. No external game libraries. Shared theme lives in `styles/games.css`.

| Game | Route | Summary |
| --- | --- | --- |
| Voltpath | `/games/voltpath` | Circuit-routing puzzle. 8 levels. Progress persists in localStorage. |
| Nullcore | `/games/nullcore` | Tiny assembly interpreter. 6 levels. Code + progress persist in localStorage. |
| Swarm | `/games/swarm` | 2-player hex insect strategy. Surround the opponent's queen. |
| Wallbreak | `/games/wallbreak` | 2-player 9×9 pawn race with wall placement. Press `W` to toggle wall mode. |

## Tests

```
npm run test:install   # once, installs the Chromium binary
npm run test           # runs Playwright against tests/games.spec.ts
```

Playwright boots the dev server automatically. Tests cover lobby navigation, board mount, a primary interaction, reset/restart, and win state (injected via `window.__setGameState`).
