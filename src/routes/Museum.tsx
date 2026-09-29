import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  museum, museumOreById, museumOresByStat, museumTotals, bestMuseumPicks,
  boostFor, boostLabel, mineralById, rarityByName, money,
  type MuseumOre, type RarityName,
} from '../lib/db';
import {
  decodeBuild, encodeBuild, isEmptyBuild, readBuilds, slotKey, writeBuilds,
  type SavedBuild, type Slots,
} from '../lib/museumBuild';
import {
  Empty, RarityTag, SectionTitle, Sprite, cx, gradientVars,
} from '../components/ui';

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
  // The stat lives in the URL so ⌘K can land on "Museum — Luck" directly, and
  // so a chosen stat survives a link being shared.
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get('stat');
  const stat = fromUrl && museum.stats.includes(fromUrl) ? fromUrl : 'Luck';

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

  const setStat = (next: string) => {
    const p = new URLSearchParams(params);
    p.set('stat', next);
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
  const [library, setLibrary] = useState<SavedBuild[]>(readBuilds);

  const saveBuild = (name: string) => {
    const build: SavedBuild = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim().slice(0, 40) || 'Untitled build',
      code: encodeBuild(slots),
      savedAt: new Date().toISOString(),
    };
    const next = [build, ...library];
    setLibrary(next);
    writeBuilds(next);
  };

  const removeBuild = (id: string) => {
    const next = library.filter((b) => b.id !== id);
    setLibrary(next);
    writeBuilds(next);
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
    return `${origin}/museum?stat=${encodeURIComponent(stat)}&b=${code}`;
  }, [slots, stat]);

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
                ? `${filled} of ${museum.slots} filled — only ${reachable} displays can boost ${stat} at all`
                : `${filled} of ${museum.slots} displays filled`
            }
            action={
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={fillBest}
                  className="rounded-lg bg-ore-400 px-3 py-1.5 text-xs font-bold text-rock-950 transition hover:bg-ore-300"
                >
                  Best for {stat}
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
            <ShareBox url={shareUrl} onClose={() => setShareOpen(false)} />
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

/**
 * The share link, with a copy button.
 *
 * The URL is always on screen as selectable text rather than hidden behind the
 * button alone: `navigator.clipboard` needs a secure context and can be refused
 * outright, and a "Share" that silently does nothing is worse than no button.
 */
/**
 * Saved builds, mirroring the game's Manage Museums Board: keep a few setups
 * and switch between them.
 *
 * Loading one shows it the same way a shared link does — held apart from the
 * museum you're actively editing — so switching to look at your Sell build
 * doesn't discard the Luck one you had on screen.
 */
function BuildLibrary({
  builds, canSave, activeCode, onSave, onLoad, onRemove,
}: {
  builds: SavedBuild[];
  canSave: boolean;
  /** The code currently being viewed, so its chip can be marked. */
  activeCode: string | null;
  onSave: (name: string) => void;
  onLoad: (build: SavedBuild) => void;
  onRemove: (id: string) => void;
}) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const commit = () => {
    onSave(name);
    setName('');
    setNaming(false);
  };

  if (builds.length === 0 && !naming) {
    return (
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/8 bg-white/3 px-3 py-2">
        <span className="flex-1 text-[11px] text-ink-500">
          Keep more than one setup — a Luck build for hunting, a Sell build for cashing out.
        </span>
        <button
          onClick={() => setNaming(true)}
          disabled={!canSave}
          className="rounded-lg bg-white/8 px-2.5 py-1 text-[11px] font-semibold text-ink-200 transition hover:bg-white/14 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save this build
        </button>
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-xl border border-white/8 bg-white/3 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[10px] font-bold tracking-[0.12em] text-ink-500 uppercase">
          Saved
        </span>
        {builds.map((build) => (
          <span
            key={build.id}
            className={cx(
              'group flex items-center gap-1 rounded-lg py-1 pr-1 pl-2.5 text-xs font-semibold transition',
              build.code === activeCode
                ? 'bg-ore-400/20 text-ore-300 ring-1 ring-ore-400/40'
                : 'bg-white/6 text-ink-300 hover:bg-white/12',
            )}
          >
            <button onClick={() => onLoad(build)} className="max-w-[12rem] truncate">
              {build.name}
            </button>
            <button
              onClick={() => onRemove(build.id)}
              aria-label={`Delete ${build.name}`}
              className="rounded px-1 text-ink-500 opacity-0 transition group-hover:opacity-100 hover:text-red-400 focus:opacity-100"
            >
              ✕
            </button>
          </span>
        ))}

        {naming ? (
          <span className="flex items-center gap-1">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') setNaming(false);
              }}
              placeholder="Name this build"
              maxLength={40}
              className="w-40 rounded-lg border border-white/12 bg-white/5 px-2 py-1 text-xs outline-none focus:border-ore-400/50"
            />
            <button
              onClick={commit}
              className="rounded-lg bg-ore-400 px-2.5 py-1 text-[11px] font-bold text-rock-950 transition hover:bg-ore-300"
            >
              Save
            </button>
          </span>
        ) : (
          <button
            onClick={() => setNaming(true)}
            disabled={!canSave}
            className="rounded-lg bg-white/6 px-2.5 py-1 text-xs font-semibold text-ink-400 transition hover:bg-white/12 hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            + Save current
          </button>
        )}
      </div>
    </div>
  );
}

function ShareBox({ url, onClose }: { url: string; onClose: () => void }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const t = setTimeout(() => setState('idle'), 2400);
    return () => clearTimeout(t);
  }, [state]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      setState('failed');
    }
  };

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div className="panel mb-3 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[11px] font-semibold tracking-[0.12em] text-ink-500 uppercase">
          Share this build
        </h3>
        <button
          onClick={onClose}
          aria-label="Close"
          className="text-xs text-ink-500 transition hover:text-ink-100"
        >
          ✕
        </button>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Shareable link to this build"
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/4 px-3 py-2 font-mono text-xs text-ink-300 outline-none focus:border-ore-400/50"
        />
        <button
          onClick={copy}
          className="rounded-lg bg-ore-400 px-3 py-2 text-xs font-bold text-rock-950 transition hover:bg-ore-300"
        >
          {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy link'}
        </button>
        {canShare && (
          <button
            onClick={() => navigator.share({ title: 'Prospecting Atlas — museum build', url })}
            className="rounded-lg bg-white/6 px-3 py-2 text-xs font-semibold text-ink-300 transition hover:bg-white/10"
          >
            Share…
          </button>
        )}
      </div>

      <p className="mt-2 text-[11px] text-ink-500">
        {state === 'failed'
          ? 'Your browser blocked the clipboard — select the link above and copy it manually.'
          : 'Anyone who opens this sees your exact layout. It stays valid as the wiki updates, because it stores ore names rather than positions.'}
      </p>
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
      <p className="text-xs text-ink-400">
        {stat} from {filled} display{filled === 1 ? '' : 's'}
      </p>

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
