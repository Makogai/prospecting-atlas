import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { museum, bestMuseumPicks, boostFor, boostLabel, SITE_URL } from '../data.js';
import { renderMuseum } from '../render.js';

export const data = new SlashCommandBuilder()
  .setName('museum')
  .setDescription('Best ore for every museum display, for one stat')
  .addStringOption((o) =>
    o.setName('stat')
      .setDescription('What you are building for')
      .setRequired(true)
      .setAutocomplete(true));

export async function autocomplete(interaction) {
  const q = interaction.options.getFocused().toLowerCase();
  await interaction.respond(
    museum.stats
      .filter((s) => s.toLowerCase().includes(q))
      .slice(0, 25)
      .map((s) => ({ name: s, value: s })),
  );
}

export async function execute(interaction) {
  const arg = interaction.options.getString('stat');
  const stat =
    museum.stats.find((s) => s.toLowerCase() === arg.toLowerCase()) ??
    museum.stats.find((s) => s.toLowerCase().includes(arg.toLowerCase()));

  if (!stat) {
    return interaction.reply({
      content: `No museum stat matches **${arg}**. Try one of: ${museum.stats.join(', ')}.`,
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  const groups = bestMuseumPicks(stat);
  const png = await renderMuseum(stat, groups);
  const file = new AttachmentBuilder(png, { name: `museum-${stat.toLowerCase().replace(/\s+/g, '-')}.png` });

  const total = groups.reduce(
    (t, g) => t + g.picks.reduce((n, o) => n + boostFor(o, stat), 0),
    0,
  );
  const reachable = groups.reduce((n, g) => n + g.picks.length, 0);

  const embed = new EmbedBuilder()
    .setColor(0x3ee0d0)
    .setTitle(`Best museum setup for ${stat}`)
    .setURL(`${SITE_URL}/museum?stat=${encodeURIComponent(stat)}`)
    .setDescription(
      `**${boostLabel(total)} ${stat}** at most.` +
        (reachable < museum.slots
          ? ` Only ${reachable} of the ${museum.slots} displays can boost ${stat} at all — a display only accepts its own rarity.`
          : ''),
    )
    .setImage(`attachment://${file.name}`);

  return interaction.editReply({ embeds: [embed], files: [file] });
}
