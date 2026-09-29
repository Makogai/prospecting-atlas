// Brace-aware wikitext helpers shared by the parsers.

/** Split a template body's top-level `|name = value` params, respecting nesting. */
export function templateParams(body) {
  const parts = [];
  let depth = 0, buf = '';
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === '{{' || two === '[[') { depth++; buf += two; i++; continue; }
    if (two === '}}' || two === ']]') { depth--; buf += two; i++; continue; }
    if (body[i] === '|' && depth === 0) { parts.push(buf); buf = ''; continue; }
    buf += body[i];
  }
  parts.push(buf);

  const out = {};
  for (const p of parts.slice(1)) {          // slice(1) drops the template name
    const eq = p.indexOf('=');
    if (eq === -1) continue;
    const key = p.slice(0, eq).trim().toLowerCase();
    if (!/^[a-z0-9 _-]+$/.test(key)) continue;
    out[key] = p.slice(eq + 1).trim();
  }
  return out;
}

/** Find every `{{Name|...}}` invocation in wikitext and return its params. */
export function findTemplates(text, name) {
  const out = [];
  const needle = `{{${name}`;
  let idx = 0;
  while ((idx = text.indexOf(needle, idx)) !== -1) {
    const after = text[idx + needle.length];
    if (after && !/[|\s}]/.test(after)) { idx += needle.length; continue; }
    let depth = 0, end = idx;
    for (let i = idx; i < text.length; i++) {
      if (text.slice(i, i + 2) === '{{') { depth++; i++; continue; }
      if (text.slice(i, i + 2) === '}}') { depth--; i++; if (depth === 0) { end = i + 1; break; } }
    }
    out.push(templateParams(text.slice(idx + 2, end - 2)));
    idx = end;
  }
  return out;
}

/** `{{Foo}}` / `[[A|B]]` / `'''x'''` -> readable plain text. */
export function plain(s) {
  if (!s) return '';
  return s
    .replace(/<[^>]+>/g, '')
    // {{Stat|Dig Speed}} renders as its argument, not the template name.
    .replace(/\{\{Stat\|([^{}]+)\}\}/gi, '$1')
    .replace(/\{\{([^{}|]+)(?:\|[^{}]*)?\}\}/g, '$1')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Every page/template name referenced as `{{X}}` or `[[X]]`, in order. */
export function refs(s) {
  if (!s) return [];
  const out = [];
  for (const m of s.matchAll(/\{\{([^{}|]+?)(?:\|[^{}]*)?\}\}/g)) out.push(m[1].trim());
  for (const m of s.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]*)?\]\]/g)) out.push(m[1].trim());
  return out;
}

/**
 * `{{$|4,000}} • {{EXP|5,000}} • {{Meteor Shards|2,000}}` ->
 * `$4,000 • 5,000 EXP • 2,000 Meteor Shards`.
 *
 * Run this before plain(), which keeps only a template's name and would drop
 * every number in a rewards line.
 */
export function renderValues(text) {
  return String(text ?? '')
    .replace(/\{\{\s*\$\s*\|([^{}]*)\}\}/g, (_, v) => `$${v.trim()}`)
    .replace(/\{\{([^|{}]+)\|([^{}]*)\}\}/g, (_, n, v) =>
      v.trim() ? `${v.trim()} ${n.trim()}` : n.trim());
}

export const num = (s) => {
  if (s == null) return null;
  const m = String(s).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};

export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
