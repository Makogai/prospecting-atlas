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
];

const CATEGORIES = ['Minerals', 'Locations', 'Items', 'Consumables', 'Potions', 'Enchant Books', 'Geodes'];

async function main() {
  if (existsSync(OUT) && !FRESH) {
    const n = Object.keys(JSON.parse(readFileSync(OUT, 'utf8')).pages).length;
    console.log(`cache hit: ${OUT} (${n} pages). Use --fresh to re-fetch.`);
    return;
  }

  const titles = new Set(INDEX_PAGES);
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
