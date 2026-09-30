import {
  minerals, digSites, locations, gearGroups, GEAR_LABEL, equipment, npcs, quests,
  museum, museumOresByStat, boostFor, boostLabel,
  modifiers, codes, enchants, relics, potions, runes, excavations, mastery,
  type GearKind, money, gearPrice, percent,
} from './db';

export type ResultKind =
  | 'mineral' | 'site' | 'location' | 'gear' | 'equipment' | 'npc' | 'quest' | 'museum'
  | 'modifier' | 'code' | 'enchant' | 'relic' | 'potion' | 'rune' | 'excavation' | 'mastery';

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
    haystack: `${m.name} ${m.rarity} ${m.description} ${m.locations.join(' ')} ${
      m.museum ? `museum ${m.museum.boosts.map((b) => b.stat).join(' ')}` : ''
    }`.toLowerCase(),
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
  // One entry per museum stat, because "where do I get more luck" is a question
  // about a stat, not about a page. Each jumps straight to that stat selected.
  ...museum.stats.map((stat) => {
    const top = (museumOresByStat.get(stat) ?? [])[0];
    return {
      kind: 'museum' as const,
      id: `museum-${stat}`,
      name: `Museum — ${stat}`,
      href: `/museum?stat=${encodeURIComponent(stat)}`,
      image: null,
      meta: top ? `best ${boostLabel(boostFor(top, stat))} ${top.name}` : '',
      tag: 'Museum',
      colors: null,
      haystack: `museum ${stat} donation display pedestal boost ${(museumOresByStat.get(stat) ?? [])
        .slice(0, 8)
        .map((o) => o.name)
        .join(' ')}`.toLowerCase(),
    };
  }),

  ...modifiers.map((m) => ({
    kind: 'modifier' as const,
    id: `mod-${m.id}`,
    name: m.name,
    href: `/modifiers`,
    image: null,
    meta: m.sellMultiplier != null ? `${m.sellMultiplier}× sell` : '',
    tag: 'Modifier',
    colors: m.color ? [m.color, m.color] : null,
    haystack: `${m.name} modifier sell value multiplier ${m.description ?? ''} ${m.source ?? ''}`.toLowerCase(),
  })),

  ...codes.map((c) => ({
    kind: 'code' as const,
    id: `code-${c.code}`,
    name: c.code,
    href: '/codes',
    image: null,
    meta: c.active ? c.rewards.map((r) => `${r.value} ${r.name}`).join(', ') : 'expired',
    tag: c.active ? 'Code' : 'Expired',
    colors: null,
    haystack: `${c.code} code redeem free ${c.active ? 'active working' : 'expired dead'}`.toLowerCase(),
  })),

  ...enchants.map((e) => ({
    kind: 'enchant' as const,
    id: `ench-${e.id}`,
    name: e.name,
    href: '/enchanting',
    image: null,
    meta: e.bestChance != null ? `${percent(e.bestChance)} on a ${e.slot.toLowerCase()}` : e.slot,
    tag: 'Enchant',
    colors: null,
    haystack: `${e.name} enchant ${e.slot} ${e.effect} ${e.stats.join(' ')}`.toLowerCase(),
  })),

  ...relics.map((r) => ({
    kind: 'relic' as const,
    id: `relic-${r.id}`,
    name: r.name,
    href: '/relics',
    image: r.image,
    meta: `${r.category} relic`,
    tag: 'Relic',
    colors: null,
    haystack: `${r.name} relic ${r.category} ${r.description ?? ''} ${r.triggers.join(' ')}`.toLowerCase(),
  })),

  ...potions.map((p) => ({
    kind: 'potion' as const,
    id: `potion-${p.id}`,
    name: p.name,
    href: '/items',
    image: p.image,
    meta: p.money != null ? money(p.money) : (p.priceLabel ?? ''),
    tag: 'Potion',
    colors: null,
    haystack: `${p.name} potion ${p.effect} ${p.shop ?? ''} ${p.stats.join(' ')}`.toLowerCase(),
  })),

  ...runes.runes.map((r) => ({
    kind: 'rune' as const,
    id: `rune-${r.id}`,
    name: r.name,
    href: '/progression',
    image: r.image,
    meta: 'Rune',
    tag: 'Rune',
    colors: r.color ? [r.color, r.color] : null,
    haystack: `${r.name} rune ${r.effect ?? ''} ${r.where ?? ''}`.toLowerCase(),
  })),

  ...excavations.sites.map((s) => ({
    kind: 'excavation' as const,
    id: `exc-${s.id}`,
    name: s.name,
    href: '/excavations',
    image: null,
    meta: `${s.region} · ${s.duration ?? ''}`,
    tag: 'Excavation',
    colors: null,
    haystack: `${s.name} excavation site ${s.code ?? ''} ${s.region} permit`.toLowerCase(),
  })),

  ...mastery.tracks.map((t) => ({
    kind: 'mastery' as const,
    id: `mastery-${t.id}`,
    name: `${t.name} mastery`,
    href: '/progression',
    image: null,
    meta: t.boost ?? `${t.tiers.length} tiers`,
    tag: 'Mastery',
    colors: null,
    haystack: `${t.name} mastery ${t.boost ?? ''} milestones`.toLowerCase(),
  })),
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
  mineral: 30, site: 20, location: 10, npc: 8, museum: 6, equipment: 5,
  code: 12, modifier: 9, enchant: 7, relic: 7, rune: 6, potion: 5,
  excavation: 5, mastery: 4, quest: 3, gear: 0,
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
