import { useMemo, useState } from 'react';
import { relics, relicAcquisition, type Relic } from '../lib/db';
import { Empty, SectionTitle, Sprite, cx } from '../components/ui';
import { useHighlight } from '../lib/useHighlight';

const ORDER = ['Event', 'Boost', 'Enchant', 'Miscellaneous'];

export function RelicsPage() {
  const found = useHighlight('relic');
  const target = found.wanted ? relics.find((r) => r.id === found.wanted) : null;

  // A searched relic may sit in a category the page isn't showing, so the
  // category follows it and the card opens — otherwise the link lands on a tab
  // that doesn't contain what you asked for.
  const [category, setCategory] = useState<string>(target?.category ?? 'Event');
  const [open, setOpen] = useState<string | null>(target?.id ?? null);

  const categories = useMemo(
    () =>
      ORDER.filter((c) => relics.some((r) => r.category === c)).map((c) => ({
        name: c,
        count: relics.filter((r) => r.category === c).length,
      })),
    [],
  );

  const shown = relics.filter((r) => r.category === category);

  return (
    <div className="animate-rise">
      <header className="panel relative overflow-hidden p-6 sm:p-8">
        <div
          aria-hidden
          className="absolute -top-24 -right-12 h-72 w-72 rounded-full bg-vein-500/20 blur-3xl"
        />
        <div className="relative">
          <p className="text-xs font-semibold tracking-[0.12em] text-ink-500 uppercase">
            Consumables
          </p>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Relics</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-300">
            One-use items that start an event, hand you a boost, or apply an enchant outright.
            Most come from excavations, the Traveling Merchant or treasure chests.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {relicAcquisition.map((a) => (
              <span
                key={a.text}
                className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-ink-300 ring-1 ring-white/8"
              >
                {a.refs[0]?.replace(/_/g, ' ').split('#')[0] ?? a.text}
              </span>
            ))}
          </div>
        </div>
      </header>

      <section className="mt-8">
        <div className="mb-4 flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c.name}
              onClick={() => { setCategory(c.name); setOpen(null); }}
              aria-pressed={category === c.name}
              className={cx(
                'rounded-lg px-3 py-1.5 text-sm font-semibold transition',
                category === c.name
                  ? 'bg-vein-500/25 text-vein-300 ring-1 ring-vein-500/50'
                  : 'bg-white/5 text-ink-400 hover:bg-white/10 hover:text-ink-100',
              )}
            >
              {c.name} <span className="numeric opacity-60">{c.count}</span>
            </button>
          ))}
        </div>

        <SectionTitle
          title={`${category} relics`}
          hint="Tap one to see exactly where it drops."
        />

        {shown.length === 0 ? (
          <Empty>Nothing in this category.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {shown.map((r) => (
              <RelicCard
                key={r.id}
                relic={r}
                open={open === r.id}
                cardRef={found.ref(r.id)}
                highlighted={found.is(r.id)}
                onToggle={() => setOpen(open === r.id ? null : r.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RelicCard({
  relic, open, onToggle, cardRef, highlighted,
}: {
  relic: Relic;
  open: boolean;
  onToggle: () => void;
  cardRef?: (node: HTMLElement | null) => void;
  highlighted?: boolean;
}) {
  return (
    <div
      ref={cardRef}
      className={cx(
        'panel overflow-hidden transition',
        open && 'ring-1 ring-vein-500/30',
        highlighted && 'is-found',
      )}
    >
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-3 p-4 text-left">
        <Sprite file={relic.image} alt="" className="h-12 w-12 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-extrabold">{relic.name}</span>
            {relic.triggers[0] && (
              <span className="rounded bg-vein-500/15 px-1.5 text-[10px] font-bold text-vein-400">
                {relic.triggers[0]}
              </span>
            )}
          </span>
          {relic.description && (
            <span className="mt-0.5 block text-xs text-ink-400">{relic.description}</span>
          )}
        </span>
        <span aria-hidden className={cx('shrink-0 text-xs text-ink-500 transition', open && 'rotate-180')}>
          ▼
        </span>
      </button>

      {open && (
        <div className="border-t border-white/8 px-4 py-3">
          {relic.effect && <p className="mb-3 text-xs text-ink-300">{relic.effect}</p>}

          {relic.obtainment.length > 0 && (
            <>
              <h4 className="text-[10px] font-bold tracking-[0.12em] text-ink-500 uppercase">
                Where it drops
              </h4>
              <ul className="mt-1.5 space-y-1">
                {relic.obtainment.map((line, i) => (
                  <li
                    key={i}
                    className={cx('text-xs text-ink-300', line.depth > 1 && 'ml-4 text-ink-500')}
                  >
                    {line.depth > 1 ? '– ' : '• '}
                    {line.text}
                  </li>
                ))}
              </ul>
            </>
          )}

          {relic.usage.length > 0 && (
            <>
              <h4 className="mt-3 text-[10px] font-bold tracking-[0.12em] text-ink-500 uppercase">
                Using it
              </h4>
              <ul className="mt-1.5 space-y-1">
                {relic.usage.map((line, i) => (
                  <li key={i} className="text-xs text-ink-400">• {line.text}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
