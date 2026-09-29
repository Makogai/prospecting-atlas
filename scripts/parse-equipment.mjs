/**
 * Equipment (rings, charms, necklaces) from the wiki's Equipment page.
 *
 * Each item is an `{{Equipment row}}` with up to 12 stats. Every stat carries two
 * ranges: `valN` for a normal item and `s6valN` for a six-star one, since merging
 * two five-stars at the Magma Forge raises the ceiling.
 *
 * The page has two tabbers — the main list (Common through Ascended) and
 * "Limited-Time Equipment" — and the rarity is the tab name, so rows are parsed
 * per tab rather than all at once.
 */
import { findTemplates, plain, num, slug } from './parse-util.mjs';

const MAX_STATS = 12;

/** Stat names are typed inconsistently on the page ("WalkSpeed" / "Walkspeed"). */
const STAT_ALIASES = {
  walkspeed: 'Walk Speed',
  'walk speed': 'Walk Speed',
  'jump power': 'Jump Power',
  'inventory size': 'Inventory Size',
  'status timer speed': 'Status Timer Speed',
  'treasure map chance': 'Treasure Map Chance',
};

const canonicalStat = (raw) => {
  const name = plain(raw).trim();
  return STAT_ALIASES[name.toLowerCase()] ?? name;
};

/** `0.3 – 0.8` / `0 – 15%` / `10 – 55` -> { min, max, unit } */
function parseRange(raw) {
  if (raw == null) return null;
  const text = plain(raw).trim();
  if (!text) return null;

  const percent = text.includes('%');
  const parts = text.split(/\s*[-–—]\s*/).map((p) => num(p)).filter((n) => n != null);
  if (!parts.length) return null;

  const [min, max = min] = parts;
  return { min, max, unit: percent ? '%' : null };
}

/**
 * `3&nbsp;[[Gold]]<sup> c</sup><br />5&nbsp;[[Pyrite]]` ->
 * [{ qty: 3, item: 'Gold', catalyst: true }, { qty: 5, item: 'Pyrite' }]
 *
 * A `<sup> c</sup>` marks the ore as a mutation catalyst; some entries also carry
 * a minimum weight, e.g. "3 Gold (+60kg)".
 */
function parseRecipe(raw) {
  if (!raw) return [];
  return raw
    .split(/<br\s*\/?>/i)
    .map((part) => {
      const catalyst = /<sup>[^<]*c[^<]*<\/sup>/i.test(part);
      // Drop the <sup> contents, not just the tags: plain() would otherwise
      // leave the catalyst marker's "c" stuck on the end of the ore name.
      const text = plain(part.replace(/<sup>[\s\S]*?<\/sup>/gi, '').replace(/&nbsp;/g, ' '));
      const m = text.match(/^\s*(\d+)\s*[x×]?\s*(.+?)\s*$/);
      if (!m) return null;

      const weight = m[2].match(/[([]\s*\+\s*([\d.]+)\s*kg\s*[)\]]/i);
      return {
        qty: parseInt(m[1], 10),
        item: m[2].replace(/\s*[([][^)\]]*[)\]]\s*$/, '').trim(),
        minWeight: weight ? num(weight[1]) : null,
        catalyst,
      };
    })
    .filter(Boolean);
}

export function parseEquipment(wikitext) {
  if (!wikitext) return [];

  // Everything after this heading is the limited-time tabber.
  const limitedAt = wikitext.search(/^==+ *Limited-Time Equipment *==+/m);

  // Split on tab markers, keeping where each chunk started.
  const marks = [...wikitext.matchAll(/^\|-\|\s*(.+?)=\s*$/gm)];
  const out = [];

  for (const [i, mark] of marks.entries()) {
    const rarity = mark[1].trim();
    const start = mark.index + mark[0].length;
    const end = i + 1 < marks.length ? marks[i + 1].index : wikitext.length;
    const chunk = wikitext.slice(start, end);
    const limited = limitedAt !== -1 && mark.index > limitedAt;

    for (const p of findTemplates(chunk, 'Equipment row')) {
      const name = plain(p.name);
      if (!name) continue;

      const stats = [];
      for (let n = 1; n <= MAX_STATS; n++) {
        const label = p[`stat${n}`];
        if (!label) continue;
        const base = parseRange(p[`val${n}`]);
        if (!base) continue;
        stats.push({
          stat: canonicalStat(label),
          base,
          sixStar: parseRange(p[`s6val${n}`]) ?? base,
        });
      }

      // Limited items are bought with an event currency instead of cash.
      const currencyKey = ['candy', 'ornaments', 'eggs'].find((k) => p[k] != null);

      out.push({
        id: slug(name),
        name,
        rarity,
        limited,
        slot: plain(p.slot) || null,
        image: p.image ? p.image.trim() : null,
        description: plain(p.description),
        color: (p['name color'] || '').trim() || null,
        recipe: parseRecipe(p.recipe),
        stats,
        price: num(p.price),
        currency: currencyKey ? currencyKey[0].toUpperCase() + currencyKey.slice(1) : null,
        currencyAmount: currencyKey ? num(p[currencyKey]) : null,
      });
    }
  }

  return out;
}
