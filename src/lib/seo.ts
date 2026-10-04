import {
  minerals, digSites, locations, gearGroups, GEAR_LABEL, equipment, quests, npcs,
  enchants, relics, potions, modifiers, excavations, museum, mastery,
  money, odds,
  type GearKind,
} from './db';

export const SITE_NAME = 'Prospecting Atlas';
export const SITE_URL = 'https://prospecting.mrh.lol';

export interface PageMeta {
  path: string;
  title: string;
  description: string;
  /** Extra JSON-LD beyond the site-wide graph, if the page warrants it. */
  jsonLd?: Record<string, unknown>;
}

/** Trim to something a search result will actually show, on a word boundary. */
function clip(text: string, max = 158): string {
  const s = text.replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

const breadcrumb = (trail: { name: string; path: string }[]) => ({
  '@type': 'BreadcrumbList',
  itemListElement: trail.map((t, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: t.name,
    item: `${SITE_URL}${t.path}`,
  })),
});

/* ---------- the section pages ------------------------------------------- */

const SECTIONS: PageMeta[] = [
  {
    path: '/',
    title: `${SITE_NAME} — every Prospecting drop rate, dig site and build`,
    description: clip(
      `A searchable atlas for Prospecting on Roblox: ${minerals.length} minerals with real drop rates, ${digSites.length} dig sites with full loot tables, ${quests.length} quests, ${equipment.length} craftables, codes, enchants and relics.`,
    ),
  },
  {
    path: '/minerals',
    title: `All ${minerals.length} minerals — values and drop rates | ${SITE_NAME}`,
    description: clip(
      `Every mineral in Prospecting with its sell value, rarity and where it drops. Filter by rarity or dig site, and see each rate as both a percentage and a 1-in-N figure.`,
    ),
  },
  {
    path: '/sites',
    title: `All ${digSites.length} dig sites and their loot tables | ${SITE_NAME}`,
    description: clip(
      `Open a dig site and see its whole loot table ranked by drop rate, with average value per pull — instead of opening every mineral page to find where it drops.`,
    ),
  },
  {
    path: '/locations',
    title: `Locations and regions | ${SITE_NAME}`,
    description: clip(
      `Every location in Prospecting and the dig sites inside it, grouped by region, with the NPCs and quests you'll find at each.`,
    ),
  },
  {
    path: '/gear/pans',
    title: `Pans compared — Luck, Capacity and Shake stats | ${SITE_NAME}`,
    description: clip(
      `All ${gearGroups.pans.length} pans side by side: Luck, Capacity, Shake Strength and Speed, what each costs and where it comes from.`,
    ),
  },
  {
    path: '/gear/shovels',
    title: `Shovels compared — Dig Strength and Toughness | ${SITE_NAME}`,
    description: clip(
      `All ${gearGroups.shovels.length} shovels side by side, with the stats that decide which dig sites you can work.`,
    ),
  },
  {
    path: '/gear/sluices',
    title: `Sluices compared — Efficiency and Capacity | ${SITE_NAME}`,
    description: clip(`All ${gearGroups.sluices.length} sluices with their throughput and cost.`),
  },
  {
    path: '/equipment',
    title: `${equipment.length} craftable rings, charms and necklaces | ${SITE_NAME}`,
    description: clip(
      `Every craftable in Prospecting with its recipe, stat ranges and what a six-star merge adds. Build a loadout and it totals the stats, including mutations.`,
    ),
  },
  {
    path: '/enchanting',
    title: `Enchanting — every pan and shovel enchant and its odds | ${SITE_NAME}`,
    description: clip(
      `All ${enchants.length} enchants at the Fortune River altar, ranked by the chance of rolling them with Aurorite, Aetherite or Aetherium.`,
    ),
  },
  {
    path: '/builds',
    title: `Community builds by stage and goal | ${SITE_NAME}`,
    description: clip(
      `The community build guide reorganised around where you actually are, with the museum ores and equipment each build calls for.`,
    ),
  },
  {
    path: '/quests',
    title: `${quests.length} quests and ${npcs.length} NPCs — who gives what | ${SITE_NAME}`,
    description: clip(
      `Every quest in Prospecting with its steps, rewards and the NPC who gives it, searchable by the place they stand.`,
    ),
  },
  {
    path: '/planner',
    title: `Build planner — every stat, and where each point came from | ${SITE_NAME}`,
    description: clip(
      `Pick your pan, shovel, enchants, equipment and museum, add the buffs you have running, and see the stat panel the game would show you — with every contribution traced back to its source.`,
    ),
  },
  {
    path: '/museum',
    title: `Museum planner — best ore for all ${museum.slots} displays | ${SITE_NAME}`,
    description: clip(
      `Displays only accept their own rarity, so filling the museum is ${museum.slots} separate picks. Choose a stat and see the best ore for every slot, then share the build.`,
    ),
  },
  {
    path: '/excavations',
    title: `Excavations — permits, timers and reward pools | ${SITE_NAME}`,
    description: clip(
      `All ${excavations.sites.length} excavation sites with permit costs, run costs and how your excavation level changes the duration and item count.`,
    ),
  },
  {
    path: '/progression',
    title: `Levels, mastery, runes and permanent buffs | ${SITE_NAME}`,
    description: clip(
      `The four progression systems in one place: XP to each of 60 levels, ${mastery.tracks.length} mastery tracks, every rune, and the buffs you keep once earned.`,
    ),
  },
  {
    path: '/relics',
    title: `${relics.length} relics and where each one drops | ${SITE_NAME}`,
    description: clip(
      `Event, boost and enchant relics, with the excavations, chests and merchants each one comes from.`,
    ),
  },
  {
    path: '/items',
    title: `Potions, trinkets, chests and currency | ${SITE_NAME}`,
    description: clip(
      `${potions.length} potions by alchemist, every trinket, treasure chest lootpools by location, and what Meteor Shards are for.`,
    ),
  },
  {
    path: '/modifiers',
    title: `Modifiers — what multiplies a mineral's sell price | ${SITE_NAME}`,
    description: clip(
      `All ${modifiers.length} modifiers and their sell multipliers, from Perfect at ${modifiers[0]?.sellMultiplier}× down. Pick an ore and a weight to see what each one would be worth.`,
    ),
  },
  {
    path: '/codes',
    title: `Working Prospecting codes | ${SITE_NAME}`,
    description: clip(
      `Every redeemable code for Prospecting, active ones first with what each gives. Expired codes kept so you can tell a dead code from a fake one.`,
    ),
  },
  {
    path: '/compare',
    title: `Compare dig sites for a shopping list | ${SITE_NAME}`,
    description: clip(
      `Pick the minerals you're hunting and get the one dig site that covers most of your list, instead of guessing.`,
    ),
  },
  {
    path: '/changelog',
    title: `What's new | ${SITE_NAME}`,
    description: clip(`Every change to the Atlas, newest first.`),
  },
];

