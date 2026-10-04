import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  equipment, equipmentById, equipRarityColors, events, gearPrice, museum, museumOreById,
  mutations, pans, percent, potions, runes, shovels, SLOT_LIMITS,
  type Enchant, type Equipment, type EquipSlot, type Gear, type RarityName,
} from '../lib/db';
import { slotKey } from '../lib/museumBuild';
import {
  BOOST_SOURCES, computeBuild, DEFAULT_BUILD, isEmptyBuild, MASTERY_TRACKS, PERMANENTS,
  PLANNER_BUILDS_KEY, PLANNER_KEY, runeEffectById,
  type CustomEntry, type PlannerEquip, type PlannerState,
} from '../lib/planner';
import { decodePlanner, encodePlanner, plannerCode } from '../lib/plannerCode';
import {
  gearLines, panById, PANEL_STATS, panEnchants, RIDER_MODIFIERS, shovelById, shovelEnchants,
  type StatKey,
} from '../lib/stats';
import { makeBuild, readBuilds, writeBuilds, type SavedBuild } from '../lib/buildLibrary';
import { BuildLibrary, ShareBox } from '../components/BuildLibrary';
import { MobileDock } from '../components/MobileDock';
import { OrePicker, PedestalTile } from '../components/MuseumSlots';
import { EmptySlot, PickerDialog, RichSelect, type PickerOption } from '../components/Picker';
import { StatPanel, fmt } from '../components/StatPanel';
import { NumberField, SectionTitle, Sprite, cx, gradientVars } from '../components/ui';

/* ---------- storage ------------------------------------------------------ */

function useSavedBuild(): [PlannerState, (next: PlannerState) => void] {
  const [state, setState] = useState<PlannerState>(() => {
    try {
      const raw = localStorage.getItem(PLANNER_KEY);
      // Spread over the defaults rather than trusting the stored shape: a build
      // saved before a field existed must still open.
      if (raw) return { ...DEFAULT_BUILD, ...(JSON.parse(raw) as PlannerState) };
    } catch {
      /* blocked storage — an empty build is a fine starting point */
    }
    return DEFAULT_BUILD;
  });

  useEffect(() => {
    try {
      localStorage.setItem(PLANNER_KEY, JSON.stringify(state));
    } catch {
      /* not worth surfacing */
    }
  }, [state]);

  return [state, setState];
}

/* ---------- page --------------------------------------------------------- */

