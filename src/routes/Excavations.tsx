import { useState } from 'react';
import { Link } from 'react-router-dom';
import { excavations, money, percent, digSiteByName, locationByName } from '../lib/db';
import { SectionTitle, cx } from '../components/ui';
import { useHighlight } from '../lib/useHighlight';

/** A place name links through when it's somewhere we have a page for. */
function Place({ name }: { name: string }) {
  const site = digSiteByName.get(name);
  const loc = locationByName.get(name);
  const to = site ? `/sites/${site.id}` : loc ? `/locations/${loc.id}` : null;
  if (!to) return <span>{name}</span>;
  return (
    <Link to={to} className="text-ore-400 hover:underline">
      {name}
    </Link>
  );
}

export function ExcavationsPage() {
  const found = useHighlight('site');
  const [level, setLevel] = useState(1);
  const [siteId, setSiteId] = useState(
    // A searched site should be the one selected, not just present on the page.
    (found.wanted && excavations.sites.some((s) => s.id === found.wanted)
      ? found.wanted
      : excavations.sites[0]?.id) ?? '',
  );

  const site = excavations.sites.find((s) => s.id === siteId) ?? excavations.sites[0];
  const row = excavations.levels.find((l) => l.level === level) ?? excavations.levels[0];
  const code = site?.code ?? 'A';
  // Sites C through F share a column in the level table.
  const itemsKey = code === 'A' || code === 'B' ? code : 'C–F';

  return (
    <div className="animate-rise">
      <header className="panel relative overflow-hidden p-6 sm:p-8">
        <div
          aria-hidden
          className="absolute -top-24 -right-12 h-72 w-72 rounded-full bg-ore-500/15 blur-3xl"
        />
        <div className="relative">
          <p className="text-xs font-semibold tracking-[0.12em] text-ink-500 uppercase">
            Timed digs
          </p>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Excavations</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-300">
            Pay a permit once, then pay to run a dig and come back hours later. Your excavation
            level raises the luck, the item count and the speed together, up to level{' '}
            <strong className="text-ink-100">{excavations.levelCap}</strong>.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {excavations.places.map((p) => (
              <span key={p} className="rounded-lg bg-white/5 px-2.5 py-1 ring-1 ring-white/8">
                <Place name={p} />
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* ---------- the calculator ---------- */}
      <section className="mt-8">
        <SectionTitle
          title="What a run gets you"
          hint="Pick a site and your excavation level."
        />
        <div className="panel p-5">
          <div className="flex flex-wrap gap-1.5">
            {excavations.sites.map((s) => (
              <button
                key={s.id}
                {...found.mark(s.id)}
                onClick={() => setSiteId(s.id)}
                className={cx(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                  s.id === siteId
                    ? 'bg-ore-400 text-rock-950'
                    : 'bg-white/5 text-ink-400 hover:bg-white/10 hover:text-ink-100',
                )}
              >
                {s.code} · {s.name}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-baseline justify-between">
              <label htmlFor="exc-level" className="text-xs font-semibold text-ink-400">
                Excavation level
              </label>
              <span className="numeric text-sm font-bold text-ore-400">{level}</span>
            </div>
            <input
              id="exc-level"
              type="range"
              min={1}
              max={excavations.levelCap ?? 15}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              className="w-full accent-ore-400"
            />
          </div>

          {site && row && (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Figure label="Takes" value={row.durations[code] ?? site.duration ?? '—'} accent="#ffc247" />
              <Figure label="Items" value={row.items[itemsKey] ?? site.itemsLabel ?? '—'} />
              <Figure label="Luck" value={row.luck != null ? `+${row.luck}` : '—'} />
              <Figure
                label="Run cost"
                value={money(site.runCost)}
                sub={`permit ${money(site.permit)}`}
              />
            </div>
          )}

          {site?.where && <p className="mt-4 text-xs text-ink-500">{site.where}</p>}
        </div>
      </section>

      {/* ---------- reward pool ---------- */}
      {site && site.rewards.length > 0 && (
        <section className="mt-8">
          <SectionTitle
            title={`What ${site.name} drops`}
            hint={`${site.rewards.length} possible rewards, likeliest first`}
          />
          <div className="panel divide-y divide-white/6">
            {site.rewards.map((r) => (
              <div key={r.name} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <span className="w-48 shrink-0 text-sm font-bold">{r.name}</span>
                <span className="min-w-0 flex-1 text-xs text-ink-400">
                  {r.effect ?? r.description}
                </span>
                <span className="numeric w-20 shrink-0 text-right text-sm font-bold text-vein-400">
                  {percent(r.percent)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------- all sites ---------- */}
      <section className="mt-8">
        <SectionTitle title="Every site" hint="Permit is one-off; the run cost is each time." />
        <div className="panel divide-y divide-white/6">
          {excavations.sites.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <span className="numeric w-6 shrink-0 font-black text-ore-400">{s.code}</span>
              <span className="w-44 shrink-0">
                <span className="block text-sm font-bold">{s.name}</span>
                <span className="block text-[11px] text-ink-500">{s.region}</span>
              </span>
              <span className="numeric min-w-0 flex-1 text-xs text-ink-400">
                {s.itemsLabel} items · {s.duration}
              </span>
              <span className="numeric w-32 shrink-0 text-right text-sm font-bold">
                {money(s.permit)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-6 text-xs text-ink-500">
        Level figures come from the wiki's own table, which lists item counts for site A, site B
        and sites C–F separately — the sliders above pick the right column for the site you chose.
      </p>
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
      {sub && <div className="numeric truncate text-[11px] text-ink-500">{sub}</div>}
    </div>
  );
}
