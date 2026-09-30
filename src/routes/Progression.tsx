import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  levels, runes, mastery, permanentBuffs, rarityByName, events,
  eventSchedule, msToNextRoll, countdown,
} from '../lib/db';
import { NumberField, SectionTitle, SectionTitle as Title, cx, gradientVars } from '../components/ui';
import { useHighlight } from '../lib/useHighlight';

type Tab = 'levels' | 'mastery' | 'runes' | 'buffs' | 'events';

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: 'levels', label: 'Levels & titles', hint: 'XP, and what each level unlocks' },
  { id: 'mastery', label: 'Mastery', hint: 'Per-location and activity tracks' },
  { id: 'runes', label: 'Runes', hint: 'Passive buffs you equip' },
  { id: 'buffs', label: 'Permanent buffs', hint: 'Kept once earned' },
  { id: 'events', label: 'Events', hint: 'Temporary luck, while they last' },
];

export function ProgressionPage() {
  // The tab lives in the URL so the front-page tiles can point straight at
  // Runes or Events rather than dropping you on Levels every time.
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get('tab') as Tab | null;
  const tab: Tab = fromUrl && TABS.some((t) => t.id === fromUrl) ? fromUrl : 'levels';
  const setTab = (next: Tab) => setParams({ tab: next }, { replace: true });

  return (
    <div className="animate-rise">
      <header className="panel relative overflow-hidden p-6 sm:p-8">
        <div
          aria-hidden
          className="absolute -top-24 -right-12 h-72 w-72 rounded-full bg-vein-500/20 blur-3xl"
        />
        <div className="relative">
          <p className="text-xs font-semibold tracking-[0.12em] text-ink-500 uppercase">
            Getting stronger
          </p>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Progression</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-300">
            Four systems the wiki keeps on four unconnected pages: your level, location mastery,
            the runes you equip, and the buffs you keep forever. They all stack into the same
            character, so they're in one place here.
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
              tab === t.id
                ? 'bg-vein-500/20 ring-1 ring-vein-500/40'
                : 'bg-white/5 hover:bg-white/10',
            )}
          >
            <span className={cx('block text-sm font-bold', tab === t.id ? 'text-vein-300' : 'text-ink-200')}>
              {t.label}
            </span>
            <span className="block text-[11px] text-ink-500">{t.hint}</span>
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === 'levels' && <Levels />}
        {tab === 'mastery' && <MasteryTracks />}
        {tab === 'runes' && <Runes />}
        {tab === 'buffs' && <Buffs />}
        {tab === 'events' && <Events />}
      </div>
    </div>
  );
}

/* ---------- levels ------------------------------------------------------- */

