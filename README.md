# Diamond Hunter

A browser puzzle-adventure in the style of the classic mobile game Diamond Rush. Dig through a jungle temple, collect gems, dodge falling boulders, and reach the exit.

The name, pixel art and all 8 levels are original. Only the style of play is borrowed.

## Play

Open `dist/index.html` in any modern browser. It is one self-contained file with no server and no install.

| Action | Keyboard | Touch |
|---|---|---|
| Move | Arrow keys or WASD | D-pad |
| Back to last checkpoint | R | Retry |
| Pause | P or Esc | Pause |
| Sound on/off | M | Sound button |

## Rules

- **Gems** open the exit once you have enough (the counter turns gold).
- **Soil** can be dug through. Boulders and gems rest on it.
- **Boulders** fall when nothing is under them and roll off gems and other boulders. Push them sideways by walking into them. You can hold one up by standing under it, but only for about 3 seconds: it shakes, then crushes you. A falling boulder crushes you straight away.
- **Keys** open locked doors, one door per key.
- **Bats** fly side to side, and **spiders** crawl up and down. Touching one kills you. Drop a boulder on one and it turns into a gem.
- **Spikes** rise and fall on a timer. They flash just before rising.
- **Checkpoint stones** save your progress in the level. Press R to return to the last one.
- Each level hides one **ruby**. Rubies are optional; the level select shows which ones you've found.

Progress, best times and rubies are saved in the browser (localStorage).

## Deploy to Vercel

The project is a static site. `vercel.json` tells Vercel to run `npm run build` and serve the `dist` folder, so no settings need changing.

**From GitHub (recommended):** push this folder to a GitHub repository, then in the Vercel dashboard choose **Add New → Project**, import the repository and click **Deploy**. Every push after that redeploys automatically.

**From the command line:**

```
npm i -g vercel
vercel          # first run links the project and makes a preview deployment
vercel --prod   # publish to your production URL
```

### Analytics

The page includes Vercel Web Analytics (page views, visitors, top pages, countries, devices). To start collecting data, open the project in the Vercel dashboard, go to the **Analytics** tab, click **Enable**, and redeploy. Until then, and when the page is opened as a local file, the analytics script fails to load quietly and the game is unaffected.

### Other hosts

`dist/index.html` is already built and is the only file the site needs, so it also works on any other static host (Netlify, GitHub Pages, itch.io).

## Develop

```
npm run build       # inline src/ into dist/index.html
npm test            # prove every level can be completed
npm run test:ruby   # prove every level can be completed with its ruby collected
```

Run `npm run build` after any change in `src/`. Requires Node 18 or later; there are no dependencies.

| File | Contents |
|---|---|
| `src/engine.js` | Game rules: tile types, movement, gravity, enemies, spikes. Has no DOM access, so the tests run it directly. |
| `src/levels.js` | The 8 level maps. The legend is at the top of `engine.js`. |
| `src/sprites.js` | Pixel art: 16×16 text grids for characters and items, with walls, soil and doors drawn in code. |
| `src/game.js` | Game loop, camera, rendering, keyboard and touch input, sound, menus, saved progress. |
| `src/shell.html` | Page markup and styles. |
| `build.js` | Bundles everything into `dist/index.html`. |
| `vercel.json` | Vercel build settings: run `npm run build`, serve `dist`. |
| `test/solve.js` | Level checker. It searches for a winning sequence of moves and replays it to confirm. It also flags malformed maps and boulders that would fall as soon as a level starts. |

### Adding a level

Add an entry to `src/levels.js` with a `name`, a `hint`, the number of gems `need`ed, and a `map` (every row the same width, walled in on all sides). Then run `npm test` to confirm it can be beaten. The solver usually takes a few seconds per level; very open levels with lots of soil can take a minute or two.
