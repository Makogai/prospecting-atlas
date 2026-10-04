/**
 * A whole build as a URL.
 *
 * Each part of the build gets its own query parameter rather than one opaque
 * blob, for the same reason the museum and equipment planners use ids and not
 * indexes: a link somebody shared has to keep meaning what it meant. A readable
 * link can be repaired by hand when the wiki renames something, and a parameter
 * that stops making sense can be dropped without taking the rest of the build
 * with it. Every decode is lenient — an unknown id is skipped, never guessed.
 *
 *   /planner?p=nebula-pan&pe=starstruck&eq=excalibur-charm~95*prismatic&mu=...
 */
import { equipmentById, events, potions, SLOT_LIMITS, type EquipSlot } from './db';
import { decodeBuild, encodeBuild, SLOT_ORDER, slotKey } from './museumBuild';
import { museumModifierByName, panById, runeById, shovelById, statByKey, enchantById } from './stats';
import type { StatKey } from './stats';
import {
  BOOST_SOURCES, DEFAULT_BUILD, MASTERY_TRACKS, PERMANENTS, runeEffectById,
  type CustomEntry, type PlannerEquip, type PlannerState,
} from './planner';
import { mutationById } from './stats';

const clampPct = (n: number, lo = 1, hi = 100) =>
  Math.min(Math.max(Math.round(n), lo), hi);

const num = (raw: string | null, fallback = 0) => {
  const n = Number(raw);
  return raw != null && raw !== '' && Number.isFinite(n) ? n : fallback;
};

/** `id:count` pairs, dropping anything that isn't a key we know. */
const encodeCounts = (counts: Record<string, number>, known: Set<string>) =>
  Object.entries(counts)
    .filter(([id, n]) => known.has(id) && n > 0)
    .map(([id, n]) => `${id}:${n}`)
    .join('.');

function decodeCounts(raw: string | null, known: Set<string>, max: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const field of (raw ?? '').split('.')) {
    const [id, count] = field.split(':');
    if (!known.has(id)) continue;
    const n = Math.round(num(count, 0));
    if (n > 0) out[id] = Math.min(n, max);
  }
  return out;
}

const encodeIds = (ids: string[], known: (id: string) => boolean) =>
  ids.filter(known).join('.');

const decodeIds = (raw: string | null, known: (id: string) => boolean, limit: number) => {
  const seen = new Set<string>();
  for (const id of (raw ?? '').split('.')) {
    if (id && known(id) && !seen.has(id)) seen.add(id);
    if (seen.size >= limit) break;
  }
  return [...seen];
};

/**
 * Worn pieces as `id~quality*mutation`, quality omitted when it matches the
 * build default and the mutation omitted when there isn't one. Duplicates are
 * meaningful — eight of the same ring is a real build and each copy rolled
 * separately — so this is a list, not a map.
 */
function encodeEquips(equips: PlannerEquip[], defaultQuality: number) {
  return equips
    .map((e) => {
      const quality = e.quality === defaultQuality ? '' : `~${e.quality}`;
      return `${e.id}${quality}${e.mutation ? `*${e.mutation}` : ''}`;
    })
    .join('.');
}

export interface DecodedEquips {
  equips: PlannerEquip[];
  /** Ids in the link that no longer name a wearable item. */
  dropped: string[];
  /** The link asked for more of a slot than the game allows. */
  overfilled: boolean;
}

