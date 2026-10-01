// Tag every script index.html loads with a hash of its contents, js/x.js?v=<8 hex>, so that a
// browser holding an old copy fetches the new one: GitHub Pages lets a browser keep a file ten
// minutes, and the maintainer got a new page with an old script (30 September 2026). Run after
// changing any of them; utilities/stamp_check.mjs fails while a tag is stale.
//
//   node utilities/stamp.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT } from './load.mjs';

export function stamped(html) {
  return html.replace(/(<script\b[^>]*\bsrc=")(js\/[^"?]+)(\?v=[0-9a-f]*)?(")/g, (m, a, file, v, b) => {
    const h = crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, file))).digest('hex').slice(0, 8);
    return `${a}${file}?v=${h}${b}`;
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const p = path.join(ROOT, 'index.html'), html = fs.readFileSync(p, 'utf8'), out = stamped(html);
  if (out !== html) { fs.writeFileSync(p, out); console.log('index.html: script tags stamped again'); } else console.log('index.html: every tag already current');
}
