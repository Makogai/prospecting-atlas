import raw from '../data/db.json';
import images from '../data/images.json';
// Formatting lives in shared/ so the Discord bot renders identical numbers.
import { money } from '../../shared/format.mjs';

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

/** A luck-affecting event, scraped from the wiki's Events page. */
export interface LuckEvent {
  id: string;
  name: string;
  /** How it combines: additive bonuses sum, multiplicative ones multiply on top. */
  kind: 'additive' | 'multiplicative' | 'unknown';
  /** Bonus for additive, factor for multiplicative, null when the wiki omits it. */
  value: number | null;
  /** Dig sites it is restricted to; empty when it applies everywhere. */
  sites: string[];
  global: boolean;
  admin: boolean;
  note: string | null;
}

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
  events: LuckEvent[];
};

export const { minerals, digSites, locations, pans, shovels, sluices, rarities, events } = db;

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

/* ---------- formatting & colour ---------------------------------------- */

// These live in shared/ because the Discord bot renders the same numbers and
// has to format them identically. Re-exported so callers import from one place.
export {
  money, odds, percent, oddsBar, statBar, readable, readablePair,
} from '../../shared/format.mjs';
