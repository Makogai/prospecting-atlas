import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { enchantsFor, enchantOres, percent, SITE_URL } from '../data.js';

export const data = new SlashCommandBuilder()
  .setName('enchant')
  .setDescription('Altar enchant odds for a pan or shovel')
  .addStringOption((o) =>
    o.setName('slot')
      .setDescription('Which tool')
      .setRequired(true)
      .addChoices({ name: 'Pan', value: 'Pan' }, { name: 'Shovel', value: 'Shovel' }))
  .addStringOption((o) =>
    o.setName('ore')
      .setDescription('Which ore you feed the altar — pans only')
      .setAutocomplete(true));

export async function autocomplete(interaction) {
  const q = interaction.options.getFocused().toLowerCase();
  // The slot may not be filled in yet, so offer every ore either tool accepts.
  const ores = [...new Set([...enchantOres('Pan'), ...enchantOres('Shovel')])];
  await interaction.respond(
    ores.filter((o) => o.toLowerCase().includes(q)).slice(0, 25).map((o) => ({ name: o, value: o })),
  );
}

export async function execute(interaction) {
  const slot = interaction.options.getString('slot');
  const ores = enchantOres(slot);
  const asked = interaction.options.getString('ore');
  const via = asked ? (ores.find((o) => o.toLowerCase() === asked.toLowerCase()) ?? ores[0] ?? null) : (ores[0] ?? null);

  const ranked = enchantsFor(slot, via);
  const reachable = ranked.filter((r) => r.percent > 0);
  const blocked = ranked.filter((r) => r.percent === 0);

  const embed = new EmbedBuilder()
    .setColor(0x3ee0d0)
    .setTitle(`${slot} enchants${via ? ` — rolling with ${via}` : ''}`)
    .setURL(`${SITE_URL}/enchanting`)
    .setDescription(
      reachable.length
        ? reachable
            .map(
              ({ enchant, percent: p }) =>
                `**${enchant.name}** · ${percent(p)} (~1 in ${Math.round(100 / p)})\n` +
                `${enchant.effect}${enchant.locked ? ` — *${enchant.locked}*` : ''}`,
            )
            .join('\n\n')
            .slice(0, 4000)
        : `Nothing can be rolled on a ${slot.toLowerCase()} with ${via}.`,
    );

  if (blocked.length) {
    embed.addFields({
      name: `Not from ${via ?? 'this'} — try another ore or an enchant book`,
      value: blocked.map((b) => b.enchant.name).join(', ').slice(0, 1020),
    });
  }

  if (ores.length > 1) {
    embed.setFooter({ text: `Odds depend on the ore: ${ores.join(', ')}` });
  }

  return interaction.reply({ embeds: [embed] });
}
