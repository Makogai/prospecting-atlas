/**
 * Refreshes the community build guide snapshot.
 *
 * The guide is a third-party Google Doc the authors change without notice, and
 * it can be unshared or moved at any time. With `--keep-going` a failure is a
 * warning rather than an error, so one unreachable doc can't stop a full
 * `data:all` from refreshing everything that came off the wiki. The last good
 * snapshot in data/raw/ stays in place and the build carries on using it.
 */
import { writeFileSync, existsSync } from 'node:fs';

const keepGoing = process.argv.includes('--keep-going');
const fail = (msg) => {
  console.error(msg);
  if (keepGoing) {
    console.warn(
      existsSync('data/raw/builds.txt')
        ? 'Keeping the existing build-guide snapshot and carrying on.'
        : 'No snapshot on disk — the site will build without community builds.',
    );
  } else {
    process.exitCode = 1;
  }
};

const DOC = '1qh68P12Pm1nz80jbKLZloVgapCXxVRoarM_pAs-5aVY';
const OUT = 'data/raw/builds.txt';

let res;
try {
  res = await fetch(`https://docs.google.com/document/d/${DOC}/export?format=txt`, {
    headers: { 'User-Agent': 'ProspectingFanSite/1.0' },
    redirect: 'follow',
  });
} catch (err) {
  fail(`Build guide fetch failed: ${err.message}`);
  res = null;
}

if (!res) {
  // handled above
} else
if (!res.ok) {
  fail(`Build guide fetch failed: HTTP ${res.status}`);
} else {
  const text = await res.text();
  if (text.length < 10_000) {
    fail(`Got only ${text.length} bytes — the doc may have been unshared.`);
  } else {
    writeFileSync(OUT, text);
    console.log(`${OUT} <- ${text.length.toLocaleString('en-US')} bytes`);
  }
}
