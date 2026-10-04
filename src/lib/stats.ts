/**
 * The stat engine: what a build actually reads on the Settings → Stats panel.
 *
 * The game computes every stat the same way, which the wiki calls the Golden
 * Rule and which its research tab derives and verifies against measured panel
 * values:
 *
 *     Total = (Base + Flats) × (1 + ΣBoosts) × Events
 *
 *   Base    what your equipped gear provides — pan, shovel, necklace, charm,
 *           rings. This is the number the panel shows in parentheses.
 *   Flats   raw points added on top: potions, quest permanents, Experience.
 *   Boosts  every percentage bonus, summed as decimals and multiplied in ONCE.
 *           Totems, museum, runes, location mastery, the XP Cookie, friends.
 *   Events  the one true multiplier, applied to Luck at the very end.
 *
 * The property that trips everyone up is that boosts add rather than multiply.
 * A 2× totem plus a 2× booster is ×3, not ×4 — the game adds +1.0 and +1.0 into
 * one pile and multiplies once. Ten +100% boosts make ×11, not ×1024.
 *
 * Source: the wiki's Stat Systems Guide, 'The Golden Rule'. Its worked examples
 * are covered by scripts/check-stats.mjs, so a regression here fails the build.
 */
import {
  enchants, museumOreById, mutations, pans, potions, runes, shovels, museum,
  type Equipment, type RarityName,
} from './db';

/* ---------- the panel ---------------------------------------------------- */

export type StatKey =
  | 'Luck' | 'Capacity' | 'Dig Strength' | 'Dig Speed' | 'Shake Strength' | 'Shake Speed'
  | 'Size Boost' | 'Sell Boost' | 'Modifier Boost' | 'Inventory Size' | 'Toughness'
  | 'Efficiency' | 'Treasure Map Chance' | 'Status Timer Speed' | 'Walk Speed' | 'Jump Power';

export interface PanelStat {
  key: StatKey;
  /** How the panel renders the number. */
  unit: '%' | null;
  /**
   * Whether the ×(1 + boosts) term applies at all. Four stats take no
   * multiplier of any kind — they are Base + Flats and nothing else.
   *
   * Efficiency and Treasure Map Chance sit awkwardly: the stat guide lists them
   * among the stats with no boosts, but their own Mastery tracks award
   * 'Sluice Speed +25%' and 'Treasure Chance 1.25×'. The mastery tracks are the
   * more specific source, so they are boostable and only mastery feeds them.
   */
  boostable: boolean;
  /**
   * Whether the XP Cookie's +1.00 reaches this stat. The guide names the six it
   * misses, which is not the same set as the four that take no boosts at all.
   */
  cookie: boolean;
  group: StatGroup;
  /** One line on what the stat does, from the wiki's Stats page. */
  blurb: string;
}

export type StatGroup = 'Finding' | 'Digging' | 'Earning' | 'Quality of life';
export const STAT_GROUPS: StatGroup[] = ['Finding', 'Digging', 'Earning', 'Quality of life'];

