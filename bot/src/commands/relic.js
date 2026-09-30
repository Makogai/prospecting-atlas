import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { relics, rank, SITE_URL } from '../data.js';

export const data = new SlashCommandBuilder()
  .setName('relic')
  .setDescription('What a relic does and where it drops')
  .addStringOption((o) =>
    o.setName('name')
      .setDescription('Relic name')
      .setRequired(true)
      .setAutocomplete(true));

export async function autocomplete(interaction) {
  const q = interaction.options.getFocused();
  await interaction.respond(
    rank(q, relics).slice(0, 25).map((r) => ({
      name: `${r.name} — ${r.category}`.slice(0, 100),
      value: r.id,
    })),
  );
}

export async function execute(interaction) {
  const arg = interaction.options.getString('name');
  const relic = relics.find((r) => r.id === arg) ?? rank(arg, relics)[0];

  if (!relic) {
    return interaction.reply({
      content: `No relic matches **${arg}**. Try \`/relic meteor fragment\`.`,
      ephemeral: true,
    });
  }

  const embed = new EmbedBuilder()
    .setColor(0x3ee0d0)
    .setTitle(relic.name)
    .setURL(`${SITE_URL}/relics`)
    .setDescription(
      [relic.description, relic.effect].filter(Boolean).join('\n\n').slice(0, 2000) ||
        `A ${relic.category.toLowerCase()} relic.`,
    )
    .setFooter({ text: `${relic.category} relic` });

  if (relic.obtainment.length) {
    embed.addFields({
      name: 'Where it drops',
      // Indent the `**` sub-bullets, which qualify the line above them (a chest,
      // then which beaches it comes from).
      value: relic.obtainment
        .map((l) => (l.depth > 1 ? `  ↳ ${l.text}` : `• ${l.text}`))
        .join('\n')
        .slice(0, 1020),
    });
  }

  if (relic.usage.length) {
    embed.addFields({
      name: 'Using it',
      value: relic.usage.map((l) => `• ${l.text}`).join('\n').slice(0, 1020),
    });
  }

  return interaction.reply({ embeds: [embed] });
}
