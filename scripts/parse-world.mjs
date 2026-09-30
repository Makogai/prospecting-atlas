/**
 * The bits of the world that sit around the data we already had: which
 * locations group into a region, what the currencies are, and whether a piece
 * of gear can still be obtained.
 */
import { plain, refs, slug } from './parse-util.mjs';
import { findTemplates } from './parse-util.mjs';
import { section } from './parse-table.mjs';

const REGIONS = ['Mainland', 'Snowy Mountain', 'Sunscorched Desert'];

/**
 * Regions group locations. The Locations page is a flat list, so without this
 * there's no way to say "Frozen Peak is on Snowy Mountain" — which is how
 * players talk about the map.
 */
export function parseRegions(pages, knownPlaces = new Map()) {
  return REGIONS.map((name) => {
    const wt = pages[name];
    if (!wt) return null;
    // Two of the three list their locations under a heading; Sunscorched Desert
    // describes each digsite in prose instead, so the whole page is read and
    // narrowed to names we already know are places. Without that it picks up
    // every NPC, file and category the article happens to link.
    const body = section(wt, 'Locations') ?? wt;
    const locations = [];
    for (const ref of new Set(refs(body))) {
      if (ref === name || /^(Category|File|Template)\s*:/i.test(ref)) continue;
      const hit = knownPlaces.get(ref.toLowerCase());
      if (hit) locations.push(hit);
    }
    if (!locations.length) return null;
    return {
      id: slug(name),
      name,
      summary: plain(wt.split(/^== /m)[0]).trim() || null,
      locations,
    };
  }).filter(Boolean);
}

/** Currencies you hold, as opposed to the money you spend. */
export function parseCurrencies(pages) {
  const out = [];
  for (const name of ['Meteor Shards']) {
    const wt = pages[name];
    if (!wt) continue;
    const lines = (heading) =>
      (section(wt, heading) ?? '')
        .split('\n')
        .filter((l) => /^\s*\*/.test(l))
        .map((l) => plain(l.replace(/^\s*\*+/, '')))
        .filter(Boolean);
    out.push({
      id: slug(name),
      name,
      summary: plain(wt.split(/^== /m)[0]).trim() || null,
      obtain: lines('Obtainability'),
      spend: lines('Usage'),
    });
  }
  return out;
}

/**
 * Whether a pan / shovel / sluice can still be obtained.
 *
 * Only the individual gear pages carry this — the index tables we parse for
 * stats don't have the column — so without it the site lists discontinued gear
 * as though you could go and buy it.
 */
export function gearObtainability(pages, gear) {
  const out = new Map();
  let matched = 0;

  for (const item of gear) {
    const wt = pages[item.name];
    if (!wt) continue;
    const [infobox] = findTemplates(wt, 'PanInfobox')
      .concat(findTemplates(wt, 'ShovelInfobox'))
      .concat(findTemplates(wt, 'SluiceInfobox'))
      .concat(findTemplates(wt, 'Infobox'));
    const raw = infobox?.obtained;
    if (!raw) continue;
    matched++;
    const text = plain(raw).trim();
    out.set(item.id, {
      obtained: text,
      // "Unobtainable", "No longer obtainable", "Removed" all mean the same.
      obtainable: !/unobtainable|no longer|removed|discontinued/i.test(text),
    });
  }

  return { byId: out, matched };
}
