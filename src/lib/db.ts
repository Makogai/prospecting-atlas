import raw from '../data/db.json';
import images from '../data/images.json';
// Formatting lives in shared/ so the Discord bot renders identical numbers.
import { money } from '../../shared/format.mjs';

/* ---------- types ------------------------------------------------------ */

export type RarityName =
  | 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary' | 'Mythic' | 'Exotic';

export interface Rarity {
  name: RarityName;
  order: number;
  colors: string[];
}

export interface Chance {
  site: string;
  conditional: string | null;
  percent: number | null;
  oneIn: number | null;
}

export interface Recipe {
  name: string;
  rarity: RarityName | null;
  note: string | null;
  ingredients: { qty: number; item: string }[];
}

/** One stat a museum ore moves. Negative means it's a debuff, not a bonus. */
export interface MuseumBoost {
  stat: string;
  value: number;
}

export interface Museum {
  /** Kilograms needed for the full boost; below this it scales down. */
  minWeight: number | null;
  boosts: MuseumBoost[];
  /** Displays only accept their own rarity, so this is which one takes it. */
  displayRarity: RarityName;
}

export interface MuseumDisplay {
  rarity: RarityName;
  free: number;
  locked: number;
  /** Cost of the money-unlocked display, or null where there isn't one. */
  money: number | null;
  shards: number | null;
  total: number;
}

export interface MuseumOre {
  id: string;
  name: string;
  rarity: RarityName;
  minWeight: number | null;
  boosts: MuseumBoost[];
}

export interface MuseumModifier {
  name: string;
  stats: string[];
  /** Percent chance per dig, or null when it can't be dug at all. */
  chance: number | null;
  source: string | null;
  diggable: boolean;
}

export interface MuseumData {
  displays: MuseumDisplay[];
  slots: number;
  ores: MuseumOre[];
  modifiers: MuseumModifier[];
  modifierMultipliers: { rarity: RarityName; value: number }[];
  treasuredMultiplier: number;
  stats: string[];
  wiki: string;
}

export interface Mineral {
  id: string;
  name: string;
  image: string | null;
  description: string;
  rarity: RarityName;
  value: number | null;
  locations: string[];
  chances: Chance[];
  ratesKnown: boolean;
  recipes: Recipe[];
  museum: Museum | null;
  trivia: string[];
  wiki: string;
}

export interface SiteMineral {
  id: string;
  name: string;
  rarity: RarityName;
  value: number | null;
  percent: number | null;
  oneIn: number | null;
  conditional: string | null;
}

export interface DigSite {
  id: string;
  name: string;
  colors: string[];
  page: string | null;
  minerals: SiteMineral[];
  expectedValue: number;
  coverage: number;
  mineralCount: number;
  topRarity: RarityName | null;
}

export interface Location {
  id: string;
  name: string;
  image: string | null;
  summary: string;
  digSites: string[];
  colors: string[];
  wiki: string;
}

export interface Gear {
  id: string;
  name: string;
  image: string | null;
  description: string;
  color: string | null;
  price: number | null;
  priceLabel: string | null;
  /** Event gear is bought with an event currency instead of cash. */
  currency: string | null;
  currencyAmount: number | null;
  stats: Record<string, number>;
  passive: string | null;
  source: string;
  sourceRefs: string[];
  /** What the item's own page says under "Obtained"; null when it has no page. */
  obtained: string | null;
  /** False for gear that was removed from the game. */
  obtainable: boolean;
}

export type GearKind = 'pans' | 'shovels' | 'sluices';

export type EquipSlot = 'Ring' | 'Charm' | 'Necklace';

export interface StatRange {
  min: number;
  max: number;
  unit: '%' | null;
}

export interface EquipStat {
  stat: string;
  /** Range on a normal item. */
  base: StatRange;
  /** Range once merged to six stars at the Magma Forge. */
  sixStar: StatRange;
}

export interface Equipment {
  id: string;
  name: string;
  rarity: string;
  /** Event-only, from the wiki's Limited-Time Equipment tabber. */
  limited: boolean;
  slot: EquipSlot | null;
  image: string | null;
  description: string;
  color: string | null;
  recipe: { qty: number; item: string; minWeight: number | null; catalyst: boolean }[];
  stats: EquipStat[];
  price: number | null;
  currency: string | null;
  currencyAmount: number | null;
  /** Id of the blueprint that unlocks crafting, when one is required. */
  blueprint: string | null;
}

