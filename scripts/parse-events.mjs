/**
 * Pulls the luck-affecting events out of the wiki's Events page.
 *
 * The page is unusually precise: every effect line says whether it is
 * "Multiplicative" or "Additive", and lists the dig sites it applies to. That
 * distinction is the whole luck model, so it is parsed rather than hand-typed —
 * a wiki edit flows straight through `npm run data:parse`.
 *
 *   * Multiplicative 1.5&times; '''[[Stats|Luck]]''' ... at following locations:
 *   ** '''{{Frostbite River}}'''
 *   * Additive 2&times; (+1&times;) '''[[Stats|Luck]]''' across the whole map.
 */
import { refs, num } from './parse-util.mjs';

/** `2&times;` / `1.5×` / `+1&times;` -> 2, 1.5, 1 */
const times = (s) => num(String(s).replace(/&times;|×/g, ''));

export function parseEvents(wikitext) {
  if (!wikitext) return [];

  const events = [];
  // Tabs look like `|-|Name=`; the admin block uses the same markup.
  const parts = wikitext.split(/^\|-\|\s*/m).slice(1);

  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    const body = part.slice(eq + 1);
    if (!/luck/i.test(body)) continue;

    // The bullet that actually states the luck effect.
    const line = body
      .split('\n')
      .find((l) => /^\s*\*\s/.test(l) && /luck/i.test(l) && /(multiplicative|additive)/i.test(l));

    if (!line) {
      // "Luck Boost" with no number — real, but we can't model it.
      if (/^\s*\*\s*luck boost\s*$/im.test(body)) {
        events.push({
          name, kind: 'unknown', value: null, sites: [], global: true,
          admin: /admin[- ]only/i.test(body),
          note: 'The wiki records a luck boost here but not how much.',
        });
      }
      continue;
    }

    const multiplicative = /multiplicative/i.test(line);
    // Additive lines give both forms: "2&times; (+1&times;)" or just "+1&times;".
    const paren = line.match(/\(\s*\+\s*([\d.]+)\s*(?:&times;|×)/i);
    const first = line.match(/(?:multiplicative|additive)\s*\+?\s*([\d.]+)\s*(?:&times;|×)/i);

    let value;
    if (multiplicative) {
      value = times(first?.[1]);
    } else if (paren) {
      value = times(paren[1]);                    // the explicit bonus
    } else if (first) {
      const n = times(first[1]);
      // "+1×" states the bonus; a bare "2×" states the total.
      value = /additive\s*\+/i.test(line) ? n : n - 1;
    }
    if (value == null || Number.isNaN(value)) continue;

    // Sites listed under the effect bullet, until the next top-level bullet.
    const after = body.slice(body.indexOf(line) + line.length);
    const block = after.split(/\n(?=\s*\*[^*])/)[0] ?? '';
    const sites = [...new Set(refs(block))]
      .filter((r) => !/^(File|Stats?|Modifiers?|Relics)/i.test(r));

    events.push({
      name,
      kind: multiplicative ? 'multiplicative' : 'additive',
      value,
      sites,
      global: sites.length === 0,
      admin: /admin[- ]?only/i.test(body),
      note: null,
    });
  }

  return events;
}
