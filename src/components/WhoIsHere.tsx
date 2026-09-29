import { Link } from 'react-router-dom';
import { whoIsAt, type Npc, type Quest } from '../lib/db';
import { SectionTitle, Sprite, cx } from './ui';

/**
 * The people and quests at a place, for location and dig-site pages.
 *
 * Kept compact on purpose: this is a signpost, not the Quests page. Anything
 * beyond a few entries links through rather than being listed in full.
 */
export function WhoIsHere({
  names, title = 'Who you’ll find here', limit = 6,
}: {
  /** Every name that means "here" — a location plus its dig sites, say. */
  names: string[];
  title?: string;
  limit?: number;
}) {
  const { npcs, quests } = whoIsAt(names);
  if (npcs.length === 0 && quests.length === 0) return null;

  const withBuff = quests.filter((q) => q.buff);

  return (
    <section className="mt-8">
      <SectionTitle
        title={title}
        hint={[
          npcs.length ? `${npcs.length} character${npcs.length === 1 ? '' : 's'}` : '',
          quests.length ? `${quests.length} quest${quests.length === 1 ? '' : 's'}` : '',
        ]
          .filter(Boolean)
          .join(' · ')}
        action={
          quests.length > 0 ? (
            <Link
              to={`/quests?loc=${encodeURIComponent(quests[0].location)}`}
              className="text-sm font-semibold text-ore-400 hover:underline"
            >
              All quests →
            </Link>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {npcs.length > 0 && (
          <div>
            <div className="grid gap-2 sm:grid-cols-2">
              {npcs.slice(0, limit).map((npc) => (
                <NpcRow key={npc.id} npc={npc} />
              ))}
            </div>
            {npcs.length > limit && (
              <Link
                to="/quests"
                className="mt-2 inline-block text-xs font-semibold text-ink-400 hover:text-ore-400"
              >
                +{npcs.length - limit} more here →
              </Link>
            )}
          </div>
        )}

        {quests.length > 0 && (
          <div>
            <div className="panel divide-y divide-white/6">
              {quests.slice(0, limit).map((quest) => (
                <QuestRow key={quest.id} quest={quest} />
              ))}
            </div>
            {quests.length > limit && (
              <Link
                to={`/quests?loc=${encodeURIComponent(quests[0].location)}`}
                className="mt-2 inline-block text-xs font-semibold text-ink-400 hover:text-ore-400"
              >
                +{quests.length - limit} more quest
                {quests.length - limit === 1 ? '' : 's'} →
              </Link>
            )}
            {withBuff.length > 0 && (
              <p className="mt-2 text-[11px] text-vein-400">
                {withBuff.length} of these grant{withBuff.length === 1 ? 's' : ''} a permanent buff.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function NpcRow({ npc }: { npc: Npc }) {
  return (
    <Link
      to={`/quests?npc=${encodeURIComponent(npc.name)}`}
      className="panel panel-hover flex items-center gap-3 p-2.5"
    >
      <Sprite
        file={npc.image}
        alt=""
        fit="cover"
        className="h-10 w-10 shrink-0 overflow-hidden rounded-lg"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{npc.name}</span>
        <span className="block truncate text-[11px] text-ink-500">
          {npc.quests.length
            ? `${npc.quests.length} quest${npc.quests.length === 1 ? '' : 's'}`
            : npc.places[0]?.note ?? 'No quests'}
        </span>
      </span>
    </Link>
  );
}

function QuestRow({ quest }: { quest: Quest }) {
  return (
    <Link
      to={`/quests?q=${encodeURIComponent(quest.name)}`}
      className="block px-4 py-2.5 transition hover:bg-white/4"
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-bold">{quest.name}</span>
        {quest.npc && <span className="text-[11px] text-ink-500">from {quest.npc}</span>}
        {quest.buff && (
          <span className="rounded bg-vein-500/15 px-1.5 text-[10px] font-bold text-vein-400">
            buff
          </span>
        )}
      </div>
      {quest.rewards && (
        <p className={cx('numeric mt-0.5 truncate text-[11px] text-ore-400')}>{quest.rewards}</p>
      )}
    </Link>
  );
}
