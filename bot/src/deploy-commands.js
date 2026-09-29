/**
 * Registers the slash commands with Discord. Run this after changing any
 * command definition — the bot process itself never registers anything.
 *
 *   node src/deploy-commands.js            # global (up to an hour to propagate)
 *   node src/deploy-commands.js --guild    # instant, into DISCORD_GUILD_ID
 */
import 'dotenv/config';
import { REST, Routes } from 'discord.js';

import { commands } from './registry.js';

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
  console.error('DISCORD_TOKEN and DISCORD_CLIENT_ID must both be set.');
  process.exit(1);
}

const guildOnly = process.argv.includes('--guild');
if (guildOnly && !DISCORD_GUILD_ID) {
  console.error('--guild needs DISCORD_GUILD_ID set.');
  process.exit(1);
}

const body = [...commands.values()].map((c) => c.data.toJSON());
const rest = new REST().setToken(DISCORD_TOKEN);

const route = guildOnly
  ? Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID)
  : Routes.applicationCommands(DISCORD_CLIENT_ID);

try {
  const data = await rest.put(route, { body });
  console.log(
    `Registered ${data.length} commands ${guildOnly ? `to guild ${DISCORD_GUILD_ID}` : 'globally'}: ` +
    data.map((c) => `/${c.name}`).join(' '),
  );
} catch (err) {
  console.error('Registration failed:', err);
  process.exit(1);
}
