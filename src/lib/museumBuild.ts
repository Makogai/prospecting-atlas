import { museum, museumOreById } from './db';
import type { RarityName } from './db';

/** `Legendary:2` — a display's rarity and its index within that rarity. */
export type Slots = Record<string, string | null>;

export const slotKey = (rarity: RarityName, i: number) => `${rarity}:${i}`;

/**
 * Every display in a fixed order, so a build can be written as a positional
 * list rather than as keys. Derived from the display table, so if the game ever
 * adds a display the order extends at the natural place.
 */
export const SLOT_ORDER: { rarity: RarityName; index: number }[] = museum.displays.flatMap((d) =>
  Array.from({ length: d.total }, (_, index) => ({ rarity: d.rarity, index })),
);

/**
 * A build as a URL-safe string: ore ids in slot order, `.`-separated, with an
 * empty field for an empty display.
 *
 *   `peridot..emerald...diamond..flarebloom.chrysoberyl.key-of-life`
 *
 * Ore ids rather than indexes into the ore list, deliberately. Indexes would be
 * far shorter but they shift the moment the wiki adds a mineral, which would
 * silently rewrite every link people had already shared. Ids are stable, and a
 * dropped one is detectable — `decodeBuild` reports it instead of guessing.
 *
 * `.` is safe unencoded in a query value and never appears in a slug.
 */
export function encodeBuild(slots: Slots): string {
  const fields = SLOT_ORDER.map(({ rarity, index }) => slots[slotKey(rarity, index)] ?? '');
  // Trailing empties carry no information; most builds leave the tail unfilled.
  while (fields.length > 0 && fields.at(-1) === '') fields.pop();
  return fields.join('.');
}

export interface DecodedBuild {
  slots: Slots;
  /** Ids in the link that no longer name an ore, or that changed rarity. */
  dropped: string[];
}

export function decodeBuild(code: string): DecodedBuild {
  const fields = code.split('.');
  const slots: Slots = {};
  const dropped: string[] = [];

  SLOT_ORDER.forEach(({ rarity, index }, at) => {
    const id = (fields[at] ?? '').trim();
    if (!id) return;
    const ore = museumOreById.get(id);
    // A link can be stale or hand-edited. A display only accepts its own
    // rarity, so an ore that doesn't match this slot was never placeable and is
    // dropped rather than shown somewhere the game wouldn't allow it.
    if (!ore || ore.rarity !== rarity) {
      dropped.push(id);
      return;
    }
    slots[slotKey(rarity, index)] = id;
  });

  return { slots, dropped };
}

export const isEmptyBuild = (slots: Slots) => Object.values(slots).every((v) => !v);

/** Where this planner's saved builds live. */
export const MUSEUM_BUILDS_KEY = 'atlas.museum.builds';
