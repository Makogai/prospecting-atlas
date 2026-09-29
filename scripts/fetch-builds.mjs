/**
 * Refreshes the community build guide snapshot.
 *
 * The guide is a third-party Google Doc that the authors change without notice,
 * so this is deliberately a manual step rather than part of `data:all` — you
 * pull a new snapshot when you mean to, and the site links the live doc anyway.
 */
import { writeFileSync } from 'node:fs';

const DOC = '1qh68P12Pm1nz80jbKLZloVgapCXxVRoarM_pAs-5aVY';
const OUT = 'data/raw/builds.txt';

const res = await fetch(`https://docs.google.com/document/d/${DOC}/export?format=txt`, {
  headers: { 'User-Agent': 'ProspectingFanSite/1.0' },
  redirect: 'follow',
});
if (!res.ok) {
  console.error(`Build guide fetch failed: HTTP ${res.status}`);
  process.exitCode = 1;
} else {
  const text = await res.text();
  if (text.length < 10_000) {
    console.error(`Got only ${text.length} bytes — the doc may have been unshared.`);
    process.exitCode = 1;
  } else {
    writeFileSync(OUT, text);
    console.log(`${OUT} <- ${text.length.toLocaleString('en-US')} bytes`);
  }
}
