import {
  minerals, digSites, locations, gearGroups, GEAR_LABEL, equipment, npcs, quests,
  type GearKind, money, gearPrice,
} from './db';

export type ResultKind =
  | 'mineral' | 'site' | 'location' | 'gear' | 'equipment' | 'npc' | 'quest';

export interface SearchItem {
  kind: ResultKind;
  id: string;
  name: string;
  href: string;
  image: string | null;
  /** Right-aligned detail, e.g. a price or drop count. */
  meta: string;
  /** Small coloured label, e.g. the rarity. */
  tag: string | null;
  colors: string[] | null;
  haystack: string;
}

/** Everything the command palette can jump to, built once at module load. */
export const searchIndex: SearchItem[] = [
  ...minerals.map((m) => ({
    kind: 'mineral' as const,
    id: m.id,
    name: m.name,
    href: `/minerals/${m.id}`,
    image: m.image,
    meta: money(m.value),
    tag: m.rarity,
    colors: null,
    haystack: `${m.name} ${m.rarity} ${m.description} ${m.locations.join(' ')}`.toLowerCase(),
  })),
  ...digSites.map((s) => ({
    kind: 'site' as const,
    id: s.id,
    name: s.name,
    href: `/sites/${s.id}`,
    image: null,
    meta: `${s.mineralCount} minerals`,
    tag: 'Dig site',
    colors: s.colors,
    haystack: `${s.name} dig site ${s.minerals.map((m) => m.name).join(' ')}`.toLowerCase(),
  })),
  ...locations.map((l) => ({
    kind: 'location' as const,
    id: l.id,
    name: l.name,
    href: `/locations/${l.id}`,
    image: l.image,
    meta: l.digSites.length ? `${l.digSites.length} dig sites` : 'landmark',
    tag: 'Location',
    colors: l.colors,
    haystack: `${l.name} location ${l.summary}`.toLowerCase(),
  })),
  ...equipment.map((e) => ({
    kind: 'equipment' as const,
    id: e.id,
    name: e.name,
    href: `/equipment?q=${encodeURIComponent(e.name)}`,
    image: e.image,
    meta: e.slot ?? 'Equipment',
    tag: e.rarity,
    colors: e.color ? [e.color, e.color] : null,
    haystack: `${e.name} ${e.rarity} ${e.slot} ${e.description} ${e.stats.map((s) => s.stat).join(' ')} ${e.recipe.map((r) => r.item).join(' ')}`.toLowerCase(),
  })),
  // "Where is X?" is one of the most common questions, so NPCs carry every
  // place they stand in their haystack and show the first one as their detail.
  ...npcs.map((n) => ({
    kind: 'npc' as const,
    id: n.id,
    name: n.name,
    href: `/quests?npc=${encodeURIComponent(n.name)}`,
    image: n.image,
    meta: n.places[0]?.name ?? n.regions[0] ?? 'NPC',
    tag: 'NPC',
    colors: null,
    haystack: `${n.name} npc ${n.summary ?? ''} ${n.regions.join(' ')} ${n.places
      .map((p) => `${p.name} ${p.note ?? ''}`)
      .join(' ')}`.toLowerCase(),
  })),
  ...quests.map((q) => ({
    kind: 'quest' as const,
    id: q.id,
    name: q.name,
    href: `/quests?q=${encodeURIComponent(q.name)}`,
    image: null,
    meta: q.location,
    tag: 'Quest',
    colors: null,
    haystack: `${q.name} quest ${q.summary ?? ''} ${q.npc ?? ''} ${q.location} ${q.steps
      .map((s) => s.text)
      .join(' ')}`.toLowerCase(),
  })),
  ...(Object.keys(gearGroups) as GearKind[]).flatMap((kind) =>
    gearGroups[kind].map((g) => ({
      kind: 'gear' as const,
      id: `${kind}-${g.id}`,
      name: g.name,
      href: `/gear/${kind}#${g.id}`,
      image: g.image,
      meta: gearPrice(g),
      tag: GEAR_LABEL[kind].replace(/s$/, ''),
      colors: g.color ? [g.color, g.color] : null,
      haystack: `${g.name} ${kind} ${g.description} ${g.source}`.toLowerCase(),
    })),
  ),
];

/**
 * Subsequence match with a bonus for contiguous runs and word starts, so
 * "pinkd" ranks Pink Diamond above anything that merely contains those letters.
 */
function fuzzyScore(needle: string, hay: string): number {
  if (!needle) return 0;
  const exact = hay.indexOf(needle);
  if (exact === 0) return 1000;
  if (exact > 0) return 700 - Math.min(exact, 100);

  let score = 0;
  let at = 0;
  let streak = 0;
  for (const ch of needle) {
    const found = hay.indexOf(ch, at);
    if (found === -1) return -1;
    streak = found === at ? streak + 1 : 0;
    score += 10 + streak * 6 + (found === 0 || hay[found - 1] === ' ' ? 8 : 0);
    at = found + 1;
  }
  return score - at * 0.3;
}

const KIND_WEIGHT: Record<ResultKind, number> = {
  mineral: 30, site: 20, location: 10, npc: 8, equipment: 5, quest: 3, gear: 0,
};

export function search(query: string, limit = 24): SearchItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const scored: { item: SearchItem; score: number }[] = [];
  for (const item of searchIndex) {
    const name = item.name.toLowerCase();
    // Fuzzy matching is for names only. Running it over the whole haystack
    // matches almost everything - "pinkd" would pull in Pyrite and Platinum -
    // so secondary fields have to contain the query outright.
    let s = fuzzyScore(q, name);
    if (s < 0) {
      if (!item.haystack.includes(q)) continue;
      s = 120 - Math.min(item.haystack.indexOf(q), 100);
    }
    scored.push({ item, score: s + KIND_WEIGHT[item.kind] });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.item.name.length - b.item.name.length)
    .slice(0, limit)
    .map((x) => x.item);
}
