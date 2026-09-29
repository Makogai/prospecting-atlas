# Prospecting Atlas

An unofficial fan site for the Roblox game **Prospecting!** — every mineral's drop rate, every
dig site's full loot table, and side-by-side gear stats, all searchable from one keystroke.

Data is scraped from the [Official Prospecting! Wiki](https://prospecting.miraheze.org)
(CC BY-SA) and baked into the build. Nothing is fetched at runtime.

```bash
npm install
npm run dev          # http://localhost:5173
```

## What it does that the wiki doesn't

The wiki stores drop rates on each *mineral's* page. That's the wrong direction for most
questions a player actually has, so the build inverts the index and derives a few things
from it.

| | |
|---|---|
| **Dig-site loot tables** | The wiki makes you open all 113 mineral pages to learn what one site drops. Here each site lists its complete loot table, sortable by drop rate, value, rarity, or value × rate. |
| **Average value per pull** | Every mineral at a site weighted by its own drop rate, summed. Lets you compare sites directly instead of eyeballing. |
| **Readable odds** | `0.00002085%` is unreadable. Every rate is also shown as `1 in 4.8M`, on a log-scaled bar (linear would render every rare drop as zero). |
| **Farm Planner** | Pick the minerals you're hunting; it ranks sites by how much of your list each one covers, then by the value of wanted minerals per pull, and names what you'd be giving up. |
| **Global search** | `Ctrl/⌘ K` or `/` — fuzzy over minerals, dig sites, locations and gear. |
| **Gear comparison** | Up to three pans/shovels/sluices side by side, bars scaled to the best in the category, with the winning stat flagged. |

The `100.0%` drop-rate coverage on real dig sites is a useful correctness signal: it means no
mineral is missing from a site's extracted table. (The Void sums higher because its loot pool
rotates — every entry there is conditional.)

## Layout

```
scripts/           four-stage data pipeline (see below)
shared/format.mjs  money / odds / bar-scaling, imported by the site AND the bot
data/raw/          cached wikitext, committed
data/img/          raw image downloads, gitignored build input
public/sprites/    published item art, committed
src/data/          generated db.json + images.json — do not hand-edit
src/lib/db.ts      typed accessors, derived indexes
src/lib/search.ts  the search index
src/components/    shared UI + command palette
src/routes/        one file per page
bot/               Discord bot — see bot/README.md
```

Formatting lives in `shared/` because the bot renders the same numbers; a drop rate has to read
identically in both places.

## Refreshing the data

```bash
npm run data:all     # fetch -> parse -> images -> sprites
```

Individually:

| Script | Does |
|---|---|
| `data:fetch` | Pulls wikitext for every relevant page and template into `data/raw/pages.json` via the MediaWiki API. |
| `data:parse` | Turns that into `src/data/db.json` — minerals, dig sites (derived), locations, gear. |
| `data:images` | Resolves every `File:` reference to a 256px thumbnail and caches it in `data/img/`. |
| `data:sprites` | Extracts clean transparent art from the wiki's "collection card" renders into `public/sprites/`. |

`data:parse` prints a summary; `no chances`, `no image` and the counts are the quick check that a
wiki edit hasn't broken an assumption.

### About the sprite extractor

Wiki mineral images are collection cards: dark panel, sometimes a coloured rarity frame, artwork
in the middle, name printed underneath. Rendered raw in a grid they read as a wall of dark boxes
with duplicated labels. `scripts/clean-sprites.mjs` knocks out the card's dominant background,
labels the connected components of what survives, and keeps only the ones that look like artwork —
anything touching the border is frame, anything sitting below the main blob is the caption.

It currently extracts 126 of 200 images; the rest are copied through untouched, either because
they aren't cards (location screenshots are excluded outright) or because the heuristics bail
rather than ship a mangled image. **8 of 113 minerals** still show their original card.

To eyeball the result:

```bash
node scripts/contact-sheet.mjs public/sprites out.png 40
```

## Discord bot

`bot/` is a companion bot that answers the same questions in chat, rendering each reply as a
canvas card rather than a plain embed — `/find`, `/site`, `/plan`, `/gear`, `/top`. It reads the
same generated database, so there's no second scrape. See **[bot/README.md](bot/README.md)**.

```bash
cd bot && npm install && npm run smoke   # renders every card, no Discord token needed
```

## Deploying

Static output, SPA routing. The `Dockerfile` (nginx, SPA fallback, caching, `/healthz`) targets
Coolify; `vercel.json` and `public/_redirects` cover Vercel and Netlify/Cloudflare Pages.

**[DEPLOY.md](DEPLOY.md)** has the full walkthrough, including the two settings people usually
miss. The bot deploys separately as a worker — see bot/README.md.

```bash
npm run build && npm run preview
```

## Known gaps

- **Mobile layout is unverified.** It's written mobile-first (hamburger nav, wrapping control
  rows, horizontal-scroll wrappers on the wide tables) but I couldn't resize the test browser to
  confirm it visually.
- 5 minerals list locations but no drop rates on the wiki; they appear in loot tables with an
  unknown rate rather than being dropped.
- `db.json` is bundled into the JS (~134 KB gzipped) so search is instant with no fetch. If it
  grows a lot, move it to a fetched asset.

## Legal

Unofficial fan project, not affiliated with the game or Roblox. Game data and images come from
the Official Prospecting! Wiki and remain under CC BY-SA.
