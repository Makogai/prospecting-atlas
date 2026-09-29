import raw from '../data/db.json';
import images from '../data/images.json';

/* ---------- types ------------------------------------------------------ */

export type RarityName =
  | 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary' | 'Mythic' | 'Exotic';

export interface Rarity {
  name: RarityName;
  order: number;
  colors: string[];
}

export interface Chance {
  site: string;
  conditional: string | null;
  percent: number | null;
  oneIn: number | null;
}

export interface Recipe {
  name: string;
  rarity: RarityName | null;
  note: string | null;
  ingredients: { qty: number; item: string }[];
}

export interface Museum {
  minWeight: string | null;
  stats: string[];
  maxBoost: string | null;
}

export interface Mineral {
  id: string;
  name: string;
  image: string | null;
  description: string;
  rarity: RarityName;
  value: number | null;
  locations: string[];
  chances: Chance[];
  ratesKnown: boolean;
  recipes: Recipe[];
  museum: Museum | null;
  trivia: string[];
  wiki: string;
}

export interface SiteMineral {
  id: string;
  name: string;
  rarity: RarityName;
  value: number | null;
  percent: number | null;
  oneIn: number | null;
  conditional: string | null;
}

export interface DigSite {
  id: string;
  name: string;
  colors: string[];
  page: string | null;
  minerals: SiteMineral[];
  expectedValue: number;
  coverage: number;
  mineralCount: number;
  topRarity: RarityName | null;
}

export interface Location {
  id: string;
  name: string;
  image: string | null;
  summary: string;
  digSites: string[];
  colors: string[];
  wiki: string;
}

export interface Gear {
  id: string;
  name: string;
  image: string | null;
  description: string;
  color: string | null;
  price: number | null;
  priceLabel: string | null;
  /** Event gear is bought with an event currency instead of cash. */
  currency: string | null;
  currencyAmount: number | null;
  stats: Record<string, number>;
  passive: string | null;
  source: string;
  sourceRefs: string[];
}

export type GearKind = 'pans' | 'shovels' | 'sluices';

/* ---------- the database ----------------------------------------------- */

export const db = raw as unknown as {
  meta: { source: string; fetchedAt: string; builtAt: string };
  rarities: Rarity[];
  minerals: Mineral[];
  digSites: DigSite[];
  locations: Location[];
  pans: Gear[];
  shovels: Gear[];
  sluices: Gear[];
};

export const { minerals, digSites, locations, pans, shovels, sluices, rarities } = db;

export const RARITY_ORDER = rarities.map((r) => r.name);

const byId = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));

export const mineralById = byId(minerals);
export const digSiteById = byId(digSites);
export const locationById = byId(locations);

/** Dig sites keyed by their wiki display name, e.g. "Rubble Creek Sands". */
export const digSiteByName = new Map(digSites.map((s) => [s.name, s]));

export const rarityByName = new Map(rarities.map((r) => [r.name, r]));

export const gearGroups: Record<GearKind, Gear[]> = { pans, shovels, sluices };

export const GEAR_LABEL: Record<GearKind, string> = {
  pans: 'Pans',
  shovels: 'Shovels',
  sluices: 'Sluices',
};

/** Stat keys per gear kind, in the order they should be displayed. */
export const GEAR_STATS: Record<GearKind, string[]> = {
  pans: ['luck', 'capacity', 'strength', 'speed'],
  shovels: ['strength', 'speed', 'toughness'],
  sluices: ['luck', 'capacity', 'efficiency', 'toughness'],
};

export const STAT_LABEL: Record<string, string> = {
  luck: 'Luck',
  capacity: 'Capacity',
  strength: 'Strength',
  speed: 'Speed',
  efficiency: 'Efficiency',
  toughness: 'Toughness',
};

/** Highest value found in each gear kind's stat, for scaling the stat bars. */
export const gearStatMax: Record<GearKind, Record<string, number>> = Object.fromEntries(
  (Object.keys(gearGroups) as GearKind[]).map((kind) => [
    kind,
    Object.fromEntries(
      GEAR_STATS[kind].map((s) => [
        s,
        Math.max(...gearGroups[kind].map((g) => g.stats[s] ?? 0), 1),
      ]),
    ),
  ]),
) as Record<GearKind, Record<string, number>>;

/** What a piece of gear costs, in whatever currency it's actually sold for. */
export function gearPrice(g: Gear): string {
  if (g.currency) return `${(g.currencyAmount ?? 0).toLocaleString('en-US')} ${g.currency}`;
  if (g.price === 0) return 'Free';
  if (g.price == null) return g.priceLabel || 'Not sold';
  return money(g.price);
}

/** Sort key that keeps cash gear in order and parks event gear at the end. */
export function gearPriceOrder(g: Gear): number {
  if (g.currency || g.price == null) return Number.MAX_SAFE_INTEGER;
  return g.price;
}

/* ---------- lookups ----------------------------------------------------- */

/** Every dig site that can drop this mineral, richest chance first. */
export function sitesFor(mineral: Mineral) {
  return mineral.chances
    .map((c) => ({ chance: c, site: digSiteByName.get(c.site) }))
    .filter((x): x is { chance: Chance; site: DigSite } => Boolean(x.site));
}

