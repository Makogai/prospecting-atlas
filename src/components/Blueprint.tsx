import { Link } from 'react-router-dom';
import { minerals, type Blueprint } from '../lib/db';
import { Sprite, cx } from './ui';

/** Ore names inside quest steps link through to their drop tables. */
function StepText({ text }: { text: string }) {
  // "Collect 150 Glowmoss." — the mineral is the part worth linking.
  const hit = minerals
    .filter((m) => new RegExp(`\\b${m.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text))
    .sort((a, b) => b.name.length - a.name.length)[0];

  if (!hit) return <>{text}</>;

  const at = text.toLowerCase().indexOf(hit.name.toLowerCase());
  return (
    <>
      {text.slice(0, at)}
      <Link to={`/minerals/${hit.id}`} className="text-ink-200 hover:text-ore-400">
        {text.slice(at, at + hit.name.length)}
      </Link>
      {text.slice(at + hit.name.length)}
    </>
  );
}

const KIND_LABEL: Record<Blueprint['kind'], string> = {
  quest: 'Quest reward',
  purchase: 'Bought',
  found: 'Found in the world',
  other: 'See the wiki',
};

/** A one-line "how do I unlock this?" hint, for inside a build or a card. */
export function BlueprintNote({
  blueprint: bp, compact,
}: {
  blueprint: Blueprint;
  compact?: boolean;
}) {
  const where =
    bp.kind === 'quest'
      ? `${bp.quest?.giver ?? 'a quest'}${bp.quest?.location ? ` · ${bp.quest.location}` : ''}`
      : bp.kind === 'purchase'
        ? `${bp.purchase?.cost?.toLocaleString('en-US') ?? ''} ${bp.purchase?.currency ?? ''} · ${bp.purchase?.where ?? ''}`.trim()
        : bp.note ?? '';

  return (
    <span
      className={cx(
        'mt-1 flex flex-wrap items-center gap-1.5 text-[11px]',
        compact ? 'text-ink-500' : 'text-ink-400',
      )}
    >
      <span className="rounded bg-ore-400/12 px-1.5 py-0.5 font-bold text-ore-300">
        blueprint
      </span>
      <span className="truncate">{where}</span>
    </span>
  );
}

/** The full "how to get this blueprint" panel, for an equipment card. */
export function BlueprintPanel({ blueprint: bp }: { blueprint: Blueprint }) {
  return (
    <div className="mt-3 rounded-xl border border-ore-400/25 bg-ore-400/6 p-3">
      <div className="flex items-start gap-2.5">
        <Sprite file={bp.image} alt="" className="h-9 w-9 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold tracking-wide text-ore-300 uppercase">
            Needs a blueprint · {KIND_LABEL[bp.kind]}
          </p>

          {bp.kind === 'quest' && bp.quest && (
            <>
              <p className="mt-0.5 text-sm font-semibold text-ink-200">{bp.quest.name}</p>
              <p className="text-[11px] text-ink-400">
                From <span className="text-ink-300">{bp.quest.giver}</span>
                {bp.quest.location && (
                  <>
                    {' '}in <span className="text-ink-300">{bp.quest.location}</span>
                  </>
                )}
              </p>
              {bp.quest.steps.length > 0 && (
                <ol className="mt-2 space-y-0.5">
                  {bp.quest.steps.map((s, i) => (
                    <li key={i} className="flex gap-2 text-xs text-ink-400">
                      <span className="numeric shrink-0 text-ink-600">{i + 1}.</span>
                      <span>
                        <StepText text={s} />
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              {bp.quest.rewards && (
                <p className="numeric mt-1.5 text-[11px] text-ink-500">{bp.quest.rewards}</p>
              )}
            </>
          )}

          {bp.kind === 'purchase' && bp.purchase && (
            <p className="mt-0.5 text-sm text-ink-200">
              {bp.purchase.cost != null && (
                <span className="numeric font-bold text-ore-300">
                  {bp.purchase.cost.toLocaleString('en-US')}{' '}
                </span>
              )}
              {bp.purchase.currency}
              {bp.purchase.where && (
                <span className="text-ink-400"> · {bp.purchase.where}</span>
              )}
            </p>
          )}

          {(bp.kind === 'found' || bp.kind === 'other') && bp.note && (
            <p className="mt-0.5 text-xs text-ink-300">{bp.note}</p>
          )}

          <a
            href={bp.wiki}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-2 inline-block text-[11px] text-ink-500 underline decoration-white/20 underline-offset-2 hover:text-ore-400"
          >
            Full details on the wiki →
          </a>
        </div>
      </div>
    </div>
  );
}
