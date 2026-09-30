/**
 * Excavations — timed digs you pay a permit for and collect hours later.
 *
 * Three things on one page: the six sites and what they cost, a level table
 * where the level drives luck, item count and duration together, and a reward
 * pool per site.
 *
 * The level table uses rowspan/colspan for its spacer columns, which a flat
 * row reader can't model; rows are matched on the numeric level in the first
 * cell and the remaining values are read positionally from there.
 */
import { plain, refs, num, slug } from './parse-util.mjs';
import { tabs, tables, section, isBlank } from './parse-table.mjs';

/** `* Permit Cost: '''$50,000,000'''` -> 50000000 */
function costLine(body, label) {
  const m = body.match(new RegExp(`^\\s*\\*\\s*${label}[^:]*:\\s*(.+)$`, 'im'));
  return m ? plain(m[1]).trim() : null;
}

/** `=== Volcanic Ruins (A-Site) ===` under a region tab. */
function parseSites(wikitext) {
  const sitesSection = section(wikitext, 'Excavation Sites');
  if (!sitesSection) return [];

  const out = [];
  for (const [region, body] of tabs(sitesSection)) {
    const marks = [...body.matchAll(/^=== *(.+?) *===[ \t]*$/gm)];
    marks.forEach((mark, i) => {
      const title = plain(mark[1]);
      const chunk = body.slice(mark.index + mark[0].length, marks[i + 1]?.index);
      // "Volcanic Ruins (A-Site)" — the letter is how the level table refers to it.
      const code = (title.match(/\(([A-F])-Site\)/i) ?? [])[1]?.toUpperCase() ?? null;
      const name = title.replace(/\s*\([A-F]-Site\)\s*/i, '').trim();
      const items = costLine(chunk, 'Number of items');

      out.push({
        id: slug(name),
        name,
        code,
        region,
        /** The prose line above the bullet list says where to stand. */
        where: plain(chunk.split('\n').find((l) => l.trim() && !/^\s*\*/.test(l)) ?? '') || null,
        permit: num(costLine(chunk, 'Permit Cost')),
        runCost: num(costLine(chunk, 'Excavation Cost')),
        itemsLabel: items,
        duration: costLine(chunk, 'Duration'),
        places: [...new Set(refs(chunk))],
      });
    });
  }
  return out;
}

/**
 * The level table: level -> luck, item counts per site group, speed multiplier
 * and the resulting duration at each site.
 */
function parseLevels(wikitext) {
  const body = section(wikitext, 'Excavation Levels');
  if (!body) return [];
  const table = tables(body)[0];
  if (!table) return [];

  const out = [];
  for (const row of table.rows) {
    const level = num(plain(row[0]));
    // The colspan sub-header ("Site A !! Site B …") lands here as a row.
    if (level == null || !Number.isInteger(level)) continue;
    const cells = row.map((c) => plain(c).trim()).filter((c) => c !== '');
    // level, luck, itemsA, itemsB, itemsCF, multiplier, then six durations.
    const [, luck, itemsA, itemsB, itemsCF, multiplier, ...durations] = cells;
    out.push({
      level,
      luck: num(luck),
      items: { A: itemsA ?? null, B: itemsB ?? null, 'C–F': itemsCF ?? null },
      speedMultiplier: num(multiplier),
      durations: Object.fromEntries(
        ['A', 'B', 'C', 'D', 'E', 'F'].map((k, i) => [k, durations[i] ?? null]),
      ),
    });
  }
  return out;
}

/** Per-site reward pools, each a table of item / description / effect / chance. */
function parseRewards(wikitext) {
  const body = section(wikitext, 'Excavation Rewards');
  if (!body) return {};

  const out = {};
  for (const [siteName, chunk] of tabs(body)) {
    const table = tables(chunk)[0];
    if (!table) continue;
    out[slug(siteName)] = table.rows
      .map((row) => {
        const name = refs(row[0])[0] ?? plain(row[0]);
        if (!name) return null;
        return {
          name,
          description: plain(row[1]) || null,
          effect: plain(row[2]) || null,
          percent: num(plain(row[3])),
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
  }
  return out;
}

export function parseExcavations(wikitext) {
  if (!wikitext) return null;

  const intro = String(wikitext).split(/^== /m)[0];
  const cap = intro.match(/level cap[^\d]*(\d+)/i);

  const sites = parseSites(wikitext);
  const rewards = parseRewards(wikitext);
  // The reward tabs don't always spell a site the same way the site heading
  // does — "Mysterious Meteor" against "Mysterious Meteors" — so an exact slug
  // match is tried first and a plural-tolerant one second.
  const loose = (id) => id.replace(/s$/, '');
  const byLoose = new Map(Object.keys(rewards).map((k) => [loose(k), k]));
  const unmatched = [];
  for (const site of sites) {
    const key = rewards[site.id] ? site.id : byLoose.get(loose(site.id));
    site.rewards = key ? rewards[key] : [];
    if (!site.rewards.length) unmatched.push(site.name);
  }

  return {
    summary: plain(intro.split('\n').find((l) => /^'''Excavations'''/.test(l.trim())) ?? ''),
    levelCap: cap ? num(cap[1]) : null,
    /** Locations that host a site, as the intro lists them. */
    places: [...new Set(refs(intro))].filter((r) => !/^tocright$/i.test(r)),
    /** Sites whose reward pool we couldn't line up — visible, not swallowed. */
    unmatchedRewards: unmatched,
    sites,
    levels: parseLevels(wikitext),
    wiki: 'https://prospecting.miraheze.org/wiki/Excavations',
  };
}
