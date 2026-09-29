import {
  SlashCommandBuilder, EmbedBuilder, AttachmentBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';

import {
  digSites, rank, money, rarities, locationForSite, siteUrl, SITE_URL,
} from '../data.js';
import { renderSite, colorsInt } from '../render.js';

export const data = new SlashCommandBuilder()
  .setName('site')
  .setDescription('Full loot table for a dig site')
  .addStringOption((o) =>
    o.setName('site')
      .setDescription('Dig site name')
      .setRequired(true)
      .setAutocomplete(true))
  .addIntegerOption((o) =>
    o.setName('show')
      .setDescription('How many minerals to list (default 10)')
      .setMinValue(3)
      .setMaxValue(20));

export async function autocomplete(interaction) {
  const q = interaction.options.getFocused();
  await interaction.respond(
    rank(q, digSites).slice(0, 25).map((s) => ({
      name: `${s.name} — ${s.mineralCount} minerals · ${money(s.expectedValue)}/pull`.slice(0, 100),
      value: s.id,
    })),
  );
}

export async function execute(interaction) {
  const arg = interaction.options.getString('site');
  const limit = interaction.options.getInteger('show') ?? 10;
  const site = digSites.find((s) => s.id === arg) ?? rank(arg, digSites)[0];

  if (!site) {
    return interaction.reply({
      content: `No dig site matches **${arg}**. Try \`/site rubble creek sands\`.`,
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  const png = await renderSite(site, { limit });
  const file = new AttachmentBuilder(png, { name: 'site.png' });

  const loc = locationForSite(site);
  const rotating = site.minerals.length > 0 && site.minerals.every((m) => m.conditional);

  const mix = rarities
    .map((r) => ({ r, n: site.minerals.filter((m) => m.rarity === r.name).length }))
    .filter((x) => x.n)
    .map((x) => `${x.n} ${x.r.name}`)
    .join(' · ');

  const embed = new EmbedBuilder()
    .setColor(colorsInt(site.colors))
    .setImage('attachment://site.png')
    .addFields({ name: 'Rarity mix', value: mix || 'none' });

  const jackpot = [...site.minerals].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
  if (jackpot) {
    embed.addFields({
      name: 'Jackpot',
      value: `**${jackpot.name}** — ${money(jackpot.value)}/kg`,
      inline: true,
    });
  }
  if (loc) embed.addFields({ name: 'Location', value: loc.name, inline: true });

  if (rotating) {
    embed.setFooter({
      text: 'This site\'s loot pool rotates — every entry is conditional on the current pool.',
    });
  }

  const components = SITE_URL.startsWith('http')
    ? [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Full table on Atlas')
          .setStyle(ButtonStyle.Link)
          .setURL(siteUrl(site)),
      )]
    : [];

  return interaction.editReply({ embeds: [embed], files: [file], components });
}
