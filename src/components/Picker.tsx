import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Sprite, cx } from './ui';

/**
 * A chooser that shows you what you are choosing between.
 *
 * A native `<select>` can only offer a line of text, which is the wrong shape
 * for picking gear: the thing you want to know is what the item is worth, and
 * on this page that is four stat lines and a price. So the trigger renders the
 * current pick the way a card would, and the list gives every option its sprite,
 * its numbers and a search box.
 *
 * The list is a centred dialog rather than an anchored menu. It is the same
 * control the ore and equipment pickers on this page already use, it has room
 * for a rich row at any width, and it cannot end up rendered off screen the way
 * an anchored menu does inside a scrolled column.
 */
export interface PickerOption {
  id: string;
  name: string;
  image?: string | null;
  /** The wiki's own colour for the item's name. */
  color?: string | null;
  /** Second line under the name — stats, or what an enchant does. */
  meta?: string;
  /** Right-hand label: a price, a rarity, an odds figure. */
  tag?: ReactNode;
  /** Shown in place of the tag when the thing can't be obtained any more. */
  muted?: boolean;
  /** Extra text to match on, beyond the name. */
  haystack?: string;
}

/**
 * Stand-in art for options the wiki has no icon for.
 *
 * Enchants are the case this exists for: there are 23 of them and none has an
 * image, so a column of "no image" boxes would be most of the list. An initial
 * tinted by name at least gives the eye something stable to aim at.
 */
function OptionArt({ option, size }: { option: PickerOption; size: string }) {
  if (option.image) return <Sprite file={option.image} alt="" className={cx('shrink-0', size)} />;
  const hue = [...option.name].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span
      aria-hidden
      className={cx('grid shrink-0 place-items-center rounded-lg text-sm font-black', size)}
      style={{
        background: `linear-gradient(140deg, hsl(${hue} 55% 22%), hsl(${(hue + 40) % 360} 55% 14%))`,
        color: `hsl(${hue} 80% 72%)`,
      }}
    >
      {option.name.slice(0, 1)}
    </span>
  );
}

