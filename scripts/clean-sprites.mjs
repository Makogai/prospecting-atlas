/**
 * Stage 4: turn the wiki's "collection card" renders into clean transparent sprites.
 *
 * Each card is a dark panel (sometimes inside a coloured rarity frame) holding the
 * mineral art with its name printed underneath. Rendered as-is in a grid that reads
 * as a wall of dark boxes with duplicated labels, so we lift just the artwork out:
 *
 *   1. knock out the card's dominant background colour,
 *   2. label connected components of what survives,
 *   3. keep the components that look like artwork - anything touching the image
 *      border is frame, anything tiny is a letter of the caption,
 *   4. trim to the result's bounding box.
 *
 * Anything that fails these heuristics is copied through untouched.
 */
import { readFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import sharp from 'sharp';

const SRC = 'data/img';
const OUT = 'public/sprites';
const MANIFEST = 'src/data/images.json';

const TOLERANCE = 46;      // colour distance that still counts as background
const MIN_AREA_RATIO = 0.06; // smaller blobs beside the art are caption letters
const PAD = 6;

const dist = (r1, g1, b1, r2, g2, b2) =>
  Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);

/**
 * The card's background colour: the most common colour in the whole image.
 * Sampling only the border picks up the rarity frame on framed cards, which
 * then leaves the real (dark) panel behind as foreground.
 */
function backgroundColour(data, w, h) {
  const counts = new Map();
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (data[i + 3] < 24) continue;
    // Quantise so near-identical shades group together.
    const key = `${data[i] >> 3},${data[i + 1] >> 3},${data[i + 2] >> 3}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (!best) return null;
  const [r, g, b] = best[0].split(',').map((n) => (parseInt(n, 10) << 3) + 4);
  return { r, g, b, share: best[1] / (w * h) };
}

async function clean(srcPath, outPath) {
  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h } = info;
  if (w < 24 || h < 24) return false;

  const bg = backgroundColour(data, w, h);
  if (!bg) return false;

  // 1. Foreground mask: opaque pixels that aren't the card background.
  const fg = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (data[i + 3] < 24) continue;
    if (dist(data[i], data[i + 1], data[i + 2], bg.r, bg.g, bg.b) > TOLERANCE) fg[p] = 1;
  }

  // 2. Connected components (4-way) over the foreground mask.
  const label = new Int32Array(w * h).fill(-1);
  const comps = [];
  const queue = new Int32Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (!fg[start] || label[start] !== -1) continue;
    const id = comps.length;
    let head = 0, tail = 0;
    queue[tail++] = start;
    label[start] = id;
    const comp = { id, area: 0, touchesBorder: false, x0: w, y0: h, x1: 0, y1: 0 };

    while (head < tail) {
      const p = queue[head++];
      const x = p % w, y = (p / w) | 0;
      comp.area++;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) comp.touchesBorder = true;
      if (x < comp.x0) comp.x0 = x;
      if (y < comp.y0) comp.y0 = y;
      if (x > comp.x1) comp.x1 = x;
      if (y > comp.y1) comp.y1 = y;

      if (x > 0 && fg[p - 1] && label[p - 1] === -1) { label[p - 1] = id; queue[tail++] = p - 1; }
      if (x < w - 1 && fg[p + 1] && label[p + 1] === -1) { label[p + 1] = id; queue[tail++] = p + 1; }
      if (y > 0 && fg[p - w] && label[p - w] === -1) { label[p - w] = id; queue[tail++] = p - w; }
      if (y < h - 1 && fg[p + w] && label[p + w] === -1) { label[p + w] = id; queue[tail++] = p + w; }
    }
    comps.push(comp);
  }

  // 3. Decide which components are actually artwork.
  const CAPTION_BAND = h * 0.78;  // captions sit in the bottom fifth of the card
  const isFrame = (c) => {
    const bw = c.x1 - c.x0 + 1, bh = c.y1 - c.y0 + 1;
    // A rarity frame spans the whole card but is hollow, so it fills little of its box.
    return bw >= w * 0.85 && bh >= h * 0.85 && c.area < bw * bh * 0.35;
  };

  const candidates = comps.filter((c) => !c.touchesBorder && !isFrame(c));
  if (candidates.length === 0) return false;

  // The artwork is the largest surviving blob; everything else is judged against it.
  const main = candidates.reduce((a, b) => (b.area > a.area ? b : a));
  if (main.area < w * h * 0.01) return false;

  const keep = new Set(
    candidates
      .filter((c) => {
        if (c === main) return true;
        // The printed name always sits below the art - nothing legitimate does.
        if (c.y0 > main.y1) return false;
        if (c.y0 >= CAPTION_BAND && c.area < main.area * 0.6) return false;
        // Keep genuine detail (sparkles, fragments); drop stray letters beside the art.
        return c.area >= main.area * MIN_AREA_RATIO;
      })
      .map((c) => c.id),
  );
  if (keep.size === 0) return false;

  // 4. Erase everything we're not keeping, then trim to what's left.
  const out = Buffer.from(data);
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let p = 0; p < w * h; p++) {
    if (label[p] !== -1 && keep.has(label[p])) {
      const x = p % w, y = (p / w) | 0;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    } else {
      out[p * 4 + 3] = 0;
    }
  }
  if (x1 <= x0 || y1 <= y0) return false;
  // If almost the entire card survived, background detection failed - don't
  // ship a "cleaned" image that is really just the original with a nibbled edge.
  if ((x1 - x0) * (y1 - y0) > w * h * 0.88) return false;

  const left = Math.max(0, x0 - PAD);
  const top = Math.max(0, y0 - PAD);
  const right = Math.min(w - 1, x1 + PAD);
  const bottom = Math.min(h - 1, y1 + PAD);

  await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .png({ compressionLevel: 9 })
    .toFile(outPath);

  return true;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const db = JSON.parse(readFileSync('src/data/db.json', 'utf8'));
  const key = (f) => f.replace(/^File:/i, '').replace(/_/g, ' ').trim().toLowerCase();

  // Only item art is card-shaped. Location images are in-game screenshots, which
  // this would happily "extract" into nonsense, so they are copied verbatim.
  const itemArt = new Set(
    [...db.minerals, ...db.pans, ...db.shovels, ...db.sluices, ...db.equipment, ...db.blueprints]
      .map((x) => manifest[key(x.image ?? '')])
      .filter(Boolean),
  );

  const present = new Set(readdirSync(SRC));
  const files = [...new Set(Object.values(manifest))].filter((f) => present.has(f));

  let cleaned = 0, copied = 0;
  for (const file of files) {
    if (!itemArt.has(file)) {
      copyFileSync(`${SRC}/${file}`, `${OUT}/${file}`);
      copied++;
      continue;
    }
    const src = `${SRC}/${file}`;
    const out = `${OUT}/${file}`;
    let ok = false;
    try {
      ok = await clean(src, out);
    } catch (e) {
      console.warn(`  ${file}: ${e.message}`);
    }
    if (ok) cleaned++;
    else {
      copyFileSync(src, out);
      copied++;
    }
  }
  console.log(`sprites: ${cleaned} extracted, ${copied} passed through -> ${OUT}`);
}

if (!existsSync(SRC)) {
  console.error(`${SRC} missing - run data:images first`);
  process.exit(1);
}
main();
