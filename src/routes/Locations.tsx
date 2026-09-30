import { Link } from 'react-router-dom';
import { locations, digSiteById, money, regions } from '../lib/db';
import { Sprite, gradientVars } from '../components/ui';

export function Locations() {
  const withSites = locations.filter((l) => l.digSites.length > 0);
  const landmarks = locations.filter((l) => l.digSites.length === 0);

  return (
    <div className="animate-rise">
      <header className="mb-6">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Locations</h1>
        <p className="mt-1 text-ink-400">
          The places you travel to, and the dig sites inside each one.
        </p>
      </header>

      {/* Regions are how players talk about the map — "it's on Snowy Mountain" —
          but the wiki's Locations page is a flat list, so this is the only
          place the grouping exists. */}
      <div className="mb-6 flex flex-wrap gap-2">
        {regions.map((r) => (
          <span key={r.id} className="rounded-xl bg-white/4 px-3 py-2 ring-1 ring-white/8">
            <span className="block text-[10px] font-bold tracking-[0.12em] text-ink-500 uppercase">
              {r.name}
            </span>
            <span className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
              {r.locations.map((name) => {
                const hit = locations.find((l) => l.name === name);
                return hit ? (
                  <Link
                    key={name}
                    to={`/locations/${hit.id}`}
                    className="text-xs font-semibold text-ink-300 hover:text-ore-400"
                  >
                    {name}
                  </Link>
                ) : (
                  <span key={name} className="text-xs text-ink-400">{name}</span>
                );
              })}
            </span>
          </span>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {withSites.map((l) => {
          const sites = l.digSites.map((id) => digSiteById.get(id)!).filter(Boolean);
          const bestEv = Math.max(0, ...sites.map((s) => s.expectedValue));
          return (
            <Link
              key={l.id}
              to={`/locations/${l.id}`}
              className="panel panel-hover group overflow-hidden"
            >
              <div className="relative h-32 overflow-hidden bg-rock-850">
                <Sprite
                  file={l.image}
                  alt={l.name}
                  fit="cover"
                  className="h-full w-full opacity-70 transition duration-500 group-hover:scale-105 group-hover:opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-rock-900 via-rock-900/30 to-transparent" />
                <h2
                  className="gradient-text absolute bottom-2.5 left-4 text-xl font-black"
                  style={gradientVars(l.colors)}
                >
                  {l.name}
                </h2>
              </div>

              <div className="p-4">
                <p className="line-clamp-2 h-8 text-xs text-ink-400">{l.summary}</p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-ink-400">
                    <span className="numeric font-bold text-ink-100">{sites.length}</span> dig site
                    {sites.length === 1 ? '' : 's'}
                  </span>
                  <span className="numeric font-bold text-ore-400">
                    {money(bestEv)}
                    <span className="ml-1 text-[10px] font-medium text-ink-500">best avg</span>
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {landmarks.length > 0 && (
        <>
          <h2 className="mt-10 mb-3 text-lg font-extrabold">Landmarks & areas</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {landmarks.map((l) => (
              <Link key={l.id} to={`/locations/${l.id}`} className="panel panel-hover p-4">
                <h3 className="gradient-text font-bold" style={gradientVars(l.colors)}>
                  {l.name}
                </h3>
                <p className="mt-1 line-clamp-3 text-xs text-ink-500">{l.summary}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