export function RichSelect({
  label, value, options, onChange, placeholder, clearLabel, title,
}: {
  label: string;
  value: string | null;
  options: PickerOption[];
  onChange: (id: string | null) => void;
  /** Shown on the trigger when nothing is picked. */
  placeholder: string;
  /** The "none of them" row at the top of the list; omitted if not given. */
  clearLabel?: string;
  /** Dialog heading; defaults to the field label. */
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const chosen = options.find((o) => o.id === value) ?? null;

  return (
    <div>
      <span className="mb-1 block text-[11px] font-semibold text-ink-400">{label}</span>
      <button
        onClick={() => setOpen(true)}
        className={cx(
          'flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition',
          chosen
            ? 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8'
            : 'border-dashed border-white/12 hover:border-ore-400/40 hover:bg-white/4',
        )}
      >
        {chosen ? (
          <OptionArt option={chosen} size="h-9 w-9" />
        ) : (
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/5 text-base font-light text-ink-500"
          >
            +
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span
            className={cx(
              'block truncate text-sm font-bold',
              chosen ? 'text-ink-100' : 'text-ink-500',
            )}
            style={chosen?.color ? { color: chosen.color } : undefined}
          >
            {chosen ? chosen.name : placeholder}
          </span>
          {chosen?.meta && (
            <span className="numeric block truncate text-[11px] text-ink-500">{chosen.meta}</span>
          )}
        </span>
        <span aria-hidden className="shrink-0 text-[9px] text-ink-500">▼</span>
      </button>

      {open && (
        <PickerDialog
          title={title ?? label}
          options={options}
          value={value}
          clearLabel={clearLabel}
          onClose={() => setOpen(false)}
          onChoose={(id) => {
            onChange(id);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

export function PickerDialog({
  title, options, value, clearLabel, onClose, onChoose, footer,
}: {
  title: string;
  options: PickerOption[];
  value?: string | null;
  clearLabel?: string;
  onClose: () => void;
  onChoose: (id: string | null) => void;
  footer?: ReactNode;
}) {
  const [q, setQ] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Open on what you already have. Twenty-three pans is a long list, and
  // landing at the top of it means scrolling to find out what you picked last
  // time before you can judge anything against it.
  useEffect(() => {
    if (!value) return;
    const row = listRef.current?.querySelector(`[data-option="${CSS.escape(value)}"]`);
    row?.scrollIntoView({ block: 'center' });
  }, [value]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(
      (o) =>
        o.name.toLowerCase().includes(needle) ||
        (o.meta ?? '').toLowerCase().includes(needle) ||
        (o.haystack ?? '').toLowerCase().includes(needle),
    );
  }, [options, q]);

  // Portalled: every route root carries `animate-rise`, whose animation leaves
  // an identity transform behind, and a transformed ancestor becomes the
  // containing block for `fixed` children — which would pin this to the page
  // instead of the viewport and strand it above the fold.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-rock-950/80 p-4 pt-[8vh] backdrop-blur-sm">
      {/* Click-away layer sits behind the dialog, not over it. */}
      <button aria-label="Close" onClick={onClose} className="fixed inset-0 cursor-default" />
      <div className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-rock-900 shadow-2xl">
        <div className="border-b border-white/8 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-extrabold">{title}</h2>
            <span className="text-[11px] text-ink-500">{shown.length} to choose from</span>
          </div>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, stat or effect…"
            className="mt-3 w-full rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-sm outline-none transition focus:border-ore-400/50 focus:bg-white/7"
          />
        </div>

        <div ref={listRef} className="max-h-[58vh] divide-y divide-white/6 overflow-y-auto">
          {clearLabel && !q && (
            <button
              onClick={() => onChoose(null)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/5"
            >
              <span
                aria-hidden
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/5 text-ink-600"
              >
                ✕
              </span>
              <span className="text-sm font-semibold text-ink-400">{clearLabel}</span>
            </button>
          )}

          {shown.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-ink-500">Nothing matches.</p>
          )}

          {shown.map((o) => (
            <button
              key={o.id}
              data-option={o.id}
              onClick={() => onChoose(o.id)}
              className={cx(
                'flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/5',
                o.id === value && 'bg-ore-400/8',
              )}
            >
              <OptionArt option={o} size="h-10 w-10" />
              <span className="min-w-0 flex-1">
                <span
                  className="block truncate text-sm font-bold"
                  style={o.color ? { color: o.color } : undefined}
                >
                  {o.name}
                  {o.muted && (
                    <span className="ml-2 rounded bg-white/8 px-1.5 text-[10px] font-semibold text-ink-400">
                      removed
                    </span>
                  )}
                </span>
                {o.meta && (
                  <span className="numeric mt-0.5 block text-[11px] leading-snug text-ink-500">
                    {o.meta}
                  </span>
                )}
              </span>
              {o.tag != null && (
                <span className="numeric shrink-0 text-right text-[11px] font-semibold text-ink-400">
                  {o.tag}
                </span>
              )}
            </button>
          ))}
        </div>

        {footer && <div className="border-t border-white/8 px-4 py-2.5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/**
 * An empty equipment slot: a drop zone you click to fill.
 *
 * Ten slots rendered as ten "Add ring" links read as a form. Rendered as tiles
 * with a plus in them, the shape of the build is legible before you have put
 * anything in it — you can see at a glance that six ring slots are still empty.
 */
export function EmptySlot({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex h-[5.4rem] w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/12 transition hover:border-ore-400/50 hover:bg-ore-400/5"
    >
      <span
        aria-hidden
        className="text-lg leading-none font-light text-ink-600 transition group-hover:text-ore-400"
      >
        +
      </span>
      <span className="text-[10px] font-semibold tracking-wide text-ink-600 uppercase transition group-hover:text-ore-400">
        {label}
      </span>
    </button>
  );
}
