import { useEffect, useState } from 'react';
import {
  SLOT_LIMITS, equipRarityColors, type Equipment, type EquipSlot,
} from '../lib/db';
import { Sprite, cx, gradientVars } from './ui';

export interface LoadoutState {
  items: string[];
  /**
   * The wiki's "percentage" quality: how close a crafted item's rolled stats sit
   * to the top of its range. Applied here as a straight interpolation between the
   * range's ends, which the wiki does not spell out — so it's a slider, not a claim.
   */
  quality: number;
}

export const DEFAULT_LOADOUT: LoadoutState = { items: [], quality: 100 };

const STORAGE_KEY = 'atlas.loadout';

export function useLoadout(): [LoadoutState, (next: LoadoutState) => void] {
  const [state, setState] = useState<LoadoutState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_LOADOUT, ...JSON.parse(raw) };
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

/** Total each stat across the equipped items at a given roll quality. */
export function loadoutTotals(
  equipped: Equipment[],
  { sixStar = false, quality = 100 } = {},
): { stat: string; value: number; unit: string | null }[] {
  const totals = new Map<string, { value: number; unit: string | null }>();
  const t = Math.min(Math.max(quality, 0), 100) / 100;

  for (const item of equipped) {
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

/**
 * Collapse repeats of the same item into one row.
 *
 * `lastIndex` is what the remove button acts on, so clicking it takes one copy
 * off the stack rather than all of them.
 */
function groupById(entries: { id: string; index: number }[]) {
  const out: { id: string; count: number; lastIndex: number }[] = [];
  for (const { id, index } of entries) {
    const hit = out.find((g) => g.id === id);
    if (hit) {
      hit.count++;
      hit.lastIndex = Math.max(hit.lastIndex, index);
    } else {
      out.push({ id, count: 1, lastIndex: index });
    }
  }
  return out;
}

export function LoadoutSummary({
  loadout, onChange, equipped, sixStar,
}: {
  loadout: LoadoutState;
  onChange: (next: LoadoutState) => void;
  equipped: Equipment[];
  sixStar: boolean;
}) {
  const totals = loadoutTotals(equipped, { sixStar, quality: loadout.quality });
  const luck = totals.find((t) => t.stat === 'Luck');

  const removeAt = (index: number) =>
    onChange({ ...loadout, items: loadout.items.filter((_, i) => i !== index) });

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
                .map((id, index) => ({ id, index }))
                .filter(({ id }) => equipped.find((e) => e.id === id)?.slot === slot);
              if (!inSlot.length) return null;
              return (
                <div key={slot}>
                  <p className="mb-1.5 text-[11px] font-semibold text-ink-500">
                    {slot} <span className="opacity-60">{inSlot.length}/{SLOT_LIMITS[slot]}</span>
                  </p>
                  <div className="space-y-1">
                    {/* Eight of the same ring is a normal build, so duplicates
                        are one row with a count rather than eight rows. */}
                    {groupById(inSlot).map(({ id, count, lastIndex }) => {
                      const item = equipped.find((e) => e.id === id)!;
                      return (
                        <div
                          key={id}
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
                          {count > 1 && (
                            <span className="numeric shrink-0 rounded bg-ore-400/15 px-1.5 text-[10px] font-black text-ore-300">
                              ×{count}
                            </span>
                          )}
                          <button
                            onClick={() => removeAt(lastIndex)}
                            aria-label={count > 1 ? `Remove one ${item.name}` : `Remove ${item.name}`}
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
                  Roll quality
                </label>
                <span className="numeric text-[11px] text-ink-500">{loadout.quality}%</span>
              </div>
              <input
                id="quality"
                type="range"
                min={1}
                max={100}
                value={loadout.quality}
                onChange={(e) => onChange({ ...loadout, quality: Number(e.target.value) })}
                className="w-full accent-vein-500"
              />
              <p className="mt-1.5 text-[11px] text-ink-500">
                The reforge percentage. Interpolated across each stat’s range — the wiki gives the
                ranges and the percentage but not exactly how they combine.
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
