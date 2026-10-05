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
    id: '2026-10-05-data-refresh',
    date: '2026-10-05',
    title: 'Data caught up with the game',
    tag: 'data',
    body: 'Three new shovel enchants — Crystal Touch, Overdrive and Tempered — which shifts the odds on every other shovel enchant, Mastered most of all. Five craftables were buffed: the Lapis Armband, Moon Ring, Gravity Coil, Guiding Light and Dragon Claw. Plus a new community build for selling.',
    href: '/enchanting',
  },
  {
    id: '2026-10-05-rarity-filter',
    date: '2026-10-05',
    title: 'Filter the equipment picker by rarity',
    tag: 'improved',
    body: 'Twenty-five rings in one alphabetical column is a list you read rather than one you choose from. The picker now has a rarity chip for each band with its count, and lists the best first.',
    href: '/planner',
  },
  {
    id: '2026-10-05-rich-mutation-modifier',
    date: '2026-10-05',
    title: 'Mutations and museum modifiers say what they do',
    tag: 'improved',
    body: 'Both were plain dropdowns offering a bare name. They now open the same rich chooser as everything else: a mutation shows its multiplier and the extra stats it carries, a museum modifier shows exactly what its rider adds on that rarity row.',
    href: '/planner',
  },
  {
    id: '2026-10-05-mutation-bonuses',
    date: '2026-10-05',
    title: 'Mutation extras now count',
    tag: 'fixed',
    body: 'Festive, Granite and Overclocked carry stats beyond their multiplier — Festive adds +50 Luck and +10% Size Boost on top of its 1.4x. Only the multiplier was being applied, so those three were worth less on the planner than in the game.',
    href: '/planner',
  },
  {
    id: '2026-10-04-underweight-value',
    date: '2026-10-04',
    title: 'An underweight museum display gets a number',
    tag: 'new',
    body: 'A light ore used to just say “under weight”. It now gets a figure — scaled down in proportion to how short it is, so a 6kg Diamond of the 20kg it wants reads +0.09x instead of its full +0.3x. That is our estimate, not the wiki’s: it only publishes the maximum and the weight that earns it. Hover the display in game and the tooltip gives the real number, which you can type in to replace the guess.',
    href: '/planner',
  },
  {
    id: '2026-10-04-museum-tile-stats',
    date: '2026-10-04',
    title: 'A museum display says which stat it moves',
    tag: 'fixed',
    body: 'A filled display showed a bare number — Voidstone +0.4×, with no clue what of. Every display now names the stats it moves, grouped by value so an ore that lifts four of them by the same amount reads as one line, and debuffs show in red.',
    href: '/planner',
  },
  {
    id: '2026-10-04-museum-weight',
    date: '2026-10-04',
    title: 'Set the weight of what is on each museum display',
    tag: 'new',
    body: 'The planner assumed every display was heavy enough to pay its full boost. You can now enter what your ore actually weighs, and it flags the ones under the bar. A light ore still pays its modifier rider in full, which the wiki is explicit about, so only its own half is affected.',
    href: '/planner',
  },
  {
    id: '2026-10-04-museum-riders',
    date: '2026-10-04',
    title: 'Museum modifiers say what they give',
    tag: 'improved',
    body: 'Choosing a modifier for a display meant picking a name and hoping. Each one now shows the stats it lands on and exactly what it adds at that rarity row, with the full scale from Common to Exotic alongside.',
    href: '/planner',
  },
  {
    id: '2026-10-04-planner-pickers',
    date: '2026-10-04',
    title: 'Pick gear by what it is worth, not by its name',
    tag: 'improved',
    body: 'The planner’s plain dropdowns are now proper pickers: every pan, shovel and enchant shows its art, its price and the stat lines it will actually put on your panel, and you can search them by effect. Empty equipment slots are tiles with a plus in them, so the shape of a build is visible before you have finished it.',
    href: '/planner',
  },
  {
    id: '2026-10-04-museum-shelf',
    date: '2026-10-04',
    title: 'The museum reads as a shelf again',
    tag: 'fixed',
    body: 'In the build planner the three displays of a rarity were laid out two across, which wrapped and stranded the third on a row of its own. They are three across now, and a display that does nothing for the stat you are ranking by says what it does do instead of showing a dash.',
    href: '/planner',
  },
  {
    id: '2026-10-04-planner',
    date: '2026-10-04',
    title: 'One page for your whole build',
    tag: 'new',
    body: 'Pick your pan, shovel, enchants, equipment and museum, tick the buffs you have running, and get the stat panel the game would show you — except every number opens up to say where it came from. The wiki publishes the formula the game actually uses, and our numbers reproduce its measured examples exactly.',
    href: '/planner',
  },
  {
    id: '2026-10-04-mutations-applied',
    date: '2026-10-04',
    title: 'Mutations and museum modifiers now count',
    tag: 'new',
    body: 'A Prismatic piece is 1.6× its listed stats and a displayed ore’s modifier adds a rider on top of its own boost — both were listed as reference and neither fed any total. In the build planner they do, per item and per display.',
    href: '/planner',
  },
  {
    id: '2026-10-04-stat-search',
    date: '2026-10-04',
    title: 'Searching a stat explains the stat',
    tag: 'improved',
    body: 'Typing “shake speed” or “modifier boost” used to turn up whichever ore happened to mention it. All sixteen panel stats are now results of their own, and they open on what the stat does and how it is worked out.',
    href: '/planner?stat=Modifier%20Boost',
  },
  {
    id: '2026-09-30-museum-multi',
    date: '2026-09-30',
    title: 'Plan a museum for more than one stat',
    tag: 'new',
    body: 'Pick several stats and drag a slider for how much each one matters. Every stat is scored against the best its rarity could manage, so an even split really is even — and each shows what it got against what it could have reached alone.',
    href: '/museum?stat=Luck,Size Boost&w=50,50',
  },
  {
    id: '2026-09-30-npc-search',
    date: '2026-09-30',
    title: 'Searching a character actually finds them',
    tag: 'fixed',
    body: 'It filtered the quest list by their name, so the 68 characters who give no quests came back empty. It now opens the directory on their card, which works for all 120.',
    href: '/quests',
  },
  {
    id: '2026-09-30-search-tabs',
    date: '2026-09-30',
    title: 'Search results take you to the thing itself',
    tag: 'fixed',
    body: 'Searching a rune, relic, potion, code, enchant or modifier dropped you on a page and left you to find it. Results now open the right tab, expand the right card, and ring the item you asked for.',
  },
  {
    id: '2026-09-30-event-timer',
    date: '2026-09-30',
    title: 'A countdown to the next event roll',
    tag: 'new',
    body: 'Events roll every 30 minutes on the clock, the same in every server, so there is now a live timer for it. Admin Abuse is a different thing and nobody can predict it — the page says so rather than pretending.',
    href: '/progression?tab=events',
  },
  {
    id: '2026-09-30-per-item-quality',
    date: '2026-09-30',
    title: 'Roll quality is per item, not one figure for everything',
    tag: 'fixed',
    body: 'One slider set the quality of your whole loadout, which is not how rolls work — each piece rolled separately, and two of the same ring can be 95% and 55%. Every piece now has its own, with a shortcut to set them all.',
    href: '/equipment',
  },
  {
    id: '2026-09-30-stack-rings',
    date: '2026-09-30',
    title: 'You can equip the same ring more than once',
    tag: 'fixed',
    body: 'Eight ring slots means eight of the same ring is a normal build, but clicking an equipped ring took one off instead of adding another. Rings now have a counter.',
    href: '/equipment',
  },
  {
    id: '2026-09-30-seo',
    date: '2026-09-30',
    title: 'Every page is now a real page',
    tag: 'improved',
    body: 'The site used to be one blank shell that filled itself in with JavaScript, so search engines saw nothing. All 194 pages are now built as actual HTML, each with its own title and description, plus a sitemap.',
  },
  {
    id: '2026-09-30-home-hub',
    date: '2026-09-30',
    title: 'A front page you can launch from',
    tag: 'improved',
    body: 'Twenty-four tiles covering everything the game has, using the wiki’s own icon set tinted to our palette, grouped by what you came to find out.',
    href: '/',
  },
  {
    id: '2026-09-30-mutations',
    date: '2026-09-30',
    title: 'Equipment mutations',
    tag: 'new',
    body: 'All seven, from Silver at 1.1× to Prismatic at 1.6×, with the extras some of them add on top. On the Equipment page, since that is what they apply to.',
    href: '/equipment#mutations',
  },
  {
    id: '2026-09-30-events-tab',
    date: '2026-09-30',
    title: 'Luck events have a page of their own',
    tag: 'new',
    body: 'The fifteen events the luck model already used were only visible inside the Luck panel. They now have a tab, split by whether they stack additively or multiplicatively.',
    href: '/progression?tab=events',
  },
  {
    id: '2026-09-30-everything-else',
    date: '2026-09-30',
    title: 'Codes, enchanting, excavations, relics, progression and more',
    tag: 'new',
    body: 'Seven new sections covering the systems the site had nothing on: redeemable codes, altar enchant odds, excavation permits and timers, relics, levels and mastery, potions and trinkets, and what a modifier does to a sell price.',
    href: '/codes',
  },
  {
    id: '2026-09-30-modifier-values',
    date: '2026-09-30',
    title: 'Prices now account for modifiers',
    tag: 'fixed',
    body: 'Every value on the site was the unmodified price with no hint that a Perfect roll is worth 24 times it. Mineral pages now show what the top modifiers would make a kilo worth.',
    href: '/modifiers',
  },
  {
    id: '2026-09-30-nav-groups',
    date: '2026-09-30',
    title: 'Navigation grouped into four menus',
    tag: 'improved',
    body: 'Fifteen sections do not fit in a flat bar, so they are grouped by what you came to find out rather than by which wiki page the data came from.',
  },
  {
    id: '2026-09-30-discontinued-gear',
    date: '2026-09-30',
    title: 'Removed gear is marked as removed',
    tag: 'fixed',
    body: 'The Galactic Pan and Shovel were listed like anything else you could go and buy. Only the individual wiki pages record that, so the site never knew.',
    href: '/gear/pans',
  },
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
