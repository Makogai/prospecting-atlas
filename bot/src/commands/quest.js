import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { quests, npcs, npcByName, questsOf, rank, SITE_URL } from '../data.js';

export const data = new SlashCommandBuilder()
  .setName('quest')
  .setDescription('A quest and its steps, or everything an NPC gives you')
  .addStringOption((o) =>
    o.setName('name')
      .setDescription('Quest name, or an NPC')
      .setRequired(true)
      .setAutocomplete(true));

export async function autocomplete(interaction) {
  const q = interaction.options.getFocused();
  // Both kinds in one list: people ask "what does the Trader want" as often as
  // they ask about a quest by name.
  const options = [
    ...rank(q, quests).slice(0, 18).map((x) => ({
      name: `${x.name} — ${x.location}`.slice(0, 100),
      value: `q:${x.id}`,
    })),
    ...rank(q, npcs).slice(0, 7).map((n) => ({
      name: `${n.name} — NPC`.slice(0, 100),
      value: `n:${n.id}`,
    })),
  ];
  await interaction.respond(options.slice(0, 25));
}

function questEmbed(quest) {
  const embed = new EmbedBuilder()
    .setColor(quest.buff ? 0x3ee0d0 : 0xffc247)
    .setTitle(quest.name)
    .setURL(`${SITE_URL}/quests?q=${encodeURIComponent(quest.name)}`)
    .setDescription(quest.summary ?? `A quest at ${quest.location}.`);

  const where = [quest.location, quest.npc ? `from ${quest.npc}` : null]
    .filter(Boolean)
    .join(' · ');
  embed.addFields({ name: 'Where', value: where || 'Unknown', inline: false });

  if (quest.steps.length) {
    embed.addFields({
      name: 'Steps',
      value: quest.steps
        .map((s, i) => `${i + 1}. ${s.text}${s.note ? `\n   *${s.note}*` : ''}`)
        .join('\n')
        .slice(0, 1020),
    });
  }
  if (quest.rewards) {
    embed.addFields({ name: 'Rewards', value: quest.rewards.slice(0, 1020) });
  }
  // A permanent buff is the reason some quests are worth doing at all.
  if (quest.buff) {
    embed.addFields({ name: 'Permanent buff', value: quest.buff.slice(0, 1020) });
  }
  return embed;
}

function npcEmbed(npc) {
  const given = questsOf(npc);
  const where = npc.places.length
    ? npc.places.map((p) => (p.note ? `${p.name} — ${p.note}` : p.name)).join('\n')
    : npc.regions.join(', ') || 'Not recorded';

  const embed = new EmbedBuilder()
    .setColor(0xffc247)
    .setTitle(npc.name)
    .setURL(`${SITE_URL}/quests?npc=${encodeURIComponent(npc.name)}`)
    .setDescription(npc.summary ?? 'An NPC in Prospecting.')
    .addFields({ name: 'Where to find them', value: where.slice(0, 1020) });

  if (given.length) {
    embed.addFields({
      name: `Quests (${given.length})`,
      value: given
        .map((q) => `**${q.name}**${q.buff ? ' · permanent buff' : ''}`)
        .join('\n')
        .slice(0, 1020),
    });
  }
  return embed;
}

export async function execute(interaction) {
  const arg = interaction.options.getString('name');

  // Autocomplete sends a kind-prefixed id; a typed argument needs ranking.
  if (arg.startsWith('q:')) {
    const quest = quests.find((x) => x.id === arg.slice(2));
    if (quest) return interaction.reply({ embeds: [questEmbed(quest)] });
  }
  if (arg.startsWith('n:')) {
    const npc = npcs.find((x) => x.id === arg.slice(2));
    if (npc) return interaction.reply({ embeds: [npcEmbed(npc)] });
  }

  const npcHit = npcByName.get(arg.toLowerCase());
  if (npcHit) return interaction.reply({ embeds: [npcEmbed(npcHit)] });

  const quest = rank(arg, quests)[0];
  if (quest) return interaction.reply({ embeds: [questEmbed(quest)] });

  const npc = rank(arg, npcs)[0];
  if (npc) return interaction.reply({ embeds: [npcEmbed(npc)] });

  return interaction.reply({
    content: `Nothing matches **${arg}**. Try \`/quest special order\` or an NPC name.`,
    ephemeral: true,
  });
}
