/**
 * Consumables and the odds and ends: potions, trinkets, geodes, treasure chests.
 *
 * These are separate wiki pages with nothing in common structurally, but they
 * answer the same kind of question — "what is this thing and where do I get
 * one" — so they're parsed into one shape and shown together.
 */
import { plain, refs, num, slug, renderValues } from './parse-util.mjs';
import { tables, tabs, section, isBlank } from './parse-table.mjs';

/** `{{$|50,000}}` / `{{Meteor Shards|200}}` / both, separated by a slash. */
function priceOf(cell) {
  const text = String(cell ?? '');
  const money = text.match(/\{\{\s*\$\s*\|([^{}]*)\}\}/);
  const shards = text.match(/\{\{\s*Meteor Shards\s*\|([^{}]*)\}\}/i);
  return {
    money: money ? num(money[1]) : null,
    shards: shards ? num(shards[1]) : null,
    // renderValues first: plain() alone renders {{$|50,000}} as just "$".
    priceLabel: plain(renderValues(cell ?? '')) || null,
  };
}

/**
 * Potions, grouped by the alchemist who sells them.
 *
 * Each `== … Alchemist ==` section has its own table, and which shop a potion
 * is in matters as much as its effect — a potion you can't reach yet is not
 * an option.
 */
export function parsePotions(wikitext) {
  if (!wikitext) return [];

  const out = [];
  const seen = new Set();

  for (const mark of String(wikitext).matchAll(/^== *([^=\n]*Alchemist[^=\n]*) *==[ \t]*$/gim)) {
    const shop = plain(mark[1]).replace(/\s*Alchemist\s*$/i, '').trim();
    const body = section(wikitext, plain(mark[1])) ?? '';

    for (const table of tables(body)) {
      for (const row of table.rows) {
        const name = plain(row[0]);
        if (!name) continue;
        let id = slug(name);
        if (seen.has(id)) continue;
        seen.add(id);

        const effect = row[2] ?? '';
        // "(10 min)" at the end of the effect is how long it lasts.
        const dur = plain(effect).match(/\(([^)]*\b(?:min|mins|hour|hours|h)\b[^)]*)\)\s*$/i);

        out.push({
          id,
          name,
          shop: shop || null,
          ...priceOf(row[1]),
          effect: plain(effect).replace(/\s*\([^)]*\)\s*$/, '').trim(),
          stats: [...effect.matchAll(/\{\{Stat\|([^{}]+)\}\}/gi)].map((m) => m[1].trim()),
          duration: dur ? dur[1].trim() : null,
          description: plain(row[3]) || null,
          image: (row[4]?.match(/File:([^|\]]+)/i) ?? [])[1]?.trim() ?? null,
        });
      }
    }
  }

  return out;
}

/** Trinkets: passive perks with a fixed pickup spot. */
export function parseTrinkets(wikitext) {
  if (!wikitext) return [];
  const table = tables(wikitext)[0];
  if (!table) return [];

  return table.rows
    .map((row) => {
      const name = plain(row[0]);
      if (!name) return null;
      // The perk is often only in an image's alt text, which plain() drops.
      const alt = (row[1]?.match(/alt=([^|\]]+)/i) ?? [])[1];
      return {
        id: slug(name),
        name,
        color: (row[0].match(/color:\s*(#[0-9a-f]{3,8})/i) ?? [])[1] ?? null,
        perk: plain(alt ?? row[1]) || null,
        image: (row[1]?.match(/File:([^|\]]+)/i) ?? [])[1]?.trim() ?? null,
        obtained: isBlank(row[2]) ? null : plain(row[2]),
        where: isBlank(row[3]) ? null : plain(row[3]),
        places: [...new Set(refs(row[3] ?? ''))],
      };
    })
    .filter(Boolean);
}

/** A prose page reduced to its bullet lines, section by section. */
function bulletSections(wikitext, headings) {
  const out = {};
  for (const h of headings) {
    const body = section(wikitext, h);
    if (!body) continue;
    const lines = body
      .split('\n')
      .filter((l) => /^\s*\*/.test(l))
      .map((l) => plain(l.replace(/^\s*\*+/, '').replace(/\[\[File:[^\]]*\]\]/g, '')))
      .filter(Boolean);
    const prose = body
      .split('\n')
      .filter((l) => l.trim() && !/^\s*[*{|=<]/.test(l))
      .map((l) => plain(l))
      .filter(Boolean);
    if (lines.length || prose.length) out[slug(h)] = { heading: h, lines, prose };
  }
  return out;
}

export function parseGeodes(wikitext) {
  if (!wikitext) return null;
  return {
    sections: bulletSections(wikitext, [
      'Overview', 'Availability', 'Collection', 'Loot', 'Geode Variants',
    ]),
    wiki: 'https://prospecting.miraheze.org/wiki/Geodes',
  };
}

/** Treasure chests: how you get one, and what's in it per location. */
export function parseTreasureChests(wikitext) {
  if (!wikitext) return null;

  const loot = [];
  const lootBody = section(wikitext, 'Lootpool by Location');
  for (const [place, chunk] of lootBody ? tabs(lootBody) : []) {
    const items = chunk
      .split('\n')
      .filter((l) => /^\s*\*/.test(l))
      .map((l) => plain(l.replace(/^\s*\*+/, '')))
      .filter(Boolean);
    const fromTables = tables(chunk).flatMap((t) =>
      t.rows.map((r) => plain(r[0])).filter(Boolean),
    );
    if (items.length || fromTables.length) {
      loot.push({ id: slug(place), place, items: items.length ? items : fromTables });
    }
  }

  return {
    sections: bulletSections(wikitext, [
      'Overview', 'Obtainment', 'How To', 'Usage', 'Important Notes',
    ]),
    loot,
    wiki: 'https://prospecting.miraheze.org/wiki/Treasure_Chest',
  };
}
