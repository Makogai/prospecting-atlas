/**
 * Mineral modifiers — the multiplier on a mineral's sell value.
 *
 * This is the missing half of every price on the site: a base value is what an
 * unmodified mineral sells for, and a Perfect roll is worth 24 times it. Each
 * modifier is a `== Name ==` section of `* '''Field:''' value` lines.
 *
 * The Museum page lists the same modifiers for their museum bonus; the two are
 * reconciled in parse-wiki so a modifier is one record, not two.
 */
import { plain, refs, num, slug } from './parse-util.mjs';
import { section } from './parse-table.mjs';

/** `* '''Sell Price Multiplier:''' 24×` -> `24×` */
function field(body, name) {
  const re = new RegExp(`^\\s*\\*\\s*'''${name}:?'''\\s*(.*)$`, 'im');
  const m = body.match(re);
  return m ? m[1].trim() : null;
}

const blank = (v) => !v || /^(none|n\/?a|—|-)$/i.test(plain(v).trim());
const listed = (v) => (blank(v) ? [] : [...new Set(refs(v))].filter(Boolean));

/** `0.003736% (~1 in 26764)` -> { percent, oneIn } */
function chanceOf(raw) {
  if (!raw) return { percent: null, oneIn: null, note: null };
  const text = plain(raw);
  const pct = text.match(/([\d.]+)\s*%/);
  const one = text.match(/1\s*in\s*([\d,]+)/i);
  const percent = pct ? parseFloat(pct[1]) : null;
  // A bare "0.0037% (~1 in 26764)" is an unconditional dig chance. Anything with
  // extra words is qualified — "100% with Purity rune, 0% without" is not a
  // modifier you get on every dig, and rendering it as one would be a lie.
  const bare = /^[\d.]+\s*%?\s*(\(~?1\s*in\s*[\d,]+\))?$/i.test(text.trim());
  return {
    percent,
    oneIn: one ? num(one[1]) : percent ? Math.round(100 / percent) : null,
    note: bare ? null : text,
  };
}

export function parseModifiers(wikitext) {
  if (!wikitext) return [];

  const out = [];
  // Every `== Name ==` under the one `= Mineral Modifiers =` page title.
  for (const m of String(wikitext).matchAll(/^== *([^=\n]+?) *==[ \t]*$/gm)) {
    const name = plain(m[2] ?? m[1]).trim();
    if (!name || /^mineral modifiers$/i.test(name)) continue;
    const body = section(wikitext, name);
    if (!body) continue;

    const mult = field(body, 'Sell Price Multiplier');
    const colorSpan = field(body, 'Color');
    const image = field(body, 'Image');
    const chance = chanceOf(field(body, 'Chance'));

    out.push({
      id: slug(name),
      name,
      /** How many times base value a mineral with this sells for. */
      sellMultiplier: mult ? num(mult) : null,
      color: (colorSpan?.match(/color:\s*(#[0-9a-f]{3,8})/i) ?? [])[1] ?? null,
      colorName: colorSpan ? plain(colorSpan) : null,
      description: plain(field(body, 'Description')) || null,
      image: (image?.match(/File:([^|\]]+)/i) ?? [])[1]?.trim() ?? null,
      /** Gear, equipment, places and events that make this modifier likelier. */
      tools: listed(field(body, 'Tools')),
      equipment: listed(field(body, 'Equipment')),
      locations: listed(field(body, 'Location Boosts')),
      events: listed(field(body, 'Event Boosts')),
      museumStats: [...(field(body, 'Museum Bonus') ?? '').matchAll(/\{\{Stat\|([^{}]+)\}\}/gi)]
        .map((s) => s[1].trim()),
      ...chance,
    });
  }

  return out.sort((a, b) => (b.sellMultiplier ?? 0) - (a.sellMultiplier ?? 0));
}
