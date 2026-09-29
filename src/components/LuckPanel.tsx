import { useEffect, useMemo, useState } from 'react';
import {
  effectiveLuck, appliesAt, MANUAL_BOOSTS, MAX_FRIENDS,
} from '../../shared/luck.mjs';
import { pans, events, equipmentById, type LuckEvent } from '../lib/db';
import { useLoadout, loadoutTotals } from './Loadout';
import { cx } from './ui';

export interface LuckState {
  base: number;
  /** Ids of active manual boosts and events. */
  boosts: string[];
  friends: number;
}

export const DEFAULT_LUCK: LuckState = { base: 1, boosts: [], friends: 0 };

const STORAGE_KEY = 'atlas.luck.v2';

/** Remembers the player's setup between visits; falls back silently. */
export function useLuck(): [LuckState, (next: LuckState) => void] {
  const [state, setState] = useState<LuckState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_LUCK, ...JSON.parse(raw) };
    } catch {
      /* private mode or blocked storage — defaults are fine */
    }
    return DEFAULT_LUCK;
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

/** One shape for both the hand-listed boosts and the scraped events. */
export interface Boost {
  id: string;
  label: string;
  kind: 'additive' | 'multiplicative' | 'unknown';
  value: number | null;
  sites: string[];
  global: boolean;
  admin: boolean;
  hint: string;
  source: 'manual' | 'event';
}

// shared/luck.mjs is plain JS, so its export arrives untyped.
const MANUAL = (MANUAL_BOOSTS as Omit<Boost, 'admin' | 'source'>[]).map(
  (b): Boost => ({ ...b, admin: false, source: 'manual' }),
);

const EVENTS: Boost[] = events.map((e: LuckEvent) => ({
  id: e.id,
  label: e.name,
  kind: e.kind,
  value: e.value,
  sites: e.sites,
  global: e.global,
  admin: e.admin,
  source: 'event',
  hint: e.global ? 'Everywhere' : `Only at ${e.sites.join(', ')}`,
}));

const ALL_BOOSTS: Boost[] = [...MANUAL, ...EVENTS];
const boostById = new Map(ALL_BOOSTS.map((b) => [b.id, b]));

/** shared/luck.mjs is plain JS; this is its result shape, typed once. */
export interface LuckResult {
  luck: number;
  multiplier: number;
  stacked: number;
  meteor: number;
  applied: Boost[];
  skipped: Boost[];
}

/** Typed wrapper around effectiveLuck, so callers don't cast at every use. */
export function luckAt(
  base: number,
  opts: { boosts?: Boost[]; friends?: number; siteName?: string | null },
): LuckResult {
  return effectiveLuck(base, opts) as LuckResult;
}

/** Resolve the player's selection into boost objects the model understands. */
export function activeBoosts(luck: LuckState): Boost[] {
  return luck.boosts
    .map((id) => boostById.get(id))
    .filter((b): b is Boost => b != null && b.kind !== 'unknown');
}

const PAN_PRESETS = [...pans]
  .filter((p) => p.stats.luck != null)
  .sort((a, b) => (a.stats.luck ?? 0) - (b.stats.luck ?? 0));

const describe = (b: Pick<Boost, 'kind' | 'value'>) =>
  b.kind === 'multiplicative' ? `×${b.value} on top` : `×${(b.value ?? 0) + 1}`;

