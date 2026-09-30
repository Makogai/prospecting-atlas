import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useHighlight } from '../lib/useHighlight';
import {
  quests, npcs, npcByName, mineralByName, digSiteByName, locationByName,
  type Quest, type Npc,
} from '../lib/db';
import { Empty, Sprite, cx, gradientVars } from '../components/ui';

type Tab = 'quests' | 'npcs';

/** Location order as the game unfolds, so the list reads like progression. */
const LOCATION_ORDER = [
  'Rubble Creek', 'Fortune River', 'Museum', 'Fortune River Delta', 'Sunset Beach',
  'Crystal Caverns', 'Azuralite Oasis', 'Volcanic Sands', 'Windswept Beach',
  'Volcanic Springs', 'The Magma Furnace', 'Snowy Shores', 'Frostbitten Path',
  'Frozen Peak', 'Overgrown Grotto', 'Deeproot Spring', 'Enchanted Ruins', 'The Void',
  'Rotwood Swamp', 'Fungal Marsh', 'Timelocked Sanctuary', 'Meteor Valley',
  'Sunscorched Desert',
];

const orderOf = (l: string) => {
  const i = LOCATION_ORDER.indexOf(l);
  return i === -1 ? LOCATION_ORDER.length : i;
};

export function QuestsPage() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>('quests');

  const q = params.get('q') ?? '';
  const location = params.get('loc') ?? '';
  const npcFilter = params.get('npc') ?? '';
  const buffsOnly = params.get('buffs') === '1';

  // `?who=` points at one character in the directory; `?npc=` filters the quest
  // list by their name. They're separate on purpose: 68 of the 120 characters
  // give no quests at all, so sending a search for one of those to a filtered
  // quest list lands on "no quest matches that".
  const who = params.get('who');

  useEffect(() => {
    if (who) setTab('npcs');
  }, [who]);

  const patch = (next: Record<string, string>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) v ? p.set(k, v) : p.delete(k);
    setParams(p, { replace: true });
  };

  const locations = useMemo(
    () => [...new Set(quests.map((x) => x.location))].sort((a, b) => orderOf(a) - orderOf(b)),
    [],
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return quests
      .filter((x) => {
        if (location && x.location !== location) return false;
        if (npcFilter && x.npc !== npcFilter) return false;
        if (buffsOnly && !x.buff) return false;
        if (needle) {
          const hay = `${x.name} ${x.summary ?? ''} ${x.npc ?? ''} ${x.steps
            .map((s) => s.text)
            .join(' ')}`.toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      })
      .sort((a, b) => orderOf(a.location) - orderOf(b.location));
  }, [q, location, npcFilter, buffsOnly]);

  // Quests keep their location order, so grouping preserves progression.
  const grouped = useMemo(() => {
    const out: { location: string; items: Quest[] }[] = [];
    for (const quest of rows) {
      const last = out.at(-1);
      if (last && last.location === quest.location) last.items.push(quest);
      else out.push({ location: quest.location, items: [quest] });
    }
    return out;
  }, [rows]);

  const withBuffs = quests.filter((x) => x.buff).length;

  return (
    <div className="animate-rise">
      <header className="mb-5">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Quests &amp; NPCs</h1>
        <p className="mt-1 max-w-2xl text-ink-400">
          Every quest in the game, who gives it, what it asks for and what you get —
          plus the {npcs.length} characters you'll meet.
        </p>
      </header>

      <div className="mb-5 flex items-center gap-1 rounded-xl border border-white/10 bg-white/4 p-1">
        {(['quests', 'npcs'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cx(
              'rounded-lg px-4 py-1.5 text-sm font-bold capitalize transition',
              tab === t ? 'bg-ore-400 text-rock-950' : 'text-ink-400 hover:text-ink-100',
            )}
          >
            {t === 'quests' ? 'Quests' : 'NPCs'}
            <span className="numeric ml-1.5 text-[11px] opacity-60">
              {t === 'quests' ? quests.length : npcs.length}
            </span>
          </button>
        ))}
      </div>

      {tab === 'quests' ? (
        <>
          <div className="panel-sticky sticky top-14 z-30 mb-5 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={q}
                onChange={(e) => patch({ q: e.target.value })}
                placeholder="Search quests, steps, NPCs…"
                className="min-w-45 flex-1 rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-sm outline-none transition placeholder:text-ink-500 focus:border-ore-400/50 focus:bg-white/7"
              />
              <select
                value={location}
                onChange={(e) => patch({ loc: e.target.value })}
                className="rounded-lg border border-white/10 bg-rock-850 px-3 py-2 text-sm outline-none focus:border-ore-400/50"
              >
                <option value="">Everywhere</option>
                {locations.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <button
                onClick={() => patch({ buffs: buffsOnly ? '' : '1' })}
                aria-pressed={buffsOnly}
                title="Quests that grant a permanent stat buff"
                className={cx(
                  'rounded-lg px-3 py-2 text-xs font-bold transition',
                  buffsOnly
                    ? 'bg-vein-500/20 text-vein-400 ring-1 ring-vein-500/40'
                    : 'bg-white/5 text-ink-400 hover:bg-white/10 hover:text-ink-100',
                )}
              >
                Permanent buff <span className="numeric opacity-60">{withBuffs}</span>
              </button>
            </div>

            {(npcFilter || location || q || buffsOnly) && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {npcFilter && (
                  <span className="rounded-md bg-white/6 px-2 py-0.5 text-xs text-ink-300">
                    from {npcFilter}
                  </span>
                )}
                <span className="numeric ml-auto text-xs text-ink-500">
                  {rows.length} of {quests.length}
                </span>
                <button
                  onClick={() => setParams({}, { replace: true })}
                  className="text-xs font-semibold text-ink-400 underline underline-offset-2 hover:text-ore-400"
                >
                  Reset
                </button>
              </div>
            )}
          </div>

          {rows.length === 0 ? (
            <Empty>No quest matches that.</Empty>
          ) : (
            <div className="space-y-7">
              {grouped.map((group) => (
                <section key={group.location}>
                  <h2 className="mb-2.5 flex items-baseline gap-2">
                    <LocationName name={group.location} />
                    <span className="numeric text-xs text-ink-500">
                      {group.items.length} quest{group.items.length === 1 ? '' : 's'}
                    </span>
                  </h2>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {group.items.map((quest) => (
                      <QuestCard
                        key={quest.id}
                        quest={quest}
                        onPickNpc={(name) => patch({ npc: name, loc: '' })}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      ) : (
        <NpcDirectory
          onPickNpc={(name) => {
            setTab('quests');
            patch({ npc: name, loc: '', q: '', who: '' });
          }}
        />
      )}
    </div>
  );
}

/** A place name, coloured and linked to its own page where we have one. */
function PlaceLink({ name }: { name: string }) {
  const site = digSiteByName.get(name);
  const loc = locationByName.get(name);
  const colors = site?.colors ?? loc?.colors ?? null;
  const href = site ? `/sites/${site.id}` : loc ? `/locations/${loc.id}` : null;

  const body = (
    <span className="gradient-text font-semibold" style={gradientVars(colors)}>
      {name}
    </span>
  );
  return href ? (
    <Link to={href} className="hover:underline">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Locations get their in-game colour when we know it. */
function LocationName({ name }: { name: string }) {
  const site = digSiteByName.get(name);
  const loc = locationByName.get(name);
  const colors = site?.colors ?? loc?.colors ?? null;
  const href = site ? `/sites/${site.id}` : loc ? `/locations/${loc.id}` : null;

  const body = (
    <span className="gradient-text text-lg font-black" style={gradientVars(colors)}>
      {name}
    </span>
  );
  return href ? <Link to={href}>{body}</Link> : body;
}

function QuestCard({
  quest, onPickNpc,
}: {
  quest: Quest;
  onPickNpc: (name: string) => void;
}) {
  const npc = quest.npc ? npcByName.get(quest.npc) : null;

  return (
    <article className="panel flex flex-col p-4">
      <div className="flex items-start gap-3">
        {npc && <Sprite file={npc.image} alt="" fit="cover" className="h-11 w-11 shrink-0 overflow-hidden rounded-lg" />}
        <div className="min-w-0 flex-1">
          <h3 className="font-extrabold">{quest.name}</h3>
          {quest.npc && (
            <button
              onClick={() => onPickNpc(quest.npc!)}
              className="text-[11px] text-ink-500 transition hover:text-ore-400"
            >
              from {quest.npc}
              {npc?.places[0] && <span className="opacity-70"> · {npc.places[0].name}</span>}
            </button>
          )}
        </div>
      </div>

      {quest.summary && <p className="mt-2 text-xs text-ink-400">{quest.summary}</p>}

      <ol className="mt-3 space-y-1.5">
        {quest.steps.map((step, i) => (
          <li key={i} className="flex gap-2 text-sm">
            <span className="numeric mt-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded bg-white/6 text-[10px] font-bold text-ink-400">
              {i + 1}
            </span>
            <span className="min-w-0">
              <StepText text={step.text} />
              {step.note && <span className="block text-[11px] text-ink-500">{step.note}</span>}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-auto space-y-2 pt-3">
        {quest.rewards && (
          <p className="numeric text-xs text-ore-400">{quest.rewards}</p>
        )}
        {quest.buff && (
          <p className="rounded-lg bg-vein-500/12 px-2.5 py-1.5 text-[11px] font-semibold text-vein-400 ring-1 ring-vein-500/20">
            {quest.buff}
          </p>
        )}
      </div>
    </article>
  );
}

/** Mineral names inside a step link to where they drop. */
function StepText({ text }: { text: string }) {
  const hit = [...mineralByName.values()]
    .filter((m) => new RegExp(`\\b${m.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text))
    .sort((a, b) => b.name.length - a.name.length)[0];

  if (!hit) return <>{text}</>;

  const at = text.toLowerCase().indexOf(hit.name.toLowerCase());
  return (
    <>
      {text.slice(0, at)}
      <Link to={`/minerals/${hit.id}`} className="font-semibold text-ink-100 hover:text-ore-400">
        {text.slice(at, at + hit.name.length)}
      </Link>
      {text.slice(at + hit.name.length)}
    </>
  );
}

function NpcDirectory({ onPickNpc }: { onPickNpc: (name: string) => void }) {
  const found = useHighlight('who');
  const [q, setQ] = useState('');
  const [questGiversOnly, setQuestGiversOnly] = useState(false);

  // A searched character who gives no quests would be filtered out by the
  // quest-giver toggle, so the toggle gives way rather than hiding the answer.
  const target = found.wanted ? npcs.find((n) => n.id === found.wanted) : null;
  const hideNonGivers = questGiversOnly && !(target && target.quests.length === 0);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return npcs
      .filter((n) => {
        if (hideNonGivers && n.quests.length === 0) return false;
        if (needle && !`${n.name} ${n.summary ?? ''} ${n.regions.join(' ')}`.toLowerCase().includes(needle))
          return false;
        return true;
      })
      .sort((a, b) => b.quests.length - a.quests.length || a.name.localeCompare(b.name));
  }, [q, hideNonGivers]);

  return (
    <>
      <div className="panel-sticky sticky top-14 z-30 mb-5 flex flex-wrap items-center gap-2 p-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search characters…"
          className="min-w-45 flex-1 rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-sm outline-none transition placeholder:text-ink-500 focus:border-ore-400/50 focus:bg-white/7"
        />
        <button
          onClick={() => setQuestGiversOnly((v) => !v)}
          aria-pressed={questGiversOnly}
          className={cx(
            'rounded-lg px-3 py-2 text-xs font-bold transition',
            questGiversOnly
              ? 'bg-ore-400 text-rock-950'
              : 'bg-white/5 text-ink-400 hover:bg-white/10 hover:text-ink-100',
          )}
        >
          Quest givers{' '}
          <span className="numeric opacity-60">{npcs.filter((n) => n.quests.length).length}</span>
        </button>
        <span className="numeric text-xs text-ink-500">{rows.length}</span>
      </div>

      {rows.length === 0 ? (
        <Empty>No character matches that.</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((npc) => (
            <NpcCard
              key={npc.id}
              npc={npc}
              mark={found.mark(npc.id)}
              onPick={() => onPickNpc(npc.name)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function NpcCard({
  npc, onPick, mark,
}: {
  npc: Npc;
  onPick: () => void;
  mark?: Record<string, string>;
}) {
  const givesQuests = npc.quests.length > 0;
  return (
    <div {...mark} className="panel overflow-hidden">
      <div className="relative h-28 overflow-hidden bg-rock-850">
        <Sprite file={npc.image} alt={npc.name} fit="cover" className="h-full w-full opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-rock-900 via-transparent to-transparent" />
      </div>
      <div className="p-4">
        <h3 className="font-extrabold">{npc.name}</h3>
        {/* Where to actually find them — the thing people come here for. */}
        {npc.places.length > 0 ? (
          <ul className="mt-1.5 space-y-1">
            {npc.places.map((place) => (
              <li key={place.name} className="text-[11px] leading-snug">
                <PlaceLink name={place.name} />
                {place.note && <span className="text-ink-500"> — {place.note}</span>}
              </li>
            ))}
          </ul>
        ) : (
          npc.regions.length > 0 && (
            <p className="mt-0.5 text-[11px] text-ink-500">{npc.regions.join(' · ')}</p>
          )
        )}
        {npc.summary && <p className="mt-2 line-clamp-2 text-xs text-ink-400">{npc.summary}</p>}
        {givesQuests && (
          <button
            onClick={onPick}
            className="mt-3 w-full rounded-lg bg-ore-400/12 px-3 py-1.5 text-xs font-bold text-ore-300 transition hover:bg-ore-400/20"
          >
            {npc.quests.length} quest{npc.quests.length === 1 ? '' : 's'} →
          </button>
        )}
      </div>
    </div>
  );
}