export interface QuestStep {
  text: string;
  note: string | null;
  /** Pages the step links to — usually the mineral it asks for. */
  refs: string[];
}

export interface Quest {
  id: string;
  name: string;
  summary: string | null;
  location: string;
  npc: string | null;
  steps: QuestStep[];
  rewards: string | null;
  /** A permanent stat buff, which is what makes a quest worth prioritising. */
  buff: string | null;
  wiki: string;
}

export interface Npc {
  id: string;
  name: string;
  image: string | null;
  /** Broad regions from the NPC index page. */
  regions: string[];
  /** Specific dig sites or locations, with a landmark hint where the wiki gives one. */
  places: { name: string; note: string | null }[];
  summary: string | null;
  hasPage: boolean;
  /** Ids of the quests this NPC gives. */
  quests: string[];
  wiki: string;
}

/** How a blueprint is obtained; some equipment can't be crafted without one. */
export interface Blueprint {
  id: string;
  /** The equipment this unlocks. */
  equipment: string;
  image: string | null;
  kind: 'quest' | 'purchase' | 'found' | 'other';
  quest: {
    name: string | null;
    summary: string | null;
    giver: string | null;
    location: string | null;
    steps: string[];
    rewards: string | null;
  } | null;
  purchase: { where: string | null; cost: number | null; currency: string | null } | null;
  note: string | null;
  wiki: string;
}

/** One museum slot in a community build: a boost, and the ores that grant it. */
export interface BuildMuseumRow {
  rarity: string | null;
  /** Boost types this slot is for, e.g. ['Luck', 'Capacity']. */
  codes: string[];
  /** How many of the options to pick; usually 1. */
  pick: number;
  options: { ore: string; minWeight: number | null }[];
}

export interface BuildEquipEntry {
  count: number;
  /** Count when you only have six ring slots instead of eight. */
  countSixRing: number | null;
  name: string;
  note?: string;
}

export interface Build {
  id: string;
  /** Which outcome this build is for; see BUILD_GOALS. */
  goal: string;
  /** 'V' … '0', or 'Bonus'. */
  stage: string | null;
  area: string;
  name: string;
  sellingOnly: boolean;
  purpose: string;
  notes: string[];
  /** The one-tap check, e.g. "Dig Strength × 1.5 >= Capacity". */
  formula: string | null;
  credit: string | null;
  modifier: string | null;
  museum: BuildMuseumRow[];
  equipment: {
    charm: BuildEquipEntry[];
    neck: BuildEquipEntry[];
    rings: BuildEquipEntry[];
    runes: string[];
    pan: BuildEquipEntry[];
    shovel: BuildEquipEntry[];
  };
}

/** A luck-affecting event, scraped from the wiki's Events page. */
export interface LuckEvent {
  id: string;
  name: string;
  /** How it combines: additive bonuses sum, multiplicative ones multiply on top. */
  kind: 'additive' | 'multiplicative' | 'unknown';
  /** Bonus for additive, factor for multiplicative, null when the wiki omits it. */
  value: number | null;
  /** Dig sites it is restricted to; empty when it applies everywhere. */
  sites: string[];
  global: boolean;
  admin: boolean;
  note: string | null;
}


/* ---------- systems ----------------------------------------------------- */

/** A modifier multiplies a mineral's sell value — Perfect is 24x base. */
export interface Modifier {
  id: string;
  name: string;
  sellMultiplier: number | null;
  color: string | null;
  colorName: string | null;
  description: string | null;
  image: string | null;
  tools: string[];
  equipment: string[];
  locations: string[];
  events: string[];
  museumStats: string[];
  /** Percent chance per dig, or null when it can't be dug for. */
  percent: number | null;
  oneIn: number | null;
  note: string | null;
  /** Where it comes from when there's no dig chance. */
  source: string | null;
}

export interface CodeReward {
  name: string;
  value: string;
  /** Set for timed boosts: "30m", "2h". */
  duration: string | null;
  amount: number | null;
}

