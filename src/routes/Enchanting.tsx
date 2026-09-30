import { useMemo, useState } from 'react';
import { enchants, enchantHowTo, relics, percent, type Enchant } from '../lib/db';
import { Empty, SectionTitle, cx } from '../components/ui';
import { useHighlight } from '../lib/useHighlight';

type Slot = 'Pan' | 'Shovel';

/**
 * Pan enchants are rolled by feeding the altar one of three ores, and the ore
 * decides the odds — so the honest way to rank them is "given I'm using
 * Aetherium, what am I likely to get", not one global list.
 */
export function EnchantingPage() {
  const found = useHighlight('e');
  // A searched enchant may belong to the other tool, so the slot follows it.
  const target = found.wanted ? enchants.find((x) => x.id === found.wanted) : null;
  const [slot, setSlot] = useState<Slot>(target?.slot ?? 'Pan');

  const list = useMemo(() => enchants.filter((e) => e.slot === slot), [slot]);

  // Which ore columns exist for this slot; shovels have a single flat chance.
  const ores = useMemo(() => {
    const names = new Set<string>();
    for (const e of list) for (const c of e.chances) if (c.via) names.add(c.via);
    return [...names];
  }, [list]);

  const [via, setVia] = useState<string | null>(null);
  const activeVia = via && ores.includes(via) ? via : (ores[0] ?? null);

  const chanceFor = (e: Enchant) =>
    activeVia
      ? (e.chances.find((c) => c.via === activeVia)?.percent ?? 0)
      : (e.chances[0]?.percent ?? 0);

  const ranked = useMemo(
    () => [...list].sort((a, b) => chanceFor(b) - chanceFor(a) || a.name.localeCompare(b.name)),
    [list, activeVia],
  );

  const reachable = ranked.filter((e) => chanceFor(e) > 0);
  const unreachable = ranked.filter((e) => chanceFor(e) === 0);
  const books = relics.filter((r) => r.category === 'Enchant');

  const Row = ({ e }: { e: Enchant }) => {
    const pct = chanceFor(e);
    return (
      <div
        ref={found.ref(e.id)}
        className={cx(
          'flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3',
          found.is(e.id) && 'is-found rounded-xl',
        )}
      >
        <span className="w-32 shrink-0">
          <span className="block text-sm font-bold">{e.name}</span>
          {e.locked && (
            <span className="block text-[10px] font-semibold text-ore-400">{e.locked}</span>
          )}
        </span>
        <span className="min-w-0 flex-1 text-xs text-ink-300">{e.effect}</span>
        <span className="w-32 shrink-0 text-right">
          <span
            className={cx(
              'numeric text-sm font-bold',
              pct > 0 ? 'text-vein-400' : 'text-ink-600',
            )}
          >
            {pct > 0 ? percent(pct) : '—'}
          </span>
          {pct > 0 && (
            <span className="numeric block text-[10px] text-ink-500">
              ~1 in {Math.round(100 / pct)}
            </span>
          )}
        </span>
      </div>
    );
  };

  return (
    <div className="animate-rise">
      <header className="panel relative overflow-hidden p-6 sm:p-8">
        <div
          aria-hidden
          className="absolute -top-24 -right-12 h-72 w-72 rounded-full bg-vein-500/20 blur-3xl"
        />
        <div className="relative">
          <p className="text-xs font-semibold tracking-[0.12em] text-ink-500 uppercase">
            Fortune River altar
          </p>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Enchanting</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-300">
            One enchant per pan and one per shovel, re-rollable any time. For a pan the odds
            depend entirely on which ore you feed the altar, so pick the ore you actually have
            and the list re-ranks around it.
          </p>
        </div>
      </header>

      <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/4 p-1">
            {(['Pan', 'Shovel'] as Slot[]).map((s) => (
              <button
                key={s}
                onClick={() => setSlot(s)}
                className={cx(
                  'rounded px-3 py-1.5 text-sm font-semibold transition',
                  slot === s ? 'bg-ore-400 text-rock-950' : 'text-ink-400 hover:text-ink-100',
                )}
              >
                {s}
              </button>
            ))}
          </div>

          {ores.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-ink-500">rolled with</span>
              {ores.map((o) => (
                <button
                  key={o}
                  onClick={() => setVia(o)}
                  aria-pressed={activeVia === o}
                  className={cx(
                    'rounded-lg px-2.5 py-1 text-xs font-semibold transition',
                    activeVia === o
                      ? 'bg-vein-500/25 text-vein-300 ring-1 ring-vein-500/50'
                      : 'bg-white/5 text-ink-400 hover:bg-white/10',
                  )}
                >
                  {o}
                </button>
              ))}
            </div>
          )}
        </div>

        <SectionTitle
          title={activeVia ? `Rolling with ${activeVia}` : `${slot} enchants`}
          hint={`${reachable.length} of ${list.length} are possible this way`}
        />

        {reachable.length === 0 ? (
          <Empty>No {slot.toLowerCase()} enchant can be rolled with {activeVia}.</Empty>
        ) : (
          <div className="panel divide-y divide-white/6">
            {reachable.map((e) => (
              <Row key={e.id} e={e} />
            ))}
          </div>
        )}

        {unreachable.length > 0 && (
          <>
            <h3 className="mt-6 mb-2 text-[11px] font-bold tracking-[0.12em] text-ink-500 uppercase">
              Not from {activeVia ?? 'this'} — try another ore or a book
            </h3>
            <div className="panel divide-y divide-white/6 opacity-60">
              {unreachable.map((e) => (
                <Row key={e.id} e={e} />
              ))}
            </div>
          </>
        )}
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2 lg:items-start">
        <div>
          <SectionTitle title="How to enchant" hint="At the altar behind the Alchemist" />
          <ol className="panel space-y-2 p-5 text-sm text-ink-300">
            {enchantHowTo.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="numeric shrink-0 font-bold text-ore-400">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <SectionTitle
            title="Or skip the gamble"
            hint="Enchant books apply one outright"
            action={
              <a
                href="/relics"
                className="text-sm font-semibold text-ore-400 hover:underline"
              >
                All relics →
              </a>
            }
          />
          <div className="panel divide-y divide-white/6">
            {books.map((b) => (
              <div key={b.id} className="px-4 py-2.5">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-sm font-bold">{b.name}</span>
                  {b.triggers[0] && (
                    <span className="rounded bg-vein-500/15 px-1.5 text-[10px] font-bold text-vein-400">
                      {b.triggers[0]}
                    </span>
                  )}
                </div>
                {b.obtainment[0] && (
                  <p className="mt-0.5 text-[11px] text-ink-500">{b.obtainment[0].text}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
