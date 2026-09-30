import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { codes, activeCodes, db, SITE_URL } from '../data.js';

export const data = new SlashCommandBuilder()
  .setName('codes')
  .setDescription('Redeemable codes that currently work')
  .addBooleanOption((o) =>
    o.setName('expired')
      .setDescription('Show the dead ones too'));

/** "$10,000 Money · 200 Meteor Shards · 2x Luck for 1h" */
const rewardLine = (entry) =>
  entry.rewards
    .map((r) => `${r.value} ${r.name}${r.duration ? ` for ${r.duration}` : ''}`)
    .join(' · ') || 'nothing listed';

export async function execute(interaction) {
  const showExpired = interaction.options.getBoolean('expired') ?? false;
  const active = activeCodes();

  const embed = new EmbedBuilder()
    .setColor(0xffc247)
    .setTitle(`${active.length} working code${active.length === 1 ? '' : 's'}`)
    .setURL(`${SITE_URL}/codes`)
    .setFooter({
      // Codes die without warning, so the date this was scraped is the honest
      // shelf life of the answer rather than a detail.
      text: `Wiki data from ${new Date(db.meta.fetchedAt).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      })} · codes expire without notice`,
    });

  if (active.length === 0) {
    embed.setDescription('No codes are active right now.');
  } else {
    // Backticks so the code is one tap to copy on mobile.
    embed.setDescription(
      active.map((c) => `\`${c.code}\`\n${rewardLine(c)}`).join('\n\n').slice(0, 4000),
    );
  }

  if (showExpired) {
    const dead = codes.filter((c) => !c.active);
    if (dead.length) {
      embed.addFields({
        name: `Expired (${dead.length})`,
        value: dead.map((c) => `~~${c.code}~~`).join(', ').slice(0, 1020),
      });
    }
  }

  return interaction.reply({ embeds: [embed] });
}
