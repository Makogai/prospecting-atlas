// Stage 2: turn raw wikitext into the typed JSON the site consumes.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { findTemplates, plain, refs, num, slug } from './parse-util.mjs';
import { parseEvents } from './parse-events.mjs';
import { parseEquipment } from './parse-equipment.mjs';
import { parseBuilds } from './parse-builds.mjs';
import { parseBlueprints } from './parse-blueprints.mjs';
import { parseQuests, parseNpcs } from './parse-quests.mjs';
import { parseMuseum } from './parse-museum.mjs';
import { parseCodes } from './parse-codes.mjs';
import { parseModifiers } from './parse-modifiers.mjs';
import { parseEnchants, parseEnchantHowTo } from './parse-enchants.mjs';
import { parseExcavations } from './parse-excavations.mjs';
import { parseRelics } from './parse-relics.mjs';
import { parseLevels, parseRunes, parsePermanentBuffs, parseMastery } from './parse-progression.mjs';
import { parsePotions, parseTrinkets, parseGeodes, parseTreasureChests } from './parse-items.mjs';
import { parseRegions, parseCurrencies, gearObtainability } from './parse-world.mjs';
import { parseMutations, parseNavIcons } from './parse-mutations.mjs';

const raw = JSON.parse(readFileSync('data/raw/pages.json', 'utf8'));
const { pages, templates, byCategory } = raw;

const RARITY_ORDER = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Exotic'];

/* ---------- colour tags ------------------------------------------------ */
// Both rarities and dig sites are rendered as gradient spans in Template: space.
const gradientOf = (wt) => {
  const m = wt.match(/background:\s*linear-gradient\(90deg,\s*([^)]+)\)/);
  return m ? m[1].split(',').map(s => s.trim()).filter(s => /^#|^rgb/.test(s)) : null;
};

const rarities = RARITY_ORDER.map((name, i) => {
  const wt = templates[`Template:${name}`] || '';
  return { name, order: i, colors: gradientOf(wt) || ['#888888', '#555555'] };
});

/** name -> { name, colors, page } for every gradient location tag. */
const siteTags = {};
for (const [title, wt] of Object.entries(templates)) {
  const name = title.replace(/^Template:/, '');
  if (RARITY_ORDER.includes(name) || name.includes('/')) continue;
  const colors = gradientOf(wt);
  if (!colors) continue;
  const link = wt.match(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/);
  if (!link) continue;
  siteTags[name] = { name, colors, page: link[1].replace(/_/g, ' ').trim() };
}

/* ---------- minerals --------------------------------------------------- */
// `* '''{{Site}}''' (if in loot pool) - 0.0000001% (~1 in 64,543,541,734 = ~1 in 65b)`
// The trailing part after the "1 in N" figure is a human shorthand we ignore.
const CHANCE_RE = /^\s*\*\s*'''\{\{([^}|]+?)\}\}'''\s*(\([^)]*\))?\s*[-–—]\s*([\d.]+)\s*%\s*\(~?1\s*in\s*([\d,]+)/;

function parseChances(text) {
  const out = [];
  for (const line of (text || '').split('\n')) {
    const m = line.match(CHANCE_RE);
    if (!m) continue;
    out.push({
      site: m[1].trim(),
      conditional: m[2] ? plain(m[2]).replace(/^\(|\)$/g, '') : null,
      percent: parseFloat(m[3]),
      oneIn: num(m[4]),
    });
  }
  return out.sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1));
}

