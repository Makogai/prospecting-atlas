/**
 * Enchants for pans and shovels.
 *
 * One enchant per tool, re-rollable at the altar. The two tabs are shaped
 * differently on purpose: a pan's odds depend on which ore you feed the altar
 * (Aurorite / Aetherite / Aetherium), so it has a chance column per ore, while
 * a shovel has a single flat chance.
 *
 * Column headers are read rather than assumed — the shovel table carries an
 * `<abbr>` whose tooltip flattens into the header text, so positional indexing
 * would quietly shift.
 */
import { plain, refs, num, slug } from './parse-util.mjs';
import { tabs, tables, isBlank } from './parse-table.mjs';

/**
 * `{{Enchant|Forceful}}` and `{{Enchant|Mastered|solid}}` both name an enchant.
 * `plain()` renders a template as its *name*, which would make every row read
 * "Enchant", so the first argument has to be taken directly.
 */
const enchantName = (cell) => {
  const m = String(cell ?? '').match(/\{\{\s*Enchant\s*\|([^|{}]+)/i);
  return m ? m[1].trim() : plain(cell);
};

export function parseEnchants(wikitext) {
  if (!wikitext) return [];

  const at = String(wikitext).indexOf('== Available Enchantments ==');
  if (at === -1) return [];

  const out = [];
  const seen = new Set();

  for (const [label, body] of tabs(wikitext.slice(at))) {
    const slot = /shovel/i.test(label) ? 'Shovel' : 'Pan';
    const table = tables(body)[0];
    if (!table) continue;

    const col = (test) => table.headers.findIndex((h) => test.test(h));
    const nameAt = col(/^enchant$/i);
    const effectAt = col(/effect/i);
    const noteAt = col(/source|note/i);
    // "Aurorite Chance", "Aetherite Chance", … or a single bare "Chance".
    const chanceCols = table.headers
      .map((h, i) => ({ h, i }))
      .filter((c) => /chance/i.test(c.h));
    // Whatever is left over on the shovel table is the Seed of Light gate.
    const lockAt = table.headers.findIndex((h) => /^sol/i.test(h));

    for (const row of table.rows) {
      const name = enchantName(row[nameAt === -1 ? 0 : nameAt]);
      if (!name) continue;

      const chances = chanceCols
        .map(({ h, i }) => {
          const pct = num(plain(row[i]));
          if (pct == null) return null;
          return {
            // "Aurorite Chance" -> "Aurorite"; a bare "Chance" has no ore.
            via: plain(h).replace(/\s*chance\s*$/i, '').trim() || null,
            percent: pct,
          };
        })
        .filter(Boolean);

      const effectCell = row[effectAt === -1 ? 1 : effectAt] ?? '';
      const note = noteAt === -1 ? null : row[noteAt];
      const lock = lockAt === -1 ? null : row[lockAt];

      let id = slug(`${name} ${slot}`);
      if (seen.has(id)) { let n = 2; while (seen.has(`${id}-${n}`)) n++; id = `${id}-${n}`; }
      seen.add(id);

      out.push({
        id,
        name,
        slot,
        // An effect cell can hold two lines; plain() collapses whitespace, so
        // without this they run together as "+25 Capacity1.1x Pan Luck".
        effect: plain(String(effectCell).replace(/<br\s*\/?>|\s*[\r\n]+\s*/gi, ' · ')),
        /** Stats and minerals the effect names, for cross-linking. */
        refs: [...new Set(refs(effectCell))],
        stats: [...effectCell.matchAll(/\{\{Stat\|([^{}]+)\}\}/gi)].map((m) => m[1].trim()),
        chances,
        /** Best single roll chance, for ranking. */
        bestChance: chances.length ? Math.max(...chances.map((c) => c.percent)) : null,
        note: isBlank(note) ? null : plain(note),
        locked: !isBlank(lock) && !/^not locked$/i.test(plain(lock)) ? plain(lock) : null,
      });
    }
  }

  return out;
}

/** The altar's own instructions, kept as prose because that's what they are. */
export function parseEnchantHowTo(wikitext) {
  const m = String(wikitext ?? '').match(
    /^== *How to Enchant *==[ \t]*$([\s\S]*?)(?=^\{\||^== )/m,
  );
  if (!m) return [];
  return m[1]
    .split('\n')
    .filter((l) => /^\s*\*/.test(l))
    .map((l) => plain(l.replace(/^\s*\*/, '').replace(/\[\[File:[^\]]*\]\]/g, '')))
    .filter(Boolean);
}
