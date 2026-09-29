import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  minerals, digSites, mineralById, locationForSite, money, odds, percent, rarityByName,
} from '../lib/db';
import { Empty, RarityTag, SectionTitle, Sprite, cx, gradientVars } from '../components/ui';

/**
 * Chance of hitting at least one wanted mineral in a single pull:
 * 1 - the product of each target's miss probability.
 */
function combinedChance(percents: number[]) {
  const miss = percents.reduce((acc, p) => acc * (1 - p / 100), 1);
  return (1 - miss) * 100;
}

export function Compare() {
  const [wanted, setWanted] = useState<string[]>([]);
  const [q, setQ] = useState('');

  const toggle = (id: string) =>
    setWanted((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]));

  const suggestions = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return minerals
      .filter((m) => m.name.toLowerCase().includes(needle) && !wanted.includes(m.id))
      .slice(0, 8);
  }, [q, wanted]);

  const picks = wanted.map((id) => mineralById.get(id)!).filter(Boolean);

  const ranked = useMemo(() => {
    if (picks.length === 0) return [];
    return digSites
      .map((site) => {
        const hits = picks
          .map((m) => {
            const c = site.minerals.find((sm) => sm.id === m.id);
            return c ? { mineral: m, chance: c } : null;
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);

        const combined = combinedChance(hits.map((h) => h.chance.percent ?? 0));
        // Average value of a wanted mineral per pull, from this site alone.
        const targetValue = hits.reduce(
          (t, h) => t + ((h.chance.percent ?? 0) / 100) * (h.mineral.value ?? 0),
          0,
        );
        return { site, hits, combined, targetValue, coverage: hits.length / picks.length };
      })
      .filter((r) => r.hits.length > 0)
      .sort(
        (a, b) =>
          b.coverage - a.coverage || b.targetValue - a.targetValue || b.combined - a.combined,
      );
  }, [picks]);

  return (
    <div className="animate-rise">
      <header className="mb-6">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Farm Planner</h1>
        <p className="mt-1 max-w-2xl text-ink-400">
          Tell it what you’re hunting. It ranks every dig site by how much of your list it covers,
          then by how much of that list you’d actually pull per dig.
        </p>
      </header>

      {/* --- picker --- */}
      <div className="panel relative z-40 mb-6 p-4">
        <div className="relative">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Add a mineral to your list…"
            className="w-full rounded-lg border border-white/10 bg-white/4 px-3 py-2.5 text-sm outline-none transition placeholder:text-ink-500 focus:border-ore-400/50 focus:bg-white/7"
          />
          {suggestions.length > 0 && (
            <div className="absolute top-full right-0 left-0 z-50 mt-1.5 overflow-hidden rounded-xl border border-white/12 bg-rock-850 shadow-2xl shadow-black/50">
              {suggestions.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    toggle(m.id);
                    setQ('');
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-white/8"
                >
                  <Sprite file={m.image} alt="" className="h-8 w-8 shrink-0" />
                  <span className="flex-1 truncate text-sm font-semibold">{m.name}</span>
                  <RarityTag rarity={m.rarity} />
                  <span className="numeric text-xs text-ore-400">{money(m.value)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {picks.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {picks.map((m) => (
              <button
                key={m.id}
                onClick={() => toggle(m.id)}
                className="group flex items-center gap-2 rounded-lg bg-white/6 py-1 pr-2 pl-1.5 ring-1 ring-white/10 transition hover:bg-white/12"
              >
                <Sprite file={m.image} alt="" className="h-6 w-6" />
                <span className="text-xs font-semibold">{m.name}</span>
                <span className="text-ink-500 transition group-hover:text-ore-400">✕</span>
              </button>
            ))}
            <button
              onClick={() => setWanted([])}
              className="ml-1 text-xs font-semibold text-ink-400 underline underline-offset-2 hover:text-ore-400"
            >
              Clear all
            </button>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-500">Try:</span>
            {['Pink Diamond', 'Aetherium', 'Diamond', 'Emerald'].map((name) => {
              const m = minerals.find((x) => x.name === name);
              if (!m) return null;
              return (
                <button
                  key={m.id}
                  onClick={() => toggle(m.id)}
                  className="rounded-lg bg-white/5 px-2.5 py-1 text-xs font-semibold text-ink-300 ring-1 ring-white/8 transition hover:bg-white/10 hover:text-ink-100"
                >
                  + {m.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {picks.length === 0 ? (
        <Empty>
          <div className="max-w-md">
            <p className="mb-2 text-lg font-bold text-ink-300">Nothing on the list yet</p>
            <p className="text-sm">
              Add one or more minerals above. The planner works out which single dig site gets you
              the most of them, so you’re not switching zones between pulls.
            </p>
          </div>
        </Empty>
      ) : (
        <section>
          <SectionTitle
            title={`Best sites for ${picks.length} target${picks.length === 1 ? '' : 's'}`}
            hint="Ranked by coverage of your list, then by the value of wanted minerals per pull."
          />
          <div className="space-y-3">
            {ranked.length === 0 && <Empty>No dig site drops any of those.</Empty>}

            {ranked.map(({ site, hits, combined, targetValue, coverage }, i) => {
              const loc = locationForSite(site);
              return (
                <div key={site.id} className="panel overflow-hidden">
                  <div className="flex flex-wrap items-center gap-4 border-b border-white/6 px-5 py-4">
                    <span
                      className={cx(
                        'grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-black',
                        i === 0 ? 'bg-ore-400 text-rock-950' : 'bg-white/6 text-ink-400',
                      )}
                    >
                      {i + 1}
                    </span>

                    <div className="min-w-0">
                      <Link
                        to={`/sites/${site.id}`}
                        className="gradient-text text-lg font-black"
                        style={gradientVars(site.colors)}
                      >
                        {site.name}
                      </Link>
                      <div className="text-[11px] text-ink-500">
                        {loc ? loc.name : 'Standalone'} · {site.mineralCount} minerals total
                      </div>
                    </div>

                    <div className="ml-auto flex flex-wrap items-center gap-5">
                      <Metric
                        label="Covers"
                        value={`${hits.length}/${picks.length}`}
                        accent={coverage === 1 ? '#3ee0d0' : undefined}
                      />
                      <Metric label="Any target" value={percent(combined)} />
                      <Metric label="Target value" value={money(targetValue)} accent="#ffc247" sub="/pull" />
                    </div>
                  </div>

                  <div className="divide-y divide-white/5">
                    {hits
                      .sort((a, b) => (b.chance.percent ?? 0) - (a.chance.percent ?? 0))
                      .map(({ mineral: m, chance }) => (
                        <Link
                          key={m.id}
                          to={`/minerals/${m.id}`}
                          className="flex items-center gap-3 px-5 py-2.5 transition hover:bg-white/4"
                        >
                          <Sprite file={m.image} alt="" className="h-8 w-8 shrink-0" />
                          <span className="truncate text-sm font-semibold">{m.name}</span>
                          <RarityTag rarity={m.rarity} />
                          {chance.conditional && (
                            <span className="rounded bg-white/6 px-1.5 py-0.5 text-[10px] text-ink-400">
                              {chance.conditional}
                            </span>
                          )}
                          <span className="numeric ml-auto text-xs text-ink-300">
                            {odds(chance.oneIn)}
                          </span>
                          <span className="numeric w-20 shrink-0 text-right text-sm font-bold text-ore-400">
                            {money(m.value)}
                          </span>
                        </Link>
                      ))}

                    {/* What you're giving up by not going elsewhere. */}
                    {picks.length > hits.length && (
                      <div className="flex flex-wrap items-center gap-2 bg-white/2 px-5 py-2.5">
                        <span className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
                          Missing here
                        </span>
                        {picks
                          .filter((p) => !hits.some((h) => h.mineral.id === p.id))
                          .map((p) => (
                            <span
                              key={p.id}
                              className="gradient-text text-xs font-semibold"
                              style={gradientVars(rarityByName.get(p.rarity)?.colors)}
                            >
                              {p.name}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function Metric({
  label, value, sub, accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="text-right">
      <div className="text-[10px] font-semibold tracking-[0.1em] text-ink-500 uppercase">
        {label}
      </div>
      <div className="numeric font-black" style={accent ? { color: accent } : undefined}>
        {value}
        {sub && <span className="ml-0.5 text-[10px] font-medium text-ink-500">{sub}</span>}
      </div>
    </div>
  );
}
