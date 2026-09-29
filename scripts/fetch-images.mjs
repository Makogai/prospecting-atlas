// Stage 3: resolve every File: reference to a thumbnail URL and cache it locally,
// so the site never hotlinks the wiki's CDN.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { api, UA } from './wiki.mjs';

const DB = 'src/data/db.json';
const OUT_DIR = 'data/img';  // build input; only public/sprites is published
const MANIFEST = 'src/data/images.json';
const WIDTH = 256;

const db = JSON.parse(readFileSync(DB, 'utf8'));

// Every file name the site could want to render.
const wanted = new Set();
const add = (f) => f && wanted.add(f.replace(/^File:/i, '').replace(/_/g, ' ').trim());
db.minerals.forEach(m => add(m.image));
[...db.pans, ...db.shovels, ...db.sluices].forEach(g => add(g.image));
db.locations.forEach(l => add(l.image));
db.equipment.forEach(e => add(e.image));
db.blueprints.forEach(b => add(b.image));
db.npcs.forEach(n => add(n.image));

const files = [...wanted];
console.log(`${files.length} distinct images referenced`);

/** File name -> direct URL, via imageinfo (batched 50). */
async function resolve(names) {
  const map = {};
  for (let i = 0; i < names.length; i += 50) {
    const batch = names.slice(i, i + 50);
    const j = await api({
      action: 'query', prop: 'imageinfo', iiprop: 'url|mime',
      iiurlwidth: String(WIDTH),
      titles: batch.map(n => `File:${n}`).join('|'),
    });
    for (const p of j.query.pages) {
      const name = p.title.replace(/^File:/, '');
      const info = p.imageinfo?.[0];
      if (!info) { console.warn(`  missing on wiki: ${name}`); continue; }
      // thumburl is absent for SVG/GIF sometimes; fall back to the original.
      map[name] = info.thumburl || info.url;
    }
  }
  return map;
}

const safe = (n) => n.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/-+/g, '-');

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const urls = await resolve(files);
  console.log(`${Object.keys(urls).length} resolved`);

  const manifest = {};
  let downloaded = 0, cached = 0, failed = 0;

  for (const [name, url] of Object.entries(urls)) {
    const ext = (url.match(/\.(png|jpe?g|gif|webp|svg)(?:$|\?)/i)?.[1] || 'png').toLowerCase();
    const local = safe(name).replace(/\.[a-z0-9]+$/, '') + '.' + ext;
    // MediaWiki upper-cases a title's first letter, so "astralspore.png" comes
    // back as "Astralspore.png". Key on lower case so lookups always hit.
    manifest[name.toLowerCase()] = local;

    const dest = `${OUT_DIR}/${local}`;
    if (existsSync(dest)) { cached++; continue; }
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      downloaded++;
      if (downloaded % 25 === 0) console.log(`  ${downloaded} downloaded...`);
    } catch (e) {
      console.warn(`  failed ${name}: ${e.message}`);
      failed++;
      delete manifest[name.toLowerCase()];
    }
  }

  writeFileSync(MANIFEST, JSON.stringify(manifest));
  console.log(`downloaded ${downloaded}, cached ${cached}, failed ${failed}`);
  console.log(`manifest -> ${MANIFEST} (${Object.keys(manifest).length} entries)`);
}
main();
