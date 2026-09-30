import { useMemo, useState } from 'react';
import { codes, db, type GameCode } from '../lib/db';
import { Empty, SectionTitle, cx } from '../components/ui';
import { useHighlight } from '../lib/useHighlight';

/** Copy-to-clipboard is the entire job of this page, so it's the whole row. */
function CodeRow({
  entry, mark,
}: {
  entry: GameCode;
  mark?: Record<string, string>;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(entry.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be refused outright; the code is selectable either way.
      setCopied(false);
    }
  };

  return (
    <div
      {...mark}
      className={cx(
        'flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3',
        !entry.active && 'opacity-55',
      )}
    >
      <button
        onClick={copy}
        disabled={!entry.active}
        title={entry.active ? 'Copy code' : 'This code no longer works'}
        className={cx(
          'numeric shrink-0 rounded-lg px-3 py-1.5 text-sm font-bold transition',
          entry.active
            ? 'bg-ore-400/15 text-ore-300 ring-1 ring-ore-400/30 hover:bg-ore-400/25'
            : 'cursor-not-allowed bg-white/5 text-ink-400 line-through',
        )}
      >
        {copied ? 'Copied' : entry.code}
      </button>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {entry.rewards.map((r) => (
          <span
            key={r.name}
            className="rounded-md bg-white/5 px-2 py-1 text-[11px] ring-1 ring-white/8"
          >
            <span className="numeric font-bold text-ink-100">{r.value}</span>{' '}
            <span className="text-ink-400">{r.name}</span>
            {r.duration && <span className="text-ink-500"> · {r.duration}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

export function CodesPage() {
  const found = useHighlight('code', 'rounded-xl');
  // An expired code is hidden by default, so searching one has to open the list
  // it lives in or the link goes nowhere visible.
  const targetExpired = found.wanted
    ? codes.some((c) => c.code === found.wanted && !c.active)
    : false;
  const [showExpired, setShowExpired] = useState(targetExpired);

  const active = useMemo(() => codes.filter((c) => c.active), []);
  const expired = useMemo(() => codes.filter((c) => !c.active), []);

  const synced = new Date(db.meta.fetchedAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <div className="animate-rise mx-auto max-w-3xl">
      <header className="panel relative overflow-hidden p-6 sm:p-8">
        <div
          aria-hidden
          className="absolute -top-24 -right-12 h-72 w-72 rounded-full bg-ore-500/15 blur-3xl"
        />
        <div className="relative">
          <p className="text-xs font-semibold tracking-[0.12em] text-ink-500 uppercase">
            Free stuff
          </p>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Codes</h1>
          <p className="mt-2 max-w-xl text-sm text-ink-300">
            Tap a code to copy it, then redeem in-game. Codes expire without warning, so this
            list is only as current as the last data sync —{' '}
            <span className="numeric text-ink-100">{synced}</span>.
          </p>
        </div>
      </header>

      <section className="mt-8">
        <SectionTitle
          title="Working now"
          hint={`${active.length} active code${active.length === 1 ? '' : 's'}`}
        />
        {active.length === 0 ? (
          <Empty>No codes are active right now.</Empty>
        ) : (
          <div className="panel divide-y divide-white/6">
            {active.map((c) => (
              <CodeRow
                key={c.code}
                entry={c}
                mark={found.mark(c.code)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <SectionTitle
          title="Expired"
          hint={`${expired.length} no longer work`}
          action={
            <button
              onClick={() => setShowExpired((v) => !v)}
              className="rounded-lg bg-white/6 px-3 py-1.5 text-xs font-semibold text-ink-300 transition hover:bg-white/10"
            >
              {showExpired ? 'Hide' : 'Show'}
            </button>
          }
        />
        {showExpired ? (
          <div className="panel divide-y divide-white/6">
            {expired.map((c) => (
              <CodeRow
                key={c.code}
                entry={c}
                mark={found.mark(c.code)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-500">
            Kept so you can tell a dead code from one that was never real.
          </p>
        )}
      </section>
    </div>
  );
}
