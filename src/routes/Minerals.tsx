import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  minerals, rarities, digSites, money, odds, bestSiteFor,
  type Mineral, type RarityName,
} from '../lib/db';
import { Empty, RarityChip, RarityTag, SiteTag, Sprite, cx } from '../components/ui';

type SortKey = 'value' | 'rarity' | 'name' | 'rate';
type View = 'grid' | 'table';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'value', label: 'Value' },
  { key: 'rarity', label: 'Rarity' },
  { key: 'rate', label: 'Rarest drop' },
  { key: 'name', label: 'A–Z' },
];

/** Best (lowest) 1-in figure across a mineral's non-conditional drops. */
const rarestOdds = (m: Mineral) => {
  const solid = m.chances.filter((c) => !c.conditional && c.oneIn != null);
  return solid.length ? Math.min(...solid.map((c) => c.oneIn!)) : Infinity;
};

export function Minerals() {
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<View>('grid');
  const [sort, setSort] = useState<SortKey>('value');
  const [desc, setDesc] = useState(true);

  const q = params.get('q') ?? '';
  const activeRarities = new Set((params.get('rarity') ?? '').split(',').filter(Boolean));
  const site = params.get('site') ?? '';

  const patch = (next: Record<string, string>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) v ? p.set(k, v) : p.delete(k);
    setParams(p, { replace: true });
  };

  const toggleRarity = (r: RarityName) => {
    const next = new Set(activeRarities);
    next.has(r) ? next.delete(r) : next.add(r);
    patch({ rarity: [...next].join(',') });
  };

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = minerals.filter((m) => {
      if (activeRarities.size && !activeRarities.has(m.rarity)) return false;
      if (site && !m.chances.some((c) => c.site === site)) return false;
      if (needle && !`${m.name} ${m.description}`.toLowerCase().includes(needle)) return false;
      return true;
    });

    const dir = desc ? -1 : 1;
    out = [...out].sort((a, b) => {
      switch (sort) {
        case 'value':
          return dir * ((a.value ?? 0) - (b.value ?? 0));
        case 'rarity': {
          const ra = rarities.findIndex((r) => r.name === a.rarity);
          const rb = rarities.findIndex((r) => r.name === b.rarity);
          return dir * (ra - rb || (a.value ?? 0) - (b.value ?? 0));
        }
        case 'rate':
          return dir * (rarestOdds(a) - rarestOdds(b));
        default:
          return -dir * a.name.localeCompare(b.name);
      }
    });
    return out;
  }, [q, site, sort, desc, params]);

  const siteOptions = useMemo(
    () => [...digSites].sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  return (
    <div className="animate-rise">
      <header className="mb-6">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Minerals</h1>
        <p className="mt-1 text-ink-400">
          All {minerals.length} minerals with their value, rarity and where they actually drop.
        </p>
      </header>

      {/* --- filter bar --- */}
      <div className="panel-sticky sticky top-14 z-30 mb-6 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => patch({ q: e.target.value })}
            placeholder="Filter by name…"
            className="min-w-45 flex-1 rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-sm outline-none transition placeholder:text-ink-500 focus:border-ore-400/50 focus:bg-white/7"
          />

          <select
            value={site}
            onChange={(e) => patch({ site: e.target.value })}
            className="rounded-lg border border-white/10 bg-rock-850 px-3 py-2 text-sm outline-none focus:border-ore-400/50"
          >
            <option value="">Any dig site</option>
            {siteOptions.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/4 p-1">
            {SORTS.map((s) => (
              <button
                key={s.key}
                onClick={() => (sort === s.key ? setDesc((d) => !d) : (setSort(s.key), setDesc(true)))}
                className={cx(
                  'rounded px-2.5 py-1 text-xs font-semibold transition',
                  sort === s.key ? 'bg-ore-400 text-rock-950' : 'text-ink-400 hover:text-ink-100',
                )}
              >
                {s.label}
                {sort === s.key && <span className="ml-1">{desc ? '↓' : '↑'}</span>}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/4 p-1">
            {(['grid', 'table'] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-label={`${v} view`}
                className={cx(
                  'rounded px-2.5 py-1 text-xs font-semibold capitalize transition',
                  view === v ? 'bg-white/12 text-ink-100' : 'text-ink-400 hover:text-ink-100',
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {rarities.map((r) => (
            <RarityChip
              key={r.name}
              rarity={r.name}
              on={activeRarities.has(r.name)}
              onClick={() => toggleRarity(r.name)}
            />
          ))}

          <span className="numeric ml-auto text-xs text-ink-500">
            {results.length} of {minerals.length}
          </span>

          {(q || site || activeRarities.size > 0) && (
            <button
              onClick={() => setParams({}, { replace: true })}
              className="rounded-md px-2 py-1 text-xs font-semibold text-ink-400 underline underline-offset-2 hover:text-ore-400"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {results.length === 0 ? (
        <Empty>No mineral matches those filters.</Empty>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {results.map((m) => (
            <MineralCard key={m.id} mineral={m} />
          ))}
        </div>
      ) : (
        <MineralTable rows={results} />
      )}
    </div>
  );
}

function MineralCard({ mineral: m }: { mineral: Mineral }) {
  const best = bestSiteFor(m);
  const colors = rarities.find((r) => r.name === m.rarity)?.colors ?? [];
  return (
    <Link
      to={`/minerals/${m.id}`}
      className="panel panel-hover group flex flex-col overflow-hidden p-3"
    >
      <div className="relative mb-2 grid h-24 place-items-center">
        <div
          aria-hidden
          className="absolute h-16 w-16 rounded-full opacity-25 blur-2xl transition group-hover:opacity-50"
          style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors.at(-1)})` }}
        />
        <Sprite
          file={m.image}
          alt={m.name}
          className="h-20 w-20 transition duration-300 group-hover:scale-110"
        />
      </div>

      <RarityTag rarity={m.rarity} className="self-start" />

      <h3 className="mt-1.5 truncate text-sm font-bold" title={m.name}>
        {m.name}
      </h3>
      <p className="numeric text-sm font-bold text-ore-400">{money(m.value)}<span className="text-[10px] font-medium text-ink-500">/kg</span></p>

      <div className="mt-auto pt-2 text-[11px] text-ink-500">
        {best ? (
          <>
            <span className="text-ink-400">Best:</span> {best.site.name}
            <span className="numeric ml-1 text-ink-500">· {odds(best.chance.oneIn)}</span>
          </>
        ) : (
          'No drop data'
        )}
      </div>
    </Link>
  );
}

function MineralTable({ rows }: { rows: Mineral[] }) {
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-white/8 text-left text-[11px] tracking-[0.12em] text-ink-500 uppercase">
            <th className="px-4 py-3 font-semibold">Mineral</th>
            <th className="px-4 py-3 font-semibold">Rarity</th>
            <th className="px-4 py-3 text-right font-semibold">Value /kg</th>
            <th className="px-4 py-3 font-semibold">Best odds</th>
            <th className="px-4 py-3 font-semibold">Found at</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const best = bestSiteFor(m);
            return (
              <tr key={m.id} className="border-b border-white/5 transition last:border-0 hover:bg-white/4">
                <td className="px-4 py-2.5">
                  <Link to={`/minerals/${m.id}`} className="flex items-center gap-3 font-semibold hover:text-ore-400">
                    <Sprite file={m.image} alt="" className="h-9 w-9 shrink-0" />
                    <span className="min-w-0">
                      <span className="block truncate">{m.name}</span>
                      <span className="block truncate text-xs font-normal text-ink-500">
                        {m.description}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <RarityTag rarity={m.rarity} />
                </td>
                <td className="numeric px-4 py-2.5 text-right font-bold text-ore-400">
                  {money(m.value)}
                </td>
                <td className="numeric px-4 py-2.5 text-xs text-ink-300">
                  {best ? odds(best.chance.oneIn) : '—'}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {m.chances.slice(0, 3).map((c) => (
                      <SiteTag key={c.site} name={c.site} />
                    ))}
                    {m.chances.length > 3 && (
                      <span className="numeric self-center text-xs text-ink-500">
                        +{m.chances.length - 3}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
