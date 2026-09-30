/**
 * Canvas card renderers.
 *
 * Discord embeds can't draw a log-scaled bar or tint a title with the game's own
 * rarity gradient, so the visual part of every reply is a rendered PNG and the
 * embed carries only links and fallback text. The palette here mirrors the site.
 */
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  money, odds, percent, oddsBar, statBar, readablePair, readable,
  spritePath, rarityByName, mineralById, locationForSite, digSites,
  boostFor, boostLabel,
} from './data.js';

// Dig-site gradients, looked up by display name while drawing rows.
const digSiteColors = new Map(digSites.map((s) => [s.name, s.colors]));
const siteColorsFor = (name) => digSiteColors.get(name) ?? ['#9aa3b6', '#6b7285'];

const HERE = dirname(fileURLToPath(import.meta.url));
const FONTS = join(HERE, '../assets/fonts');

// Static instances: @napi-rs/canvas won't interpolate a variable font's weight
// axis, so 700 and 900 of Outfit[wght].ttf render identically.
GlobalFonts.registerFromPath(join(FONTS, 'Outfit-Regular.ttf'), 'Atlas');
GlobalFonts.registerFromPath(join(FONTS, 'Outfit-SemiBold.ttf'), 'AtlasSemi');
GlobalFonts.registerFromPath(join(FONTS, 'Outfit-ExtraBold.ttf'), 'AtlasBold');
GlobalFonts.registerFromPath(join(FONTS, 'JetBrainsMono-Regular.ttf'), 'AtlasMono');
GlobalFonts.registerFromPath(join(FONTS, 'JetBrainsMono-Bold.ttf'), 'AtlasMonoBold');

const C = {
  bg: '#070910',
  panel: '#0d111b',
  line: 'rgba(255,255,255,0.08)',
  track: 'rgba(255,255,255,0.07)',
  ink: '#eef2fb',
  ink3: '#aab3c7',
  ink4: '#7d879e',
  ink5: '#5a6379',
  ore: '#ffc247',
  vein: '#3ee0d0',
};

export const W = 1000;
const PAD = 44;

/* ---------- primitives -------------------------------------------------- */

const font = (size, face = 'Atlas') => `${size}px ${face}`;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Soft radial bloom, used behind sprites and in card corners. */
function glow(ctx, x, y, radius, color, alpha = 0.35) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, hexA(color, alpha));
  g.addColorStop(1, hexA(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

/** '#ffc247' + 0.4 -> 'rgba(255,194,71,0.4)' */
function hexA(hex, a) {
  const h = String(hex).replace('#', '');
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function gradientFill(ctx, x, y, w, colors) {
  const [a, b] = readablePair(colors);
  const g = ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  return g;
}

/** Draws text and returns its width, so callers can lay out inline runs. */
function text(ctx, str, x, y, { size = 20, face = 'Atlas', fill = C.ink, align = 'left' } = {}) {
  ctx.font = font(size, face);
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = fill;
  ctx.fillText(str, x, y);
  return ctx.measureText(str).width;
}

/** Truncates to fit a pixel width, appending an ellipsis. */
function fit(ctx, str, maxWidth, size, face = 'Atlas') {
  ctx.font = font(size, face);
  if (ctx.measureText(str).width <= maxWidth) return str;
  let s = str;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxWidth) s = s.slice(0, -1);
  return s + '…';
}

/** A rarity / label pill with a tinted background and gradient text. */
function pill(ctx, label, x, y, colors, { size = 15 } = {}) {
  const [c1, c2] = readablePair(colors);
  ctx.font = font(size, 'AtlasBold');
  const w = ctx.measureText(label.toUpperCase()).width + 22;
  const h = size + 14;

  roundRect(ctx, x, y, w, h, 7);
  ctx.fillStyle = hexA(c1, 0.14);
  ctx.fill();
  ctx.strokeStyle = hexA(c1, 0.4);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const g = ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label.toUpperCase(), x + 11, y + h / 2 + 1);
  return w;
}

function bar(ctx, x, y, w, h, fillRatio, colors) {
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = C.track;
  ctx.fill();

  const fw = Math.max(h, (w * fillRatio) / 100);
  roundRect(ctx, x, y, fw, h, h / 2);
  ctx.fillStyle = gradientFill(ctx, x, y, fw, colors);
  ctx.fill();
}

/** The dark panel every card sits on, with two corner blooms. */
function panel(ctx, h, accent) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, h);

  glow(ctx, 90, -30, 460, accent ?? C.ore, 0.22);
  glow(ctx, W - 60, h + 40, 420, C.vein, 0.1);

  roundRect(ctx, 10, 10, W - 20, h - 20, 26);
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function footer(ctx, h, note) {
  ctx.textBaseline = 'alphabetic';
  text(ctx, note, PAD, h - 26, { size: 15, fill: C.ink5 });
  text(ctx, 'Prospecting Atlas', W - PAD, h - 26, { size: 15, face: 'AtlasSemi', fill: C.ink4, align: 'right' });
}

