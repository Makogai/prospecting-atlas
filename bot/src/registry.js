/**
 * The command registry, kept separate from index.js so that the registration
 * script can import it without index.js's side effect of logging the bot in.
 */
import { Collection } from 'discord.js';

import * as find from './commands/find.js';
import * as site from './commands/site.js';
import * as plan from './commands/plan.js';
import * as gear from './commands/gear.js';
import * as top from './commands/top.js';
import * as codes from './commands/codes.js';
import * as museum from './commands/museum.js';
import * as enchant from './commands/enchant.js';
import * as quest from './commands/quest.js';
import * as relic from './commands/relic.js';
import * as eventsCmd from './commands/events.js';

export const commands = new Collection(
  [find, site, plan, gear, top, codes, museum, enchant, quest, relic, eventsCmd].map(
    (c) => [c.data.name, c],
  ),
);