function decodeEquips(raw: string | null, defaultQuality: number): DecodedEquips {
  const equips: PlannerEquip[] = [];
  const dropped: string[] = [];
  const used = {} as Record<EquipSlot, number>;
  let overfilled = false;

  for (const field of (raw ?? '').split('.')) {
    if (!field.trim()) continue;
    const [head, mutationId] = field.split('*');
    const [id, qualityText] = head.split('~');
    const item = equipmentById.get(id);
    // No slot means the wiki doesn't list it as something you wear, so it was
    // never part of a loadout anybody could have.
    if (!item || !item.slot) {
      if (id) dropped.push(id);
      continue;
    }
    const at = used[item.slot] ?? 0;
    if (at >= (SLOT_LIMITS[item.slot] ?? 0)) {
      overfilled = true;
      continue;
    }
    used[item.slot] = at + 1;
    equips.push({
      id,
      quality: qualityText ? clampPct(num(qualityText, defaultQuality)) : defaultQuality,
      mutation: mutationId && mutationById.has(mutationId) ? mutationId : null,
    });
  }
  return { equips, dropped, overfilled };
}

/** Riders as `slotIndex:Modifier`, positional against the fixed display order. */
function encodeRiders(riders: Record<string, string>) {
  return SLOT_ORDER.map(({ rarity, index }, at) => {
    const name = riders[slotKey(rarity, index)];
    return name && museumModifierByName.has(name) ? `${at}:${name}` : null;
  })
    .filter(Boolean)
    .join('.');
}

/** Weights as `slotIndex:kg`, positional against the same display order. */
function encodeWeights(weights: Record<string, number>) {
  return SLOT_ORDER.map(({ rarity, index }, at) => {
    const kg = weights[slotKey(rarity, index)];
    return kg != null && kg > 0 ? `${at}:${Math.round(kg)}` : null;
  })
    .filter(Boolean)
    .join('.');
}

function decodeWeights(raw: string | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const field of (raw ?? '').split('.')) {
    const [at, kg] = field.split(':');
    const slot = SLOT_ORDER[Number(at)];
    const n = Math.round(num(kg, 0));
    // No upper bound worth enforcing: Size Boost puts ore weights into the
    // thousands, and a figure the game can produce is a figure a link can hold.
    if (slot && n > 0) out[slotKey(slot.rarity, slot.index)] = n;
  }
  return out;
}

function decodeRiders(raw: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of (raw ?? '').split('.')) {
    const at = field.indexOf(':');
    if (at < 0) continue;
    const slot = SLOT_ORDER[Number(field.slice(0, at))];
    const name = field.slice(at + 1);
    if (slot && museumModifierByName.has(name)) out[slotKey(slot.rarity, slot.index)] = name;
  }
  return out;
}

/**
 * Your own entries as `stat~band~value~label`, separated by `!`.
 *
 * The label is whatever someone typed, so it is the one field that can hold a
 * separator. It goes last and keeps everything after the third `~`, which means
 * no escaping and no way for a stray character to shift the other fields.
 */
function encodeCustom(custom: CustomEntry[]) {
  return custom
    .filter((c) => c.value && statByKey.has(c.stat))
    .map((c) => `${c.stat}~${c.band}~${c.value}~${c.label.replace(/[!]/g, ' ')}`)
    .join('!');
}

function decodeCustom(raw: string | null): CustomEntry[] {
  const out: CustomEntry[] = [];
  for (const field of (raw ?? '').split('!')) {
    if (!field.trim()) continue;
    const parts = field.split('~');
    if (parts.length < 3) continue;
    const stat = parts[0] as StatKey;
    if (!statByKey.has(stat)) continue;
    const band = parts[1] === 'boost' ? 'boost' : 'flat';
    const value = num(parts[2], 0);
    if (!value) continue;
    out.push({
      id: `c${out.length}-${stat}`,
      stat, band, value,
      label: parts.slice(3).join('~').slice(0, 40),
    });
  }
  return out;
}

