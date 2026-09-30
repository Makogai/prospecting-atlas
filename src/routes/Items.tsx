import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  potions, trinkets, currencies, treasureChests, geodes, money,
} from '../lib/db';
import { Empty, SectionTitle, Sprite, cx } from '../components/ui';
import { useHighlight } from '../lib/useHighlight';

type Tab = 'potions' | 'trinkets' | 'chests' | 'currency';

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: 'potions', label: 'Potions', hint: 'Timed stat boosts you buy' },
  { id: 'trinkets', label: 'Trinkets', hint: 'Passive perks you find' },
  { id: 'chests', label: 'Chests & geodes', hint: 'What is inside, by place' },
  { id: 'currency', label: 'Currency', hint: 'Shards: earning and spending' },
];

export function ItemsPage() {
  // In the URL so a front-page tile can land straight on chests or currency.
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get('tab') as Tab | null;
  const tab: Tab = fromUrl && TABS.some((t) => t.id === fromUrl) ? fromUrl : 'potions';
  const setTab = (next: Tab) => setParams({ tab: next }, { replace: true });

  return (
    <div className="animate-rise">
      <header className="panel relative overflow-hidden p-6 sm:p-8">
        <div
          aria-hidden
          className="absolute -top-24 -right-12 h-72 w-72 rounded-full bg-ore-500/15 blur-3xl"
        />
        <div className="relative">
          <p className="text-xs font-semibold tracking-[0.12em] text-ink-500 uppercase">
            Everything else you carry
          </p>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Items</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-300">
            Potions, trinkets, chests, geodes and the shards that pay for half of it.
          </p>
        </div>
      </header>

      <div className="mt-6 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={cx(
              'rounded-lg px-3 py-2 text-left transition',
              tab === t.id ? 'bg-ore-400/20 ring-1 ring-ore-400/40' : 'bg-white/5 hover:bg-white/10',
            )}
          >
            <span className={cx('block text-sm font-bold', tab === t.id ? 'text-ore-300' : 'text-ink-200')}>
              {t.label}
            </span>
            <span className="block text-[11px] text-ink-500">{t.hint}</span>
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === 'potions' && <Potions />}
        {tab === 'trinkets' && <Trinkets />}
        {tab === 'chests' && <Chests />}
        {tab === 'currency' && <Currencies />}
      </div>
    </div>
  );
}

