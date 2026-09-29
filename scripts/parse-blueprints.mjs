/**
 * Blueprints from the wiki's Blueprint page.
 *
 * High-tier equipment doesn't appear in the crafting menu at all until you've
 * found its blueprint, so "how do I get this?" is a real question the equipment
 * table alone can't answer. Each tab on that page is one blueprint and says
 * where it comes from: a quest, a shop, or in one case lying in a maze.
 *
 *   ===== [[Equipment#tabber-Exotic|Accretion Disk]] Blueprint =====
 *   * '''Quest Giver:''' [[Meteor Guardian]] in {{Astral Caverns}}
 *   * '''Quest Name:''' [[Quests#tabber-Meteor_Valley|Galactic Guardian]]
 *   {{Quest |Quest = … |QuestStep1 = … |Rewards = … }}
 */
import { findTemplates, plain, refs, num, slug } from './parse-util.mjs';

const MAX_STEPS = 8;

/** Templates that name a currency; their argument is the amount. */
const CURRENCY = /^(Sand Dollars|Candy|Eggs|Ornaments?|Heart Crystals?|Meteor Shards|\$|EXP)$/i;

/** Every `{{Name|arg}}` in order, as [name, arg] pairs. */
const templateArgs = (text) =>
  [...String(text).matchAll(/\{\{([^|{}]+)(?:\|([^{}]*))?\}\}/g)]
    .map((m) => [m[1].trim(), (m[2] ?? '').trim()]);

/**
 * `{{$|4,000}} • {{EXP|5,000}} • {{Meteor Shards|2,000}}` ->
 * `$4,000 • 5,000 EXP • 2,000 Meteor Shards`.
 * plain() alone would keep only the template names and drop every number.
 */
function renderValues(text) {
  return String(text ?? '')
    .replace(/\{\{\s*\$\s*\|([^{}]*)\}\}/g, (_, v) => `$${v.trim()}`)
    .replace(/\{\{([^|{}]+)\|([^{}]*)\}\}/g, (_, n, v) =>
      v.trim() ? `${v.trim()} ${n.trim()}` : n.trim());
}

/** `[[Meteor Guardian]] in {{Astral Caverns}}` -> { who, where } */
function parseGiver(line) {
  if (!line) return { who: null, where: null };
  const [whoPart, wherePart] = line.split(/\s+\bin\b\s+/);
  return {
    who: plain(whoPart) || null,
    where: wherePart ? plain(wherePart) : null,
  };
}

export function parseBlueprints(wikitext) {
  if (!wikitext) return [];

  // A tabber's first tab sits directly after <tabber> with no `|-|` before it,
  // so splitting the whole page on `|-|` and dropping segment 0 loses it.
  // Narrow to the tabber body first, then every segment is a real tab.
  const open = wikitext.indexOf('<tabber>');
  const close = wikitext.lastIndexOf('</tabber>');
  const body = open === -1
    ? wikitext
    : wikitext.slice(open + '<tabber>'.length, close === -1 ? undefined : close);

  const out = [];
  for (const tab of body.split(/^\|-\|\s*/m)) {
    // The heading carries the equipment name; the tab label repeats it.
    const heading = tab.match(/^=====\s*(.+?)\s*Blueprint\s*=====/m);
    const tabLabel = tab.match(/^(.+?)=/);
    const rawName = heading ? heading[1] : (tabLabel ? tabLabel[1].replace(/\s*Blueprint\s*$/, '') : '');
    const name = plain(rawName);
    if (!name) continue;

    const image = (tab.match(/\[\[File:([^\]|]+)/) || [])[1]?.trim() ?? null;
    const bullets = tab
      .split('\n')
      .filter((l) => /^\s*\*/.test(l))
      .map((l) => l.replace(/^\s*\*+\s*/, ''));

    const field = (label) => {
      const hit = bullets.find((b) => new RegExp(`^'''${label}`, 'i').test(b));
      return hit ? hit.replace(new RegExp(`^'''${label}:?'''\\s*`, 'i'), '') : null;
    };

    const [questTpl] = findTemplates(tab, 'Quest');
    let kind = 'other';
    let quest = null;
    let purchase = null;
    let note = null;

    if (questTpl) {
      kind = 'quest';
      const steps = [];
      for (let n = 1; n <= MAX_STEPS; n++) {
        const step = questTpl[`queststep${n}`];
        if (step) steps.push(plain(step));
      }
      const giver = parseGiver(field('Quest Giver'));
      quest = {
        name: plain(questTpl.quest) || plain(field('Quest Name')) || null,
        summary: plain(questTpl.questsub) || null,
        giver: giver.who,
        location: giver.where,
        steps,
        rewards: plain(renderValues(questTpl.rewards)) || null,
      };
    } else {
      // Not every entry uses a bullet; a couple are a plain paragraph.
      // Skipped: the tab's own label (a bare line ending in '='), the heading,
      // the image, and any stray template or tabber markup.
      const prose = tab
        .split('\n')
        .map((l) => l.replace(/^\s*\*+\s*/, '').trim())
        .filter(
          (l) =>
            l &&
            !/=\s*$/.test(l) &&
            !/^=|^\[\[File:|^\{\{|^\||^<\/?tabber/.test(l),
        );
      const buyLine = prose.find((l) => /bought|purchas|shop|store|vendor/i.test(l));

      if (buyLine) {
        kind = 'purchase';
        const args = templateArgs(buyLine);
        const money = args.find(([n]) => CURRENCY.test(n));
        // "for <span…>100</span> {{Eggs}}" keeps the amount outside the template.
        const loose = plain(buyLine).match(/\bfor\s+([\d,]+)/i);

        purchase = {
          currency: money ? money[0] : null,
          cost: money && money[1] ? num(money[1]) : loose ? num(loose[1]) : null,
          // The shop is a location or a linked vendor, never the currency itself.
          where:
            args.map(([n]) => n).find((n) => !CURRENCY.test(n)) ??
            (buyLine.match(/\[\[[^\]|]*\|([^\]]+)\]\]/) || [])[1] ??
            null,
        };
      } else if (prose.length) {
        kind = 'found';
      }
      if (prose.length) note = plain(prose[0]);
    }

    out.push({
      id: slug(name),
      /** The equipment this blueprint unlocks. */
      equipment: name,
      image,
      kind,
      quest,
      purchase,
      note: kind === 'quest' ? null : note,
      wiki: `https://prospecting.miraheze.org/wiki/Blueprint#${encodeURIComponent(
        `${name.replace(/ /g, '_')}_Blueprint`,
      )}`,
    });
  }

  return out;
}
