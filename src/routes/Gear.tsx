import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  gearGroups, gearStatMax, GEAR_LABEL, GEAR_STATS, STAT_LABEL,
  gearPrice, gearPriceOrder, statBar, digSiteByName, type Gear, type GearKind,
} from '../lib/db';
import { Empty, SectionTitle, SiteTag, Sprite, cx } from '../components/ui';

const KINDS = Object.keys(gearGroups) as GearKind[];

const BLURB: Record<GearKind, string> = {
  pans: 'Pans decide how much you pull per dig and how lucky you get. Luck is the stat that unlocks rarer minerals.',
  shovels: 'Shovels gate which dig sites you can even enter — Toughness is the requirement, Strength is throughput.',
  sluices: 'Sluices run passively while you play or while you are offline. Luck scales far higher here than on pans.',
};

type Sort = 'price' | 'name' | string;

export function GearPage() {
  const { kind } = useParams();
  const active = (KINDS.includes(kind as GearKind) ? kind : 'pans') as GearKind;
  const items = gearGroups[active];
  const stats = GEAR_STATS[active];
  const maxes = gearStatMax[active];

  const [sort, setSort] = useState<Sort>('price');
  const [picked, setPicked] = useState<string[]>([]);

  // Reset per-kind state when switching tabs.
  useEffect(() => {
    setSort('price');
    setPicked([]);
  }, [active]);

  const rows = useMemo(() => {
    const out = [...items];
    if (sort === 'price') out.sort((a, b) => gearPriceOrder(a) - gearPriceOrder(b));
    else if (sort === 'name') out.sort((a, b) => a.name.localeCompare(b.name));
    else out.sort((a, b) => (b.stats[sort] ?? 0) - (a.stats[sort] ?? 0));
    return out;
  }, [items, sort]);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-3)));

  const comparison = picked.map((id) => items.find((i) => i.id === id)!).filter(Boolean);

  return (
    <div className="animate-rise">
      <header className="mb-6">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Gear</h1>
        <p className="mt-1 max-w-2xl text-ink-400">{BLURB[active]}</p>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/4 p-1">
          {KINDS.map((k) => (
            <Link
              key={k}
              to={`/gear/${k}`}
              className={cx(
                'rounded-lg px-4 py-1.5 text-sm font-bold transition',
                k === active ? 'bg-ore-400 text-rock-950' : 'text-ink-400 hover:text-ink-100',
              )}
            >
              {GEAR_LABEL[k]}
              <span className="numeric ml-1.5 text-[11px] opacity-60">{gearGroups[k].length}</span>
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1 rounded-lg border border-white/10 bg-white/4 p-1">
          <SortBtn on={sort === 'price'} onClick={() => setSort('price')}>
            Price
          </SortBtn>
          {stats.map((s) => (
            <SortBtn key={s} on={sort === s} onClick={() => setSort(s)}>
              {STAT_LABEL[s] ?? s}
            </SortBtn>
          ))}
        </div>
      </div>

      {comparison.length > 1 && (
        <section className="mb-8">
          <SectionTitle
            title="Side by side"
            hint="Pick up to three. Bars are log-scaled against the best in this category."
            action={
              <button
                onClick={() => setPicked([])}
                className="text-xs font-semibold text-ink-400 underline underline-offset-2 hover:text-ore-400"
              >
                Clear
              </button>
            }
          />
          <div className="panel overflow-x-auto p-5">
            <div className="grid min-w-[520px] gap-5" style={{ gridTemplateColumns: `repeat(${comparison.length}, minmax(0,1fr))` }}>
              {comparison.map((g) => (
                <div key={g.id}>
                  <div className="flex items-center gap-3">
                    <Sprite file={g.image} alt="" className="h-12 w-12 shrink-0" />
                    <div className="min-w-0">
                      <div
                        className="truncate font-bold"
                        style={g.color ? { color: g.color } : undefined}
                      >
                        {g.name}
                      </div>
                      <div className="numeric text-xs text-ore-400">{gearPrice(g)}</div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2.5">
                    {stats.map((s) => (
                      <StatBar
                        key={s}
                        label={STAT_LABEL[s] ?? s}
                        value={g.stats[s] ?? 0}
                        max={maxes[s]}
                        best={comparison.every((o) => (o.stats[s] ?? 0) <= (g.stats[s] ?? 0))}
                      />
                    ))}
                  </div>
                  {g.passive && (
                    <p className="mt-3 rounded-lg bg-vein-500/12 px-2.5 py-1.5 text-[11px] text-vein-400 ring-1 ring-vein-500/20">
                      {g.passive}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {rows.length === 0 ? (
        <Empty>No {GEAR_LABEL[active].toLowerCase()} recorded.</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((g) => (
            <GearCard
              key={g.id}
              gear={g}
              stats={stats}
              maxes={maxes}
              picked={picked.includes(g.id)}
              onToggle={() => toggle(g.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SortBtn({
  on, onClick, children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'rounded px-2.5 py-1 text-xs font-semibold transition',
        on ? 'bg-white/12 text-ink-100' : 'text-ink-400 hover:text-ink-100',
      )}
    >
      {children}
    </button>
  );
}

function StatBar({
  label, value, max, best,
}: {
  label: string;
  value: number;
  max: number;
  best?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[11px]">
        <span className="text-ink-500">{label}</span>
        <span className={cx('numeric font-bold', best ? 'text-ore-400' : 'text-ink-300')}>
          {value}
          {best && <span className="ml-1 text-[9px] uppercase">best</span>}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/7">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${statBar(value, max)}%`,
            background: best
              ? 'linear-gradient(90deg,#f5a623,#ffd98a)'
              : 'linear-gradient(90deg,#48526b,#6b7285)',
          }}
        />
      </div>
    </div>
  );
}

function GearCard({
  gear: g, stats, maxes, picked, onToggle,
}: {
  gear: Gear;
  stats: string[];
  maxes: Record<string, number>;
  picked: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      id={g.id}
      className={cx(
        'panel p-5 transition scroll-mt-20',
        picked ? 'border-ore-400/50 bg-ore-400/6' : 'panel-hover',
      )}
    >
      <div className="flex items-start gap-4">
        <Sprite file={g.image} alt={g.name} className="h-16 w-16 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3
            className="truncate text-base font-extrabold"
            style={g.color ? { color: g.color } : undefined}
            title={g.name}
          >
            {g.name}
          </h3>
          <p className="numeric text-sm font-bold text-ore-400">{gearPrice(g)}</p>
        </div>
        <button
          onClick={onToggle}
          aria-pressed={picked}
          className={cx(
            'shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold transition',
            picked
              ? 'bg-ore-400 text-rock-950'
              : 'bg-white/6 text-ink-400 hover:bg-white/12 hover:text-ink-100',
          )}
        >
          {picked ? 'Picked' : 'Compare'}
        </button>
      </div>

      <p className="mt-3 line-clamp-2 h-8 text-xs text-ink-400">{g.description}</p>

      <div className="mt-3 space-y-2">
        {stats.map((s) => (
          <StatBar key={s} label={STAT_LABEL[s] ?? s} value={g.stats[s] ?? 0} max={maxes[s]} />
        ))}
      </div>

      {g.passive && (
        <p className="mt-3 rounded-lg bg-vein-500/12 px-2.5 py-1.5 text-[11px] font-semibold text-vein-400 ring-1 ring-vein-500/20">
          {g.passive}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/6 pt-3">
        <span className="text-[11px] text-ink-500">From</span>
        {g.sourceRefs.length > 0 ? (
          g.sourceRefs.map((r) =>
            digSiteByName.has(r) ? (
              <SiteTag key={r} name={r} />
            ) : (
              <span key={r} className="text-[11px] text-ink-300">
                {r}
              </span>
            ),
          )
        ) : (
          <span className="text-[11px] text-ink-300">{g.source || 'Unknown'}</span>
        )}
      </div>
    </div>
  );
}
