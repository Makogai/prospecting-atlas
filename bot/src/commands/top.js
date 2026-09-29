import {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';

import {
  minerals, digSites, rarities, money, odds, bestSiteFor, SITE_URL,
} from '../data.js';

export const data = new SlashCommandBuilder()
  .setName('top')
  .setDescription('Leaderboards: most valuable minerals, richest dig sites, rarest drops')
  .addStringOption((o) =>
    o.setName('board')
      .setDescription('Which leaderboard')
      .setRequired(true)
      .addChoices(
        { name: 'Most valuable minerals', value: 'value' },
        { name: 'Richest dig sites', value: 'sites' },
        { name: 'Rarest drops', value: 'rarest' },
      ))
  .addStringOption((o) =>
    o.setName('rarity')
      .setDescription('Limit to one rarity (minerals only)')
      .addChoices(...rarities.map((r) => ({ name: r.name, value: r.name }))));

const medal = (i) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `\`${i + 1}.\``);

export async function execute(interaction) {
  const board = interaction.options.getString('board');
  const rarity = interaction.options.getString('rarity');

  const embed = new EmbedBuilder().setColor(0xffc247);
  let path = '/minerals';

  if (board === 'sites') {
    path = '/sites';
    embed
      .setTitle('Richest dig sites')
      .setDescription(
        [...digSites]
          .sort((a, b) => b.expectedValue - a.expectedValue)
          .slice(0, 10)
          .map((s, i) =>
            `${medal(i)} **${s.name}** — ${money(s.expectedValue)}/pull · ${s.mineralCount} minerals`)
          .join('\n'),
      )
      .setFooter({ text: 'Average value of one pull, weighting each mineral by its drop rate.' });
  } else if (board === 'rarest') {
    embed
      .setTitle('Rarest drops in the game')
      .setDescription(
        minerals
          .filter((m) => m.ratesKnown && (!rarity || m.rarity === rarity))
          .map((m) => ({ m, best: bestSiteFor(m) }))
          .filter((x) => x.best?.chance.oneIn != null)
          .sort((a, b) => b.best.chance.oneIn - a.best.chance.oneIn)
          .slice(0, 10)
          .map(({ m, best }, i) =>
            `${medal(i)} **${m.name}** — ${odds(best.chance.oneIn)} at ${best.site.name}`)
          .join('\n') || 'Nothing matches that filter.',
      )
      .setFooter({ text: 'Best odds available anywhere — these are the long grinds.' });
  } else {
    const pool = minerals.filter((m) => !rarity || m.rarity === rarity);
    embed
      .setTitle(rarity ? `Most valuable ${rarity} minerals` : 'Most valuable minerals')
      .setDescription(
        [...pool]
          .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
          .slice(0, 10)
          .map((m, i) => {
            const best = bestSiteFor(m);
            return `${medal(i)} **${m.name}** — ${money(m.value)}/kg` +
              (best ? ` · ${odds(best.chance.oneIn)} at ${best.site.name}` : '');
          })
          .join('\n') || 'Nothing matches that filter.',
      )
      .setFooter({ text: 'Sell price per kilogram, before modifiers.' });
  }

  const components = SITE_URL.startsWith('http')
    ? [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Open on Atlas')
          .setStyle(ButtonStyle.Link)
          .setURL(`${SITE_URL}${path}`),
      )]
    : [];

  return interaction.reply({ embeds: [embed], components });
}
