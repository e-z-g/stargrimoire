// What a check reads, for check_all to know when it need not run again.
//
//   node --import ./utilities/check_trace.mjs utilities/x_check.mjs
//
// With CHECK_TRACE naming a file, writes there at exit, as JSON, every file
// the check read (its modules, by the loader; the rest through fs), every
// folder it listed with what was in it, every path it asked about and
// whether it was there, and every file it gave a program it started. Files
// it wrote itself, and anything in $TMPDIR (caches of what it read
// elsewhere), are left out.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { registerHooks, syncBuiltinESMExports } from 'node:module';

const OUT = process.env.CHECK_TRACE;
if (OUT) {
  const read = new Set(), lists = new Map(), asked = new Map(), wrote = new Set();
  const TMP = [os.tmpdir(), fs.realpathSync(os.tmpdir()), '/tmp/', '/private/tmp/', '/dev/'];
  const abs = p => {
    if (p instanceof URL) p = fileURLToPath(p);
    if (Buffer.isBuffer(p)) p = p.toString();
    return typeof p === 'string' ? path.resolve(p) : null;
  };
  const keep = p => p && !TMP.some(t => p.startsWith(t));
  const onRead = p => { p = abs(p); if (keep(p)) read.add(p); };
  const onWrite = p => { p = abs(p); if (p) wrote.add(p); };

  const wrap = (obj, name, fn) => { const orig = obj[name]; if (typeof orig === 'function') obj[name] = fn(orig); };
  for (const n of ['readFileSync', 'readFile', 'createReadStream', 'openSync']) {
    wrap(fs, n, orig => function (p, ...rest) {
      const flags = n === 'openSync' ? rest[0] : null;
      if (typeof p !== 'number') (flags && /[wa+]/.test(String(flags)) ? onWrite : onRead)(p);
      return orig.call(this, p, ...rest);
    });
  }
  wrap(fs.promises, 'readFile', orig => function (p, ...rest) { if (typeof p !== 'object' || p instanceof URL || Buffer.isBuffer(p)) onRead(p); return orig.call(this, p, ...rest); });
  for (const n of ['writeFileSync', 'appendFileSync', 'createWriteStream', 'copyFileSync']) {
    wrap(fs, n, orig => function (p, ...rest) { onWrite(n === 'copyFileSync' ? rest[0] : p); if (n === 'copyFileSync') onRead(p); return orig.call(this, p, ...rest); });
  }
  for (const n of ['readdirSync']) {
    wrap(fs, n, orig => function (p, ...rest) {
      const out = orig.call(this, p, ...rest), a = abs(p);
      if (keep(a)) lists.set(a, out.map(e => (typeof e === 'string' ? e : e.name)).sort());
      return out;
    });
  }
  for (const n of ['existsSync', 'statSync', 'lstatSync']) {
    wrap(fs, n, orig => function (p, ...rest) {
      let r, threw = null;
      try { r = orig.call(this, p, ...rest); } catch (e) { threw = e; }
      const a = abs(p);
      if (keep(a) && !asked.has(a)) asked.set(a, n === 'existsSync' ? !!r : !threw && !(r === undefined));
      if (threw) throw threw;
      return r;
    });
  }
  // a program started, and the files named in its arguments
  for (const n of ['execFileSync', 'spawnSync', 'spawn', 'execFile']) {
    wrap(cp, n, orig => function (file, args, opts, ...rest) {
      const o = Array.isArray(args) ? opts : args;
      const cwd = (o && typeof o === 'object' && o.cwd) || process.cwd();
      for (const a of [file, ...(Array.isArray(args) ? args : [])]) {
        if (typeof a !== 'string' || a.startsWith('-') || a.includes('\n')) continue;
        const p = path.resolve(cwd, a);
        try { if (fs.statSync(p).isFile()) onRead(p); } catch { /* not a file */ }
      }
      return orig.call(this, file, args, opts, ...rest);
    });
  }
  syncBuiltinESMExports();
  registerHooks({
    load(url, context, next) {
      if (url.startsWith('file:')) onRead(fileURLToPath(url));
      return next(url, context);
    },
  });
  process.on('exit', () => {
    const files = [...read].filter(p => !wrote.has(p)).sort();
    fs.writeFileSync(OUT, JSON.stringify({ files, lists: Object.fromEntries(lists), asked: Object.fromEntries([...asked].filter(([p]) => !wrote.has(p))) }));
  });
}
