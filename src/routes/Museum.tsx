import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  museum, museumOreById, museumOresByStat, museumTotals, bestMuseumPicks,
  boostFor, boostLabel, mineralById, rarityByName, money,
  type MuseumOre, type RarityName,
} from '../lib/db';
import {
  Empty, RarityTag, SectionTitle, Sprite, cx, gradientVars,
} from '../components/ui';

/* ---------- slot state -------------------------------------------------- */

/** `Legendary:2` — a display's rarity and its index within that rarity. */
type SlotKey = string;
type Slots = Record<SlotKey, string | null>;

const slotKey = (rarity: RarityName, i: number): SlotKey => `${rarity}:${i}`;
const STORAGE_KEY = 'atlas.museum';

function useSlots(): [Slots, (next: Slots) => void] {
  const [slots, setSlots] = useState<Slots>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as Slots;
    } catch {
      /* blocked storage — an empty museum is a fine starting point */
    }
    return {};
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
    } catch {
      /* not worth surfacing */
    }
  }, [slots]);

  return [slots, setSlots];
}

/* ---------- page -------------------------------------------------------- */

export function MuseumPage() {
  // The stat lives in the URL so ⌘K can land on "Museum — Luck" directly, and
  // so a chosen stat survives a link being shared.
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get('stat');
  const stat = fromUrl && museum.stats.includes(fromUrl) ? fromUrl : 'Luck';
  const setStat = (next: string) => setParams({ stat: next }, { replace: true });

  const [slots, setSlots] = useSlots();
  const [picking, setPicking] = useState<{ rarity: RarityName; index: number } | null>(null);

  const placed = useMemo(
    () => Object.values(slots).map((id) => (id ? museumOreById.get(id) : null)),
    [slots],
  );
  const totals = useMemo(() => museumTotals(placed), [placed]);
  const filled = placed.filter(Boolean).length;

  const fillBest = () => {
    const picks = bestMuseumPicks(stat);
    const next: Slots = {};
    for (const display of museum.displays) {
      (picks.get(display.rarity) ?? []).forEach((ore, i) => {
        next[slotKey(display.rarity, i)] = ore.id;
      });
    }
    setSlots(next);
  };

  // Ranked once per stat and reused by both the picker and the browse table.
  const ranked = museumOresByStat.get(stat) ?? [];

  // Only six ores in the game boost Luck, so "Best for Luck" leaves most
  // displays empty. That looks broken unless it's said out loud.
  const reachable = [...bestMuseumPicks(stat).values()].reduce((t, xs) => t + xs.length, 0);

  return (
    <div className="animate-rise">
      <header className="panel relative overflow-hidden p-6 sm:p-8">
        <div
          aria-hidden
          className="absolute -top-24 -right-12 h-72 w-72 rounded-full bg-vein-500/20 blur-3xl"
        />
        <div className="relative">
          <p className="text-xs font-semibold tracking-[0.12em] text-ink-500 uppercase">
            Caldera Park
          </p>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">The Museum</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-300">
            Put a mineral on a pedestal and keep the stat boost permanently. Every display only
            accepts its own rarity, so this isn’t about donating your best ore — it’s{' '}
            <strong className="text-ink-100">{museum.slots} separate picks</strong>, one per
            display, and a Common slot is still worth filling when you own Exotics.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {museum.displays.map((d) => {
              const r = rarityByName.get(d.rarity);
              return (
                <span
                  key={d.rarity}
                  style={gradientVars(r?.colors)}
                  className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs ring-1 ring-white/8"
                >
                  <span className="gradient-text font-bold">{d.rarity}</span>
                  <span className="numeric ml-1.5 text-ink-400">×{d.total}</span>
                </span>
              );
            })}
          </div>
        </div>
      </header>

      {/* ---------- what are you building for? ---------- */}
      <section className="mt-8">
        <SectionTitle
          title="Pick what you're building for"
          hint="Everything below re-ranks around this stat."
        />
        <div className="flex flex-wrap gap-1.5">
          {museum.stats.map((s) => (
            <button
              key={s}
              onClick={() => setStat(s)}
              aria-pressed={stat === s}
              className={cx(
                'rounded-lg px-3 py-1.5 text-sm font-semibold transition',
                stat === s
                  ? 'bg-vein-500/25 text-vein-300 ring-1 ring-vein-500/50'
                  : 'bg-white/5 text-ink-400 hover:bg-white/10 hover:text-ink-100',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      {/* ---------- planner ---------- */}
      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div>
          <SectionTitle
            title="Your museum"
            hint={
              reachable < museum.slots
                ? `${filled} of ${museum.slots} filled — only ${reachable} displays can boost ${stat} at all`
                : `${filled} of ${museum.slots} displays filled`
            }
            action={
              <div className="flex gap-2">
                <button
                  onClick={fillBest}
                  className="rounded-lg bg-ore-400 px-3 py-1.5 text-xs font-bold text-rock-950 transition hover:bg-ore-300"
                >
                  Best for {stat}
                </button>
                <button
                  onClick={() => setSlots({})}
                  className="rounded-lg bg-white/6 px-3 py-1.5 text-xs font-semibold text-ink-300 transition hover:bg-white/10"
                >
                  Clear
                </button>
              </div>
            }
          />

          <div className="space-y-3">
            {museum.displays.map((display) => {
              const r = rarityByName.get(display.rarity);
              return (
                <div key={display.rarity} className="panel p-4">
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <span
                      style={gradientVars(r?.colors)}
                      className="gradient-text text-sm font-extrabold tracking-wide uppercase"
                    >
                      {display.rarity}
                    </span>
                    <span className="text-[11px] text-ink-500">
                      {display.free > 0 ? `${display.free} free · ` : ''}
                      {display.locked} unlockable
                      {display.money != null && ` — ${money(display.money)}`}
                      {display.shards != null && ` or ${display.shards.toLocaleString('en-US')} shards`}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {Array.from({ length: display.total }, (_, i) => (
                      <Pedestal
                        key={i}
                        ore={slots[slotKey(display.rarity, i)]
                          ? museumOreById.get(slots[slotKey(display.rarity, i)]!)
                          : null}
                        stat={stat}
                        locked={i >= display.free}
                        onPick={() => setPicking({ rarity: display.rarity, index: i })}
                        onClear={() =>
                          setSlots({ ...slots, [slotKey(display.rarity, i)]: null })
                        }
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Totals totals={totals} stat={stat} filled={filled} />
      </section>

      {/* ---------- browse ---------- */}
      <section className="mt-10">
        <SectionTitle
          title={`Every ore that changes ${stat}`}
          hint={`${ranked.length} of ${museum.ores.length} ores, best first. Weight is what you need to hit for the full boost.`}
        />
        {ranked.length === 0 ? (
          <Empty>No ore affects {stat}.</Empty>
        ) : (
          <div className="panel divide-y divide-white/6">
            {ranked.map((ore) => (
              <OreRow key={ore.id} ore={ore} stat={stat} />
            ))}
          </div>
        )}
      </section>

      <Reference />

      {picking && (
        <OrePicker
          rarity={picking.rarity}
          stat={stat}
          chosen={Object.entries(slots)
            .filter(([k]) => k !== slotKey(picking.rarity, picking.index))
            .map(([, v]) => v)
            .filter(Boolean) as string[]}
          onClose={() => setPicking(null)}
          onChoose={(ore) => {
            setSlots({ ...slots, [slotKey(picking.rarity, picking.index)]: ore.id });
            setPicking(null);
          }}
        />
      )}
    </div>
  );
}

/* ---------- pieces ------------------------------------------------------ */

function Pedestal({
  ore, stat, locked, onPick, onClear,
}: {
  ore: MuseumOre | null | undefined;
  stat: string;
  locked: boolean;
  onPick: () => void;
  onClear: () => void;
}) {
  const value = boostFor(ore, stat);

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
            {value !== 0 ? `${boostLabel(value)} ${stat}` : `no ${stat}`}
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

function Totals({
  totals, stat, filled,
}: {
  totals: Record<string, number>;
  stat: string;
  filled: number;
}) {
  const rows = Object.entries(totals)
    .filter(([, v]) => v !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

  return (
    <div className="panel sticky top-20 p-5">
      <h2 className="text-[11px] font-semibold tracking-[0.12em] text-ink-500 uppercase">
        What you'd gain
      </h2>
      <div className="numeric mt-1 text-3xl font-black text-vein-400">
        {boostLabel(totals[stat] ?? 0)}
      </div>
      <p className="text-xs text-ink-400">{stat} from {filled} displays</p>

      {rows.length > 0 ? (
        <dl className="mt-4 space-y-1.5">
          {rows.map(([s, v]) => (
            <div
              key={s}
              className={cx(
                'flex items-baseline justify-between gap-2 rounded-md px-2 py-1 text-sm',
                s === stat && 'bg-vein-500/10',
              )}
            >
              <dt className={cx('truncate', s === stat ? 'font-bold' : 'text-ink-300')}>{s}</dt>
              <dd
                className={cx(
                  'numeric shrink-0 font-bold',
                  v > 0 ? 'text-vein-400' : 'text-red-400',
                )}
              >
                {boostLabel(v)}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-4 text-sm text-ink-500">
          Nothing placed yet. Hit <strong className="text-ink-300">Best for {stat}</strong> to see
          the ceiling.
        </p>
      )}

      <p className="mt-4 border-t border-white/8 pt-3 text-[11px] leading-relaxed text-ink-500">
        These are maximum boosts, so they assume every ore you've placed is at or above its
        minimum weight. The wiki doesn't publish how the boost scales below that, so a lighter
        ore is worth less than shown — by how much, it doesn't say.
      </p>
    </div>
  );
}

function OreRow({ ore, stat }: { ore: MuseumOre; stat: string }) {
  const mineral = mineralById.get(ore.id);
  const value = boostFor(ore, stat);
  const others = ore.boosts.filter((b) => b.stat !== stat);
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
function OrePicker({
  rarity, stat, chosen, onClose, onChoose,
}: {
  rarity: RarityName;
  stat: string;
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
      .sort((a, b) => boostFor(b, stat) - boostFor(a, stat) || a.name.localeCompare(b.name));
  }, [rarity, stat, q]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-rock-950/80 p-4 pt-[10vh] backdrop-blur-sm">
      {/* Click-away layer sits behind the dialog, not over it. */}
      <button aria-label="Close" onClick={onClose} className="fixed inset-0 cursor-default" />
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-rock-900 shadow-2xl">
        <div className="border-b border-white/8 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-extrabold">
              <span className="text-ink-400">Fill a</span> {rarity}{' '}
              <span className="text-ink-400">display</span>
            </h2>
            <span className="text-[11px] text-ink-500">ranked by {stat}</span>
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
            const value = boostFor(ore, stat);
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
    </div>
  );
}

/** Modifier bonuses and the unlock table — reference, not planning. */
function Reference() {
  const diggable = museum.modifiers.filter((m) => m.diggable);
  const rest = museum.modifiers.filter((m) => !m.diggable && m.stats.length > 0);

  return (
    <section className="mt-10">
      <SectionTitle
        title="Modifiers stack on top"
        hint="An ore's modifier adds its own boost, and this part ignores weight entirely."
        action={
          <a
            href={museum.wiki}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold text-ore-400 hover:underline"
          >
            Wiki source →
          </a>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="panel divide-y divide-white/6">
          {diggable.map((m) => (
            <div key={m.name} className="flex items-center gap-3 px-4 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{m.name}</span>
                <span className="block truncate text-[11px] text-ink-500">
                  {m.stats.join(' · ')}
                </span>
              </span>
              <span className="numeric shrink-0 text-xs font-semibold text-ink-400">
                {m.chance}%
              </span>
            </div>
          ))}
        </div>

        <div>
          <div className="panel divide-y divide-white/6">
            {rest.map((m) => (
              <div key={m.name} className="px-4 py-2.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold">{m.name}</span>
                  <span className="text-[11px] text-ink-500">{m.stats.join(' · ')}</span>
                </div>
                {m.source && <p className="mt-0.5 text-[11px] text-ink-500">{m.source}</p>}
              </div>
            ))}
          </div>

          <div className="panel mt-4 p-4">
            <h3 className="text-[11px] font-semibold tracking-[0.12em] text-ink-500 uppercase">
              Modifier multiplier by rarity
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {museum.modifierMultipliers.map((m) => {
                const r = rarityByName.get(m.rarity);
                return (
                  <span
                    key={m.rarity}
                    style={gradientVars(r?.colors)}
                    className="rounded-md bg-white/5 px-2 py-1 text-[11px] ring-1 ring-white/8"
                  >
                    <span className="gradient-text font-bold">{m.rarity}</span>
                    <span className="numeric ml-1.5 text-ink-400">{m.value}×</span>
                  </span>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-ink-500">
              Treasured pays {museum.treasuredMultiplier}× these.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
