[![make.fun](https://make.fun/badge/best-cooking-game-20261125-0137.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137)
[![rank](https://make.fun/badge/best-cooking-game-20261125-0137/Hasanrdp/best-cooking-game-20261125-0137/rank.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137)
[![reward](https://make.fun/badge/best-cooking-game-20261125-0137/Hasanrdp/best-cooking-game-20261125-0137/reward.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137)

# Warung Senja

A sunset warung cooking game, built for [make.fun's best cooking game bounty](https://make.fun/bounty/best-cooking-game-20261125-0137).

You run a tiny warung at the edge of dusk. Orders come in on the board, the grill is hot, and every customer has a patience bar. Take ingredients from the crates, chop them on the board, grill the patties before they burn, build each dish on the plate exactly as ordered, and serve it through the hatch before the customer walks away. One shift lasts 150 seconds; serve well and the combo pays extra.

## How it plays

- **Move** with WASD or the arrow keys. **Click** a station (or the floor) to walk there.
- **Space / E** — pick up, put down, serve. **Hold Space** at the chopping board to chop.
- **P** pauses, **M** mutes, **R** restarts after a shift ends.
- **Crates** hold tomato, lettuce, onion, patty, bun and cheese. Tomato, lettuce and onion must be chopped; patties must be grilled (6 s to cooked, burnt after 12 s); bun and cheese are ready as they are.
- **Orders** arrive on the board with a patience bar — green, then amber, then red. Serve the exact plate and you earn the dish price plus a tip for patience left, plus a combo bonus. Serve the wrong plate and the customer just shakes their head. Let three customers walk away and the warung closes early.

Four dishes on the menu: **Salad Segar** (chopped tomato, lettuce, onion), **Burger Senja** (bun, grilled patty, chopped lettuce and tomato), **Keju Melt** (bun, grilled patty, cheese) and **Burger Komplit** (everything).

## Play it

No build step, no network. Serve `game/` with any static server and open it in a desktop browser:

```sh
node serve.ts
# open http://localhost:8080
```

Screenshots are staged scenes of the real game (`?shot=cover|rush|grill|serve`), listed in `shots.json`.

## Layout

- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.
- `game/index.html` — the page; `game/src/` holds the game, one job per file:
  - `config.js` — canvas, palette, tuning, recipes, kitchen layout
  - `world.js` — state, stations, orders, cooking, plating, scoring, pathfinding
  - `render.js` — everything drawn on the canvas
  - `audio.js` — synthesised sound, no audio files
  - `input.js` — keyboard and mouse
  - `shots.js` — the staged screenshot scenes and their autopilot driver
  - `main.js` — the loop and the screens
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.
- `screenshots/` — four real renders of the game's own code.

## License

MIT — see [LICENSE](LICENSE).
