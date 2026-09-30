/**
 * Serve dist/ exactly the way nginx.conf does, for checking a production build.
 *
 * `vite preview` rewrites every path to the root index.html, which hides
 * whether the prerendered pages are actually reachable — the one thing worth
 * checking before a deploy.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const DIST = 'dist';
const PORT = Number(process.argv[2] ?? 5191);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

const readIfFile = async (path) => {
  try {
    const s = await stat(path);
    return s.isFile() ? await readFile(path) : null;
  } catch {
    return null;
  }
};

createServer(async (req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  // Keep the resolved path inside dist, whatever the request says.
  const rel = normalize(url).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
  const base = join(DIST, rel);

  // try_files $uri $uri/ =404
  const body = (await readIfFile(base)) ?? (await readIfFile(join(base, 'index.html')));
  if (body) {
    const ext = extname(base) || '.html';
    res.writeHead(200, { 'Content-Type': TYPES[ext] ?? 'application/octet-stream' });
    res.end(body);
    return;
  }

  const notFound = await readIfFile(join(DIST, '404.html'));
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(notFound ?? 'Not found');
}).listen(PORT, () => console.log(`serving ${DIST} like nginx on http://localhost:${PORT}`));
