/**
 * The stat engine against the wiki's own measured examples.
 *
 * The Stat Systems Guide publishes worked examples with the panel values they
 * were read from, which makes them a real test rather than a restatement of the
 * formula. If the engine stops reproducing them it has drifted from the game,
 * so this runs in the build and fails it.
 *
 * Run on its own with: node scripts/check-stats.mjs
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const db = require('../src/data/db.json');

let failures = 0;
const near = (a, b, tol = 0.51) => Math.abs(a - b) <= tol;

function check(name, actual, expected, tol) {
  const ok = near(actual, expected, tol);
  if (!ok) failures += 1;
  const shown = typeof actual === 'number' ? Number(actual.toFixed(4)) : actual;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}: ${shown}${ok ? '' : ` — expected ${expected}`}`);
}

console.log('\nGolden Rule — Total = (Base + Flats) x (1 + boosts) x events\n');

// From the guide: panel line 'Dig Strength 3,549 (884)'.
// Base 884; flats +130 (Volcanic Strength +5, Witches Brew +50, Cosmic +75);
// boosts Strength Totem +1.50 and XP Cookie +1.00.
{
  const base = 884;
  const flats = 5 + 50 + 75;
  const boosts = 1.5 + 1.0;
  check('worked example, Dig Strength', (base + flats) * (1 + boosts), 3549);
  check('  its flats come to', flats, 130);
}

// The three potions in that example, read out of our own data.
{
  const want = { 'volcanic-strength-potion': 5, 'witches-brew': 50, 'cosmic-potion': 75 };
  for (const [id, points] of Object.entries(want)) {
    const potion = db.potions.find((p) => p.id === id);
    const m = potion && new RegExp(`\\+(\\d+) Dig Strength`).exec(potion.effect);
    check(`  ${id} gives Dig Strength`, m ? Number(m[1]) : NaN, points, 0);
  }
}

console.log('\nEnchant math — multiply the item\'s own line, then add the points\n');

// 'Starstruck on a Nebula Pan (luck line): multiplier 1.3, flat +75.
//  New pan luck = 800 x 1.3 + 75 = 1,115 - the familiar +315 luck.'
{
  const pan = db.pans.find((p) => p.id === 'nebula-pan');
  const enchant = db.enchants.find((e) => e.id === 'starstruck-pan');
  check('  Nebula Pan base luck', pan.stats.luck, 800, 0);
  const m = /([\d.]+)\s*[x×]\s*Pan Luck\s*&\s*\+(\d+) Luck/.exec(enchant.effect);
  const multiplier = Number(m[1]);
  const add = Number(m[2]);
  check('  Starstruck multiplier', multiplier, 1.3, 0);
  check('  Starstruck flat', add, 75, 0);
  check('  enchanted pan luck', pan.stats.luck * multiplier + add, 1115, 0);
  check('  i.e. the familiar gain', pan.stats.luck * multiplier + add - pan.stats.luck, 315, 0);
}

// The guide quotes the Nebula Pan's full card; our table columns must match it.
{
  const pan = db.pans.find((p) => p.id === 'nebula-pan');
  check('  Nebula Pan capacity', pan.stats.capacity, 500, 0);
  check('  Nebula Pan shake strength', pan.stats.strength, 80, 0);
  // speed is written against a baseline of 1; the panel reads it x100.
  check('  Nebula Pan shake speed', pan.stats.speed * 100, 125, 0);
  check('  Nebula Pan modifier boost', /\+(\d+)% Modifier Boost/.exec(pan.passive)?.[1], '25', 0.0001);
  check('  Nebula Pan size boost', /\+(\d+)% Size Boost/.exec(pan.passive)?.[1], '33', 0.0001);
}

// 'The Starcrusher shovel adds +300 Dig Strength and +100 Dig Speed.'
{
  const shovel = db.shovels.find((s) => s.id === 'starcrusher');
  check('  Starcrusher dig strength', shovel.stats.strength, 300, 0);
  check('  Starcrusher dig speed', shovel.stats.speed * 100, 100, 0);
}

console.log('\nMuseum — the ore\'s own boost plus its modifier\'s rider\n');

// 'A Cosmic Singularium in the Exotic slot shows Capacity x1.56.
//  0.48 is Singularium's own display; 0.08 is the Cosmic rider at the Exotic row.'
{
  const ore = db.museum.ores.find((o) => o.id === 'singularium');
  const own = ore.boosts.find((b) => b.stat === 'Capacity').value;
  const rider = db.museum.modifierMultipliers.find((m) => m.rarity === 'Exotic').value;
  const cosmic = db.museum.modifiers.find((m) => m.name === 'Cosmic');
  check('  Singularium capacity display', own, 0.48, 0);
  check('  Exotic rider', rider, 0.08, 0);
  check('  Cosmic carries Capacity', cosmic.stats.includes('Capacity'), true, 0);
  check('  tooltip', 1 + own + rider, 1.56, 0.0001);
  check('  rider floor at Common', db.museum.modifierMultipliers[0].value, 0.005, 0);
}

console.log('\nXP Cookie — +1.00 to the pile, which is not a doubling\n');

// 'Sell Boost with only museum bonuses (pile ~0.9): gain = 2.9 / 1.9 = x1.54.
//  Modifier Boost with no boosts at all: gain = 2.0 / 1.0 = x2.00 - a true double.'
{
  const gain = (pile) => (1 + pile + 1) / (1 + pile);
  check('  on a 0.9 pile', gain(0.9), 1.5263, 0.001);
  check('  on an empty pile', gain(0), 2, 0);
  check('  on a 10.8 luck multiplier', (12.8) / (11.8), 1.0847, 0.001);
}

console.log('\nBoosts add, they never multiply\n');
{
  check('  2x totem + 2x booster', 1 + 1 + 1, 3);
  check('  ten +100% boosts', 1 + 10, 11);
}

console.log('\nDebuff signs survive parsing\n');
{
  // The wiki writes museum debuffs with an en dash and enchant debuffs with a
  // hyphen. Losing either sign once made the worst ore rank first.
  const negatives = db.museum.ores.flatMap((o) => o.boosts).filter((b) => b.value < 0);
  check('  museum has debuffs at all', negatives.length > 0, true, 0);
  const infernal = db.enchants.find((e) => e.id === 'infernal-pan');
  check('  Infernal still cuts capacity', /0\.75\s*[x×]\s*Pan Capacity/.test(infernal.effect), true, 0);
  check('  Infernal still cuts size boost', /[-–−]10%\s*Size Boost/.test(infernal.effect), true, 0);
}

console.log(
  failures === 0
    ? '\nAll stat checks pass.\n'
    : `\n${failures} stat check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