export function LuckPanel({
  luck, onChange, siteName,
}: {
  luck: LuckState;
  onChange: (next: LuckState) => void;
  /** When set, location-locked events are greyed out if they miss this site. */
  siteName?: string | null;
}) {
  const [showAdmin, setShowAdmin] = useState(false);
  const [showPans, setShowPans] = useState(false);
  const [loadout] = useLoadout();

  // Base Luck is pan + equipment + enchants, so offer the loadout's contribution
  // rather than making people add it up by hand.
  const loadoutLuck = loadoutTotals(
    loadout.items.map((id) => equipmentById.get(id)).filter((e) => e != null),
    { quality: loadout.quality },
  ).find((t) => t.stat === 'Luck')?.value ?? 0;

  const boosts = activeBoosts(luck);
  const { luck: effective, stacked, meteor } = effectiveLuck(luck.base, {
    boosts,
    friends: luck.friends,
    siteName: siteName ?? null,
  });

  const toggle = (id: string) =>
    onChange({
      ...luck,
      boosts: luck.boosts.includes(id)
        ? luck.boosts.filter((b) => b !== id)
        : [...luck.boosts, id],
    });

  const { normal, admin, unknown } = useMemo(
    () => ({
      normal: EVENTS.filter((e) => !e.admin && e.kind !== 'unknown'),
      admin: EVENTS.filter((e) => e.admin),
      unknown: EVENTS.filter((e) => e.kind === 'unknown'),
    }),
    [],
  );

  const dirty =
    luck.base !== DEFAULT_LUCK.base || luck.boosts.length > 0 || luck.friends > 0;

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/8 px-5 py-4">
        <div>
          <h2 className="text-sm font-extrabold tracking-[0.1em] text-ink-400 uppercase">
            Your luck
          </h2>
          <p className="mt-0.5 text-xs text-ink-500">Odds update as you change this.</p>
        </div>
        <div className="text-right">
          <div className="numeric text-3xl font-black text-vein-400">
            {effective.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
          <div className="numeric text-[11px] text-ink-500">
            {luck.base.toLocaleString('en-US')} base
            {stacked !== 1 && <> × <span className="text-ink-300">{+stacked.toFixed(2)}</span></>}
            {meteor !== 1 && <> × <span className="text-ore-400">{+meteor.toFixed(2)}</span></>}
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5">
        {/* base luck */}
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="base-luck" className="text-xs font-semibold text-ink-400">
              Base Luck — pan, equipment, enchants, quests
            </label>
            <button
              onClick={() => setShowPans((v) => !v)}
              className="text-[11px] font-semibold text-ink-500 underline underline-offset-2 hover:text-ore-400"
            >
              {showPans ? 'hide' : 'use a pan'}
            </button>
          </div>
          <input
            id="base-luck"
            type="number"
            min={0}
            value={luck.base}
            onChange={(e) => onChange({ ...luck, base: Math.max(0, Number(e.target.value) || 0) })}
            className="w-full rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-sm outline-none transition focus:border-vein-500/50 focus:bg-white/7"
          />
          {loadoutLuck > 0 && (
            <button
              onClick={() =>
                onChange({ ...luck, base: Math.round((luck.base + loadoutLuck) * 100) / 100 })
              }
              className="mt-2 w-full rounded-lg bg-vein-500/15 px-3 py-1.5 text-left text-[11px] font-semibold text-vein-400 ring-1 ring-vein-500/25 transition hover:bg-vein-500/25"
            >
              + Add your loadout’s{' '}
              <span className="numeric">+{loadoutLuck.toFixed(2)}</span> Luck
              <span className="ml-1 font-normal opacity-70">
                ({loadout.items.length} equipped)
              </span>
            </button>
          )}
          {showPans && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PAN_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onChange({ ...luck, base: p.stats.luck })}
                  title={`${p.name} — Luck ${p.stats.luck}`}
                  className={cx(
                    'rounded-md px-2 py-1 text-[11px] font-semibold transition',
                    luck.base === p.stats.luck
                      ? 'bg-vein-500/25 text-vein-400 ring-1 ring-vein-500/40'
                      : 'bg-white/5 text-ink-400 hover:bg-white/10 hover:text-ink-100',
                  )}
                >
                  {p.name.replace(/ Pan$/, '')}{' '}
                  <span className="numeric opacity-60">{p.stats.luck}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <BoostGroup
          title="Boosts you control"
          hint="These add together — two ×2 boosts give ×3, not ×4."
          boosts={MANUAL}
          luck={luck}
          siteName={siteName}
          onToggle={toggle}
        />

        {/* friends */}
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="friends" className="text-xs font-semibold text-ink-400">
              Friends in your server
            </label>
            <span className="numeric text-[11px] text-ink-500">
              +{(luck.friends * 0.1).toFixed(1)}× · max {MAX_FRIENDS}
            </span>
          </div>
          <input
            id="friends"
            type="range"
            min={0}
            max={MAX_FRIENDS}
            value={luck.friends}
            onChange={(e) => onChange({ ...luck, friends: Number(e.target.value) })}
            className="w-full accent-vein-500"
          />
        </div>

        <BoostGroup
          title="Active events"
          hint="Multiplicative events stack on top of everything, and on each other."
          boosts={normal}
          luck={luck}
          siteName={siteName}
          onToggle={toggle}
        />

        {unknown.length > 0 && (
          <p className="text-[11px] text-ink-500">
            {unknown.map((e) => e.label).join(' and ')} also boost Luck, but the wiki doesn’t say by
            how much — so they aren’t listed above.
          </p>
        )}

        <div>
          <button
            onClick={() => setShowAdmin((v) => !v)}
            className="text-[11px] font-semibold text-ink-500 underline underline-offset-2 hover:text-ore-400"
          >
            {showAdmin ? 'Hide' : 'Show'} admin-only events
          </button>
          {showAdmin && (
            <div className="mt-2">
              <BoostGroup
                title=""
                boosts={admin}
                luck={luck}
                siteName={siteName}
                onToggle={toggle}
              />
            </div>
          )}
        </div>

        {dirty && (
          <button
            onClick={() => onChange(DEFAULT_LUCK)}
            className="text-xs font-semibold text-ink-500 underline underline-offset-2 hover:text-ore-400"
          >
            Reset to Luck 1
          </button>
        )}
      </div>
    </section>
  );
}

