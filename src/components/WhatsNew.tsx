import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CHANGELOG, type ChangeTag, type ChangelogEntry } from '../data/changelog';
import { cx } from './ui';

const STORAGE_KEY = 'atlas.changelog.seen';
const newest = (): string | null => CHANGELOG[0]?.id ?? null;

const read = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    // Blocked storage means we can never tell what they've seen, so we never
    // claim anything is new. Better silent than nagging on every page load.
    return newest();
  }
};

const write = (id: string | null) => {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* nothing to do about it */
  }
};

/**
 * Which entries a visitor hasn't seen yet.
 *
 * A first-time visitor is marked up to date rather than shown the backlog —
 * nothing on the site is "new" to someone seeing all of it for the first time.
 */
export function useUnseen() {
  const [seenId, setSeenId] = useState<string | null>(read);

  useEffect(() => {
    // First visit, or a marker pointing at an entry that no longer exists
    // (renamed id, pruned history). Either way we can't compute a diff, so
    // reset to current and stay quiet instead of replaying everything.
    if (seenId != null && CHANGELOG.some((e) => e.id === seenId)) return;
    write(newest());
    setSeenId(newest());
  }, [seenId]);

  const unseen = useMemo(() => {
    const at = CHANGELOG.findIndex((e) => e.id === seenId);
    return at === -1 ? [] : CHANGELOG.slice(0, at);
  }, [seenId]);

  // Stable, because an effect below depends on it.
  const markSeen = useCallback(() => {
    write(newest());
    setSeenId(newest());
  }, []);

  return { unseen, markSeen };
}

export const TAG_STYLE: Record<ChangeTag, string> = {
  new: 'bg-vein-500/15 text-vein-300 ring-vein-500/30',
  improved: 'bg-ore-400/15 text-ore-300 ring-ore-400/30',
  fixed: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  data: 'bg-white/8 text-ink-300 ring-white/15',
};

export function Tag({ tag }: { tag: ChangeTag }) {
  return (
    <span
      className={cx(
        'rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ring-1',
        TAG_STYLE[tag],
      )}
    >
      {tag}
    </span>
  );
}

/**
 * The bottom-corner nudge shown to a returning visitor when something shipped
 * since they were last here.
 */
export function WhatsNew() {
  const { unseen, markSeen } = useUnseen();
  const { pathname } = useLocation();
  const [show, setShow] = useState(false);

  // Let the page paint first — arriving at the same moment as the content makes
  // it feel like an ad rather than a note.
  useEffect(() => {
    if (unseen.length === 0) return;
    const t = setTimeout(() => setShow(true), 900);
    return () => clearTimeout(t);
  }, [unseen.length]);

  // Reading the changelog is what "seeing it" means, so the popup has no job there.
  useEffect(() => {
    if (pathname === '/changelog' && unseen.length > 0) markSeen();
  }, [pathname, unseen.length, markSeen]);

  if (!show || unseen.length === 0 || pathname === '/changelog') return null;

  const [latest, ...rest] = unseen as [ChangelogEntry, ...ChangelogEntry[]];

  return (
    <div
      role="status"
      className="animate-rise fixed right-4 bottom-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-white/12 bg-rock-900/98 p-4 shadow-2xl shadow-black/60 backdrop-blur-xl"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-bold tracking-[0.12em] text-ore-400 uppercase">
          What's new
        </span>
        <button
          onClick={markSeen}
          aria-label="Dismiss"
          className="-mt-1 -mr-1 rounded px-1.5 py-0.5 text-sm text-ink-500 transition hover:text-ink-100"
        >
          ✕
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Tag tag={latest.tag} />
        <h2 className="text-sm font-extrabold">{latest.title}</h2>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-400">{latest.body}</p>

      <div className="mt-3 flex items-center gap-2">
        {latest.href && (
          <Link
            to={latest.href}
            onClick={markSeen}
            className="rounded-lg bg-ore-400 px-3 py-1.5 text-xs font-bold text-rock-950 transition hover:bg-ore-300"
          >
            Take a look
          </Link>
        )}
        <Link
          to="/changelog"
          onClick={markSeen}
          className="rounded-lg bg-white/6 px-3 py-1.5 text-xs font-semibold text-ink-300 transition hover:bg-white/10"
        >
          {rest.length > 0 ? `+${rest.length} more` : 'All updates'}
        </Link>
      </div>
    </div>
  );
}