async function drawSprite(ctx, file, cx, cy, box, accent) {
  const path = spritePath(file);
  if (!path) return false;
  try {
    const img = await loadImage(path);
    const scale = Math.min(box / img.width, box / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    if (accent) glow(ctx, cx, cy, box * 0.55, accent, 0.4);
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    return true;
  } catch {
    return false;
  }
}

const rarityColors = (name) => rarityByName.get(name)?.colors ?? ['#888888', '#555555'];

/* ---------- cards ------------------------------------------------------- */

/**
 * "Where to find X" - the headline card. Ranked dig sites with log-scaled bars.
 */
export async function renderFind(mineral, { limit = 7, luck = null } = {}) {
  const drops = mineral.chances.slice(0, limit);
  const luckAt = new Map((luck ?? []).map((l) => [l.site, l]));
  const boosted = luckAt.size > 0;
  const HEAD = 240;
  const ROW = luck ? 56 : 50;
  const h = HEAD + Math.max(drops.length, 1) * ROW + 74;

  const canvas = createCanvas(W, h);
  const ctx = canvas.getContext('2d');
  const colors = rarityColors(mineral.rarity);
  const [accent] = readablePair(colors);

  panel(ctx, h, accent);

  await drawSprite(ctx, mineral.image, PAD + 84, 128, 148, accent);

  const left = PAD + 190;
  text(ctx, 'WHERE TO FIND', left, 66, { size: 15, face: 'AtlasBold', fill: C.ink5 });

  ctx.font = font(52, 'AtlasBold');
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = gradientFill(ctx, left, 0, Math.min(ctx.measureText(mineral.name).width, 560), colors);
  ctx.fillText(fit(ctx, mineral.name, W - left - PAD - 130, 52, 'AtlasBold'), left, 116);

  pill(ctx, mineral.rarity, left, 134, colors);

  if (mineral.description) {
    text(ctx, fit(ctx, mineral.description, W - left - PAD, 18), left, 190, {
      size: 18, fill: C.ink4,
    });
  }

  // Figures, right-aligned in the header.
  const best = drops.find((c) => !c.conditional) ?? drops[0];
  const figures = [
    [money(mineral.value), 'per kg', C.ore],
    [String(mineral.chances.length), 'dig sites', C.ink],
  ];
  if (mineral.ratesKnown && best) {
    const bestLucky = boosted
      ? drops
          .map((c) => luckAt.get(c.site)?.chance)
          .filter(Boolean)
          .sort((a, b) => b.percent - a.percent)[0]
      : null;
    figures.push([odds(bestLucky ? bestLucky.oneIn : best.oneIn), 'best odds', C.vein]);
  }
  let fx = W - PAD;
  for (const [val, label, col] of figures.reverse()) {
    ctx.font = font(15, 'Atlas');
    const lw = ctx.measureText(label).width;
    ctx.font = font(24, 'AtlasMonoBold');
    const vw = ctx.measureText(val).width;
    const colW = Math.max(lw, vw);
    text(ctx, val, fx, 78, { size: 24, face: 'AtlasMonoBold', fill: col, align: 'right' });
    text(ctx, label, fx, 100, { size: 15, fill: C.ink5, align: 'right' });
    fx -= colW + 34;
  }

  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, HEAD - 28);
  ctx.lineTo(W - PAD, HEAD - 28);
  ctx.stroke();

  drops.forEach((c, i) => {
    const y = HEAD + i * ROW;
    const siteColors = siteColorsFor(c.site);

    text(ctx, String(i + 1), PAD + 8, y + 18, {
      size: 15, face: 'AtlasMonoBold', fill: C.ink5, align: 'right',
    });

    const nameW = 260;
    ctx.font = font(21, 'AtlasBold');
    ctx.textAlign = 'left';
    ctx.fillStyle = gradientFill(ctx, PAD + 24, 0, nameW, siteColors);
    ctx.fillText(fit(ctx, c.site, nameW, 21, 'AtlasBold'), PAD + 24, y + 18);

    if (c.conditional) {
      text(ctx, `(${c.conditional})`, PAD + 24, y + 36, { size: 13, fill: C.ink5 });
    }

    if (mineral.ratesKnown) {
      const here = luckAt.get(c.site);
      const shown = here?.chance ?? null;

      bar(ctx, PAD + 300, y + 9, boosted ? 290 : 340, 10, oddsBar(shown ? shown.percent : c.percent), siteColors);

      text(ctx, odds(shown ? shown.oneIn : c.oneIn), W - PAD - 152, y + 18, {
        size: 18, face: 'AtlasMonoBold', fill: shown && shown.gain > 1.01 ? C.vein : C.ink,
        align: 'right',
      });
      text(
        ctx,
        shown && shown.gain > 1.01 ? `was ${odds(c.oneIn)}` : percent(c.percent),
        W - PAD, y + 18,
        { size: 12, face: 'AtlasMono', fill: C.ink5, align: 'right' },
      );

      // Say when a toggled event doesn't reach this site, rather than silently
      // showing a smaller gain than the header implies.
      if (here?.skipped?.length) {
        text(ctx, `no ${here.skipped.map((b) => b.name).join(', ')}`, PAD + 300, y + 36, {
          size: 12, fill: C.ink5,
        });
      }
    }
  });

  if (!drops.length) {
    text(ctx, 'No drop data recorded for this mineral.', PAD, HEAD + 20, { size: 19, fill: C.ink4 });
  }

  const shown = drops.length < mineral.chances.length
    ? `Showing ${drops.length} of ${mineral.chances.length} sites · `
    : '';
  const luckNote = boosted
    ? (() => {
        const vals = [...new Set([...luckAt.values()].map((l) => Math.round(l.luck)))];
        const range = vals.length > 1
          ? `${Math.min(...vals).toLocaleString('en-US')}–${Math.max(...vals).toLocaleString('en-US')}`
          : vals[0].toLocaleString('en-US');
        return `at ${range} Luck · modelled, an optimistic upper bound · `;
      })()
    : '';

  footer(
    ctx,
    h,
    mineral.ratesKnown
      ? `${shown}${luckNote}bars are log-scaled — each step is 10× rarer`
      : `${shown}the wiki lists these locations but publishes no drop rates`,
  );
  return canvas.toBuffer('image/png');
}

