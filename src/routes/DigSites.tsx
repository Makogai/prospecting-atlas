import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { digSites, locationForSite, money, rarityByName } from '../lib/db';
import { RarityTag, Sprite, cx, gradientVars } from '../components/ui';
import { mineralById } from '../lib/db';

type Sort = 'ev' | 'count' | 'name';

export function DigSites() {
  const [sort, setSort] = useState<Sort>('ev');

  const sites = useMemo(
    () =>
      [...digSites].sort((a, b) =>
        sort === 'ev'
          ? b.expectedValue - a.expectedValue
          : sort === 'count'
            ? b.mineralCount - a.mineralCount
            : a.name.localeCompare(b.name),
      ),
    [sort],
  );

  const best = sites.reduce((m, s) => Math.max(m, s.expectedValue), 0);

  return (
    <div className="animate-rise">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Dig Sites</h1>
          <p className="mt-1 max-w-2xl text-ink-400">
            Every site’s full loot table in one place. <strong className="text-ink-300">Avg. value</strong>{' '}
            is what a single pull is worth on average, weighting each mineral by its own drop rate.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/4 p-1">
          {([
            ['ev', 'Avg. value'],
            ['count', 'Variety'],
            ['name', 'A–Z'],
          ] as [Sort, string][]).map(([k, label]) => (
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
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sites.map((s) => {
          const loc = locationForSite(s);
          const top = s.minerals
            .filter((m) => (m.value ?? 0) > 0)
            .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
            .slice(0, 5);
          const conditional = s.minerals.every((m) => m.conditional);

          return (
            <Link
              key={s.id}
              to={`/sites/${s.id}`}
              className="panel panel-hover group relative overflow-hidden p-5"
            >
              <div
                aria-hidden
                className="absolute -top-16 -right-10 h-40 w-40 rounded-full opacity-15 blur-3xl transition group-hover:opacity-30"
                style={{ background: `linear-gradient(135deg, ${s.colors[0]}, ${s.colors.at(-1)})` }}
              />

              <div className="relative">
                <h2
                  className="gradient-text text-xl font-black"
                  style={gradientVars(s.colors)}
                >
                  {s.name}
                </h2>
                <p className="mt-0.5 text-xs text-ink-500">
                  {loc ? loc.name : 'Standalone site'}
                  {conditional && ' · rotating loot pool'}
                </p>

                <div className="mt-4 flex items-end gap-5">
                  <div>
                    <div className="numeric text-2xl font-black text-ore-400">
                      {money(s.expectedValue)}
                    </div>
                    <div className="text-[10px] font-semibold tracking-[0.1em] text-ink-500 uppercase">
                      avg / pull
                    </div>
                  </div>
                  <div>
                    <div className="numeric text-2xl font-black">{s.mineralCount}</div>
                    <div className="text-[10px] font-semibold tracking-[0.1em] text-ink-500 uppercase">
                      minerals
                    </div>
                  </div>
                  {s.topRarity && (
                    <div className="ml-auto self-center">
                      <RarityTag rarity={s.topRarity} />
                    </div>
                  )}
                </div>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/7">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(4, (s.expectedValue / best) * 100)}%`,
                      background: `linear-gradient(90deg, ${s.colors[0]}, ${s.colors.at(-1)})`,
                    }}
                  />
                </div>

                <div className="mt-4 flex items-center gap-1">
                  {top.map((t) => {
                    const full = mineralById.get(t.id);
                    return (
                      <span
                        key={t.id}
                        title={`${t.name} · ${money(t.value)}`}
                        className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 ring-1 ring-white/8"
                      >
                        <Sprite file={full?.image} alt={t.name} className="h-7 w-7" />
                      </span>
                    );
                  })}
                  <span className="ml-1 text-[11px] text-ink-500">top value</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-ink-500">
        Rarity shown is the highest tier the site can produce. Sites whose entire table is marked
        “if in loot pool” (The Void) rotate their contents, so their average is an upper bound.
        {' '}Colours come straight from the wiki’s own{' '}
        <span className="text-ink-400">{rarityByName.size}-tier</span> rarity scale.
      </p>
    </div>
  );
}
