import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { App } from './App';

export { allPages, metaForPath, siteJsonLd, SITE_URL, SITE_NAME } from './lib/seo';

/**
 * Render one route to HTML at build time.
 *
 * The whole database is baked into the bundle, so every page can be rendered
 * without a server or a fetch — which is the only reason full prerendering is
 * practical here. Components that touch `localStorage`, `window` or
 * `navigator` already guard for their absence, so they render their
 * default state and the browser fills in the rest on hydration.
 */
export function render(url: string): string {
  return renderToString(
    <StaticRouter location={url}>
      <App />
    </StaticRouter>,
  );
}
