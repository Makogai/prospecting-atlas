import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  digSiteById, mineralById, locationForSite, rarities, rarityByName,
  money, odds, percent, type SiteMineral, type RarityName,
} from '../lib/db';
import {
  Empty, OddsBar, RarityChip, RarityTag, SectionTitle, Sprite, cx, gradientVars,
} from '../components/ui';
import { WhoIsHere } from '../components/WhoIsHere';

type Sort = 'chance' | 'value' | 'ev' | 'rarity';

const SORTS: [Sort, string][] = [
  ['chance', 'Drop rate'],
  ['value', 'Value'],
  ['ev', 'Value × rate'],
  ['rarity', 'Rarity'],
];

export function DigSiteDetail() {
  const { id } = useParams();
  const site = id ? digSiteById.get(id) : undefined;
  const [sort, setSort] = useState<Sort>('chance');
  const [rarityFilter, setRarityFilter] = useState<Set<RarityName>>(new Set());

  const rows = useMemo(() => {
    if (!site) return [];
    const filtered = site.minerals.filter(
      (m) => rarityFilter.size === 0 || rarityFilter.has(m.rarity),
    );
    const ev = (m: SiteMineral) => ((m.percent ?? 0) / 100) * (m.value ?? 0);
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case 'value':
          return (b.value ?? 0) - (a.value ?? 0);
        case 'ev':
          return ev(b) - ev(a);
        case 'rarity': {
          const ra = rarities.findIndex((r) => r.name === a.rarity);
          const rb = rarities.findIndex((r) => r.name === b.rarity);
          return rb - ra || (b.value ?? 0) - (a.value ?? 0);
        }
        default:
          return (b.percent ?? -1) - (a.percent ?? -1);
      }
    });
  }, [site, sort, rarityFilter]);

  if (!site) {
    return (
      <Empty>
        <div>
          <p className="mb-3">Unknown dig site.</p>
          <Link to="/sites" className="font-semibold text-ore-400 hover:underline">
            Back to dig sites
          </Link>
        </div>
      </Empty>
    );
  }

  const loc = locationForSite(site);
  const rotating = site.minerals.length > 0 && site.minerals.every((m) => m.conditional);

  // Rarity mix drives the stacked bar under the header.
  const mix = rarities
    .map((r) => ({
      rarity: r,
      count: site.minerals.filter((m) => m.rarity === r.name).length,
    }))
    .filter((x) => x.count > 0);

  const jackpot = [...site.minerals].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];

  return (
    <div className="animate-rise">
      <Link
        to="/sites"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-400 transition hover:text-ore-400"
      >
        ← All dig sites
      </Link>

      <div className="panel relative overflow-hidden p-6 sm:p-8">
        <div
          aria-hidden
          className="absolute -top-28 -right-16 h-80 w-80 rounded-full opacity-20 blur-3xl"
          style={{ background: `linear-gradient(135deg, ${site.colors[0]}, ${site.colors.at(-1)})` }}
        />

        <div className="relative">
          {loc && (
            <Link
              to={`/locations/${loc.id}`}
              className="text-xs font-semibold tracking-[0.12em] text-ink-500 uppercase hover:text-ore-400"
            >
              {loc.name}
            </Link>
          )}
          <h1
            className="gradient-text text-4xl font-black tracking-tight sm:text-5xl"
            style={gradientVars(site.colors)}
          >
            {site.name}
          </h1>

          {rotating && (
            <p className="mt-2 inline-block rounded-lg bg-white/6 px-3 py-1 text-xs text-ink-300 ring-1 ring-white/10">
              Loot pool rotates — everything here is conditional on being in the current pool.
            </p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Figure label="Avg / pull" value={money(site.expectedValue)} accent="#ffc247" />
            <Figure label="Minerals" value={String(site.mineralCount)} />
            <Figure
              label="Jackpot"
              value={jackpot ? money(jackpot.value) : '—'}
              sub={jackpot?.name}
            />
            <Figure
              label="Top tier"
              value={site.topRarity ?? '—'}
              accent={site.topRarity ? rarityByName.get(site.topRarity)?.colors[0] : undefined}
            />
          </div>

          {/* rarity mix */}
          <div className="mt-5">
            <div className="flex h-2.5 overflow-hidden rounded-full bg-white/6">
              {mix.map(({ rarity, count }) => (
                <div
                  key={rarity.name}
                  title={`${count} ${rarity.name}`}
                  style={{
                    width: `${(count / site.mineralCount) * 100}%`,
                    background: `linear-gradient(90deg, ${rarity.colors[0]}, ${rarity.colors.at(-1)})`,
                  }}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {mix.map(({ rarity, count }) => (
                <span key={rarity.name} className="text-[11px] text-ink-400">
                  <span
                    className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
                    style={{ background: rarity.colors[0] }}
                  />
                  {count} {rarity.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <WhoIsHere names={[site.name]} title="Who you'll find at this site" limit={4} />

      <section className="mt-8">
        <SectionTitle
          title="Full loot table"
          hint="Every mineral this site can produce, with its real drop rate."
          action={
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/4 p-1">
              {SORTS.map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setSort(k)}
                  className={cx(
                    'rounded px-2.5 py-1 text-xs font-semibold transition',
                    sort === k ? 'bg-ore-400 text-rock-950' : 'text-ink-400 hover:text-ink-100',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        />

        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {mix.map(({ rarity }) => (
            <RarityChip
              key={rarity.name}
              rarity={rarity.name}
              on={rarityFilter.has(rarity.name)}
              onClick={() =>
                setRarityFilter((prev) => {
                  const next = new Set(prev);
                  next.has(rarity.name) ? next.delete(rarity.name) : next.add(rarity.name);
                  return next;
                })
              }
            />
          ))}
          {rarityFilter.size > 0 && (
            <button
              onClick={() => setRarityFilter(new Set())}
              className="text-xs font-semibold text-ink-400 underline underline-offset-2 hover:text-ore-400"
            >
              Clear
            </button>
          )}
          <span className="numeric ml-auto text-xs text-ink-500">{rows.length} shown</span>
        </div>

        {rows.length === 0 ? (
          <Empty>No minerals match that filter.</Empty>
        ) : (
          <div className="panel divide-y divide-white/6">
            {rows.map((m) => {
              const full = mineralById.get(m.id);
              const contribution = ((m.percent ?? 0) / 100) * (m.value ?? 0);
              return (
                <Link
                  key={m.id}
                  to={`/minerals/${m.id}`}
                  className="flex items-center gap-4 px-4 py-3 transition hover:bg-white/4"
                >
                  <Sprite file={full?.image} alt="" className="h-11 w-11 shrink-0" />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-bold">{m.name}</span>
                      <RarityTag rarity={m.rarity} />
                    </div>
                    <div className="mt-1.5 max-w-sm">
                      <OddsBar percent={m.percent} colors={rarityByName.get(m.rarity)?.colors} />
                    </div>
                  </div>

                  <div className="hidden w-28 shrink-0 text-right sm:block">
                    <div className="numeric text-sm font-bold">{odds(m.oneIn)}</div>
                    <div className="numeric text-[11px] text-ink-500">{percent(m.percent)}</div>
                  </div>

                  <div className="w-24 shrink-0 text-right">
                    <div className="numeric text-sm font-bold text-ore-400">{money(m.value)}</div>
                    <div className="numeric text-[11px] text-ink-500" title="Average value this mineral adds per pull">
                      +{money(contribution)}/pull
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Figure({
  label, value, sub, accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl bg-white/5 px-3.5 py-2.5 ring-1 ring-white/8">
      <div className="text-[10px] font-semibold tracking-[0.12em] text-ink-500 uppercase">
        {label}
      </div>
      <div
        className="numeric truncate text-lg font-black"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
      {sub && <div className="truncate text-[11px] text-ink-500">{sub}</div>}
    </div>
  );
}
