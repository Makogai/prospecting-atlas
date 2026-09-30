import { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  equipment, equipmentById, recipeMinerals, equipRarityColors, blueprintById,
  EQUIP_RARITY_ORDER, SLOT_LIMITS, money, mutations,
  type Equipment as Item, type EquipSlot, type StatRange,
} from '../lib/db';
import { BlueprintPanel } from '../components/Blueprint';
import { Empty, SectionTitle, Sprite, cx, gradientVars } from '../components/ui';
import { useLoadout, LoadoutSummary, loadoutTotals, type LoadoutState } from '../components/Loadout';
import { MobileDock } from '../components/MobileDock';
import { BuildLibrary, ShareBox } from '../components/BuildLibrary';
import {
  decodeLoadout, decodeQuality, encodeLoadout, isEmptyLoadout, EQUIP_BUILDS_KEY,
} from '../lib/equipBuild';
import { makeBuild, readBuilds, writeBuilds, type SavedBuild } from '../lib/buildLibrary';

const SLOTS: EquipSlot[] = ['Necklace', 'Charm', 'Ring'];

/** Every stat any piece of equipment can roll, for the filter. */
const ALL_STATS = [...new Set(equipment.flatMap((e) => e.stats.map((s) => s.stat)))].sort();

const fmt = (r: StatRange) =>
  r.min === r.max ? `${r.max}${r.unit ?? ''}` : `${r.min}–${r.max}${r.unit ?? ''}`;