/** A dig site's loot table. */
export async function renderSite(site, { limit = 10 } = {}) {
  const rows = site.minerals.slice(0, limit);
  const HEAD = 218;
  const ROW = 52;
  const h = HEAD + rows.length * ROW + 74;

  const canvas = createCanvas(W, h);
  const ctx = canvas.getContext('2d');
  const [accent] = readablePair(site.colors);

  panel(ctx, h, accent);

  const loc = locationForSite(site);
  text(ctx, (loc ? loc.name : 'STANDALONE SITE').toUpperCase(), PAD, 64, {
    size: 15, face: 'AtlasBold', fill: C.ink5,
  });

  ctx.font = font(50, 'AtlasBold');
  ctx.textAlign = 'left';
  ctx.fillStyle = gradientFill(ctx, PAD, 0, 620, site.colors);
  ctx.fillText(fit(ctx, site.name, 620, 50, 'AtlasBold'), PAD, 116);

  const figures = [
    [money(site.expectedValue), 'avg / pull', C.ore],
    [String(site.mineralCount), 'minerals', C.ink],
    [site.topRarity ?? '—', 'top tier', readablePair(rarityColors(site.topRarity))[0]],
  ];
  let fx = W - PAD;
  for (const [val, label, col] of figures.reverse()) {
    ctx.font = font(15, 'Atlas');
    const lw = ctx.measureText(label).width;
    ctx.font = font(24, 'AtlasMonoBold');
    const colW = Math.max(lw, ctx.measureText(val).width);
    text(ctx, val, fx, 78, { size: 24, face: 'AtlasMonoBold', fill: col, align: 'right' });
    text(ctx, label, fx, 100, { size: 15, fill: C.ink5, align: 'right' });
    fx -= colW + 34;
  }

  // Rarity mix strip.
  const mixY = 150;
  const mixW = W - PAD * 2;
  let mx = PAD;
  roundRect(ctx, PAD, mixY, mixW, 10, 5);
  ctx.save();
  ctx.clip();
  for (const r of [...rarityByName.values()]) {
    const n = site.minerals.filter((m) => m.rarity === r.name).length;
    if (!n) continue;
    const w = (n / site.mineralCount) * mixW;
    ctx.fillStyle = gradientFill(ctx, mx, 0, w, r.colors);
    ctx.fillRect(mx, mixY, w, 10);
    mx += w;
  }
  ctx.restore();

  text(ctx, `Top ${rows.length} of ${site.mineralCount} by drop rate`, PAD, 192, {
    size: 16, fill: C.ink4,
  });

  for (const [i, m] of rows.entries()) {
    const y = HEAD + i * ROW;
    const colors = rarityColors(m.rarity);
    await drawSprite(ctx, mineralById.get(m.id)?.image, PAD + 20, y + 14, 38);

    ctx.font = font(21, 'AtlasSemi');
    ctx.textAlign = 'left';
    ctx.fillStyle = C.ink;
    ctx.fillText(fit(ctx, m.name, 210, 21, 'AtlasSemi'), PAD + 48, y + 21);

    bar(ctx, PAD + 276, y + 11, 300, 9, oddsBar(m.percent), colors);

    text(ctx, odds(m.oneIn), W - PAD - 112, y + 21, {
      size: 17, face: 'AtlasMonoBold', fill: C.ink3, align: 'right',
    });
    text(ctx, money(m.value), W - PAD, y + 21, {
      size: 17, face: 'AtlasMonoBold', fill: C.ore, align: 'right',
    });
  }

  footer(ctx, h, 'Avg / pull weights every mineral by its own drop rate');
  return canvas.toBuffer('image/png');
}

