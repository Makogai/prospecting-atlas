import {
  SlashCommandBuilder, EmbedBuilder, AttachmentBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';

import {
  minerals, rank, money, odds, bestSiteFor, locationForSite,
  mineralUrl, siteUrl, SITE_URL,
} from '../data.js';
import { renderFind, rarityInt } from '../render.js';

export const data = new SlashCommandBuilder()
  .setName('find')
  .setDescription('Where to find a mineral, ranked by drop rate')
  .addStringOption((o) =>
    o.setName('mineral')
      .setDescription('Mineral name')
      .setRequired(true)
      .setAutocomplete(true));

export async function autocomplete(interaction) {
  const q = interaction.options.getFocused();
  await interaction.respond(
    rank(q, minerals).slice(0, 25).map((m) => ({
      name: `${m.name} — ${m.rarity} · ${money(m.value)}`.slice(0, 100),
      value: m.id,
    })),
  );
}

export async function execute(interaction) {
  const arg = interaction.options.getString('mineral');
  // Autocomplete sends an id; a typed argument needs ranking.
  const mineral = minerals.find((m) => m.id === arg) ?? rank(arg, minerals)[0];

  if (!mineral) {
    return interaction.reply({
      content: `No mineral matches **${arg}**. Try \`/find gold\`.`,
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  const png = await renderFind(mineral);
  const file = new AttachmentBuilder(png, { name: 'find.png' });

  const best = bestSiteFor(mineral);
  const loc = best ? locationForSite(best.site) : null;

  const embed = new EmbedBuilder()
    .setColor(rarityInt(mineral.rarity))
    .setImage('attachment://find.png');

  if (best) {
    embed.addFields({
      name: 'Go here',
      value:
        `**${best.site.name}**${loc ? ` · ${loc.name}` : ''}\n` +
        `${odds(best.chance.oneIn)} per pull · site averages ${money(best.site.expectedValue)}/pull`,
    });
  }

  if (!mineral.ratesKnown) {
    embed.setFooter({ text: 'The wiki lists locations for this mineral but no drop rates.' });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Open on Atlas')
      .setStyle(ButtonStyle.Link)
      .setURL(mineralUrl(mineral)),
  );
  if (best) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel(`${best.site.name} loot table`.slice(0, 80))
        .setStyle(ButtonStyle.Link)
        .setURL(siteUrl(best.site)),
    );
  }

  const components = SITE_URL.startsWith('http') ? [row] : [];
  return interaction.editReply({ embeds: [embed], files: [file], components });
}
