import { useEffect, useRef, useState } from 'react';
import { STAT_GROUPS, type Band, type StatLine } from '../lib/stats';
import { cx } from './ui';

/**
 * The Settings → Stats panel, with its working shown.
 *
 * In game you get two numbers — a total and a base in parentheses — and no way
 * to find out where either came from. The whole point of this panel is the
 * third thing: open a stat and every contribution is listed under the term of
 * the formula it lands in, so 'why is my Luck only that' has an answer.
 */

const BAND_LABEL: Record<Band, string> = {
  base: 'Base — what you have equipped',
  flat: 'Flats — points added on top',
  boost: 'Boosts — summed, then multiplied in once',
  event: 'Events — the one true multiplier',
};

const BAND_ORDER: Band[] = ['base', 'flat', 'boost', 'event'];

const BAND_TINT: Record<Band, string> = {
  base: 'text-ore-300',
  flat: 'text-tide-400',
  boost: 'text-vein-400',
  event: 'text-flux-400',
};

/** Panel numbers run from 0.5 to six figures, so the precision has to move. */
export function fmt(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1000) return Math.round(n).toLocaleString('en-US');
  if (abs >= 100) return n.toFixed(0);
  if (abs >= 10) return n.toFixed(1).replace(/\.0$/, '');
  return n.toFixed(2).replace(/\.?0+$/, '');
}

const signed = (n: number) => `${n > 0 ? '+' : ''}${fmt(n)}`;

