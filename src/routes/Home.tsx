import { Link, useOutletContext } from 'react-router-dom';
import {
  minerals, digSites, locations, pans, shovels, sluices, rarities,
  bestSiteFor, money, odds, mineralById,
} from '../lib/db';
import { RarityTag, SectionTitle, Sprite, gradientVars } from '../components/ui';

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

export function Home() {
  const { openPalette } = useOutletContext<{ openPalette: () => void }>();

  const topValue = [...minerals].sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, 6);
  const topSites = [...digSites].sort((a, b) => b.expectedValue - a.expectedValue).slice(0, 6);
  const rarest = [...minerals]
    .filter((m) => m.ratesKnown)
    .map((m) => ({ m, best: bestSiteFor(m) }))
    .filter((x) => x.best?.chance.oneIn != null)
    .sort((a, b) => b.best!.chance.oneIn! - a.best!.chance.oneIn!)
    .slice(0, 5);

  const gearCount = pans.length + shovels.length + sluices.length;

  return (
    <div className="animate-rise">
      {/* --- hero --- */}
      <section className="panel relative overflow-hidden px-6 py-12 sm:px-10 sm:py-16">
        <div
          aria-hidden
          className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-ore-500/18 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -right-24 -bottom-32 h-96 w-96 rounded-full bg-vein-500/14 blur-3xl"
        />

        <div className="relative mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-white/6 px-3 py-1 text-[11px] font-bold tracking-[0.16em] text-ink-400 uppercase ring-1 ring-white/10">
            Unofficial fan atlas
          </span>

          <h1 className="mt-5 text-4xl leading-[1.05] font-black tracking-tight sm:text-6xl">
            Every drop rate in{' '}
            <span className="bg-gradient-to-r from-ore-300 via-ore-400 to-ore-600 bg-clip-text text-transparent">
              Prospecting
            </span>
            , one keystroke away.
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-base text-ink-300 sm:text-lg">
            {minerals.length} minerals, {digSites.length} dig sites and every pan, shovel and
            sluice — cross-indexed so you can go from “what’s this worth?” to “where do I farm it?”
            without opening ten tabs.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={openPalette}
              className="group flex w-full max-w-md items-center gap-3 rounded-xl border border-white/12 bg-white/5 px-4 py-3.5 text-left transition hover:border-ore-400/40 hover:bg-white/9 sm:w-auto sm:min-w-90"
            >
              <span className="text-ore-400" aria-hidden>
                {'⌕'}
              </span>
              <span className="flex-1 text-ink-400 transition group-hover:text-ink-300">
                Search any mineral, site or tool…
              </span>
              <kbd className="rounded border border-white/12 px-1.5 py-0.5 text-[10px] text-ink-500">
                {isMac ? '⌘' : 'Ctrl'} K
              </kbd>
            </button>

            <Link
              to="/compare"
              className="w-full rounded-xl bg-ore-400 px-5 py-3.5 text-center text-sm font-bold text-rock-950 shadow-lg shadow-ore-500/20 transition hover:bg-ore-300 sm:w-auto"
            >
              Plan a farm run
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <HeroStat value={minerals.length} label="Minerals" to="/minerals" />
            <HeroStat value={digSites.length} label="Dig sites" to="/sites" />
            <HeroStat value={locations.length} label="Locations" to="/locations" />
            <HeroStat value={gearCount} label="Gear pieces" to="/gear/pans" />
          </div>
        </div>
      </section>

      {/* --- what makes this different --- */}
      <section className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Feature
          title="Reverse the lookup"
          body="The wiki makes you open every mineral to learn where it drops. Open a dig site here and see its whole loot table, ranked."
          to="/sites"
          cta="Browse dig sites"
        />
        <Feature
          title="Odds you can read"
          body="0.00002085% means nothing. “1 in 4.8M” means something. Every rate is shown both ways, on a log-scaled bar."
          to="/minerals"
          cta="See all minerals"
        />
        <Feature
          title="Every system, not just ore"
          body="Codes, enchant odds, excavation timers, relics, mastery and what a modifier does to a price — the parts of the wiki nobody links to."
          to="/codes"
          cta="Start with codes"
        />
        <Feature
          title="Fill the museum"
          body="Displays only take their own rarity, so it's 18 separate picks. Choose a stat and see the best ore for every slot."
          to="/museum"
          cta="Plan your museum"
        />
        <Feature
          title="Plan the run"
          body="Pick the minerals you're hunting and get the one site that covers most of your list — instead of guessing."
          to="/compare"
          cta="Open the planner"
        />
      </section>

      {/* --- most valuable --- */}
      <section className="mt-12">
        <SectionTitle
          title="Most valuable minerals"
          hint="Sell price per kilogram, before modifiers."
          action={
            <Link to="/minerals" className="text-sm font-semibold text-ore-400 hover:underline">
              All {minerals.length} →
            </Link>
          }
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {topValue.map((m) => {
            const colors = rarities.find((r) => r.name === m.rarity)?.colors ?? [];
            return (
              <Link key={m.id} to={`/minerals/${m.id}`} className="panel panel-hover group p-3">
                <div className="relative grid h-20 place-items-center">
                  <div
                    aria-hidden
                    className="absolute h-14 w-14 rounded-full opacity-25 blur-2xl transition group-hover:opacity-50"
                    style={{ background: `linear-gradient(135deg,${colors[0]},${colors.at(-1)})` }}
                  />
                  <Sprite
                    file={m.image}
                    alt={m.name}
                    className="h-16 w-16 transition duration-300 group-hover:scale-110"
                  />
                </div>
                <RarityTag rarity={m.rarity} className="mt-1" />
                <div className="mt-1 truncate text-sm font-bold">{m.name}</div>
                <div className="numeric text-sm font-bold text-ore-400">{money(m.value)}</div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* --- richest sites + rarest drops --- */}
      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle
            title="Richest dig sites"
            hint="Average value of a single pull, weighted by drop rates."
            action={
              <Link to="/sites" className="text-sm font-semibold text-ore-400 hover:underline">
                All →
              </Link>
            }
          />
          <div className="panel divide-y divide-white/6">
            {topSites.map((s, i) => (
              <Link
                key={s.id}
                to={`/sites/${s.id}`}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/4"
              >
                <span className="numeric w-5 shrink-0 text-xs font-bold text-ink-500">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span
                    className="gradient-text block truncate font-bold"
                    style={gradientVars(s.colors)}
                  >
                    {s.name}
                  </span>
                  <span className="numeric text-[11px] text-ink-500">
                    {s.mineralCount} minerals
                  </span>
                </span>
                <span className="numeric shrink-0 text-sm font-bold text-ore-400">
                  {money(s.expectedValue)}
                  <span className="ml-1 text-[10px] font-medium text-ink-500">/pull</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle
            title="Rarest things in the game"
            hint="Best odds available anywhere — these are the long grinds."
          />
          <div className="panel divide-y divide-white/6">
            {rarest.map(({ m, best }) => (
              <Link
                key={m.id}
                to={`/minerals/${m.id}`}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/4"
              >
                <Sprite file={mineralById.get(m.id)?.image} alt="" className="h-10 w-10 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{m.name}</span>
                  <span className="text-[11px] text-ink-500">at {best!.site.name}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="numeric block text-sm font-bold text-ink-100">
                    {odds(best!.chance.oneIn)}
                  </span>
                  <span className="numeric block text-[11px] text-ore-400">{money(m.value)}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function HeroStat({ value, label, to }: { value: number; label: string; to: string }) {
  return (
    <Link
      to={to}
      className="rounded-xl bg-white/4 px-3 py-3 ring-1 ring-white/8 transition hover:bg-white/8"
    >
      <div className="numeric text-2xl font-black text-ore-400">{value}</div>
      <div className="text-[11px] font-semibold tracking-[0.1em] text-ink-500 uppercase">
        {label}
      </div>
    </Link>
  );
}

function Feature({
  title, body, to, cta,
}: {
  title: string;
  body: string;
  to: string;
  cta: string;
}) {
  return (
    <Link to={to} className="panel panel-hover group flex flex-col p-5">
      <h3 className="font-extrabold">{title}</h3>
      <p className="mt-1.5 flex-1 text-sm text-ink-400">{body}</p>
      <span className="mt-3 text-sm font-semibold text-ore-400">
        {cta} <span className="inline-block transition group-hover:translate-x-0.5">→</span>
      </span>
    </Link>
  );
}
