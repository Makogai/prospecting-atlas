import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { cx } from './ui';

/**
 * Keeps a summary panel reachable on a phone.
 *
 * These pages are two columns on a desktop, with the panel stuck beside the
 * content. A phone has to stack them, and the panel is the part you keep
 * checking while you scroll the other column — so once it scrolls out of view
 * this puts a one-line bar at the bottom of the screen, which opens the whole
 * panel as a sheet.
 *
 * Hidden entirely on `lg` and up, where the panel is already pinned in view.
 */
export function MobileDock({
  label, value, meta, anchorRef, children,
}: {
  label: string;
  /** The one number worth seeing without opening anything. */
  value?: ReactNode;
  meta?: string;
  /** The panel itself; the bar appears once this scrolls off screen. */
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const [past, setPast] = useState(false);
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // A scroll listener rather than an IntersectionObserver: IO callbacks are
    // suspended while a tab is hidden, and a panel that scrolled away in the
    // background then has no bar when you come back to it. One
    // getBoundingClientRect per scroll event is cheap enough to not need the
    // observer's batching.
    const check = () => {
      const el = anchorRef.current;
      if (!el) return;
      // The header is 56px and sticky, so anything above that line is behind it.
      setPast(el.getBoundingClientRect().bottom < 56);
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [anchorRef]);

  // Scrolling back up to the panel makes the sheet redundant.
  useEffect(() => {
    if (!past) setOpen(false);
  }, [past]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!past) return null;

  // Through a portal: every route root carries `animate-rise`, whose animation
  // leaves an identity transform behind, and a transformed ancestor becomes the
  // containing block for `fixed` children — which pins this to the page instead
  // of the viewport, leaving it stranded mid-document.
  return createPortal(
    <div className="lg:hidden">
      {open && (
        <button
          aria-label="Close"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 cursor-default bg-rock-950/70 backdrop-blur-sm"
        />
      )}

      <div className="fixed inset-x-0 bottom-0 z-50">
        {open && (
          <div
            ref={sheetRef}
            className="max-h-[65vh] overflow-y-auto border-t border-white/10 bg-rock-900/98 px-4 pt-4 pb-2 backdrop-blur-xl"
          >
            {children}
          </div>
        )}

        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={cx(
            'flex w-full items-center gap-3 border-t border-white/12 bg-rock-900/98 px-4 py-3 text-left backdrop-blur-xl',
            // Clears the home indicator on iOS.
            'pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
            !open && 'shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.9)]',
          )}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold tracking-[0.12em] text-ink-500 uppercase">
              {label}
            </span>
            {meta && <span className="block truncate text-xs text-ink-400">{meta}</span>}
          </span>
          {value != null && <span className="numeric shrink-0 font-black">{value}</span>}
          <span aria-hidden className={cx('shrink-0 text-xs text-ink-400 transition', open && 'rotate-180')}>
            ▲
          </span>
        </button>
      </div>
    </div>,
    document.body,
  );
}