/** Farm planner: sites ranked by how much of a wanted list they cover. */
export async function renderPlan(picks, ranked, { limit = 5 } = {}) {
  const rows = ranked.slice(0, limit);
  const HEAD = 190;
  const ROW = 76;
  const h = HEAD + Math.max(rows.length, 1) * ROW + 74;

  const canvas = createCanvas(W, h);
  const ctx = canvas.getContext('2d');
  panel(ctx, h, C.ore);

  text(ctx, 'FARM PLANNER', PAD, 64, { size: 15, face: 'AtlasBold', fill: C.ink5 });
  text(ctx, `Best sites for ${picks.length} target${picks.length === 1 ? '' : 's'}`, PAD, 112, {
    size: 42, face: 'AtlasBold', fill: C.ink,
  });

  // Wanted list as sprite + name chips.
  let cx = PAD;
  for (const m of picks.slice(0, 6)) {
    ctx.font = font(16, 'AtlasSemi');
    const label = fit(ctx, m.name, 160, 16, 'AtlasSemi');
    const w = ctx.measureText(label).width + 46;
    roundRect(ctx, cx, 136, w, 32, 9);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fill();
    await drawSprite(ctx, m.image, cx + 18, 152, 22);
    text(ctx, label, cx + 34, 158, { size: 16, face: 'AtlasSemi', fill: C.ink3 });
    cx += w + 8;
  }

  rows.forEach((r, i) => {
    const y = HEAD + i * ROW;
    const [accent] = readablePair(r.site.colors);

    roundRect(ctx, PAD, y - 8, 30, 30, 8);
    ctx.fillStyle = i === 0 ? accent : 'rgba(255,255,255,0.06)';
    ctx.fill();
    text(ctx, String(i + 1), PAD + 15, y + 13, {
      size: 17, face: 'AtlasBold', fill: i === 0 ? C.bg : C.ink4, align: 'center',
    });

    ctx.font = font(25, 'AtlasBold');
    ctx.textAlign = 'left';
    ctx.fillStyle = gradientFill(ctx, PAD + 44, 0, 340, r.site.colors);
    ctx.fillText(fit(ctx, r.site.name, 340, 25, 'AtlasBold'), PAD + 44, y + 14);

    const names = r.hits.map((x) => x.mineral.name).join(', ');
    text(ctx, fit(ctx, names, 340, 15), PAD + 44, y + 36, { size: 15, fill: C.ink5 });

    const metrics = [
      [`${r.hits.length}/${picks.length}`, 'covers', r.coverage === 1 ? C.vein : C.ink],
      [percent(r.combined), 'any target', C.ink3],
      [money(r.targetValue), 'target value', C.ore],
    ];
    let mx2 = W - PAD;
    for (const [val, label, col] of metrics.reverse()) {
      ctx.font = font(14, 'Atlas');
      const lw = ctx.measureText(label).width;
      ctx.font = font(21, 'AtlasMonoBold');
      const colW = Math.max(lw, ctx.measureText(val).width);
      text(ctx, val, mx2, y + 10, { size: 21, face: 'AtlasMonoBold', fill: col, align: 'right' });
      text(ctx, label, mx2, y + 30, { size: 14, fill: C.ink5, align: 'right' });
      mx2 -= colW + 30;
    }
  });

  if (!rows.length) {
    text(ctx, 'No dig site drops any of those.', PAD, HEAD + 20, { size: 20, fill: C.ink4 });
  }

  footer(ctx, h, 'Ranked by list coverage, then value of wanted minerals per pull');
  return canvas.toBuffer('image/png');
}

