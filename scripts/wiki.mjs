// Shared MediaWiki API helpers for prospecting.miraheze.org
export const API = 'https://prospecting.miraheze.org/w/api.php';
export const UA  = 'ProspectingFanSite/1.0 (static fan wiki build; contact: local)';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function api(params, tries = 4) {
  const qs = new URLSearchParams({ format: 'json', formatversion: '2', ...params });
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${API}?${qs}`, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error.info || 'api error');
      return json;
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(500 * (i + 1));
    }
  }
}

/** All page titles in a category (main namespace). */
export async function categoryMembers(cat) {
  const out = [];
  let cont;
  do {
    const j = await api({
      action: 'query', list: 'categorymembers',
      cmtitle: `Category:${cat}`, cmlimit: '500', cmnamespace: '0',
      ...(cont ? { cmcontinue: cont } : {}),
    });
    out.push(...j.query.categorymembers.map(m => m.title));
    cont = j.continue?.cmcontinue;
  } while (cont);
  return out;
}

/** Raw wikitext for many titles, batched 50 at a time. */
export async function wikitextFor(titles) {
  const out = {};
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const j = await api({
      action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main',
      titles: batch.join('|'),
    });
    for (const p of j.query.pages) {
      if (p.missing) continue;
      out[p.title] = p.revisions?.[0]?.slots?.main?.content ?? '';
    }
    await sleep(120);
  }
  return out;
}