export const PANEL_STATS: PanelStat[] = [
  { key: 'Luck', unit: null, boostable: true, cookie: true, group: 'Finding',
    blurb: 'Rolls per ore — the higher it is, the rarer the mineral you draw.' },
  { key: 'Size Boost', unit: '%', boostable: true, cookie: true, group: 'Finding',
    blurb: 'Ore weight: 100% is 2× the base weight, 500% is 6×.' },
  { key: 'Modifier Boost', unit: '%', boostable: true, cookie: true, group: 'Finding',
    blurb: 'What share of ores get a modifier. Every 20% adds 1% on top of the base 5%.' },
  { key: 'Treasure Map Chance', unit: '%', boostable: true, cookie: false, group: 'Finding',
    blurb: 'Chance a dig turns up a treasure map. Low Dig Speed farms these fastest.' },

  { key: 'Capacity', unit: null, boostable: true, cookie: true, group: 'Digging',
    blurb: 'How much sand the pan holds. Items per pan is roughly its square root.' },
  { key: 'Dig Strength', unit: null, boostable: true, cookie: true, group: 'Digging',
    blurb: 'Pan fill per dig. A perfect dig gives 1.5× this; overflow is wasted.' },
  { key: 'Dig Speed', unit: '%', boostable: true, cookie: true, group: 'Digging',
    blurb: 'How quickly a dig reaches perfect. Past ~1000% you cannot tell the difference.' },
  { key: 'Shake Strength', unit: null, boostable: true, cookie: true, group: 'Digging',
    blurb: 'Sand removed per shake — literally, 800 removes 800.' },
  { key: 'Shake Speed', unit: '%', boostable: true, cookie: true, group: 'Digging',
    blurb: 'Shaking frequency when emptying the pan. Diminishing returns at the top.' },
  { key: 'Toughness', unit: null, boostable: false, cookie: false, group: 'Digging',
    blurb: 'Where you may dig at all. Must meet or beat the dig site’s own toughness.' },

  { key: 'Sell Boost', unit: '%', boostable: true, cookie: true, group: 'Earning',
    blurb: 'Sale value: 100% is 2× the money, 500% is 6×. Applies only at the counter.' },
  { key: 'Efficiency', unit: null, boostable: true, cookie: false, group: 'Earning',
    blurb: 'How fast sluices collect. From Sluice Mastery and sluice upgrades.' },

  { key: 'Inventory Size', unit: null, boostable: false, cookie: false, group: 'Quality of life',
    blurb: 'Backpack slots. Fill it and you cannot dig until you sell.' },
  { key: 'Walk Speed', unit: null, boostable: true, cookie: true, group: 'Quality of life',
    blurb: 'Movement speed. Feeds Dig and Shake Speed with the Summit Seeker rune.' },
  { key: 'Jump Power', unit: null, boostable: false, cookie: false, group: 'Quality of life',
    blurb: 'Jump height. Feeds Modifier Boost with the Bunny rune.' },
  { key: 'Status Timer Speed', unit: '%', boostable: false, cookie: false, group: 'Quality of life',
    blurb: 'How slowly your own buffs tick down. 50% makes potions last twice as long.' },
];

export const statByKey = new Map(PANEL_STATS.map((s) => [s.key, s]));

/**
 * The wiki writes the same stat several ways across pages — 'Walkspeed',
 * 'WalkSpeed' and 'Walk Speed' all appear, and the Stats page heads the jump
 * stat 'Jump Boost' while every item calls it 'Jump Power'.
 */
const ALIASES: Record<string, StatKey> = {
  'walkspeed': 'Walk Speed',
  'walk speed': 'Walk Speed',
  'jump boost': 'Jump Power',
  'jump power': 'Jump Power',
  'dig amount': 'Dig Strength',
  'shake amount': 'Shake Strength',
  'dig str': 'Dig Strength',
  'shake str': 'Shake Strength',
  'modifier luck': 'Modifier Boost',
  'treasure chance': 'Treasure Map Chance',
  'inventory': 'Inventory Size',
  'sluice speed': 'Efficiency',
};

export function toStatKey(raw: string): StatKey | null {
  const name = raw.trim().replace(/\s+/g, ' ').replace(/[.,:;]+$/, '');
  if (statByKey.has(name as StatKey)) return name as StatKey;
  return ALIASES[name.toLowerCase()] ?? null;
}

/* ---------- contributions ------------------------------------------------ */

/** Which term of the Golden Rule a contribution lands in. */
export type Band = 'base' | 'flat' | 'boost' | 'event';

export interface Contribution {
  band: Band;
  /** What the breakdown shows, e.g. 'Nebula Pan' or 'Singularium (Exotic)'. */
  source: string;
  /** Points for base and flat, a decimal for boost, a multiplier for event. */
  value: number;
  /** Shown under the source where the number alone would mislead. */
  note?: string;
}

export interface StatLine {
  stat: PanelStat;
  base: number;
  flats: number;
  boosts: number;
  eventMult: number;
  total: number;
  contributions: Contribution[];
}

/* ---------- parsing effect text ------------------------------------------ */

const SPEED_STATS = new Set<StatKey>(['Dig Speed', 'Shake Speed']);

export interface ParsedTerm {
  stat: StatKey;
  /** A multiplier on the gear's own line, as in `1.3× Pan Luck`. */
  multiplier?: number;
  /** Points added to the gear's line, or flat points for a potion. */
  add?: number;
}

const MULT_RE = /^(\d+(?:\.\d+)?)\s*[x×]\s*(?:pan|shovel)?\s*(.+)$/i;
const TERM_RE = /^([-–−+]?)\s*(\d+(?:\.\d+)?)\s*(%?)\s*(.+)$/;

