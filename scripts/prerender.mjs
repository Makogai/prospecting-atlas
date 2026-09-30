/**
 * Stage 5: render every route to static HTML.
 *
 * The site is a single-page app over a database that is fully baked into the
 * bundle, so there is nothing to fetch at request time — which means every page
 * can be rendered once at build and served as real HTML. Without this a crawler
 * gets `<div id="root"></div>` and nothing else, and the whole atlas is
 * invisible to search.
 *
 * Run after `vite build`. Reads dist/index.html as the template, replaces the
 * head metadata per route and injects the rendered markup.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const DIST = 'dist';
const SERVER_ENTRY = 'dist-ssr/entry-server.js';

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** JSON-LD goes inside a script tag, where `</script>` would end it early. */
const jsonForScript = (value) =>
  JSON.stringify(value).replace(/</g, '\\u003c').replace(/-->/g, '--\\u003e');

function head({ meta, url, siteName, siteUrl, graph }) {
  const canonical = `${siteUrl}${meta.path === '/' ? '/' : meta.path}`;
  const image = `${siteUrl}/icon-512.png`;
  return [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<link rel="canonical" href="${canonical}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(siteName)}" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${esc(meta.title)}" />`,
    `<meta name="twitter:description" content="${esc(meta.description)}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    `<script type="application/ld+json">${jsonForScript(graph(meta, canonical))}</script>`,
  ].join('\n    ');
}

async function main() {
  if (!existsSync(SERVER_ENTRY)) {
    throw new Error(`missing ${SERVER_ENTRY} — run \`vite build --ssr\` first`);
  }
  const template = readFileSync(join(DIST, 'index.html'), 'utf8');
  const server = await import(`../${SERVER_ENTRY}`);
  const { render, allPages, siteJsonLd, SITE_URL, SITE_NAME } = server;

  const pages = allPages();
  const site = siteJsonLd();

  const graph = (meta, canonical) => ({
    ...site,
    '@graph': [
      ...site['@graph'],
      {
        '@type': 'WebPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: meta.title,
        description: meta.description,
        isPartOf: { '@id': `${SITE_URL}/#website` },
      },
      ...(meta.jsonLd ? [{ ...meta.jsonLd, '@id': `${canonical}#item` }] : []),
    ],
  });

  // A route added to App.tsx but not to seo.ts would now 404 in production
  // rather than falling back to the SPA shell, so the two are checked against
  // each other rather than trusted to stay in step.
  const declared = new Set(pages.map((p) => p.path));
  const missing = staticRoutes().filter((r) => !declared.has(r));
  if (missing.length) {
    throw new Error(
      `these routes exist in App.tsx but have no entry in src/lib/seo.ts, so they would not be ` +
        `prerendered: ${missing.join(', ')}`,
    );
  }

  let written = 0;
  const failures = [];

  for (const meta of pages) {
    let markup;
    try {
      markup = render(meta.path);
    } catch (err) {
      // A route that can't render server-side is a real bug, not something to
      // paper over with a blank shell — it would ship an empty page.
      failures.push({ path: meta.path, error: err.message });
      continue;
    }

    const html = template
      .replace(/<title>[\s\S]*?<\/title>/, '@@HEAD@@')
      .replace(/\n?\s*<meta name="description"[^>]*>/, '')
      .replace(/\n?\s*<meta property="og:[^>]*>/g, '')
      .replace(/\n?\s*<meta name="twitter:[^>]*>/g, '')
      .replace('@@HEAD@@', head({ meta, siteName: SITE_NAME, siteUrl: SITE_URL, graph }))
      .replace('<div id="root"></div>', `<div id="root">${markup}</div>`);

    const out =
      meta.path === '/'
        ? join(DIST, 'index.html')
        : join(DIST, meta.path.replace(/^\//, ''), 'index.html');
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, html);
    written++;
  }

  // A 404 shell so a host can serve one for unknown paths without falling back
  // to a page that claims to be the home page.
  const notFound = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>Not found | ${SITE_NAME}</title>`)
    .replace('<div id="root"></div>', `<div id="root">${render('/__not_found__')}</div>`);
  writeFileSync(join(DIST, '404.html'), notFound);

  writeSitemap(pages, SITE_URL);
  writeRobots(SITE_URL);

  console.log(`prerendered ${written}/${pages.length} routes -> ${DIST}`);
  if (failures.length) {
    console.error(`FAILED ${failures.length}:`);
    for (const f of failures) console.error(`  ${f.path}: ${f.error}`);
    process.exitCode = 1;
  }
}

/** Static route paths declared in App.tsx (no params, no catch-all). */
function staticRoutes() {
  const src = readFileSync('src/App.tsx', 'utf8');
  const out = ['/'];
  for (const m of src.matchAll(/<Route\s+path="([^"]+)"/g)) {
    const path = m[1];
    if (path === '*' || path.includes(':')) continue;
    out.push(`/${path}`);
  }
  return out;
}

function writeSitemap(pages, siteUrl) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = pages
    .map((p) => {
      const loc = `${siteUrl}${p.path === '/' ? '/' : p.path}`;
      // The section pages are the entry points; detail pages are the long tail.
      const priority = p.path === '/' ? '1.0' : p.path.split('/').length > 2 ? '0.6' : '0.8';
      return `  <url><loc>${loc}</loc><lastmod>${today}</lastmod><priority>${priority}</priority></url>`;
    })
    .join('\n');
  writeFileSync(
    join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  );
}

function writeRobots(siteUrl) {
  writeFileSync(
    join(DIST, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
  );
}

main();
