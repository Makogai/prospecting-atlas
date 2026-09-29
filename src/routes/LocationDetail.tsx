import { Link, useParams } from 'react-router-dom';
import {
  locationById, digSiteById, mineralById, rarityByName, money, odds,
} from '../lib/db';
import {
  Empty, RarityTag, SectionTitle, Sprite, gradientVars,
} from '../components/ui';
import { WhoIsHere } from '../components/WhoIsHere';

export function LocationDetail() {
  const { id } = useParams();
  const loc = id ? locationById.get(id) : undefined;

  if (!loc) {
    return (
      <Empty>
        <div>
          <p className="mb-3">Unknown location.</p>
          <Link to="/locations" className="font-semibold text-ore-400 hover:underline">
            Back to locations
          </Link>
        </div>
      </Empty>
    );
  }

  const sites = loc.digSites.map((s) => digSiteById.get(s)!).filter(Boolean);

  // Best place in this location for each mineral it can produce.
  const catalogue = new Map<string, { percent: number | null; oneIn: number | null; site: string }>();
  for (const s of sites) {
    for (const m of s.minerals) {
      const cur = catalogue.get(m.id);
      if (!cur || (m.percent ?? 0) > (cur.percent ?? 0)) {
        catalogue.set(m.id, { percent: m.percent, oneIn: m.oneIn, site: s.name });
      }
    }
  }
  const unique = [...catalogue.entries()]
    .map(([mid, info]) => ({ mineral: mineralById.get(mid)!, ...info }))
    .filter((x) => x.mineral)
    .sort((a, b) => (b.mineral.value ?? 0) - (a.mineral.value ?? 0));

  return (
    <div className="animate-rise">
      <Link
        to="/locations"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-400 transition hover:text-ore-400"
      >
        ← All locations
      </Link>

      <div className="panel relative overflow-hidden">
        {loc.image && (
          <div className="relative h-48 sm:h-64">
            <Sprite file={loc.image} alt={loc.name} fit="cover" eager className="h-full w-full opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-t from-rock-900 via-rock-900/50 to-transparent" />
          </div>
        )}
        <div className="p-6 sm:p-8">
          <h1
            className="gradient-text text-4xl font-black tracking-tight sm:text-5xl"
            style={gradientVars(loc.colors)}
          >
            {loc.name}
          </h1>
          {loc.summary && <p className="mt-2 max-w-prose text-ink-300">{loc.summary}</p>}
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <span className="rounded-lg bg-white/5 px-3 py-1.5 ring-1 ring-white/8">
              <span className="numeric font-bold">{sites.length}</span>{' '}
              <span className="text-ink-400">dig sites</span>
            </span>
            <span className="rounded-lg bg-white/5 px-3 py-1.5 ring-1 ring-white/8">
              <span className="numeric font-bold">{unique.length}</span>{' '}
              <span className="text-ink-400">obtainable minerals</span>
            </span>
            <a
              href={loc.wiki}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-lg bg-white/5 px-3 py-1.5 text-ink-400 ring-1 ring-white/8 transition hover:text-ore-400"
            >
              Wiki page →
            </a>
          </div>
        </div>
      </div>

      <WhoIsHere names={[loc.name, ...sites.map((s) => s.name)]} />

      {sites.length > 0 && (
        <section className="mt-8">
          <SectionTitle title="Dig sites here" hint="Sorted by average value per pull." />
          <div className="grid gap-3 sm:grid-cols-2">
            {[...sites]
              .sort((a, b) => b.expectedValue - a.expectedValue)
              .map((s) => (
                <Link key={s.id} to={`/sites/${s.id}`} className="panel panel-hover p-5">
                  <h3 className="gradient-text text-lg font-black" style={gradientVars(s.colors)}>
                    {s.name}
                  </h3>
                  <div className="mt-3 flex items-end gap-6">
                    <div>
                      <div className="numeric text-xl font-black text-ore-400">
                        {money(s.expectedValue)}
                      </div>
                      <div className="text-[10px] font-semibold tracking-[0.1em] text-ink-500 uppercase">
                        avg / pull
                      </div>
                    </div>
                    <div>
                      <div className="numeric text-xl font-black">{s.mineralCount}</div>
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
                </Link>
              ))}
          </div>
        </section>
      )}

      {unique.length > 0 && (
        <section className="mt-8">
          <SectionTitle
            title="Everything obtainable here"
            hint="Each mineral shown with the best odds available anywhere in this location."
          />
          <div className="panel divide-y divide-white/6">
            {unique.map(({ mineral: m, oneIn, site }) => (
              <Link
                key={m.id}
                to={`/minerals/${m.id}`}
                className="flex items-center gap-4 px-4 py-3 transition hover:bg-white/4"
              >
                <Sprite file={m.image} alt="" className="h-10 w-10 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-bold">{m.name}</span>
                    <RarityTag rarity={m.rarity} />
                  </div>
                  <span className="text-[11px] text-ink-500">best at {site}</span>
                </div>
                <span className="numeric hidden w-24 shrink-0 text-right text-xs text-ink-300 sm:block">
                  {odds(oneIn)}
                </span>
                <span className="numeric w-20 shrink-0 text-right text-sm font-bold text-ore-400">
                  {money(m.value)}
                </span>
              </Link>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-500">
            Rarity colours match the in-game{' '}
            {[...rarityByName.keys()].length}-tier scale.
          </p>
        </section>
      )}
    </div>
  );
}
