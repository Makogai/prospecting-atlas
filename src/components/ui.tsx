import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CSSProperties, ReactNode } from 'react';
import {
  imgSrc, rarityByName, digSiteByName, oddsBar, readablePair,
  type RarityName,
} from '../lib/db';

export const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(' ');

/**
 * Applies a wiki gradient pair as CSS vars for the `gradient-text` utility,
 * lifted to a luminance that reads on our dark background.
 */
export const gradientVars = (colors: string[] | null | undefined): CSSProperties => {
  const [g1, g2] = readablePair(colors);
  return { '--g1': g1, '--g2': g2 } as CSSProperties;
};

/* ---------- images ------------------------------------------------------ */

export function Sprite({
  file, alt, className, glow, fit = 'contain', eager,
}: {
  file: string | null | undefined;
  alt: string;
  className?: string;
  glow?: string;
  /** `cover` for wide location screenshots; `contain` for item art. */
  fit?: 'contain' | 'cover';
  eager?: boolean;
}) {
  const src = imgSrc(file);
  if (!src) {
    return (
      <div className={cx('grid place-items-center rounded-xl bg-white/4 text-ink-500', className)}>
        <span className="text-[10px] font-semibold tracking-wide uppercase">no image</span>
      </div>
    );
  }
  return (
    <div className={cx('relative', className)}>
      {glow && (
        <div
          aria-hidden
          className="absolute inset-0 rounded-full opacity-45 blur-2xl"
          style={{ background: glow }}
        />
      )}
      <img
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className={cx(
          'crisp relative h-full w-full',
          fit === 'cover'
            ? 'object-cover'
            : 'object-contain drop-shadow-[0_6px_16px_rgba(0,0,0,0.55)]',
        )}
      />
    </div>
  );
}

/**
 * A numeric field you can actually clear.
 *
 * `<input type="number">` with `value={Math.max(min, Number(raw) || min)}` looks
 * fine until someone selects all and starts typing: clearing the box parses as
 * NaN, snaps straight back to the minimum, and every keystroke then lands after
 * it — so entering 2400 gets you 12400. Holding the text as a draft lets the
 * field be empty mid-edit and only clamps on blur.
 *
 * It's a text input on purpose: no spinner arrows to fight, and inputMode still
 * brings up the numeric keypad on a phone.
 */
export function NumberField({
  value, onChange, min = 0, max, id, className, ariaLabel,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  id?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);

  // Follow the value when something else changes it — a preset button, say —
  // but never yank the text out from under someone mid-edit.
  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  const clamp = (n: number) => Math.min(Math.max(n, min), max ?? Infinity);

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      value={draft}
      onFocus={() => setEditing(true)}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d.]/g, '');
        setDraft(raw);
        // An empty or half-typed box keeps the last good value downstream.
        const n = Number(raw);
        if (raw !== '' && Number.isFinite(n)) onChange(clamp(n));
      }}
      onBlur={() => {
        setEditing(false);
        const n = Number(draft);
        const next = draft === '' || !Number.isFinite(n) ? min : clamp(n);
        setDraft(String(next));
        onChange(next);
      }}
      className={cx(
        'w-full rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-sm outline-none transition',
        className,
      )}
    />
  );
}

/* ---------- tags -------------------------------------------------------- */

export function RarityTag({ rarity, className }: { rarity: RarityName; className?: string }) {
  const r = rarityByName.get(rarity);
  const [c1, c2] = readablePair(r?.colors);
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wider uppercase',
        className,
      )}
      style={{
        ...gradientVars(r?.colors),
        background: `linear-gradient(95deg, ${c1}1f, ${c2}1f)`,
        boxShadow: `inset 0 0 0 1px ${c1}3d`,
      }}
    >
      <span className="gradient-text">{rarity}</span>
    </span>
  );
}

/** Toggleable rarity filter pill, shared by the mineral and dig-site lists. */
export function RarityChip({
  rarity, on, onClick,
}: {
  rarity: RarityName;
  on: boolean;
  onClick: () => void;
}) {
  const r = rarityByName.get(rarity);
  const [c1, c2] = readablePair(r?.colors);
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      style={{
        ...gradientVars(r?.colors),
        boxShadow: on ? `inset 0 0 0 1.5px ${c1}` : undefined,
        background: on ? `linear-gradient(95deg, ${c1}2e, ${c2}2e)` : undefined,
      }}
      className={cx(
        'rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase transition',
        on ? '' : 'bg-white/5 opacity-70 hover:opacity-100',
      )}
    >
      <span className="gradient-text">{rarity}</span>
    </button>
  );
}

/** A dig-site chip that keeps the wiki's own colour coding and links through. */
export function SiteTag({ name, className }: { name: string; className?: string }) {
  const site = digSiteByName.get(name);
  const colors = site?.colors ?? null;
  const body = (
    <span className="gradient-text font-semibold whitespace-nowrap">{name}</span>
  );
  const shared = cx(
    'inline-flex items-center rounded-md bg-white/5 px-2 py-0.5 text-xs ring-1 ring-white/8',
    site && 'transition hover:bg-white/10 hover:ring-white/20',
    className,
  );
  if (!site) return <span className={shared} style={gradientVars(colors)}>{body}</span>;
  return (
    <Link to={`/sites/${site.id}`} className={shared} style={gradientVars(colors)}>
      {body}
    </Link>
  );
}

/* ---------- layout bits ------------------------------------------------- */

export function Stat({
  label, value, sub, accent,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: string;
}) {
  return (
    <div className="panel px-4 py-3">
      <div className="text-[11px] font-semibold tracking-[0.12em] text-ink-500 uppercase">
        {label}
      </div>
      <div className="numeric mt-1 text-xl font-bold" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-ink-400">{sub}</div>}
    </div>
  );
}

export function SectionTitle({
  title, hint, action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-extrabold tracking-tight sm:text-xl">{title}</h2>
        {hint && <p className="mt-0.5 text-sm text-ink-400">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

/** Log-scaled drop-rate bar — linear would render every rare drop as zero. */
export function OddsBar({ percent, colors }: { percent: number | null; colors?: string[] }) {
  const w = oddsBar(percent);
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/7">
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{
          width: `${w}%`,
          background: `linear-gradient(90deg, ${colors?.[0] ?? '#f5a623'}, ${colors?.at(-1) ?? '#ffd98a'})`,
        }}
      />
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="panel grid place-items-center px-6 py-16 text-center text-ink-400">
      {children}
    </div>
  );
}
