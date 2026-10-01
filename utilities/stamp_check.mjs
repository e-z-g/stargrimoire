// index.html's script tags carry the hash of what they load (utilities/stamp.mjs): fails on any
// script without a tag or with a stale one, and is first shown to fail on a tag broken on purpose.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './load.mjs';
import { stamped } from './stamp.mjs';

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const tags = [...html.matchAll(/<script\b[^>]*\bsrc="(js\/[^"]+)"/g)].map(m => m[1]);
const stale = html => { const want = stamped(html); return [...html.matchAll(/<script\b[^>]*\bsrc="(js\/[^"]+)"/g)].map(m => m[1]).filter(t => !want.includes(`src="${t}"`)); };
let fails = 0;
// the test fails where it should: one tag broken on purpose
const broken = html.replace(/(src="js\/[^"?]+\?v=)[0-9a-f]{8}/, '$1deadbeef');
if (!stale(broken).length) { console.log('FAIL the check does not see a tag broken on purpose'); fails++; }
const bad = stale(html);
if (bad.length) { console.log(`FAIL ${bad.length} of ${tags.length} script tags stale or untagged: ${bad.join(', ')}; run node utilities/stamp.mjs`); fails++; }
else console.log(`${tags.length} script tags, each with its file's hash`);
process.exit(fails ? 1 : 0);