function parseRecipes(text) {
  if (!text) return [];
  const out = [];
  // === [[Equipment#...|Ring of Harvest]] ({{Legendary}}, limited blueprint) ===
  const parts = (text || '').split(/^=== */m).slice(1);
  for (const part of parts) {
    const [head, ...rest] = part.split('\n');
    const title = head.replace(/ *===\s*$/, '');
    const nameMatch = title.match(/\[\[[^\]|]*\|([^\]]+)\]\]|\[\[([^\]]+)\]\]/);
    const name = plain(nameMatch ? (nameMatch[1] || nameMatch[2]) : title.split('(')[0]);
    const rarity = RARITY_ORDER.find(r => title.includes(`{{${r}}}`)) || null;
    const noteRaw = (title.match(/\(([^)]*)\)/) || [])[1];
    const ingredients = [];
    for (const line of rest) {
      const m = line.match(/^\s*\*\s*(\d+)\s*[x×]?\s*(.+?)\s*$/);
      if (!m) continue;
      ingredients.push({ qty: parseInt(m[1], 10), item: plain(m[2]) });
    }
    if (name) {
      out.push({
        name, rarity,
        note: noteRaw && !noteRaw.includes('{{') ? plain(noteRaw) : null,
        ingredients,
      });
    }
  }
  return out;
}

/** Pull a `== Heading ==` section body out of a page. */
function section(wt, heading) {
  const re = new RegExp(`^==+ *${heading} *==+\\s*$([\\s\\S]*?)(?=^==[^=]|$(?![\\s\\S]))`, 'mi');
  const m = (wt || '').match(re);
  return m ? m[1].trim() : null;
}

