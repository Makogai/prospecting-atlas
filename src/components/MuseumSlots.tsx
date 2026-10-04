import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  boostLabel, mineralById, museum, scoreFor, type MuseumOre, type RarityName,
} from '../lib/db';
import { RarityTag, Sprite, cx } from './ui';

/**
 * The museum's 18 displays, as pieces both planners share.
 *
 * The museum page fills them for one goal at a time; the build planner folds
 * the same displays into a whole build's stat panel. They are the same control
 * either way, so it lives here rather than being rebuilt twice with the chance
 * of the two drifting apart.
 */

export function Pedestal({
  ore, stats, locked, onPick, onClear,
}: {
  ore: MuseumOre | null | undefined;
  stats: string[];
  locked: boolean;
  onPick: () => void;
  onClear: () => void;
}) {
  // Across everything being optimised for, so a pedestal reads the same way the
  // planner ranked it.
  const value = scoreFor(ore, stats);
  const label = stats.join(' + ');

  if (!ore) {
    return (
      <button
        onClick={onPick}
        className="flex h-[4.5rem] items-center justify-center rounded-xl border border-dashed border-white/12 text-xs font-semibold text-ink-500 transition hover:border-ore-400/40 hover:text-ore-400"
      >
        {locked ? 'Empty — needs unlocking' : 'Empty'}
      </button>
    );
  }

  const mineral = mineralById.get(ore.id);
  return (
    <div className="group relative flex h-[4.5rem] items-center gap-2.5 rounded-xl bg-white/5 px-2.5 ring-1 ring-white/10">
      <button onClick={onPick} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <Sprite file={mineral?.image} alt="" className="h-10 w-10 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{ore.name}</span>
          <span
            className={cx(
              'numeric block text-xs font-semibold',
              value > 0 ? 'text-vein-400' : value < 0 ? 'text-red-400' : 'text-ink-500',
            )}
          >
            {value !== 0 ? `${boostLabel(value)} ${label}` : `no ${label}`}
          </span>
          {ore.minWeight != null && (
            <span className="numeric block text-[10px] text-ink-500">{ore.minWeight}kg needed</span>
          )}
        </span>
      </button>
      <button
        onClick={onClear}
        aria-label={`Remove ${ore.name}`}
        className="absolute top-1 right-1 rounded px-1.5 text-xs text-ink-500 opacity-0 transition group-hover:opacity-100 hover:text-red-400 focus:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}

export function OreRow({ ore, stats }: { ore: MuseumOre; stats: string[] }) {
  const mineral = mineralById.get(ore.id);
  const value = scoreFor(ore, stats);
  // What it does outside the selection, so a hidden debuff is never a surprise.
  const others = ore.boosts.filter((b) => !stats.includes(b.stat));
  // Log scaling isn't needed here — boosts run 0.04× to 1.2×, a 30× spread.
  const width = Math.min(Math.abs(value) / 1.2, 1) * 100;

  return (
    <Link
      to={`/minerals/${ore.id}`}
      className="flex items-center gap-4 px-4 py-3 transition hover:bg-white/4"
    >
      <Sprite file={mineral?.image} alt="" className="h-11 w-11 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-bold">{ore.name}</span>
          <RarityTag rarity={ore.rarity} />
          {others.length > 0 && (
            <span className="numeric text-[11px] text-ink-500">
              also {others.map((b) => `${boostLabel(b.value)} ${b.stat}`).join(', ')}
            </span>
          )}
        </div>
        <div className="mt-1.5 h-1.5 max-w-sm overflow-hidden rounded-full bg-white/7">
          <div
            className={cx('h-full rounded-full', value < 0 ? 'bg-red-500/70' : 'bg-vein-500')}
            style={{ width: `${width}%` }}
          />
        </div>
      </div>
      <div className="w-24 shrink-0 text-right">
        <div
          className={cx(
            'numeric text-sm font-bold',
            value > 0 ? 'text-vein-400' : 'text-red-400',
          )}
        >
          {boostLabel(value)}
        </div>
        <div className="numeric text-[11px] text-ink-500">
          {ore.minWeight != null ? `${ore.minWeight}kg` : '—'}
        </div>
      </div>
    </Link>
  );
}

/** Full-screen ore chooser for one display, ranked by the stat you picked. */
export function OrePicker({
  rarity, stats, chosen, onClose, onChoose,
}: {
  rarity: RarityName;
  stats: string[];
  /** Ores already sitting in another display, so they can't be double-placed. */
  chosen: string[];
  onClose: () => void;
  onChoose: (ore: MuseumOre) => void;
}) {
  const [q, setQ] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const options = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return museum.ores
      .filter((o) => o.rarity === rarity && (!needle || o.name.toLowerCase().includes(needle)))
      .sort((a, b) => scoreFor(b, stats) - scoreFor(a, stats) || a.name.localeCompare(b.name));
  }, [rarity, stats, q]);

  // Portalled for the same reason as the dock: `animate-rise` on the page root
  // leaves a transform behind, which would make `inset-0` cover the document
  // rather than the viewport and strand this above the fold.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-rock-950/80 p-4 pt-[10vh] backdrop-blur-sm">
      {/* Click-away layer sits behind the dialog, not over it. */}
      <button aria-label="Close" onClick={onClose} className="fixed inset-0 cursor-default" />
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-rock-900 shadow-2xl">
        <div className="border-b border-white/8 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-extrabold">
              {/* Epic, Uncommon and Exotic all need "an". */}
              <span className="text-ink-400">
                Fill a{/^[AEIOU]/.test(rarity) ? 'n' : ''}
              </span>{' '}
              {rarity} <span className="text-ink-400">display</span>
            </h2>
            <span className="text-[11px] text-ink-500">ranked by {stats.join(' + ')}</span>
          </div>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${rarity} ores…`}
            className="mt-3 w-full rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-sm outline-none transition focus:border-ore-400/50 focus:bg-white/7"
          />
        </div>
        <div className="max-h-[50vh] divide-y divide-white/6 overflow-y-auto">
          {options.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-ink-500">No {rarity} ore matches.</p>
          )}
          {options.map((ore) => {
            const value = scoreFor(ore, stats);
            const taken = chosen.includes(ore.id);
            return (
              <button
                key={ore.id}
                onClick={() => onChoose(ore)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/5"
              >
                <Sprite file={mineralById.get(ore.id)?.image} alt="" className="h-9 w-9 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">
                    {ore.name}
                    {taken && (
                      <span className="ml-2 rounded bg-white/8 px-1.5 text-[10px] font-semibold text-ink-400">
                        already placed
                      </span>
                    )}
                  </span>
                  <span className="numeric block text-[11px] text-ink-500">
                    {ore.boosts.map((b) => `${boostLabel(b.value)} ${b.stat}`).join(' · ')}
                    {ore.minWeight != null && ` — ${ore.minWeight}kg`}
                  </span>
                </span>
                <span
                  className={cx(
                    'numeric shrink-0 text-sm font-bold',
                    value > 0 ? 'text-vein-400' : value < 0 ? 'text-red-400' : 'text-ink-600',
                  )}
                >
                  {value !== 0 ? boostLabel(value) : '—'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
