/**
 * The Museum: display slots, per-ore stat boosts, and modifier bonuses.
 *
 * The Museum page is the authority here. Every mineral page repeats its own
 * boost under `== Museum Usage ==`, but only the Museum page groups ores by
 * the rarity of the display that accepts them — which is the whole constraint
 * of the thing, since a display only takes minerals of its own rarity.
 *
 * Three layers stack into one boost:
 *   1. the ore's own stat boost, which maxes out at a minimum weight,
 *   2. the ore's modifier, which adds more regardless of weight,
 *   3. the modifier's own rarity multiplier.
 */
import { plain, refs, num, slug } from './parse-util.mjs';

/**
 * Split a wikitable row into cells.
 *
 * Cells are separated by `||` on one line or by a leading `|` on the next, and
 * both forms appear on this page. Neither can be split naively: `{{Stat|Luck}}`
 * and `[[File:x.png|18px|link=y]]` both carry pipes of their own, so the split
 * has to track template and link depth.
 */
function cells(row) {
  const out = [];
  let buf = '';
  let depth = 0;
  for (let i = 0; i < row.length; i++) {
    const two = row.slice(i, i + 2);
    if (two === '{{' || two === '[[') { depth++; buf += two; i++; continue; }
    if (two === '}}' || two === ']]') { depth--; buf += two; i++; continue; }
    if (depth === 0) {
      if (two === '||') { out.push(buf); buf = ''; i++; continue; }
      // A newline followed by `|` starts the next cell; `|-` ended the row.
      if (row[i] === '\n' && row[i + 1] === '|') { out.push(buf); buf = ''; i++; continue; }
    }
    buf += row[i];
  }
  out.push(buf);
  return out.map((c) => c.replace(/^\s*\|/, '').trim()).filter((c, i) => i > 0 || c !== '');
}

/**
 * Every data row of the first wikitable after `heading`.
 *
 * The rarity headings are wrapped in a gradient span — `=== <span …>''Common
 * Ores''</span> ===` — so the heading text has to be flattened before it can be
 * compared, rather than matched in place.
 */
function tableRows(wikitext, heading) {
  const want = heading.toLowerCase();
  let at = -1;
  for (const m of wikitext.matchAll(/^=+ *(.+?) *=+[ \t]*$/gm)) {
    if (plain(m[1]).toLowerCase() === want) { at = m.index; break; }
  }
  if (at === -1) return [];
  const body = wikitext.slice(at);
  const open = body.indexOf('{|');
  if (open === -1) return [];
  const close = body.indexOf('|}', open);
  return body
    .slice(open, close === -1 ? undefined : close)
    .split(/^\|-.*$/m)
    .slice(1) // the header row precedes the first `|-`
    .map((row) => cells(row))
    .filter((row) => row.length > 1);
}

/**
 * `0.05x`, `0.005&times;` and `0.4×, 0.32×` all mean multipliers.
 *
 * The sign matters and is easy to lose: a few ores carry a debuff alongside
 * their boost (Flarebloom is +0.75× Luck but −0.5× Size Boost), and the wiki
 * writes that minus as a hyphen here while using an en dash on the stat beside
 * it. Dropping it would advertise a penalty as a bonus.
 */
function multipliers(cell) {
  const text = plain(cell).replace(/&times;/gi, '×');
  return [...text.matchAll(/([-–−]?)\s*(\d+(?:\.\d+)?)\s*[x×]/gi)].map(
    (m) => parseFloat(m[2]) * (m[1] ? -1 : 1),
  );
}

/** `{{Stat|Luck}} + {{Stat|Capacity}}` -> ['Luck', 'Capacity'] */
const statsIn = (cell) =>
  [...String(cell).matchAll(/\{\{Stat\|([^{}]+)\}\}/gi)].map((m) => m[1].trim());

const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Exotic'];

/**
 * How many displays each rarity has, and what the locked ones cost.
 *
 * Money is `N/A` for Exotic — that display is shards-only — so an unparseable
 * price is a real "you can't buy this", not a miss.
 */
