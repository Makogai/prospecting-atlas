/**
 * A whole build: gear, equipment, museum, and every buff you have running —
 * folded into the Settings → Stats panel the game would show you.
 *
 * The maths lives in stats.ts. This file is the build itself: what you can pick,
 * what each pick is worth and which term of the Golden Rule it lands in, plus
 * the share codec and storage.
 *
 * Where a source's own wiki page and the tested stat guide disagree, the note
 * on the contribution says so rather than the site quietly picking a side.
 */
import { events, mastery, museum, type RarityName } from './db';
import { SLOT_ORDER, slotKey, type Slots } from './museumBuild';
import {
  PANEL_STATS, applyEnchant, displayBoosts, enchantById, equipLines, gearLines,
  gearPassiveBoosts, panById, parseEffect, potionById, runeById, shovelById,
  type Contribution, type GearLines, type StatKey, type StatLine,
} from './stats';
import { equipmentById } from './db';

/* ---------- what you can put in a build ---------------------------------- */

/** One worn piece: which item, how well it rolled, and its mutation. */
export interface PlannerEquip {
  id: string;
  quality: number;
  /** Mutation id, or null for an unmutated piece. */
  mutation: string | null;
}

/**
 * Boost sources the site can list but cannot read off your account.
 *
 * Everything here is from the stat guide's tested boost catalogue. The values
 * are what each one adds to the boost pile, which is the only place they go —
 * they never multiply each other.
 */
export interface BoostSource {
  id: string;
  name: string;
  /** How many you can have at once; 1 means a plain toggle. */
  max: number;
  blurb: string;
  /** Pile contributions per unit. */
  boosts: { stat: StatKey; value: number }[];
  /** Raw points per unit — the Luminant totem's speed lines are flat, not pile. */
  flats?: { stat: StatKey; value: number }[];
  note?: string;
}

export const BOOST_SOURCES: BoostSource[] = [
  {
    id: 'luck-totem', name: 'Luck Totem', max: 4,
    blurb: '2× Luck in the circle, 30 minutes, stackable for time.',
    boosts: [{ stat: 'Luck', value: 1 }],
    note: 'Two totems do not give 4×. Each adds +1.0 to one pile that multiplies once.',
  },
  {
    id: 'strength-totem', name: 'Strength Totem', max: 4,
    blurb: 'One totem, both strength stats.',
    boosts: [{ stat: 'Dig Strength', value: 1 }, { stat: 'Shake Strength', value: 1 }],
  },
  {
    id: 'luminant-totem', name: 'Luminant Totem', max: 4,
    blurb: '1.5× Capacity plus both speeds, and immunity from the dark.',
    boosts: [{ stat: 'Capacity', value: 0.5 }],
    // The catalogue is explicit that the speed halves are a base +50 each
    // rather than +0.5 into the pile, which is why they sit in Flats.
    flats: [{ stat: 'Dig Speed', value: 50 }, { stat: 'Shake Speed', value: 50 }],
    note: 'Its speed bonuses are a base +50 each, not a multiplier.',
  },
  {
    id: 'xp-cookie', name: 'XP Cookie', max: 1,
    blurb: '+1.00 to the pile of almost every stat.',
    boosts: PANEL_STATS.filter((s) => s.cookie).map((s) => ({ stat: s.key, value: 1 })),
    note: 'Not a doubling. What it is worth depends on how big that stat’s pile already is — a true 2× only on a stat with no other boosts.',
  },
  {
    id: 'gingerbread', name: 'Gingerbread Cookie', max: 1,
    blurb: '+0.5× Luck for 10 minutes.',
    boosts: [{ stat: 'Luck', value: 0.5 }],
  },
];

/** Runes that move a stat. The rest change mechanics instead. */
export interface RuneEffect {
  id: string;
  boosts?: { stat: StatKey; value: number }[];
  flats?: { stat: StatKey; value: number }[];
  /** Scales off another stat's own bonus rather than being a fixed number. */
  derived?: { from: StatKey; to: StatKey[]; per: number };
  note?: string;
}