function Levels() {
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(levels.maxLevel ?? 60);

  // XP between two levels is the running total difference, which is the
  // question people actually ask ("how far is 40 to 60?").
  const cost = useMemo(() => {
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    const before = levels.steps.find((s) => s.from === lo)?.total ?? 0;
    const after = levels.steps.find((s) => s.to === hi)?.total ?? 0;
    return Math.max(after - before + (levels.steps.find((s) => s.from === lo)?.cost ?? 0), 0);
  }, [from, to]);

  const topOre = [...levels.xpByRarity].sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0))[0];
  const oresNeeded = topOre?.xp ? Math.ceil(cost / topOre.xp) : null;

  return (
    <>
      <SectionTitle
        title="How far is it?"
        hint={`${levels.maxLevel} levels in total. XP comes from every ore you collect.`}
      />
      <div className="panel flex flex-wrap items-end gap-4 p-5">
        <label className="w-24">
          <span className="mb-1.5 block text-xs font-semibold text-ink-400">From level</span>
          <NumberField value={from} min={1} max={levels.maxLevel ?? 60} onChange={setFrom} />
        </label>
        <label className="w-24">
          <span className="mb-1.5 block text-xs font-semibold text-ink-400">To level</span>
          <NumberField value={to} min={1} max={levels.maxLevel ?? 60} onChange={setTo} />
        </label>
        <div>
          <div className="text-[11px] tracking-[0.12em] text-ink-500 uppercase">XP needed</div>
          <div className="numeric text-2xl font-black text-ore-400">
            {cost.toLocaleString('en-US')}
          </div>
          {oresNeeded != null && (
            <div className="text-[11px] text-ink-500">
              ≈ {oresNeeded.toLocaleString('en-US')} {topOre.rarity} ores
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:items-start">
        <div>
          <Title title="XP per ore" hint="By rarity, whatever it weighs." />
          <div className="panel divide-y divide-white/6">
            {levels.xpByRarity.map((r) => {
              const rarity = rarityByName.get(r.rarity as never);
              return (
                <div key={r.rarity} className="flex items-center justify-between px-4 py-2.5">
                  <span
                    className="gradient-text text-sm font-bold"
                    style={gradientVars(rarity?.colors)}
                  >
                    {r.rarity}
                  </span>
                  <span className="numeric text-sm font-bold">{r.xp?.toLocaleString('en-US')}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <Title title="Titles" hint="One every five levels, shown above your character." />
          <div className="panel divide-y divide-white/6">
            {levels.titles.map((t) => (
              <div key={t.name} className="flex items-center justify-between px-4 py-2.5">
                <span
                  className="text-sm font-bold"
                  style={t.color ? { color: t.color } : undefined}
                >
                  {t.name}
                </span>
                <span className="numeric text-xs text-ink-500">{t.range}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- mastery ------------------------------------------------------ */

function MasteryTracks() {
  // The track lives in the URL too, so a search result for "Rubble Creek
  // mastery" opens that track rather than dropping you on whichever is first.
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get('track');
  const track =
    mastery.tracks.find((t) => t.id === fromUrl) ?? mastery.tracks[0];

  const setOpenId = (id: string) => {
    const next = new URLSearchParams(params);
    next.set('tab', 'mastery');
    next.set('track', id);
    setParams(next, { replace: true });
  };

  return (
    <>
      <SectionTitle
        title="Mastery"
        hint={`${mastery.tracks.length} tracks. ${
          mastery.stacks ? '' : 'Location luck does not stack — only your highest completed tier counts.'
        }`}
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {mastery.tracks.map((t) => (
          <button
            key={t.id}
            onClick={() => setOpenId(t.id)}
            aria-pressed={t.id === track?.id}
            className={cx(
              'rounded-lg px-2.5 py-1 text-xs font-semibold transition',
              t.id === track?.id
                ? 'bg-ore-400 text-rock-950'
                : 'bg-white/5 text-ink-400 hover:bg-white/10 hover:text-ink-100',
            )}
          >
            {t.name}
          </button>
        ))}
      </div>

      {track && (
        <div className="panel overflow-hidden">
          <div className="border-b border-white/8 px-5 py-3">
            <h3 className="font-extrabold">{track.name} mastery</h3>
            {track.boost && (
              <p className="text-xs text-vein-400">Rewards {track.boost.toLowerCase()}</p>
            )}
          </div>
          <div className="divide-y divide-white/6">
            {track.tiers.map((tier) => (
              <div key={tier.name} className="px-5 py-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="numeric text-sm font-black text-ore-400">
                    {tier.tier ?? '★'}
                  </span>
                  {/* The label after the colon is usually just the tier number
                      again, which the badge already shows. */}
                  <span className="text-sm font-bold">
                    {tier.tier != null ? `Tier ${tier.tier}` : 'Complete'}
                  </span>
                </div>
                {tier.steps.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {tier.steps.map((s, i) => (
                      <li key={i} className="text-xs text-ink-400">• {s}</li>
                    ))}
                  </ul>
                )}
                {tier.rewards && (
                  <p className="numeric mt-1 text-[11px] text-vein-400">{tier.rewards}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- runes -------------------------------------------------------- */

function Runes() {
  const found = useHighlight('rune');

  return (
    <>
      <SectionTitle
        title="Runes"
        hint={`${runes.runes.length} runes, ${runes.slots.at(-1)?.slots ?? 0} slots at level ${runes.slots.at(-1)?.level ?? 0}`}
      />

      {runes.mechanics.length > 0 && (
        <ul className="panel mb-4 space-y-1 p-4 text-xs text-ink-300">
          {runes.mechanics.map((m, i) => (
            <li key={i}>• {m}</li>
          ))}
        </ul>
      )}

      <div className="mb-4 flex flex-wrap gap-1.5">
        {runes.slots.map((s) => (
          <span key={s.level} className="rounded-lg bg-white/5 px-2.5 py-1 text-[11px] ring-1 ring-white/8">
            <span className="text-ink-500">Level {s.level}</span>{' '}
            <span className="numeric font-bold">{s.slots} slot{s.slots === 1 ? '' : 's'}</span>
          </span>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {runes.runes.map((r) => (
          <div key={r.id} ref={found.ref(r.id)} className={cx('panel p-4', found.is(r.id) && 'is-found')}>
            <h3 className="text-sm font-extrabold" style={r.color ? { color: r.color } : undefined}>
              {r.name}
            </h3>
            {r.effect && <p className="mt-1 text-xs text-ink-300">{r.effect}</p>}
            {r.where && <p className="mt-1.5 text-[11px] text-ink-500">Found: {r.where}</p>}
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- events ------------------------------------------------------- */

/**
 * Luck events, which are the temporary counterpart to permanent buffs.
 *
 * Whether one is additive or multiplicative is the whole story — two ×2
 * additive boosts give ×3, not ×4 — so it leads each row rather than being a
 * footnote.
 */
/**
 * Time to the next roll.
 *
 * Rolls are on the clock and identical in every server, so this is a real
 * countdown — but it counts down to the game *rolling*, not to an event. The
 * wiki says events "have a chance to occur" at each one, and saying otherwise
 * would promise something the game doesn't.
 */
function NextRoll() {
  const [left, setLeft] = useState(() => msToNextRoll());

  useEffect(() => {
    const t = setInterval(() => setLeft(msToNextRoll()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="panel mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 p-5">
      <div>
        <div className="text-[11px] font-semibold tracking-[0.12em] text-ink-500 uppercase">
          Next roll
        </div>
        <div className="numeric text-3xl font-black text-ore-400">{countdown(left)}</div>
      </div>
      <p className="min-w-[16rem] flex-1 text-xs leading-relaxed text-ink-400">
        The game rolls for an event every {eventSchedule.rollMinutes} minutes, on the clock —
        at :{eventSchedule.slots.map((n) => String(n).padStart(2, '0')).join(' and :')}
        {eventSchedule.globalRoll && ', the same in every server'}.{' '}
        {!eventSchedule.guaranteed && (
          <strong className="text-ink-200">
            Each roll is a chance, not a guarantee — it can pass with nothing.
          </strong>
        )}
      </p>
    </div>
  );
}

/** Admin Abuse: dev-triggered, and the wiki publishes no schedule for it. */
function AdminAbuse() {
  const adminEvents = events.filter((e) => e.admin);
  const { adminAbuse } = eventSchedule;

  return (
    <div className="panel mt-8 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-extrabold">Admin Abuse (AA)</h3>
        <a
          href={adminAbuse.announced}
          target="_blank"
          rel="noreferrer noopener"
          className="text-sm font-semibold text-ore-400 hover:underline"
        >
          Official Discord →
        </a>
      </div>
      <p className="mt-1.5 max-w-2xl text-sm text-ink-300">
        <strong className="text-ore-300">There is no AA timer.</strong> {adminAbuse.what} The only
        warning is an announcement in the game's own Discord, so that's where to watch — no site
        can count down to one.
      </p>

      {adminEvents.length > 0 && (
        <>
          <h4 className="mt-4 text-[10px] font-bold tracking-[0.12em] text-ink-500 uppercase">
            What they can turn on
          </h4>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {adminEvents.map((e) => (
              <span
                key={e.id}
                className="rounded-lg bg-white/5 px-2.5 py-1 text-xs ring-1 ring-white/8"
              >
                <span className="font-semibold text-ink-200">{e.name}</span>
                {e.value != null && (
                  <span className="numeric ml-1.5 text-vein-400">×{e.value}</span>
                )}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Events() {
  const multiplicative = events.filter((e) => e.kind === 'multiplicative');
  const additive = events.filter((e) => e.kind === 'additive');
  const unknown = events.filter((e) => e.kind === 'unknown');

  const Row = ({ e }: { e: (typeof events)[number] }) => (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
      <span className="w-40 shrink-0 text-sm font-bold">{e.name}</span>
      <span className="numeric w-16 shrink-0 text-sm font-bold text-vein-400">
        {e.value != null ? `×${e.value}` : '—'}
      </span>
      <span className="min-w-0 flex-1 text-[11px] text-ink-500">
        {e.global ? 'Everywhere' : e.sites.join(', ') || (e.note ?? '')}
        {e.durationMinutes ? ` · runs ${e.durationMinutes} min` : ''}
        {e.relic ? ` · start it with ${e.relic}` : ''}
      </span>
      {e.admin && (
        <span className="shrink-0 rounded bg-white/8 px-1.5 text-[10px] text-ink-400">admin</span>
      )}
    </div>
  );

  return (
    <>
      <NextRoll />

      <SectionTitle
        title="Luck events"
        hint="These stack differently, which is why the site models them separately."
      />
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div>
          <h3 className="mb-2 text-[11px] font-bold tracking-[0.12em] text-ink-500 uppercase">
            Multiplicative — these stack on top of everything
          </h3>
          <div className="panel divide-y divide-white/6">
            {multiplicative.map((e) => <Row key={e.id} e={e} />)}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-[11px] font-bold tracking-[0.12em] text-ink-500 uppercase">
            Additive — two ×2 boosts give ×3, not ×4
          </h3>
          <div className="panel divide-y divide-white/6">
            {additive.map((e) => <Row key={e.id} e={e} />)}
          </div>
          {unknown.length > 0 && (
            <p className="mt-3 text-[11px] text-ink-500">
              {unknown.map((e) => e.name).join(' and ')} also boost Luck, but the wiki doesn't say
              by how much, so they aren't modelled.
            </p>
          )}
        </div>
      </div>

      <AdminAbuse />
    </>
  );
}

/* ---------- permanent buffs ---------------------------------------------- */

function Buffs() {
  return (
    <>
      <SectionTitle
        title="Permanent buffs"
        hint="Earned once and kept — the ones worth going out of your way for."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {permanentBuffs.map((b) => (
          <div key={b.id} className="panel p-5">
            <h3 className="font-extrabold">{b.name}</h3>
            <ul className="mt-2 space-y-1">
              {b.lines.map((l, i) => (
                <li key={i} className="text-xs text-ink-400">{l}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