export function PlannerPage() {
  const [params, setParams] = useSearchParams();
  const [saved, setSaved] = useSavedBuild();

  // A link carrying any build parameter is somebody else's build. It's held
  // apart from your own and never written to storage on its own — opening a
  // friend's link must not quietly replace the build you spent an evening on.
  const sharedKeys = ['p', 's', 'eq', 'mu', 'bo', 'ru', 'ma', 'po', 'ev', 'pm', 'cu', 'ft', 'fo'];
  const viewingShared = sharedKeys.some((k) => params.has(k));
  const decoded = useMemo(() => (viewingShared ? decodePlanner(params) : null), [params, viewingShared]);
  const build = decoded ? decoded.state : saved;

  /** Edits go wherever you're working: your own build, or the link itself. */
  const setBuild = (next: PlannerState) => {
    if (!viewingShared) {
      setSaved(next);
      return;
    }
    const q = encodePlanner(next);
    // Anything not ours on the URL stays, so a highlight or tab param survives.
    for (const [k, v] of params) if (!sharedKeys.includes(k)) q.set(k, v);
    setParams(q, { replace: true });
  };

  const patch = (bits: Partial<PlannerState>) => setBuild({ ...build, ...bits });

  const takeOver = () => {
    setSaved(build);
    setParams(new URLSearchParams(), { replace: true });
  };

  const lines = useMemo(() => computeBuild(build), [build]);
  const luck = lines.find((l) => l.stat.key === 'Luck');

  const panelRef = useRef<HTMLDivElement>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [library, setLibrary] = useState<SavedBuild[]>(() => readBuilds(PLANNER_BUILDS_KEY));
  const code = plannerCode(build);

  const saveBuild = (name: string) => {
    const next = [makeBuild(name, code), ...library];
    setLibrary(next);
    writeBuilds(PLANNER_BUILDS_KEY, next);
  };
  const removeBuild = (id: string) => {
    const next = library.filter((b) => b.id !== id);
    setLibrary(next);
    writeBuilds(PLANNER_BUILDS_KEY, next);
  };
  const loadBuild = (b: SavedBuild) => {
    setParams(new URLSearchParams(b.code), { replace: false });
    setShareOpen(false);
  };

  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/planner?${code}` : `/planner?${code}`;

  // Searching a stat name lands here with it named, so open that row.
  const openStat = params.get('stat');
  const panel = <StatPanel lines={lines} openStat={openStat} />;

  return (
    <div className="animate-rise">
      <SectionTitle
        title="Build planner"
        hint="Everything that moves a number — gear, enchants, what you wear, the museum, your buffs — folded into the stat panel the game would show you, with every point traced back to where it came from."
      />

      {viewingShared && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-ore-400/30 bg-ore-400/8 px-4 py-3">
          <p className="flex-1 text-sm text-ink-200">
            You’re looking at a shared build. Edits stay in this link — your own build is untouched.
          </p>
          <button
            onClick={takeOver}
            className="rounded-lg bg-ore-400 px-3 py-1.5 text-xs font-bold text-rock-950 transition hover:bg-ore-300"
          >
            Make this mine
          </button>
        </div>
      )}

      {decoded && (decoded.dropped.length > 0 || decoded.overfilled) && (
        <p className="mb-6 rounded-xl border border-white/10 bg-white/4 px-4 py-2.5 text-xs text-ink-400">
          {decoded.dropped.length > 0 && (
            <>This link names {decoded.dropped.length} item{decoded.dropped.length > 1 && 's'} the
              site doesn’t have any more, so {decoded.dropped.length > 1 ? 'they were' : 'it was'} left
              out: <span className="text-ink-300">{decoded.dropped.join(', ')}</span>. </>
          )}
          {decoded.overfilled && 'It also asked for more of a slot than the game allows.'}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* The panel comes first on a phone: it's the thing you're building,
            and below seven sections nobody would ever scroll to it. */}
        <div
          ref={panelRef}
          // `min-w-0`: a grid item's min-width defaults to `auto`, which is its
          // content's min-content width, so a track will happily blow past the
          // viewport rather than let a child shrink. Without it this column
          // measured 1,394px inside a 347px grid at phone width.
          className="order-first min-w-0 space-y-3 lg:order-none lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:sticky lg:top-16 lg:self-start"
        >
          {panel}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShareOpen((v) => !v)}
              disabled={isEmptyBuild(build)}
              className="rounded-lg bg-white/8 px-3 py-2 text-xs font-semibold text-ink-200 transition hover:bg-white/14 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Share this build
            </button>
            <button
              onClick={() => setBuild(DEFAULT_BUILD)}
              disabled={isEmptyBuild(build)}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-ink-500 transition hover:text-ore-400 disabled:opacity-40"
            >
              Clear
            </button>
          </div>
          {shareOpen && (
            <ShareBox
              url={shareUrl}
              onClose={() => setShareOpen(false)}
              note="Carries the whole build — gear, rolls, mutations, museum, buffs and your own entries."
            />
          )}
          <BuildLibrary
            builds={library}
            canSave={!isEmptyBuild(build)}
            activeCode={code}
            onSave={saveBuild}
            onLoad={loadBuild}
            onRemove={removeBuild}
            hint="Keep a few: a Luck build for hunting, a Sell build for cashing out."
          />
        </div>

        <div className="min-w-0 space-y-4 lg:col-span-7 lg:col-start-1 lg:row-start-1">
          <GearSection build={build} patch={patch} />
          <EquipSection build={build} patch={patch} />
          <MuseumSection build={build} patch={patch} />
          <BuffSection build={build} patch={patch} />
          <PotionSection build={build} patch={patch} />
          <PermanentSection build={build} patch={patch} />
          <CustomSection build={build} patch={patch} />
        </div>
      </div>

      <Footnotes />

      <MobileDock
        label="Your stats"
        value={luck && luck.total > 0 ? `${fmt(luck.total)} Luck` : undefined}
        meta={summarise(build)}
        anchorRef={panelRef}
      >
        {panel}
      </MobileDock>
    </div>
  );
}

function summarise(build: PlannerState) {
  const bits = [
    build.pan && panById.get(build.pan)?.name,
    build.equips.length > 0 && `${build.equips.length} worn`,
    Object.values(build.museum).filter(Boolean).length > 0 &&
      `${Object.values(build.museum).filter(Boolean).length} displays`,
  ].filter(Boolean);
  return bits.length ? bits.join(' · ') : 'Nothing picked yet';
}

/* ---------- section shell ------------------------------------------------ */

function Section({
  title, hint, summary, children, defaultOpen = false,
}: {
  title: string;
  hint: string;
  /** What's in it, shown on the closed header so you needn't open everything. */
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="panel overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-white/3"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold">{title}</span>
          {/* What's in it once there is something; the hint only while closed,
              because the body repeats it the moment you open the section. */}
          {(summary || !open) && (
            <span className="mt-0.5 block truncate text-xs text-ink-500">{summary || hint}</span>
          )}
        </span>
        <span aria-hidden className={cx('shrink-0 text-[10px] text-ink-500 transition', open && 'rotate-180')}>
          ▼
        </span>
      </button>
      {open && (
        <div className="border-t border-white/8 px-5 py-4">
          <p className="mb-4 text-xs leading-relaxed text-ink-500">{hint}</p>
          {children}
        </div>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-ink-400">{label}</span>
      {children}
    </label>
  );
}

/* ---------- gear --------------------------------------------------------- */

/**
 * Gear as something you can judge at a glance.
 *
 * The meta line is the item's actual panel contribution rather than the wiki's
 * table columns, so a pan reads as the lines it will put on your stat screen —
 * passives included, which is where a third of a Nebula Pan's value lives.
 */
const gearOptions = (list: Gear[], kind: 'pan' | 'shovel'): PickerOption[] =>
  list.map((g) => ({
    id: g.id,
    name: g.name,
    image: g.image,
    color: g.color,
    meta: [...gearLines(g, kind)].map(([stat, v]) => `${fmt(v)} ${stat}`).join(' · '),
    tag: gearPrice(g),
    muted: !g.obtainable,
    haystack: `${g.passive ?? ''} ${g.source}`,
  }));

const enchantOptions = (list: Enchant[]): PickerOption[] =>
  list.map((e) => ({
    id: e.id,
    name: e.name,
    meta: e.effect,
    tag: e.bestChance != null ? `${percent(e.bestChance)} best roll` : undefined,
    haystack: e.stats.join(' '),
  }));

function GearSection({ build, patch }: SectionProps) {
  const pan = build.pan ? panById.get(build.pan) : null;
  const shovel = build.shovel ? shovelById.get(build.shovel) : null;
  const panOptions = useMemo(() => gearOptions(pans, 'pan'), []);
  const shovelOptions = useMemo(() => gearOptions(shovels, 'shovel'), []);
  const panEnchantOptions = useMemo(() => enchantOptions(panEnchants), []);
  const shovelEnchantOptions = useMemo(() => enchantOptions(shovelEnchants), []);

  return (
    <Section
      defaultOpen
      title="Pan and shovel"
      hint="Your pan and shovel are most of your base. An enchant only ever changes the item it sits on — it multiplies that item’s own line, then adds its points."
      summary={[pan?.name, shovel?.name].filter(Boolean).join(' · ')}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-3">
          <RichSelect
            label="Pan"
            title="Choose a pan"
            value={build.pan}
            options={panOptions}
            placeholder="Choose a pan"
            clearLabel="No pan"
            onChange={(pan) => patch({ pan })}
          />
          <RichSelect
            label="Pan enchant"
            title="Choose a pan enchant"
            value={build.panEnchant}
            options={panEnchantOptions}
            placeholder="No enchant"
            clearLabel="No enchant"
            onChange={(panEnchant) => patch({ panEnchant })}
          />
          {pan?.passive && <Passive text={pan.passive} />}
        </div>

        <div className="space-y-3">
          <RichSelect
            label="Shovel"
            title="Choose a shovel"
            value={build.shovel}
            options={shovelOptions}
            placeholder="Choose a shovel"
            clearLabel="No shovel"
            onChange={(shovel) => patch({ shovel })}
          />
          <RichSelect
            label="Shovel enchant"
            title="Choose a shovel enchant"
            value={build.shovelEnchant}
            options={shovelEnchantOptions}
            placeholder="No enchant"
            clearLabel="No enchant"
            onChange={(shovelEnchant) => patch({ shovelEnchant })}
          />
          {shovel?.passive && <Passive text={shovel.passive} />}
        </div>
      </div>

      <p className="mt-4 rounded-lg bg-white/4 px-3 py-2 text-[11px] leading-relaxed text-ink-500">
        Shovel enchants mostly change how digging behaves rather than what the panel reads —
        Mythical duplicates Mythic and Exotic finds, Mastered brings auto-panning to full quality.
        Only Toughened and Treasure Hunter move a stat.{' '}
        <Link to="/enchanting" className="text-ore-400 hover:underline">
          All the odds are on the enchanting page.
        </Link>
      </p>
    </Section>
  );
}

function Passive({ text }: { text: string }) {
  return (
    <p className="rounded-lg bg-white/4 px-2.5 py-1.5 text-[11px] leading-snug text-ink-500">
      <span className="font-semibold text-ink-400">Passive</span> — {text}
    </p>
  );
}

/* ---------- equipment ---------------------------------------------------- */

const EQUIP_SLOTS: EquipSlot[] = ['Necklace', 'Charm', 'Ring'];

const equipOptions = (slot: EquipSlot): PickerOption[] =>
  equipment
    .filter((e) => e.slot === slot)
    .map((e) => ({
      id: e.id,
      name: e.name,
      image: e.image,
      color: e.color,
      meta:
        e.stats
          .map((st) => `${st.base.min}–${st.base.max}${st.base.unit ?? ''} ${st.stat}`)
          .join(' · ') || 'no stats listed',
      tag: e.rarity,
      haystack: `${e.rarity} ${e.description} ${e.limited ? 'limited event' : ''}`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

function EquipSection({ build, patch }: SectionProps) {
  const [picking, setPicking] = useState<EquipSlot | null>(null);
  const options = useMemo(() => (picking ? equipOptions(picking) : []), [picking]);

  const add = (id: string | null) => {
    if (id) {
      patch({ equips: [...build.equips, { id, quality: build.quality, mutation: null }] });
    }
    setPicking(null);
  };

  const update = (at: number, bits: Partial<PlannerEquip>) =>
    patch({ equips: build.equips.map((e, i) => (i === at ? { ...e, ...bits } : e)) });

  const remove = (at: number) => patch({ equips: build.equips.filter((_, i) => i !== at) });

  return (
    <Section
      title="What you’re wearing"
      hint="One necklace, one charm and eight rings. Each piece rolled on its own, so quality is per item — two of the same ring can be 95% and 55%. A mutation multiplies everything on that piece."
      summary={
        build.equips.length > 0
          ? `${build.equips.length}/10 equipped${build.sixStar ? ' · ★6' : ''}`
          : ''
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs font-semibold text-ink-300">
          <input
            type="checkbox"
            checked={build.sixStar}
            onChange={(e) => patch({ sixStar: e.target.checked })}
            className="accent-ore-400"
          />
          Merged to ★6
        </label>
        <label className="flex items-center gap-2 text-xs text-ink-400">
          New pieces roll at
          <span className="w-16">
            <NumberField
              value={build.quality}
              min={1}
              max={100}
              ariaLabel="Default roll quality"
              onChange={(quality) => patch({ quality })}
              className="py-1 text-center text-xs"
            />
          </span>
          %
        </label>
        {build.equips.length > 0 && (
          <button
            onClick={() =>
              patch({ equips: build.equips.map((e) => ({ ...e, quality: build.quality })) })
            }
            className="text-[11px] font-semibold text-ink-500 underline underline-offset-2 hover:text-ore-400"
          >
            Set every piece to that
          </button>
        )}
      </div>

      <div className="space-y-4">
        {EQUIP_SLOTS.map((slot) => {
          const rows = build.equips
            .map((e, at) => ({ ...e, at, item: equipmentById.get(e.id) }))
            .filter((r) => r.item?.slot === slot);
          const free = (SLOT_LIMITS[slot] ?? 0) - rows.length;
          return (
            <div key={slot}>
              <p className="mb-1.5 text-[11px] font-bold tracking-[0.1em] text-ink-500 uppercase">
                {slot} <span className="opacity-60">{rows.length}/{SLOT_LIMITS[slot]}</span>
              </p>

              {/* An equipped piece is a row because it carries two controls that
                  need the width. The slots you have not filled are tiles, so the
                  shape of the build is legible before it is finished — six empty
                  ring slots should look like six empty ring slots. */}
              <div className="space-y-1.5">
                {rows.map((r) => (
                  <EquipRow
                    key={r.at}
                    item={r.item!}
                    entry={r}
                    onChange={(bits) => update(r.at, bits)}
                    onRemove={() => remove(r.at)}
                  />
                ))}
              </div>

              {free > 0 && (
                <div
                  className={cx(
                    'grid gap-2',
                    rows.length > 0 && 'mt-2',
                    slot === 'Ring' ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3',
                  )}
                >
                  {Array.from({ length: free }, (_, i) => (
                    <EmptySlot key={i} label={slot} onClick={() => setPicking(slot)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
        A piece’s stats sit in a range and the roll decides where in it you land. The wiki gives
        the ranges and the percentage but not exactly how the two meet, so this interpolates
        straight across — treat it as close, not exact.{' '}
        <Link to="/equipment" className="text-ore-400 hover:underline">
          Browse all {equipment.length} craftables.
        </Link>
      </p>

      {picking && (
        <PickerDialog
          title={`Add a ${picking.toLowerCase()}`}
          options={options}
          onClose={() => setPicking(null)}
          onChoose={add}
        />
      )}
    </Section>
  );
}

function EquipRow({
  item, entry, onChange, onRemove,
}: {
  item: Equipment;
  entry: PlannerEquip;
  onChange: (bits: Partial<PlannerEquip>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white/5 p-1.5">
      <Sprite file={item.image} alt="" className="h-9 w-9 shrink-0" />
      <span className="min-w-0 flex-1">
        <span
          className="block truncate text-xs font-bold"
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

      <select
        aria-label={`Mutation on this ${item.name}`}
        value={entry.mutation ?? ''}
        onChange={(e) => onChange({ mutation: e.target.value || null })}
        className="shrink-0 rounded border border-white/10 bg-rock-850 px-1.5 py-1 text-[11px] text-ink-200 outline-none"
      >
        <option value="">No mutation</option>
        {mutations.mutations.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} ×{m.multiplier}
          </option>
        ))}
      </select>

      <label className="flex shrink-0 items-center gap-0.5">
        <span className="sr-only">Roll quality for this {item.name}</span>
        <input
          type="text"
          inputMode="numeric"
          value={entry.quality}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^0-9]/g, '');
            if (digits !== '') onChange({ quality: Math.min(Math.max(Number(digits), 1), 100) });
          }}
          className="w-8 rounded bg-white/6 px-1 py-0.5 text-center text-[11px] font-bold outline-none focus:bg-white/12"
        />
        <span className="text-[10px] text-ink-500">%</span>
      </label>

      <button
        onClick={onRemove}
        aria-label={`Remove ${item.name}`}
        className="shrink-0 rounded px-1.5 py-0.5 text-ink-500 transition hover:bg-white/10 hover:text-ore-400"
      >
        ✕
      </button>
    </div>
  );
}

/* ---------- museum ------------------------------------------------------- */

function MuseumSection({ build, patch }: SectionProps) {
  const [picking, setPicking] = useState<{ rarity: RarityName; index: number } | null>(null);
  const [rankBy, setRankBy] = useState<string>('Luck');

  const filled = Object.values(build.museum).filter(Boolean).length;
  const chosen = Object.values(build.museum).filter(Boolean) as string[];

  const setSlot = (key: string, oreId: string | null) => {
    // A display with nothing in it cannot carry a modifier either.
    const riders = { ...build.riders };
    if (!oreId) delete riders[key];
    patch({ museum: { ...build.museum, [key]: oreId }, riders });
  };

  const setRider = (key: string, name: string) =>
    patch({
      riders: name
        ? { ...build.riders, [key]: name }
        : Object.fromEntries(Object.entries(build.riders).filter(([k]) => k !== key)),
    });

  return (
    <Section
      title="Museum"
      hint="Each display adds twice: the ore’s own fixed boost, plus a rider from the modifier that ore carries. Riders scale with the row — 0.005 at Common up to 0.08 at Exotic. All of it lands in the boost pile."
      summary={filled > 0 ? `${filled}/18 displays filled` : ''}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold text-ink-400">Rank ores by</span>
        <select
          value={rankBy}
          onChange={(e) => setRankBy(e.target.value)}
          className="rounded-lg border border-white/10 bg-rock-850 px-2.5 py-1.5 text-xs outline-none"
        >
          {museum.stats.map((st) => <option key={st} value={st}>{st}</option>)}
        </select>
        <Link to="/museum" className="text-[11px] font-semibold text-ore-400 hover:underline">
          Or let the museum planner fill it for you →
        </Link>
      </div>

      {/* A rarity owns three displays, so they read as three across. Laid out
          two-wide they wrap, which strands the third on a row of its own and
          makes an even shelf look broken. */}
      <div className="space-y-3">
        {museum.displays.map((display) => (
          <div key={display.rarity}>
            <p className="mb-1.5 text-[11px] font-bold tracking-[0.1em] text-ink-500 uppercase">
              {display.rarity} <span className="opacity-60">×{display.total}</span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: display.total }, (_, index) => {
                const key = slotKey(display.rarity, index);
                const oreId = build.museum[key];
                const ore = oreId ? museumOreById.get(oreId) : null;
                return (
                  <PedestalTile
                    key={key}
                    ore={ore}
                    stats={[rankBy]}
                    locked={index >= display.free}
                    onPick={() => setPicking({ rarity: display.rarity, index })}
                    onClear={() => setSlot(key, null)}
                  >
                    <select
                      aria-label={`Modifier on ${ore?.name ?? 'this display'}`}
                      value={build.riders[key] ?? ''}
                      onChange={(e) => setRider(key, e.target.value)}
                      className="mt-1 w-full truncate rounded border border-white/10 bg-rock-850 px-1 py-0.5 text-[10px] text-ink-400 outline-none"
                    >
                      <option value="">No modifier</option>
                      {RIDER_MODIFIERS.map((m) => (
                        <option key={m.name} value={m.name}>{m.name}</option>
                      ))}
                    </select>
                  </PedestalTile>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
        An ore only gives its full display value at or above its listed minimum weight. The wiki
        does not publish the curve below that, so a lighter ore is worth less than shown here by an
        amount nobody has measured.
      </p>

      {picking && (
        <OrePicker
          rarity={picking.rarity}
          stats={[rankBy]}
          chosen={chosen}
          onClose={() => setPicking(null)}
          onChoose={(ore) => {
            setSlot(slotKey(picking.rarity, picking.index), ore.id);
            setPicking(null);
          }}
        />
      )}
    </Section>
  );
}

/* ---------- buffs -------------------------------------------------------- */

function BuffSection({ build, patch }: SectionProps) {
  const active = [
    ...Object.entries(build.boosts).filter(([, n]) => n > 0).map(([id, n]) => {
      const source = BOOST_SOURCES.find((b) => b.id === id);
      return source ? (n > 1 ? `${source.name} ×${n}` : source.name) : null;
    }),
    build.runes.length > 0 && `${build.runes.length} rune${build.runes.length > 1 ? 's' : ''}`,
    build.events.length > 0 && `${build.events.length} event${build.events.length > 1 ? 's' : ''}`,
  ].filter(Boolean);

  const setCount = (id: string, n: number) =>
    patch({ boosts: { ...build.boosts, [id]: Math.max(n, 0) } });

  const toggleRune = (id: string) =>
    patch({
      runes: build.runes.includes(id)
        ? build.runes.filter((r) => r !== id)
        : [...build.runes, id].slice(0, 5),
    });

  const toggleEvent = (id: string) =>
    patch({
      events: build.events.includes(id)
        ? build.events.filter((e) => e !== id)
        : [...build.events, id],
    });

  const statRunes = runes.runes.filter((r) => runeEffectById.has(r.id));

  return (
    <Section
      title="Totems, runes, mastery and events"
      hint="These all land in the boost pile, which is summed once and multiplied in once. Two Luck Totems are not 4× — each adds +1.0 to one pile. The only true multiplier in the game is a weather event, and it applies to Luck at the very end."
      summary={active.join(' · ')}
    >
      <p className="mb-2 text-[11px] font-bold tracking-[0.1em] text-ink-500 uppercase">Boosters</p>
      <div className="mb-5 space-y-1.5">
        {BOOST_SOURCES.map((source) => {
          const n = build.boosts[source.id] ?? 0;
          return (
            <div key={source.id} className="flex items-center gap-3 rounded-lg bg-white/4 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-ink-200">{source.name}</span>
                <span className="block text-[11px] leading-snug text-ink-500">{source.blurb}</span>
              </span>
              {source.max === 1 ? (
                <input
                  type="checkbox"
                  aria-label={source.name}
                  checked={n > 0}
                  onChange={(e) => setCount(source.id, e.target.checked ? 1 : 0)}
                  className="shrink-0 accent-ore-400"
                />
              ) : (
                <span className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => setCount(source.id, n - 1)}
                    disabled={n === 0}
                    aria-label={`One fewer ${source.name}`}
                    className="h-6 w-6 rounded bg-white/8 text-xs font-bold transition hover:bg-white/14 disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="numeric w-5 text-center text-xs font-bold">{n}</span>
                  <button
                    onClick={() => setCount(source.id, Math.min(n + 1, source.max))}
                    disabled={n >= source.max}
                    aria-label={`One more ${source.name}`}
                    className="h-6 w-6 rounded bg-white/8 text-xs font-bold transition hover:bg-white/14 disabled:opacity-30"
                  >
                    +
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Field label="Players in a Friendship Totem circle (0 for none down)">
          <NumberField
            value={build.friendship}
            min={0}
            max={20}
            ariaLabel="Players in the friendship totem circle"
            onChange={(friendship) => patch({ friendship })}
          />
        </Field>
        <Field label="Friends online (+0.10× Luck each, five max)">
          <NumberField
            value={build.friends}
            min={0}
            max={5}
            ariaLabel="Friends online"
            onChange={(friends) => patch({ friends })}
          />
        </Field>
      </div>

      <p className="mb-2 text-[11px] font-bold tracking-[0.1em] text-ink-500 uppercase">
        Runes <span className="opacity-60">{build.runes.length}/5</span>
      </p>
      <div className="mb-5 flex flex-wrap gap-1.5">
        {statRunes.map((rune) => {
          const on = build.runes.includes(rune.id);
          return (
            <button
              key={rune.id}
              onClick={() => toggleRune(rune.id)}
              aria-pressed={on}
              title={rune.effect ?? undefined}
              className={cx(
                'rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition',
                on ? 'bg-vein-500/20 text-vein-300 ring-1 ring-vein-500/50' : 'bg-white/5 text-ink-400 hover:bg-white/10',
              )}
            >
              {rune.name}
            </button>
          );
        })}
      </div>
      <p className="mb-5 text-[11px] leading-relaxed text-ink-500">
        Only the runes that move a stat are listed. The rest change how panning behaves —
        Annihilation destroys ores you don’t want, Discovery raises undiscovered odds.{' '}
        <Link to="/progression?tab=runes" className="text-ore-400 hover:underline">All twenty are here.</Link>
      </p>

      <p className="mb-2 text-[11px] font-bold tracking-[0.1em] text-ink-500 uppercase">Mastery</p>
      <div className="mb-5 grid gap-2 sm:grid-cols-2">
        {MASTERY_TRACKS.map((track) => (
          <label key={track.id} className="flex items-center gap-2 rounded-lg bg-white/4 px-2.5 py-1.5">
            <span className="min-w-0 flex-1 truncate text-[11px] text-ink-300">{track.name}</span>
            <select
              aria-label={track.name}
              value={build.mastery[track.id] ?? 0}
              onChange={(e) => patch({ mastery: { ...build.mastery, [track.id]: Number(e.target.value) } })}
              className="shrink-0 rounded border border-white/10 bg-rock-850 px-1.5 py-0.5 text-[11px] outline-none"
            >
              <option value={0}>—</option>
              {Array.from({ length: track.top }, (_, i) => (
                <option key={i} value={i + 1}>{i + 1} (+{((i + 1) * 5)}%)</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <p className="mb-5 text-[11px] leading-relaxed text-ink-500">
        A location’s mastery only counts while you’re digging in that location, so tick the one
        you’re planning for rather than all of them.
      </p>

      <p className="mb-2 text-[11px] font-bold tracking-[0.1em] text-ink-500 uppercase">Events</p>
      <div className="flex flex-wrap gap-1.5">
        {events.filter((e) => e.value != null).map((event) => {
          const on = build.events.includes(event.id);
          return (
            <button
              key={event.id}
              onClick={() => toggleEvent(event.id)}
              aria-pressed={on}
              className={cx(
                'rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition',
                on
                  ? event.kind === 'multiplicative'
                    ? 'bg-flux-400/20 text-flux-400 ring-1 ring-flux-400/50'
                    : 'bg-vein-500/20 text-vein-300 ring-1 ring-vein-500/50'
                  : 'bg-white/5 text-ink-400 hover:bg-white/10',
              )}
            >
              {event.name}
              <span className="ml-1 opacity-60">
                {event.kind === 'multiplicative' ? `×${event.value}` : `+${event.value}`}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-500">
        Purple events are true multipliers on your finished Luck and stack with each other — a
        meteor plus one weather event is ×3. Green ones join the pile with everything else.
      </p>
    </Section>
  );
}

/* ---------- potions ------------------------------------------------------ */

function PotionSection({ build, patch }: SectionProps) {
  const toggle = (id: string) =>
    patch({
      potions: build.potions.includes(id)
        ? build.potions.filter((p) => p !== id)
        : [...build.potions, id],
    });

  return (
    <Section
      title="Potions"
      hint="Potions are flats: raw points added to your base before the pile multiplies in. That makes them worth most on a build whose multiplier is already large."
      summary={build.potions.length > 0 ? `${build.potions.length} running` : ''}
    >
      <div className="space-y-1.5">
        {potions.map((potion) => {
          const on = build.potions.includes(potion.id);
          return (
            <button
              key={potion.id}
              onClick={() => toggle(potion.id)}
              aria-pressed={on}
              className={cx(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition',
                on ? 'bg-tide-400/15 ring-1 ring-tide-400/40' : 'bg-white/4 hover:bg-white/8',
              )}
            >
              <Sprite file={potion.image} alt="" className="h-8 w-8 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-ink-200">{potion.name}</span>
                <span className="numeric block truncate text-[11px] text-ink-500">{potion.effect}</span>
              </span>
              {potion.duration && (
                <span className="numeric shrink-0 text-[10px] text-ink-600">{potion.duration}</span>
              )}
            </button>
          );
        })}
      </div>
    </Section>
  );
}

/* ---------- permanents --------------------------------------------------- */

function PermanentSection({ build, patch }: SectionProps) {
  const live = PERMANENTS.filter((p) => (build.permanents[p.id] ?? 0) > 0);

  return (
    <Section
      title="Lifetime rewards"
      hint="Quest permanents and the Experience buff are flats that grow with your own totals — the site can list the rate but only you know the count. This is where a dredge bonus actually lives: it isn’t a stat, it’s +3 Luck for every Dredge Master quest you’ve finished."
      summary={live.length > 0 ? live.map((p) => p.name).join(' · ') : ''}
    >
      <div className="space-y-2">
        {PERMANENTS.map((perm) => {
          const value = build.permanents[perm.id] ?? 0;
          const set = (n: number) => patch({ permanents: { ...build.permanents, [perm.id]: n } });
          return (
            <div key={perm.id} className="flex items-center gap-3 rounded-lg bg-white/4 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-ink-200">{perm.name}</span>
                <span className="block text-[11px] leading-snug text-ink-500">{perm.blurb}</span>
              </span>
              {perm.max === 1 ? (
                <input
                  type="checkbox"
                  aria-label={perm.name}
                  checked={value > 0}
                  onChange={(e) => set(e.target.checked ? 1 : 0)}
                  className="shrink-0 accent-ore-400"
                />
              ) : (
                <span className="w-20 shrink-0">
                  <NumberField
                    value={value}
                    min={0}
                    max={perm.max}
                    ariaLabel={`${perm.name} — ${perm.countLabel}`}
                    onChange={set}
                    className="py-1 text-center text-xs"
                  />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* ---------- your own ----------------------------------------------------- */

function CustomSection({ build, patch }: SectionProps) {
  const add = () =>
    patch({
      custom: [
        ...build.custom,
        { id: `c${Date.now()}`, stat: 'Luck', label: '', value: 0, band: 'flat' as const },
      ],
    });

  const update = (at: number, bits: Partial<CustomEntry>) =>
    patch({ custom: build.custom.map((c, i) => (i === at ? { ...c, ...bits } : c)) });

  const remove = (at: number) => patch({ custom: build.custom.filter((_, i) => i !== at) });

  return (
    <Section
      title="Your own entries"
      hint="For anything the site has no number for — an MVP perk, a buff from an event nobody has measured, or a figure you read straight off your own panel. Points go in as flats; a percentage joins the boost pile."
      summary={build.custom.length > 0 ? `${build.custom.length} added` : ''}
    >
      <div className="space-y-2">
        {build.custom.map((entry, at) => (
          <div key={entry.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/4 p-2">
            <input
              value={entry.label}
              onChange={(e) => update(at, { label: e.target.value.slice(0, 40) })}
              placeholder="What is it?"
              aria-label="What this entry is"
              className="min-w-32 flex-1 rounded border border-white/10 bg-white/4 px-2 py-1 text-xs outline-none focus:border-ore-400/50"
            />
            <select
              value={entry.stat}
              onChange={(e) => update(at, { stat: e.target.value as StatKey })}
              aria-label="Which stat"
              className="shrink-0 rounded border border-white/10 bg-rock-850 px-1.5 py-1 text-[11px] outline-none"
            >
              {PANEL_STATS.map((s) => <option key={s.key} value={s.key}>{s.key}</option>)}
            </select>
            <select
              value={entry.band}
              onChange={(e) => update(at, { band: e.target.value as 'flat' | 'boost' })}
              aria-label="Flat points or a percentage boost"
              className="shrink-0 rounded border border-white/10 bg-rock-850 px-1.5 py-1 text-[11px] outline-none"
            >
              <option value="flat">points</option>
              <option value="boost">% boost</option>
            </select>
            <span className="w-20 shrink-0">
              <NumberField
                value={entry.value}
                min={-100000}
                ariaLabel="How much"
                onChange={(value) => update(at, { value })}
                className="py-1 text-center text-xs"
              />
            </span>
            <button
              onClick={() => remove(at)}
              aria-label="Remove this entry"
              className="shrink-0 rounded px-1.5 py-0.5 text-ink-500 transition hover:bg-white/10 hover:text-ore-400"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={add}
        className="mt-3 rounded-lg bg-white/8 px-3 py-1.5 text-xs font-semibold text-ink-200 transition hover:bg-white/14"
      >
        Add an entry
      </button>

      <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
        A percentage entry is read the way the game reads a boost: 50 means +0.50 into the pile, not
        a separate ×1.5. Nothing in the game multiplies on its own except a weather event.
      </p>
    </Section>
  );
}

/* ---------- footnotes ---------------------------------------------------- */

function Footnotes() {
  return (
    <section className="mt-10 panel p-5">
      <h2 className="text-sm font-extrabold">How the numbers are worked out</h2>
      <p className="numeric mt-3 rounded-xl bg-rock-950/50 px-4 py-3 text-sm text-ore-300">
        Total = (Base + Flats) × (1 + ΣBoosts) × Events
      </p>
      <dl className="mt-3 space-y-2 text-xs leading-relaxed text-ink-400">
        <div>
          <dt className="inline font-bold text-ore-300">Base</dt>
          <dd className="inline"> — your pan, shovel, necklace, charm and rings. This is the number
            the game shows in parentheses.</dd>
        </div>
        <div>
          <dt className="inline font-bold text-tide-400">Flats</dt>
          <dd className="inline"> — raw points on top: potions, quest permanents, Experience.</dd>
        </div>
        <div>
          <dt className="inline font-bold text-vein-400">Boosts</dt>
          <dd className="inline"> — every percentage bonus, added into one pile and multiplied in
            once. Totems, the museum, runes, mastery, the XP Cookie, friends. They never multiply
            each other: ten +100% boosts make ×11, not ×1024.</dd>
        </div>
        <div>
          <dt className="inline font-bold text-flux-400">Events</dt>
          <dd className="inline"> — the one true multiplier, applied to Luck at the very end.</dd>
        </div>
      </dl>
      <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
        The formula and its constants come from the wiki’s Stat Systems Guide, whose authors derived
        them by equipping one item at a time and reading the panel. Our build reproduces their
        worked examples exactly, including the one measured at 3,549 Dig Strength. What is{' '}
        <em>not</em> settled: how a roll percentage maps across a stat’s range, how much a museum
        ore loses below its minimum weight, and what the two scaling runes mean by “5%”. Each of
        those says so where it appears rather than being quietly guessed at.
      </p>
      <p className="mt-2 text-[11px] text-ink-500">
        Toughness, Inventory Size, Status Timer Speed and Jump Power take no multiplier at all, so
        boosts are listed against them but never applied.
      </p>
    </section>
  );
}

interface SectionProps {
  build: PlannerState;
  patch: (bits: Partial<PlannerState>) => void;
}