/**
 * Pull stat terms out of a wiki effect string.
 *
 * The strings are consistent enough to parse but not uniform, so this handles
 * the three shapes that actually occur:
 *
 *   `1.3× Pan Luck & +75 Luck`   a multiplier on the pan's own line, then points
 *   `+50% Sell Boost`            points of a percentage-valued stat
 *   `+2 Shake Strength`          points of a flat-valued stat
 *
 * Both hyphen-minus and the en dash the wiki uses for debuffs count as
 * negative. Dropping that sign would turn the game's two worst enchants into
 * bonuses, which is exactly the bug that once made a museum debuff rank first.
 */
export function parseEffect(effect: string): ParsedTerm[] {
  const terms: ParsedTerm[] = [];
  // Separate stats are divided by `·` on the enchant table and by commas
  // everywhere else — gear passives and potion tooltips both read
  // '+300 Luck, +200 Capacity, +3 Walkspeed'. The halves of one stat's term,
  // a multiplier and the points that follow it, are joined by `&`.
  for (const clause of effect.split(/[·•,]/)) {
    let multiplier: number | undefined;
    let stat: StatKey | null = null;
    let add: number | undefined;

    for (const part of clause.split('&')) {
      const text = part.trim();
      if (!text) continue;

      const mult = MULT_RE.exec(text);
      if (mult) {
        const key = toStatKey(mult[2]);
        if (key) {
          multiplier = Number(mult[1]);
          stat = key;
        }
        continue;
      }

      const flat = TERM_RE.exec(text);
      if (!flat) continue;
      const key = toStatKey(flat[4]);
      if (!key) continue;
      const negative = flat[1] !== '' && flat[1] !== '+';
      let value = (negative ? -1 : 1) * Number(flat[2]);
      // The Hyperspeed enchant writes `+0.4 Shake Speed` in the pan table's own
      // units, where 1 is the baseline, while every other enchant writes the
      // same idea as `+10% Shake Speed`. A bare fraction on a speed stat is in
      // the table's units, and the panel reads those ×100.
      if (SPEED_STATS.has(key) && flat[3] !== '%' && Math.abs(value) < 5) value *= 100;
      stat = key;
      add = (add ?? 0) + value;
    }

    if (stat && (multiplier != null || add != null)) terms.push({ stat, multiplier, add });
  }
  return terms;
}

/* ---------- lookups ------------------------------------------------------ */

export const panById = new Map(pans.map((g) => [g.id, g]));
export const shovelById = new Map(shovels.map((g) => [g.id, g]));
export const enchantById = new Map(enchants.map((e) => [e.id, e]));
export const runeById = new Map(runes.runes.map((r) => [r.id, r]));
export const potionById = new Map(potions.map((p) => [p.id, p]));
export const mutationById = new Map(mutations.mutations.map((m) => [m.id, m]));

/** Only pan enchants change stats; shovel enchants change mechanics instead. */
export const panEnchants = enchants.filter((e) => e.slot === 'Pan');
export const shovelEnchants = enchants.filter((e) => e.slot === 'Shovel');

/* ---------- gear --------------------------------------------------------- */

export type GearLines = Map<StatKey, number>;

/**
 * The stat lines a pan or shovel puts on the panel.
 *
 * The wiki's gear tables use their own column names, and `speed` is written
 * against a baseline of 1 where the panel reads a percentage — a Nebula Pan at
 * `speed=1.25` shows as 125 Shake Speed, which is how the stat guide quotes it.
 * Everything else is already in panel points.
 */
export function gearLines(
  gear: { stats: Record<string, number>; passive: string | null },
  kind: 'pan' | 'shovel',
): GearLines {
  const lines: GearLines = new Map();
  const put = (key: StatKey, v: number) => lines.set(key, (lines.get(key) ?? 0) + v);
  const s = gear.stats;

  if (kind === 'pan') {
    if (s.luck) put('Luck', s.luck);
    if (s.capacity) put('Capacity', s.capacity);
    if (s.strength) put('Shake Strength', s.strength);
    if (s.speed != null) put('Shake Speed', s.speed * 100);
  } else {
    if (s.strength) put('Dig Strength', s.strength);
    if (s.speed != null) put('Dig Speed', s.speed * 100);
    if (s.toughness) put('Toughness', s.toughness);
  }

  // Passives carry real stat lines the table columns have no room for — the
  // Nebula Pan's +25 Modifier Boost and +33 Size Boost, for instance.
  if (gear.passive) {
    for (const term of parseEffect(gear.passive)) {
      if (term.add != null) put(term.stat, term.add);
    }
  }
  return lines;
}