/** Gear stat card, up to three items side by side. */
export async function renderGear(items, kind, statKeys, maxes) {
  const cols = items.length;
  const colW = (W - PAD * 2 - (cols - 1) * 22) / cols;
  const h = 200 + statKeys.length * 46 + 90;

  const canvas = createCanvas(W, h);
  const ctx = canvas.getContext('2d');
  panel(ctx, h, C.ore);

  text(ctx, kind.toUpperCase(), PAD, 64, { size: 15, face: 'AtlasBold', fill: C.ink5 });
  text(ctx, cols > 1 ? 'Side by side' : items[0].name, PAD, 112, {
    size: 42, face: 'AtlasBold',
    fill: cols === 1 && items[0].color ? readable(items[0].color) : C.ink,
  });

  for (const [i, g] of items.entries()) {
    const x = PAD + i * (colW + 22);
    await drawSprite(ctx, g.image, x + 34, 172, 58);

    const nameColor = g.color ? readable(g.color) : C.ink;
    if (cols > 1) {
      ctx.font = font(22, 'AtlasBold');
      ctx.textAlign = 'left';
      ctx.fillStyle = nameColor;
      ctx.fillText(fit(ctx, g.name, colW - 80, 22, 'AtlasBold'), x + 72, 168);
      text(ctx, gearPriceLabel(g), x + 72, 192, { size: 17, face: 'AtlasMonoBold', fill: C.ore });
    } else {
      // The heading is already the item's name, so show what it costs and does.
      text(ctx, gearPriceLabel(g), x + 72, 166, { size: 20, face: 'AtlasMonoBold', fill: C.ore });
      if (g.description) {
        text(ctx, fit(ctx, g.description, colW - 90, 17), x + 72, 192, { size: 17, fill: C.ink4 });
      }
    }

    statKeys.forEach((s, j) => {
      const y = 246 + j * 46;
      const v = g.stats[s] ?? 0;
      const best = items.every((o) => (o.stats[s] ?? 0) <= v);
      text(ctx, s[0].toUpperCase() + s.slice(1), x, y, { size: 15, fill: C.ink5 });
      text(ctx, String(v), x + colW, y, {
        size: 16, face: 'AtlasMonoBold', fill: best && cols > 1 ? C.ore : C.ink3, align: 'right',
      });
      bar(ctx, x, y + 10, colW, 9, statBar(v, maxes[s] || 1),
        best && cols > 1 ? ['#f5a623', '#ffd98a'] : ['#48526b', '#6b7285']);
    });
  }

  footer(ctx, h, 'Bars are log-scaled against the best in this category');
  return canvas.toBuffer('image/png');
}

