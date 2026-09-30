/**
 * The progression systems: levels, titles, runes, mastery and permanent buffs.
 *
 * These live on five separate wiki pages and never reference each other, but
 * they're one question from a player's side — "why am I not getting stronger" —
 * so they're parsed together and shown together.
 */
import { plain, refs, num, slug, renderValues } from './parse-util.mjs';
import { tables, tabs, section, isBlank } from './parse-table.mjs';
import { questBlocks, questFields } from './parse-quests.mjs';

/** Levels, the XP each one costs, and what an ore of each rarity is worth. */
export function parseLevels(wikitext) {
  if (!wikitext) return null;

  const all = tables(wikitext);
  const xpTable = all.find((t) => /rarity/i.test(t.headers[0] ?? ''));
  const reqTable = all.find(
    (t) => /^level/i.test(t.headers[0] ?? '') && /exp/i.test(t.headers[1] ?? ''),
  );
  const titleTable = all.find((t) => /title/i.test(t.headers[0] ?? ''));

  const steps = (reqTable?.rows ?? [])
    .map((row) => {
      // "1 → 2" — the level you're leaving is the one that matters.
      const from = num(plain(row[0]));
      const cost = num(plain(row[1]));
      return from == null ? null : { from, to: from + 1, cost };
    })
    .filter(Boolean);

  // Cumulative XP is the number people actually want ("how far to 60?").
  let running = 0;
  for (const step of steps) {
    running += step.cost ?? 0;
    step.total = running;
  }

  return {
    xpByRarity: (xpTable?.rows ?? [])
      .map((row) => ({ rarity: plain(row[0]), xp: num(plain(row[1])) }))
      .filter((r) => r.rarity),
    steps,
    maxLevel: steps.length ? steps.at(-1).to : null,
    /** Every 5 levels you're given a new title. */
    titles: (titleTable?.rows ?? [])
      .map((row) => ({
        name: plain(row[0]),
        range: plain(row[1]),
        color: (row[0].match(/color:\s*(#[0-9a-f]{3,8})/i) ?? [])[1] ?? null,
      }))
      .filter((t) => t.name),
    wiki: 'https://prospecting.miraheze.org/wiki/Level',
  };
}

/** Equippable runes, and how many slots you have at each level. */
export function parseRunes(wikitext) {
  if (!wikitext) return null;

  const all = tables(wikitext);
  const slotTable = all.find((t) => /slot/i.test(t.headers[1] ?? ''));
  const runeTable = all.find((t) => /rune/i.test(t.headers[0] ?? '') && t.rows.length > 5);

  return {
    slots: (slotTable?.rows ?? [])
      .map((row) => ({ level: num(plain(row[0])), slots: num(plain(row[1])) }))
      .filter((r) => r.level != null),
    runes: (runeTable?.rows ?? [])
      .map((row) => {
        const name = plain(row[0]);
        if (!name) return null;
        return {
          id: slug(name),
          name,
          color: (row[0].match(/color:\s*(#[0-9a-f]{3,8})/i) ?? [])[1] ?? null,
          image: (row[1]?.match(/File:([^|\]]+)/i) ?? [])[1]?.trim() ?? null,
          effect: plain(row[2]) || null,
          /** Where it's found — a rune is picked up in the world, not crafted. */
          where: isBlank(row[3]) ? null : plain(row[3]),
          places: [...new Set(refs(row[3] ?? ''))],
        };
      })
      .filter(Boolean),
    mechanics: (section(wikitext, 'Mechanics') ?? '')
      .split('\n')
      .filter((l) => /^\s*\*/.test(l))
      .map((l) => plain(l.replace(/^\s*\*/, '').replace(/\[\[File:[^\]]*\]\]/g, '')))
      .filter(Boolean),
    wiki: 'https://prospecting.miraheze.org/wiki/Runes',
  };
}

/**
 * Permanent buffs — the ones you keep once earned.
 *
 * Each is a `== Name ==` section of prose rather than a table, so the lines are
 * kept as written; paraphrasing a buff risks changing what it claims to do.
 */
export function parsePermanentBuffs(wikitext) {
  if (!wikitext) return [];

  const out = [];
  for (const mark of String(wikitext).matchAll(/^== *(.+?) *==[ \t]*$/gm)) {
    const name = plain(mark[1]);
    if (!name) continue;
    const body = section(wikitext, name) ?? '';
    out.push({
      id: slug(name),
      name,
      /** The page links whatever grants it in the heading itself. */
      source: refs(mark[1])[0] ?? null,
      lines: body
        .split('\n')
        // Image markup on its own is not a sentence about the buff; several
        // lines are just an icon followed by the name it illustrates.
        .map((l) => plain(l.replace(/^\s*\*/, '').replace(/\[\[File:[^\]]*\]\]/g, '')).trim())
        .filter((l) => l && !/^\d+px/.test(l)),
    });
  }
  return out;
}

/**
 * Mastery — milestones per location, plus crafting, sluices, geodes and maps.
 *
 * Tiers are written as `{{Quest}}` templates, exactly like the Quests page, so
 * the same block reader is reused rather than a second one written. A tier's
 * reward line is where the actual boost lives ("Rubble Creek Luck: 1.05x").
 */
function masteryTiers(chunk) {
  return questBlocks(chunk)
    .map(({ body }) => {
      const f = questFields(body);
      const name = plain(f.quest);
      if (!name) return null;
      const steps = [];
      for (let n = 1; n <= 8; n++) {
        if (f[`queststep${n}`]) steps.push(plain(renderValues(f[`queststep${n}`])));
      }
      return {
        name,
        // "Rubble Creek Mastery: 3" — the trailing number is the tier.
        tier: num((name.match(/:\s*(\d+)\s*$/) ?? [])[1]),
        steps,
        rewards: plain(renderValues(f.rewards ?? '')) || null,
      };
    })
    .filter(Boolean)
    // A track ends with an untiered "…: Complete" summary row; it belongs last,
    // not first, which is where a null tier would otherwise sort it.
    .sort((a, b) => (a.tier ?? Infinity) - (b.tier ?? Infinity));
}

const BOOST_LINE = /^[ \t]*'''Boost:?'''[ \t]*(.+)$/im;

/** One mastery track: a location, or crafting / sluices / geodes / maps. */
function masteryTrack(name, chunk) {
  const tiers = masteryTiers(chunk);
  if (!tiers.length) return null;
  const boost = chunk.match(BOOST_LINE);
  return {
    id: slug(name),
    name: name.replace(/\s*Mastery\s*$/i, '').trim() || name,
    boost: boost ? plain(boost[1]).replace(/\.$/, '') : null,
    tiers,
  };
}

export function parseMastery(wikitext) {
  if (!wikitext) return null;

  const tracks = [];

  // Locations sit in a tabber; the other tracks are plain `== X Mastery ==`.
  const locationBody = section(wikitext, 'Location Mastery');
  for (const [label, chunk] of locationBody ? tabs(locationBody) : []) {
    const track = masteryTrack(label, chunk);
    if (track) tracks.push({ ...track, kind: 'Location' });
  }

  for (const mark of String(wikitext).matchAll(/^== *([^=\n]+?) *==[ \t]*$/gm)) {
    const heading = plain(mark[1]);
    if (!/mastery$/i.test(heading) || /^location mastery$/i.test(heading)) continue;
    const track = masteryTrack(heading, section(wikitext, heading) ?? '');
    if (track && !tracks.some((t) => t.id === track.id)) {
      tracks.push({ ...track, kind: 'Activity' });
    }
  }

  return {
    overview: plain(section(wikitext, 'Overview') ?? '') || null,
    /** The wiki is explicit that location luck does not stack. */
    stacks: !/does not stack/i.test(locationBody ?? ''),
    tracks,
    wiki: 'https://prospecting.miraheze.org/wiki/Mastery',
  };
}
