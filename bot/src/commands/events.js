import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { events, eventSchedule, SITE_URL } from '../data.js';

export const data = new SlashCommandBuilder()
  .setName('events')
  .setDescription('When the next event roll is, and what can fire');

/**
 * Milliseconds until the next roll.
 *
 * Rolls land on fixed minutes past the hour and are the same in every server,
 * so this is real — but it counts down to the game *rolling*, not to an event.
 */
function msToNextRoll(now = new Date()) {
  const slots = eventSchedule.slots?.length ? eventSchedule.slots : [0, 30];
  const next = slots.find((s) => s > now.getMinutes());
  const target = new Date(now);
  target.setSeconds(0, 0);
  if (next == null) target.setHours(now.getHours() + 1, slots[0]);
  else target.setMinutes(next);
  return target.getTime() - now.getTime();
}

export async function execute(interaction) {
  const left = msToNextRoll();
  // A Discord relative timestamp beats a rendered countdown: it ticks on its
  // own and shows in each reader's own timezone.
  const at = Math.floor((Date.now() + left) / 1000);

  const regular = events.filter((e) => !e.admin);
  const admin = events.filter((e) => e.admin);
  const slots = (eventSchedule.slots ?? [0, 30])
    .map((n) => `:${String(n).padStart(2, '0')}`)
    .join(' and ');

  const embed = new EmbedBuilder()
    .setColor(0xffc247)
    .setTitle('Event rolls')
    .setURL(`${SITE_URL}/progression?tab=events`)
    .setDescription(
      `Next roll <t:${at}:R> (<t:${at}:t>).\n` +
        `The game rolls every ${eventSchedule.rollMinutes} minutes on the clock, at ${slots}` +
        `${eventSchedule.globalRoll ? ', the same in every server' : ''}.` +
        (eventSchedule.guaranteed
          ? ''
          : '\n**Each roll is a chance, not a guarantee** — it can pass with nothing.'),
    );

  const line = (e) =>
    `**${e.name}** ×${e.value ?? '?'}` +
    (e.durationMinutes ? ` · ${e.durationMinutes}m` : '') +
    (e.global ? ' · everywhere' : e.sites.length ? ` · ${e.sites.slice(0, 2).join(', ')}` : '') +
    (e.relic ? ` · or use ${e.relic}` : '');

  if (regular.length) {
    embed.addFields({
      name: 'On the timer',
      value: regular.map(line).join('\n').slice(0, 1020),
    });
  }

  // The honest answer to "when is AA": nobody outside the dev team knows.
  embed.addFields({
    name: 'Admin Abuse (AA) — no timer',
    value:
      `${eventSchedule.adminAbuse.what}\n` +
      `Watch ${eventSchedule.adminAbuse.announced} — nothing can count down to one.` +
      (admin.length ? `\nThey can turn on: ${admin.map((e) => e.name).join(', ')}.` : ''),
  });

  return interaction.reply({ embeds: [embed] });
}
