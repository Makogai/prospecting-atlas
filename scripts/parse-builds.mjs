/**
 * Community build guide -> structured builds.
 *
 * Source: the Prospecting! Build Guide, a Google Doc maintained by Autumn,
 * bosnia123123, Finnlay, Martika14, PPatel, em_miaou and softlyhollowed.
 * This is their work, not the wiki's and not ours: the site credits them and
 * links the doc as the source of truth, because it "is subject to change
 * without warning" and this is only ever a snapshot.
 *
 * Refresh with:
 *   npm run data:builds
 *
 * The doc exports as a Google Docs table dump, so every block looks like:
 *
 *   <author credit>
 *   Luck Efficiency V.          <- anchor name
 *   Luck Efficiency V.          <- heading
 *   Highest average rerolls.    <- purpose
 *   * notes...
 *   Dig Strength x 1.5 >= Capacity
 *   Museum
 *     Modifier: Treasured 2L ...
 *     <Rarity>
 *     <code> <Ore> <weight> | <alt>
 *   Equipment
 *     Charm / Neck / Rings / Runes / Pan / Shovel
 *   Key                          <- shared legend, ends the block
 */
import { slug } from './parse-util.mjs';

/** Boost codes the guide uses in its museum grid. */
export const BOOST_CODES = {
  L: 'Luck',
  C: 'Capacity',
  W: 'Size Boost',
  D: 'Dig Amount',
  S: 'Dig Speed',
  $: 'Sell Boost',
  K: 'Walk Speed',
  M: 'Modifier Boost',
  A: 'Shake Amount',
  P: 'Shake Speed',
};

const RARITIES = [
  'Exotic', 'Mythic', 'Legendary', 'Epic', 'Rare', 'Uncommon', 'Common', 'Ascended',
];

/**
 * The guide's build families. Names are matched against these rather than taken
 * from position, because a few blocks put a credit line or a stray bullet where
 * the heading usually sits.
 */
const NAME_FAMILIES = [
  'Luck Efficiency', 'Summer(?:time)? Hybrid', 'Hybrid', 'Size Boost',
  'Items Farming', 'Sell Boost', 'Money Printer', 'Treasure/Geode',
  'Geode Opening', 'Shards Farming', 'Walk Speed', 'Nothing Burger',
  'Cookie Effect', 'Hearthflame Farming',
];

// Built from a string, so the escapes have to survive the string literal too:
// a bare '\b' here would be a backspace character, not a word boundary.
const NAME_RE = new RegExp(`^(?:${NAME_FAMILIES.join('|')})\\b[^\\t]*$`, 'i');

const SLOT_MARKERS = {
  charm: /^charm$/i,
  neck: /^neck(lace)?$/i,
  rings: /^rings?$/i,
  runes: /^runes?$/i,
  pan: /^pan$/i,
  shovel: /^shovel$/i,
};

