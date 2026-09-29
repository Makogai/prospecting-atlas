import {
  SlashCommandBuilder, EmbedBuilder, AttachmentBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';

import {
  minerals, rank, money, odds, bestSiteFor, locationForSite,
  mineralUrl, siteUrl, SITE_URL,
  parseBoosts, effectiveLuck, siteBands, mineralChance, digSiteByName,
} from '../data.js';
import { renderFind, rarityInt } from '../render.js';

export const data = new SlashCommandBuilder()
  .setName('find')
  .setDescription('Where to find a mineral, ranked by drop rate')
  .addStringOption((o) =>
    o.setName('mineral')
      .setDescription('Mineral name')
      .setRequired(true)
      .setAutocomplete(true))
  .addIntegerOption((o) =>
    o.setName('luck')
      .setDescription('Your base Luck — pan, equipment, enchants. Default 1.')
      .setMinValue(1)
      .setMaxValue(10_000_000))
  .addStringOption((o) =>
    o.setName('boosts')
      .setDescription('Comma-separated, e.g. "totem, meteor shower, blizzard"'))
  .addIntegerOption((o) =>
    o.setName('friends')
      .setDescription('Friends in your server — +0.1x each, max 5')
      .setMinValue(0)
      .setMaxValue(5));

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

  const baseLuck = interaction.options.getInteger('luck') ?? 1;
  const friends = interaction.options.getInteger('friends') ?? 0;
  const { boosts, missed } = parseBoosts(interaction.options.getString('boosts'));

  await interaction.deferReply();

  // Luck is per dig site: several events only fire at particular ones.
  const luck = mineral.chances.map((c) => {
    const site = digSiteByName.get(c.site);
    const at = effectiveLuck(baseLuck, { boosts, friends, siteName: c.site });
    return {
      site: c.site,
      luck: at.luck,
      skipped: at.skipped,
      chance: site && c.percent != null
        ? mineralChance(siteBands(site), mineral.id, at.luck)
        : null,
    };
  });
  const boosted = luck.some((l) => l.luck > 1);

  const png = await renderFind(mineral, { luck: boosted ? luck : null });
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

  if (boosted) {
    const spread = [...new Set(luck.map((l) => Math.round(l.luck)))];
    const scoped = luck.filter((l) => l.skipped.length);
    embed.addFields({
      name: 'Your luck',
      value:
        `${baseLuck.toLocaleString('en-US')} base` +
        (boosts.length ? ` · ${boosts.map((b) => b.name).join(', ')}` : '') +
        (friends ? ` · ${friends} friend${friends === 1 ? '' : 's'}` : '') +
        `
**${spread.length > 1 ? `${Math.min(...spread).toLocaleString('en-US')}–${Math.max(...spread).toLocaleString('en-US')}` : spread[0].toLocaleString('en-US')}** effective` +
        (scoped.length
          ? `
Location-locked: ${[...new Set(scoped.flatMap((l) => l.skipped.map((b) => b.name)))].join(', ')} doesn't reach every site above.`
          : ''),
    });
  }

  const notes = [];
  if (!mineral.ratesKnown) notes.push('The wiki lists locations for this mineral but no drop rates.');
  if (missed.length) notes.push(`Unknown boost: ${missed.join(', ')}`);
  if (boosted) notes.push('Modelled odds — an optimistic upper bound. See the site for why.');
  if (notes.length) embed.setFooter({ text: notes.join(' · ') });

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