const minerals = byCategory.Minerals.map(title => {
  const wt = pages[title] || '';
  const [p] = findTemplates(wt, 'Mineral');
  if (!p) return null;

  const name = plain(p.name) || title;
  // Museum data is filled in below from the Museum page, which is the authority.
  const hasMuseumSection = section(wt, 'Museum Usage') != null;

  const locations = [...new Set(refs(p.locations))].filter(l => siteTags[l]);
  let chances = parseChances(p.chances);
  // A handful of pages list locations but no drop table. Keep them in the dig-site
  // index with an unknown rate rather than dropping them from the loot list.
  if (!chances.length) {
    chances = locations.map(site => ({ site, conditional: null, percent: null, oneIn: null }));
  }

  return {
    id: slug(name),
    name,
    image: p.image ? p.image.trim() : null,
    description: plain(p.description),
    rarity: plain(p.rarity),
    value: num(p.value),
    locations,
    chances,
    ratesKnown: chances.some(c => c.percent != null),
    recipes: parseRecipes(p.recipes),
    hasMuseumSection,
    museum: null,
    trivia: p.trivia ? p.trivia.split('\n').map(l => plain(l.replace(/^\s*\*/, ''))).filter(Boolean) : [],
    wiki: `https://prospecting.miraheze.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
  };
}).filter(Boolean);

/* ---------- museum ----------------------------------------------------- */
// The Museum page is the authority: it groups ores by the rarity of the display
// that accepts them, and it signs the handful of boosts that are really debuffs.
// Each mineral's own `== Museum Usage ==` section says the same thing less
// precisely, so it gets overwritten here rather than kept as a second answer.
const museum = parseMuseum(pages.Museum);
const museumById = new Map((museum?.ores ?? []).map(o => [o.id, o]));
// A mineral whose own page documents a museum boost but which the Museum page
// never lists is a gap worth seeing, not something to paper over.
const museumUnmatched = [];
for (const mineral of minerals) {
  const ore = museumById.get(mineral.id);
  if (!ore) {
    if (mineral.hasMuseumSection) museumUnmatched.push(mineral.name);
    continue;
  }
  mineral.museum = { minWeight: ore.minWeight, boosts: ore.boosts, displayRarity: ore.rarity };
}
for (const mineral of minerals) delete mineral.hasMuseumSection;

/* ---------- gear (pans / shovels / sluices) ---------------------------- */
// Event gear is priced in an event currency, given as a parameter named after
// that currency (`| candy=1,000`) instead of the usual `| price=`.
const EVENT_CURRENCIES = {
  candy: 'Candy',
  ornament: 'Ornaments',
  'heart crystal': 'Heart Crystals',
  'heart crystals': 'Heart Crystals',
  eggs: 'Eggs',
};

function parseGear(page, tplName, statKeys) {
  const wt = pages[page] || '';
  return findTemplates(wt, tplName).map(p => {
    const name = plain(p.name);
    const stats = {};
    for (const k of statKeys) {
      if (p[k] == null) continue;
      const rawValue = String(p[k]).trim();
      const n = num(rawValue);
      // A couple of rows write a multiplier as a percentage ("speed=120%").
      stats[k] = n != null && rawValue.endsWith('%') ? n / 100 : n;
    }

    const currencyKey = Object.keys(EVENT_CURRENCIES).find(k => p[k] != null);
    const currency = currencyKey ? EVENT_CURRENCIES[currencyKey] : null;

    return {
      id: slug(name),
      name,
      image: p.image ? p.image.trim() : null,
      description: plain(p.description),
      color: (p['name color'] || p.namecolor || '').trim() || null,
      price: /free/i.test(p.price || '') ? 0 : num(p.price),
      priceLabel: plain(p.price) || null,
      currency,
      currencyAmount: currencyKey ? num(p[currencyKey]) : null,
      stats,
      passive: p.passive ? plain(p.passive) : null,
      source: plain(p.location),
      sourceRefs: [...new Set(refs(p.location))].filter(l => siteTags[l]),
    };
  });
}

const pans    = parseGear('Pans',    'Pan row',    ['luck', 'capacity', 'strength', 'speed']);
const shovels = parseGear('Shovels', 'Shovel row', ['strength', 'speed', 'toughness']);
const sluices = parseGear('Sluices', 'Sluice row', ['luck', 'capacity', 'efficiency', 'toughness']);

/* ---------- dig sites: reverse index from every mineral's chance list --- */
const digSites = {};
const ensureSite = (nm) => (digSites[nm] ??= {
  id: slug(nm),
  name: nm,
  colors: siteTags[nm]?.colors || ['#888888', '#555555'],
  page: siteTags[nm]?.page || null,
  minerals: [],
});

for (const m of minerals) {
  for (const c of m.chances) {
    ensureSite(c.site).minerals.push({
      id: m.id, name: m.name, rarity: m.rarity, value: m.value,
      percent: c.percent, oneIn: c.oneIn, conditional: c.conditional,
    });
  }
  for (const l of m.locations) ensureSite(l);
}

for (const s of Object.values(digSites)) {
  s.minerals.sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1));
  // Expected $/kg of a single pull, weighting each mineral by its own drop rate.
  s.expectedValue = s.minerals.reduce((t, x) => t + ((x.percent ?? 0) / 100) * (x.value || 0), 0);
  s.coverage = s.minerals.reduce((t, x) => t + (x.percent ?? 0), 0);
  s.mineralCount = s.minerals.length;
  s.topRarity = RARITY_ORDER.filter(r => s.minerals.some(m => m.rarity === r)).pop() || null;
}

/* ---------- locations -------------------------------------------------- */
const locations = byCategory.Locations.map(title => {
  const wt = pages[title] || '';
  const sites = Object.values(digSites).filter(s => s.page === title);
  const intro = (wt.split(/^==/m)[0] || '')
    .replace(/\{\{Tocright\}\}/gi, '')
    .replace(/\[\[File:[^\]]*\]\]/g, '')
    .replace(/^=[^=].*$/gm, '')
    .trim();
  const img = wt.match(/\[\[File:([^\]|]+)/);
  return {
    id: slug(title),
    name: title,
    image: img ? img[1].trim() : null,
    summary: plain(intro.split('\n').filter(Boolean)[0] || '').slice(0, 400),
    digSites: sites.map(s => s.id),
    colors: siteTags[title]?.colors || sites[0]?.colors || ['#888888', '#555555'],
    wiki: `https://prospecting.miraheze.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
  };
}).filter(l => l.digSites.length || l.summary);

/* ---------- events ------------------------------------------------------ */
// Keep only sites we actually know about, so a UI toggle can be scoped to the
// dig sites it really affects.
const knownSite = (n) => Boolean(digSites[n]);
const events = parseEvents(pages['Events']).map(e => ({
  ...e,
  id: slug(e.name),
  sites: e.sites.filter(knownSite),
})).map(e => ({ ...e, global: e.global || e.sites.length === 0 }));

