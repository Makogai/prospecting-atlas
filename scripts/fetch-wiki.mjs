// Stage 1: pull every page we care about as raw wikitext into data/raw/.
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { api, categoryMembers, wikitextFor } from './wiki.mjs';

const OUT = 'data/raw/pages.json';
const FRESH = process.argv.includes('--fresh');

// Hand-picked index / systems pages that aren't in a useful category.
const INDEX_PAGES = [
  'Minerals', 'Pans', 'Shovels', 'Sluices', 'Locations', 'Equipment',
  'Enchanting', 'Trinkets', 'Modifiers', 'Potions', 'Stats', 'Levels',
  'Codes', 'Merchant', 'Museum', 'Geodes', 'Ground Items', 'Consumables',
  'Enchant Books', 'Blueprints', 'Waypoints', 'Toughness', 'Prospector Kit',
  // Luck sources: the Events page annotates each effect "Multiplicative" or
  // "Additive", which is exactly what the luck model needs.
  'Events', 'Luck Mechanics', 'Shard Merchant', 'Relics',
  'Quests', 'NPCs',
  // Blueprint (singular) is the page that says how each one is obtained.
  'Blueprint',

  // Progression systems. None of these sit in a category, and between them
  // they're the answer to "why am I not getting better at this".
  'Level', 'Mastery', 'Titles', 'Runes', 'Mutations', 'Permanent Buffs',
  'Stat Systems Guide',

  // Activities and the things they hand out.
  'Excavations', 'Relic Crafting', 'Treasure Chest', 'Fallen Crate',
  'Daily Login Bonus', 'Shrines', 'MVP',

  // Economy: what the currencies are and who takes them.
  'Meteor Shards', "Prospector's Shop", 'Traveling Merchant',

  // Fixed world objects people ask where to find.
  'Crafting Anvil', 'Magma Forge', 'Vault', 'Warp Device',
  'Manage Museums Board', 'Visit Museums Globe',

  // Regions group locations; the Locations page itself is a flat list.
  'Mainland', 'Snowy Mountain', 'Sunscorched Desert',
];

const CATEGORIES = [
  'Minerals', 'Locations', 'Items', 'Consumables', 'Potions', 'Enchant Books', 'Geodes',
  // NPC articles carry the one-line description each quest giver gets.
  'NPCs',
];

async function main() {
  if (existsSync(OUT) && !FRESH) {
    const n = Object.keys(JSON.parse(readFileSync(OUT, 'utf8')).pages).length;
    console.log(`cache hit: ${OUT} (${n} pages). Use --fresh to re-fetch.`);
    return;
  }

  // Every article on the wiki, not just the ones we currently parse. The list
  // is ~400 pages, and pulling the lot means adding a parser never needs a
  // re-fetch — and nothing can be missing because we forgot to name it.
  const titles = new Set(INDEX_PAGES);
  let apcont;
  do {
    const j = await api({
      action: 'query', list: 'allpages', apnamespace: '0', aplimit: '500',
      ...(apcont ? { apcontinue: apcont } : {}),
    });
    j.query.allpages.forEach(p => titles.add(p.title));
    apcont = j.continue?.apcontinue;
  } while (apcont);
  console.log(`mainspace articles -> ${titles.size}`);

  const byCategory = {};
  for (const cat of CATEGORIES) {
    const members = await categoryMembers(cat);
    byCategory[cat] = members;
    members.forEach(t => titles.add(t));
    console.log(`Category:${cat} -> ${members.length}`);
  }

  // Every template in the wiki: the location/rarity colour tags live here.
  const templates = [];
  let cont;
  do {
    const j = await api({
      action: 'query', list: 'allpages', apnamespace: '10', aplimit: '500',
      ...(cont ? { apcontinue: cont } : {}),
    });
    templates.push(...j.query.allpages.map(p => p.title));
    cont = j.continue?.apcontinue;
  } while (cont);
  console.log(`templates -> ${templates.length}`);

  const pages = await wikitextFor([...titles]);
  console.log(`article wikitext -> ${Object.keys(pages).length}`);
  const tpl = await wikitextFor(templates);
  console.log(`template wikitext -> ${Object.keys(tpl).length}`);

  writeFileSync(OUT, JSON.stringify({ fetchedAt: new Date().toISOString(), byCategory, pages, templates: tpl }, null, 0));
  console.log(`wrote ${OUT}`);
}
main();
