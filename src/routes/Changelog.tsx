import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CHANGELOG, type ChangeTag } from '../data/changelog';
import { Tag } from '../components/WhatsNew';
import { Empty, SectionTitle, cx } from '../components/ui';

const FILTERS: { tag: ChangeTag; label: string }[] = [
  { tag: 'new', label: 'New' },
  { tag: 'improved', label: 'Improved' },
  { tag: 'fixed', label: 'Fixed' },
  { tag: 'data', label: 'Data' },
];

const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

export function ChangelogPage() {
  const [tags, setTags] = useState<Set<ChangeTag>>(new Set());

  const shown = useMemo(
    () => (tags.size === 0 ? CHANGELOG : CHANGELOG.filter((e) => tags.has(e.tag))),
    [tags],
  );

  // Entries are newest-first already, so grouping in place keeps that order.
  const days = useMemo(() => {
    const out: { date: string; entries: typeof CHANGELOG }[] = [];
    for (const entry of shown) {
      const last = out.at(-1);
      if (last?.date === entry.date) last.entries.push(entry);
      else out.push({ date: entry.date, entries: [entry] });
    }
    return out;
  }, [shown]);

  const counts = useMemo(() => {
    const out = {} as Record<ChangeTag, number>;
    for (const e of CHANGELOG) out[e.tag] = (out[e.tag] ?? 0) + 1;
    return out;
  }, []);

  return (
    <div className="animate-rise mx-auto max-w-3xl">
      <header className="panel relative overflow-hidden p-6 sm:p-8">
        <div
          aria-hidden
          className="absolute -top-24 -right-12 h-72 w-72 rounded-full bg-ore-500/15 blur-3xl"
        />
        <div className="relative">
          <p className="text-xs font-semibold tracking-[0.12em] text-ink-500 uppercase">
            Changelog
          </p>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">What's new</h1>
          <p className="mt-2 max-w-xl text-sm text-ink-300">
            Everything that's changed on the Atlas, newest first. Next time you visit after
            something ships, you'll get a nudge in the corner — dismiss it and it won't come back
            until there's something else.
          </p>
        </div>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-1.5">
        {FILTERS.filter((f) => counts[f.tag]).map((f) => (
          <button
            key={f.tag}
            onClick={() =>
              setTags((prev) => {
                const next = new Set(prev);
                next.has(f.tag) ? next.delete(f.tag) : next.add(f.tag);
                return next;
              })
            }
            aria-pressed={tags.has(f.tag)}
            className={cx(
              'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
              tags.has(f.tag)
                ? 'bg-white/12 text-ink-100 ring-1 ring-white/20'
                : 'bg-white/5 text-ink-400 hover:bg-white/10 hover:text-ink-100',
            )}
          >
            {f.label} <span className="numeric opacity-60">{counts[f.tag]}</span>
          </button>
        ))}
        {tags.size > 0 && (
          <button
            onClick={() => setTags(new Set())}
            className="text-xs font-semibold text-ink-400 underline underline-offset-2 hover:text-ore-400"
          >
            Clear
          </button>
        )}
        <span className="numeric ml-auto text-xs text-ink-500">{shown.length} updates</span>
      </div>

      {shown.length === 0 ? (
        <Empty>Nothing matches that filter.</Empty>
      ) : (
        <div className="mt-6 space-y-8">
          {days.map(({ date, entries }) => (
            <section key={date}>
              <SectionTitle title={longDate(date)} />
              {/* A rail down the left ties a day's entries together. */}
              <div className="space-y-3 border-l border-white/10 pl-5">
                {entries.map((entry) => (
                  <article key={entry.id} className="panel relative p-5">
                    <span
                      aria-hidden
                      className="absolute top-7 -left-[1.6rem] h-2 w-2 rounded-full bg-ore-400 ring-4 ring-rock-950"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Tag tag={entry.tag} />
                      <h3 className="font-extrabold">{entry.title}</h3>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{entry.body}</p>
                    {entry.href && (
                      <Link
                        to={entry.href}
                        className="group mt-2.5 inline-block text-sm font-semibold text-ore-400 hover:underline"
                      >
                        Take a look{' '}
                        <span className="inline-block transition group-hover:translate-x-0.5">
                          →
                        </span>
                      </Link>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
