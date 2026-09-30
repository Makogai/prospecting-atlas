import { useEffect, useState } from 'react';
import {
  SLOT_LIMITS, equipRarityColors, type Equipment, type EquipSlot,
} from '../lib/db';
import { Sprite, cx, gradientVars } from './ui';

/**
 * One equipped piece, with the quality *it* rolled at.
 *
 * Quality belongs to the instance, not the loadout: two of the same ring are
 * two different drops, and the one you got at 95% is not the one you got at
 * 60%. A single figure across everything would flatter or punish the whole
 * build on the strength of one item.
 */
export interface LoadoutItem {
  id: string;
  /**
   * The wiki's "percentage" quality: how close a crafted item's rolled stats sit
   * to the top of its range. Applied as a straight interpolation between the
   * range's ends, which the wiki does not spell out — so it's an input, not a claim.
   */
  quality: number;
}

export interface LoadoutState {
  items: LoadoutItem[];
  /** Applied to the next thing equipped, and by the "set every item" control. */
  quality: number;
}

export const DEFAULT_LOADOUT: LoadoutState = { items: [], quality: 100 };

const STORAGE_KEY = 'atlas.loadout';

export const clampQuality = (n: number) => Math.min(Math.max(Math.round(n), 1), 100);

/** Loadouts saved before quality was per-item stored plain ids. */
function migrate(raw: unknown): LoadoutState {
  const state = { ...DEFAULT_LOADOUT, ...(raw as Partial<LoadoutState>) };
  const quality = clampQuality(Number(state.quality) || 100);
  const items = ((state.items as unknown[]) ?? []).map((entry) =>
    typeof entry === 'string'
      ? { id: entry, quality }
      : { id: String((entry as LoadoutItem).id), quality: clampQuality(Number((entry as LoadoutItem).quality) || quality) },
  );
  return { items, quality };
}

export function useLoadout(): [LoadoutState, (next: LoadoutState) => void] {
  const [state, setState] = useState<LoadoutState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return migrate(JSON.parse(raw));
    } catch {
      /* blocked storage — defaults are fine */
    }
    return DEFAULT_LOADOUT;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* not worth surfacing */
    }
  }, [state]);

  return [state, setState];
}

/**
 * Total each stat across the equipped pieces, each at its own roll quality.
 *
 * Takes the placed entries rather than a list of items, because the same item
 * can appear twice at two different qualities and the two have to be summed
 * separately.
 */
export function loadoutTotals(
  placed: { item: Equipment; quality: number }[],
  { sixStar = false } = {},
): { stat: string; value: number; unit: string | null }[] {
  const totals = new Map<string, { value: number; unit: string | null }>();

  for (const { item, quality } of placed) {
    const t = clampQuality(quality) / 100;
    for (const s of item.stats) {
      const range = sixStar ? s.sixStar : s.base;
      const value = range.min + (range.max - range.min) * t;
      const prev = totals.get(s.stat);
      totals.set(s.stat, {
        value: (prev?.value ?? 0) + value,
        unit: range.unit ?? prev?.unit ?? null,
      });
    }
  }

  return [...totals.entries()]
    .map(([stat, v]) => ({ stat, ...v }))
    .sort((a, b) => a.stat.localeCompare(b.stat));
}

const SLOTS: EquipSlot[] = ['Necklace', 'Charm', 'Ring'];

