import {
  SlashCommandBuilder, EmbedBuilder, AttachmentBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';

import { gearGroups, GEAR_STATS, rank, gearPrice, SITE_URL } from '../data.js';
import { renderGear } from '../render.js';

const KINDS = ['pans', 'shovels', 'sluices'];

export const data = new SlashCommandBuilder()
  .setName('gear')
  .setDescription('Pan, shovel and sluice stats — one item or up to three side by side')
  .addStringOption((o) =>
    o.setName('kind')
      .setDescription('Which kind of gear')
      .setRequired(true)
      .addChoices(
        { name: 'Pans', value: 'pans' },
        { name: 'Shovels', value: 'shovels' },
        { name: 'Sluices', value: 'sluices' },
      ))
  .addStringOption((o) =>
    o.setName('items')
      .setDescription('Comma-separated names, up to 3. Leave blank for the best of each stat.')
      .setAutocomplete(true));

export async function autocomplete(interaction) {
  const kind = interaction.options.getString('kind');
  const pool = gearGroups[KINDS.includes(kind) ? kind : 'pans'];
  const focused = interaction.options.getFocused();

  // The field holds a comma-separated list, so only complete the last entry.
  const parts = focused.split(',');
  const head = parts.slice(0, -1).join(',');
  const tail = parts.at(-1).trim();

  await interaction.respond(
    rank(tail, pool).slice(0, 25).map((g) => ({
      name: `${g.name} — ${gearPrice(g)}`.slice(0, 100),
      value: (head ? `${head}, ${g.name}` : g.name).slice(0, 100),
    })),
  );
}

export async function execute(interaction) {
  const kind = interaction.options.getString('kind');
  const itemsArg = interaction.options.getString('items');
  const pool = gearGroups[kind];
  const statKeys = GEAR_STATS[kind];

  let picks;
  if (itemsArg) {
    picks = [];
    for (const term of itemsArg.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 3)) {
      const hit = rank(term, pool)[0];
      if (hit && !picks.some((p) => p.id === hit.id)) picks.push(hit);
    }
  } else {
    // No names given: show whatever tops each stat, deduplicated.
    picks = [];
    for (const s of statKeys) {
      const best = [...pool].sort((a, b) => (b.stats[s] ?? 0) - (a.stats[s] ?? 0))[0];
      if (best && !picks.some((p) => p.id === best.id)) picks.push(best);
      if (picks.length === 3) break;
    }
  }

  if (!picks.length) {
    return interaction.reply({
      content: `No ${kind} matched. Try \`/gear kind:pans items:diamond, aurora\`.`,
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  // Scale bars against the whole category, so the same item reads the same
  // however many things it is compared with.
  const maxes = Object.fromEntries(
    statKeys.map((s) => [s, Math.max(...pool.map((g) => g.stats[s] ?? 0), 1)]),
  );

  const png = await renderGear(picks, kind, statKeys, maxes);
  const file = new AttachmentBuilder(png, { name: 'gear.png' });

  const embed = new EmbedBuilder()
    .setColor(0xffc247)
    .setImage('attachment://gear.png');

  for (const g of picks.slice(0, 3)) {
    const lines = [`${gearPrice(g)} · from ${g.source || 'unknown'}`];
    // Only the item's own wiki page records this, and without it the bot
    // recommends gear nobody can get any more.
    if (g.obtainable === false) lines.push(`⚠️ **${g.obtained ?? 'No longer obtainable'}**`);
    if (g.passive) lines.push(`*${g.passive}*`);
    if (g.description) lines.push(g.description);
    embed.addFields({ name: g.name, value: lines.join('\n').slice(0, 1024), inline: picks.length > 1 });
  }

  if (!itemsArg) embed.setFooter({ text: 'Showing the best of each stat — name items to compare your own.' });

  const components = SITE_URL.startsWith('http')
    ? [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel(`All ${kind} on Atlas`)
          .setStyle(ButtonStyle.Link)
          .setURL(`${SITE_URL}/gear/${kind}`),
      )]
    : [];

  return interaction.editReply({ embeds: [embed], files: [file], components });
}
