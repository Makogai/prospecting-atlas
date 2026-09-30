import { Link } from 'react-router-dom';
import { imgSrc, type NavTile as Tile } from '../lib/db';
import { cx } from './ui';

/**
 * Accent per group, so the four blocks read apart without needing labels.
 * Keyed by the group names in `TILE_ROUTES`.
 */
export const GROUP_ACCENT: Record<string, { text: string; glow: string; ring: string }> = {
  Find: { text: 'text-ore-400', glow: 'bg-ore-500/20', ring: 'group-hover:ring-ore-400/40' },
  Gear: { text: 'text-vein-400', glow: 'bg-vein-500/20', ring: 'group-hover:ring-vein-400/40' },
  Progress: { text: 'text-flux-400', glow: 'bg-flux-400/20', ring: 'group-hover:ring-flux-400/40' },
  Items: { text: 'text-tide-400', glow: 'bg-tide-400/20', ring: 'group-hover:ring-tide-400/40' },
};

/**
 * One front-page tile, using the wiki's own icon art.
 *
 * The icons are white line drawings on transparency, so they're painted as a
 * CSS mask rather than drawn as an image — that way each tile takes its group's
 * accent colour instead of every icon being the same flat white, and they stay
 * crisp against the dark background.
 */
export function NavTile({ tile }: { tile: Tile }) {
  const src = imgSrc(tile.image);
  const accent = GROUP_ACCENT[tile.group] ?? GROUP_ACCENT.Find;

  return (
    <Link
      to={tile.to}
      className={cx(
        'group relative flex flex-col items-center gap-2 overflow-hidden rounded-2xl',
        'border border-white/8 bg-white/3 px-3 py-4 text-center ring-1 ring-transparent',
        'transition duration-200 hover:-translate-y-0.5 hover:bg-white/6',
        accent.ring,
      )}
    >
      <span
        aria-hidden
        className={cx(
          'absolute -top-8 h-20 w-20 rounded-full opacity-0 blur-2xl transition duration-300',
          'group-hover:opacity-100',
          accent.glow,
        )}
      />
      {src ? (
        <span
          aria-hidden
          className={cx(
            'relative h-10 w-10 shrink-0 bg-current transition duration-200 group-hover:scale-110',
            accent.text,
          )}
          style={{
            maskImage: `url(${src})`,
            WebkitMaskImage: `url(${src})`,
            maskSize: 'contain',
            WebkitMaskSize: 'contain',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
            maskPosition: 'center',
            WebkitMaskPosition: 'center',
          }}
        />
      ) : (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cx(
            'relative h-10 w-10 shrink-0 transition duration-200 group-hover:scale-110',
            accent.text,
          )}
        >
          {(tile.paths ?? []).map((d) => (
            <path key={d} d={d} />
          ))}
        </svg>
      )}
      <span className="relative text-xs font-bold text-ink-200 group-hover:text-ink-100">
        {tile.label}
      </span>
    </Link>
  );
}