/* ---------- equipment --------------------------------------------------- */
const equipment = parseEquipment(pages['Equipment']);

/* ---------- blueprints -------------------------------------------------- */
// Attached to the equipment they unlock, so a card can say "needs a blueprint"
// and show where it comes from.
const blueprints = parseBlueprints(pages['Blueprint']);
const blueprintFor = new Map(blueprints.map(b => [b.equipment.toLowerCase(), b]));
for (const item of equipment) {
  const bp = blueprintFor.get(item.name.toLowerCase());
  item.blueprint = bp ? bp.id : null;
}

/* ---------- quests and NPCs -------------------------------------------- */
const quests = parseQuests(pages['Quests']);
// Only count a link as a place if it's a dig site or a location we know.
const knownPlaces = new Map();
for (const name of Object.keys(digSites)) knownPlaces.set(name.toLowerCase(), name);
for (const l of locations) knownPlaces.set(l.name.toLowerCase(), l.name);
for (const t of Object.keys(siteTags)) knownPlaces.set(t.toLowerCase(), t);

const npcs = parseNpcs(pages['NPCs'], pages, knownPlaces);

// Quests know their giver by name; give each NPC the list back.
const questsByNpc = new Map();
for (const q of quests) {
  if (!q.npc) continue;
  const key = q.npc.toLowerCase();
  if (!questsByNpc.has(key)) questsByNpc.set(key, []);
  questsByNpc.get(key).push(q.id);
}
for (const npc of npcs) npc.quests = questsByNpc.get(npc.name.toLowerCase()) ?? [];

/* ---------- community builds ------------------------------------------- */
// Optional: the guide is a third-party Google Doc, so the site still builds
// without it. `npm run data:builds` refreshes the snapshot.
let builds = [];
let buildStages = [];
try {
  const guideText = readFileSync('data/raw/builds.txt', 'utf8');
  const skipped = [];
  builds = parseBuilds(guideText, { onSkip: (info) => skipped.push(info) });
  if (skipped.length) {
    console.warn(
      `  ${skipped.length} build block(s) skipped — the guide may have changed shape:`,
    );
    for (const s2 of skipped) console.warn(`    line ${s2.at}: ${s2.name ?? '(unnamed)'} — ${s2.why}`);
  }

  // "Stage III. - Swamp: Highest location is Timelocked Sanctuary."
  // The location is what players actually recognise, so it drives the UI.
  const seen = new Set();
  for (const m of guideText.matchAll(
    // The leading [.\s]* absorbs a stray period the guide types on one heading.
    // The area runs to the end of the line; a trailing full stop is optional.
    /^[.\s]*Stage\s+(V|IV|III|II|I|0)\.?\s*[-–]\s*([^:\n]+):\s*Highest location is ([^.\n]+)/gim,
  )) {
    const stage = m[1].toUpperCase();
    if (seen.has(stage)) continue;
    seen.add(stage);
    buildStages.push({ stage, area: m[2].trim(), highest: m[3].trim() });
  }
  // Earliest first: the guide lists endgame first, which is backwards for
  // anyone trying to find where they are.
  const order = ['0', 'I', 'II', 'III', 'IV', 'V'];
  buildStages.sort((a, b) => order.indexOf(a.stage) - order.indexOf(b.stage));
  buildStages.push({ stage: 'Bonus', area: 'Bonus builds', highest: null });
} catch {
  console.warn('data/raw/builds.txt missing — skipping community builds');
}

/* ---------- systems ---------------------------------------------------- */

