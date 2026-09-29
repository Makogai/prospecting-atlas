import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  builds, buildStages, buildGuide, equipment, minerals, blueprintById,
  equipRarityColors, BUILD_GOALS, goalMeta,
  type Build, type BuildMuseumRow,
} from '../lib/db';
import { Empty, Sprite, cx, gradientVars } from '../components/ui';
import { BlueprintNote } from '../components/Blueprint';

/** Equipment and ore names in the guide are matched back to our own data. */
const equipByName = new Map(
  equipment.map((e) => [e.name.toLowerCase().replace(/’/g, "'"), e]),
);
const mineralByName = new Map(minerals.map((m) => [m.name.toLowerCase(), m]));

const findEquip = (name: string) =>
  equipByName.get(name.toLowerCase().replace(/’/g, "'")) ?? null;

export function BuildsPage() {
  const [stage, setStage] = useState<string>('III');
  const [goal, setGoal] = useState<string>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const forStage = useMemo(() => builds.filter((b) => b.stage === stage), [stage]);
  const rows = useMemo(
    () => (goal === 'all' ? forStage : forStage.filter((b) => b.goal === goal)),
    [forStage, goal],
  );

  // Only offer the goals that actually exist at this stage.
  const goalsHere = useMemo(() => {
    const present = new Set(forStage.map((b) => b.goal));
    return BUILD_GOALS.filter((g) => present.has(g.id));
  }, [forStage]);

  const current = buildStages.find((s) => s.stage === stage);

  return (
    <div className="animate-rise">
      <header className="mb-6">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Builds</h1>
        <p className="mt-1 max-w-3xl text-ink-400">
          What to wear, what to put in your museum and which runes to slot — for wherever you are in
          the game.
        </p>
      </header>

      {/* --- step 1: where are you? Roman numerals mean nothing; places do. --- */}
      <section className="mb-5">
        <h2 className="mb-2 text-xs font-extrabold tracking-[0.12em] text-ink-500 uppercase">
          1 · How far have you got?
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {buildStages.map((s, i) => {
            const on = stage === s.stage;
            const bonus = s.stage === 'Bonus';
            return (
              <button
                key={s.stage}
                onClick={() => {
                  setStage(s.stage);
                  setGoal('all');
                  setOpenId(null);
                }}
                aria-pressed={on}
                className={cx(
                  'rounded-xl border p-3 text-left transition',
                  on
                    ? 'border-ore-400/60 bg-ore-400/12'
                    : 'border-white/8 bg-white/3 hover:border-white/20 hover:bg-white/6',
                )}
              >
                <div className="flex items-baseline gap-1.5">
                  {!bonus && (
                    <span
                      className={cx(
                        'numeric text-[10px] font-bold',
                        on ? 'text-ore-400' : 'text-ink-500',
                      )}
                    >
                      {i + 1}
                    </span>
                  )}
                  <span className={cx('text-sm font-bold', on ? 'text-ink-100' : 'text-ink-300')}>
                    {s.area}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-ink-500">
                  {s.highest ? `up to ${s.highest}` : 'Outside the main progression'}
                </p>
              </button>
            );
          })}
        </div>
        {current?.highest && (
          <p className="mt-2 text-xs text-ink-500">
            Pick the furthest place you can dig — these builds assume{' '}
            <span className="text-ink-400">{current.highest}</span> is your best site.
          </p>
        )}
      </section>

      {/* --- step 2: what do you want out of it? --- */}
      {goalsHere.length > 1 && (
        <section className="mb-5">
          <h2 className="mb-2 text-xs font-extrabold tracking-[0.12em] text-ink-500 uppercase">
            2 · What are you after?
          </h2>
          <div className="flex flex-wrap gap-1.5">
            <GoalChip
              label="Everything"
              count={forStage.length}
              on={goal === 'all'}
              onClick={() => setGoal('all')}
            />
            {goalsHere.map((g) => (
              <GoalChip
                key={g.id}
                label={g.label}
                blurb={g.blurb}
                count={forStage.filter((b) => b.goal === g.id).length}
                on={goal === g.id}
                onClick={() => setGoal(g.id)}
              />
            ))}
          </div>
          {goal !== 'all' && (
            <p className="mt-2 text-xs text-ink-500">{goalMeta(goal)?.blurb}</p>
          )}
        </section>
      )}

      {rows.length === 0 ? (
        <Empty>Nothing for that combination.</Empty>
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

      <p className="mt-8 max-w-3xl text-xs leading-relaxed text-ink-500">
        These builds are the work of the{' '}
        <a
          href={buildGuide.url}
          target="_blank"
          rel="noreferrer noopener"
          className="font-semibold text-ore-400 underline decoration-ore-400/30 underline-offset-2 hover:decoration-ore-400"
        >
          {buildGuide.title}
        </a>{' '}
        authors — {buildGuide.authors.join(', ')} — mirrored here so every item links into the rest
        of the atlas. The guide says it is “subject to change without warning”, so treat the doc as
        the source of truth; this is a snapshot from {buildGuide.snapshot}.
      </p>
    </div>
  );
}

function GoalChip({
  label, blurb, count, on, onClick,
}: {
  label: string;
  blurb?: string;
  count: number;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={blurb}
      aria-pressed={on}
      className={cx(
        'rounded-lg px-3 py-1.5 text-xs font-bold transition',
        on ? 'bg-ore-400 text-rock-950' : 'bg-white/5 text-ink-400 hover:bg-white/10 hover:text-ink-100',
      )}
    >
      {label} <span className="numeric opacity-60">{count}</span>
    </button>
  );
}

function BuildCard({
  build: b, open, onToggle,
}: {
  build: Build;
  open: boolean;
  onToggle: () => void;
}) {
  const meta = goalMeta(b.goal);
  const slots: [string, Build['equipment']['rings']][] = [
    ['Charm', b.equipment.charm],
    ['Necklace', b.equipment.neck],
    ['Rings', b.equipment.rings],
    ['Pan', b.equipment.pan],
    ['Shovel', b.equipment.shovel],
  ];

  // Blueprint-gated pieces are the real barrier to actually assembling this.
  const gated = [...b.equipment.charm, ...b.equipment.neck, ...b.equipment.rings]
    .map((e) => findEquip(e.name))
    .filter((e): e is NonNullable<typeof e> => Boolean(e?.blueprint));

  return (
    <section className={cx('panel overflow-hidden', open && 'border-white/16')}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-4 px-5 py-4 text-left transition hover:bg-white/4"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {meta && (
              <span className="rounded bg-vein-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-vein-400 uppercase">
                {meta.label}
              </span>
            )}
            <h2 className="text-lg font-black">{b.name}</h2>
            {b.sellingOnly && (
              <span className="rounded bg-ore-400/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-ore-300 uppercase">
                selling only
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-ink-400">{b.purpose}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {b.formula && (
              <span className="numeric rounded bg-white/6 px-2 py-0.5 text-[11px] text-ink-300">
                one-tap check: {b.formula}
              </span>
            )}
            {gated.length > 0 && (
              <span className="rounded bg-ore-400/10 px-2 py-0.5 text-[11px] text-ore-300">
                needs {gated.length} blueprint{gated.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </div>
        <span
          className={cx(
            'shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition',
            open ? 'bg-white/10 text-ink-200' : 'bg-ore-400 text-rock-950',
          )}
        >
          {open ? 'Close' : 'Open build'}
        </span>
      </button>

      {open && (
        <div className="space-y-6 border-t border-white/8 px-5 py-5">
          {b.notes.length > 0 && (
            <div className="rounded-xl bg-white/4 p-3.5">
              <p className="mb-1.5 text-[11px] font-bold tracking-wide text-ink-500 uppercase">
                Before you start
              </p>
              <ul className="space-y-1">
                {b.notes.map((n, i) => (
                  <li key={i} className="flex gap-2 text-xs text-ink-400">
                    <span className="text-ink-600">•</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-xs font-extrabold tracking-[0.1em] text-ink-400 uppercase">
              Wear this
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {slots.map(([label, entries]) =>
                entries.length === 0 ? null : (
                  <div key={label} className="rounded-xl bg-white/4 p-3">
                    <p className="mb-1.5 text-[11px] font-bold tracking-wide text-ink-500 uppercase">
                      {label}
                    </p>
                    <ul className="space-y-2">
                      {entries.map((e, i) => (
                        <EquipLine key={i} entry={e} />
                      ))}
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

          {b.museum.length > 0 && (
            <div>
              <h3 className="mb-1 text-xs font-extrabold tracking-[0.1em] text-ink-400 uppercase">
                Put these in the museum
              </h3>
              <p className="mb-2 text-xs text-ink-500">
                Each slot wants one of the ores listed, at least that heavy.
                {b.modifier && (
                  <>
                    {' '}
                    Modifier: <span className="text-ink-400">{b.modifier}</span>
                  </>
                )}
              </p>
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

function EquipLine({ entry }: { entry: Build['equipment']['rings'][number] }) {
  const item = findEquip(entry.name);
  const bp = item?.blueprint ? blueprintById.get(item.blueprint) : null;

  return (
    <li className="flex items-start gap-2">
      {item && <Sprite file={item.image} alt="" className="mt-0.5 h-7 w-7 shrink-0" />}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-1.5 text-sm">
          {entry.count > 1 && (
            <span className="numeric font-bold text-ore-300">
              {entry.count}×
              {entry.countSixRing != null && (
                <span className="opacity-60">/{entry.countSixRing}×</span>
              )}
            </span>
          )}
          {item ? (
            <Link
              to={`/equipment?q=${encodeURIComponent(item.name)}`}
              className="font-semibold hover:underline"
              style={item.color ? { color: item.color } : undefined}
            >
              {entry.name}
            </Link>
          ) : (
            <span className="font-semibold text-ink-200">{entry.name}</span>
          )}
          {item && (
            <span
              className="gradient-text text-[10px] font-bold uppercase"
              style={gradientVars(equipRarityColors(item.rarity))}
            >
              {item.rarity}
            </span>
          )}
        </span>
        {entry.note && <span className="block text-[11px] text-ink-500">{entry.note}</span>}
        {bp && <BlueprintNote blueprint={bp} compact />}
      </span>
    </li>
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
        {row.pick > 1 && <span className="text-[10px] text-ink-500">pick {row.pick}</span>}
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