export const RUNE_EFFECTS: RuneEffect[] = [
  { id: 'purity', boosts: [{ stat: 'Luck', value: 1 }], note: 'Modifiers can no longer be obtained at all.' },
  { id: 'sunblessed', boosts: [{ stat: 'Luck', value: 0.2 }], note: 'Only while sunlight is hitting you.' },
  { id: 'abyssal', boosts: [{ stat: 'Luck', value: 0.2 }], note: 'Needs the Abyssal Depth or night time.' },
  { id: 'solitude', boosts: [{ stat: 'Luck', value: 0.2 }], note: 'Only while truly alone — you lose 10% per player within 50 studs.' },
  { id: 'mountain-climber', flats: [{ stat: 'Walk Speed', value: 3 }] },
  { id: 'speed-i', flats: [{ stat: 'Walk Speed', value: 2 }] },
  {
    id: 'summit-seeker', derived: { from: 'Walk Speed', to: ['Dig Speed', 'Shake Speed'], per: 0.05 },
    note: 'Read as +0.05 into the pile per point of bonus Walk Speed. The wiki says “5% dig and shake speed for every +1 bonus walkspeed” without saying which 5% it means.',
  },
  {
    id: 'bunny', derived: { from: 'Jump Power', to: ['Modifier Boost'], per: 0.05 },
    note: 'Read as +0.05 into the pile per point of bonus Jump Power, the same uncertainty as Summit Seeker.',
  },
];

export const runeEffectById = new Map(RUNE_EFFECTS.map((r) => [r.id, r]));

/**
 * The two shovel enchants that move a panel stat.
 *
 * The rest change how digging behaves — Mythical duplicates finds, Mastered
 * brings auto-panning to full quality — and the three streak enchants build a
 * bonus up as you dig rather than holding one, so none of them belong in a
 * resting panel. These two are listed here instead of parsed because the wiki
 * writes them back to front ('Toughness increased by 2') and as a bare
 * multiplier ('2× chance to find treasure map'), neither of which is the shape
 * every other effect string uses.
 */
export const SHOVEL_ENCHANT_EFFECTS: Record<string, {
  flats?: { stat: StatKey; value: number }[];
  boosts?: { stat: StatKey; value: number }[];
}> = {
  'toughened-shovel': { flats: [{ stat: 'Toughness', value: 2 }] },
  'treasure-hunter-shovel': { boosts: [{ stat: 'Treasure Map Chance', value: 1 }] },
};

/**
 * Lifetime rewards that scale with a number only you know.
 *
 * This is where 'dredge bonus' and the Experience buff actually live: neither
 * is a stat on the panel, both are flat Luck that grows with your own totals.
 */
export interface Permanent {
  id: string;
  name: string;
  stat: StatKey;
  /** Points per unit of `countLabel`. */
  per: number;
  countLabel: string;
  max?: number;
  blurb: string;
}

export const PERMANENTS: Permanent[] = [
  { id: 'dredge', name: 'Dredge Master', stat: 'Luck', per: 3, countLabel: 'quests completed',
    blurb: '+3 Luck for every quest you finish for him at Fortune River. His quests never run out.' },
  { id: 'experience', name: 'Experience', stat: 'Luck', per: 5, countLabel: 'Experience points',
    blurb: '+5 Luck each. The daily login gives one on the 5th consecutive day and two on the 10th.' },
  { id: 'backpack', name: 'Traveler’s Backpack', stat: 'Inventory Size', per: 25, countLabel: 'backpacks', max: 20,
    blurb: '+25 slots each from the Traveling Merchant, up to +500.' },
  { id: 'trader', name: 'Trader’s Recommendation', stat: 'Sell Boost', per: 10, countLabel: 'Special Orders done', max: 2,
    blurb: '+10% Sell Boost each for Special Order 2 (Emerald) and 3 (Diamond).' },
  { id: 'lighthouse', name: 'Lighthouse Blessing', stat: 'Luck', per: 3, countLabel: 'claimed', max: 1,
    blurb: '+3 Luck for restoring the lighthouse at Sunset Beach.' },
  { id: 'ancient', name: 'Ancient Blessing', stat: 'Luck', per: 5, countLabel: 'claimed', max: 1,
    blurb: '+5 Luck from the figure behind the waterfall in the Crystal Caverns.' },
  { id: 'spirits', name: 'Blessing of the Spirits', stat: 'Luck', per: 50, countLabel: 'claimed', max: 1,
    blurb: '+50 Luck for finishing Spirits of the Grotto for the Druid.' },
];