export interface GameCode {
  code: string;
  active: boolean;
  rewards: CodeReward[];
}

export interface Enchant {
  id: string;
  name: string;
  slot: 'Pan' | 'Shovel';
  effect: string;
  refs: string[];
  stats: string[];
  /** Per-ore odds for pans; a single flat entry for shovels. */
  chances: { via: string | null; percent: number }[];
  bestChance: number | null;
  note: string | null;
  locked: string | null;
}

export interface ExcavationSite {
  id: string;
  name: string;
  /** A–F; the level table refers to sites by this letter. */
  code: string | null;
  region: string;
  where: string | null;
  permit: number | null;
  runCost: number | null;
  itemsLabel: string | null;
  duration: string | null;
  places: string[];
  rewards: { name: string; description: string | null; effect: string | null; percent: number | null }[];
}

export interface ExcavationLevel {
  level: number;
  luck: number | null;
  items: Record<string, string | null>;
  speedMultiplier: number | null;
  durations: Record<string, string | null>;
}

export interface Excavations {
  summary: string;
  levelCap: number | null;
  places: string[];
  unmatchedRewards: string[];
  sites: ExcavationSite[];
  levels: ExcavationLevel[];
  wiki: string;
}

export interface RelicLine {
  text: string;
  depth: number;
  refs: string[];
}

export interface Relic {
  id: string;
  name: string;
  category: string;
  image: string | null;
  description: string | null;
  effect: string | null;
  triggers: string[];
  obtainment: RelicLine[];
  usage: RelicLine[];
}

export interface Levels {
  xpByRarity: { rarity: string; xp: number | null }[];
  steps: { from: number; to: number; cost: number | null; total: number }[];
  maxLevel: number | null;
  titles: { name: string; range: string; color: string | null }[];
  wiki: string;
}

export interface Rune {
  id: string;
  name: string;
  color: string | null;
  image: string | null;
  effect: string | null;
  where: string | null;
  places: string[];
}

export interface MasteryTier {
  name: string;
  tier: number | null;
  steps: string[];
  rewards: string | null;
}

export interface MasteryTrack {
  id: string;
  name: string;
  boost: string | null;
  kind: 'Location' | 'Activity';
  tiers: MasteryTier[];
}

export interface Mastery {
  overview: string | null;
  /** The wiki is explicit that location mastery luck does not stack. */
  stacks: boolean;
  tracks: MasteryTrack[];
  wiki: string;
}

export interface PermanentBuff {
  id: string;
  name: string;
  source: string | null;
  lines: string[];
}

export interface Potion {
  id: string;
  name: string;
  shop: string | null;
  money: number | null;
  shards: number | null;
  priceLabel: string | null;
  effect: string;
  stats: string[];
  duration: string | null;
  description: string | null;
  image: string | null;
}

export interface Trinket {
  id: string;
  name: string;
  color: string | null;
  perk: string | null;
  image: string | null;
  obtained: string | null;
  where: string | null;
  places: string[];
}

export interface PageSection {
  heading: string;
  lines: string[];
  prose: string[];
}

export interface Currency {
  id: string;
  name: string;
  summary: string | null;
  obtain: string[];
  spend: string[];
}

export interface Mutation {
  id: string;
  name: string;
  /** Universal multiplier applied to every stat on the item. */
  multiplier: number | null;
  bonuses: string[];
  stats: string[];
}

export interface Mutations {
  summary: string | null;
  /** Where you reroll one. */
  forge: string | null;
  mutations: Mutation[];
  chanceTiers: { tier: string; counts: (number | null)[]; rows: { mutation: string; percents: (number | null)[] }[] }[];
  wiki: string;
}

/** An entry from the wiki's own front-page icon grid. */
export interface NavIcon {
  target: string;
  image: string;
}

export interface Region {
  id: string;
  name: string;
  summary: string | null;
  locations: string[];
}

/* ---------- the database ----------------------------------------------- */

