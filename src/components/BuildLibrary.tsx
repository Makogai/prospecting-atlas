import { useEffect, useState } from 'react';
import type { SavedBuild } from '../lib/buildLibrary';
import { cx } from './ui';

/**
 * Saved builds, mirroring the game's Manage Museums Board: keep a few setups
 * and switch between them.
 *
 * Loading one shows it the same way a shared link does — held apart from the
 * museum you're actively editing — so switching to look at your Sell build
 * doesn't discard the Luck one you had on screen.
 */
export function BuildLibrary({
  builds, canSave, activeCode, onSave, onLoad, onRemove,
  hint = 'Keep more than one setup — a Luck build for hunting, a Sell build for cashing out.',
}: {
  builds: SavedBuild[];
  canSave: boolean;
  /** The code currently being viewed, so its chip can be marked. */
  activeCode: string | null;
  onSave: (name: string) => void;
  onLoad: (build: SavedBuild) => void;
  onRemove: (id: string) => void;
  hint?: string;
}) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const commit = () => {
    onSave(name);
    setName('');
    setNaming(false);
  };

  if (builds.length === 0 && !naming) {
    return (
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/8 bg-white/3 px-3 py-2">
        <span className="flex-1 text-[11px] text-ink-500">{hint}</span>
        <button
          onClick={() => setNaming(true)}
          disabled={!canSave}
          className="rounded-lg bg-white/8 px-2.5 py-1 text-[11px] font-semibold text-ink-200 transition hover:bg-white/14 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save this build
        </button>
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-xl border border-white/8 bg-white/3 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[10px] font-bold tracking-[0.12em] text-ink-500 uppercase">
          Saved
        </span>
        {builds.map((build) => (
          <span
            key={build.id}
            className={cx(
              'group flex items-center gap-1 rounded-lg py-1 pr-1 pl-2.5 text-xs font-semibold transition',
              build.code === activeCode
                ? 'bg-ore-400/20 text-ore-300 ring-1 ring-ore-400/40'
                : 'bg-white/6 text-ink-300 hover:bg-white/12',
            )}
          >
            <button onClick={() => onLoad(build)} className="max-w-[12rem] truncate">
              {build.name}
            </button>
            <button
              onClick={() => onRemove(build.id)}
              aria-label={`Delete ${build.name}`}
              className="rounded px-1 text-ink-500 opacity-0 transition group-hover:opacity-100 hover:text-red-400 focus:opacity-100"
            >
              ✕
            </button>
          </span>
        ))}

        {naming ? (
          <span className="flex items-center gap-1">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') setNaming(false);
              }}
              placeholder="Name this build"
              maxLength={40}
              className="w-40 rounded-lg border border-white/12 bg-white/5 px-2 py-1 text-xs outline-none focus:border-ore-400/50"
            />
            <button
              onClick={commit}
              className="rounded-lg bg-ore-400 px-2.5 py-1 text-[11px] font-bold text-rock-950 transition hover:bg-ore-300"
            >
              Save
            </button>
          </span>
        ) : (
          <button
            onClick={() => setNaming(true)}
            disabled={!canSave}
            className="rounded-lg bg-white/6 px-2.5 py-1 text-xs font-semibold text-ink-400 transition hover:bg-white/12 hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            + Save current
          </button>
        )}
      </div>
    </div>
  );
}

export function ShareBox({
  url, onClose,
  note = 'Anyone who opens this sees your exact layout. It stays valid as the wiki updates, because it stores names rather than positions.',
}: {
  url: string;
  onClose: () => void;
  note?: string;
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const t = setTimeout(() => setState('idle'), 2400);
    return () => clearTimeout(t);
  }, [state]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      setState('failed');
    }
  };

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div className="panel mb-3 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[11px] font-semibold tracking-[0.12em] text-ink-500 uppercase">
          Share this build
        </h3>
        <button
          onClick={onClose}
          aria-label="Close"
          className="text-xs text-ink-500 transition hover:text-ink-100"
        >
          ✕
        </button>
      </div>

      {/* Input on its own row: this also renders in a 20rem sidebar, where a
          side-by-side field shrinks to a few unreadable characters. */}
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Shareable link to this build"
        className="mt-2.5 w-full rounded-lg border border-white/10 bg-white/4 px-3 py-2 font-mono text-xs text-ink-300 outline-none focus:border-ore-400/50"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          onClick={copy}
          className="rounded-lg bg-ore-400 px-3 py-2 text-xs font-bold text-rock-950 transition hover:bg-ore-300"
        >
          {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy link'}
        </button>
        {canShare && (
          <button
            onClick={() => navigator.share({ title: 'Prospecting Atlas — museum build', url })}
            className="rounded-lg bg-white/6 px-3 py-2 text-xs font-semibold text-ink-300 transition hover:bg-white/10"
          >
            Share…
          </button>
        )}
      </div>

      <p className="mt-2 text-[11px] text-ink-500">
        {state === 'failed'
          ? 'Your browser blocked the clipboard — select the link above and copy it manually.'
          : note}
      </p>
    </div>
  );
}
