import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  museum, museumOreById, museumTotals, bestMuseumPicks, scoreFor, soloCeiling,
  boostLabel, rarityByName, money,
  type RarityName,
} from '../lib/db';
import {
  decodeBuild, encodeBuild, isEmptyBuild, slotKey, MUSEUM_BUILDS_KEY, type Slots,
} from '../lib/museumBuild';
import { makeBuild, readBuilds, writeBuilds, type SavedBuild } from '../lib/buildLibrary';
import { Empty, SectionTitle, cx, gradientVars } from '../components/ui';
import { BuildLibrary, ShareBox } from '../components/BuildLibrary';
import { MobileDock } from '../components/MobileDock';
import { OrePicker, OreRow, Pedestal } from '../components/MuseumSlots';

/* ---------- slot state -------------------------------------------------- */

const STORAGE_KEY = 'atlas.museum';

/** The visitor's own museum, kept in their browser. */
function useSavedSlots(): [Slots, (next: Slots) => void] {
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
  // The stats live in the URL so ⌘K can land on "Museum — Luck" directly, and
  // so a chosen set survives a link being shared. Comma-separated, because a
  // build is often for two things at once.
  const [params, setParams] = useSearchParams();
  const stats = useMemo(() => {
    const picked = (params.get('stat') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => museum.stats.includes(s));
    return picked.length ? picked : ['Luck'];
  }, [params]);
  // The first one leads the labels and the browse table; the rest come along.
  const stat = stats[0];

  /**
   * How much each selected stat matters, 0–100.
   *
   * Without this the planner has to guess, and any guess is wrong: two stats
   * rarely matter equally, and the answer for "mostly Luck, a bit of Size
   * Boost" is a different museum from "both please".
   */
  const weights = useMemo(() => {
    const given = (params.get('w') ?? '')
      .split(',')
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n) && n >= 0);
    return stats.map((_, i) => (given[i] ?? 50));
  }, [params, stats]);

  const setWeights = (next: number[]) => {
    const p = new URLSearchParams(params);
    p.set('stat', stats.join(','));
    p.set('w', next.map((n) => Math.round(n)).join(','));
    setParams(p, { replace: true });
  };

  const [saved, setSaved] = useSavedSlots();

  // A `?b=` link is somebody else's build. It's held apart from the saved one
  // and never written to storage on its own: opening a friend's link must not
  // quietly replace the museum you spent an evening planning. Taking it over is
  // an explicit "Make this mine".
  // `!== null` rather than truthiness: `?b=` with everything cleared is still
  // "I am looking at a shared build", just an empty one.
  const code = params.get('b');
  const shared = useMemo(() => (code !== null ? decodeBuild(code) : null), [code]);
  const viewingShared = shared != null;
  const slots = viewingShared ? shared.slots : saved;

  const setStats = (next: string[], nextWeights?: number[]) => {
    const p = new URLSearchParams(params);
    p.set('stat', next.join(','));
    // Keep each stat's weight with it as the selection changes; a new one
    // starts at the midpoint rather than inheriting whatever was at its index.
    const carried = nextWeights ?? next.map((name) => {
      const at = stats.indexOf(name);
      return at === -1 ? 50 : weights[at];
    });
    p.set('w', carried.map((n) => Math.round(n)).join(','));
    setParams(p, { replace: true });
  };

  const clearShared = () => {
    const p = new URLSearchParams(params);
    p.delete('b');
    setParams(p, { replace: true });
  };

  /**
   * Edits go wherever you're working: your saved museum normally, or the link
   * itself while you're looking at someone else's build. Tweaking a build a
   * friend sent you shouldn't overwrite your own, and this way the share URL
   * updates as you go, so you can pass on your version of it.
   */
  const setSlots = (next: Slots) => {
    if (!viewingShared) {
      setSaved(next);
      return;
    }
    const p = new URLSearchParams(params);
    p.set('b', encodeBuild(next));
    setParams(p, { replace: true });
  };

  const [picking, setPicking] = useState<{ rarity: RarityName; index: number } | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const totalsRef = useRef<HTMLDivElement>(null);
  const [library, setLibrary] = useState<SavedBuild[]>(() => readBuilds(MUSEUM_BUILDS_KEY));

  const saveBuild = (name: string) => {
    const next = [makeBuild(name, encodeBuild(slots)), ...library];
    setLibrary(next);
    writeBuilds(MUSEUM_BUILDS_KEY, next);
  };

  const removeBuild = (id: string) => {
    const next = library.filter((b) => b.id !== id);
    setLibrary(next);
    writeBuilds(MUSEUM_BUILDS_KEY, next);
  };

  /** Loading a saved build shows it the same way a shared link does. */
  const loadBuild = (build: SavedBuild) => {
    const p = new URLSearchParams(params);
    p.set('b', build.code);
    setParams(p, { replace: true });
    setShareOpen(false);
  };

  const shareUrl = useMemo(() => {
    const code = encodeBuild(slots);
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    return (
      `${origin}/museum?stat=${encodeURIComponent(stats.join(','))}` +
      `&w=${weights.map((n) => Math.round(n)).join(',')}&b=${code}`
    );
  }, [slots, stats, weights]);

  const placed = useMemo(
    () => Object.values(slots).map((id) => (id ? museumOreById.get(id) : null)),
    [slots],
  );
  const totals = useMemo(() => museumTotals(placed), [placed]);
  const filled = placed.filter(Boolean).length;

  const fillBest = () => {
    const picks = bestMuseumPicks(stats, weights);
    const next: Slots = {};
    for (const display of museum.displays) {
      (picks.get(display.rarity) ?? []).forEach((ore, i) => {
        next[slotKey(display.rarity, i)] = ore.id;
      });
    }
    setSlots(next);
  };

  // Ranked by the combined score, so the browse table agrees with what the
  // "best for" button just placed.
  const ranked = useMemo(
    () =>
      museum.ores
        .filter((o) => o.boosts.some((b) => stats.includes(b.stat)))
        .sort((a, b) => scoreFor(b, stats) - scoreFor(a, stats)),
    [stats],
  );

  // Only six ores in the game boost Luck, so "Best for Luck" leaves most
  // displays empty. That looks broken unless it's said out loud.
  const reachable = [...bestMuseumPicks(stats, weights).values()].reduce((t, xs) => t + xs.length, 0);

  /** "Luck", or "Luck + Capacity" — whatever the buttons and headings need. */
  const label = stats.join(' + ');

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
          hint={
            stats.length > 1
              ? `Optimising for ${stats.length} stats at once — an ore is ranked by what it adds across all of them.`
              : 'Pick more than one and the planner balances them.'
          }
        />
        {stats.length > 1 && (
          <div className="panel mb-4 p-4">
            <p className="mb-3 text-[11px] font-semibold tracking-[0.12em] text-ink-500 uppercase">
              How much does each one matter?
            </p>
            <div className="space-y-3">
              {stats.map((name, i) => {
                const ceiling = soloCeiling(name);
                const got = totals[name] ?? 0;
                return (
                  <div key={name}>
                    <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                      <label htmlFor={`w-${name}`} className="text-xs font-semibold text-ink-300">
                        {name}
                      </label>
                      <span className="numeric text-[11px] text-ink-500">
                        {/* Against what this stat could reach on its own, which is
                            the only way to see what a trade-off actually cost. */}
                        <span className="text-vein-400">{boostLabel(got)}</span> of{' '}
                        {boostLabel(ceiling)} possible
                      </span>
                    </div>
                    <input
                      id={`w-${name}`}
                      type="range"
                      min={0}
                      max={100}
                      value={weights[i] ?? 50}
                      onChange={(e) =>
                        setWeights(
                          weights.map((w, n) => (n === i ? Number(e.target.value) : w)),
                        )
                      }
                      className="w-full accent-vein-500"
                    />
                  </div>
                );
              })}
            </div>
            <p className="mt-2.5 text-[11px] leading-relaxed text-ink-500">
              Each stat is scored against the best its rarity could manage, not its raw
              multiplier — the best Mythic for Luck is 0.75× and for Size Boost 0.35×, so
              without that an even split quietly becomes 80/20.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {museum.stats.map((s) => (
            <button
              key={s}
              onClick={() =>
                setStats(
                  stats.includes(s)
                    // Never end up with nothing selected; there'd be nothing to plan for.
                    ? (stats.length > 1 ? stats.filter((x) => x !== s) : stats)
                    : [...stats, s],
                )
              }
              aria-pressed={stats.includes(s)}
              className={cx(
                'rounded-lg px-3 py-1.5 text-sm font-semibold transition',
                stats.includes(s)
                  ? 'bg-vein-500/25 text-vein-300 ring-1 ring-vein-500/50'
                  : 'bg-white/5 text-ink-400 hover:bg-white/10 hover:text-ink-100',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      {viewingShared && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-ore-400/30 bg-ore-400/8 px-4 py-3">
          <span className="flex-1 text-sm">
            <strong className="font-bold text-ore-300">You're looking at a shared build.</strong>{' '}
            <span className="text-ink-300">
              Your own museum is untouched. Changes you make stay in this link — save it with
              “Make this mine”.
            </span>
            {shared.dropped.length > 0 && (
              <span className="mt-1 block text-[11px] text-ink-400">
                {shared.dropped.length} slot{shared.dropped.length === 1 ? '' : 's'} couldn't be
                filled: {shared.dropped.join(', ')}{' '}
                {shared.dropped.length === 1 ? 'is' : 'are'} no longer placeable.
              </span>
            )}
          </span>
          <button
            onClick={() => { setSaved(shared.slots); clearShared(); }}
            className="rounded-lg bg-ore-400 px-3 py-1.5 text-xs font-bold text-rock-950 transition hover:bg-ore-300"
          >
            Make this mine
          </button>
          <button
            onClick={clearShared}
            className="rounded-lg bg-white/8 px-3 py-1.5 text-xs font-semibold text-ink-200 transition hover:bg-white/14"
          >
            Back to my museum
          </button>
        </div>
      )}

      {/* ---------- planner ---------- */}
      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div>
          <SectionTitle
            title="Your museum"
            hint={
              reachable < museum.slots
                ? `${filled} of ${museum.slots} filled — only ${reachable} displays can help with ${label} at all`
                : `${filled} of ${museum.slots} displays filled`
            }
            action={
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={fillBest}
                  className="rounded-lg bg-ore-400 px-3 py-1.5 text-xs font-bold text-rock-950 transition hover:bg-ore-300"
                >
                  Best for {label}
                </button>
                <button
                  onClick={() => setShareOpen((v) => !v)}
                  disabled={isEmptyBuild(slots)}
                  aria-expanded={shareOpen}
                  className="rounded-lg bg-white/6 px-3 py-1.5 text-xs font-semibold text-ink-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Share
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

          {shareOpen && !isEmptyBuild(slots) && (
            <ShareBox
              url={shareUrl}
              onClose={() => setShareOpen(false)}
              note="Anyone who opens this sees your exact layout. It stays valid as the wiki updates, because it stores ore names rather than positions."
            />
          )}

          <BuildLibrary
            builds={library}
            canSave={!isEmptyBuild(slots)}
            activeCode={viewingShared ? code : null}
            onSave={saveBuild}
            onLoad={loadBuild}
            onRemove={removeBuild}
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
                        stats={stats}
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

        <div ref={totalsRef} className="order-first lg:order-none">
          <Totals totals={totals} stats={stats} filled={filled} />
        </div>
      </section>

      {/* ---------- browse ---------- */}
      <section className="mt-10">
        <SectionTitle
          title={stats.length > 1 ? `Every ore that helps with ${label}` : `Every ore that changes ${stat}`}
          hint={`${ranked.length} of ${museum.ores.length} ores, best first. Weight is what you need to hit for the full boost.`}
        />
        {ranked.length === 0 ? (
          <Empty>No ore affects {label}.</Empty>
        ) : (
          <div className="panel divide-y divide-white/6">
            {ranked.map((ore) => (
              <OreRow key={ore.id} ore={ore} stats={stats} />
            ))}
          </div>
        )}
      </section>

      <Reference />

      <MobileDock
        label="What you'd gain"
        meta={`${filled} of ${museum.slots} displays · ${label}`}
        value={boostLabel(stats.reduce((t, x) => t + (totals[x] ?? 0), 0))}
        anchorRef={totalsRef}
      >
        <Totals totals={totals} stats={stats} filled={filled} />
      </MobileDock>

      {picking && (
        <OrePicker
          rarity={picking.rarity}
          stats={stats}
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


/**
 * The share link, with a copy button.
 *
 * The URL is always on screen as selectable text rather than hidden behind the
 * button alone: `navigator.clipboard` needs a secure context and can be refused
 * outright, and a "Share" that silently does nothing is worse than no button.
 */
function Totals({
  totals, stats, filled,
}: {
  totals: Record<string, number>;
  stats: string[];
  filled: number;
}) {
  const label = stats.join(' + ');
  const headline = stats.reduce((t, s) => t + (totals[s] ?? 0), 0);
  const rows = Object.entries(totals)
    .filter(([, v]) => v !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

  return (
    <div className="panel p-5 lg:sticky lg:top-20">
      <h2 className="text-[11px] font-semibold tracking-[0.12em] text-ink-500 uppercase">
        What you'd gain
      </h2>
      <div className="numeric mt-1 text-3xl font-black text-vein-400">
        {boostLabel(headline)}
      </div>
      <p className="text-xs text-ink-400">
        {label} from {filled} display{filled === 1 ? '' : 's'}
      </p>

      {rows.length > 0 ? (
        <dl className="mt-4 space-y-1.5">
          {rows.map(([s, v]) => (
            <div
              key={s}
              className={cx(
                'flex items-baseline justify-between gap-2 rounded-md px-2 py-1 text-sm',
                stats.includes(s) && 'bg-vein-500/10',
              )}
            >
              <dt className={cx('truncate', stats.includes(s) ? 'font-bold' : 'text-ink-300')}>{s}</dt>
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
          Nothing placed yet. Hit <strong className="text-ink-300">Best for {label}</strong> to see
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