export const db = raw as unknown as {
  meta: { source: string; fetchedAt: string; builtAt: string };
  rarities: Rarity[];
  minerals: Mineral[];
  digSites: DigSite[];
  locations: Location[];
  pans: Gear[];
  shovels: Gear[];
  sluices: Gear[];
  events: LuckEvent[];
  equipment: Equipment[];
  blueprints: Blueprint[];
  quests: Quest[];
  npcs: Npc[];
  museum: MuseumData;
  modifiers: Modifier[];
  codes: GameCode[];
  enchants: Enchant[];
  enchantHowTo: string[];
  excavations: Excavations;
  relics: Relic[];
  relicAcquisition: { text: string; refs: string[] }[];
  levels: Levels;
  runes: { slots: { level: number; slots: number }[]; runes: Rune[]; mechanics: string[]; wiki: string };
  permanentBuffs: PermanentBuff[];
  mastery: Mastery;
  potions: Potion[];
  trinkets: Trinket[];
  geodes: { sections: Record<string, PageSection>; wiki: string };
  treasureChests: { sections: Record<string, PageSection>; loot: { id: string; place: string; items: string[] }[]; wiki: string };
  currencies: Currency[];
  regions: Region[];
  mutations: Mutations;
  navIcons: NavIcon[];
  builds: Build[];
  buildStages: { stage: string; area: string; highest: string | null }[];
  buildGuide: { title: string; url: string; authors: string[]; snapshot: string };
};

export const {
  minerals, digSites, locations, pans, shovels, sluices, rarities, events, equipment,
  builds, buildGuide, blueprints, buildStages, quests, npcs, museum,
  modifiers, codes, enchants, enchantHowTo, excavations, relics, relicAcquisition,
  levels, runes, permanentBuffs, mastery, potions, trinkets, geodes, treasureChests,
  currencies, regions, mutations, navIcons,
} = db;

export const npcByName = new Map(npcs.map((n) => [n.name, n]));
export const questById = new Map(quests.map((q) => [q.id, q]));
export const mineralByName = new Map(minerals.map((m) => [m.name.toLowerCase(), m]));
export const locationByName = new Map(locations.map((l) => [l.name, l]));

export const blueprintById = new Map(blueprints.map((b) => [b.id, b]));

/**
 * What a build is for. The guide names builds by stage ("Luck Efficiency III"),
 * but people arrive wanting an outcome, so this is the first thing they pick.
 */
export const BUILD_GOALS = [
  { id: 'luck', label: 'Luck', blurb: 'Best odds on rare minerals.' },
  { id: 'hybrid', label: 'Hybrid', blurb: 'Luck, size and modifiers together — the all-rounder.' },
  { id: 'size', label: 'Size', blurb: 'Heaviest minerals, which are worth more when you sell.' },
  { id: 'money', label: 'Money', blurb: 'Cash per hour, usually with auto-pan.' },
  { id: 'sell', label: 'Sell', blurb: 'Swapped on only while selling a full bag.' },
  { id: 'items', label: 'Items', blurb: 'Most minerals per minute, for collection quests.' },
  { id: 'treasure', label: 'Treasure', blurb: 'Treasure maps and geodes.' },
  { id: 'shards', label: 'Shards', blurb: 'Meteor shards during a shower.' },
  { id: 'fun', label: 'Just for fun', blurb: 'Not meant to be efficient.' },
  { id: 'other', label: 'Other', blurb: '' },
];

export const goalMeta = (id: string) => BUILD_GOALS.find((g) => g.id === id) ?? null;

export const equipmentById = new Map(equipment.map((e) => [e.id, e]));

/** How many of each slot you can wear at once. */
export const SLOT_LIMITS: Record<EquipSlot, number> = { Necklace: 1, Charm: 1, Ring: 8 };

/** Equipment rarity order, including the Ascended tier above Exotic. */
export const EQUIP_RARITY_ORDER = [
  'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Exotic', 'Ascended',
];

/** Colours for equipment tiers, reusing the mineral scale and extending it. */
export function equipRarityColors(rarity: string): string[] {
  const hit = rarities.find((r) => r.name === rarity);
  if (hit) return hit.colors;
  if (rarity === 'Ascended') return ['#BAB398', '#927F2C'];
  return ['#888888', '#555555'];
}

/** Every mineral an equipment recipe calls for, resolved where we know it. */
export function recipeMinerals(item: Equipment) {
  return item.recipe.map((r) => ({
    ...r,
    mineral: minerals.find((m) => m.name.toLowerCase() === r.item.toLowerCase()) ?? null,
  }));
}

