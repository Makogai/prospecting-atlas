// Stage 2: turn raw wikitext into the typed JSON the site consumes.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { findTemplates, plain, refs, num, slug } from './parse-util.mjs';
import { parseEvents } from './parse-events.mjs';
import { parseEquipment } from './parse-equipment.mjs';
import { parseBuilds } from './parse-builds.mjs';
import { parseBlueprints } from './parse-blueprints.mjs';

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
  const museumWt = section(wt, 'Museum Usage');
  let museum = null;
  if (museumWt) {
    // Line-anchored: "Minimum weight for maximum boost:" would otherwise also
    // satisfy a bare /Boost:/ and /Maximum Boost:/ match.
    const line = (re) => {
      const m = museumWt.match(re);
      return m ? plain(m[1]) : null;
    };
    const boostsRaw = (museumWt.match(/^\s*\*\s*Boosts?:\s*(.+)$/im) || [])[1] || '';
    museum = {
      minWeight: line(/^\s*\*\s*Minimum weight[^:]*:\s*(.+)$/im),
      // "Boosts: {{Stat|Luck}}, {{Stat|Shake Speed}}" -> ['Luck', 'Shake Speed']
      stats: [...boostsRaw.matchAll(/\{\{Stat\|([^{}]+)\}\}/gi)].map(m => m[1].trim()),
      maxBoost: line(/^\s*\*\s*Maximum Boost:\s*(.+)$/im),
    };
    if (!museum.minWeight && !museum.stats.length && !museum.maxBoost) museum = null;
  }

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
    museum,
    trivia: p.trivia ? p.trivia.split('\n').map(l => plain(l.replace(/^\s*\*/, ''))).filter(Boolean) : [],
    wiki: `https://prospecting.miraheze.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
  };
}).filter(Boolean);

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

/* ---------- community builds ------------------------------------------- */
// Optional: the guide is a third-party Google Doc, so the site still builds
// without it. `npm run data:builds` refreshes the snapshot.
let builds = [];
let buildStages = [];
try {
  const guideText = readFileSync('data/raw/builds.txt', 'utf8');
  builds = parseBuilds(guideText);

  // "Stage III. - Swamp: Highest location is Timelocked Sanctuary."
  // The location is what players actually recognise, so it drives the UI.
  const seen = new Set();
  for (const m of guideText.matchAll(
    /^Stage\s+(V|IV|III|II|I|0)\.?\s*[-–]\s*([^:]+):\s*Highest location is ([^.]+)\./gim,
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
console.log(`builds ${builds.length} (${[...new Set(builds.map(b => b.stage))].join(', ')})`);
console.log(`blueprints ${blueprints.length} (${blueprints.filter(b => b.kind === 'quest').length} quest, ${blueprints.filter(b => b.kind === 'purchase').length} bought, ${blueprints.filter(b => b.kind === 'found').length} found) · matched to ${equipment.filter(e => e.blueprint).length} items`);
console.log(`equipment ${equipment.length} (${equipment.filter(e => e.limited).length} limited) · slots ${[...new Set(equipment.map(e => e.slot))].join('/')}`);
console.log(`luck events ${events.length} (${events.filter(e => e.kind === 'multiplicative').length} multiplicative, ${events.filter(e => e.kind === 'additive').length} additive, ${events.filter(e => e.kind === 'unknown').length} unquantified)`);
console.log(`no chances: ${minerals.filter(m => !m.chances.length).map(m => m.name).join(', ') || 'none'}`);
console.log(`no image:   ${minerals.filter(m => !m.image).map(m => m.name).join(', ') || 'none'}`);
console.log(`no recipes: ${minerals.filter(m => !m.recipes.length).length}`);