export function encodePlanner(state: PlannerState): URLSearchParams {
  const q = new URLSearchParams();
  const set = (key: string, value: string | null | undefined) => {
    if (value) q.set(key, value);
  };

  if (state.pan && panById.has(state.pan)) {
    set('p', state.pan);
    if (state.panEnchant && enchantById.has(state.panEnchant)) set('pe', state.panEnchant);
  }
  if (state.shovel && shovelById.has(state.shovel)) {
    set('s', state.shovel);
    if (state.shovelEnchant && enchantById.has(state.shovelEnchant)) set('se', state.shovelEnchant);
  }

  set('eq', encodeEquips(state.equips, state.quality));
  if (state.quality !== DEFAULT_BUILD.quality) set('q', String(state.quality));
  if (state.sixStar) set('six', '1');

  set('mu', encodeBuild(state.museum));
  set('rd', encodeRiders(state.riders));
  set('wt', encodeWeights(state.weights));

  set('bo', encodeCounts(state.boosts, new Set(BOOST_SOURCES.map((b) => b.id))));
  set('ru', encodeIds(state.runes, (id) => runeEffectById.has(id)));
  set('ma', encodeCounts(state.mastery, new Set(MASTERY_TRACKS.map((t) => t.id))));
  set('po', encodeIds(state.potions, (id) => potions.some((p) => p.id === id)));
  set('ev', encodeIds(state.events, (id) => events.some((e) => e.id === id)));
  set('pm', encodeCounts(state.permanents, new Set(PERMANENTS.map((p) => p.id))));
  if (state.friendship > 0) set('ft', String(state.friendship));
  if (state.friends > 0) set('fo', String(state.friends));
  set('cu', encodeCustom(state.custom));

  return q;
}

export interface DecodedPlanner {
  state: PlannerState;
  /** Ids the link named that no longer exist. Shown, not swallowed. */
  dropped: string[];
  overfilled: boolean;
}

export function decodePlanner(q: URLSearchParams): DecodedPlanner {
  const quality = clampPct(num(q.get('q'), DEFAULT_BUILD.quality));
  const { equips, dropped: equipDropped, overfilled } = decodeEquips(q.get('eq'), quality);
  const { slots, dropped: museumDropped } = decodeBuild(q.get('mu') ?? '');

  const panId = q.get('p');
  const shovelId = q.get('s');
  const panEnchantId = q.get('pe');
  const shovelEnchantId = q.get('se');

  const maxRuneSlots = 5;

  return {
    state: {
      pan: panId && panById.has(panId) ? panId : null,
      panEnchant: panEnchantId && enchantById.get(panEnchantId)?.slot === 'Pan' ? panEnchantId : null,
      shovel: shovelId && shovelById.has(shovelId) ? shovelId : null,
      shovelEnchant:
        shovelEnchantId && enchantById.get(shovelEnchantId)?.slot === 'Shovel' ? shovelEnchantId : null,
      equips,
      sixStar: q.get('six') === '1',
      quality,
      museum: slots,
      riders: decodeRiders(q.get('rd')),
      weights: decodeWeights(q.get('wt')),
      boosts: decodeCounts(q.get('bo'), new Set(BOOST_SOURCES.map((b) => b.id)), 9),
      runes: decodeIds(q.get('ru'), (id) => runeEffectById.has(id) && runeById.has(id), maxRuneSlots),
      mastery: decodeCounts(q.get('ma'), new Set(MASTERY_TRACKS.map((t) => t.id)), 5),
      potions: decodeIds(q.get('po'), (id) => potions.some((p) => p.id === id), potions.length),
      events: decodeIds(q.get('ev'), (id) => events.some((e) => e.id === id), events.length),
      friendship: Math.min(Math.max(Math.round(num(q.get('ft'), 0)), 0), 20),
      friends: Math.min(Math.max(Math.round(num(q.get('fo'), 0)), 0), 5),
      permanents: decodeCounts(q.get('pm'), new Set(PERMANENTS.map((p) => p.id)), 1_000_000),
      custom: decodeCustom(q.get('cu')),
    },
    dropped: [...equipDropped, ...museumDropped],
    overfilled,
  };
}

/** The build as a share code — the query string without the leading `?`. */
export const plannerCode = (state: PlannerState) => encodePlanner(state).toString();

export const plannerFromCode = (code: string) => decodePlanner(new URLSearchParams(code));
