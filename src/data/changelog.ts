/**
 * The site changelog. Hand-written — unlike db.json and images.json in this
 * folder, nothing regenerates it.
 *
 * To add an update: put a new entry at the TOP of the array. Newest first is
 * the order the whole feature relies on, and it's what makes appending a
 * one-line edit.
 *
 * `id` is what each visitor's browser remembers as "the last thing I saw", so
 * it has to be unique and must never be reused for different content — give a
 * new entry a new id rather than editing an old one in place.
 */
export type ChangeTag = 'new' | 'improved' | 'fixed' | 'data';

export interface ChangelogEntry {
  /** Stable and never reused; visitors' "seen" marker points at this. */
  id: string;
  /** YYYY-MM-DD. */
  date: string;
  title: string;
  tag: ChangeTag;
  body: string;
  /** Where to go look at it, if there's somewhere to go. */
  href?: string;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: '2026-09-30-mobile-panels',
    date: '2026-09-30',
    title: 'Phone layout: the panel you care about comes first',
    tag: 'improved',
    body: 'Your loadout and museum totals used to sit below the whole list on a phone, where nobody scrolled to them. They now come first, and once you scroll past, a bar at the bottom keeps them one tap away.',
    href: '/equipment',
  },
  {
    id: '2026-09-30-picker-fix',
    date: '2026-09-30',
    title: 'The museum ore picker opens where you can see it',
    tag: 'fixed',
    body: 'Picking an ore for a display further down the page opened the chooser off-screen above the fold. It now opens centred, wherever you are on the page.',
    href: '/museum',
  },
  {
    id: '2026-09-30-favicon',
    date: '2026-09-30',
    title: 'New tab icon',
    tag: 'improved',
    body: 'A gold pan with a handful of crystals in it, which suits the game rather better than the old letter mark did.',
  },
  {
    id: '2026-09-29-equipment-share',
    date: '2026-09-29',
    title: 'Save and share equipment loadouts',
    tag: 'new',
    body: 'Loadouts now work like museum builds: keep several, switch between them, and send one as a link. The link carries your roll quality and the six-star toggle, so the numbers a friend sees are the ones you saw.',
    href: '/equipment',
  },
  {
    id: '2026-09-29-museum-share',
    date: '2026-09-29',
    title: 'Save and share museum builds',
    tag: 'new',
    body: 'Keep several museum setups the way the Manage Museums Board does, switch between them, and send one to a friend as a link. Opening someone else’s build never touches your own.',
    href: '/museum',
  },
  {
    id: '2026-09-29-changelog',
    date: '2026-09-29',
    title: 'This changelog',
    tag: 'new',
    body: 'Every change to the site now lands here, and you get a nudge the next time you visit after something ships.',
    href: '/changelog',
  },
  {
    id: '2026-09-29-favicon',
    date: '2026-09-29',
    title: 'The tab icon actually loads',
    tag: 'fixed',
    body: 'The favicon pointed at a file that never shipped, so every tab showed a blank page icon. Replaced with a proper one, plus a home-screen icon for phones.',
  },
  {
    id: '2026-09-29-museum',
    date: '2026-09-29',
    title: 'Museum planner',
    tag: 'new',
    body: 'Displays only accept their own rarity, so filling the museum is 18 separate picks. Choose a stat and it ranks every ore, fills the best one into each display, and totals what you gain.',
    href: '/museum',
  },
  {
    id: '2026-09-29-number-inputs',
    date: '2026-09-29',
    title: 'Typing your pan capacity works',
    tag: 'fixed',
    body: 'Clearing the Luck or Capacity box snapped it back to 1, so typing 2400 got you 12400. The boxes can now be empty while you type, and the spinner arrows are gone.',
  },
  {
    id: '2026-09-29-quests-npcs',
    date: '2026-09-29',
    title: 'Quests, NPCs, and who is where',
    tag: 'new',
    body: '107 quests and 120 NPCs, searchable by the place they stand. Location and dig-site pages now list who you will find there.',
    href: '/quests',
  },
  {
    id: '2026-09-29-builds-blueprints',
    date: '2026-09-29',
    title: 'Builds by place, and blueprints',
    tag: 'new',
    body: 'The community build guide, reorganised around where you actually are rather than stage numbers, plus how to obtain every blueprint a recipe needs.',
    href: '/builds',
  },
  {
    id: '2026-09-29-equipment-estimates',
    date: '2026-09-29',
    title: 'Equipment, crafting and session estimates',
    tag: 'new',
    body: '67 craftable items with base and 6-star stats, and an estimator that turns your pan capacity and cycle time into how many of a mineral you should expect in a session.',
    href: '/equipment',
  },
  {
    id: '2026-09-29-luck',
    date: '2026-09-29',
    title: 'Luck model',
    tag: 'new',
    body: 'Enter your Luck, tick the events and totems you have up, and every drop rate on the site re-prices against it. Additive and multiplicative boosts are handled separately, the way the wiki describes them.',
  },
  {
    id: '2026-09-29-launch',
    date: '2026-09-29',
    title: 'Prospecting Atlas is live',
    tag: 'new',
    body: 'Every mineral, every drop rate, and every dig site with its full loot table — the lookup the wiki makes you do by hand, done for you.',
    href: '/',
  },
];
