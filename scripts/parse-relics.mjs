/**
 * Relics — consumables that trigger events, grant boosts or apply enchants.
 *
 * The page is four categories, each holding a tabber with one tab per relic.
 * Inside a tab, `== Obtainment ==` and `== Usage ==` repeat at the *same*
 * heading level as the categories themselves, so a generic section reader would
 * stop at the first one. Categories are therefore sliced by name and the
 * subsections read within a tab.
 */
import { plain, refs, slug } from './parse-util.mjs';
import { tabs, tables } from './parse-table.mjs';

const CATEGORIES = ['Event Relics', 'Boost Relics', 'Enchant Relics', 'Miscellaneous Relics'];

/** Bullet lines under a `== Heading ==` inside one relic's tab. */
function bullets(body, heading) {
  const re = new RegExp(`^== *${heading} *==[ \\t]*$([\\s\\S]*?)(?=^== |$(?![\\s\\S]))`, 'im');
  const m = body.match(re);
  if (!m) return [];
  const out = [];
  for (const line of m[1].split('\n')) {
    const bullet = line.match(/^(\*+)\s*(.+)$/);
    if (!bullet) continue;
    const text = plain(bullet[2]).trim();
    if (!text) continue;
    // `**` lines qualify the `*` above them (a chest, then which beaches).
    out.push({ text, depth: bullet[1].length, refs: [...new Set(refs(bullet[2]))] });
  }
  return out;
}

export function parseRelics(wikitext) {
  if (!wikitext) return { relics: [], acquisition: [] };

  const text = String(wikitext);
  // Where each category starts, so one can be sliced off without a section
  // reader tripping over the repeated Obtainment/Usage headings inside.
  const marks = CATEGORIES.map((name) => ({
    name,
    at: text.search(new RegExp(`^== *${name} *==[ \\t]*$`, 'im')),
  }))
    .filter((c) => c.at !== -1)
    .sort((a, b) => a.at - b.at);

  const relics = [];
  const seen = new Set();

  const take = (id) => {
    let out = id;
    if (seen.has(out)) { let n = 2; while (seen.has(`${out}-${n}`)) n++; out = `${out}-${n}`; }
    seen.add(out);
    return out;
  };

  marks.forEach((mark, i) => {
    const chunk = text.slice(mark.at, marks[i + 1]?.at);
    const category = mark.name.replace(/\s*Relics\s*$/i, '');

    // Enchant relics are a flat table rather than a tabber — they're books with
    // a one-line effect, so they don't get a tab each.
    if (!chunk.includes('<tabber>')) {
      for (const table of tables(chunk)) {
        for (const row of table.rows) {
          const name = refs(row[0])[0] ?? plain(row[0]);
          if (!name) continue;
          relics.push({
            id: take(slug(name)),
            name,
            category,
            image: null,
            description: plain(row[1]) || null,
            effect: null,
            triggers: [...(row[1] ?? '').matchAll(/\{\{\s*Enchant\s*\|([^|{}]+)/gi)].map((m) => m[1].trim()),
            obtainment: plain(row[2]) ? [{ text: plain(row[2]), depth: 1, refs: [...new Set(refs(row[2]))] }] : [],
            usage: [],
          });
        }
      }
      return;
    }

    for (const [name, body] of tabs(chunk)) {
      const id = take(slug(name));

      // The first plain paragraph is the flavour line; the second says what it does.
      const prose = body
        .split('\n')
        .filter((l) => l.trim() && !/^\s*[*=<{|]/.test(l) && !/^\[\[File:/.test(l.trim()))
        .map((l) => plain(l).trim())
        .filter(Boolean);

      relics.push({
        id,
        name,
        category,
        image: (body.match(/\[\[File:([^|\]]+)/i) ?? [])[1]?.trim() ?? null,
        description: prose[0] ?? null,
        effect: prose.slice(1).join(' ') || null,
        /** What it triggers or applies — an event, an enchant, a boost. */
        triggers: [...new Set(refs(prose.slice(1).join(' ') ? body : ''))]
          .filter((r) => /^(Events|Enchant)/i.test(r))
          .map((r) => r.replace(/^Events#tabber-/, '').replace(/_/g, ' ')),
        obtainment: bullets(body, 'Obtainment'),
        usage: bullets(body, 'Usage'),
      });
    }
  });

  // The page-level Acquisition list: the handful of ways relics appear at all.
  const acq = text.match(/^== *Acquisition *==[ \t]*$([\s\S]*?)(?=^== )/im);
  const acquisition = acq
    ? acq[1]
        .split('\n')
        .filter((l) => /^\s*\*/.test(l))
        .map((l) => ({ text: plain(l.replace(/^\s*\*+/, '')), refs: [...new Set(refs(l))] }))
        .filter((x) => x.text)
    : [];

  return { relics, acquisition, wiki: 'https://prospecting.miraheze.org/wiki/Relics' };
}