function BoostGroup({
  title, hint, boosts, luck, siteName, onToggle,
}: {
  title: string;
  hint?: string;
  boosts: Boost[];
  luck: LuckState;
  siteName?: string | null;
  onToggle: (id: string) => void;
}) {
  if (!boosts.length) return null;
  return (
    <div>
      {title && <p className="mb-0.5 text-xs font-semibold text-ink-400">{title}</p>}
      {hint && <p className="mb-2 text-[11px] text-ink-500">{hint}</p>}
      <div className="flex flex-wrap gap-1.5">
        {boosts.map((b) => {
          const on = luck.boosts.includes(b.id);
          const label = b.label;
          // Greyed, not hidden: it still tells you the event exists elsewhere.
          const outOfScope = Boolean(siteName) && !appliesAt(b, siteName);
          const mult = b.kind === 'multiplicative';
          return (
            <button
              key={b.id}
              onClick={() => onToggle(b.id)}
              aria-pressed={on}
              title={
                outOfScope
                  ? `${label} — doesn't apply at ${siteName}`
                  : b.hint
              }
              className={cx(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                on && outOfScope && 'bg-white/5 text-ink-500 line-through ring-1 ring-white/10',
                on && !outOfScope && mult && 'bg-ore-400/20 text-ore-300 ring-1 ring-ore-400/40',
                on && !outOfScope && !mult && 'bg-vein-500/20 text-vein-400 ring-1 ring-vein-500/40',
                !on && 'bg-white/5 text-ink-400 hover:bg-white/10 hover:text-ink-100',
                !on && outOfScope && 'opacity-45',
              )}
            >
              {label}{' '}
              <span className="numeric opacity-60">{describe(b)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The caveats, stated wherever modelled odds are shown. */
export function LuckCaveat({ className }: { className?: string }) {
  return (
    <p className={cx('text-xs leading-relaxed text-ink-500', className)}>
      Modelled from the wiki’s{' '}
      <a
        href="https://prospecting.miraheze.org/wiki/Luck_Mechanics"
        target="_blank"
        rel="noreferrer noopener"
        className="text-ink-400 underline decoration-white/20 underline-offset-2 hover:text-ore-400"
      >
        Luck Mechanics
      </a>{' '}
      and{' '}
      <a
        href="https://prospecting.miraheze.org/wiki/Events"
        target="_blank"
        rel="noreferrer noopener"
        className="text-ink-400 underline decoration-white/20 underline-offset-2 hover:text-ore-400"
      >
        Events
      </a>
      : each point of Luck rerolls the rarity number and the lowest roll wins. Two limits worth
      knowing — the wiki never says what Luck its drop tables assume, so we take them as Luck 1;
      and the game applies an undocumented dampening that stops high Luck making commons
      unobtainable. Treat these as an optimistic upper bound, best trusted while a mineral is
      still a long shot.
    </p>
  );
}
