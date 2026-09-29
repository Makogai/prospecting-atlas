import { useEffect, useState } from 'react';
import { panRate, sluiceRate, sluiceFillMinutes, mineralsPerCycle, duration } from '../../shared/estimate.mjs';
import { pans, sluices } from '../lib/db';
import { NumberField, cx } from './ui';

export interface GrindState {
  mode: 'pan' | 'sluice';
  capacity: number;
  /** The player's own measured seconds per pan cycle. */
  secondsPerCycle: number;
  sluiceId: string;
  /** How long a session you're planning, in hours. */
  sessionHours: number;
}

export const DEFAULT_GRIND: GrindState = {
  mode: 'pan',
  capacity: 100,
  secondsPerCycle: 15,
  sluiceId: 'gold-sluice-box',
  sessionHours: 1,
};

/** Session lengths worth offering as one tap. */
export const SESSIONS = [
  { hours: 0.5, label: '30 min' },
  { hours: 1, label: '1 h' },
  { hours: 3, label: '3 h' },
  { hours: 8, label: '8 h' },
  { hours: 24, label: '1 day' },
];

export const sessionLabel = (h: number) =>
  SESSIONS.find((s) => s.hours === h)?.label ?? `${h} h`;

const STORAGE_KEY = 'atlas.grind';

export function useGrind(): [GrindState, (next: GrindState) => void] {
  const [state, setState] = useState<GrindState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_GRIND, ...JSON.parse(raw) };
    } catch {
      /* blocked storage — defaults are fine */
    }
    return DEFAULT_GRIND;
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

/** Minerals an hour for the current setup. */
export function grindRate(g: GrindState): number {
  if (g.mode === 'sluice') {
    const s = sluices.find((x) => x.id === g.sluiceId);
    return s ? sluiceRate(s.stats.efficiency ?? 0) : 0;
  }
  return panRate(g.capacity, g.secondsPerCycle);
}

const PAN_PRESETS = [...pans]
  .filter((p) => p.stats.capacity != null)
  .sort((a, b) => (a.stats.capacity ?? 0) - (b.stats.capacity ?? 0));

const SLUICES = [...sluices]
  .filter((s) => s.stats.efficiency != null)
  .sort((a, b) => (a.stats.efficiency ?? 0) - (b.stats.efficiency ?? 0));

export function GrindPanel({
  grind, onChange,
}: {
  grind: GrindState;
  onChange: (next: GrindState) => void;
}) {
  const [showPans, setShowPans] = useState(false);
  const rate = grindRate(grind);
  const sluice = sluices.find((s) => s.id === grind.sluiceId);

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/8 px-5 py-4">
        <div>
          <h2 className="text-sm font-extrabold tracking-[0.1em] text-ink-400 uppercase">
            Your pace
          </h2>
          <p className="mt-0.5 text-xs text-ink-500">Turns odds into time.</p>
        </div>
        <div className="text-right">
          <div className="numeric text-3xl font-black text-ore-400">
            {Math.round(rate * grind.sessionHours).toLocaleString('en-US')}
          </div>
          <div className="text-[11px] text-ink-500">
            minerals in {sessionLabel(grind.sessionHours)}
            <span className="numeric block opacity-70">
              {Math.round(rate).toLocaleString('en-US')} / hour
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div>
          <p className="mb-1.5 text-xs font-semibold text-ink-400">Session length</p>
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/4 p-1">
            {SESSIONS.map((s) => (
              <button
                key={s.hours}
                onClick={() => onChange({ ...grind, sessionHours: s.hours })}
                className={cx(
                  'flex-1 rounded px-2 py-1 text-[11px] font-bold transition',
                  grind.sessionHours === s.hours
                    ? 'bg-vein-500/25 text-vein-400 ring-1 ring-vein-500/40'
                    : 'text-ink-400 hover:text-ink-100',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/4 p-1">
          {(['pan', 'sluice'] as const).map((m) => (
            <button
              key={m}
              onClick={() => onChange({ ...grind, mode: m })}
              className={cx(
                'flex-1 rounded px-3 py-1.5 text-xs font-bold capitalize transition',
                grind.mode === m ? 'bg-ore-400 text-rock-950' : 'text-ink-400 hover:text-ink-100',
              )}
            >
              {m === 'pan' ? 'Panning' : 'Sluice'}
            </button>
          ))}
        </div>

        {grind.mode === 'pan' ? (
          <>
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <label htmlFor="cap" className="text-xs font-semibold text-ink-400">
                  Pan Capacity
                </label>
                <button
                  onClick={() => setShowPans((v) => !v)}
                  className="text-[11px] font-semibold text-ink-500 underline underline-offset-2 hover:text-ore-400"
                >
                  {showPans ? 'hide' : 'use a pan'}
                </button>
              </div>
              <NumberField
                id="cap"
                min={1}
                value={grind.capacity}
                onChange={(capacity) => onChange({ ...grind, capacity })}
                className="focus:border-ore-400/50 focus:bg-white/7"
              />
              {showPans && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {PAN_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onChange({ ...grind, capacity: p.stats.capacity })}
                      title={`${p.name} — Capacity ${p.stats.capacity}`}
                      className={cx(
                        'rounded-md px-2 py-1 text-[11px] font-semibold transition',
                        grind.capacity === p.stats.capacity
                          ? 'bg-ore-400/25 text-ore-300 ring-1 ring-ore-400/40'
                          : 'bg-white/5 text-ink-400 hover:bg-white/10 hover:text-ink-100',
                      )}
                    >
                      {p.name.replace(/ Pan$/, '')}{' '}
                      <span className="numeric opacity-60">{p.stats.capacity}</span>
                    </button>
                  ))}
                </div>
              )}
              <p className="numeric mt-1.5 text-[11px] text-ink-500">
                {mineralsPerCycle(grind.capacity).toFixed(1)} minerals per cycle — the wiki gives
                this as √capacity.
              </p>
            </div>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <label htmlFor="cyc" className="text-xs font-semibold text-ink-400">
                  Seconds per pan cycle
                </label>
                <span className="numeric text-[11px] text-ink-500">{grind.secondsPerCycle}s</span>
              </div>
              <input
                id="cyc"
                type="range"
                min={3}
                max={60}
                value={grind.secondsPerCycle}
                onChange={(e) => onChange({ ...grind, secondsPerCycle: Number(e.target.value) })}
                className="w-full accent-ore-400"
              />
              <p className="mt-1.5 text-[11px] text-ink-500">
                Your number, not the game’s — the wiki doesn’t publish cycle timings, so time a few
                digs and set it here.
              </p>
            </div>
          </>
        ) : (
          <div>
            <label htmlFor="sluice" className="mb-1.5 block text-xs font-semibold text-ink-400">
              Sluice
            </label>
            <select
              id="sluice"
              value={grind.sluiceId}
              onChange={(e) => onChange({ ...grind, sluiceId: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-rock-850 px-3 py-2 text-sm outline-none focus:border-ore-400/50"
            >
              {SLUICES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.stats.efficiency}/10min
                </option>
              ))}
            </select>
            {sluice && (
              <p className="numeric mt-1.5 text-[11px] text-ink-500">
                Fills its {sluice.stats.capacity} slots in{' '}
                {duration(sluiceFillMinutes(sluice.stats.capacity, sluice.stats.efficiency) / 60)} —
                empty it before then or it stops collecting.
              </p>
            )}
            <p className="mt-2 text-[11px] text-ink-500">
              Exact: the wiki states Efficiency as minerals per 10 minutes, so this needs no
              guesswork.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
