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
| **Luck model** | Enter your Luck, tick the events that are running, and every drop rate re-prices. Location-locked events only apply where they actually fire. |
| **Yield estimates** | Set your pace and a session length, and each dig site says how many you'd expect — "56×" an hour, or "1 every 3 days" when it's rarer than that. |
| **Equipment & loadouts** | All 67 craftables with recipes, stat ranges and six-star values. Equip 1 necklace, 1 charm and 8 rings, and the totals feed straight back into your Luck. |
| **Community builds** | 37 loadouts, picked by *where you've got to* and *what you want* rather than a stage number, with the museum ore grid and runes for each. |
| **Blueprints** | 30 blueprint-gated items say exactly how to unlock them — quest, giver, steps and rewards, or where to buy. |
| **Quests & NPCs** | All 107 quests grouped by location with steps, rewards and permanent buffs, and all 120 characters with *exactly where they stand*. |

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
npm run data:all     # everything: the build guide, then the whole wiki pipeline
```

That's the one to run. It pulls a fresh community build-guide snapshot first, then
fetch → parse → images → sprites off the wiki. A failure fetching the Google Doc is a
warning, not an error — the last good snapshot stays in place and the wiki refresh
carries on, because one unreachable third-party doc shouldn't block everything else.

```bash
npm run data:wiki    # the wiki only, leaving the build-guide snapshot alone
```

Individually:

| Script | Does |
|---|---|
| `data:fetch` | Pulls wikitext for every relevant page and template into `data/raw/pages.json` via the MediaWiki API. |
| `data:parse` | Turns that into `src/data/db.json` — minerals, dig sites (derived), locations, gear. |
| `data:images` | Resolves every `File:` reference to a 256px thumbnail and caches it in `data/img/`. |
| `data:sprites` | Extracts clean transparent art from the wiki's "collection card" renders into `public/sprites/`. |
| `data:builds` | Pulls a fresh snapshot of the community build guide. |

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

## The luck model

Luck is the one mechanic that changes every number on the site, so it's modelled from the wiki's
[Luck Mechanics](https://prospecting.miraheze.org/wiki/Luck_Mechanics) page rather than guessed:
each point of Luck rerolls the rarity number and the lowest roll wins. So each mineral owns a band
of the roll range and its odds are the chance the minimum of *L* rolls lands in that band.

Multipliers follow the wiki's own labels, which the Events page states per effect:

- **Additive** bonuses sum — two ×2 boosts give **×3, not ×4**.
- **Multiplicative** ones (Meteor Shower, Blizzard, Starfall…) then multiply that total, and each
  other.
- Several events are **location-locked**, so luck is computed per dig site. A Blizzard is worth
  nothing outside Snowy Mountain, and the site rows say so.

`scripts/parse-events.mjs` scrapes all 15 luck-affecting events straight off the Events page,
including which are admin-only, so a wiki edit flows through `npm run data:parse`.

**Two limits, stated in the UI as well as here.** The wiki never says what Luck its published drop
tables assume — we take them as Luck 1, since a single roll makes a band's width exactly its listed
probability, and the starting Rusty Pan has Luck 1. And the dampening the wiki mentions ("a set
chance to either be weakened or not apply at all… so common items don't become unobtainable at
high luck") is unquantified. Without it the maths says Gold at Rubble Creek Sands falls to 1-in-10¹⁴⁰
at Luck 1000, which plainly doesn't happen. So the numbers are an **optimistic upper bound**, most
trustworthy while a mineral is still a long shot — which is when you'd ask.

## Estimating a grind

Two formulas come straight off the wiki's Stats page, and the estimator rests on them:

- **Pan Capacity** — "square root of capacity = average minerals" per cycle.
- **Sluice Efficiency** — "the amount of minerals a given sluice will accumulate each 10 minutes",
  so sluice output is exact and needs nothing from you.

**What the wiki does not give is how long a pan cycle takes.** Dig Speed and Shake Speed obviously
drive it, but no page states a base rate in seconds, and inventing one would put a fabricated
number under every estimate on the site. So panning asks you to time a cycle yourself, and the
input says so rather than dressing it up as game data.

The headline is the **expected yield for a session** — "56× an hour" — because that's the question
people actually ask before committing to a spot. Below one a session that reads badly, so it flips
to an interval instead: "1 every 3 days".

## Equipment and crafting

`scripts/parse-equipment.mjs` reads all 67 rings, charms and necklaces off the Equipment page:
slot, recipe (with catalyst markers and minimum ore weights), price, and both stat ranges — normal
and the six-star values you get from merging two five-stars at the Magma Forge.

The loadout builder enforces the real slot limits (1 necklace, 1 charm, 8 rings) and totals every
stat. Its Luck total feeds into the luck model with one click, so the chain runs end to end:
**equipment → base Luck → drop rates → time to get one.**

The roll-quality slider interpolates across each stat's range. The wiki gives the ranges and
describes the reforge percentage, but not exactly how the two combine — so it's a slider you can
move, not a claim about the game.

## Community builds

The guide organises builds by "Stage 0" through "Stage V", which means nothing to a player who
hasn't read it. The page instead asks two plain questions: **how far have you got** (answered with
the place names people recognise — Caldera, Snowy Isle, Swamp…, earliest first, since the guide
lists endgame first) and **what are you after** (Luck, Size, Money, Items…, derived from each
build's name). Stage numbers never appear.

`/builds` mirrors the **[Prospecting! Build Guide](https://docs.google.com/document/d/1qh68P12Pm1nz80jbKLZloVgapCXxVRoarM_pAs-5aVY/edit)**
— 37 loadouts across stages V down to 0 plus bonus builds, written by Autumn, bosnia123123,
Finnlay, Martika14, PPatel, em_miaou and softlyhollowed.

**It is their work, credited on the page and linked as the source of truth.** The guide says it is
"subject to change without warning", so what's here is a dated snapshot. `scripts/parse-builds.mjs`
reads the doc's text export: build name, stage, purpose, the one-tap formula, the museum ore grid
(boost codes, minimum weights, "pick 2" choices) and the equipment list with counts, fallbacks and
runes.

What mirroring adds over reading the doc: every ore and every item resolves against our own data,
so a build's museum grid shows sprites and links through to drop tables, and its equipment links to
recipes and stat ranges. 108 of 111 ore references and 35 of 36 equipment references resolve; the
rest are prose the guide writes inline and they display as plain text.

```bash
npm run data:builds    # pull a fresh snapshot, then data:parse
```

Deliberately not part of `data:all` — it's someone else's document, so you refresh it when you mean
to.

## Quests and NPCs

The wiki has no per-quest pages — `Category:Quests` is actually the NPCs who give them — so
the Quests index page is the source: a tabber per location, with `; NPC:` headings grouping
`{{Quest}}` templates. That yields all **107 quests** with their giver, steps, rewards and, for
five of them, a **permanent stat buff**, which the page lets you filter to since those are the
ones worth not missing.

**Where an NPC stands** is the question people actually arrive with, so it gets first-class
treatment. Locations come from each NPC's own article — either a `== Locations ==` list with the
landmark hints ("near the Store, Blacksmith, and the leaderboards") or, for NPCs who stand in one
spot, the opening sentence. 82 of 120 resolve to a real dig site or location, each linked and
coloured; the rest fall back to their broad region.

Both quests and NPCs are in `⌘K`, and an NPC's result shows where they are, so "alchemist" answers
"Fortune River Town" without leaving the keyboard.

Location and dig-site pages carry a **"who you'll find here"** section — the characters standing
there and the quests based there — because that's where you look when you arrive somewhere. Quest
locations straddle both kinds of place ("Fortune River" is a dig site *and* a location, "Rubble
Creek" only a location), so the lookup takes every name that means "here": a location passes its
own name plus all its dig sites, a dig site passes just its own.

## Blueprints

High-tier equipment doesn't appear in the crafting menu at all until you've found its blueprint, so
"how do I even get this?" is a question the equipment table alone can't answer. The wiki keeps that
on a separate page, one tab per blueprint; `scripts/parse-blueprints.mjs` reads all 30 — 23 from
quests (with giver, location, every step and the rewards), 6 bought, and one lying in a maze in
Abyssal Depths.

They surface where they matter rather than on a page of their own: a badge and a full panel on the
equipment card, a one-line hint under any blueprint-gated item inside a build, and a
"needs N blueprints" count on the build itself. Ore names inside quest steps link to their drop
tables, so "Collect 150 Glowmoss" is one click from knowing where Glowmoss comes from.

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
