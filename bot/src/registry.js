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

export const commands = new Collection(
  [find, site, plan, gear, top].map((c) => [c.data.name, c]),
);