export const RARITY_ORDER = rarities.map((r) => r.name);

const byId = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));

export const mineralById = byId(minerals);
export const digSiteById = byId(digSites);
export const locationById = byId(locations);

/** Dig sites keyed by their wiki display name, e.g. "Rubble Creek Sands". */
export const digSiteByName = new Map(digSites.map((s) => [s.name, s]));

export const rarityByName = new Map(rarities.map((r) => [r.name, r]));

/* ---------- front-page tiles -------------------------------------------- */

/**
 * The wiki's own icon grid, pointed at our routes.
 *
 * Reusing their ordering and art rather than inventing our own: it's the one
 * curated list of "what people actually come here for" the wiki publishes.
 * A wiki target with no route here is dropped rather than linked somewhere
 * approximate — two of them (Treasure Map, Ground Items) we genuinely don't
 * cover yet, and a tile that lands on the wrong page is worse than no tile.
 */
const TILE_ROUTES: Record<string, { to: string; label: string; group: string }> = {
  Minerals: { to: '/minerals', label: 'Minerals', group: 'Find' },
  Locations: { to: '/locations', label: 'Locations', group: 'Find' },
  Pans: { to: '/gear/pans', label: 'Pans', group: 'Gear' },
  Shovels: { to: '/gear/shovels', label: 'Shovels', group: 'Gear' },
  Sluices: { to: '/gear/sluices', label: 'Sluices', group: 'Gear' },
  Equipment: { to: '/equipment', label: 'Equipment', group: 'Gear' },
  Enchanting: { to: '/enchanting', label: 'Enchanting', group: 'Gear' },
  Mutations: { to: '/equipment#mutations', label: 'Mutations', group: 'Gear' },
  Quests: { to: '/quests', label: 'Quests', group: 'Progress' },
  NPCs: { to: '/quests?view=npcs', label: 'NPCs', group: 'Progress' },
  Museum: { to: '/museum', label: 'Museum', group: 'Progress' },
  Excavations: { to: '/excavations', label: 'Excavations', group: 'Progress' },
  Mastery: { to: '/progression', label: 'Mastery', group: 'Progress' },
  Runes: { to: '/progression?tab=runes', label: 'Runes', group: 'Progress' },
  Events: { to: '/progression?tab=events', label: 'Events', group: 'Progress' },
  Relics: { to: '/relics', label: 'Relics', group: 'Items' },
  Geodes: { to: '/items?tab=chests', label: 'Geodes', group: 'Items' },
  'Traveling Merchant': { to: '/relics', label: 'Traveling Merchant', group: 'Items' },
};

export interface NavTile {
  target: string;
  /** Wiki icon file, when their front page has one for it. */
  image: string | null;
  /** Stroke paths for the pages the wiki has no icon for. */
  paths?: string[];
  to: string;
  label: string;
  group: string;
}

/**
 * Tiles for our own pages, which the wiki's grid has no icon for — either
 * because the page is our framing of their data (Compare, Builds) or because
 * they never put it on the front page (Codes, Modifiers).
 *
 * Drawn as 24x24 stroke paths to sit alongside the wiki's line art rather than
 * borrowing an icon that means something else.
 */
const EXTRA_TILES: NavTile[] = [
  {
    target: 'Dig Sites', to: '/sites', label: 'Dig Sites', group: 'Find', image: null,
    paths: ['M12 3 3 8l9 5 9-5-9-5Z', 'm3 14 9 5 9-5'],
  },
  {
    target: 'Compare', to: '/compare', label: 'Compare', group: 'Find', image: null,
    paths: ['M4 20v-8', 'M10 20V4', 'M16 20v-6', 'M21 20v-11'],
  },
  {
    target: 'Builds', to: '/builds', label: 'Builds', group: 'Gear', image: null,
    paths: ['M3 5h18v14H3z', 'M3 10h18', 'M9 10v9'],
  },
  {
    target: 'Codes', to: '/codes', label: 'Codes', group: 'Items', image: null,
    paths: ['M3 7h18v10H3z', 'M7 11h.01', 'M11 11h.01', 'M15 11h.01', 'M8 14h8'],
  },
  {
    target: 'Modifiers', to: '/modifiers', label: 'Modifiers', group: 'Items', image: null,
    paths: ['M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2Z'],
  },
  {
    target: 'Potions', to: '/items', label: 'Potions', group: 'Items', image: null,
    paths: ['M9 3h6', 'M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3'],
  },
];