function Potions() {
  const found = useHighlight('potion');
  const [shop, setShop] = useState<string | null>(null);
  const shops = useMemo(() => [...new Set(potions.map((p) => p.shop).filter(Boolean))] as string[], []);
  const shown = shop ? potions.filter((p) => p.shop === shop) : potions;

  return (
    <>
      <SectionTitle
        title="Potions"
        hint="Every alchemist sells a different shelf, so where you are decides what you can buy."
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        <button
          onClick={() => setShop(null)}
          className={cx(
            'rounded-lg px-2.5 py-1 text-xs font-semibold transition',
            shop === null ? 'bg-ore-400 text-rock-950' : 'bg-white/5 text-ink-400 hover:bg-white/10',
          )}
        >
          All
        </button>
        {shops.map((s) => (
          <button
            key={s}
            onClick={() => setShop(s)}
            className={cx(
              'rounded-lg px-2.5 py-1 text-xs font-semibold transition',
              shop === s ? 'bg-ore-400 text-rock-950' : 'bg-white/5 text-ink-400 hover:bg-white/10',
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {shown.map((p) => (
          <div key={p.id} {...found.mark(p.id)} className="panel flex items-start gap-3 p-4">
            <Sprite file={p.image} alt="" className="h-12 w-12 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <h3 className="text-sm font-extrabold">{p.name}</h3>
                {p.duration && (
                  <span className="numeric rounded bg-white/8 px-1.5 text-[10px] text-ink-300">
                    {p.duration}
                  </span>
                )}
              </div>
              <p className="numeric mt-0.5 text-xs font-semibold text-vein-400">{p.effect}</p>
              {p.description && (
                <p className="mt-1 text-[11px] text-ink-500">{p.description}</p>
              )}
              <p className="numeric mt-1.5 text-xs font-bold text-ore-400">
                {p.money != null ? money(p.money) : p.priceLabel}
              </p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Trinkets() {
  return (
    <>
      <SectionTitle title="Trinkets" hint="Found once, then always on." />
      <div className="grid gap-3 sm:grid-cols-2">
        {trinkets.map((t) => (
          <div key={t.id} className="panel p-5">
            <h3 className="text-sm font-extrabold" style={t.color ? { color: t.color } : undefined}>
              {t.name}
            </h3>
            {t.perk && <p className="mt-1 text-xs text-ink-300">{t.perk}</p>}
            {t.obtained && <p className="mt-2 text-[11px] text-ink-500">How: {t.obtained}</p>}
            {t.where && <p className="text-[11px] text-ink-500">Where: {t.where}</p>}
          </div>
        ))}
      </div>
    </>
  );
}

function Chests() {
  return (
    <>
      <SectionTitle
        title="Treasure chests"
        hint="The pool depends on where you dug it up."
      />
      {treasureChests.loot.length === 0 ? (
        <Empty>No lootpools listed.</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {treasureChests.loot.map((l) => (
            <div key={l.id} className="panel p-4">
              <h3 className="text-sm font-extrabold">{l.place}</h3>
              <ul className="mt-1.5 space-y-0.5">
                {l.items.map((item, i) => (
                  <li key={i} className="text-xs text-ink-400">• {item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {Object.values(treasureChests.sections).length > 0 && (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {Object.values(treasureChests.sections).map((s) => (
            <div key={s.heading} className="panel p-5">
              <h3 className="text-[11px] font-bold tracking-[0.12em] text-ink-500 uppercase">
                {s.heading}
              </h3>
              {s.prose.map((p, i) => (
                <p key={i} className="mt-1.5 text-xs text-ink-300">{p}</p>
              ))}
              <ul className="mt-1.5 space-y-0.5">
                {s.lines.map((l, i) => (
                  <li key={i} className="text-xs text-ink-400">• {l}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <SectionTitle
        title="Geodes"
        hint="Cracked open for what is inside."
        action={undefined}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.values(geodes.sections).map((s) => (
          <div key={s.heading} className="panel p-5">
            <h3 className="text-[11px] font-bold tracking-[0.12em] text-ink-500 uppercase">
              {s.heading}
            </h3>
            {s.prose.map((p, i) => (
              <p key={i} className="mt-1.5 text-xs text-ink-300">{p}</p>
            ))}
            <ul className="mt-1.5 space-y-0.5">
              {s.lines.map((l, i) => (
                <li key={i} className="text-xs text-ink-400">• {l}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}

function Currencies() {
  return (
    <>
      <SectionTitle title="Currency" hint="Beyond plain money." />
      <div className="grid gap-3 sm:grid-cols-2">
        {currencies.map((c) => (
          <div key={c.id} className="panel p-5">
            <h3 className="font-extrabold">{c.name}</h3>
            {c.summary && <p className="mt-1 text-xs text-ink-400">{c.summary}</p>}

            <h4 className="mt-3 text-[10px] font-bold tracking-[0.12em] text-ink-500 uppercase">
              Earning
            </h4>
            <ul className="mt-1 space-y-0.5">
              {c.obtain.map((l, i) => (
                <li key={i} className="text-xs text-vein-400">• {l}</li>
              ))}
            </ul>

            <h4 className="mt-3 text-[10px] font-bold tracking-[0.12em] text-ink-500 uppercase">
              Spending
            </h4>
            <ul className="mt-1 space-y-0.5">
              {c.spend.map((l, i) => (
                <li key={i} className="text-xs text-ore-400">• {l}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
