/**
 * Runs every command against a fake interaction and writes the rendered cards
 * to ./smoke/, so the whole reply path can be checked without a Discord token.
 *
 *   npm run smoke
 */
import { mkdirSync, writeFileSync } from 'node:fs';

import { commands } from './registry.js';

const OUT = 'smoke';
mkdirSync(OUT, { recursive: true });

let failures = 0;

/** Minimal stand-in for ChatInputCommandInteraction. */
function fakeInteraction(name, options, label) {
  const get = (key) => options[key] ?? null;
  const captured = { deferred: false, replied: false, payloads: [] };

  const record = (payload) => {
    captured.payloads.push(payload);
    for (const file of payload?.files ?? []) {
      const buf = file.attachment ?? file;
      if (Buffer.isBuffer(buf)) writeFileSync(`${OUT}/${label}.png`, buf);
    }
    return payload;
  };

  return {
    commandName: name,
    captured,
    options: {
      getString: get,
      getInteger: get,
      getFocused: () => options.__focused ?? '',
    },
    isAutocomplete: () => false,
    isChatInputCommand: () => true,
    async deferReply() { captured.deferred = true; },
    async reply(p) { captured.replied = true; return record(p); },
    async editReply(p) { return record(p); },
    async followUp(p) { return record(p); },
    async respond(choices) { captured.payloads.push({ choices }); },
  };
}

function autocompleteInteraction(name, options) {
  const i = fakeInteraction(name, options, `${name}-ac`);
  i.isAutocomplete = () => true;
  i.isChatInputCommand = () => false;
  return i;
}

const CASES = [
  ['find', { mineral: 'pink diamond' }, 'find-pink-diamond'],
  ['find', { mineral: 'aetherium' }, 'find-aetherium'],
  ['find', { mineral: 'emerald' }, 'find-emerald'],          // no drop rates on the wiki
  ['find', { mineral: 'zzzz-nope' }, 'find-miss'],           // no match -> ephemeral reply
  ['find', { mineral: 'frostshard', luck: 100, boosts: 'blizzard' }, 'find-luck-scoped'],
  ['find', { mineral: 'pink diamond', luck: 400, boosts: 'totem, meteor shower', friends: 5 }, 'find-luck-stacked'],
  ['find', { mineral: 'gold', luck: 1000 }, 'find-luck-common'],  // the damped regime
  ['site', { site: 'rubble creek sands' }, 'site-rubble'],
  ['site', { site: 'the void', show: 6 }, 'site-void'],      // fully conditional loot pool
  ['plan', { minerals: 'pink diamond, rose gold, diamond' }, 'plan-three'],
  ['plan', { minerals: 'gold' }, 'plan-one'],
  ['gear', { kind: 'pans', items: 'diamond, aurora, magnetic' }, 'gear-pans'],
  ['gear', { kind: 'sluices' }, 'gear-sluices-auto'],        // no names -> best of each stat
  ['gear', { kind: 'shovels', items: 'rusty' }, 'gear-one'],
  ['top', { board: 'value' }, 'top-value'],
  ['top', { board: 'sites' }, 'top-sites'],
  ['top', { board: 'rarest', rarity: 'Mythic' }, 'top-rarest-mythic'],
];

for (const [name, options, label] of CASES) {
  const command = commands.get(name);
  const i = fakeInteraction(name, options, label);
  try {
    await command.execute(i);
    const p = i.captured.payloads.at(-1);
    const img = p?.files?.length ? ` -> ${OUT}/${label}.png` : '';
    const kind = p?.embeds?.length ? 'embed' : 'text';
    console.log(`ok   /${name} ${JSON.stringify(options)} (${kind})${img}`);
  } catch (err) {
    failures++;
    console.error(`FAIL /${name} ${JSON.stringify(options)}: ${err.message}`);
    console.error(err.stack.split('\n').slice(1, 4).join('\n'));
  }
}

const AUTOCOMPLETE = [
  ['find', { __focused: 'pinkd' }],
  ['find', { __focused: '' }],
  ['site', { __focused: 'rubb' }],
  ['gear', { kind: 'pans', __focused: 'diamond, aur' }],
];

for (const [name, options] of AUTOCOMPLETE) {
  const command = commands.get(name);
  if (!command.autocomplete) continue;
  const i = autocompleteInteraction(name, options);
  try {
    await command.autocomplete(i);
    const { choices } = i.captured.payloads.at(-1);
    if (choices.length > 25) throw new Error(`returned ${choices.length} choices, Discord caps at 25`);
    for (const c of choices) {
      if (c.name.length > 100) throw new Error(`choice name over 100 chars: ${c.name}`);
      if (String(c.value).length > 100) throw new Error(`choice value over 100 chars: ${c.value}`);
    }
    console.log(`ok   /${name} autocomplete "${options.__focused}" -> ${choices.length}: ${choices[0]?.name ?? '(none)'}`);
  } catch (err) {
    failures++;
    console.error(`FAIL /${name} autocomplete: ${err.message}`);
  }
}

console.log(failures ? `\n${failures} failure(s)` : '\nall good');
process.exit(failures ? 1 : 0);
