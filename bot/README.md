# Prospecting Atlas — Discord bot

Answers "where do I find this?" in chat, with the same data and the same look as the site.

Every visual reply is a rendered PNG rather than a plain embed, because Discord can't draw a
log-scaled bar or tint a title with the game's own rarity gradient — and drop rates in this game
span 1% down to 0.0000000015%, so a bar chart is the only way to read them at a glance.

## Commands

| Command | Does |
|---|---|
| `/find <mineral>` | Where to find it — every dig site ranked by drop rate, with odds as `1 in N`. Autocompletes; `pinkd` finds Pink Diamond. |
| `/site <site> [show]` | A dig site's loot table, its rarity mix, and its average value per pull. |
| `/plan <minerals>` | Comma-separated wanted list → the one site that covers most of it, and what you'd give up. |
| `/gear <kind> [items]` | Pans, shovels or sluices; up to three side by side. Leave `items` blank for the best of each stat. |
| `/top <board> [rarity]` | Most valuable minerals, richest dig sites, or rarest drops. |

## Running it

```bash
cd bot
npm install
cp .env.example .env     # fill in DISCORD_TOKEN and DISCORD_CLIENT_ID
npm run register:guild   # instant, into DISCORD_GUILD_ID (global takes up to an hour)
npm start
```

`npm run smoke` runs every command against a fake interaction and writes the rendered cards to
`bot/smoke/` — no token needed. Use it after touching `render.js`.

### Discord setup

1. [Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. **Bot** → **Reset Token** → copy into `.env` as `DISCORD_TOKEN`.
3. **General Information** → **Application ID** → `.env` as `DISCORD_CLIENT_ID`.
4. **OAuth2 → URL Generator**: scopes `bot` + `applications.commands`, bot permissions
   **Send Messages** and **Attach Files**. Open the generated URL to invite it.

No privileged intents. The bot only uses `Guilds`, never reads message content, and replies solely
to its own slash commands.

### Environment

| Variable | Required | Purpose |
|---|---|---|
| `DISCORD_TOKEN` | yes | Bot token. |
| `DISCORD_CLIENT_ID` | yes | Application ID, for registering commands. |
| `DISCORD_GUILD_ID` | no | Target for `register:guild`. |
| `SITE_URL` | no | Base URL for the "Open on Atlas" buttons. Unset → buttons are omitted, which is what you want before the site is live. |

## Deploying on Coolify

The bot has **no inbound port** — it holds an outbound gateway websocket — so it is a *worker*,
not a web service. Don't set a port or a domain, and don't give it an HTTP health check.

The build context is the **repo root**, not `bot/`, because the bot reads `src/data/*.json` and
`public/sprites/` from the same commit the website is built from.

1. **New Resource → Public Repository**, same repo, branch `main`.
2. **Build Pack: Dockerfile**, **Dockerfile Location: `/bot/Dockerfile`**, **Base Directory: `/`**.
3. Add `DISCORD_TOKEN` and `DISCORD_CLIENT_ID` as environment variables — mark them **secret** so
   they aren't printed in build logs. Add `SITE_URL` once the site is live.
4. Deploy. Watch the logs for `Ready as <name> — 5 commands`.

Commands are **not** registered on deploy, deliberately: re-registering on every restart burns
rate limit and can wipe commands mid-rollout. Run it once, by hand, after changing a command
definition:

```bash
docker exec -it <container> node src/deploy-commands.js
```

## How the data gets in

The bot reads the generated database directly — no HTTP, no database, nothing at runtime. When
the wiki changes, refresh at the repo root and redeploy both services:

```bash
npm run data:all
git add -A && git commit -m "data: refresh from wiki" && git push
```

`shared/format.mjs` holds the money, odds, percent and bar-scaling helpers, imported by both the
website and the bot so a drop rate reads identically in both.

## Notes

- Fonts are committed as **static** instances under `assets/fonts/`. `@napi-rs/canvas` won't
  interpolate a variable font's weight axis — `Outfit[wght].ttf` renders 700 and 900 identically —
  so the weights are separate files.
- Rendering takes a moment, so every card command defers its reply first.
- 8 of 113 minerals still show the wiki's original card art; the sprite extractor bails rather than
  ship a mangled image. See the root README.