const codes = parseCodes(pages.Codes);
const enchants = parseEnchants(pages.Enchanting);
const excavations = parseExcavations(pages.Excavations);
const relicData = parseRelics(pages.Relics);
const levels = parseLevels(pages.Level);
const runes = parseRunes(pages.Runes);
const permanentBuffs = parsePermanentBuffs(pages['Permanent Buffs']);
const mastery = parseMastery(pages.Mastery);
const potions = parsePotions(pages.Potions);
const trinkets = parseTrinkets(pages.Trinkets);
const geodes = parseGeodes(pages.Geodes);
const treasureChests = parseTreasureChests(pages['Treasure Chest']);
const currencies = parseCurrencies(pages);
const mutations = parseMutations(pages.Mutations);
// The wiki's own front-page icon grid: a curated list of what people come for,
// and art we can reuse rather than drawing our own.
const navIcons = parseNavIcons(pages['Main Page']);

// Reuses the place index built for NPC locations, so a region only ever lists
// somewhere that exists.
const regions = parseRegions(pages, knownPlaces);

// A location's region, so a dig-site page can say where in the world it is.
const regionOf = new Map();
for (const r of regions) for (const l of r.locations) regionOf.set(l, r.name);
for (const l of locations) l.region = regionOf.get(l.name) ?? null;

/**
 * Modifiers are described twice: the Modifiers page has the sell multiplier and
 * how to get one, the Museum page has what it does on a pedestal. One record.
 */
const modifiers = parseModifiers(pages.Modifiers);
const museumMods = new Map((museum?.modifiers ?? []).map(m => [m.name.toLowerCase(), m]));
let modsWithoutSource = [];
for (const mod of modifiers) {
  const fromMuseum = museumMods.get(mod.name.toLowerCase());
  if (fromMuseum) {
    if (!mod.museumStats.length) mod.museumStats = fromMuseum.stats;
    if (mod.percent == null) mod.percent = fromMuseum.chance;
    mod.source = mod.note ?? fromMuseum.source ?? null;
  } else {
    mod.source = mod.note ?? null;
  }
  const hasRoute = mod.source || mod.tools.length || mod.locations.length || mod.events.length;
  if (mod.percent == null && !hasRoute) modsWithoutSource.push(mod.name);
}

// Discontinued gear, which only the individual item pages record.
const allGear = [...pans, ...shovels, ...sluices];
const { byId: obtain, matched: obtainMatched } = gearObtainability(pages, allGear);
for (const item of allGear) {
  const hit = obtain.get(item.id);
  item.obtained = hit?.obtained ?? null;
  item.obtainable = hit ? hit.obtainable : true;
}

/* ---------- emit ------------------------------------------------------- */
mkdirSync('src/data', { recursive: true });
const db = {
  meta: { source: 'https://prospecting.miraheze.org', fetchedAt: raw.fetchedAt, builtAt: new Date().toISOString() },
  rarities,
  minerals: minerals.sort((a, b) => (b.value || 0) - (a.value || 0)),
  digSites: Object.values(digSites).sort((a, b) => b.expectedValue - a.expectedValue),
  locations: locations.sort((a, b) => a.name.localeCompare(b.name)),
  pans, shovels, sluices,
  events,
  equipment,
  blueprints,
  quests,
  npcs,
  museum,
  modifiers,
  codes,
  enchants,
  enchantHowTo: parseEnchantHowTo(pages.Enchanting),
  excavations,
  relics: relicData.relics,
  relicAcquisition: relicData.acquisition,
  levels,
  runes,
  permanentBuffs,
  mastery,
  potions,
  trinkets,
  geodes,
  treasureChests,
  currencies,
  regions,
  mutations,
  navIcons,
  builds,
  buildStages,
  buildGuide: {
    title: 'Prospecting! Build Guide',
    url: 'https://docs.google.com/document/d/1qh68P12Pm1nz80jbKLZloVgapCXxVRoarM_pAs-5aVY/edit',
    authors: ['Autumn', 'bosnia123123', 'Finnlay', 'Martika14', 'PPatel', 'em_miaou', 'softlyhollowed'],
    snapshot: new Date().toISOString().slice(0, 10),
  },
};
writeFileSync('src/data/db.json', JSON.stringify(db));