export const navTiles: NavTile[] = [
  ...navIcons.flatMap((icon): NavTile[] => {
    const route = TILE_ROUTES[icon.target];
    return route ? [{ ...icon, ...route }] : [];
  }),
  ...EXTRA_TILES,
];

/* ---------- museum ------------------------------------------------------ */

export const museumOreById = byId(museum.ores);
export const museumDisplayByRarity = new Map(museum.displays.map((d) => [d.rarity, d]));

/** What one ore does for one stat, or 0 if it doesn't touch it. */
export const boostFor = (ore: MuseumOre | null | undefined, stat: string) =>
  ore?.boosts.find((b) => b.stat === stat)?.value ?? 0;

/**
 * Every ore that moves a stat, best first, keyed by stat.
 *
 * Debuffs are included rather than filtered out — an ore that gives +1.2× Dig
 * Strength and −0.8× Dig Speed belongs in both lists, and hiding it from the
 * second would make it look strictly better than it is.
 */
export const museumOresByStat = new Map<string, MuseumOre[]>(
  museum.stats.map((stat) => [
    stat,
    museum.ores
      .filter((o) => o.boosts.some((b) => b.stat === stat))
      .sort((a, b) => boostFor(b, stat) - boostFor(a, stat)),
  ]),
);

/**
 * The best ores you could slot for one stat, given how many displays each
 * rarity has.
 *
 * Displays only accept their own rarity, so this isn't "take the top 18" — it's
 * a separate pick per rarity, which is why a Common display can still be worth
 * filling when Exotics exist. Ores whose net effect on the stat is zero or
 * negative are left out; an empty display beats one that costs you the stat.
 */
export function bestMuseumPicks(stat: string): Map<RarityName, MuseumOre[]> {
  const out = new Map<RarityName, MuseumOre[]>();
  for (const display of museum.displays) {
    const picks = (museumOresByStat.get(stat) ?? [])
      .filter((o) => o.rarity === display.rarity && boostFor(o, stat) > 0)
      .slice(0, display.total);
    out.set(display.rarity, picks);
  }
  return out;
}

/** Summed stat totals for a set of slotted ores, including their debuffs. */
export function museumTotals(ores: (MuseumOre | null | undefined)[]) {
  const totals: Record<string, number> = {};
  for (const ore of ores) {
    for (const b of ore?.boosts ?? []) totals[b.stat] = (totals[b.stat] ?? 0) + b.value;
  }
  return totals;
}

/** `0.88×`, and `−0.5×` for a debuff. */
export const boostLabel = (v: number) =>
  `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(2).replace(/\.?0+$/, '')}×`;

export const gearGroups: Record<GearKind, Gear[]> = { pans, shovels, sluices };

export const GEAR_LABEL: Record<GearKind, string> = {
  pans: 'Pans',
  shovels: 'Shovels',
  sluices: 'Sluices',
};

/** Stat keys per gear kind, in the order they should be displayed. */
export const GEAR_STATS: Record<GearKind, string[]> = {
  pans: ['luck', 'capacity', 'strength', 'speed'],
  shovels: ['strength', 'speed', 'toughness'],
  sluices: ['luck', 'capacity', 'efficiency', 'toughness'],
};

export const STAT_LABEL: Record<string, string> = {
  luck: 'Luck',
  capacity: 'Capacity',
  strength: 'Strength',
  speed: 'Speed',
  efficiency: 'Efficiency',
  toughness: 'Toughness',
};

/** Highest value found in each gear kind's stat, for scaling the stat bars. */
export const gearStatMax: Record<GearKind, Record<string, number>> = Object.fromEntries(
  (Object.keys(gearGroups) as GearKind[]).map((kind) => [
    kind,
    Object.fromEntries(
      GEAR_STATS[kind].map((s) => [
        s,
        Math.max(...gearGroups[kind].map((g) => g.stats[s] ?? 0), 1),
      ]),
    ),
  ]),
) as Record<GearKind, Record<string, number>>;

