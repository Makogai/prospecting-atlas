/**
 * Quests and NPCs from the wiki.
 *
 * The Quests page is one tabber per location. Inside a tab, `; NPC: [[Name]]`
 * heads a run of `{{Quest}}` templates belonging to that NPC:
 *
 *   ; NPC: [[Trader]]
 *   {{Quest
 *   |Quest = Special Order 2
 *   |QuestSub = Help the Trader complete another order.
 *   |QuestStep1 = Bring an [[Emerald|emerald]] to the [[Trader]].
 *   |Rewards = {{$|200,000}} • {{EXP|10,000}}
 *   |Buffs = '''Trader's Recommendation''': +10% Sell Boost (Permanent)
 *   }}
 *
 * The NPCs page is a second tabber of galleries, which gives each NPC their
 * portrait and the region they stand in.
 */
import { plain, refs, slug, renderValues } from './parse-util.mjs';

const MAX_STEPS = 8;

/** Narrow to a tabber's body; its first tab has no leading `|-|`. */
function tabberBody(wikitext) {
  const open = wikitext.indexOf('<tabber>');
  if (open === -1) return wikitext;
  const close = wikitext.lastIndexOf('</tabber>');
  return wikitext.slice(open + '<tabber>'.length, close === -1 ? undefined : close);
}

/** Split a tabber into [label, body] pairs. */
function tabs(wikitext) {
  return tabberBody(wikitext)
    .split(/^\|-\|\s*/m)
    .map((chunk) => {
      const eq = chunk.indexOf('=');
      if (eq === -1) return null;
      return [plain(chunk.slice(0, eq)).trim(), chunk.slice(eq + 1)];
    })
    .filter(Boolean);
}

/**
 * `{{Quest |Quest = … }}` bodies in order, with the character offset of each,
 * so a quest can be tied to the `; NPC:` heading above it.
 */
function questBlocks(text) {
  const out = [];
  const needle = '{{Quest';
  let idx = 0;
  while ((idx = text.indexOf(needle, idx)) !== -1) {
    const after = text[idx + needle.length];
    if (after && !/[|\s}]/.test(after)) { idx += needle.length; continue; }

    let depth = 0;
    let end = idx;
    for (let i = idx; i < text.length; i++) {
      if (text.slice(i, i + 2) === '{{') { depth++; i++; continue; }
      if (text.slice(i, i + 2) === '}}') {
        depth--;
        i++;
        if (depth === 0) { end = i + 1; break; }
      }
    }
    out.push({ at: idx, body: text.slice(idx + 2, end - 2) });
    idx = end;
  }
  return out;
}

/** `|Quest = X |QuestStep1 = Y` -> { quest: 'X', queststep1: 'Y' } */
function questFields(body) {
  const out = {};
  // Fields are top level; a value can contain [[links]] and {{templates}}.
  let depth = 0;
  let buf = '';
  const parts = [];
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === '{{' || two === '[[') { depth++; buf += two; i++; continue; }
    if (two === '}}' || two === ']]') { depth--; buf += two; i++; continue; }
    if (body[i] === '|' && depth === 0) { parts.push(buf); buf = ''; continue; }
    buf += body[i];
  }
  parts.push(buf);

  for (const part of parts.slice(1)) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    if (!/^[a-z0-9 ]+$/.test(key)) continue;
    out[key] = part.slice(eq + 1).trim();
  }
  return out;
}

export function parseQuests(wikitext) {
  if (!wikitext) return [];

  const out = [];
  const seen = new Set();

  for (const [location, body] of tabs(wikitext)) {
    // Where each NPC heading starts, so quests can be attributed by position.
    const npcMarks = [...body.matchAll(/^;\s*NPC:\s*(.+)$/gm)].map((m) => ({
      at: m.index,
      npc: plain(m[1]),
    }));

    for (const block of questBlocks(body)) {
      const f = questFields(block.body);
      const name = plain(f.quest);
      if (!name) continue;

      const steps = [];
      for (let n = 1; n <= MAX_STEPS; n++) {
        const step = f[`queststep${n}`];
        if (!step) continue;
        steps.push({
          text: plain(renderValues(step)),
          note: f[`queststepsub${n}`] ? plain(f[`queststepsub${n}`]) : null,
          // Minerals named in a step are the actual work; link them.
          refs: [...new Set(refs(step))],
        });
      }

      // The nearest NPC heading above this quest owns it.
      let npc = null;
      for (const mark of npcMarks) {
        if (mark.at > block.at) break;
        npc = mark.npc;
      }

      let id = slug(`${name} ${location}`);
      if (seen.has(id)) {
        let n = 2;
        while (seen.has(`${id}-${n}`)) n++;
        id = `${id}-${n}`;
      }
      seen.add(id);

      out.push({
        id,
        name,
        summary: plain(f.questsub) || null,
        location,
        npc,
        steps,
        rewards: plain(renderValues(f.rewards)) || null,
        // A permanent buff is the reason some quests are worth doing at all.
        // The buff line leads with an icon; plain() would leave its "20px" behind.
        buff: f.buffs
          ? plain(renderValues(f.buffs.replace(/\[\[File:[^\]]*\]\]/g, ''))).trim() || null
          : null,
        wiki: `https://prospecting.miraheze.org/wiki/Quests#tabber-${encodeURIComponent(
          location.replace(/ /g, '_'),
        )}`,
      });
    }
  }

  return out;
}