/* ---------- the generated pages ----------------------------------------- */

function mineralMeta(m: (typeof minerals)[number]): PageMeta {
  const best = m.chances.find((c) => c.oneIn != null);
  const where = m.locations.slice(0, 3).join(', ');
  return {
    path: `/minerals/${m.id}`,
    title: `${m.name} — ${m.rarity} · ${money(m.value)}/kg · where to find it | ${SITE_NAME}`,
    description: clip(
      `${m.name} is a ${m.rarity.toLowerCase()} mineral worth ${money(m.value)} per kg.` +
        (best ? ` Best odds ${odds(best.oneIn)} at ${best.site}.` : '') +
        (where ? ` Found at ${where}.` : '') +
        ` ${m.description}`,
    ),
    jsonLd: {
      '@type': 'Product',
      name: m.name,
      description: m.description || `A ${m.rarity} mineral in Prospecting.`,
      category: `${m.rarity} mineral`,
      ...(m.value != null && {
        offers: {
          '@type': 'Offer',
          price: m.value,
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
        },
      }),
    },
  };
}

function siteMeta(s: (typeof digSites)[number]): PageMeta {
  const top = s.minerals[0];
  return {
    path: `/sites/${s.id}`,
    title: `${s.name} loot table — all ${s.mineralCount} minerals | ${SITE_NAME}`,
    description: clip(
      `Everything ${s.name} can drop, ranked by rate. ${s.mineralCount} minerals averaging ${money(s.expectedValue)} per pull` +
        (top ? `, up to ${top.name} at ${odds(top.oneIn)}` : '') +
        '.',
    ),
  };
}

function locationMeta(l: (typeof locations)[number]): PageMeta {
  return {
    path: `/locations/${l.id}`,
    title: `${l.name} — dig sites, NPCs and quests | ${SITE_NAME}`,
    description: clip(
      l.summary ||
        `${l.name} in Prospecting, with its ${l.digSites.length} dig sites and who you'll find there.`,
    ),
  };
}

/** Every page the prerenderer should write, and what goes in its head. */
export function allPages(): PageMeta[] {
  return [
    ...SECTIONS,
    ...minerals.map(mineralMeta),
    ...digSites.map(siteMeta),
    ...locations.map(locationMeta),
  ];
}

/**
 * The site-wide JSON-LD graph. The SearchAction is what lets a search engine
 * offer a sitelinks search box, which is worth having when the whole site is
 * built around one search box.
 */
export function siteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description:
          'An unofficial fan atlas for Prospecting on Roblox: drop rates, dig sites, gear and builds.',
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/minerals?q={search_term_string}` },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };
}

/**
 * Metadata for a path, for keeping the head in step during client-side
 * navigation — the prerendered head is only correct for the page that was
 * first loaded, and a router move doesn't touch it.
 */
const BY_PATH = new Map<string, PageMeta>();
export function metaForPath(pathname: string): PageMeta | null {
  if (BY_PATH.size === 0) for (const p of allPages()) BY_PATH.set(p.path, p);
  const key = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return BY_PATH.get(key) ?? null;
}

export { breadcrumb, clip };
export const GEAR_KINDS = Object.keys(gearGroups) as GearKind[];
export { GEAR_LABEL };