/** Anything the site has no number for. You supply both the stat and the value. */
export interface CustomEntry {
  id: string;
  stat: StatKey;
  label: string;
  value: number;
  band: 'flat' | 'boost';
}

/** Location mastery tracks award Luck; the other three award their own stat. */
export const MASTERY_TRACKS = mastery.tracks
  .map((track) => {
    const top = track.tiers.filter((t) => t.tier != null).length;
    const stat: StatKey =
      track.id === 'sluice' ? 'Efficiency'
      : track.id === 'treasure-map' ? 'Treasure Map Chance'
      : 'Luck';
    return { id: track.id, name: track.tiers[0]?.name?.replace(/:\s*1$/, '') ?? track.id, stat, top };
  })
  // Crafting mastery raises the minimum roll quality of what you craft, which
  // is not a panel stat — it moves the quality slider, not the build.
  .filter((t) => t.id !== 'crafting' && t.top > 0);

/* ---------- the build ---------------------------------------------------- */

export interface PlannerState {
  pan: string | null;
  panEnchant: string | null;
  shovel: string | null;
  shovelEnchant: string | null;
  equips: PlannerEquip[];
  sixStar: boolean;
  /** Default roll quality for newly equipped pieces. */
  quality: number;
  museum: Slots;
  /** Slot key → modifier name, for the rider a displayed ore carries. */
  riders: Record<string, string>;
  /**
   * Slot key → the weight in kg of the ore actually sitting on that display.
   *
   * Absent means "at least the minimum", which is what the planner assumed
   * before this existed — every display paying its full listed boost.
   */
  weights: Record<string, number>;
  /** Boost source id → how many are running. */
  boosts: Record<string, number>;
  runes: string[];
  /** Mastery track id → tier reached. */
  mastery: Record<string, number>;
  potions: string[];
  /** Ids of luck events currently up. */
  events: string[];
  /** Players inside a Friendship Totem's circle, including you. 0 means none down. */
  friendship: number;
  /** Friends online, worth +0.10× Luck each up to five. */
  friends: number;
  /** Permanent id → how many you have claimed or completed. */
  permanents: Record<string, number>;
  custom: CustomEntry[];
}

export const DEFAULT_BUILD: PlannerState = {
  pan: null, panEnchant: null, shovel: null, shovelEnchant: null,
  equips: [], sixStar: false, quality: 100,
  museum: {}, riders: {}, weights: {},
  boosts: {}, runes: [], mastery: {}, potions: [], events: [],
  friendship: 0, friends: 0, permanents: {}, custom: [],
};

export const PLANNER_KEY = 'atlas.planner';
export const PLANNER_BUILDS_KEY = 'atlas.planner.builds';

/* ---------- the weight gate ---------------------------------------------- */

/**
 * Whether a display is paying its full listed boost.
 *
 * An ore's own boost is the minimum weight "required to achieve the max
 * bonus", so under that line it still gives something — the wiki simply never
 * says how much, and no one has measured it. We therefore show the full figure
 * and say plainly that it is a ceiling, rather than inventing a curve or
 * pretending an underweight ore is worth nothing.
 *
 * The modifier rider is a separate matter: the Museum page is explicit that
 * modifier bonuses "apply to all ores of that rarity, regardless of weight", so
 * a rider is never gated and a light ore still pays it in full.
 */