/** What a piece of gear costs, in whatever currency it's actually sold for. */
export function gearPrice(g: Gear): string {
  if (g.currency) return `${(g.currencyAmount ?? 0).toLocaleString('en-US')} ${g.currency}`;
  if (g.price === 0) return 'Free';
  if (g.price == null) return g.priceLabel || 'Not sold';
  return money(g.price);
}

/** Sort key that keeps cash gear in order and parks event gear at the end. */
export function gearPriceOrder(g: Gear): number {
  if (g.currency || g.price == null) return Number.MAX_SAFE_INTEGER;
  return g.price;
}

/* ---------- lookups ----------------------------------------------------- */

/** Every dig site that can drop this mineral, richest chance first. */
export function sitesFor(mineral: Mineral) {
  return mineral.chances
    .map((c) => ({ chance: c, site: digSiteByName.get(c.site) }))
    .filter((x): x is { chance: Chance; site: DigSite } => Boolean(x.site));
}

/** The single best place to farm a mineral (highest drop rate, non-conditional). */
export function bestSiteFor(mineral: Mineral) {
  const solid = sitesFor(mineral).filter((s) => !s.chance.conditional);
  return (solid.length ? solid : sitesFor(mineral))[0] ?? null;
}

/** Locations that contain a given dig site. */
export function locationForSite(site: DigSite) {
  if (site.page) {
    const hit = locations.find((l) => l.name === site.page);
    if (hit) return hit;
  }
  return locations.find((l) => l.digSites.includes(site.id)) ?? null;
}

/**
 * Who and what you'll find at a place.
 *
 * Quest locations straddle both kinds of place — "Fortune River" is a dig site
 * *and* a location, while "Rubble Creek" is only a location — so callers pass
 * every name that means "here": a location plus its dig sites, or a single site.
 */
export function whoIsAt(names: string[]): { npcs: Npc[]; quests: Quest[] } {
  const here = new Set(names.filter(Boolean).map((n) => n.toLowerCase()));
  if (here.size === 0) return { npcs: [], quests: [] };

  const matchingNpcs = npcs.filter(
    (n) =>
      n.places.some((p) => here.has(p.name.toLowerCase())) ||
      n.regions.some((r) => here.has(r.toLowerCase())),
  );

  return {
    // Quest givers first, then by how much they have to offer.
    npcs: matchingNpcs.sort(
      (a, b) => b.quests.length - a.quests.length || a.name.localeCompare(b.name),
    ),
    quests: quests.filter((q) => here.has(q.location.toLowerCase())),
  };
}

/** Minerals whose recipes consume the given mineral. */
export function usedInRecipes(mineral: Mineral) {
  const out: { source: Mineral; recipe: Recipe }[] = [];
  for (const m of minerals) {
    for (const r of m.recipes) {
      if (r.ingredients.some((i) => i.item.toLowerCase().startsWith(mineral.name.toLowerCase()))) {
        out.push({ source: m, recipe: r });
      }
    }
  }
  return out;
}

/* ---------- images ------------------------------------------------------ */

const imageMap = images as Record<string, string>;

/**
 * Wiki file name -> local /img path, or null when we never cached it.
 * Keys are lower-cased because MediaWiki upper-cases the first letter of a
 * title, so pages reference "astralspore.png" for a file stored as "Astralspore.png".
 */
export function imgSrc(file: string | null | undefined): string | null {
  if (!file) return null;
  const key = file.replace(/^File:/i, '').replace(/_/g, ' ').trim().toLowerCase();
  const local = imageMap[key];
  // /sprites holds the same files with the wiki's card frame and printed
  // caption stripped out (see scripts/clean-sprites.mjs).
  return local ? `/sprites/${local}` : null;
}

/* ---------- formatting & colour ---------------------------------------- */

// These live in shared/ because the Discord bot renders the same numbers and
// has to format them identically. Re-exported so callers import from one place.
export {
  money, odds, percent, oddsBar, statBar, readable, readablePair,
} from '../../shared/format.mjs';
