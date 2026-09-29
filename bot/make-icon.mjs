import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { spritePath, minerals } from './src/data.js';

const S = 1024;
const c = createCanvas(S, S);
const x = c.getContext('2d');

// Rock base with a lantern bloom, matching the site's background.
x.fillStyle = '#070910';
x.fillRect(0, 0, S, S);
const bloom = x.createRadialGradient(S * 0.32, S * 0.2, 0, S * 0.32, S * 0.2, S * 0.85);
bloom.addColorStop(0, 'rgba(245,166,35,0.42)');
bloom.addColorStop(0.55, 'rgba(245,166,35,0.08)');
bloom.addColorStop(1, 'rgba(245,166,35,0)');
x.fillStyle = bloom;
x.fillRect(0, 0, S, S);

const vein = x.createRadialGradient(S * 0.82, S * 0.92, 0, S * 0.82, S * 0.92, S * 0.6);
vein.addColorStop(0, 'rgba(18,181,170,0.3)');
vein.addColorStop(1, 'rgba(18,181,170,0)');
x.fillStyle = vein;
x.fillRect(0, 0, S, S);

// Glow behind the gem so it reads at 32px too.
const halo = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.42);
halo.addColorStop(0, 'rgba(255,214,240,0.5)');
halo.addColorStop(1, 'rgba(255,214,240,0)');
x.fillStyle = halo;
x.fillRect(0, 0, S, S);

const want = process.argv[2] || 'Pink Diamond';
const m = minerals.find((n) => n.name === want);
if (!m) throw new Error(`no mineral named ${want}`);
const img = await loadImage(spritePath(m.image));
const box = S * 0.58;
const scale = Math.min(box / img.width, box / img.height);
const w = img.width * scale;
const h = img.height * scale;
x.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);

writeFileSync('app-icon.png', c.toBuffer('image/png'));
console.log('app-icon.png', m.name);