export function weightCheck(
  ore: { minWeight: number | null } | null | undefined,
  weight: number | undefined,
): { under: boolean; need: number | null; have: number | null } {
  const need = ore?.minWeight ?? null;
  const have = weight ?? null;
  return { under: need != null && have != null && have < need, need, have };
}

/** Displays whose ore is below the weight its full boost needs. */
export function underweightDisplays(state: PlannerState): {
  key: string;
  name: string;
  need: number;
  have: number;
}[] {
  const out: { key: string; name: string; need: number; have: number }[] = [];
  for (const { rarity, index } of SLOT_ORDER) {
    const key = slotKey(rarity as RarityName, index);
    const oreId = state.museum[key];
    if (!oreId) continue;
    const ore = museum.ores.find((o) => o.id === oreId);
    const { under, need, have } = weightCheck(ore, state.weights[key]);
    if (under && need != null && have != null) {
      out.push({ key, name: ore?.name ?? oreId, need, have });
    }
  }
  return out;
}

/* ---------- the calculation ---------------------------------------------- */

const blank = (): Map<StatKey, Contribution[]> => new Map();

function push(acc: Map<StatKey, Contribution[]>, stat: StatKey, c: Contribution) {
  if (c.value === 0) return;
  const list = acc.get(stat);
  if (list) list.push(c);
  else acc.set(stat, [c]);
}

/**
 * Fold a build into one line per panel stat.
 *
 * Order matters in exactly one place: the two runes that scale off another stat
 * have to see that stat's own bonus first, so they run after everything else
 * has been collected but before the pile is multiplied in.
 */
