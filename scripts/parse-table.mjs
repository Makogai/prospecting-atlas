/**
 * Shared wikitable and tabber reading.
 *
 * Most of the systems pages are one of two shapes — a `{| class="wikitable" |}`
 * grid, or a `<tabber>` of them — so the fiddly parts (pipes inside templates,
 * a tabber's first tab having no `|-|` in front of it) are solved once here
 * rather than in every parser.
 */
import { plain } from './parse-util.mjs';

/**
 * Split one table row into cells.
 *
 * Cells are separated by `||` on a line or a leading `|` on the next, and both
 * appear in the wild. Neither can be split naively: `{{Stat|Luck}}` and
 * `[[File:x.png|18px|link=y]]` carry pipes of their own, so this tracks
 * template and link depth.
 */
export function splitCells(row) {
  const out = [];
  let buf = '';
  let depth = 0;
  for (let i = 0; i < row.length; i++) {
    const two = row.slice(i, i + 2);
    if (two === '{{' || two === '[[') { depth++; buf += two; i++; continue; }
    if (two === '}}' || two === ']]') { depth--; buf += two; i++; continue; }
    if (depth === 0) {
      if (two === '||' || two === '!!') { out.push(buf); buf = ''; i++; continue; }
      if (row[i] === '\n' && (row[i + 1] === '|' || row[i + 1] === '!')) {
        out.push(buf);
        buf = '';
        i++;
        continue;
      }
    }
    buf += row[i];
  }
  out.push(buf);
  return out.map(stripCell).filter((c, i) => i > 0 || c !== '');
}

/**
 * Drop a cell's leading marker and any `style="…" |` attribute prefix.
 *
 * The separating `|` has to be found at depth zero. A cell like
 * `<span style="color:#7000FF;">{{Enchant|Mastered|solid}}</span>` has an `=`
 * in the span and pipes inside the template, and cutting at the first pipe
 * found anywhere turns the value into `Mastered|solid}}</span>`.
 */
function stripCell(cell) {
  let s = cell.replace(/^\s*[|!]/, '');
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const two = s.slice(i, i + 2);
    if (two === '{{' || two === '[[') { depth++; i++; continue; }
    if (two === '}}' || two === ']]') { depth--; i++; continue; }
    if (s[i] !== '|' || depth !== 0) continue;
    const head = s.slice(0, i);
    // Attributes look like `key="value"` and never open a template or link.
    if (head.includes('=') && !/[[{]/.test(head)) s = s.slice(i + 1);
    break;
  }
  return s.trim();
}

/** Every `{| … |}` table in a chunk of wikitext, as headers plus rows. */
export function tables(wikitext) {
  const out = [];
  const text = String(wikitext ?? '');
  let at = 0;
  while ((at = text.indexOf('{|', at)) !== -1) {
    const end = text.indexOf('|}', at);
    const body = text.slice(at + 2, end === -1 ? undefined : end);
    at = end === -1 ? text.length : end + 2;

    const parts = body.split(/^\|-.*$/m);
    // The first chunk is the table attributes plus, usually, the header row.
    const headRaw = parts[0];
    const headers = /^\s*!/m.test(headRaw)
      ? splitCells(headRaw.slice(headRaw.search(/^\s*!/m))).map((c) => plain(c))
      : [];
    const rows = parts
      .slice(1)
      .map((r) => splitCells(r))
      .filter((r) => r.length > 0 && r.some((c) => c !== ''));
    // A table whose header row sits after the first `|-` instead of before it.
    if (!headers.length && rows.length && /^\s*!/m.test(parts[1] ?? '')) {
      out.push({ headers: rows[0].map((c) => plain(c)), rows: rows.slice(1) });
    } else {
      out.push({ headers, rows });
    }
  }
  return out;
}

/** Narrow to a tabber's body; its first tab has no leading `|-|`. */
export function tabberBody(wikitext) {
  const text = String(wikitext ?? '');
  const open = text.indexOf('<tabber>');
  if (open === -1) return text;
  const close = text.lastIndexOf('</tabber>');
  return text.slice(open + '<tabber>'.length, close === -1 ? undefined : close);
}

/** A tabber as `[label, body]` pairs. */
export function tabs(wikitext) {
  return tabberBody(wikitext)
    .split(/^\|-\|\s*/m)
    .map((chunk) => {
      const eq = chunk.indexOf('=');
      if (eq === -1) return null;
      const label = plain(chunk.slice(0, eq)).trim();
      return label ? [label, chunk.slice(eq + 1)] : null;
    })
    .filter(Boolean);
}

/**
 * A `== Heading ==` section's body, found by flattened heading text so that
 * headings wrapped in gradient spans still match.
 */
export function section(wikitext, heading) {
  const text = String(wikitext ?? '');
  const want = heading.toLowerCase();
  const marks = [...text.matchAll(/^(=+) *(.+?) *=+[ \t]*$/gm)];
  for (let i = 0; i < marks.length; i++) {
    if (plain(marks[i][2]).toLowerCase() !== want) continue;
    const depth = marks[i][1].length;
    const start = marks[i].index + marks[i][0].length;
    // Runs until the next heading at the same level or shallower.
    const next = marks.slice(i + 1).find((m) => m[1].length <= depth);
    return text.slice(start, next ? next.index : undefined).trim();
  }
  return null;
}

/** `—`, `-`, `N/A` and an empty cell all mean "nothing here". */
export const isBlank = (cell) => !cell || /^(—|–|-|n\/?a|none|\(none\))$/i.test(plain(cell).trim());
