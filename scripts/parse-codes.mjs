/**
 * Redeemable codes.
 *
 * Two tabs, Active and Expired, each a grid of code against reward column.
 * A cell is either flat (`$10,000`, `200`) or a timed boost written as a
 * duration and a multiplier glued together with a non-breaking space
 * (`30m&nbsp;2×`), which is worth splitting apart — "2× Luck for 30 minutes"
 * is the useful sentence, and the raw cell isn't it.
 */
import { plain, num } from './parse-util.mjs';
import { tables, tabs, isBlank } from './parse-table.mjs';

const DURATION = /^(\d+\s*(?:m|min|mins|h|hr|hrs|d)\b)\s*(.*)$/i;

function reward(column, cell) {
  const text = plain(cell).replace(/ /g, ' ').trim();
  if (isBlank(text)) return null;

  const timed = text.match(DURATION);
  const value = timed ? timed[2].trim() : text;
  return {
    name: column,
    /** What you get: `2×`, `$10,000`, `200`. */
    value,
    /** How long it lasts, for the boosts; null for the flat payouts. */
    duration: timed ? timed[1].replace(/\s+/g, '') : null,
    // From the value, not the whole cell — otherwise "30m 2×" reads as 30.
    amount: num(value),
  };
}

export function parseCodes(wikitext) {
  if (!wikitext) return [];

  const out = [];
  const seen = new Set();

  for (const [label, body] of tabs(wikitext)) {
    const active = /active/i.test(label);
    const table = tables(body)[0];
    if (!table) continue;

    for (const row of table.rows) {
      const code = plain(row[0]).trim();
      // The code cell is wrapped in <code>; plain() strips the tag but a row
      // that's only styling leaves nothing behind.
      if (!code || /^[^a-z0-9]+$/i.test(code)) continue;

      const rewards = table.headers
        .slice(1)
        .map((column, i) => reward(column, row[i + 1]))
        .filter(Boolean);

      // The same code can appear in both tabs if the wiki is mid-edit; the
      // first listing wins, and Active is read first.
      const key = code.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({ code, active, rewards });
    }
  }

  return out;
}