export function StatPanel({
  lines, dense, openStat,
}: {
  lines: StatLine[];
  /** Hide stats nothing in the build touches. */
  dense?: boolean;
  /** A stat the URL named, e.g. from searching "shake speed". */
  openStat?: string | null;
}) {
  const [open, setOpen] = useState<string | null>(openStat ?? null);
  const scrolled = useRef<string | null>(null);

  // Opening from a link should also bring the row into view. Keyed on the
  // wanted stat rather than firing once, so searching a second stat from this
  // page works — nothing remounts in between.
  useEffect(() => {
    if (!openStat) return;
    setOpen(openStat);
    if (scrolled.current === openStat) return;
    scrolled.current = openStat;
    // One frame for the row to expand, so the scroll lands on its final height.
    const t = setTimeout(() => {
      document
        .querySelector(`[data-stat="${CSS.escape(openStat)}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
    return () => clearTimeout(t);
  }, [openStat]);
  const live = lines.filter((l) => l.contributions.length > 0);
  const shown = dense ? live : lines;

  if (live.length === 0) {
    return (
      <div className="panel px-5 py-10 text-center">
        <p className="text-sm font-semibold text-ink-300">Nothing equipped yet</p>
        <p className="mx-auto mt-1.5 max-w-xs text-xs text-ink-500">
          Pick a pan and the panel fills in. Everything you add shows up here with its own line,
          the way the game would total it.
        </p>
      </div>
    );
  }

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-baseline justify-between gap-3 border-b border-white/8 px-5 py-3.5">
        <h2 className="text-sm font-extrabold tracking-[0.1em] text-ink-400 uppercase">
          Your stats
        </h2>
        <span className="text-[11px] text-ink-500">total (base)</span>
      </div>

      <div className="divide-y divide-white/6">
        {STAT_GROUPS.map((group) => {
          const rows = shown.filter((l) => l.stat.group === group);
          if (rows.length === 0) return null;
          return (
            <div key={group}>
              <p className="bg-white/2 px-5 py-1.5 text-[10px] font-bold tracking-[0.14em] text-ink-600 uppercase">
                {group}
              </p>
              {rows.map((line) => (
                <StatRow
                  key={line.stat.key}
                  line={line}
                  open={open === line.stat.key}
                  onToggle={() => setOpen(open === line.stat.key ? null : line.stat.key)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatRow({
  line, open, onToggle,
}: {
  line: StatLine;
  open: boolean;
  onToggle: () => void;
}) {
  const { stat, base, flats, boosts, eventMult, total } = line;
  const empty = line.contributions.length === 0;
  // Dimmed when it adds up to nothing, but still openable if anything fed it —
  // a stat sitting at zero because two sources cancelled is worth seeing.
  const faded = empty || total === 0;
  const unit = stat.unit ?? '';

  // Three segments showing where the total came from, in the order the formula
  // applies them. Widths are shares of the total, so a stat whose multiplier is
  // doing all the work reads that way at a glance.
  const gain = total - (base + flats);
  const parts = total > 0
    ? [
      { key: 'base', w: Math.max(base, 0) / total, cls: 'bg-ore-400' },
      { key: 'flat', w: Math.max(flats, 0) / total, cls: 'bg-tide-400' },
      { key: 'gain', w: Math.max(gain, 0) / total, cls: 'bg-vein-500' },
    ].filter((p) => p.w > 0.001)
    : [];

  return (
    <div data-stat={stat.key} className={cx(faded && 'opacity-45')}>
      <button
        onClick={onToggle}
        disabled={empty}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition enabled:hover:bg-white/4"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-[13px] font-semibold text-ink-200">{stat.key}</span>
            {/* A multiplier on nothing is still nothing. The XP Cookie reaches
                almost every stat, so without this every stat you have no gear
                for would advertise a x2 that buys you zero. */}
            {total > 0 && boosts > 0 && (
              <span className="numeric shrink-0 text-[10px] font-bold text-vein-400">
                ×{(1 + boosts).toFixed(2)}
              </span>
            )}
            {total > 0 && eventMult > 1 && (
              <span className="numeric shrink-0 text-[10px] font-bold text-flux-400">
                ×{eventMult}
              </span>
            )}
          </span>
          {parts.length > 0 && (
            <span className="mt-1.5 flex h-1 gap-px overflow-hidden rounded-full bg-white/7">
              {parts.map((p) => (
                <span key={p.key} className={cx('h-full', p.cls)} style={{ width: `${p.w * 100}%` }} />
              ))}
            </span>
          )}
        </span>

        <span className="shrink-0 text-right">
          <span className="numeric block text-sm font-black text-ink-100">
            {fmt(total)}{unit}
          </span>
          {total > 0 && (flats !== 0 || boosts > 0 || eventMult > 1) && (
            <span className="numeric block text-[10px] text-ink-500">({fmt(base)}{unit})</span>
          )}
        </span>

        {!empty && (
          <span aria-hidden className={cx('shrink-0 text-[9px] text-ink-600 transition', open && 'rotate-180')}>
            ▼
          </span>
        )}
      </button>

      {open && <Breakdown line={line} />}
    </div>
  );
}

function Breakdown({ line }: { line: StatLine }) {
  const { stat, base, flats, boosts, eventMult, total } = line;
  const unit = stat.unit ?? '';

  return (
    <div className="border-t border-white/6 bg-rock-950/40 px-5 py-3.5">
      <p className="mb-3 text-[11px] leading-relaxed text-ink-400">{stat.blurb}</p>

      {BAND_ORDER.map((band) => {
        const rows = line.contributions.filter((c) => c.band === band);
        if (rows.length === 0) return null;
        return (
          <div key={band} className="mb-3 last:mb-0">
            <p className={cx('mb-1 text-[10px] font-bold tracking-[0.1em] uppercase', BAND_TINT[band])}>
              {BAND_LABEL[band]}
            </p>
            <dl className="space-y-1">
              {rows.map((c, i) => (
                <div key={`${c.source}-${i}`}>
                  <div className="flex items-baseline justify-between gap-3 text-[11px]">
                    <dt className="min-w-0 flex-1 text-ink-300">{c.source}</dt>
                    <dd className={cx('numeric shrink-0 font-bold', BAND_TINT[band])}>
                      {band === 'boost'
                        ? `${c.value > 0 ? '+' : ''}${c.value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}`
                        : band === 'event'
                          ? `×${c.value}`
                          : `${signed(c.value)}${unit}`}
                    </dd>
                  </div>
                  {c.note && <p className="mt-0.5 text-[10px] leading-snug text-ink-600">{c.note}</p>}
                </div>
              ))}
            </dl>
          </div>
        );
      })}

      {/* The formula with this stat's own numbers in it. Seeing 'boosts add'
          written out with real values is what makes the rule stick. */}
      <p className="numeric mt-3 border-t border-white/6 pt-2.5 text-[11px] leading-relaxed text-ink-500">
        ({fmt(base)}
        {flats !== 0 && <> {flats > 0 ? '+' : '−'} {fmt(Math.abs(flats))}</>})
        {boosts !== 0 && <> × {(1 + boosts).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}</>}
        {eventMult > 1 && <> × {eventMult}</>}
        {' = '}
        <span className="font-bold text-ink-200">{fmt(total)}{unit}</span>
      </p>

      {!stat.boostable && line.contributions.some((c) => c.band === 'boost') && (
        <p className="mt-2 rounded-lg bg-white/4 px-2.5 py-1.5 text-[10px] leading-snug text-ink-500">
          This stat takes no multiplier in game, so the boosts above are listed but not applied.
        </p>
      )}
    </div>
  );
}