function parseDisplays(wikitext) {
  return tableRows(wikitext, 'Displays')
    .map((row) => {
      const rarity = plain(row[0]);
      if (!RARITIES.includes(rarity)) return null;
      const money = plain(row[3]);
      return {
        rarity,
        free: num(row[1]) ?? 0,
        locked: num(row[2]) ?? 0,
        money: /n\/?a/i.test(money) ? null : num(money),
        shards: num(plain(row[4])),
        total: num(row[5]) ?? 0,
      };
    })
    .filter(Boolean);
}

/**
 * The per-rarity ore tables: `Ore | Minimum KG | Bonus | Maximum Boost`.
 *
 * A row can name several stats and several boosts. Where the counts match they
 * pair up in order (Dinosaur Skull: Sell Boost 0.4×, Size Boost 0.32×); where
 * one boost is given for several stats it applies to each of them.
 */
function parseOres(wikitext) {
  const out = [];
  for (const rarity of RARITIES) {
    for (const row of tableRows(wikitext, `${rarity} Ores`)) {
      const name = refs(row[0])[0] ?? plain(row[0]);
      if (!name) continue;
      const stats = statsIn(row[2]);
      const values = multipliers(row[3]);
      if (!stats.length || !values.length) continue;
      out.push({
        id: slug(name),
        name,
        rarity,
        minWeight: num(row[1]),
        boosts: stats.map((stat, i) => ({
          stat,
          value: values.length === stats.length ? values[i] : values[0],
        })),
      });
    }
  }
  return out;
}

/**
 * Modifier bonuses, which apply on top of the ore's own boost and ignore weight.
 *
 * A `0` chance means the modifier can't be dug at all — it comes from an event,
 * a geode or a chest — and the footnote says which, so it's kept as the note
 * rather than being rendered as "0% chance".
 */
function parseModifiers(wikitext, refNotes) {
  return tableRows(wikitext, 'Modifier Bonuses')
    .map((row) => {
      const name = plain(row[0]);
      if (!name) return null;
      const stats = statsIn(row[1]);
      const chanceText = plain(row[2].replace(/<ref[\s\S]*?(?:\/>|<\/ref>)/gi, '')).trim();
      const chance = /%/.test(chanceText) ? num(chanceText) : null;
      // The footnote on a 0-chance row is the only place its source is named.
      const refName = row[2].match(/<ref[^>]*>([\s\S]*?)<\/ref>/i);
      const reused = row[2].match(/<ref\s+name="([^"]+)"\s*\/>/i);
      return {
        name,
        stats,
        /** Percent chance per dig, or null when it can't be dug. */
        chance,
        source: refName ? plain(refName[1]) : reused ? refNotes[reused[1]] ?? null : null,
        diggable: chance != null && chance > 0,
      };
    })
    .filter(Boolean);
}

/** Named `<ref name="x">…</ref>` bodies, so `<ref name="x"/>` can resolve. */
function namedRefs(wikitext) {
  const out = {};
  for (const m of wikitext.matchAll(/<ref\s+name="([^"]+)"\s*>([\s\S]*?)<\/ref>/gi)) {
    out[m[1]] = plain(m[2]);
  }
  return out;
}

function parseModifierMultipliers(wikitext) {
  return tableRows(wikitext, 'Modifier Multiplier Per Rarity')
    .map((row) => {
      const rarity = plain(row[0]);
      if (!RARITIES.includes(rarity)) return null;
      return { rarity, value: multipliers(row[1])[0] ?? null };
    })
    .filter(Boolean);
}

export function parseMuseum(wikitext) {
  if (!wikitext) return null;

  const displays = parseDisplays(wikitext);
  const ores = parseOres(wikitext);
  const modifiers = parseModifiers(wikitext, namedRefs(wikitext));
  const modifierMultipliers = parseModifierMultipliers(wikitext);

  // Treasured is called out in prose under the multiplier table, not in it.
  const treasured = wikitext.match(/Treasured<\/span> modifier gives (\d+(?:\.\d+)?)\s*&times;/i);

  return {
    displays,
    slots: displays.reduce((t, d) => t + d.total, 0),
    ores,
    modifiers,
    modifierMultipliers,
    treasuredMultiplier: treasured ? parseFloat(treasured[1]) : 2,
    stats: [...new Set(ores.flatMap((o) => o.boosts.map((b) => b.stat)))].sort(),
    wiki: 'https://prospecting.miraheze.org/wiki/Museum',
  };
}
