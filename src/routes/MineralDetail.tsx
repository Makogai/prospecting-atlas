import { useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { siteBands, mineralChance } from '../../shared/luck.mjs';
import { LuckPanel, LuckCaveat, useLuck, activeBoosts, luckAt } from '../components/LuckPanel';
import { GrindPanel, useGrind, grindRate, sessionLabel } from '../components/GrindPanel';
import { MobileDock } from '../components/MobileDock';
import { yieldLabel } from '../../shared/estimate.mjs';
import {
  mineralById, minerals, rarityByName, sitesFor, bestSiteFor, usedInRecipes,
  locationForSite, money, odds, percent, boostLabel, museumDisplayByRarity,
} from '../lib/db';
import {
  Empty, OddsBar, RarityTag, SectionTitle, SiteTag, Sprite, cx, gradientVars,
} from '../components/ui';

export function MineralDetail() {
  const { id } = useParams();
  const m = id ? mineralById.get(id) : undefined;
  const [luck, setLuck] = useLuck();
  const luckRef = useRef<HTMLDivElement>(null);
  const [grind, setGrind] = useGrind();

  if (!m) {
    return (
      <Empty>
        <div>
          <p className="mb-3">That mineral doesn’t exist.</p>
          <Link to="/minerals" className="font-semibold text-ore-400 hover:underline">
            Back to all minerals
          </Link>
        </div>
      </Empty>
    );
  }

  const rarity = rarityByName.get(m.rarity);
  const boosts = activeBoosts(luck);
  const rate = grindRate(grind);

  // Luck is worked out per dig site, because several events only fire at
  // particular ones — a Blizzard is worth nothing outside Snowy Mountain.
  const drops = sitesFor(m).map((d) => {
    const at = luckAt(luck.base, {
      boosts,
      friends: luck.friends,
      siteName: d.site.name,
    });
    const lucky = d.chance.percent == null
      ? null
      : mineralChance(siteBands(d.site), m.id, at.luck);
    const p = (lucky?.percent ?? d.chance.percent ?? 0) / 100;
    return {
      ...d,
      luckHere: at,
      lucky,
      // "About 4 an hour" is the question people actually ask. Below one a
      // session that reads badly, so yieldLabel switches to an interval.
      yield: yieldLabel(p, rate, grind.sessionHours),
    };
  });

  // A skipped boost is only worth calling out on a row when some other row here
  // does get it. If it reaches none of them, saying so seven times is just noise.
  const differentiating = new Set(drops.flatMap((d) => d.luckHere.applied.map((b) => b.id)));

  // The headline luck ignores scoping; each row shows its own.
  const effectiveLuckValue = luckAt(luck.base, { boosts, friends: luck.friends }).luck;
  const boosted = drops.some((d) => d.luckHere.luck > 1);
  const best = bestSiteFor(m);
  const usedIn = usedInRecipes(m);
  const peers = minerals
    .filter((x) => x.id !== m.id && x.chances.some((c) => m.chances.some((mc) => mc.site === c.site)))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .slice(0, 6);

  return (
    <div className="animate-rise">
      <Link
        to="/minerals"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-400 transition hover:text-ore-400"
      >
        ← All minerals
      </Link>

      {/* --- hero --- */}
      <div className="panel relative overflow-hidden p-6 sm:p-8">
        <div
          aria-hidden
          className="absolute -top-24 -left-16 h-72 w-72 rounded-full opacity-20 blur-3xl"
          style={{ background: `linear-gradient(135deg, ${rarity?.colors[0]}, ${rarity?.colors.at(-1)})` }}
        />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <Sprite
            file={m.image}
            alt={m.name}
            className="h-36 w-36 shrink-0 self-center sm:h-44 sm:w-44"
            glow={`radial-gradient(circle, ${rarity?.colors[0]}66, transparent 70%)`}
          />

          <div className="min-w-0 flex-1">
            <RarityTag rarity={m.rarity} />
            <h1
              className="gradient-text mt-2 text-4xl font-black tracking-tight sm:text-5xl"
              style={gradientVars(rarity?.colors)}
            >
              {m.name}
            </h1>
            <p className="mt-2 max-w-prose text-ink-300">{m.description}</p>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <Figure label="Value" value={`${money(m.value)}`} sub="per kg" accent="#ffc247" />
              <Figure label="Dig sites" value={String(drops.length)} sub="that drop it" />
              {best && (() => {
                // Mirror the drop table: if the player has set a luck, the headline
                // figure has to agree with the rows below it.
                const boostedBest = drops
                  .filter((d) => d.lucky && !d.chance.conditional)
                  .sort((a, b) => (b.lucky?.percent ?? 0) - (a.lucky?.percent ?? 0))[0];
                const show = boosted && boostedBest?.lucky ? boostedBest : null;
                return (
                  <Figure
                    label="Best odds"
                    value={odds(show ? show.lucky!.oneIn : best.chance.oneIn)}
                    sub={
                      show
                        ? `at ${show.site.name} · ${Math.round(effectiveLuckValue).toLocaleString('en-US')} Luck`
                        : `at ${best.site.name}`
                    }
                    accent={show ? '#3ee0d0' : undefined}
                  />
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          {/* --- the thing people actually come for --- */}
          <section>
            <SectionTitle
              title="Where to find it"
              hint={
                !m.ratesKnown
                  ? 'The wiki lists locations for this mineral but no drop rates.'
                  : [
                      boosted
                        ? `Odds at ${Math.round(effectiveLuckValue).toLocaleString('en-US')} Luck.`
                        : 'Ranked by drop rate.',
                      rate > 0
                        ? `Yields are what you'd expect in ${sessionLabel(grind.sessionHours)} at ${Math.round(rate).toLocaleString('en-US')} minerals/hour.`
                        : '',
                      'Bars are log-scaled — each step is 10× rarer.',
                    ].filter(Boolean).join(' ')
              }
            />

            {drops.length === 0 ? (
              <Empty>No drop locations recorded.</Empty>
            ) : (
              <div className="panel divide-y divide-white/6">
                {drops.map(({ chance, site, lucky, luckHere, yield: y }, i) => (
                  <Link
                    key={chance.site}
                    to={`/sites/${site.id}`}
                    className="block px-4 py-3.5 transition hover:bg-white/4"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span
                        className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-white/6 text-[10px] font-bold text-ink-400"
                      >
                        {i + 1}
                      </span>
                      <span
                        className="gradient-text font-bold"
                        style={gradientVars(site.colors)}
                      >
                        {site.name}
                      </span>
                      {chance.conditional && (
                        <span className="rounded bg-white/6 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-ink-400 uppercase">
                          {chance.conditional}
                        </span>
                      )}
                      {boosted && lucky && lucky.gain > 1.01 && (
                        <span className="numeric rounded bg-vein-500/15 px-1.5 py-0.5 text-[10px] font-bold text-vein-400">
                          {lucky.gain >= 10 ? Math.round(lucky.gain) : lucky.gain.toFixed(1)}× better
                        </span>
                      )}
                      <span className="numeric ml-auto text-sm font-bold">
                        {odds(lucky ? lucky.oneIn : chance.oneIn)}
                      </span>
                      <span className="numeric w-20 shrink-0 text-right text-xs text-ink-500">
                        {boosted && lucky && lucky.gain > 1.01
                          ? `was ${odds(chance.oneIn)}`
                          : percent(chance.percent)}
                      </span>
                      {rate > 0 && y.value > 0 && (
                        <span
                          className={cx(
                            'numeric w-full text-right text-xs font-bold sm:w-auto',
                            y.per === 'session' ? 'text-ore-400' : 'text-ink-400',
                          )}
                          title={
                            y.per === 'session'
                              ? `Expected in ${sessionLabel(grind.sessionHours)} at your pace`
                              : 'At your pace, this is how often one turns up'
                          }
                        >
                          {y.text}
                        </span>
                      )}
                    </div>
                    <div className="mt-2">
                      <OddsBar percent={lucky ? lucky.percent : chance.percent} colors={site.colors} />
                    </div>
                    {boosted && lucky?.confidence === 'damped' && (
                      <p className="mt-1.5 text-[11px] text-ink-500">
                        Common enough that high Luck would squeeze it out — the game damps that,
                        so this stays at its base rate.
                      </p>
                    )}
                    {boosted && lucky?.confidence === 'saturating' && (
                      <p className="mt-1.5 text-[11px] text-ink-500">
                        Luck is close to guaranteeing this, where the model is least reliable.
                      </p>
                    )}
                    {(() => {
                      const missing = luckHere.skipped.filter((b) => differentiating.has(b.id));
                      if (!missing.length) return null;
                      return (
                        <p className="mt-1.5 text-[11px] text-ink-500">
                          Not here:{' '}
                          {missing.map((b) => b.label).join(', ')}{' '}
                          — so this site sits at{' '}
                          <span className="numeric">
                            {Math.round(luckHere.luck).toLocaleString('en-US')}
                          </span>{' '}
                          Luck.
                        </p>
                      );
                    })()}
                  </Link>
                ))}
              </div>
            )}
          </section>

          {m.recipes.length > 0 && (
            <section>
              <SectionTitle
                title="Crafts into"
                hint={`${m.name} is an ingredient in ${m.recipes.length} recipe${m.recipes.length === 1 ? '' : 's'}.`}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {m.recipes.map((r, i) => (
                  <div key={r.name + i} className="panel p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">{r.name}</h3>
                      {r.rarity && <RarityTag rarity={r.rarity} />}
                    </div>
                    {r.note && <p className="mt-0.5 text-xs text-ink-500">{r.note}</p>}
                    <ul className="mt-3 space-y-1">
                      {r.ingredients.map((ing, j) => {
                        const target = minerals.find(
                          (x) => x.name.toLowerCase() === ing.item.toLowerCase(),
                        );
                        return (
                          <li key={j} className="flex items-center gap-2 text-sm">
                            <span className="numeric w-7 shrink-0 rounded bg-white/6 py-0.5 text-center text-xs font-bold text-ore-300">
                              {ing.qty}
                            </span>
                            {target ? (
                              <Link
                                to={`/minerals/${target.id}`}
                                className="truncate text-ink-300 hover:text-ore-400"
                              >
                                {ing.item}
                              </Link>
                            ) : (
                              <span className="truncate text-ink-300">{ing.item}</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {usedIn.length > 0 && (
            <section>
              <SectionTitle title="Also needed for" hint="Recipes on other mineral pages that call for this." />
              <div className="panel divide-y divide-white/6">
                {usedIn.slice(0, 10).map(({ source, recipe }, i) => (
                  <Link
                    key={i}
                    to={`/minerals/${source.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-white/4"
                  >
                    <Sprite file={source.image} alt="" className="h-7 w-7 shrink-0" />
                    <span className="font-semibold">{recipe.name}</span>
                    <span className="ml-auto truncate text-xs text-ink-500">via {source.name}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* --- sidebar --- */}
        <div className="space-y-6">
          {m.ratesKnown && (
            <div ref={luckRef} className="space-y-6">
              <LuckPanel luck={luck} onChange={setLuck} />
              <GrindPanel grind={grind} onChange={setGrind} />
              <LuckCaveat className="-mt-2 px-1" />
            </div>
          )}

          {m.museum && m.museum.boosts.length > 0 && (
            <section className="panel p-5">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-extrabold tracking-[0.1em] text-ink-400 uppercase">
                  Museum donation
                </h2>
                <Link to="/museum" className="text-xs font-semibold text-ore-400 hover:underline">
                  Plan it →
                </Link>
              </div>
              <dl className="mt-3 space-y-2.5 text-sm">
                <Row label="Goes in a display" value={`${m.museum.displayRarity} × ${
                  museumDisplayByRarity.get(m.museum.displayRarity)?.total ?? 0
                }`} />
                {m.museum.minWeight != null && (
                  <Row label="Min weight for max boost" value={`${m.museum.minWeight}kg`} />
                )}
              </dl>
              <ul className="mt-3 space-y-1.5">
                {m.museum.boosts.map((b) => (
                  <li
                    key={b.stat}
                    className="flex items-baseline justify-between gap-2 rounded-md bg-white/4 px-2.5 py-1.5 text-sm"
                  >
                    <span className="truncate text-ink-300">{b.stat}</span>
                    <span
                      className={cx(
                        'numeric shrink-0 font-bold',
                        b.value > 0 ? 'text-vein-400' : 'text-red-400',
                      )}
                    >
                      {boostLabel(b.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {best && (
            <section className="panel overflow-hidden">
              <div className="border-b border-white/8 px-5 py-3">
                <h2 className="text-sm font-extrabold tracking-[0.1em] text-ink-400 uppercase">
                  Go here
                </h2>
              </div>
              <div className="p-5">
                <p className="text-xs text-ink-500">Your best shot at {m.name}</p>
                <Link
                  to={`/sites/${best.site.id}`}
                  className="gradient-text mt-1 block text-2xl font-black"
                  style={gradientVars(best.site.colors)}
                >
                  {best.site.name}
                </Link>
                {(() => {
                  const loc = locationForSite(best.site);
                  return loc ? (
                    <Link
                      to={`/locations/${loc.id}`}
                      className="mt-1 inline-block text-xs text-ink-400 hover:text-ore-400"
                    >
                      in {loc.name} →
                    </Link>
                  ) : null;
                })()}
                <p className="numeric mt-3 text-sm text-ink-300">
                  {odds(best.chance.oneIn)} per pull
                </p>
                <p className="mt-3 text-xs text-ink-500">
                  This site holds {best.site.mineralCount} minerals, averaging{' '}
                  <span className="numeric text-ore-400">{money(best.site.expectedValue)}</span> of
                  value per pull.
                </p>
              </div>
            </section>
          )}

          {peers.length > 0 && (
            <section>
              <SectionTitle title="Found alongside" />
              <div className="panel divide-y divide-white/6">
                {peers.map((p) => (
                  <Link
                    key={p.id}
                    to={`/minerals/${p.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-white/4"
                  >
                    <Sprite file={p.image} alt="" className="h-8 w-8 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{p.name}</span>
                      <span className="text-[11px] text-ink-500">{p.rarity}</span>
                    </span>
                    <span className="numeric text-sm font-bold text-ore-400">{money(p.value)}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {m.locations.length > 0 && (
            <section className="panel p-5">
              <h2 className="text-sm font-extrabold tracking-[0.1em] text-ink-400 uppercase">
                Listed locations
              </h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {m.locations.map((l) => (
                  <SiteTag key={l} name={l} />
                ))}
              </div>
            </section>
          )}

          <a
            href={m.wiki}
            target="_blank"
            rel="noreferrer noopener"
            className="panel panel-hover block px-5 py-3 text-sm text-ink-400"
          >
            View “{m.name}” on the official wiki →
          </a>
        </div>
      </div>

      {m.ratesKnown && (
        <MobileDock
          label="Your luck & pace"
          meta={`${boosts.length} boost${boosts.length === 1 ? '' : 's'} on · ${Math.round(rate).toLocaleString('en-US')}/h`}
          value={Math.round(effectiveLuckValue).toLocaleString('en-US')}
          anchorRef={luckRef}
        >
          <div className="space-y-6">
            <LuckPanel luck={luck} onChange={setLuck} />
            <GrindPanel grind={grind} onChange={setGrind} />
          </div>
        </MobileDock>
      )}
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
    <div className="rounded-xl bg-white/5 px-3.5 py-2 ring-1 ring-white/8">
      <div className="text-[10px] font-semibold tracking-[0.12em] text-ink-500 uppercase">
        {label}
      </div>
      <div className="numeric text-lg font-black" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-ink-500">{sub}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-500">{label}</dt>
      <dd className="numeric font-semibold">{value}</dd>
    </div>
  );
}