/**
 * NPCs from the NPCs page galleries, enriched with the opening line of each
 * one's own article where we have it.
 *
 *   John.png|link=John|[[John]]
 */
/**
 * Where an NPC actually stands. Two shapes in the wild:
 *
 *   == Locations ==
 *   * {{Fortune River Town}} — near the Store, Blacksmith, and the leaderboards.
 *
 * ...and, for NPCs who stand in one place, only the opening sentence:
 *
 *   The '''Druid''' is a quest-giving NPC found at the [[Deeproot Spring]].
 *
 * `knownPlaces` keeps the result to real dig sites and locations rather than
 * every page an article happens to link.
 */
function npcPlaces(page, knownPlaces) {
  if (!page) return [];
  const out = [];
  const seen = new Set();
  const add = (name, note) => {
    const key = name.toLowerCase();
    if (!knownPlaces.has(key) || seen.has(key)) return;
    seen.add(key);
    out.push({ name: knownPlaces.get(key), note: note || null });
  };

  const section = page.match(/^==+ *Locations? *==+\s*$([\s\S]*?)(?=^==[^=]|$(?![\s\S]))/mi);
  if (section) {
    for (const line of section[1].split('\n')) {
      if (!/^\s*\*/.test(line)) continue;
      // The first link is the place; the rest of the line is a landmark hint.
      const first = refs(line)[0];
      if (!first) continue;
      const dash = line.split(/\s[—–-]\s/)[1];
      add(first, dash ? plain(dash).replace(/\.$/, '') : null);
    }
  }

  if (!out.length) {
    // Fall back to the intro, which names the one place they stand.
    const intro = page.replace(/\[\[File:[^\]]*\]\]/g, '').split(/^==/m)[0];
    for (const r of refs(intro)) add(r, null);
  }

  return out;
}

export function parseNpcs(npcsPage, pages = {}, knownPlaces = new Map()) {
  if (!npcsPage) return [];

  const byName = new Map();

  for (const [region, body] of tabs(npcsPage)) {
    for (const m of body.matchAll(/^\s*([^|\n]+\.(?:png|jpg|jpeg|webp|gif))\s*\|(.*)$/gim)) {
      const image = m[1].trim();
      const rest = m[2];
      const link = rest.match(/link=([^|]+)/);
      const label = rest.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
      const name = plain(link ? link[1] : label ? (label[2] ?? label[1]) : '');
      if (!name) continue;

      const hit = byName.get(name) ?? { name, image, regions: [] };
      if (!hit.image) hit.image = image;
      if (region && !hit.regions.includes(region)) hit.regions.push(region);
      byName.set(name, hit);
    }
  }

  // Distinct NPCs can slug to the same id — the wiki has both "Archaeologist"
  // and "Archaeologist?" — which collapses them into one React key and breaks
  // every link that addresses an NPC by id.
  const usedIds = new Set();
  const uniqueId = (name) => {
    let id = slug(name) || 'npc';
    if (!usedIds.has(id)) { usedIds.add(id); return id; }
    let n = 2;
    while (usedIds.has(`${id}-${n}`)) n++;
    usedIds.add(`${id}-${n}`);
    return `${id}-${n}`;
  };

  return [...byName.values()].map((npc) => {
    const page = pages[npc.name] ?? '';
    // First real sentence of the article, minus the image captions on top.
    const intro = page
      .replace(/\[\[File:[^\]]*\]\]/g, '')
      .replace(/\{\{Tocright\}\}/gi, '')
      .split(/^==/m)[0]
      .split('\n')
      .map((l) => plain(l).trim())
      .find((l) => l.length > 24) ?? null;

    return {
      id: uniqueId(npc.name),
      name: npc.name,
      image: npc.image,
      regions: npc.regions,
      /** Specific dig sites / locations, with a landmark hint where given. */
      places: npcPlaces(page, knownPlaces),
      summary: intro,
      hasPage: Boolean(page),
      wiki: `https://prospecting.miraheze.org/wiki/${encodeURIComponent(
        npc.name.replace(/ /g, '_'),
      )}`,
    };
  });
}
