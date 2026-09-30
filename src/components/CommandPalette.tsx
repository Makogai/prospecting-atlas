import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { search, type SearchItem } from '../lib/search';
import { minerals, digSites } from '../lib/db';
import { RarityTag, Sprite, cx, gradientVars } from './ui';

const KIND_ICON: Record<SearchItem['kind'], string> = {
  mineral: '◆',
  site: '⛏',
  location: '▲',
  equipment: '◇',
  npc: '☺',
  quest: '❯',
  gear: '●',
  museum: '★',
  modifier: '✦',
  code: '⌨',
  enchant: '✧',
  relic: '⌘',
  potion: '⚗',
  rune: '⍟',
  excavation: '⛏',
  mastery: '◈',
};

/** Shown before the user types: the things people look up most. */
const SUGGESTIONS: SearchItem[] = [
  ...minerals
    .filter((m) => ['Gold', 'Pink Diamond', 'Aetherium'].includes(m.name))
    .map((m): SearchItem => ({
      kind: 'mineral',
      id: m.id,
      name: m.name,
      href: `/minerals/${m.id}`,
      image: m.image,
      meta: m.rarity,
      tag: m.rarity,
      colors: null,
      haystack: '',
    })),
  ...digSites.slice(0, 3).map((s): SearchItem => ({
    kind: 'site',
    id: s.id,
    name: s.name,
    href: `/sites/${s.id}`,
    image: null,
    meta: `${s.mineralCount} minerals`,
    tag: 'Dig site',
    colors: s.colors,
    haystack: '',
  })),
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => (q.trim() ? search(q) : SUGGESTIONS), [q]);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setActive(0);
    // Wait a frame so the input exists and the dialog has painted.
    const t = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, [open]);

  useEffect(() => setActive(0), [q]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const go = (item: SearchItem) => {
    onClose();
    navigate(item.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) {
      e.preventDefault();
      setActive((i) => (i + 1) % Math.max(results.length, 1));
    } else if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % Math.max(results.length, 1));
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      go(results[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[10vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Search Prospecting Atlas"
    >
      <button
        aria-label="Close search"
        className="absolute inset-0 cursor-default bg-rock-950/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className="animate-rise relative w-full max-w-2xl overflow-hidden rounded-2xl border border-white/12 bg-rock-900/95 shadow-2xl shadow-black/60 backdrop-blur-2xl"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-white/8 px-4">
          <span className="text-ore-400" aria-hidden>
            {'⌕'}
          </span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search minerals, dig sites, pans, shovels…"
            className="w-full bg-transparent py-4 text-[15px] outline-none placeholder:text-ink-500"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden rounded border border-white/12 px-1.5 py-0.5 text-[10px] text-ink-500 sm:block">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {!q.trim() && (
            <div className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-[0.12em] text-ink-500 uppercase">
              Popular
            </div>
          )}

          {results.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-ink-400">
              Nothing matches “{q}”.
            </div>
          )}

          {results.map((item, i) => (
            <button
              key={item.kind + item.id}
              data-idx={i}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(item)}
              className={cx(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition',
                i === active ? 'bg-white/10' : 'hover:bg-white/5',
              )}
            >
              {item.image ? (
                <Sprite file={item.image} alt="" className="h-8 w-8 shrink-0" />
              ) : (
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/6 text-xs"
                  style={gradientVars(item.colors)}
                >
                  <span className="gradient-text">{KIND_ICON[item.kind]}</span>
                </span>
              )}

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{item.name}</span>
                <span className="block truncate text-xs text-ink-500 capitalize">{item.kind}</span>
              </span>

              {item.kind === 'mineral' && item.tag ? (
                <RarityTag rarity={item.tag as never} />
              ) : (
                <span className="numeric shrink-0 text-xs text-ink-400">{item.meta}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 border-t border-white/8 px-4 py-2 text-[11px] text-ink-500">
          <span>
            <kbd className="text-ink-300">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="text-ink-300">↵</kbd> open
          </span>
          <span className="ml-auto">
            {results.length} result{results.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </div>
  );
}
