import 'dotenv/config';
import { Client, Events, GatewayIntentBits, MessageFlags } from 'discord.js';

import { commands } from './registry.js';

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('DISCORD_TOKEN is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

// No message content, no member list: slash commands and autocomplete only, so
// the bot needs no privileged intents.
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (c) => {
  console.log(`Ready as ${c.user.tag} — ${commands.size} commands, ${c.guilds.cache.size} guilds`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    if (interaction.isAutocomplete()) {
      await command.autocomplete?.(interaction);
      return;
    }
    if (interaction.isChatInputCommand()) {
      await command.execute(interaction);
    }
  } catch (err) {
    console.error(`/${interaction.commandName} failed:`, err);
    if (interaction.isAutocomplete()) return;

    const message = {
      content: 'Something broke rendering that. Try again in a moment.',
      flags: MessageFlags.Ephemeral,
    };
    // A deferred interaction has to be edited; a fresh one has to be replied to.
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(message).catch(() => {});
    } else {
      await interaction.reply(message).catch(() => {});
    }
  }
});

client.login(token);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`${signal} — shutting down`);
    client.destroy();
    process.exit(0);
  });
}
