/**
 * Equipment mutations — a universal stat multiplier on a crafted item.
 *
 * Every piece can carry one. The Effects section is a clean bullet list of
 * multiplier and extras; the Chances section is a grid of mutation against how
 * many catalysts you fed the forge, which is the only place the odds exist.
 */
import { plain, refs, num, slug } from './parse-util.mjs';
import { tables, tabs, section } from './parse-table.mjs';

/** `{{Enchant|Granite}}: 1.36×, +24 {{Stat|Dig Strength}}` */
const MUTATION_LINE = /^\s*\*\s*\{\{\s*Enchant\s*\|([^|{}]+)[^}]*\}\}\s*:\s*(.+)$/i;

export function parseMutations(wikitext) {
  if (!wikitext) return null;

  const intro = String(wikitext).split(/^== /m)[0] + (section(wikitext, 'Mutations') ?? '');

  const effects = section(wikitext, 'Effects') ?? '';
  const mutations = [];
  for (const line of effects.split('\n')) {
    const m = line.match(MUTATION_LINE);
    if (!m) continue;
    const name = m[1].trim();
    const rest = plain(m[2]);
    // The leading "1.36x" is the universal multiplier; anything after the first
    // comma is an additive bonus on top of it.
    const parts = rest.split(',').map((p) => p.trim()).filter(Boolean);
    mutations.push({
      id: slug(name),
      name,
      multiplier: num(parts[0]),
      bonuses: parts.slice(1),
      stats: [...m[2].matchAll(/\{\{Stat\|([^{}]+)\}\}/gi)].map((s) => s[1].trim()),
    });
  }

  /**
   * Odds per number of catalysts. Each tab is one equipment tier, each row one
   * mutation, each column a catalyst count — so a cell is "this mutation, at
   * this many catalysts".
   */
  const chanceBody = section(wikitext, 'Chances');
  const chanceTiers = [];
  for (const [tier, chunk] of chanceBody ? tabs(chanceBody) : []) {
    const table = tables(chunk)[0];
    if (!table) continue;
    // The header row is the catalyst counts; the first column is its label.
    const counts = table.headers.slice(1).map((h) => num(h)).filter((n) => n != null);
    const rows = table.rows
      .map((row) => {
        const name = (row[0].match(/\{\{\s*Enchant\s*\|([^|{}]+)/i) ?? [])[1]?.trim()
          ?? plain(row[0]);
        if (!name) return null;
        return {
          mutation: name,
          percents: row.slice(1).map((c) => num(plain(c))),
        };
      })
      .filter(Boolean);
    if (rows.length) chanceTiers.push({ tier, counts, rows });
  }

  const forge = intro.match(/Mutation Forge'''\s*(?:located )?at \[\[([^\]|]+)/i);

  return {
    summary: plain(
      intro.split('\n').find((l) => /Equipment Mutations'''/.test(l)) ?? '',
    ) || null,
    /** Where you reroll one. */
    forge: forge ? forge[1].trim() : null,
    mutations: mutations.sort((a, b) => (b.multiplier ?? 0) - (a.multiplier ?? 0)),
    chanceTiers,
    wiki: 'https://prospecting.miraheze.org/wiki/Mutations',
  };
}

/**
 * The icon grid from the wiki's own front page.
 *
 * Every entry is `[[File:X.png|120px|link=Target]]`, which is the only curated
 * list of "the things people come here for" the wiki has — worth reusing rather
 * than inventing our own ordering.
 */
export function parseNavIcons(wikitext) {
  if (!wikitext) return [];
  const out = [];
  const seen = new Set();
  for (const m of String(wikitext).matchAll(/\[\[File:([^|\]]+)\|[^\]]*link=([^\]|]+)[^\]]*\]\]/g)) {
    const file = m[1].trim();
    const target = m[2].trim();
    if (seen.has(target)) continue;
    seen.add(target);
    out.push({ target, image: file });
  }
  return out;
}
