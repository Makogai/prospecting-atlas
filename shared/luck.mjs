/**
 * Luck model, shared by the website and the Discord bot.
 *
 * Source: the wiki's "Luck Mechanics" page, which cites a developer post in the
 * game's Discord. https://prospecting.miraheze.org/wiki/Luck_Mechanics
 *
 * The documented mechanic:
 *
 *   - The rarity of what you get comes from a randomly rolled number. Lower is rarer.
 *   - Each point of Luck rerolls that number once more, and the LOWEST roll wins.
 *     Luck 5 -> rolls (3,2,1,4,2) -> final 1.
 *   - Luck has "a set chance to either be weakened or not apply at all for each
 *     individual item, so common items don't become unobtainable at high luck".
 *
 * So each mineral owns a band of the roll range, rarest at the bottom, and the
 * chance of landing in it is the chance the minimum of L rolls falls in that band.
 *
 * TWO THINGS THIS MODEL CANNOT DO, both worth surfacing wherever it is used:
 *
 *  1. The wiki never states what Luck its published drop tables assume. We take
 *     them as Luck 1, because a single roll makes a band's width exactly its
 *     listed probability, and because the starting Rusty Pan has Luck 1. It is an
 *     inference, not something the wiki says.
 *
 *  2. That dampening is unquantified. Without it the model says Gold at Rubble
 *     Creek Sands goes from 70% at Luck 1 to 1-in-10^140 at Luck 1000 — which the
 *     wiki explicitly says does not happen. So results are an UPPER BOUND: real
 *     odds for rare minerals are somewhat worse than this predicts, and common
 *     minerals never actually fall off the way the maths suggests.
 *
 * The model is at its most trustworthy where players actually use it: a rare
 * mineral at a luck level where its odds are still long. There, it reduces to
 * "odds improve roughly linearly with luck" — 1 in 5.3M at Luck 1 becomes about
 * 1 in 53K at Luck 100.
 */

/**
 * Boosts you toggle yourself rather than read off the Events page. All three are
 * x2, and the wiki's worked examples treat them as additive: two x2 sources give
 * x3, not x4.
 */
export const MANUAL_BOOSTS = [
  { id: 'totem', label: 'Luck Totem', kind: 'additive', value: 1, global: true, sites: [],
    hint: 'Shard Merchant — x2 to nearby players for 30 min' },
  { id: 'daily', label: 'Daily Reward', kind: 'additive', value: 1, global: true, sites: [],
    hint: 'x2 from the daily login bonus' },
  { id: 'code', label: 'Code Boost', kind: 'additive', value: 1, global: true, sites: [],
    hint: 'x2 from a redeemed code' },
];

/** Friends in your server: +0.1x each, capped at +0.5x. */
export const MAX_FRIENDS = 5;
export const FRIEND_BONUS = 0.1;

/** Does a boost apply at this dig site? A null site means "do not scope". */
export function appliesAt(boost, siteName) {
  if (boost.global || !boost.sites?.length) return true;
  if (!siteName) return true;
  return boost.sites.includes(siteName);
}

/**
 * Effective luck at a given dig site.
 *
 * The Events page labels every effect "Additive" or "Multiplicative", and that is
 * exactly how they combine:
 *   - additive bonuses are summed on top of a base 1x, so x2 + x2 = x3;
 *   - multiplicative ones then multiply that total, and each other.
 *
 * Reproduces the Luck Mechanics worked examples:
 *   2x totem + 1.5x friends            -> 2.5x
 *   the same during a Meteor Shower    -> 5x
 *
 * @param {number} baseLuck           Luck from pan, equipment, enchants, quests.
 * @param {object} [opts]
 * @param {object[]} [opts.boosts]    Active boosts: {kind, value, sites, global}.
 * @param {number} [opts.friends]     Friends in your server, 0-5.
 * @param {string|null} [opts.siteName] Dig site to scope location-locked events to.
 */
export function effectiveLuck(baseLuck, opts = {}) {
  const { boosts = [], friends = 0, siteName = null } = opts;
  const active = boosts.filter((b) => appliesAt(b, siteName));

  const bonus =
    active.filter((b) => b.kind === 'additive').reduce((t, b) => t + (b.value ?? 0), 0) +
    Math.min(Math.max(friends, 0), MAX_FRIENDS) * FRIEND_BONUS;

  const stacked = 1 + bonus;
  const meteor = active
    .filter((b) => b.kind === 'multiplicative')
    .reduce((t, b) => t * (b.value ?? 1), 1);

  const multiplier = stacked * meteor;
  return {
    luck: Math.max(baseLuck, 0) * multiplier,
    multiplier,
    stacked,
    meteor,
    applied: active,
    skipped: boosts.filter((b) => !appliesAt(b, siteName)),
  };
}

/**
 * Split a dig site's minerals into their roll-range bands, rarest at the bottom.
 * @param {{minerals: {id: string, percent: number|null}[]}} site
 */
export function siteBands(site) {
  const known = site.minerals.filter((m) => m.percent != null);
  const rarestFirst = [...known].sort((a, b) => a.percent - b.percent);

  let cursor = 0;
  const bands = new Map();
  for (const m of rarestFirst) {
    const lo = cursor;
    const hi = cursor + m.percent / 100;
    bands.set(m.id, { lo, hi, base: m.percent / 100 });
    cursor = hi;
  }
  return bands;
}

/**
 * P(the minimum of `luck` rolls lands in [lo, hi)).
 * Uses log1p/exp because a band can be as narrow as 1e-10, where `(1-x)**L`
 * loses all its precision.
 */
export function bandChance(lo, hi, luck) {
  const L = Math.max(luck, 1);
  if (hi <= lo) return 0;
  const p = Math.exp(L * Math.log1p(-lo)) - Math.exp(L * Math.log1p(-hi));
  return Math.min(Math.max(p, 0), 1);
}

/**
 * A mineral's odds at one dig site under a given luck.
 *
 * `confidence` says how far the answer is being trusted:
 *   'good'      — still a long shot, where the model behaves and is roughly linear.
 *   'saturating'— luck is close to guaranteeing this; the real game damps it, so
 *                 treat the number as optimistic.
 *   'damped'    — a common item the maths would push toward zero. The game
 *                 explicitly prevents that, so we report the base rate instead.
 *
 * @returns {{percent: number, oneIn: number|null, base: number, gain: number,
 *            confidence: 'good'|'saturating'|'damped'}}
 */
export function mineralChance(bands, mineralId, luck) {
  const band = bands.get(mineralId);
  if (!band) return null;

  const raw = bandChance(band.lo, band.hi, luck);
  const base = band.base;

  // Below its own band a mineral is being squeezed out by rarer ones winning the
  // roll. The game's undocumented dampening stops that, so don't pretend to know.
  // The tolerance keeps Luck 1 neutral: there, raw and base are the same number
  // up to rounding, and without it every mineral would report itself damped.
  if (raw < base * (1 - 1e-9)) {
    return {
      percent: base * 100,
      oneIn: base > 0 ? 1 / base : null,
      base: base * 100,
      gain: 1,
      confidence: 'damped',
    };
  }

  return {
    percent: raw * 100,
    oneIn: raw > 0 ? 1 / raw : null,
    base: base * 100,
    gain: base > 0 ? raw / base : 1,
    confidence: raw > 0.05 ? 'saturating' : 'good',
  };
}
