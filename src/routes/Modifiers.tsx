import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  modifiers, minerals, mineralById, money, percent, odds,
  type Modifier,
} from '../lib/db';
import { Empty, NumberField, RarityTag, SectionTitle, Sprite, cx } from '../components/ui';
import { useHighlight } from '../lib/useHighlight';

/** `Events#tabber-Rose_Rain-_Limited` is a wiki anchor, not a sentence. */
const prettyRef = (ref: string) =>
  ref.split('#').pop()!.replace(/^tabber-/, '').replace(/_/g, ' ').replace(/\s*-\s*$/, '').trim();

/** Where a modifier comes from, in one line, however the wiki phrased it. */
function routeOf(mod: Modifier): string {
  // A qualified chance ("100% with Purity rune") is the whole story; an
  // unqualified one is a flat per-dig rate.
  if (mod.note) return mod.note;
  if (mod.percent != null && mod.percent > 0) return `${percent(mod.percent)} per dig`;
  const via = [...mod.tools, ...mod.equipment, ...mod.locations, ...mod.events];
  if (via.length) return via.slice(0, 3).map(prettyRef).join(', ');
  return mod.source ?? 'Not obtainable by digging';
}

export function ModifiersPage() {
  const found = useHighlight('mod');
  // The default is the most valuable ore, because "what could this be worth"
  // is the question the page exists to answer.
  const [oreId, setOreId] = useState(minerals[0]?.id ?? '');
  const [weight, setWeight] = useState(1);
  const [q, setQ] = useState('');

  const ore = mineralById.get(oreId);
  const base = (ore?.value ?? 0) * Math.max(weight, 0);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? modifiers.filter((m) => m.name.toLowerCase().includes(needle)) : modifiers;
  }, [q]);

  // Only an unqualified rate counts as "you can dig for this". Purified is
  // listed at 100%, but only while a Purity rune is equipped.
  const isDiggable = (m: Modifier) => m.note == null && m.percent != null && m.percent > 0;
  const diggable = shown.filter(isDiggable);
  const elsewhere = shown.filter((m) => !isDiggable(m));

  const Row = ({ mod }: { mod: Modifier }) => {
    const worth = mod.sellMultiplier != null ? base * mod.sellMultiplier : null;
    return (
      <div
        ref={found.ref(mod.id)}
        className={cx(
          'flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3',
          found.is(mod.id) && 'is-found rounded-xl',
        )}
      >
        <span
          className="w-28 shrink-0 text-sm font-bold"
          style={mod.color ? { color: mod.color } : undefined}
        >
          {mod.name}
        </span>

        <span className="numeric w-16 shrink-0 text-right text-sm font-black text-ore-400">
          {mod.sellMultiplier != null ? `${mod.sellMultiplier}×` : '—'}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs text-ink-400">{routeOf(mod)}</span>
          {mod.museumStats.length > 0 && (
            <span className="block truncate text-[11px] text-vein-400">
              museum: {mod.museumStats.join(' · ')}
            </span>
          )}
        </span>

        {worth != null && ore && (
          <span className="numeric w-28 shrink-0 text-right text-sm font-bold">
            {money(worth)}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="animate-rise">
      <header className="panel relative overflow-hidden p-6 sm:p-8">
        <div
          aria-hidden
          className="absolute -top-24 -right-12 h-72 w-72 rounded-full bg-ore-500/15 blur-3xl"
        />
        <div className="relative">
          <p className="text-xs font-semibold tracking-[0.12em] text-ink-500 uppercase">
            Sell value
          </p>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Modifiers</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-300">
            Every price elsewhere on this site is what an <em>unmodified</em> ore sells for. A
            modifier multiplies it — and a Perfect roll is worth{' '}
            <strong className="text-ore-400">24× base</strong>, which is the difference between
            a good pull and a great one.
          </p>
        </div>
      </header>

      {/* ---------- what's it worth ---------- */}
      <section className="mt-8">
        <SectionTitle
          title="What would it be worth?"
          hint="Pick an ore and a weight; every row prices it."
        />
        <div className="panel flex flex-wrap items-end gap-4 p-4">
          <label className="min-w-[12rem] flex-1">
            <span className="mb-1.5 block text-xs font-semibold text-ink-400">Ore</span>
            <select
              value={oreId}
              onChange={(e) => setOreId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-sm outline-none focus:border-ore-400/50"
            >
              {minerals.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {money(m.value)}/kg
                </option>
              ))}
            </select>
          </label>

          <label className="w-28">
            <span className="mb-1.5 block text-xs font-semibold text-ink-400">Weight (kg)</span>
            <NumberField
              value={weight}
              min={0}
              onChange={setWeight}
              className="focus:border-ore-400/50"
            />
          </label>

          {ore && (
            <div className="flex items-center gap-3">
              <Sprite file={ore.image} alt="" className="h-11 w-11 shrink-0" />
              <div>
                <div className="text-xs text-ink-500">Unmodified</div>
                <div className="numeric text-lg font-black">{money(base)}</div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ---------- the list ---------- */}
      <section className="mt-8">
        <SectionTitle
          title="Every modifier"
          hint={`${modifiers.length} in total, best multiplier first`}
          action={
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter…"
              className="w-40 rounded-lg border border-white/10 bg-white/4 px-3 py-1.5 text-sm outline-none focus:border-ore-400/50"
            />
          }
        />

        {shown.length === 0 ? (
          <Empty>No modifier matches that.</Empty>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <div>
              <h3 className="mb-2 text-[11px] font-bold tracking-[0.12em] text-ink-500 uppercase">
                You can dig for these
              </h3>
              <div className="panel divide-y divide-white/6">
                {diggable.map((m) => (
                  <Row key={m.id} mod={m} />
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-[11px] font-bold tracking-[0.12em] text-ink-500 uppercase">
                These come from somewhere else
              </h3>
              <div className="panel divide-y divide-white/6">
                {elsewhere.map((m) => (
                  <Row key={m.id} mod={m} />
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {ore && (
        <p className="mt-6 text-xs text-ink-500">
          Prices assume {weight}kg of{' '}
          <Link to={`/minerals/${ore.id}`} className="text-ore-400 hover:underline">
            {ore.name}
          </Link>{' '}
          at {money(ore.value)}/kg. <RarityTag rarity={ore.rarity} className="ml-1 align-middle" />{' '}
          <span className="ml-1">Best odds {odds(ore.chances[0]?.oneIn ?? null)}.</span>
        </p>
      )}
    </div>
  );
}
