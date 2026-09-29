import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  builds, buildGuide, equipment, minerals, equipRarityColors,
  type Build, type BuildMuseumRow,
} from '../lib/db';
import { Empty, Sprite, cx, gradientVars } from '../components/ui';

const STAGES = ['V', 'IV', 'III', 'II', 'I', '0', 'Bonus'];

const STAGE_AREA: Record<string, string> = {
  V: 'Desert',
  IV: 'Meteor Valley',
  III: 'Swamp',
  II: 'Overgrown Caves',
  I: 'Snowy Isle',
  '0': 'Caldera',
  Bonus: 'Bonus builds',
};

/** Equipment and ore names in the guide are matched back to our own data. */
const equipByName = new Map(equipment.map((e) => [e.name.toLowerCase(), e]));
const mineralByName = new Map(minerals.map((m) => [m.name.toLowerCase(), m]));

const findEquip = (name: string) => {
  const key = name.toLowerCase().replace(/'/g, '’');
  return (
    equipByName.get(name.toLowerCase()) ??
    equipment.find((e) => e.name.toLowerCase().replace(/’/g, "'") === name.toLowerCase()) ??
    equipByName.get(key) ??
    null
  );
};

export function BuildsPage() {
  const [stage, setStage] = useState<string>('V');
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(() => builds.filter((b) => b.stage === stage), [stage]);

  return (
    <div className="animate-rise">
      <header className="mb-6">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Builds</h1>
        <p className="mt-1 max-w-3xl text-ink-400">
          Community loadouts for every game stage — which equipment to wear, which ores to put in
          the museum, and which runes to slot.
        </p>

        <div className="panel mt-4 p-4">
          <p className="text-sm text-ink-300">
            These builds are the work of the{' '}
            <a
              href={buildGuide.url}
              target="_blank"
              rel="noreferrer noopener"
              className="font-semibold text-ore-400 underline decoration-ore-400/30 underline-offset-2 hover:decoration-ore-400"
            >
              {buildGuide.title}
            </a>{' '}
            authors — {buildGuide.authors.join(', ')}.
          </p>
          <p className="mt-1.5 text-xs text-ink-500">
            Mirrored here so the item names link into the rest of the atlas. The guide says it is
            “subject to change without warning”, so treat the doc as the source of truth — this is a
            snapshot taken {buildGuide.snapshot}.
          </p>
        </div>
      </header>

      <div className="panel sticky top-16 z-30 mb-5 flex flex-wrap items-center gap-1 p-2">
        {STAGES.map((s) => (
          <button
            key={s}
            onClick={() => { setStage(s); setOpenId(null); }}
            className={cx(
              'rounded-lg px-3 py-1.5 text-sm font-bold transition',
              stage === s ? 'bg-ore-400 text-rock-950' : 'text-ink-400 hover:bg-white/6 hover:text-ink-100',
            )}
          >
            {s === 'Bonus' ? 'Bonus' : `Stage ${s}`}
            <span className="ml-1.5 text-[11px] opacity-60">
              {builds.filter((b) => b.stage === s).length}
            </span>
          </button>
        ))}
        <span className="ml-auto pr-2 text-xs text-ink-500">{STAGE_AREA[stage]}</span>
      </div>

      {rows.length === 0 ? (
        <Empty>No builds recorded for that stage.</Empty>
      ) : (
        <div className="space-y-3">
          {rows.map((b) => (
            <BuildCard
              key={b.id}
              build={b}
              open={openId === b.id}
              onToggle={() => setOpenId(openId === b.id ? null : b.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BuildCard({
  build: b, open, onToggle,
}: {
  build: Build;
  open: boolean;
  onToggle: () => void;
}) {
  const slots: [string, typeof b.equipment.charm][] = [
    ['Charm', b.equipment.charm],
    ['Neck', b.equipment.neck],
    ['Rings', b.equipment.rings],
    ['Pan', b.equipment.pan],
    ['Shovel', b.equipment.shovel],
  ];

  return (
    <section className="panel overflow-hidden">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-4 px-5 py-4 text-left transition hover:bg-white/4"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-black">{b.name}</h2>
            {b.sellingOnly && (
              <span className="rounded bg-ore-400/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-ore-300 uppercase">
                selling only
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-ink-400">{b.purpose}</p>
          {b.formula && (
            <p className="numeric mt-1.5 inline-block rounded bg-vein-500/12 px-2 py-0.5 text-xs text-vein-400">
              {b.formula}
            </p>
          )}
        </div>
        <span className="shrink-0 text-xs font-semibold text-ink-500">
          {open ? 'Hide' : 'Show'} build
        </span>
      </button>

      {open && (
        <div className="space-y-6 border-t border-white/8 px-5 py-5">
          {b.notes.length > 0 && (
            <ul className="space-y-1">
              {b.notes.map((n, i) => (
                <li key={i} className="flex gap-2 text-xs text-ink-400">
                  <span className="text-ink-600">•</span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          )}

          {/* --- equipment --- */}
          <div>
            <h3 className="mb-2 text-xs font-extrabold tracking-[0.1em] text-ink-400 uppercase">
              Equipment
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {slots.map(([label, entries]) =>
                entries.length === 0 ? null : (
                  <div key={label} className="rounded-xl bg-white/4 p-3">
                    <p className="mb-1.5 text-[11px] font-bold tracking-wide text-ink-500 uppercase">
                      {label}
                    </p>
                    <ul className="space-y-1.5">
                      {entries.map((e, i) => {
                        const item = findEquip(e.name);
                        return (
                          <li key={i} className="flex items-start gap-2">
                            {item && <Sprite file={item.image} alt="" className="mt-0.5 h-6 w-6 shrink-0" />}
                            <span className="min-w-0 flex-1">
                              <span className="text-sm">
                                {e.count > 1 && (
                                  <span className="numeric mr-1 font-bold text-ore-300">
                                    {e.count}×
                                    {e.countSixRing != null && (
                                      <span className="opacity-60">/{e.countSixRing}×</span>
                                    )}
                                  </span>
                                )}
                                {item ? (
                                  <Link
                                    to={`/equipment?q=${encodeURIComponent(item.name)}`}
                                    className="font-semibold hover:text-ore-400"
                                    style={item.color ? { color: item.color } : undefined}
                                  >
                                    {e.name}
                                  </Link>
                                ) : (
                                  <span className="font-semibold text-ink-200">{e.name}</span>
                                )}
                              </span>
                              {e.note && (
                                <span className="block text-[11px] text-ink-500">{e.note}</span>
                              )}
                              {item && (
                                <span
                                  className="gradient-text block text-[10px] font-bold uppercase"
                                  style={gradientVars(equipRarityColors(item.rarity))}
                                >
                                  {item.rarity}
                                </span>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ),
              )}
            </div>

            {b.equipment.runes.length > 0 && (
              <div className="mt-2 rounded-xl bg-white/4 p-3">
                <p className="mb-1.5 text-[11px] font-bold tracking-wide text-ink-500 uppercase">
                  Runes
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {b.equipment.runes.map((r, i) => (
                    <span
                      key={i}
                      className="rounded-md bg-white/6 px-2 py-0.5 text-xs font-semibold text-ink-300"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* --- museum --- */}
          {b.museum.length > 0 && (
            <div>
              <h3 className="mb-1 text-xs font-extrabold tracking-[0.1em] text-ink-400 uppercase">
                Museum
              </h3>
              {b.modifier && (
                <p className="mb-2 text-xs text-ink-500">
                  <span className="font-semibold text-ink-400">Modifier:</span> {b.modifier}
                </p>
              )}
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {b.museum.map((row, i) => (
                  <MuseumRow key={i} row={row} />
                ))}
              </div>
            </div>
          )}

          {b.credit && <p className="text-[11px] text-ink-500">Build by {b.credit}</p>}
        </div>
      )}
    </section>
  );
}

function MuseumRow({ row }: { row: BuildMuseumRow }) {
  return (
    <div className="rounded-xl bg-white/4 p-2.5">
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        {row.rarity && (
          <span
            className="gradient-text text-[10px] font-bold tracking-wider uppercase"
            style={gradientVars(equipRarityColors(row.rarity))}
          >
            {row.rarity}
          </span>
        )}
        {row.codes.map((c) => (
          <span
            key={c}
            className="rounded bg-vein-500/15 px-1.5 text-[10px] font-semibold text-vein-400"
          >
            {c}
          </span>
        ))}
        {row.pick > 1 && (
          <span className="text-[10px] text-ink-500">pick {row.pick}</span>
        )}
      </div>
      <ul className="space-y-0.5">
        {row.options.map((o, i) => {
          const m = mineralByName.get(o.ore.toLowerCase());
          return (
            <li key={i} className="flex items-center gap-1.5 text-xs">
              {m && <Sprite file={m.image} alt="" className="h-5 w-5 shrink-0" />}
              {m ? (
                <Link to={`/minerals/${m.id}`} className="truncate text-ink-300 hover:text-ore-400">
                  {o.ore}
                </Link>
              ) : (
                <span className="truncate text-ink-300">{o.ore}</span>
              )}
              {o.minWeight != null && (
                <span className="numeric shrink-0 text-[10px] text-ore-400">{o.minWeight}kg</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