const ADDITIONAL_RE = /(\d+(?:\.\d+)?)\s*[x×]\s*additional\s+(\w[\w ]*)/gi;

/**
 * Passive lines that land in the boost pile rather than on the item.
 *
 * The Nebula Pan and the Starcrusher each carry '1.1× additional Luck', which
 * is not a multiplier on their own luck line — it is +0.1 into the pile, the
 * same place a rune or a totem goes. Read as a base multiplier instead it would
 * overstate a top-tier build by a wide margin.
 */
export function gearPassiveBoosts(passive: string | null): { stat: StatKey; value: number }[] {
  if (!passive) return [];
  const out: { stat: StatKey; value: number }[] = [];
  for (const m of passive.matchAll(ADDITIONAL_RE)) {
    const key = toStatKey(m[2]);
    if (key) out.push({ stat: key, value: Number(m[1]) - 1 });
  }
  return out;
}

/**
 * Apply a pan enchant to the pan's own lines.
 *
 * An enchant only ever changes the item it sits on, never the rest of the
 * build, and the two halves of a term apply in order: multiply the line that is
 * already there, then add the points. Starstruck on a Nebula Pan is
 * 800 × 1.3 + 75 = 1,115, the familiar '+315 Luck'.
 */
export function applyEnchant(lines: GearLines, effect: string): GearLines {
  for (const term of parseEffect(effect)) {
    const current = lines.get(term.stat) ?? 0;
    const scaled = term.multiplier != null ? current * term.multiplier : current;
    lines.set(term.stat, scaled + (term.add ?? 0));
  }
  return lines;
}

/** What one equipped piece provides at a given roll quality and mutation. */
export function equipLines(
  item: Equipment,
  quality: number,
  sixStar: boolean,
  mutationId: string | null,
): GearLines {
  const t = Math.min(Math.max(quality, 1), 100) / 100;
  // A fully upgraded mutated item provides exactly its multiplier × the listed
  // values — 1.6× at Prismatic.
  const mult = (mutationId && mutationById.get(mutationId)?.multiplier) || 1;
  const lines: GearLines = new Map();
  for (const s of item.stats) {
    const key = toStatKey(s.stat);
    if (!key) continue;
    const range = sixStar ? s.sixStar : s.base;
    const value = (range.min + (range.max - range.min) * t) * mult;
    lines.set(key, (lines.get(key) ?? 0) + value);
  }
  return lines;
}

/* ---------- museum ------------------------------------------------------- */

export const riderByRarity = new Map(
  museum.modifierMultipliers.map((m) => [m.rarity as RarityName, m.value]),
);
export const museumModifierByName = new Map(museum.modifiers.map((m) => [m.name, m]));

/** Museum modifiers that actually carry a stat rider, best first. */
export const RIDER_MODIFIERS = museum.modifiers.filter((m) => m.stats.length > 0);

/**
 * What one filled display adds to the boost pile.
 *
 * A display contributes twice: the ore's own fixed boost, plus a rider from the
 * modifier the displayed ore carries. Riders scale with the display's rarity
 * row, from 0.005 at Common to 0.08 at Exotic, and Treasured gives twice the
 * Luck that Iridescent does.
 */
export function displayBoosts(
  oreId: string | null | undefined,
  rarity: RarityName,
  modifier: string | null,
): { stat: StatKey; value: number; rider: boolean }[] {
  const out: { stat: StatKey; value: number; rider: boolean }[] = [];
  const ore = oreId ? museumOreById.get(oreId) : null;
  if (!ore) return out;

  for (const b of ore.boosts) {
    const key = toStatKey(b.stat);
    if (key) out.push({ stat: key, value: b.value, rider: false });
  }

  const mod = modifier ? museumModifierByName.get(modifier) : null;
  const rider = riderByRarity.get(rarity) ?? 0;
  if (mod && rider) {
    for (const statName of mod.stats) {
      const key = toStatKey(statName);
      if (!key) continue;
      const doubled = mod.name === 'Treasured' && key === 'Luck' ? 2 : 1;
      out.push({ stat: key, value: rider * doubled, rider: true });
    }
  }
  return out;
}