export function EquipmentPage() {
  const [slot, setSlot] = useState<EquipSlot | 'all'>('all');
  const [stat, setStat] = useState('');
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  // A shared link carries the six-star toggle, since it changes every number.
  // Initialised from the URL rather than bound to it, so flipping it afterwards
  // is just a toggle and doesn't rewrite somebody's link.
  const [sixStar, setSixStar] = useState(params.get('six') === '1');
  const [showLimited, setShowLimited] = useState(true);
  const [needsBlueprint, setNeedsBlueprint] = useState<'any' | 'yes' | 'no'>('any');

  const [saved, setSaved] = useLoadout();

  // `?b=` is somebody else's loadout. Held apart from the saved one and never
  // written to storage on its own: opening a friend's link must not replace the
  // loadout you put together. Taking it over is an explicit "Make this mine".
  const sharedCode = params.get('b');
  const shared = useMemo(
    () => (sharedCode !== null ? decodeLoadout(sharedCode) : null),
    [sharedCode],
  );
  const viewingShared = shared != null;
  const loadout: LoadoutState = viewingShared
    ? { items: shared.items, quality: decodeQuality(params.get('qual')) }
    : saved;

  const clearShared = () => {
    const next = new URLSearchParams(params);
    next.delete('b');
    next.delete('qual');
    next.delete('six');
    setParams(next, { replace: true });
  };

  /** Edits land on your own loadout, or in the link while you're viewing one. */
  const setLoadout = (next: LoadoutState) => {
    if (!viewingShared) {
      setSaved(next);
      return;
    }
    const p = new URLSearchParams(params);
    p.set('b', encodeLoadout(next.items));
    p.set('qual', String(next.quality));
    setParams(p, { replace: true });
  };

  const [shareOpen, setShareOpen] = useState(false);
  const [library, setLibrary] = useState<SavedBuild[]>(() => readBuilds(EQUIP_BUILDS_KEY));
  const loadoutRef = useRef<HTMLDivElement>(null);

  const shareUrl = useMemo(() => {
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    return (
      `${origin}/equipment?b=${encodeLoadout(loadout.items)}` +
      `&qual=${loadout.quality}${sixStar ? '&six=1' : ''}`
    );
  }, [loadout, sixStar]);

  const saveBuild = (name: string) => {
    const next = [makeBuild(name, encodeLoadout(loadout.items)), ...library];
    setLibrary(next);
    writeBuilds(EQUIP_BUILDS_KEY, next);
  };

  const removeBuild = (id: string) => {
    const next = library.filter((b) => b.id !== id);
    setLibrary(next);
    writeBuilds(EQUIP_BUILDS_KEY, next);
  };

  const loadBuild = (build: SavedBuild) => {
    const p = new URLSearchParams(params);
    p.set('b', build.code);
    setParams(p, { replace: true });
    setShareOpen(false);
  };

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return equipment
      .filter((e) => {
        if (slot !== 'all' && e.slot !== slot) return false;
        if (stat && !e.stats.some((s) => s.stat === stat)) return false;
        if (!showLimited && e.limited) return false;
        if (needsBlueprint === 'yes' && !e.blueprint) return false;
        if (needsBlueprint === 'no' && e.blueprint) return false;
        if (needle && !`${e.name} ${e.description}`.toLowerCase().includes(needle)) return false;
        return true;
      })
      .sort((a, b) => {
        // Best of the filtered stat first when one is chosen, else by tier.
        if (stat) {
          const val = (e: Item) => {
            const s = e.stats.find((x) => x.stat === stat);
            return s ? (sixStar ? s.sixStar.max : s.base.max) : 0;
          };
          return val(b) - val(a);
        }
        const ra = EQUIP_RARITY_ORDER.indexOf(a.rarity);
        const rb = EQUIP_RARITY_ORDER.indexOf(b.rarity);
        return ra - rb || a.name.localeCompare(b.name);
      });
  }, [slot, stat, q, sixStar, showLimited, needsBlueprint]);

  const equipped = loadout.items.map((id) => equipmentById.get(id)).filter(Boolean) as Item[];

  // Luck is the number people watch while browsing, so it's what the phone
  // dock shows without being opened.
  const dockLuck = useMemo(() => {
    const totals = loadoutTotals(equipped, { sixStar, quality: loadout.quality });
    return totals.find((t) => t.stat === 'Luck')?.value ?? null;
  }, [equipped, sixStar, loadout.quality]);

  const countInSlot = (s: EquipSlot) => equipped.filter((e) => e.slot === s).length;
  const canAdd = (item: Item) =>
    !item.slot || countInSlot(item.slot) < SLOT_LIMITS[item.slot];

  const toggle = (item: Item) => {
    const has = loadout.items.includes(item.id);
    if (has) {
      const i = loadout.items.indexOf(item.id);
      setLoadout({ ...loadout, items: loadout.items.filter((_, n) => n !== i) });
    } else if (canAdd(item)) {
      setLoadout({ ...loadout, items: [...loadout.items, item.id] });
    }
  };

  return (
    <div className="animate-rise">
      <header className="mb-6">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Equipment</h1>
        <p className="mt-1 max-w-2xl text-ink-400">
          All {equipment.length} craftable rings, charms and necklaces — recipes, stat ranges, and
          what a six-star merge adds. Build a loadout and it totals the stats for you.
        </p>
      </header>

      {viewingShared && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-ore-400/30 bg-ore-400/8 px-4 py-3">
          <span className="flex-1 text-sm">
            <strong className="font-bold text-ore-300">You're looking at a shared loadout.</strong>{' '}
            <span className="text-ink-300">
              Your own is untouched. Changes you make stay in this link — save it with “Make this
              mine”.
            </span>
            {(shared.dropped.length > 0 || shared.overfilled) && (
              <span className="mt-1 block text-[11px] text-ink-400">
                {shared.dropped.length > 0 && (
                  <>
                    {shared.dropped.length} item{shared.dropped.length === 1 ? '' : 's'} couldn't be
                    equipped: {shared.dropped.join(', ')}.{' '}
                  </>
                )}
                {shared.overfilled && 'The link asked for more than the slots allow; the extras were dropped.'}
              </span>
            )}
          </span>
          <button
            onClick={() => { setSaved(loadout); clearShared(); }}
            className="rounded-lg bg-ore-400 px-3 py-1.5 text-xs font-bold text-rock-950 transition hover:bg-ore-300"
          >
            Make this mine
          </button>
          <button
            onClick={clearShared}
            className="rounded-lg bg-white/8 px-3 py-1.5 text-xs font-semibold text-ink-200 transition hover:bg-white/14"
          >
            Back to mine
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div>
          {/* --- filters --- */}
          <div className="panel-sticky sticky top-14 z-30 mb-5 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filter by name…"
                className="min-w-45 flex-1 rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-sm outline-none transition placeholder:text-ink-500 focus:border-ore-400/50 focus:bg-white/7"
              />

              <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/4 p-1">
                {(['all', ...SLOTS] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSlot(s)}
                    className={cx(
                      'rounded px-2.5 py-1 text-xs font-semibold capitalize transition',
                      slot === s ? 'bg-ore-400 text-rock-950' : 'text-ink-400 hover:text-ink-100',
                    )}
                  >
                    {s === 'all' ? 'All' : s}
                  </button>
                ))}
              </div>

              <select
                value={stat}
                onChange={(e) => setStat(e.target.value)}
                className="rounded-lg border border-white/10 bg-rock-850 px-3 py-2 text-sm outline-none focus:border-ore-400/50"
              >
                <option value="">Any stat</option>
                {ALL_STATS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setSixStar((v) => !v)}
                aria-pressed={sixStar}
                className={cx(
                  'rounded-lg px-3 py-2 text-xs font-bold transition',
                  sixStar
                    ? 'bg-ore-400/20 text-ore-300 ring-1 ring-ore-400/40'
                    : 'bg-white/5 text-ink-400 hover:bg-white/10 hover:text-ink-100',
                )}
              >
                ★6 values
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-[11px] text-ink-400">
                <input
                  type="checkbox"
                  checked={showLimited}
                  onChange={(e) => setShowLimited(e.target.checked)}
                  className="accent-ore-400"
                />
                Include limited-time
              </label>

              <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/4 p-0.5">
                {([
                  ['any', 'All'],
                  ['no', 'Craftable now'],
                  ['yes', 'Needs blueprint'],
                ] as const).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setNeedsBlueprint(v)}
                    className={cx(
                      'rounded px-2 py-0.5 text-[11px] font-semibold transition',
                      needsBlueprint === v
                        ? 'bg-white/12 text-ink-100'
                        : 'text-ink-400 hover:text-ink-100',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="numeric ml-auto text-xs text-ink-500">
                {rows.length} of {equipment.length}
              </span>
            </div>
          </div>

          {rows.length === 0 ? (
            <Empty>Nothing matches those filters.</Empty>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {rows.map((e) => (
                <EquipCard
                  key={e.id}
                  item={e}
                  sixStar={sixStar}
                  highlight={stat}
                  equipped={loadout.items.includes(e.id)}
                  disabled={!loadout.items.includes(e.id) && !canAdd(e)}
                  onToggle={() => toggle(e)}
                />
              ))}
            </div>
          )}
        </div>

        {/* --- loadout ---
            First on a phone: it's the thing you're building, and it used to sit
            below all 67 items where you'd never scroll to it. */}
        <div
          ref={loadoutRef}
          className="order-first space-y-3 lg:order-none lg:sticky lg:top-16 lg:self-start"
        >
          <LoadoutSummary
            loadout={loadout}
            onChange={setLoadout}
            equipped={equipped}
            sixStar={sixStar}
          />

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShareOpen((v) => !v)}
              disabled={isEmptyLoadout(loadout)}
              aria-expanded={shareOpen}
              className="rounded-lg bg-white/6 px-3 py-1.5 text-xs font-semibold text-ink-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Share
            </button>
            <button
              onClick={() => setLoadout({ ...loadout, items: [] })}
              disabled={isEmptyLoadout(loadout)}
              className="rounded-lg bg-white/6 px-3 py-1.5 text-xs font-semibold text-ink-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear
            </button>
          </div>

          {shareOpen && !isEmptyLoadout(loadout) && (
            <ShareBox
              url={shareUrl}
              onClose={() => setShareOpen(false)}
              note="Carries your roll quality and the six-star toggle, so a friend sees the same numbers you do."
            />
          )}

          <BuildLibrary
            builds={library}
            canSave={!isEmptyLoadout(loadout)}
            activeCode={viewingShared ? sharedCode : null}
            onSave={saveBuild}
            onLoad={loadBuild}
            onRemove={removeBuild}
            hint="Keep more than one setup — a Luck loadout for hunting, a Sell loadout for cashing out."
          />
        </div>
      </div>

      <section id="mutations" className="mt-12 scroll-mt-20">
        <SectionTitle
          title="Mutations"
          hint={`Every piece can carry one, and it multiplies all of its stats. Reroll at the ${mutations.forge ?? 'forge'}.`}
          action={
            <a
              href={mutations.wiki}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold text-ore-400 hover:underline"
            >
              Wiki source →
            </a>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {mutations.mutations.map((mut) => (
            <div key={mut.id} className="panel p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-extrabold">{mut.name}</h3>
                <span className="numeric text-lg font-black text-ore-400">
                  {mut.multiplier}×
                </span>
              </div>
              {mut.bonuses.length > 0 ? (
                <ul className="mt-1.5 space-y-0.5">
                  {mut.bonuses.map((b, i) => (
                    <li key={i} className="numeric text-[11px] text-vein-400">+ {b}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-[11px] text-ink-500">Multiplier only</p>
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-500">
          The odds depend on how many catalysts you feed the forge and which event is running —
          the wiki publishes {mutations.chanceTiers.length} separate tables for it.
        </p>
      </section>

      <MobileDock
        label="Loadout"
        meta={
          equipped.length
            ? `${equipped.length} equipped${sixStar ? ' · at ★6' : ''}`
            : 'Nothing equipped yet'
        }
        value={dockLuck != null ? `+${dockLuck.toFixed(1)}` : undefined}
        anchorRef={loadoutRef}
      >
        <LoadoutSummary
          loadout={loadout}
          onChange={setLoadout}
          equipped={equipped}
          sixStar={sixStar}
        />
      </MobileDock>
    </div>
  );
}

function EquipCard({
  item, sixStar, highlight, equipped, disabled, onToggle,
}: {
  item: Item;
  sixStar: boolean;
  highlight: string;
  equipped: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const colors = equipRarityColors(item.rarity);
  const parts = recipeMinerals(item);
  const bp = item.blueprint ? blueprintById.get(item.blueprint) : null;

  return (
    <div
      className={cx(
        'panel flex flex-col p-4 transition',
        equipped ? 'border-ore-400/50 bg-ore-400/6' : 'panel-hover',
      )}
    >
      <div className="flex items-start gap-3">
        <Sprite file={item.image} alt={item.name} className="h-14 w-14 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3
            className="truncate font-extrabold"
            style={item.color ? { color: item.color } : undefined}
            title={item.name}
          >
            {item.name}
          </h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span
              className="gradient-text text-[11px] font-bold tracking-wider uppercase"
              style={gradientVars(colors)}
            >
              {item.rarity}
            </span>
            <span className="text-[11px] text-ink-500">· {item.slot}</span>
            {item.limited && (
              <span className="rounded bg-white/6 px-1.5 py-0.5 text-[10px] font-semibold text-ink-400">
                limited
              </span>
            )}
            {item.blueprint && (
              <span className="rounded bg-ore-400/12 px-1.5 py-0.5 text-[10px] font-bold text-ore-300">
                blueprint
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onToggle}
          disabled={disabled}
          aria-pressed={equipped}
          title={disabled ? `No free ${item.slot} slot` : undefined}
          className={cx(
            'shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold transition',
            equipped && 'bg-ore-400 text-rock-950',
            !equipped && !disabled && 'bg-white/6 text-ink-400 hover:bg-white/12 hover:text-ink-100',
            disabled && 'cursor-not-allowed bg-white/4 text-ink-500 opacity-50',
          )}
        >
          {equipped ? 'Equipped' : 'Equip'}
        </button>
      </div>

      <p className="mt-2.5 line-clamp-2 h-8 text-xs text-ink-400">{item.description}</p>

      <dl className="mt-3 space-y-1">
        {item.stats.map((s) => {
          const r = sixStar ? s.sixStar : s.base;
          const bumped = sixStar && s.sixStar.max !== s.base.max;
          return (
            <div
              key={s.stat}
              className={cx(
                'flex items-baseline justify-between gap-3 text-xs',
                highlight === s.stat && 'rounded bg-white/6 px-1.5 py-0.5',
              )}
            >
              <dt className="truncate text-ink-500">{s.stat}</dt>
              <dd className={cx('numeric font-bold', bumped ? 'text-ore-400' : 'text-ink-300')}>
                {fmt(r)}
              </dd>
            </div>
          );
        })}
      </dl>

      <div className="mt-3 border-t border-white/6 pt-3">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[11px] font-semibold text-ink-500">Recipe</span>
          {item.price != null && (
            <span className="numeric text-[11px] text-ore-400">{money(item.price)}</span>
          )}
          {item.currency && (
            <span className="numeric text-[11px] text-ore-400">
              {item.currencyAmount?.toLocaleString('en-US')} {item.currency}
            </span>
          )}
        </div>
        <ul className="space-y-0.5">
          {parts.map((r, i) => (
            <li key={i} className="flex items-center gap-2 text-xs">
              <span className="numeric w-7 shrink-0 rounded bg-white/6 py-0.5 text-center text-[11px] font-bold text-ore-300">
                {r.qty}
              </span>
              {r.mineral ? (
                <Link to={`/minerals/${r.mineral.id}`} className="truncate text-ink-300 hover:text-ore-400">
                  {r.item}
                </Link>
              ) : (
                <span className="truncate text-ink-300">{r.item}</span>
              )}
              {r.minWeight && (
                <span className="numeric shrink-0 text-[10px] text-ink-500">+{r.minWeight}kg</span>
              )}
              {r.catalyst && (
                <span
                  title="Catalyst for mutations"
                  className="shrink-0 rounded bg-vein-500/15 px-1 text-[10px] font-bold text-vein-400"
                >
                  c
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {bp && <BlueprintPanel blueprint={bp} />}
    </div>
  );
}


