/**
 * Registers the slash commands with Discord. Run this after changing any
 * command definition — the bot process itself never registers anything.
 *
 *   node src/deploy-commands.js           # global: every server, up to an hour to appear
 *   node src/deploy-commands.js --here    # every server the bot is already in, instantly
 *   node src/deploy-commands.js --guild   # just DISCORD_GUILD_ID, instantly
 *
 * Only DISCORD_TOKEN is required. The application id is read back from the
 * token, so DISCORD_CLIENT_ID is optional.
 */
import 'dotenv/config';
import { REST, Routes } from 'discord.js';

import { commands } from './registry.js';

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;

if (!DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN is not set. Put it in bot/.env.');
  process.exit(1);
}

const rest = new REST().setToken(DISCORD_TOKEN);
const body = [...commands.values()].map((c) => c.data.toJSON());

/** The app id, from the env if given, otherwise from whoever the token belongs to. */
async function applicationId() {
  if (DISCORD_CLIENT_ID) return DISCORD_CLIENT_ID;
  const app = await rest.get(Routes.oauth2CurrentApplication());
  console.log(`Application: ${app.name} (${app.id})`);
  return app.id;
}

async function main() {
  const appId = await applicationId();

  let targets;
  if (process.argv.includes('--here')) {
    // Guilds the bot has already been invited to. Guild commands appear at once,
    // which is what you want while testing.
    const guilds = await rest.get(Routes.userGuilds());
    if (!guilds.length) {
      console.error(
        'The bot is not in any server yet. Open the invite URL first (see bot/README.md), ' +
        'or register globally with no flag.',
      );
      process.exitCode = 1;
      return;
    }
    targets = guilds.map((g) => ({ id: g.id, label: g.name }));
  } else if (process.argv.includes('--guild')) {
    if (!DISCORD_GUILD_ID) {
      console.error('--guild needs DISCORD_GUILD_ID set. Or use --here to hit every server.');
      process.exitCode = 1;
      return;
    }
    targets = [{ id: DISCORD_GUILD_ID, label: DISCORD_GUILD_ID }];
  } else {
    targets = [null];
  }

  for (const target of targets) {
    const route = target
      ? Routes.applicationGuildCommands(appId, target.id)
      : Routes.applicationCommands(appId);
    const data = await rest.put(route, { body });
    console.log(
      `Registered ${data.length} commands ${target ? `to ${target.label}` : 'globally'}: ` +
      data.map((c) => `/${c.name}`).join(' '),
    );
  }

  if (targets[0] === null) {
    console.log('Global commands can take up to an hour to show up. Use --here while testing.');
  }
}

main().catch((err) => {
  // Never print the error body verbatim: a 401 response can echo the token back.
  const status = err?.status ?? err?.code ?? '';
  if (status === 401) {
    console.error('Discord rejected the token (401). Check DISCORD_TOKEN in bot/.env.');
  } else {
    console.error(`Registration failed${status ? ` (${status})` : ''}: ${err?.message ?? err}`);
  }
  process.exitCode = 1;
});
