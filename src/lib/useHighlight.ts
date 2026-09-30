import { useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Find-and-show for a search result that lands in a long list.
 *
 * Opening the right tab isn't enough when the tab holds twenty runes — the
 * thing you searched for is still somewhere on screen for you to hunt. When the
 * URL names an item, this scrolls it into view and marks it.
 *
 * Scrolling happens once per mount, on the node's first attach: doing it on
 * every render would fight the user the moment they scrolled away, and doing it
 * in an effect keyed on the id would re-trigger on unrelated re-renders.
 *
 * Usage:
 *   const found = useHighlight('rune');
 *   <div ref={found.ref(r.id)} className={cx('panel', found.is(r.id) && 'is-found')}>
 */
export function useHighlight(param: string) {
  const [params] = useSearchParams();
  const wanted = params.get(param);
  const done = useRef(false);

  const attach = useCallback((node: HTMLElement | null) => {
    if (!node || done.current) return;
    done.current = true;
    // A frame's grace so the tab's content has laid out before we measure.
    requestAnimationFrame(() => {
      node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }, []);

  return {
    wanted,
    is: (id: string) => wanted != null && id === wanted,
    /** Attach to the matching item; returns undefined for everything else. */
    ref: (id: string) => (wanted != null && id === wanted ? attach : undefined),
  };
}
