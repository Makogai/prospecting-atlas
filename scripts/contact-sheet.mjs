// Dev aid: tile sprites onto one checkered sheet so extraction can be eyeballed.
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const [dir, out, count = 40] = process.argv.slice(2);
const db = JSON.parse(readFileSync('src/data/db.json', 'utf8'));
const im = JSON.parse(readFileSync('src/data/images.json', 'utf8'));
const key = (f) => f.replace(/^File:/i, '').replace(/_/g, ' ').trim().toLowerCase();

const picks = db.minerals.slice(0, Number(count));
const CELL = 110, COLS = 8;
const rows = Math.ceil(picks.length / COLS);

const tiles = await Promise.all(
  picks.map(async (m, i) => ({
    input: await sharp(`${dir}/${im[key(m.image)]}`)
      .resize(CELL - 14, CELL - 14, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer(),
    left: (i % COLS) * CELL + 7,
    top: Math.floor(i / COLS) * CELL + 7,
  })),
);

await sharp({
  create: { width: COLS * CELL, height: rows * CELL, channels: 4,
            background: { r: 24, g: 27, b: 40, alpha: 1 } },
})
  .composite(tiles)
  .png()
  .toFile(out);
console.log(out);
