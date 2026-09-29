/**
 * Formatting and colour helpers shared by the web app (src/lib/db.ts) and the
 * Discord bot (bot/src/data.js). Both render the same numbers, so they have to
 * agree on how a drop rate reads - keep this the single source of truth.
 */

export const RARITY_ORDER = [
  'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Exotic',
];

const COMPACT = [
  { at: 1e12, suffix: 'T' },
  { at: 1e9, suffix: 'B' },
  { at: 1e6, suffix: 'M' },
  { at: 1e3, suffix: 'K' },
];

/**
 * 44444444 -> "$44.4M". Keeps big mineral values readable in a grid.
 * @param {number | null | undefined} n
 * @param {boolean} [compact]
 * @returns {string}
 */
export function money(n, compact = true) {
  if (n == null) return '—';
  if (!compact || Math.abs(n) < 1000) return '$' + Math.round(n).toLocaleString('en-US');
  const unit = COMPACT.find((u) => Math.abs(n) >= u.at);
  const v = n / unit.at;
  return '$' + (v >= 100 ? Math.round(v) : parseFloat(v.toFixed(v >= 10 ? 1 : 2))) + unit.suffix;
}

/**
 * 4795745 -> "1 in 4.8M" - far easier to reason about than a percentage.
 * @param {number | null | undefined} oneIn
 * @returns {string}
 */
export function odds(oneIn) {
  if (oneIn == null) return 'unknown';
  if (oneIn < 1000) return `1 in ${Math.round(oneIn).toLocaleString('en-US')}`;
  const unit = COMPACT.find((u) => oneIn >= u.at);
  const v = oneIn / unit.at;
  return `1 in ${v >= 100 ? Math.round(v) : parseFloat(v.toFixed(1))}${unit.suffix}`;
}

/**
 * @param {number | null | undefined} p
 * @returns {string}
 */
export function percent(p) {
  if (p == null) return '—';
  if (p >= 1) return p.toFixed(1) + '%';
  if (p >= 0.01) return p.toFixed(3) + '%';
  if (p >= 0.000001) return p.toPrecision(2) + '%';
  return p.toExponential(1) + '%';
}

/**
 * Bar fill for a drop rate, as a percentage of the track.
 * Drop rates span 1% down to 0.0000000015%, so a linear bar renders every rare
 * drop as zero. Log scale maps 1e-9%..100% onto 2..100.
 * @param {number | null | undefined} percentValue
 * @returns {number}
 */
export function oddsBar(percentValue) {
  if (!percentValue) return 2;
  const clamped = Math.max(percentValue, 1e-9);
  return Math.max(2, Math.min(100, ((Math.log10(clamped) + 9) / 11) * 100));
}

/**
 * Bar fill for a gear stat, as a percentage of the track.
 * Gear stats scale exponentially through the game - pan Luck runs 1 to 1000,
 * sluice Luck to 600,000 - so a linear bar renders everything below end-game as
 * a sliver. Log keeps early and mid items legible against the same maximum.
 * @param {number | null | undefined} value
 * @param {number} max
 * @returns {number}
 */
export function statBar(value, max) {
  if (!value || value <= 0) return 0;
  const ceiling = Math.max(max, 1);
  return Math.max(2, Math.min(100, (Math.log1p(value) / Math.log1p(ceiling)) * 100));
}

/**
 * @param {string} hex
 * @returns {[number, number, number] | null}
 */
export function hexToRgb(hex) {
  const m = String(hex).trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * The wiki's palette assumes a light page. Several tiers (Rare `#0059ff`,
 * Mythic `#81008a`) and dig sites (Abyssal Depth `#0a0d3a`) are near-invisible
 * on a dark background, so lift each colour to a readable luminance while
 * keeping its hue - the tiers stay recognisable, they just become legible.
 * @param {string} hex
 * @param {number} [minLuma]
 * @returns {string}
 */
export function readable(hex, minLuma = 0.58) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  let [r, g, b] = rgb.map((v) => v / 255);
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (luma >= minLuma) return hex;

  // Scale toward white by the shortfall, which preserves hue better than
  // simply raising lightness in HSL for already-saturated colours.
  const t = (minLuma - luma) / (1 - luma);
  [r, g, b] = [r, g, b].map((v) => v + (1 - v) * t);
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Readable variants of a wiki gradient pair, for text and small UI.
 * @param {string[] | null | undefined} colors
 * @returns {[string, string]}
 */
export function readablePair(colors) {
  const a = colors?.[0] ?? '#9aa3b6';
  const b = colors?.[colors.length - 1] ?? '#6b7285';
  return [readable(a), readable(b)];
}
