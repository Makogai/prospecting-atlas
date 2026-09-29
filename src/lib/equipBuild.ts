import { SLOT_LIMITS, equipmentById, type EquipSlot } from './db';
import type { LoadoutState } from '../components/Loadout';

export const EQUIP_BUILDS_KEY = 'atlas.loadout.builds';

/**
 * A loadout as a URL-safe string: equipment ids in the order they were
 * equipped, `.`-separated.
 *
 *   `ring-of-fortune.ring-of-fortune.amulet-of-life`
 *
 * Ids rather than indexes into the equipment list, for the same reason the
 * museum uses them: indexes shift when the wiki adds an item, which would
 * silently rewrite links people had already sent.
 *
 * Duplicates are meaningful here — eight ring slots means eight of the same
 * ring is a real build — so unlike the museum this is a plain list, not a
 * positional map.
 */
export const encodeLoadout = (items: string[]) => items.join('.');

export interface DecodedLoadout {
  items: string[];
  /** Ids in the link that no longer name an item. */
  dropped: string[];
  /** True when the link asked for more of a slot than the game allows. */
  overfilled: boolean;
}

export function decodeLoadout(code: string): DecodedLoadout {
  const items: string[] = [];
  const dropped: string[] = [];
  const used = {} as Record<EquipSlot, number>;
  let overfilled = false;

  for (const raw of code.split('.')) {
    const id = raw.trim();
    if (!id) continue;
    const item = equipmentById.get(id);
    // No slot means the wiki doesn't list it as something you wear, so it can
    // never have been part of a real loadout.
    if (!item || !item.slot) {
      dropped.push(id);
      continue;
    }
    // A link can be stale or hand-edited. The game allows one necklace, one
    // charm and eight rings; anything past that gets refused rather than shown
    // as a loadout nobody could actually wear.
    const slot = item.slot;
    const at = used[slot] ?? 0;
    if (at >= (SLOT_LIMITS[slot] ?? 0)) {
      overfilled = true;
      continue;
    }
    used[slot] = at + 1;
    items.push(id);
  }

  return { items, dropped, overfilled };
}

/** Quality is a percentage; anything else in the URL is not trustworthy. */
export function decodeQuality(raw: string | null, fallback = 100): number {
  const n = Number(raw);
  if (raw == null || raw === '' || !Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.round(n), 0), 100);
}

export const isEmptyLoadout = (loadout: LoadoutState) => loadout.items.length === 0;