const clean = (s) =>
  String(s ?? '')
    .replace(/ /g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .trim();

const isBullet = (s) => /^[*•●]/.test(clean(s));

/**
 * The guide hangs footnote markers off names (‡ † ⚠ ✷ ☒ ☽ ★ ⭐ 🌀 ☀ 🏵).
 * They carry per-build caveats that live in the notes, so strip them from names.
 */
// Written as literals on purpose: with the /u flag, a five-digit escape like
// ἳc is read as ἳ followed by a literal "c", which quietly strips the
// letter c out of every ore name. Astral characters are safe written directly.
const FOOTNOTES = /[‡†⚠✱꙯★☆⭐☀☑☒☽☾🏵🌀✷*]/gu;
const stripNotes = (s) => clean(String(s).replace(FOOTNOTES, ''));

/** Leading boost codes, e.g. "LCDA " or "+L-W " or "SP ". */
function takeCodes(text) {
  const m = text.match(/^([+\-$A-Z]{1,6})\s+/);
  if (!m) return { codes: [], rest: text };
  const letters = m[1].match(/[A-Z$]/g) ?? [];
  if (!letters.length || !letters.every((c) => BOOST_CODES[c])) return { codes: [], rest: text };
  return { codes: letters.map((c) => BOOST_CODES[c]), rest: text.slice(m[0].length) };
}

/**
 * `LCDA Prismara* 20 | Vineheart 40` ->
 * { codes: ['Luck','Capacity','Dig Amount','Shake Amount'], options: [...] }
 */
function parseOreCell(raw) {
  let text = stripNotes(raw);
  if (!text || /^slot \d/i.test(text)) return null;
  if (/^\(?any(thing)?/i.test(text) || /Anything/.test(text)) return null;

  // Codes and "pick N:" appear in either order, e.g. "C pick 2: Coral 10".
  let codes = [];
  let pick = 1;
  for (let pass = 0; pass < 2; pass++) {
    const taken = takeCodes(text);
    if (taken.codes.length) { codes = taken.codes; text = taken.rest; }
    const pickMatch = text.match(/^pick\s+(\d+)\s*:\s*/i);
    if (pickMatch) { pick = parseInt(pickMatch[1], 10); text = text.slice(pickMatch[0].length); }
  }

  const options = text
    .split('|')
    .map((part) => {
      // A code can also prefix an individual option: "L Diamond 20 | S Sapphire 20".
      let t = takeCodes(stripNotes(part)).rest;
      if (!t) return null;
      const w = t.match(/(\d+(?:\.\d+)?)(?:\s+see.*)?\s*$/i);
      const ore = clean(t.replace(/(\d+(?:\.\d+)?)(?:\s+see.*)?\s*$/i, ''));
      if (!ore || ore.length > 30) return null;
      if (/^any(thing)?$/i.test(ore)) return null;
      return { ore, minWeight: w ? parseFloat(w[1]) : null };
    })
    .filter(Boolean);

  return options.length ? { codes, pick, options } : null;
}

/**
 * `2x/0x Sun's Gift` -> { count: 2, countSixRing: 0, name: "Sun's Gift" }
 * `Antlers of Life | Witch Hat` keeps the alternatives alongside the first.
 */
function parseEquipEntry(raw) {
  const text = stripNotes(raw);
  if (!text) return null;

  const [head, ...rest] = text.split('|').map((x) => stripNotes(x)).filter(Boolean);
  if (!head) return null;

  const m = head.match(/^(\d+)\s*[x×]\s*(?:\/\s*(\d+)\s*[x×]\s*)?(.+)$/i);
  let name = clean(m ? m[3] : head);

  const paren = name.match(/^(.+?)\s*\(([^)]*)\)\s*$/);
  const inlineNote = paren ? clean(paren[2]) : null;
  if (paren) name = clean(paren[1]);
  if (!name || name.length > 34) return null;

  return {
    count: m ? parseInt(m[1], 10) : 1,
    countSixRing: m && m[2] != null ? parseInt(m[2], 10) : null,
    name,
    ...(inlineNote ? { note: inlineNote } : {}),
    ...(rest.length ? { alternatives: rest.map((r) => clean(r.replace(/^\d+\s*[x×]\s*/i, ''))) } : {}),
  };
}

/** `Stage IV. Builds - Meteor Valley` / `Bonus Builds` -> a stage label per line. */
function stageIndex(lines) {
  const marks = [];
  for (const [i, line] of lines.entries()) {
    const s = clean(line);
    const stage = s.match(/^Stage\s+(V|IV|III|II|I|0)\b[.:]?\s*(?:Builds)?\s*[-:]?\s*(.*)$/i);
    if (stage && s.length < 70) {
      marks.push({ at: i, stage: stage[1].toUpperCase(), area: clean(stage[2]).replace(/^Builds\s*-\s*/i, '') });
      continue;
    }
    if (/^Bonus Builds$/i.test(s)) marks.push({ at: i, stage: 'Bonus', area: '' });
  }
  return (line) => {
    let hit = null;
    for (const m of marks) {
      if (m.at > line) break;
      hit = m;
    }
    return hit ?? { stage: null, area: '' };
  };
}

export function parseBuilds(raw) {
  const lines = raw.replace(/\r/g, '').split('\n');
  const museumAt = lines.map((l, i) => (clean(l) === 'Museum' ? i : -1)).filter((i) => i >= 0);
  const stageAt = stageIndex(lines);
  const builds = [];
  const usedIds = new Set();

  for (const mi of museumAt) {
    /* ---- name, purpose, notes: walk back from the Museum marker ---- */
    let i = mi - 1;
    const notes = [];
    let formula = null;

    while (i > 0) {
      const s = clean(lines[i]);
      if (!s) { i--; continue; }
      if (/^Dig Strength\s*[x×]/i.test(s)) { formula = s; i--; continue; }
      if (isBullet(s)) { notes.unshift(s.replace(/^[*•●]\s*/, '')); i--; continue; }
      break;
    }

    const purpose = clean(lines[i]);

    // Walk back for the nearest line that reads like one of the build families.
    // Position alone isn't enough: a few blocks put a credit line or a stray
    // bullet where the heading usually sits.
    let name = null;
    let nameAt = -1;
    for (let n = i - 1; n >= Math.max(0, i - 60); n--) {
      const candidate = clean(lines[n])
        .replace(/^[*•●]\s*/, '')
        .replace(/\.$/, '');
      if (candidate.length > 2 && candidate.length < 48 && NAME_RE.test(candidate)) {
        name = candidate;
        nameAt = n;
        break;
      }
    }
    if (!name) continue;

    const creditLine = nameAt > 0 ? clean(lines[nameAt - 1]) : '';
    const credit = creditLine.includes('@') ? creditLine : null;

    /* ---- museum grid ---- */
    const eqAt = lines.findIndex((l, n) => n > mi && clean(l) === 'Equipment');
    if (eqAt === -1) continue;

    let modifier = null;
    const museum = [];
    let rarity = null;

    for (let n = mi + 1; n < eqAt; n++) {
      const s = clean(lines[n]);
      if (!s) continue;
      // "Modifier:", "Modifiers:", and the per-ring-slot variants are all header
      // text for the grid rather than ore cells.
      if (/^Modifiers?\s*:/i.test(s) || /^\d+\s+ring\s+slots?\s*:/i.test(s) || /^Modifiers?$/i.test(s)) {
        const body = clean(s.replace(/^Modifiers?\s*:?\s*/i, ''));
        if (body) modifier = modifier ? `${modifier} · ${body}` : body;
        continue;
      }
      if (/^Slot \d/i.test(s)) continue;
      const bare = stripNotes(s);
      if (RARITIES.includes(bare)) { rarity = bare; continue; }
      const cell = parseOreCell(s);
      if (cell) museum.push({ rarity, ...cell });
    }

    /* ---- equipment ---- */
    // "Key" starts the shared legend that follows every block.
    let end = lines.findIndex((l, n) => n > eqAt && clean(l) === 'Key');
    if (end === -1) end = Math.min(eqAt + 60, lines.length);

    const equipment = { charm: [], neck: [], rings: [], runes: [], pan: [], shovel: [] };
    let slot = null;

    for (let n = eqAt + 1; n < end; n++) {
      const s = clean(lines[n]);
      if (!s || /^(Name|Notes)$/i.test(s)) continue;

      const marker = Object.entries(SLOT_MARKERS).find(([, re]) => re.test(s));
      if (marker) { slot = marker[0]; continue; }
      if (!slot) continue;

      if (slot === 'runes') {
        equipment.runes.push(...s.split(',').map(clean).filter(Boolean));
        continue;
      }
      // Notes attach to the entry above rather than starting a new one. They are
      // sentence-shaped: opening with a keyword or lower case, or simply long.
      // Tested against the de-footnoted text, or "☽ See note above" slips past.
      const line = stripNotes(s);
      const isNote =
        /^(fallback|enchant|trinket|mutation|optional|for |if |the |see |replace|swap|worse|\d+[- ]star|\d+\s+rings?\s*:)/i
          .test(line) ||
        /^[a-z(]/.test(line) ||
        line.length > 40;
      if (isNote) {
        const last = equipment[slot].at(-1);
        if (last) last.note = last.note ? `${last.note} · ${line}` : line;
        continue;
      }
      const entry = parseEquipEntry(s);
      if (entry) equipment[slot].push(entry);
    }

    if (!equipment.charm.length && !equipment.rings.length && !museum.length) continue;

    const { stage, area } = stageAt(mi);

    // Several builds share a bare name across stages ("Size Boost"), so the
    // stage disambiguates both the id and what's shown.
    // Don't double up: "Luck Efficiency V" in stage V is already unique.
    const hasStage = stage && new RegExp(`\b${stage}\b`, 'i').test(name);
    let id = slug(stage && !hasStage ? `${name} ${stage}` : name);
    if (usedIds.has(id)) {
      let n = 2;
      while (usedIds.has(`${id}-${n}`)) n++;
      id = `${id}-${n}`;
    }
    usedIds.add(id);

    builds.push({
      id,
      stage,
      area,
      name: name.replace(/\s*[-–]\s*SELLING ONLY\s*$/i, '').replace(/\s+Build$/i, ''),
      sellingOnly: /SELLING ONLY/i.test(name),
      purpose,
      notes,
      formula,
      credit,
      modifier,
      museum,
      equipment,
    });
  }

  return builds;
}