export function LoadoutSummary({
  loadout, onChange, equipped, sixStar,
}: {
  loadout: LoadoutState;
  onChange: (next: LoadoutState) => void;
  equipped: Equipment[];
  sixStar: boolean;
}) {
  const placed = loadout.items
    .map((entry) => {
      const item = equipped.find((e) => e.id === entry.id);
      return item ? { item, quality: entry.quality } : null;
    })
    .filter((x): x is { item: Equipment; quality: number } => x !== null);

  const totals = loadoutTotals(placed, { sixStar });
  const luck = totals.find((t) => t.stat === 'Luck');

  const removeAt = (index: number) =>
    onChange({ ...loadout, items: loadout.items.filter((_, i) => i !== index) });

  const setQualityAt = (index: number, quality: number) =>
    onChange({
      ...loadout,
      items: loadout.items.map((it, i) =>
        i === index ? { ...it, quality: clampQuality(quality) } : it,
      ),
    });

  /** The header control sets every piece at once, and the default for new ones. */
  const setAll = (quality: number) =>
    onChange({
      quality: clampQuality(quality),
      items: loadout.items.map((it) => ({ ...it, quality: clampQuality(quality) })),
    });

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/8 px-5 py-4">
        <div>
          <h2 className="text-sm font-extrabold tracking-[0.1em] text-ink-400 uppercase">
            Loadout
          </h2>
          <p className="mt-0.5 text-xs text-ink-500">
            {equipped.length} equipped · 1 necklace, 1 charm, 8 rings
          </p>
        </div>
        {luck && (
          <div className="text-right">
            <div className="numeric text-2xl font-black text-vein-400">
              +{luck.value.toFixed(1)}
            </div>
            <div className="text-[11px] text-ink-500">Luck</div>
          </div>
        )}
      </div>

      <div className="space-y-4 p-5">
        {equipped.length === 0 ? (
          <p className="text-xs text-ink-500">
            Equip something and its stats total up here. Rings stack up to eight.
          </p>
        ) : (
          <>
            {SLOTS.map((slot) => {
              const inSlot = loadout.items
                .map((entry, index) => ({ ...entry, index }))
                .filter(({ id }) => equipped.find((e) => e.id === id)?.slot === slot);
              if (!inSlot.length) return null;
              return (
                <div key={slot}>
                  <p className="mb-1.5 text-[11px] font-semibold text-ink-500">
                    {slot} <span className="opacity-60">{inSlot.length}/{SLOT_LIMITS[slot]}</span>
                  </p>
                  <div className="space-y-1">
                    {/* One row per piece, not per item type: two copies of the
                        same ring can have rolled very differently. */}
                    {inSlot.map(({ id, quality, index }) => {
                      const item = equipped.find((e) => e.id === id)!;
                      return (
                        <div
                          key={index}
                          className="flex items-center gap-2 rounded-lg bg-white/5 py-1 pr-1 pl-1.5"
                        >
                          <Sprite file={item.image} alt="" className="h-7 w-7 shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span
                              className="block truncate text-xs font-semibold"
                              style={item.color ? { color: item.color } : undefined}
                            >
                              {item.name}
                            </span>
                            <span
                              className="gradient-text text-[10px] font-bold uppercase"
                              style={gradientVars(equipRarityColors(item.rarity))}
                            >
                              {item.rarity}
                            </span>
                          </span>

                          <label className="flex shrink-0 items-center gap-0.5">
                            <span className="sr-only">Roll quality for this {item.name}</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={quality}
                              onChange={(e) => {
                                const digits = e.target.value.replace(/[^0-9]/g, '');
                                if (digits !== '') setQualityAt(index, Number(digits));
                              }}
                              className="w-8 rounded bg-white/6 px-1 py-0.5 text-center text-[11px] font-bold text-ink-100 outline-none focus:bg-white/12"
                            />
                            <span className="text-[10px] text-ink-500">%</span>
                          </label>

                          <button
                            onClick={() => removeAt(index)}
                            aria-label={`Remove ${item.name}`}
                            className="shrink-0 rounded px-1.5 py-0.5 text-ink-500 transition hover:bg-white/10 hover:text-ore-400"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <label htmlFor="quality" className="text-xs font-semibold text-ink-400">
                  Set every roll to
                </label>
                <span className="numeric text-[11px] text-ink-500">{loadout.quality}%</span>
              </div>
              <input
                id="quality"
                type="range"
                min={1}
                max={100}
                value={loadout.quality}
                onChange={(e) => setAll(Number(e.target.value))}
                className="w-full accent-vein-500"
              />
              <p className="mt-1.5 text-[11px] text-ink-500">
                A shortcut — each piece keeps its own percentage above, because each one rolled
                separately. Interpolated across each stat’s range; the wiki gives the ranges and
                the percentage but not exactly how they combine.
              </p>
            </div>

            <div className="border-t border-white/6 pt-3">
              <p className="mb-2 text-[11px] font-semibold text-ink-500">
                Totals {sixStar && <span className="text-ore-400">at ★6</span>}
              </p>
              <dl className="space-y-1">
                {totals.map((t) => (
                  <div key={t.stat} className="flex items-baseline justify-between gap-3 text-xs">
                    <dt className="truncate text-ink-400">{t.stat}</dt>
                    <dd
                      className={cx(
                        'numeric font-bold',
                        t.stat === 'Luck' ? 'text-vein-400' : 'text-ink-200',
                      )}
                    >
                      +{t.value < 10 ? t.value.toFixed(2) : t.value.toFixed(1)}
                      {t.unit ?? ''}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <button
              onClick={() => onChange(DEFAULT_LOADOUT)}
              className="text-xs font-semibold text-ink-500 underline underline-offset-2 hover:text-ore-400"
            >
              Clear loadout
            </button>
          </>
        )}
      </div>
    </section>
  );
}
