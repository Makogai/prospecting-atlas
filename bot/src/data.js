/**
 * The bot reads the same generated database as the website. Nothing is fetched
 * at runtime - refresh it with `npm run data:all` at the repo root.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import {
  RARITY_ORDER, money, odds, percent, oddsBar, statBar,
  readable, readablePair, hexToRgb,
} from '../../shared/format.mjs';

export {
  RARITY_ORDER, money, odds, percent, oddsBar, statBar,
  readable, readablePair, hexToRgb,
};

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '../..');

const read = (p) => JSON.parse(readFileSync(join(REPO_ROOT, p), 'utf8'));

export const db = read('src/data/db.json');
const imageMap = read('src/data/images.json');

export const {
  minerals, digSites, locations, pans, shovels, sluices, rarities,
} = db;

export const gearGroups = { pans, shovels, sluices };

export const GEAR_STATS = {
  pans: ['luck', 'capacity', 'strength', 'speed'],
  shovels: ['strength', 'speed', 'toughness'],
  sluices: ['luck', 'capacity', 'efficiency', 'toughness'],
};

const byId = (xs) => new Map(xs.map((x) => [x.id, x]));

export const mineralById = byId(minerals);
export const digSiteById = byId(digSites);
export const locationById = byId(locations);
export const digSiteByName = new Map(digSites.map((s) => [s.name, s]));
export const rarityByName = new Map(rarities.map((r) => [r.name, r]));

/** Absolute path to a cached sprite, or null when we never cached it. */
export function spritePath(file) {
  if (!file) return null;
  const key = String(file).replace(/^File:/i, '').replace(/_/g, ' ').trim().toLowerCase();
  const local = imageMap[key];
  if (!local) return null;
  const p = join(REPO_ROOT, 'public/sprites', local);
  return existsSync(p) ? p : null;
}

/* ---------- lookups (mirrors src/lib/db.ts) ---------------------------- */

export function sitesFor(mineral) {
  return mineral.chances
    .map((c) => ({ chance: c, site: digSiteByName.get(c.site) }))
    .filter((x) => x.site);
}

/** The single best place to farm a mineral (highest rate, non-conditional). */
export function bestSiteFor(mineral) {
  const solid = sitesFor(mineral).filter((s) => !s.chance.conditional);
  return (solid.length ? solid : sitesFor(mineral))[0] ?? null;
}

export function locationForSite(site) {
  if (site.page) {
    const hit = locations.find((l) => l.name === site.page);
    if (hit) return hit;
  }
  return locations.find((l) => l.digSites.includes(site.id)) ?? null;
}

export function gearPrice(g) {
  if (g.currency) return `${(g.currencyAmount ?? 0).toLocaleString('en-US')} ${g.currency}`;
  if (g.price === 0) return 'Free';
  if (g.price == null) return g.priceLabel || 'Not sold';
  return money(g.price);
}

/** Chance of hitting at least one wanted mineral in a single pull. */
export function combinedChance(percents) {
  const miss = percents.reduce((acc, p) => acc * (1 - (p ?? 0) / 100), 1);
  return (1 - miss) * 100;
}

/* ---------- search ------------------------------------------------------ */

/**
 * Ranked name matching for slash-command autocomplete and loose arguments.
 * Exact > prefix > substring > subsequence, so "pinkd" still finds Pink Diamond.
 */
export function rank(query, items, nameOf = (x) => x.name) {
  const q = query.trim().toLowerCase();
  if (!q) return items.slice();

  const scored = [];
  for (const item of items) {
    const name = nameOf(item).toLowerCase();
    let score = -1;
    if (name === q) score = 1000;
    else if (name.startsWith(q)) score = 800 - name.length;
    else if (name.includes(q)) score = 600 - name.indexOf(q);
    else {
      // Subsequence fallback, rewarding contiguous runs.
      let at = 0, streak = 0, s = 0, ok = true;
      for (const ch of q) {
        const found = name.indexOf(ch, at);
        if (found === -1) { ok = false; break; }
        streak = found === at ? streak + 1 : 0;
        s += 10 + streak * 6;
        at = found + 1;
      }
      if (ok) score = s - at;
    }
    if (score >= 0) scored.push({ item, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || nameOf(a.item).length - nameOf(b.item).length)
    .map((x) => x.item);
}

export const findMineral = (q) => rank(q, minerals)[0] ?? null;
export const findSite = (q) => rank(q, digSites)[0] ?? null;

export const SITE_URL = process.env.SITE_URL || 'https://prospecting-atlas.example';

export const mineralUrl = (m) => `${SITE_URL}/minerals/${m.id}`;
export const siteUrl = (s) => `${SITE_URL}/sites/${s.id}`;