console.log(`minerals  ${db.minerals.length}`);
console.log(`digSites  ${db.digSites.length}`);
console.log(`locations ${db.locations.length}`);
console.log(`pans ${pans.length} | shovels ${shovels.length} | sluices ${sluices.length}`);
const guessed = builds.filter(b => !b.namedByFamily);
console.log(
  `builds ${builds.length} (${[...new Set(builds.map(b => b.stage))].join(', ')})` +
  (guessed.length ? ` · ${guessed.length} named by fallback: ${guessed.map(b => b.name).join(', ')}` : ''),
);
console.log(`quests ${quests.length} across ${new Set(quests.map(q => q.location)).size} locations · ${quests.filter(q => q.buff).length} grant a permanent buff`);
console.log(
  `museum ${museum ? museum.ores.length : 0} ores over ${museum ? museum.slots : 0} display slots` +
  ` · ${museum ? museum.stats.length : 0} stats · ${museum ? museum.modifiers.length : 0} modifiers` +
  (museumUnmatched.length ? ` · NOT on the Museum page: ${museumUnmatched.join(', ')}` : ''),
);
console.log(
  `modifiers ${modifiers.length} (top ${modifiers[0]?.sellMultiplier}x sell)` +
  (modsWithoutSource.length ? ` · no route given: ${modsWithoutSource.join(', ')}` : ''),
);
console.log(`codes ${codes.length} (${codes.filter(c => c.active).length} active)`);
console.log(`enchants ${enchants.length} (${enchants.filter(e => e.slot === 'Pan').length} pan, ${enchants.filter(e => e.slot === 'Shovel').length} shovel)`);
console.log(`excavations ${excavations?.sites.length ?? 0} sites, ${excavations?.levels.length ?? 0} levels` + (excavations?.unmatchedRewards.length ? ` · no rewards: ${excavations.unmatchedRewards.join(', ')}` : ''));
console.log(`relics ${relicData.relics.length} (${[...new Set(relicData.relics.map(r => r.category))].join(', ')})`);
console.log(`progression: ${levels?.maxLevel ?? 0} levels · ${levels?.titles.length ?? 0} titles · ${runes?.runes.length ?? 0} runes · ${mastery?.tracks.length ?? 0} mastery tracks · ${permanentBuffs.length} permanent buffs`);
console.log(`items: ${potions.length} potions · ${trinkets.length} trinkets · ${treasureChests?.loot.length ?? 0} chest lootpools`);
console.log(`mutations ${mutations?.mutations.length ?? 0} (forge at ${mutations?.forge ?? '?'}) · ${mutations?.chanceTiers.length ?? 0} chance tables · navIcons ${navIcons.length}`);
console.log(`regions ${regions.length} · gear obtainability ${obtainMatched}/${allGear.length} (${allGear.filter(g => !g.obtainable).length} discontinued)`);
console.log(`npcs ${npcs.length} (${npcs.filter(n => n.quests.length).length} give quests, ${npcs.filter(n => n.places.length).length} placed, ${npcs.filter(n => n.summary).length} described)`);
console.log(`blueprints ${blueprints.length} (${blueprints.filter(b => b.kind === 'quest').length} quest, ${blueprints.filter(b => b.kind === 'purchase').length} bought, ${blueprints.filter(b => b.kind === 'found').length} found) · matched to ${equipment.filter(e => e.blueprint).length} items`);
console.log(`equipment ${equipment.length} (${equipment.filter(e => e.limited).length} limited) · slots ${[...new Set(equipment.map(e => e.slot))].join('/')}`);
console.log(`luck events ${events.length} (${events.filter(e => e.kind === 'multiplicative').length} multiplicative, ${events.filter(e => e.kind === 'additive').length} additive, ${events.filter(e => e.kind === 'unknown').length} unquantified)`);
console.log(`no chances: ${minerals.filter(m => !m.chances.length).map(m => m.name).join(', ') || 'none'}`);
console.log(`no image:   ${minerals.filter(m => !m.image).map(m => m.name).join(', ') || 'none'}`);
console.log(`no recipes: ${minerals.filter(m => !m.recipes.length).length}`);
