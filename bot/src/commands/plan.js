import {
  SlashCommandBuilder, EmbedBuilder, AttachmentBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';

import {
  minerals, digSites, rank, money, percent, combinedChance, SITE_URL,
} from '../data.js';
import { renderPlan } from '../render.js';

const MAX_TARGETS = 6;

export const data = new SlashCommandBuilder()
  .setName('plan')
  .setDescription('Find the one dig site that covers most of your wanted list')
  .addStringOption((o) =>
    o.setName('minerals')
      .setDescription('Comma-separated, e.g. "pink diamond, rose gold, diamond"')
      .setRequired(true));

/** Ranks every dig site by how much of the wanted list it covers. */
export function planFor(picks) {
  return digSites
    .map((site) => {
      const hits = picks
        .map((m) => {
          const c = site.minerals.find((sm) => sm.id === m.id);
          return c ? { mineral: m, chance: c } : null;
        })
        .filter(Boolean);

      return {
        site,
        hits,
        combined: combinedChance(hits.map((h) => h.chance.percent)),
        targetValue: hits.reduce(
          (t, h) => t + ((h.chance.percent ?? 0) / 100) * (h.mineral.value ?? 0),
          0,
        ),
        coverage: picks.length ? hits.length / picks.length : 0,
      };
    })
    .filter((r) => r.hits.length > 0)
    .sort(
      (a, b) =>
        b.coverage - a.coverage || b.targetValue - a.targetValue || b.combined - a.combined,
    );
}

export async function execute(interaction) {
  const raw = interaction.options.getString('minerals');
  const terms = raw.split(',').map((t) => t.trim()).filter(Boolean).slice(0, MAX_TARGETS);

  const picks = [];
  const missed = [];
  for (const term of terms) {
    const hit = rank(term, minerals)[0];
    if (!hit) missed.push(term);
    else if (!picks.some((p) => p.id === hit.id)) picks.push(hit);
  }

  if (!picks.length) {
    return interaction.reply({
      content: `Couldn't match any of those. Try \`/plan pink diamond, diamond\`.`,
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  const ranked = planFor(picks);
  const png = await renderPlan(picks, ranked);
  const file = new AttachmentBuilder(png, { name: 'plan.png' });

  const embed = new EmbedBuilder()
    .setColor(0xffc247)
    .setImage('attachment://plan.png');

  const top = ranked[0];
  if (top) {
    const missing = picks.filter((p) => !top.hits.some((h) => h.mineral.id === p.id));
    embed.addFields({
      name: 'Best single site',
      value:
        `**${top.site.name}** — covers ${top.hits.length}/${picks.length}\n` +
        `${percent(top.combined)} chance of any target per pull · ` +
        `${money(top.targetValue)} of wanted minerals per pull` +
        (missing.length ? `\nMissing here: ${missing.map((m) => m.name).join(', ')}` : ''),
    });
  } else {
    embed.addFields({ name: 'No overlap', value: 'No dig site drops any of those.' });
  }

  const notes = [];
  if (missed.length) notes.push(`Couldn't match: ${missed.join(', ')}`);
  if (terms.length < raw.split(',').filter((t) => t.trim()).length) {
    notes.push(`Only the first ${MAX_TARGETS} targets are used.`);
  }
  if (notes.length) embed.setFooter({ text: notes.join(' · ') });

  const components = SITE_URL.startsWith('http')
    ? [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Open the planner')
          .setStyle(ButtonStyle.Link)
          .setURL(`${SITE_URL}/compare`),
      )]
    : [];

  return interaction.editReply({ embeds: [embed], files: [file], components });
}