/** The single best place to farm a mineral (highest drop rate, non-conditional). */
export function bestSiteFor(mineral: Mineral) {
  const solid = sitesFor(mineral).filter((s) => !s.chance.conditional);
  return (solid.length ? solid : sitesFor(mineral))[0] ?? null;
}

/** Locations that contain a given dig site. */
export function locationForSite(site: DigSite) {
  if (site.page) {
    const hit = locations.find((l) => l.name === site.page);
    if (hit) return hit;
  }
  return locations.find((l) => l.digSites.includes(site.id)) ?? null;
}

/** Minerals whose recipes consume the given mineral. */
export function usedInRecipes(mineral: Mineral) {
  const out: { source: Mineral; recipe: Recipe }[] = [];
  for (const m of minerals) {
    for (const r of m.recipes) {
      if (r.ingredients.some((i) => i.item.toLowerCase().startsWith(mineral.name.toLowerCase()))) {
        out.push({ source: m, recipe: r });
      }
    }
  }
  return out;
}

/* ---------- images ------------------------------------------------------ */

const imageMap = images as Record<string, string>;

/**
 * Wiki file name -> local /img path, or null when we never cached it.
 * Keys are lower-cased because MediaWiki upper-cases the first letter of a
 * title, so pages reference "astralspore.png" for a file stored as "Astralspore.png".
 */
export function imgSrc(file: string | null | undefined): string | null {
  if (!file) return null;
  const key = file.replace(/^File:/i, '').replace(/_/g, ' ').trim().toLowerCase();
  const local = imageMap[key];
  // /sprites holds the same files with the wiki's card frame and printed
  // caption stripped out (see scripts/clean-sprites.mjs).
  return local ? `/sprites/${local}` : null;
}

/* ---------- colour ------------------------------------------------------ */

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * The wiki's palette assumes a light page. Several tiers (Rare `#0059ff`,
 * Mythic `#81008a`) and dig sites (Abyssal Depth `#0a0d3a`) are near-invisible
 * on our dark background, so lift each colour to a readable luminance while
 * keeping its hue — the tiers stay recognisable, they just become legible.
 */
export function readable(hex: string, minLuma = 0.58): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  let [r, g, b] = rgb.map((v) => v / 255) as [number, number, number];
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (luma >= minLuma) return hex;

  // Scale toward white by the shortfall, which preserves hue better than
  // simply raising lightness in HSL for already-saturated colours.
  const t = (minLuma - luma) / (1 - luma);
  [r, g, b] = [r, g, b].map((v) => v + (1 - v) * t) as [number, number, number];
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0'))
      .join('')
  );
}

/** Readable variants of a wiki gradient, for text and small UI. */
export const readablePair = (colors: string[] | null | undefined): [string, string] => {
  const a = colors?.[0] ?? '#9aa3b6';
  const b = colors?.[colors.length - 1] ?? '#6b7285';
  return [readable(a), readable(b)];
};

/* ---------- formatting -------------------------------------------------- */

const COMPACT = [
  { at: 1e12, suffix: 'T' },
  { at: 1e9, suffix: 'B' },
  { at: 1e6, suffix: 'M' },
  { at: 1e3, suffix: 'K' },
];

/** 44444444 -> "$44.4M". Keeps big mineral values readable in a grid. */
export function money(n: number | null | undefined, compact = true): string {
  if (n == null) return '—';
  if (!compact || Math.abs(n) < 1000) return '$' + Math.round(n).toLocaleString('en-US');
  const unit = COMPACT.find((u) => Math.abs(n) >= u.at)!;
  const v = n / unit.at;
  return '$' + (v >= 100 ? Math.round(v) : parseFloat(v.toFixed(v >= 10 ? 1 : 2))) + unit.suffix;
}

/** 0.00002085 -> "1 in 4.8M" — far easier to reason about than a percentage. */
export function odds(oneIn: number | null | undefined): string {
  if (oneIn == null) return 'unknown';
  if (oneIn < 1000) return `1 in ${Math.round(oneIn).toLocaleString('en-US')}`;
  const unit = COMPACT.find((u) => oneIn >= u.at)!;
  const v = oneIn / unit.at;
  return `1 in ${v >= 100 ? Math.round(v) : parseFloat(v.toFixed(1))}${unit.suffix}`;
}

export function percent(p: number | null | undefined): string {
  if (p == null) return '—';
  if (p >= 1) return p.toFixed(1) + '%';
  if (p >= 0.01) return p.toFixed(3) + '%';
  if (p >= 0.000001) return p.toPrecision(2) + '%';
  return p.toExponential(1) + '%';
}

/** Log-scaled bar width: drop rates span 1% to 0.0000000015%. */
export function oddsBar(percentValue: number | null | undefined): number {
  if (!percentValue) return 2;
  const clamped = Math.max(percentValue, 1e-9);
  // Map 1e-9%..100% onto 2..100 so even the rarest bar stays visible.
  return Math.max(2, Math.min(100, ((Math.log10(clamped) + 9) / 11) * 100));
}