function gearPriceLabel(g) {
  if (g.currency) return `${(g.currencyAmount ?? 0).toLocaleString('en-US')} ${g.currency}`;
  if (g.price === 0) return 'Free';
  if (g.price == null) return g.priceLabel || 'Not sold';
  return money(g.price);
}

/** Discord embed accent colour for a rarity, as an integer. */
/**
 * The best museum ore for each display, for one stat.
 *
 * Laid out a row per rarity because that is the actual constraint — a display
 * only takes its own rarity, so this is a separate pick per row rather than a
 * ranked list, and the empty rows are the point when only six ores in the game
 * boost Luck at all.
 */
export async function renderMuseum(stat, groups) {
  const rows = groups.filter((g) => g.display.total > 0);
  const HEAD = 176;
  const ROW = 74;
  const h = HEAD + rows.length * ROW + 76;

  const canvas = createCanvas(W, h);
  const ctx = canvas.getContext('2d');
  panel(ctx, h, C.vein);

  text(ctx, 'MUSEUM — BEST ORE PER DISPLAY', PAD, 64, {
    size: 15, face: 'AtlasBold', fill: C.ink5,
  });
  text(ctx, stat, PAD, 116, { size: 50, face: 'AtlasBold', fill: C.ink });

  const total = rows.reduce(
    (t, g) => t + g.picks.reduce((n, o) => n + boostFor(o, stat), 0),
    0,
  );
  const filled = rows.reduce((n, g) => n + g.picks.length, 0);
  const slots = rows.reduce((n, g) => n + g.display.total, 0);

  text(ctx, boostLabel(total), W - PAD, 96, {
    size: 44, face: 'AtlasMonoBold', fill: C.vein, align: 'right',
  });
  text(ctx, `${filled} of ${slots} displays`, W - PAD, 120, {
    size: 15, fill: C.ink5, align: 'right',
  });

  let y = HEAD;
  for (const { display, picks } of rows) {
    const colors = rarityColors(display.rarity);
    const [c1] = readablePair(colors);

    roundRect(ctx, PAD - 10, y - 6, W - (PAD - 10) * 2, ROW - 10, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fill();

    ctx.font = font(17, 'AtlasBold');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = gradientFill(ctx, PAD + 4, 0, 150, colors);
    ctx.fillText(display.rarity.toUpperCase(), PAD + 4, y + 26);
    text(ctx, `${display.total} slot${display.total === 1 ? '' : 's'}`, PAD + 4, y + 46, {
      size: 14, fill: C.ink5,
    });

    if (picks.length === 0) {
      text(ctx, `nothing here boosts ${stat}`, PAD + 190, y + 36, { size: 17, fill: C.ink5 });
    } else {
      let x = PAD + 190;
      for (const ore of picks) {
        const label = `${ore.name}  ${boostLabel(boostFor(ore, stat))}`;
        ctx.font = font(16, 'AtlasSemi');
        const w = ctx.measureText(label).width + 26;
        if (x + w > W - PAD) break;
        roundRect(ctx, x, y + 14, w, 32, 9);
        ctx.fillStyle = hexA(c1, 0.12);
        ctx.fill();
        ctx.strokeStyle = hexA(c1, 0.34);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        text(ctx, label, x + 13, y + 36, { size: 16, face: 'AtlasSemi', fill: C.ink });
        x += w + 10;
      }
    }
    y += ROW;
  }

  footer(ctx, h, 'Maximum boosts — assumes every ore meets its minimum weight');
  return canvas.encode('png');
}

export function rarityInt(rarity) {
  const [c] = readablePair(rarityColors(rarity));
  return parseInt(c.replace('#', ''), 16);
}

export function colorsInt(colors) {
  const [c] = readablePair(colors);
  return parseInt(c.replace('#', ''), 16);
}
