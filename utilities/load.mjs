// The site's classic scripts, run in one node:vm context the way a page runs
// them in one global scope, in the order index.html loads them. And the
// reference releases opened into a game.
//
//   import { site, openRelease, RELEASES } from './load.mjs';
//   const S = site();                          // every js/ file the page loads
//   const game = openRelease(S, '1.1.1');      // or '1.0.10', '1.0.8', '1.0.2'
//
// A check that needs the DOM (the PICT decoder draws into a canvas) passes
// { dom: true } for a stub canvas whose pixels land in a plain array.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REF = path.join(ROOT, 'reference');

// The <script src> list of index.html, in order: the page is the one place it is written.
export function pageScripts() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  return [...html.matchAll(/<script\b([^>]*)>/g)]
    .map(m => /\bsrc="([^"]+)"/.exec(m[1]))
    .filter(Boolean).map(m => m[1]);
}

function stubCanvas() {
  const c = {
    width: 0, height: 0,
    getContext() {
      return {
        createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
        putImageData(im) { c._pixels = im.data; c._w = im.width; c._h = im.height; },
        drawImage() {}, fillRect() {}, clearRect() {},
      };
    },
  };
  return c;
}

export function site(opts = {}) {
  const files = (opts.files || pageScripts().filter(f => f.startsWith('js/') && !f.startsWith('js/page-')));
  const ctx = {
    console, TextDecoder, TextEncoder, Uint8Array, Uint8ClampedArray, Uint16Array, Int16Array, Uint32Array,
    Int32Array, Float32Array, Float64Array, DataView, ArrayBuffer, Math, Error, Map, Set, JSON, Date, Number,
    String, Array, Object, RegExp, Symbol, Promise, parseInt, parseFloat, isFinite, isNaN, Infinity, NaN, BigInt,
    Blob: class { constructor(parts, o) { this.parts = parts; this.type = o && o.type; } },
  };
  if (opts.dom) ctx.document = { createElement: t => (t === 'canvas' ? stubCanvas() : {}) };
  vm.createContext(ctx);
  const lexical = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    vm.runInContext(src, ctx, { filename: f });
    // A top-level const or let is shared between scripts, as in a page, but
    // is not a property of the global object; lift each onto it for callers.
    for (const m of src.matchAll(/^(?:const|let)\s+([A-Za-z_$][\w$]*)/gm)) lexical.push(m[1]);
  }
  vm.runInContext(lexical.map(n => `globalThis.${n} = ${n};`).join('\n'), ctx);
  return ctx;
}

export const RELEASES = {
  '1.0.2': { sit: 'game/EV_Nova_1.0.2.sit' },
  '1.0.8': { sit: 'game/EV_Nova_1.0.8.sit' },
  '1.0.10': { sit: 'game/EV_Nova_1.0.10.sit' },
  '1.1.1': { dir: 'EV_Nova_1.1.1/Nova Files' },
};

export function haveRelease(v) {
  const r = RELEASES[v];
  return fs.existsSync(path.join(REF, r.sit || r.dir));
}

// Which roles to open; the ships and sounds are 100 MB the map never reads.
const MAP_ROLES = new Set(['data', 'graphics', 'titles']);

// A decompressed fork is kept in $TMPDIR, since the Titles files alone take
// seconds each. The file is trusted only when it is there at the length the
// catalog gives: macOS empties $TMPDIR's files and keeps its folders.
const FORK_CACHE = path.join(os.tmpdir(), 'stargrimoire-forks');
function cached(archive, f) {
  const st = fs.statSync(archive);
  const key = crypto.createHash('sha1').update([archive, st.size, st.mtimeMs, f.path, f.size].join('\0')).digest('hex');
  const file = path.join(FORK_CACHE, key + '.rsrc');
  const read = f.read;
  return () => {
    if (fs.existsSync(file) && fs.statSync(file).size === f.size) return new Uint8Array(fs.readFileSync(file));
    const bytes = read();
    fs.mkdirSync(FORK_CACHE, { recursive: true });
    fs.writeFileSync(file, bytes);
    return bytes;
  };
}

export function releaseFiles(S, v) {
  const r = RELEASES[v];
  if (r.sit) {
    const archive = path.join(REF, r.sit);
    const files = S.novaArchiveFiles(new Uint8Array(fs.readFileSync(archive)));
    if (!process.env.NO_FORK_CACHE) for (const f of files) f.read = cached(archive, f);
    return files;
  }
  const dir = path.join(REF, r.dir);
  return fs.readdirSync(dir).filter(n => n.endsWith('.ndat')).sort()
    .map(n => S.novaLooseFile(n, new Uint8Array(fs.readFileSync(path.join(dir, n))))).filter(Boolean);
}

export function openRelease(S, v, roles = MAP_ROLES) {
  const game = S.novaGame();
  for (const f of releaseFiles(S, v)) if (!roles || roles.has(f.role) || f.plugin) game.add(f, f.read());
  return game;
}
