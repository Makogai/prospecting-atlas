import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Every query parameter that names a specific item on a page.
 *
 * Layout reads this to decide whether to reset the scroll position on
 * navigation: a link that points at something halfway down a page has to win
 * over the usual jump to the top, or the highlight lands off screen.
 */
export const HIGHLIGHT_PARAMS = ['rune', 'potion', 'relic', 'e', 'mod', 'code', 'site'];

export const namesATarget = (search: string) => {
  const params = new URLSearchParams(search);
  return HIGHLIGHT_PARAMS.some((key) => params.has(key));
};

/**
 * Find-and-show for a search result that lands in a long list.
 *
 * Opening the right tab isn't enough when the tab holds twenty runes — the
 * thing you searched for is still somewhere on screen for you to hunt. When the
 * URL names an item, this scrolls it into view and marks it.
 *
 * Two things shape how it's built:
 *
 * The mark is put on the node from an effect rather than rendered into
 * `className`. Every page is prerendered *without* a query string, so the
 * server's markup has no highlight, and React does not patch a className-only
 * difference while hydrating — a rendered class silently never appeared.
 *
 * It keys on the wanted id rather than firing once per mount. Searching a
 * second rune from the same page doesn't remount anything, so a one-shot guard
 * left the new target unmarked and the old one still glowing.
 *
 * Scrolling is not a one-shot either: sprites load after first paint and push
 * everything below them down, so a single scroll computed on the first frame
 * lands short. This corrects for a moment, then stops touching the scroll
 * position so it never fights the reader.
 *
 * Usage:
 *   const found = useHighlight('rune');
 *   <div {...found.mark(r.id)} className="panel">
 */
export function useHighlight(param: string, extraClasses = '') {
  const [params] = useSearchParams();
  const wanted = params.get(param);

  useEffect(() => {
    if (!wanted) return;

    const classes = ['is-found', ...extraClasses.split(' ').filter(Boolean)];
    const timers: ReturnType<typeof setTimeout>[] = [];
    let marked: HTMLElement | null = null;
    let stopped = false;

    const settle = (node: HTMLElement) => {
      const box = node.getBoundingClientRect();
      const offset = box.top + window.scrollY - window.innerHeight / 2 + box.height / 2;
      window.scrollTo({ top: Math.max(offset, 0), behavior: 'smooth' });
    };

    // The item may not be on screen yet: a page whose tab or category has to
    // change first renders the new list a tick later. Retry briefly rather than
    // giving up on the first look.
    const find = (attempt = 0) => {
      if (stopped) return;
      const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(wanted) : wanted;
      const node = document.querySelector<HTMLElement>(`[data-found="${escaped}"]`);
      if (!node) {
        if (attempt < 10) timers.push(setTimeout(() => find(attempt + 1), 60));
        return;
      }
      marked = node;
      node.classList.add(...classes);
      settle(node);
      // Sprites load after first paint and push everything below them down, so
      // a scroll computed on the first frame lands short.
      timers.push(setTimeout(() => settle(node), 220));
      timers.push(setTimeout(() => settle(node), 650));
    };

    find();

    return () => {
      stopped = true;
      for (const t of timers) clearTimeout(t);
      // Searching something else on the same page has to clear this one, or two
      // items end up glowing and neither looks like the answer.
      marked?.classList.remove(...classes);
    };
  }, [wanted, extraClasses]);

  return {
    wanted,
    /** For deciding state — which tab, which category — not for markup. */
    is: (id: string) => wanted != null && id === wanted,
    /** Spread onto the item so the effect can find it. */
    mark: (id: string) => ({ 'data-found': id }),
  };
}