export function computeBuild(state: PlannerState): StatLine[] {
  const acc = blank();

  /* Base — pan, shovel, and everything worn. */
  const pan = state.pan ? panById.get(state.pan) : null;
  if (pan) {
    const lines: GearLines = gearLines(pan, 'pan');
    const enchant = state.panEnchant ? enchantById.get(state.panEnchant) : null;
    if (enchant) applyEnchant(lines, enchant.effect);
    for (const [stat, value] of lines) {
      push(acc, stat, {
        band: 'base', value,
        source: enchant ? `${pan.name} · ${enchant.name}` : pan.name,
      });
    }
    for (const b of gearPassiveBoosts(pan.passive)) {
      push(acc, b.stat, { band: 'boost', source: `${pan.name} passive`, value: b.value });
    }
  }

  const shovel = state.shovel ? shovelById.get(state.shovel) : null;
  if (shovel) {
    const lines = gearLines(shovel, 'shovel');
    const enchant = state.shovelEnchant ? enchantById.get(state.shovelEnchant) : null;
    const special = enchant ? SHOVEL_ENCHANT_EFFECTS[enchant.id] : undefined;
    for (const f of special?.flats ?? []) {
      lines.set(f.stat, (lines.get(f.stat) ?? 0) + f.value);
    }
    for (const [stat, value] of lines) {
      push(acc, stat, {
        band: 'base', value,
        source: enchant && special ? `${shovel.name} · ${enchant.name}` : shovel.name,
      });
    }
    for (const b of special?.boosts ?? []) {
      push(acc, b.stat, { band: 'boost', source: `${enchant!.name} enchant`, value: b.value });
    }
    for (const b of gearPassiveBoosts(shovel.passive)) {
      push(acc, b.stat, { band: 'boost', source: `${shovel.name} passive`, value: b.value });
    }
  }

  for (const entry of state.equips) {
    const item = equipmentById.get(entry.id);
    if (!item) continue;
    const mutation = entry.mutation ?? null;
    const label = mutation ? `${item.name} (${mutation.replace(/(^|-)(\w)/g, (_, a, b) => a ? ' ' + b.toUpperCase() : b.toUpperCase())})` : item.name;
    for (const [stat, value] of equipLines(item, entry.quality, state.sixStar, mutation)) {
      push(acc, stat, { band: 'base', source: label, value, note: `rolled ${entry.quality}%` });
    }
  }

  /* Boosts — the pile. */
  for (const { rarity, index } of SLOT_ORDER) {
    const key = slotKey(rarity as RarityName, index);
    const oreId = state.museum[key];
    if (!oreId) continue;
    const ore = museum.ores.find((o) => o.id === oreId);
    const gate = weightCheck(ore, state.weights[key]);
    for (const b of displayBoosts(oreId, rarity as RarityName, state.riders[key] ?? null)) {
      push(acc, b.stat, {
        band: 'boost',
        source: b.rider
          ? `Museum · ${state.riders[key]} rider (${rarity})`
          : `Museum · ${ore?.name ?? oreId}`,
        value: b.value,
        note: b.rider
          // Riders ignore the weight gate entirely, which is worth saying on a
          // display whose ore is under it: the rider half still pays in full.
          ? gate.under ? 'Riders apply at any weight, so this half is unaffected.' : undefined
          : gate.under
            ? `Your ${gate.have}kg is under the ${gate.need}kg this ore needs for its full boost, so this is a ceiling — the wiki does not publish how much it loses below the line.`
            : gate.need != null
              ? `${gate.have != null ? `${gate.have}kg` : 'assumed'} — needs ${gate.need}kg`
              : undefined,
      });
    }
  }

  // The Nebula Pan and the Starcrusher each amplify what a totem is worth. The
  // Starcrusher's tooltip says +25%; the pan's only says 'Increased', but the
  // stat guide's worked example resolves a Strength Totem to +1.50 on a build
  // carrying both, which is 1.0 × (1 + 0.25 + 0.25). Carrying one gives +1.25.
  const amp = 1 + 0.25 * ((pan?.id === 'nebula-pan' ? 1 : 0) + (shovel?.id === 'starcrusher' ? 1 : 0));
  const ampNote = amp > 1
    ? `Totem value raised ${Math.round((amp - 1) * 100)}% by your ${[
      pan?.id === 'nebula-pan' && 'Nebula Pan', shovel?.id === 'starcrusher' && 'Starcrusher',
    ].filter(Boolean).join(' and ')}.`
    : undefined;

  for (const source of BOOST_SOURCES) {
    const count = state.boosts[source.id] ?? 0;
    if (count <= 0) continue;
    const totem = source.id.endsWith('-totem');
    const scale = totem ? amp : 1;
    const label = count > 1 ? `${source.name} ×${count}` : source.name;
    const note = [source.note, totem ? ampNote : undefined].filter(Boolean).join(' ') || undefined;
    for (const b of source.boosts) {
      push(acc, b.stat, { band: 'boost', source: label, value: b.value * count * scale, note });
    }
    for (const f of source.flats ?? []) {
      push(acc, f.stat, { band: 'flat', source: label, value: f.value * count * scale, note });
    }
  }

  if (state.friendship > 0) {
    // The catalogue gives +0.4× alone, rising +0.2× for each extra player.
    const value = 0.4 + 0.2 * (state.friendship - 1);
    push(acc, 'Luck', {
      band: 'boost', value,
      source: `Friendship Totem · ${state.friendship} in the circle`,
      note: 'The catalogue also quotes +5.2× at 20 players, which this per-player rule does not reach. We follow the per-player rule.',
    });
  }
  if (state.friends > 0) {
    push(acc, 'Luck', {
      band: 'boost', value: Math.min(state.friends, 5) * 0.1,
      source: `${Math.min(state.friends, 5)} friends online`,
      note: state.friends > 5 ? 'Capped at +0.50× — five friends.' : undefined,
    });
  }

  for (const track of MASTERY_TRACKS) {
    const tier = state.mastery[track.id] ?? 0;
    if (tier <= 0) continue;
    push(acc, track.stat, {
      band: 'boost', value: 0.05 * tier,
      source: `${track.name} ${tier}`,
      note: track.stat === 'Luck' ? 'Only in that region.' : undefined,
    });
  }

  for (const id of state.runes) {
    const effect = runeEffectById.get(id);
    const rune = runeById.get(id);
    if (!effect || !rune) continue;
    for (const b of effect.boosts ?? []) {
      push(acc, b.stat, { band: 'boost', source: `${rune.name} rune`, value: b.value, note: effect.note });
    }
    for (const f of effect.flats ?? []) {
      push(acc, f.stat, { band: 'flat', source: `${rune.name} rune`, value: f.value, note: effect.note });
    }
  }

  /* Flats — potions and lifetime rewards. */
  for (const id of state.potions) {
    const potion = potionById.get(id);
    if (!potion) continue;
    for (const term of parseEffect(potion.effect)) {
      if (term.add == null) continue;
      push(acc, term.stat, { band: 'flat', source: potion.name, value: term.add, note: potion.duration ? `lasts ${potion.duration}` : undefined });
    }
  }

  for (const perm of PERMANENTS) {
    const count = state.permanents[perm.id] ?? 0;
    if (count <= 0) continue;
    const capped = perm.max ? Math.min(count, perm.max) : count;
    push(acc, perm.stat, {
      band: 'flat', value: perm.per * capped,
      source: perm.max === 1 ? perm.name : `${perm.name} · ${capped} ${perm.countLabel}`,
    });
  }

  for (const entry of state.custom) {
    if (!entry.value) continue;
    push(acc, entry.stat, {
      band: entry.band, value: entry.band === 'boost' ? entry.value / 100 : entry.value,
      source: entry.label.trim() || 'Your own entry',
      note: 'Yours — the site has no number for this.',
    });
  }

  /* Derived runes see the stats everything else produced. */
  for (const id of state.runes) {
    const effect = runeEffectById.get(id);
    const rune = runeById.get(id);
    if (!effect?.derived || !rune) continue;
    const list = acc.get(effect.derived.from) ?? [];
    const bonus = list
      .filter((c) => c.band === 'base' || c.band === 'flat')
      .reduce((t, c) => t + c.value, 0);
    if (bonus <= 0) continue;
    for (const target of effect.derived.to) {
      push(acc, target, {
        band: 'boost', value: bonus * effect.derived.per,
        source: `${rune.name} rune`,
        note: `From ${bonus.toFixed(0)} bonus ${effect.derived.from}. ${effect.note ?? ''}`.trim(),
      });
    }
  }

  /* Events — the one true multiplier, and only on Luck. */
  for (const id of state.events) {
    const event = events.find((e) => e.id === id);
    if (!event || event.value == null) continue;
    if (event.kind === 'multiplicative') {
      push(acc, 'Luck', { band: 'event', source: event.name, value: event.value });
    } else if (event.kind === 'additive') {
      push(acc, 'Luck', { band: 'boost', source: event.name, value: event.value });
    }
  }

  /* Fold. */
  return PANEL_STATS.map((stat) => {
    const contributions = acc.get(stat.key) ?? [];
    let base = 0, flats = 0, boosts = 0, eventMult = 1;
    for (const c of contributions) {
      if (c.band === 'base') base += c.value;
      else if (c.band === 'flat') flats += c.value;
      else if (c.band === 'boost') boosts += c.value;
      else eventMult *= c.value;
    }
    if (!stat.boostable) boosts = 0;
    const total = (base + flats) * (1 + boosts) * eventMult;
    return { stat, base, flats, boosts, eventMult, total, contributions };
  });
}

/** Does this build have anything in it at all? */
export const isEmptyBuild = (s: PlannerState) =>
  !s.pan && !s.shovel && s.equips.length === 0 && Object.values(s.museum).every((v) => !v)
  && s.potions.length === 0 && s.runes.length === 0 && s.events.length === 0
  && s.custom.length === 0 && Object.values(s.boosts).every((v) => !v)
  && Object.values(s.permanents).every((v) => !v) && !s.friendship && !s.friends
  && Object.values(s.mastery).every((v) => !v);

/* ---------- sharing ------------------------------------------------------ */
