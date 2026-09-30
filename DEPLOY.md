# Deploying Prospecting Atlas

The site is prerendered: `npm run build` writes real HTML for all 194 routes, so
`/minerals/pink-diamond` is a directory containing its own `index.html` rather than a client-side
route that needs a fallback. The one thing a host has to get right is **serving a directory's
`index.html`** — `try_files $uri $uri/` in nginx terms.

Unknown paths should return a genuine 404 rather than the home page with a 200. `dist/404.html`
carries the full app bundle, so a visitor who lands there still sees the right page rendered
client-side while a crawler gets the right status.

Everything in this repo is already wired for that, and `npm run build` fails rather than shipping
a route it couldn't prerender.

---

## Recommended: Coolify, via the Dockerfile

This is the best option for Coolify because it pins exactly how the site is built *and* served.
The `Dockerfile` builds with Node 22 and serves the result from nginx with directory indexes, gzip,
correct caching and a health endpoint — nothing left to Coolify's autodetection.

### One-time setup

1. **Projects → New Resource → Public Repository** (or Private, via your GitHub App).
2. Repository: `https://github.com/Makogai/prospecting-atlas`, branch `main`.
3. **Build Pack: `Dockerfile`.** Leave the Dockerfile location as `/Dockerfile`.
4. **Port: `80`.** This is the one setting people miss — Coolify defaults to 3000 and the
   container serves on 80, so the proxy would get a connection refused.
5. Add your domain under **Domains**, e.g. `https://atlas.yourdomain.com`. Coolify issues the
   Let's Encrypt certificate automatically once DNS resolves to the server.
6. **Deploy.**

No environment variables are needed. The site has no backend and no runtime configuration —
the wiki data is baked into the bundle at build time.

### Health check

The container exposes `GET /healthz` → `200 ok`, and the Dockerfile declares a `HEALTHCHECK`
against it. If you also set a health check in the Coolify UI, point it at `/healthz` and not
`/`, so a failing deploy can't hide behind a page that happens to render.

### Redeploying after a wiki update

The data is baked in at build time, so new wiki data needs a new build:

```bash
npm run data:all
git add -A && git commit -m "data: refresh from wiki" && git push
```

Coolify rebuilds on push if you enabled auto-deploy; otherwise hit **Redeploy**.

> Don't run `data:all` inside the Docker build. It would hammer the wiki on every deploy and make
> builds non-reproducible — two deploys of the same commit could produce different sites. Refresh
> locally, commit the result, and the build stays a pure function of the commit.

### Resource notes

The build needs roughly 1 GB of RAM for `npm ci` plus Vite. `sharp` is a devDependency used only
by the data pipeline, which the Docker build never runs — but `npm ci` still installs it, so the
builder image needs to be able to fetch its prebuilt binary. On a very small VPS, build locally
and push a prebuilt image instead.

---

## Alternative: Coolify static build pack

If you'd rather not use Docker, Coolify can build with Nixpacks and serve the output directory:

- **Build Pack:** Nixpacks
- **Install Command:** `npm ci`
- **Build Command:** `npm run build`
- **Publish Directory:** `dist`
- **Is it a SPA?** → **yes** (this is what installs the fallback; without it, deep links 404)

The Dockerfile route is still preferable — you get the exact nginx config above rather than
whatever the buildpack decides, including the caching headers and `/healthz`.

---

## Other hosts

Configs for these are already committed, so they need no dashboard settings:

| Host | How | File |
|---|---|---|
| **Vercel** | Import the repo. Framework preset Vite; defaults are correct. | `vercel.json` |
| **Netlify** | Build `npm run build`, publish `dist`. | `public/_redirects` |
| **Cloudflare Pages** | Build `npm run build`, output `dist`. | `public/_redirects` |

### GitHub Pages

Pages serves a directory's `index.html`, so the prerendered pages work as-is; `404.html` covers
for unknown paths, and if that file *is* the app, the router takes over:

```bash
npm run build   # writes dist/404.html itself
```

If you serve from a subpath (`user.github.io/prospecting-atlas/`) you also need
`base: '/prospecting-atlas/'` in `vite.config.ts`, otherwise every asset URL is wrong.

---

## Verifying a deploy

Four checks, in the order things actually break:

```bash
curl -I  https://your-domain/                      # 200, text/html
curl -I  https://your-domain/minerals/pink-diamond # 200 — prerendered page is served
curl -I  https://your-domain/sprites/amethysthd.png # 200 — assets copied
curl -sI https://your-domain/assets/ -o /dev/null -w '%{http_code}\n'
```

Then open the site and press <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>K</kbd>. If search returns
results, the data bundle loaded.

**If deep links 404 but the root works**, directory indexes aren't configured — that's the "Is it a
SPA?" toggle on Nixpacks, or the wrong build pack on Docker.

**If the page is blank with 404s on `/assets/...`**, the site is being served from a subpath and
`base` isn't set in `vite.config.ts`.

---

## The Discord bot

The bot is a **separate resource** in Coolify, and a worker rather than a web service: no port, no
domain, no HTTP health check. Its build context is the repo root, not `bot/`. Full walkthrough in
**[bot/README.md](bot/README.md#deploying-on-coolify)**.

Both services read the same committed data, so after a `npm run data:all` refresh, redeploy both.

---

## Local production check

Always worth doing before pushing a deploy — it catches build-only breakage that `npm run dev`
hides:

```bash
npm run build && node scripts/serve-dist.mjs   # http://localhost:5191
```

Use `serve-dist.mjs` rather than `npm run preview`: Vite's preview server rewrites every path to
the root `index.html`, which makes all 194 prerendered pages look identical and hides the one
thing worth checking. `serve-dist.mjs` resolves paths exactly the way `nginx.conf` does.

To test the real container:

```bash
docker build -t prospecting-atlas .
docker run --rm -p 8080:80 prospecting-atlas   # http://localhost:8080
```
