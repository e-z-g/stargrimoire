// index.html as a browser has it.
//
// Without a browser: every <script src> is there, none is a module and no
// js/ file imports or exports (the page must work from file://), and no
// top-level name is declared in two scripts -- they share one global scope,
// so the later would win and nothing would say so.
//
// In headless Chrome (utilities/browser.mjs), served over HTTP:
//   - the page loads with no console error or exception and shows its start;
//   - with a release from reference/ opened through ?src=, the galaxy comes
//     up, every picture file is read, zooming in on Sol a wheel step at a
//     time opens it and puts you in it and zooming out takes you back to
//     the galaxy, and going to Sol and landing on Earth draws the landing
//     picture, and pinching in on the landing page rises back to Sol --
//     on a desktop window and a phone's;
//   - the subway map, switched to in Sol, keeps you in Sol with every place
//     moved, and in the galaxy draws links with bends; switched back, the
//     true positions and the address without it; to 22.5 degrees and back,
//     the address saying so; the map with room for names routes every link
//     and gives Sol its name's room; #system=130&subway opens Sol on the
//     subway map, and #galaxy&subway=heading the map that keeps each
//     link's heading, its switch on; #galaxy&subway=22.5,mixed,heading
//     22.5 degrees only where needed on it, its switches on, with Moash
//     Llima drawn as a bar that a tap on its end picks; &subway=heading,dots
//     draws it as a point, and the switch back on as a bar again;
//   - the system names, zooming in on Sol a step at a time: none on the
//     screen goes or changes side once shown, and no two shown meet; Sol's
//     stellars named when gone to; #galaxy&subway=names,heading, room for names keeping headings,
//     with every name put where the lines left room;
//   - with Stellars as you zoom in off, zooming in on Sol leaves it a dot
//     and you in the galaxy, going to Sol opens it, and zooming out closes
//     it again; hiding the details gives the map the panel's room, and
//     showing them gives it back;
//   - a nebula chosen in the panel from a view zoomed in elsewhere is
//     reached without the view swinging away; the links coloured by jumps
//     from Sol reach most systems and the key says so, and goes when the
//     colouring does; every nebula moves with the subway map;
//   - a route chosen in the panel from Sol to the system furthest from it
//     is that many jumps, every step a shown link, and in the address;
//     within 2 jumps of Sol lights only the places that near; the systems
//     in one colour, or by radar interference with those without it grey
//     and a key; systems with a shipyard lit, and only they; the map saved
//     as a picture is a PNG; the hypergates and wormholes drawn, from Sol its
//     wormhole's way to every other random one and from Kania none, Kania's
//     panel naming its hypergate's three systems, and none with the switch off;
//     with the gates the route from Sol no longer and each step a link or a
//     gate's way; b147, followed from Sol's visibility, named after the
//     mission that sets it, the map shown with it set and then without;
//     the storylines listed, Take Polaris Home opened from b147's panel as
//     Rebel I's step 22 and its last, and Rebel I's missions and places;
//   - on the phone, nothing is wider than the screen;
//   - the ships, opened at #ship=154 (the Aurora Cruiser): the list has a
//     row and a drawn picture for every ship class, the ship turns and is
//     drawn, turning the engines on adds light, its three pictures are
//     drawn, the Map switch goes to the map and Back returns to the ship,
//     and a shipyard in its list goes to that stellar on the map -- on both
//     screens, and on the phone the list gives way to the ship and back.
// SHOTS=<dir> keeps a screenshot of each view.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, pageScripts, haveRelease, RELEASES } from './load.mjs';
import { findChrome, serve, loadPage, pageErrors } from './browser.mjs';

let fails = 0;
const fail = m => { console.log('FAIL ' + m); fails++; };

// ---- without a browser ---------------------------------------------------
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
if (/<script\b[^>]*type\s*=\s*["']?module/i.test(html)) fail('index.html has a module script');
const scripts = pageScripts();
const seen = new Map();
for (const src of scripts) {
  const file = path.join(ROOT, src);
  if (!fs.existsSync(file)) { fail(`${src} is not there`); continue; }
  const text = fs.readFileSync(file, 'utf8');
  if (/^\s*(import|export)\s/m.test(text)) fail(`${src} imports or exports: it must be a classic script`);
  for (const m of text.matchAll(/^(?:async\s+)?(?:function\s*\*?\s*([A-Za-z_$][\w$]*)|(?:const|let|var|class)\s+([A-Za-z_$][\w$]*))/gm)) {
    const name = m[1] || m[2];
    if (seen.has(name) && seen.get(name) !== src) fail(`${name} is declared in both ${seen.get(name)} and ${src}`);
    seen.set(name, src);
  }
}
console.log(`${scripts.length} scripts, ${seen.size} top-level names, none declared twice`);

// ---- in a browser --------------------------------------------------------
const chrome = findChrome();
if (!chrome) { console.log('SKIP browser: no Chrome or Chromium ($CHROME, the PATH, /Applications)'); process.exit(fails ? 1 : 0); }
const shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
const srv = await serve();
const describe = l => (l.where ? l.where + ' ' : '') + l.text.split('\n')[0].slice(0, 200);
try {
  const bare = await loadPage(srv.base + 'index.html', "document.readyState === 'complete'", 20000, { chrome,
    then: async p => p.evaluate("!document.getElementById('start').hidden && document.getElementById('app').hidden") });
  for (const e of pageErrors(bare.console)) fail('index.html: ' + describe(e));
  if (!bare.more) fail('index.html does not show its start with nothing open');
  else console.log('index.html loads with nothing open, no errors');

  const v = ['1.0.10', '1.1.1'].find(haveRelease);
  if (!v) console.log('SKIP the map: no release in reference/');
  else {
    let src;
    if (RELEASES[v].sit) src = '?src=' + encodeURIComponent('reference/' + RELEASES[v].sit);
    else {
      const dir = 'reference/' + RELEASES[v].dir;
      src = '?' + fs.readdirSync(path.join(ROOT, dir)).filter(n => /^Nova (Data|Graphics|Titles)/.test(n)).map(n => 'src=' + encodeURIComponent(dir + '/' + n)).join('&');
    }
    const devices = [
      { name: 'desktop', width: 1280, height: 800, scale: 1 },
      { name: 'phone', width: 412, height: 915, scale: 2.6, mobile: true },
    ];
    for (const dev of devices) {
      const r = await loadPage(srv.base + 'index.html' + src, 'typeof U !== "undefined" && U && !PUMPING && PENDING.length === 0 && GAME.files.length > 6', 240000, { chrome, device: dev,
        then: async p => {
          const out = {};
          const shot = async n => { if (shots) await p.shot(path.join(shots, `${dev.name}-${n}.png`)); };
          out.galaxy = await p.evaluate("({ shown: SHOWN.size, links: LINKS.length, panel: document.getElementById('panel').textContent.slice(0, 40) })");
          await shot('galaxy');
          // One picture: Sol brought to the middle and zoomed in on, a step
          // at a time, with nothing tapped, and then zoomed out again.
          out.zoom = await p.evaluate(`(async () => {
            const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
            const sol = U.byId.get(130), goal = systemView(sol).s;
            CAM.x = sol.x; CAM.y = sol.y; redraw(); await frame();
            let steps = 0, half = null;
            for (; steps < 120 && CAM.s < goal; steps++) {
              zoomAt(CW / 2, CH / 2, 1.15); await frame();
              const d = DRAWN.find(v => v.sys.id === 130);
              if (half === null && d && d.t > 0 && d.t < 1) half = { mode: VIEW.mode, t: d.t };
            }
            const d = DRAWN.find(v => v.sys.id === 130);
            const inside = { steps, mode: VIEW.mode, sys: VIEW.sys, open: d ? d.t : null, hash: location.hash, half };
            for (let i = 0; i < 120 && CAM.s > GALAXY_HOME.s; i++) { zoomAt(CW / 2, CH / 2, 1 / 1.15); await frame(); }
            return { inside, after: { mode: VIEW.mode, sys: VIEW.sys, hash: location.hash } };
          })()`);
          await p.evaluate("show('system', { sys: 130 })");
          out.system = await p.evaluate("({ mode: VIEW.mode, panel: document.querySelector('#panel h2').textContent, crumbs: document.getElementById('crumbs').textContent })");
          await shot('system');
          await p.evaluate("show('planet', { sys: 130, stellar: 128 })");
          await new Promise(r => setTimeout(r, 300));
          out.planet = await p.evaluate(`(() => {
            const c = document.querySelector('#landPict canvas');
            if (!c) return { pict: null, text: document.getElementById('landPict').textContent };
            const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            let lit = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 60) lit++;
            return { pict: c.width + 'x' + c.height, lit: lit / (c.width * c.height), hash: location.hash,
                     desc: document.querySelector('#planet .desc').textContent.slice(0, 30) };
          })()`);
          await shot('planet');
          out.wide = await p.evaluate('document.documentElement.scrollWidth - window.innerWidth');
          // Out of the landing page by pinching in on it: two fingers on the
          // phone, a trackpad's ctrl-wheel on the desktop.
          out.pinch = await p.evaluate(`(async () => {
            const el = document.getElementById('planet'), frame = () => new Promise(r => requestAnimationFrame(r));
            if (${!!dev.mobile}) {
              const at = (id, x, y) => new Touch({ identifier: id, target: el, clientX: x, clientY: y });
              const fire = (type, list) => el.dispatchEvent(new TouchEvent(type, { touches: list, targetTouches: list, changedTouches: list, bubbles: true, cancelable: true }));
              const cx = innerWidth / 2, cy = 300;
              fire('touchstart', [at(1, cx - 150, cy), at(2, cx + 150, cy)]);
              for (let k = 1; k <= 6; k++) { fire('touchmove', [at(1, cx - 150 + k * 20, cy), at(2, cx + 150 - k * 20, cy)]); await frame(); }
              el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [at(1, cx - 30, cy)], bubbles: true }));
            } else {
              for (let k = 0; k < 4; k++) { el.dispatchEvent(new WheelEvent('wheel', { deltaY: 30, ctrlKey: true, bubbles: true, cancelable: true })); await frame(); }
            }
            for (let i = 0; i < 100 && (MOVING || VIEW.mode === 'planet'); i++) await new Promise(r => setTimeout(r, 50));
            return { mode: VIEW.mode, sys: VIEW.sys, sel: VIEW.sel, hash: location.hash, page: document.getElementById('planet').classList.contains('on') };
          })()`);
          // The subway map, switched to inside Sol and back from the galaxy,
          // and asked for by the address.
          out.subway = await p.evaluate(`(async () => {
            const idle = async () => { for (let i = 0; i < 200 && MOVING; i++) await new Promise(r => setTimeout(r, 50)); };
            const t0 = performance.now();
            await subwayGet('45');
            const ms = Math.round(performance.now() - t0);
            await setLayout('45'); await idle();
            const sol = PLACE_OF.get(130);
            const inSol = { mode: VIEW.mode, sys: VIEW.sys, mix: LAYOUT.mix, hash: location.hash, moved: Math.hypot(sol.x - sol.tx, sol.y - sol.ty) > 1 };
            await show('galaxy', {}); await idle();
            let bent = 0;
            for (const l of LINKS) { const pa = PLACE_OF.get(l.from.id), pb = PLACE_OF.get(l.to.id); if (!pa || !pb) continue; const q = linkPoints(l, pa, pb), dir = i => Math.atan2(q[i + 1].y - q[i].y, q[i + 1].x - q[i].x); for (let i = 1; i + 1 < q.length; i++) if (Math.abs(dir(i) - dir(i - 1)) > 1e-6) { bent++; break; } }
            const galaxy = { mode: VIEW.mode, hash: location.hash, stats: LAYOUT.sub.layout.stats, drawn: LINKS.length, bent };
            await setLayout('fine'); await idle();
            const fine = { kind: LAYOUT.kind, mix: LAYOUT.mix, hash: location.hash, sel: [$('optSubway').checked, $('optFine').checked, $('optRoom').checked].join(), stats: LAYOUT.sub.layout.stats };
            const t1 = performance.now();
            await subwayGet('names');
            const namesMs = Math.round(performance.now() - t1);
            await setLayout('names'); await idle();
            Object.assign(CAM, { x: PLACE_OF.get(130).x, y: PLACE_OF.get(130).y, s: 12 / (0.72 * LAYOUT.sub.layout.step) }); draw();
            const solN = PLACE_OF.get(130), nm = LAYOUT.sub.name(solN.tx, solN.ty);
            const names = { kind: LAYOUT.kind, hash: location.hash, stats: LAYOUT.sub.layout.stats, ms: namesMs, room: namesInRoom(), sol: nm && { side: nm.side, w: +nm.w.toFixed(2) } };
            return { ms, inSol, galaxy, fine, names };
          })()`);
          // in two, since each evaluation is given 60 s, and the four maps together took 40 on the phone
          Object.assign(out.subway, await p.evaluate(`(async () => {
            const idle = async () => { for (let i = 0; i < 200 && MOVING; i++) await new Promise(r => setTimeout(r, 50)); };
            // the page answers while the slowest map is worked out in the background
            const t2 = performance.now(), job = subwayGet('names-fine'), noteShown = !$('busy').hidden;
            const late = await new Promise(r => { const t = performance.now(); setTimeout(() => r(performance.now() - t - 50), 50); });
            await job;
            const noteGone = $('busy').hidden, status = $('status').textContent;
            const bgMs = Math.round(performance.now() - t2);
            await setLayout('names-fine'); await idle();
            const both = { kind: LAYOUT.kind, hash: location.hash, stats: LAYOUT.sub.layout.stats, room: namesInRoom(), sel: [$('optSubway').checked, $('optFine').checked, $('optRoom').checked].join(), late: Math.round(late), bgMs, noteShown, noteGone, status };
            await setLayout('45'); await idle();
            return { both };
          })()`));
          await shot('subway');
          out.subwayOff = await p.evaluate(`(async () => {
            await setLayout(null); for (let i = 0; i < 200 && MOVING; i++) await new Promise(r => setTimeout(r, 50));
            const off = { mix: LAYOUT.mix, hash: location.hash, sel: [$('optSubway').checked, $('optFine').disabled].join() };
            history.replaceState(null, '', '#system=130&subway'); applyHash(); await subwayGet('45'); await new Promise(r => setTimeout(r, 50));
            for (let i = 0; i < 200 && MOVING; i++) await new Promise(r => setTimeout(r, 50));
            const byHash = { mix: LAYOUT.mix, mode: VIEW.mode, sys: VIEW.sys, sel: [$('optSubway').checked, $('optFine').checked, $('optRoom').checked].join() };
            history.replaceState(null, '', '#galaxy&subway=heading'); applyHash(); await subwayGet('heading'); await new Promise(r => setTimeout(r, 50));
            for (let i = 0; i < 200 && MOVING; i++) await new Promise(r => setTimeout(r, 50));
            const heading = { kind: LAYOUT.kind, mix: LAYOUT.mix, hash: location.hash, stats: LAYOUT.sub.layout.stats, sel: [$('optSubway').checked, $('optFine').checked, $('optRoom').checked, $('optHeading').checked].join() };
            history.replaceState(null, '', '#galaxy&subway=22.5,mixed,heading'); applyHash(); await subwayGet('fine-mixed-heading'); await new Promise(r => setTimeout(r, 50));
            for (let i = 0; i < 200 && MOVING; i++) await new Promise(r => setTimeout(r, 50));
            redraw();
            const ml = U.systems.find(s => s.name === 'Moash Llima'), bar = ml && barEnds(PLACE_OF.get(ml.id)), got = bar && systemAt(bar.x0, bar.y0);
            const mixed = { kind: LAYOUT.kind, mix: LAYOUT.mix, hash: location.hash, stats: LAYOUT.sub.layout.stats, sel: [$('optFine').checked, $('optMixed').checked, $('optMixed').disabled, $('optHeading').checked].join(), bar: !!bar, picked: !!got && got.id === ml.id };
            // busy stations as points, from the address, and the switch turned back on
            history.replaceState(null, '', '#galaxy&subway=heading,dots'); applyHash(); await subwayGet('heading-dots'); await new Promise(r => setTimeout(r, 50));
            for (let i = 0; i < 200 && MOVING; i++) await new Promise(r => setTimeout(r, 50));
            const dots = { kind: LAYOUT.kind, hash: location.hash, stats: LAYOUT.sub.layout.stats, sel: [$('optBars').checked, $('optBars').disabled].join(), bar: !!barEnds(PLACE_OF.get(ml.id)) };
            $('optBars').checked = true; $('optBars').onchange(); await subwayGet('heading');
            for (let i = 0; i < 200 && (MOVING || LAYOUT.kind !== 'heading'); i++) await new Promise(r => setTimeout(r, 50));
            Object.assign(dots, { back: LAYOUT.kind, backHash: location.hash, backBar: !!barEnds(PLACE_OF.get(ml.id)) });
            return { off, byHash, heading, mixed, dots };
          })()`);
          // A route, a reach, government colours off and the map saved as a picture.
          out.features = await p.evaluate(`(async () => {
            history.replaceState(null, '', '#galaxy&system=130'); applyHash(); await new Promise(r => setTimeout(r, 100));
            for (let i = 0; i < 200 && MOVING; i++) await new Promise(r => setTimeout(r, 50));
            const far = [...jumpMap()].sort((a, b) => b[1] - a[1])[0];
            $('optGates').checked = false; $('optGates').onchange();
            document.querySelector('[data-route-from="130"]').click();
            VIEW.sel = { kind: 'system', id: far[0] }; renderPanel();
            document.querySelector('[data-route-to="' + far[0] + '"]').click();
            const path = routePath(), linked = new Set();
            for (const l of LINKS) { if (!l.oneWay || l.forward) linked.add(l.from.id + '-' + l.to.id); if (!l.oneWay || !l.forward) linked.add(l.to.id + '-' + l.from.id); }
            const route = { jumps: path && path.length - 1, want: far[1], steps: !!path && path.every((id, i) => !i || linked.has(path[i - 1] + '-' + id)),
                            hash: location.hash, panel: !!document.querySelector('#panel .route') && /steps/.test(document.querySelector('#panel .route').textContent) };
            // with the gates, from Kania, which has one, to the system they bring nearest: shorter,
            // every step a link or a gate's way, and the gate step named
            const hops = to => { ROUTE = { from: 128, to }; const p = routePath(); return p ? p.length - 1 : Infinity; };
            let best = null;
            for (const id of SHOWN) {
              if (id === 128) continue;
              $('optGates').checked = false; $('optGates').onchange(); const a = hops(id);
              $('optGates').checked = true; $('optGates').onchange(); const b = hops(id);
              if (a < Infinity && (!best || a - b > best.saved)) best = { to: id, saved: a - b, jumps: a };
            }
            setRoute(128, best.to);
            const gpath = routePath(), ways = new Set(GATES.ways.map(w => w.from.id + '-' + w.to.id));
            Object.assign(route, { gateFrom: 'Kania', gateTo: U.byId.get(best.to).name, gateJumps: best.jumps, gated: gpath && gpath.length - 1, gatedSteps: !!gpath && gpath.every((id, i) => !i || linked.has(gpath[i - 1] + '-' + id) || ways.has(gpath[i - 1] + '-' + id)),
                                   byGate: !!gpath && gpath.some((id, i) => i && !linked.has(gpath[i - 1] + '-' + id)), named: / by HG-/.test(document.querySelector('#panel .route').textContent) });
            VIEW.sel = { kind: 'system', id: 130 }; $('optReach').value = '2'; $('optReach').oninput();
            const near = new Set([...jumpMap()].filter(([, j]) => j <= 2).map(([id]) => PLACE_OF.get(id)));
            const reach = { lit: PLACES.filter(p => !placeBeyond(p)).length, near: near.size, all: PLACES.length };
            $('optReach').value = ''; $('optReach').oninput();
            const pick = v => { $('dotSel').value = v; $('dotSel').onchange(); };
            const shownSys = U.systems.filter(s => SHOWN.has(s.id)), gs = shownSys.find(s => govtFill(s.govt) !== PLAIN_DOT);
            const on = dotFill(gs); pick('one');
            const govt = { on: on === govtFill(gs.govt), off: dotFill(gs) === PLAIN_DOT };
            pick('interference');
            const quiet = shownSys.find(s => !s.rec.Interference), loud = shownSys.find(s => s.rec.Interference > 0);
            const figure = { none: dotFill(quiet) === NONE_DOT, some: !!loud && dotFill(loud) !== NONE_DOT, key: !$('legend').hidden && /interference/i.test($('legend').textContent) };
            pick('govt');
            // systems with a shipyard lit, and only they
            $('litSel').value = 'shipyard'; $('litSel').onchange();
            const yards = new Set(shownSys.filter(s => novaSystemServices(U, s).shipyard).map(s => PLACE_OF.get(s.id)));
            const light = { lit: PLACES.filter(p => !placeFaint(p)).length, yards: yards.size, all: PLACES.length, key: /lit/.test($('legend').textContent) };
            $('litSel').value = 'all'; $('litSel').onchange();
            let saved = null; const was = dlBlob; dlBlob = (b, n) => { saved = { size: b.size, type: b.type, name: n }; };
            $('saveImg').click(); for (let i = 0; i < 60 && !saved; i++) await new Promise(r => setTimeout(r, 50)); dlBlob = was;
            setRoute(null, null);
            // Hypergates and wormholes: from Sol, its wormhole's way to every other random one; Kania's hypergate's three; the switch off
            VIEW.sel = { kind: 'system', id: 130 }; renderPanel(); draw();
            const gates = { links: GATES_DRAWN.links, random: GATES_DRAWN.random, want: new Set(GATES.random.map(r => PLACE_OF.get(r.sys.id))).size - 1,
                            sol: /random one of the \\d+ other wormholes/.test($('panel').textContent) };
            VIEW.sel = { kind: 'system', id: 128 }; renderPanel(); draw();
            const named = [...document.querySelectorAll('#panel table.gates a[data-sys]')].map(a => a.textContent);
            Object.assign(gates, { kania: ['Tichel', 'Dani', 'Koria'].every(n => named.includes(n)), kaniaRandom: GATES_DRAWN.random });
            $('optGates').checked = false; $('optGates').onchange(); draw(); gates.off = GATES_DRAWN.links + GATES_DRAWN.random;
            $('optGates').checked = true; $('optGates').onchange();
            // A bit: b147 from Sol's visibility, what sets it, and the map with it set and without
            VIEW.sel = { kind: 'system', id: 130 }; renderPanel();
            const link = document.querySelector('#panel [data-bit="147"]');
            const bits = { link: !!link };
            if (link) {
              link.click();
              const txt = $('panel').textContent, was = SHOWN.size;
              Object.assign(bits, { title: document.querySelector('#panel h2').textContent, setter: /Take Polaris Home/.test(txt), needs: /Sol/.test(txt) });
              document.querySelector('#panel [data-bit-map="147"]').click();
              Object.assign(bits, { mode: SHOW_MODE, typed: $('bitsIn').value, changed: SHOWN.size !== was || !SHOWN.has(130), still: VIEW.sel && VIEW.sel.kind === 'bit' });
              document.querySelector('#panel [data-bit-map="147"]').click();
              document.querySelector('#panel [data-bit-back]').click();
              Object.assign(bits, { off: $('bitsIn').value === '', back: VIEW.sel && VIEW.sel.kind === 'system' });
              $('showSel').value = 'new'; applyShowMode();
            }
            return { route, reach, govt, figure, light, saved, gates, bits, cleared: !/route/.test(location.hash) };
          })()`);
          await shot('features');
          // A mission and its storyline: from b147's panel to Take Polaris Home, its storyline, the places ringed.
          out.story = await p.evaluate(`(async () => {
            history.replaceState(null, '', '#galaxy'); applyHash(); await new Promise(r => setTimeout(r, 100));
            for (let i = 0; i < 200 && MOVING; i++) await new Promise(r => setTimeout(r, 50));
            const list = document.querySelectorAll('#panel [data-story]').length;
            VIEW.sel = { kind: 'bit', id: 147, back: null }; renderPanel();
            const ml = document.querySelector('#panel [data-mission="354"]');
            const o = { list, fromBit: !!ml };
            if (ml) {
              ml.click();
              const t = $('panel').textContent;
              Object.assign(o, { mission: document.querySelector('#panel h2').textContent, step: /Rebel I, step 22/.test(t), last: /its last/.test(t), offer: /The offer/.test(t), follows: !!document.querySelector('#panel [data-mission="353"]') });
              document.querySelector('#panel [data-story]').click();
              Object.assign(o, { story: document.querySelector('#panel h2').textContent, rows: document.querySelectorAll('#panel table.kv tr').length, ringed: (storyPlaces() || new Set()).size });
              draw();
            }
            return o;
          })()`);
          await shot('story');
          await p.evaluate(`(() => { VIEW.sel = null; renderPanel(); redraw(); })()`);
          // A nebula in the panel, from a view zoomed in elsewhere: the view
          // goes there without swinging away (it once flew thousands of units
          // off, the path reading the moving camera for its start).
          out.nebula = await p.evaluate(`(async () => {
            await setLayoutNow(null);
            if (VIEW.mode !== 'galaxy') await show('galaxy', {}, true);
            VIEW.sel = null; renderPanel();
            const n = U.nebulae.reduce((a, b) => (Math.hypot(b.x, b.y) > Math.hypot(a.x, a.y) ? b : a));
            Object.assign(CAM, { x: 120, y: 80, s: 3 }); draw();
            const log = [], d0 = draw; draw = function () { log.push({ ...CAM }); d0(); };
            const c0 = { ...CAM };
            document.querySelector('#panel [data-nebula="' + n.id + '"]').click();
            await new Promise(r => setTimeout(r, 80)); for (let i = 0; i < 200 && MOVING; i++) await new Promise(r => setTimeout(r, 50));
            draw = d0;
            const c1 = { ...CAM }, vx = c1.x - c0.x, vy = c1.y - c0.y, L2 = vx * vx + vy * vy || 1e-9, view = Math.max(CW / c0.s, CW / c1.s);
            let worst = 0;
            for (const f of log) { const t = Math.max(0, Math.min(1, ((f.x - c0.x) * vx + (f.y - c0.y) * vy) / L2)); worst = Math.max(worst, Math.hypot(f.x - c0.x - t * vx, f.y - c0.y - t * vy) / view); }
            return { id: n.id, frames: log.length, worst, sel: VIEW.sel };
          })()`);
          // The links coloured by government and by jumps from Sol, the names
          // hidden, and the nebulae moved with the subway map.
          out.options = await p.evaluate(`(async () => {
            const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
            $('linkSel').value = 'govt'; $('linkSel').onchange(); await frame();
            $('linkSel').value = 'jumps'; $('linkSel').onchange(); VIEW.sel = { kind: 'system', id: 130 }; renderPanel(); await frame();
            const jumps = { max: JUMPS.max, reached: JUMPS.map ? JUMPS.map.size : 0, shown: SHOWN.size, legend: $('legend').textContent, hidden: $('legend').hidden };
            $('optNames').checked = false; $('optNames').onchange(); await frame();
            $('optNames').checked = true; $('optNames').onchange();
            $('nebSel').value = 'none'; $('nebSel').onchange(); await frame();
            const nebulaHidden = nebulaAt(...toScreen(U.nebulae[0].x + U.nebulae[0].w / 2, U.nebulae[0].y + U.nebulae[0].h / 2)) === null;
            $('nebSel').value = 'pictures'; $('nebSel').onchange();
            $('linkSel').value = 'plain'; $('linkSel').onchange();
            const legendAfter = $('legend').hidden;
            await setLayoutNow('45');
            const moved = U.nebulae.filter(n => { const r = nebRect(n); return Math.abs(r.x - n.x) + Math.abs(r.y - n.y) + Math.abs(r.w - n.w) > 1; }).length;
            await setLayoutNow(null);
            return { jumps, legendAfter, moved, nebulae: U.nebulae.length, nebulaHidden };
          })()`);
          // The names: the system names all at one zoom, the stellars' at another, and the map with
          // room for names that keeps each link's heading.
          out.names = await p.evaluate(`(async () => {
            const idle = async () => { for (let i = 0; i < 200 && MOVING; i++) await new Promise(r => setTimeout(r, 50)); };
            await setLayoutNow(null);
            if (VIEW.mode !== 'galaxy') { await show('galaxy', {}, true); await idle(); }
            VIEW.sel = null; VIEW.hover = null; renderPanel();
            const t0 = performance.now(); NAME_PLAN = null; namePlan(); const planMs = Math.round(performance.now() - t0);
            const sol = PLACE_OF.get(130), vanished = [], moved = [], met = [], counts = [];
            let prev = new Map();
            // short of any disc opening, where a name is pushed out with its disc
            for (let s = GALAXY_HOME.s; s < 4; s *= 1.2) {
              Object.assign(CAM, { x: sol.x, y: sol.y, s }); draw();
              const now = new Map(LABELS_DRAWN.boxes.filter(b => !b.special).map(b => [b.id, b])), onScreen = new Set(DRAWN.map(d => d.sys.id));
              for (const [id, b] of prev) if (onScreen.has(id)) { const c = now.get(id); if (!c) vanished.push(id + ' at ' + s.toFixed(2)); else if (c.side !== b.side) moved.push(id + ' at ' + s.toFixed(2)); }
              const bs = [...now.values()];
              for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i], b = bs[j]; if (a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5) met.push(a.id + ' and ' + b.id + ' at ' + s.toFixed(2)); }
              counts.push(now.size); prev = now;
            }
            await show('system', { sys: 130 }, true); await idle(); draw();
            const inSol = { named: LABELS_DRAWN.stellars };
            await show('galaxy', {}, true); await idle();
            return { planMs, counts, vanished: vanished.slice(0, 5), moved: moved.slice(0, 5), met: met.slice(0, 5), inSol };
          })()`);
          out.namesHeading = await p.evaluate(`(async () => {
            history.replaceState(null, '', '#galaxy&subway=names,heading'); applyHash(); await subwayGet('names-heading'); await new Promise(r => setTimeout(r, 50));
            for (let i = 0; i < 200 && MOVING; i++) await new Promise(r => setTimeout(r, 50));
            const sol = PLACE_OF.get(130), nm = LAYOUT.sub.name(sol.tx, sol.ty);
            const out = { kind: LAYOUT.kind, hash: location.hash, stats: LAYOUT.sub.layout.stats, room: namesInRoom(), sol: nm && { align: nm.align, size: nm.size },
                          sel: [$('optSubway').checked, $('optFine').checked, $('optRoom').checked, $('optHeading').checked].join() };
            await setLayoutNow(null);
            return out;
          })()`);
          // Sol's wormhole (spöb 465, AnimDelay 2), 10,000 units out, in its pocket on Sol's disc in
          // Sol's first view, turning through its frames, and still once the stellars are off the screen.
          out.anim = await p.evaluate(`(async () => {
            const idle = async () => { for (let i = 0; i < 200 && MOVING; i++) await new Promise(r => setTimeout(r, 50)); };
            await show('system', { sys: 130 }); await idle();
            const sol = U.byId.get(130), [x, y] = stellarWorld(sol, U.stellars.get(465)), q = PLACE_OF.get(130);
            const pocket = +(Math.hypot(x - q.x, y - q.y) / q.rho).toFixed(2);
            const seen = new Set(), t0 = performance.now();
            while (performance.now() - t0 < 1500) { await new Promise(r => setTimeout(r, 30)); const a = STELLAR_ANIM.get(465); if (a) seen.add(a.cur); }
            const onScreen = ANIM_SEEN.has(465) && VIEW.sys === 130;
            await show('galaxy', {}, true); await idle();
            await new Promise(r => setTimeout(r, 200));
            const before = (STELLAR_ANIM.get(465) || {}).cur;
            await new Promise(r => setTimeout(r, 300));
            return { frames: seen.size, onScreen, pocket, off: { seen: ANIM_SEEN.size, ticking: ANIM_TICK !== null, still: (STELLAR_ANIM.get(465) || {}).cur === before } };
          })()`);
          // Stellars as you zoom in, off: Sol stays a dot however near, opens when gone to, and
          // closes again when zoomed out of; and the details hidden and shown.
          out.stellars = await p.evaluate(`(async () => {
            const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
            const idle = async () => { for (let i = 0; i < 200 && MOVING; i++) await new Promise(r => setTimeout(r, 50)); };
            if (VIEW.mode !== 'galaxy') { await show('galaxy', {}, true); await idle(); }
            $('optStellars').checked = false; $('optStellars').onchange();
            const sol = U.byId.get(130), goal = systemView(sol).s;
            Object.assign(CAM, { x: PLACE_OF.get(130).x, y: PLACE_OF.get(130).y, s: GALAXY_HOME.s }); redraw(); await frame();
            let most = 0;
            for (let i = 0; i < 120 && CAM.s < goal; i++) { zoomAt(CW / 2, CH / 2, 1.15); await frame(); const d = DRAWN.find(v => v.sys.id === 130); most = Math.max(most, d ? d.t : 0); }
            const near = { most, mode: VIEW.mode };
            await show('system', { sys: 130 }); await idle(); await frame();
            const d = DRAWN.find(v => v.sys.id === 130), went = { mode: VIEW.mode, sys: VIEW.sys, open: d ? d.t : null };
            for (let i = 0; i < 120 && CAM.s > GALAXY_HOME.s; i++) { zoomAt(CW / 2, CH / 2, 1 / 1.15); await frame(); }
            for (let i = 0; i < 60 && CAM.s < goal; i++) { zoomAt(CW / 2, CH / 2, 1.15); await frame(); }
            const d2 = DRAWN.find(v => v.sys.id === 130), after = { mode: VIEW.mode, open: d2 ? d2.t : null, kept: OPEN_SYS };
            $('optStellars').checked = true; $('optStellars').onchange();
            await show('galaxy', {}, true); await idle();
            const w0 = CW, h0 = CH;
            $('panelBtn').click(); await frame(); await frame();
            const bare = { w: CW, h: CH, panel: getComputedStyle($('panel')).display, pressed: $('panelBtn').getAttribute('aria-pressed') };
            $('panelBtn').click(); await frame(); await frame();
            return { near, went, after, w0, h0, bare, back: { w: CW, h: CH, panel: getComputedStyle($('panel')).display } };
          })()`);
          return out;
        } });
      for (const e of pageErrors(r.console)) fail(`${dev.name}: ${describe(e)}`);
      if (!r.met) { fail(`${dev.name}: ${v} did not finish opening in the page`); continue; }
      const o = r.more;
      if (!o.galaxy.shown || !o.galaxy.links) fail(`${dev.name}: the galaxy shows nothing`);
      const z = o.zoom;
      if (!z.inside.half || z.inside.half.mode !== 'galaxy' || z.inside.mode !== 'system' || z.inside.sys !== 130 || z.inside.open !== 1 || z.inside.hash !== '#system=130')
        fail(`${dev.name}: zooming in on Sol: ${JSON.stringify(z.inside)}`);
      if (z.after.mode !== 'galaxy' || z.after.sys !== null) fail(`${dev.name}: zooming out of Sol: ${JSON.stringify(z.after)}`);
      if (o.system.mode !== 'system' || !/Sol/.test(o.system.panel)) fail(`${dev.name}: going to Sol: ${JSON.stringify(o.system)}`);
      if (!o.planet.pict || o.planet.lit < 0.2) fail(`${dev.name}: landing on Earth: ${JSON.stringify(o.planet)}`);
      if (o.wide > 0) fail(`${dev.name}: the page is ${o.wide} px wider than the screen`);
      if (o.pinch.mode !== 'system' || o.pinch.sys !== 130 || o.pinch.page || o.pinch.hash !== '#system=130&stellar=128&at=1')
        fail(`${dev.name}: pinching in on Earth's landing page: ${JSON.stringify(o.pinch)}`);
      const sw = o.subway, so = o.subwayOff;
      if (sw.inSol.mode !== 'system' || sw.inSol.sys !== 130 || sw.inSol.mix !== 1 || !sw.inSol.moved || !/&subway$/.test(sw.inSol.hash))
        fail(`${dev.name}: the subway map, switched to in Sol: ${JSON.stringify(sw.inSol)}`);
      if (sw.galaxy.mode !== 'galaxy' || sw.galaxy.stats.failed || !sw.galaxy.bent || !/^#galaxy.*&subway$/.test(sw.galaxy.hash))
        fail(`${dev.name}: the subway map's galaxy: ${JSON.stringify(sw.galaxy)}`);
      if (sw.fine.kind !== 'fine' || sw.fine.mix !== 1 || !/&subway=22\.5$/.test(sw.fine.hash) || sw.fine.sel !== 'true,true,false' || sw.fine.stats.failed || sw.fine.stats.loose)
        fail(`${dev.name}: the 22.5-degree map: ${JSON.stringify(sw.fine)}`);
      const nm = sw.names;
      if (nm.kind !== 'names' || !/&subway=names$/.test(nm.hash) || nm.stats.failed || !nm.room || !nm.sol || !nm.sol.side)
        fail(`${dev.name}: the map with room for names: ${JSON.stringify(nm)}`);
      const bo = sw.both;
      if (bo.kind !== 'names-fine' || !/&subway=names,22\.5$/.test(decodeURIComponent(bo.hash)) || bo.stats.failed || bo.stats.loose || !bo.room || bo.sel !== 'true,true,true')
        fail(`${dev.name}: 22.5 degrees with room for names: ${JSON.stringify(bo)}`);
      if (bo.late > 500) fail(`${dev.name}: the page stood still ${bo.late} ms while a map was worked out`);
      if (!bo.noteShown || !bo.noteGone || !/files open/.test(bo.status)) fail(`${dev.name}: the note while a map is worked out, and the status after: ${JSON.stringify(bo)}`);
      if (so.off.mix !== 0 || /subway/.test(so.off.hash) || so.off.sel !== 'false,true') fail(`${dev.name}: back to true positions: ${JSON.stringify(so.off)}`);
      if (so.byHash.mix !== 1 || so.byHash.mode !== 'system' || so.byHash.sys !== 130 || so.byHash.sel !== 'true,false,false') fail(`${dev.name}: the subway map from the address: ${JSON.stringify(so.byHash)}`);
      const hd = so.heading;
      if (hd.kind !== 'heading' || hd.mix !== 1 || !/&subway=heading$/.test(hd.hash) || hd.sel !== 'true,false,false,true' || hd.stats.failed || !(hd.stats.astray < 12))
        fail(`${dev.name}: the map that keeps each link's heading, from the address: ${JSON.stringify(hd)}`);
      const mx = so.mixed;
      if (mx.kind !== 'fine-mixed-heading' || mx.mix !== 1 || !/&subway=22\.5,mixed,heading$/.test(decodeURIComponent(mx.hash)) || mx.sel !== 'true,true,false,true' || mx.stats.failed || mx.stats.loose || !(mx.stats.bars >= 1) || !mx.bar || !mx.picked)
        fail(`${dev.name}: 22.5 degrees only where needed, keeping headings, from the address: ${JSON.stringify(mx)}`);
      const ft = o.features;
      if (!ft.route.steps || ft.route.jumps !== ft.route.want || !ft.route.panel || !/&route=130-\d+/.test(ft.route.hash) || !ft.cleared ||
          !ft.route.gatedSteps || !(ft.route.gated < ft.route.gateJumps) || !ft.route.byGate || !ft.route.named)
        fail(`${dev.name}: the route from Sol to its furthest system: ${JSON.stringify(ft)}`);
      if (ft.reach.lit !== ft.reach.near || ft.reach.lit >= ft.reach.all || ft.reach.lit < 2) fail(`${dev.name}: within 2 jumps of Sol: ${JSON.stringify(ft.reach)}`);
      if (!ft.govt.on || !ft.govt.off) fail(`${dev.name}: the systems in one colour: ${JSON.stringify(ft.govt)}`);
      if (!ft.figure.none || !ft.figure.some || !ft.figure.key) fail(`${dev.name}: the systems coloured by radar interference: ${JSON.stringify(ft.figure)}`);
      if (ft.light.lit !== ft.light.yards || !(ft.light.lit > 0 && ft.light.lit < ft.light.all) || !ft.light.key) fail(`${dev.name}: only systems with a shipyard lit: ${JSON.stringify(ft.light)}`);
      if (!ft.saved || ft.saved.type !== 'image/png' || !(ft.saved.size > 10000) || !/\.png$/.test(ft.saved.name)) fail(`${dev.name}: the map saved as a picture: ${JSON.stringify(ft.saved)}`);
      const gt = ft.gates;
      if (!(gt.links > 0) || gt.random !== gt.want || !(gt.want > 0) || !gt.sol || !gt.kania || gt.kaniaRandom !== 0 || gt.off !== 0) fail(`${dev.name}: hypergates and wormholes: ${JSON.stringify(gt)}`);
      const bt = ft.bits;
      if (!bt.link || bt.title !== 'b147' || !bt.setter || !bt.needs || bt.mode !== 'bits' || bt.typed !== 'b147' || !bt.changed || !bt.still || !bt.off || !bt.back)
        fail(`${dev.name}: b147 from Sol's visibility: ${JSON.stringify(bt)}`);
      console.log(`${dev.name}: ${gt.links} ways by hypergate or wormhole drawn, and ${gt.random} from Sol's wormhole to random others`);
      console.log(`${dev.name}: a route from Sol of ${ft.route.jumps} jumps; from Kania to ${ft.route.gateTo} ${ft.route.gateJumps} jumps, or ${ft.route.gated} steps by hypergate; ${ft.reach.lit} of ${ft.reach.all} places within 2 jumps of Sol lit; the systems in one colour and by radar interference; ${ft.light.lit} places with a shipyard lit; the map saved as a ${Math.round(ft.saved.size / 1024)} KB PNG`);
      const dt = so.dots;
      if (dt.kind !== 'heading-dots' || !/&subway=heading,dots$/.test(decodeURIComponent(dt.hash)) || dt.stats.bars !== 0 || dt.bar || dt.sel !== 'false,false' || dt.back !== 'heading' || !/&subway=heading$/.test(dt.backHash) || !dt.backBar)
        fail(`${dev.name}: busy stations as points, from the address, and bars again from the switch: ${JSON.stringify(dt)}`);
      const na = o.names, nh = o.namesHeading;
      if (na.vanished.length || na.moved.length || na.met.length || !Math.max(...na.counts)) fail(`${dev.name}: the system names zooming in on Sol: ${JSON.stringify(na)}`);
      if (!na.inSol.named) fail(`${dev.name}: Sol's stellars named when gone to: ${JSON.stringify(na.inSol)}`);
      if (nh.kind !== 'names-heading' || !/&subway=names,heading$/.test(decodeURIComponent(nh.hash)) || nh.sel !== 'true,false,true,true' || nh.stats.failed || !(nh.stats.unnamed < 8) || !nh.room || !nh.sol)
        fail(`${dev.name}: room for names keeping headings, from the address: ${JSON.stringify(nh)}`);
      const an = o.anim;
      if (!(an.frames >= 10) || !an.onScreen || an.pocket !== 1.16 || an.off.seen || an.off.ticking || !an.off.still) fail(`${dev.name}: Sol's wormhole animating: ${JSON.stringify(an)}`);
      console.log(`${dev.name}: Sol's wormhole in its pocket in Sol's first view, ${an.frames} frames in 1.5 s, and stopped off the screen`);
      const st = o.stellars;
      if (st.near.most !== 0 || st.near.mode !== 'galaxy') fail(`${dev.name}: without the stellars, zooming in on Sol: ${JSON.stringify(st.near)}`);
      if (st.went.mode !== 'system' || st.went.sys !== 130 || st.went.open !== 1) fail(`${dev.name}: without the stellars, going to Sol: ${JSON.stringify(st.went)}`);
      if (st.after.mode !== 'galaxy' || st.after.open !== 0 || st.after.kept !== null) fail(`${dev.name}: without the stellars, out of Sol and in again: ${JSON.stringify(st.after)}`);
      const roomy = dev.mobile ? st.bare.h > st.h0 && st.bare.w === st.w0 : st.bare.w > st.w0 && st.bare.h === st.h0;
      if (!roomy || st.bare.panel !== 'none' || st.bare.pressed !== 'false' || st.back.w !== st.w0 || st.back.h !== st.h0 || st.back.panel === 'none')
        fail(`${dev.name}: hiding and showing the details: ${JSON.stringify(st)}`);
      const sy = o.story;
      if (!(sy.list > 20) || !sy.fromBit || sy.mission !== 'Take Polaris Home' || !sy.step || !sy.last || !sy.offer || !sy.follows || sy.story !== 'Rebel I' || !(sy.rows >= 15) || !(sy.ringed > 3))
        fail(`${dev.name}: the mission Take Polaris Home and its storyline: ${JSON.stringify(sy)}`);
      console.log(`${dev.name}: ${sy.list} storylines listed; Take Polaris Home from b147, Rebel I's step 22 and last; Rebel I's ${sy.rows} missions, ${sy.ringed} places ringed`);
      const nb = o.nebula, op = o.options;
      if (!nb.frames || nb.worst > 0.5 || !nb.sel || nb.sel.kind !== 'nebula') fail(`${dev.name}: going to a nebula from the panel: ${JSON.stringify(nb)}`);
      if (!(op.jumps.max > 1) || op.jumps.reached < op.jumps.shown / 2 || op.jumps.hidden || !/^Jumps from Sol/.test(op.jumps.legend) || !op.legendAfter)
        fail(`${dev.name}: the links by jumps from Sol: ${JSON.stringify(op.jumps)}, legend hidden after: ${op.legendAfter}`);
      if (op.moved !== op.nebulae) fail(`${dev.name}: ${op.moved} of ${op.nebulae} nebulae moved with the subway map`);
      if (!op.nebulaHidden) fail(`${dev.name}: a hidden nebula can still be tapped`);
      console.log(`${dev.name}: nebula ${nb.id} from the panel in ${nb.frames} frames, never more than ${nb.worst.toFixed(2)} of a view off the way;` +
                  ` Sol ${op.jumps.max} jumps from its furthest, ${op.jumps.reached} of ${op.jumps.shown} systems reached; ${op.moved} nebulae moved with the subway map`);
      console.log(`${dev.name}: the map with room for names worked out in ${(nm.ms / 1000).toFixed(1)} s, Sol's name ${nm.sol.side > 0 ? 'right' : 'left'} of it; 22.5 degrees with it in ${(sw.both.bgMs / 1000).toFixed(1)} s in the background, the page answering within ${sw.both.late} ms`);
      console.log(`${dev.name}: the subway map worked out in ${(sw.ms / 1000).toFixed(1)} s, ${sw.galaxy.bent} of ${sw.galaxy.drawn} links shown with a bend; switched in Sol, to 22.5 degrees and back, and from the address; keeping headings from the address, ${hd.stats.astray} links off them`);
      console.log(`${dev.name}: the system names placed in ${na.planMs} ms; zooming in on Sol, ${na.counts.join(', ')} names on the screen, none gone, moved or meeting another; ${na.inSol.named} stellar names in Sol; room for names keeping headings from the address, ${nh.stats.astray} links off them, ${nh.stats.smaller} names smaller, ${nh.stats.unnamed} with no room`);
      console.log(`${dev.name}: without the stellars Sol stays a dot zoomed in, opens when gone to and closes zoomed out of; the details hidden give the map ${dev.mobile ? st.bare.h - st.h0 + ' px more height' : st.bare.w - st.w0 + ' px more width'}`);
      console.log(`${dev.name}: ${v} open in ${(r.ms / 1000).toFixed(1)} s; ${o.galaxy.shown} systems and ${o.galaxy.links} links shown;` +
                  ` in Sol after ${z.inside.steps} zoom steps, and out again; pinched out of Earth's page;` +
                  ` ${o.system.crumbs}; Earth's landing picture ${o.planet.pict}, ${Math.round(o.planet.lit * 100)}% lit; ${o.planet.hash}`);
    }
  }

  // The ships, from 1.0.10's archive, whose ships files the page reads only
  // when the ships are first looked at.
  const sit = RELEASES['1.0.10'].sit;
  if (!haveRelease('1.0.10')) console.log('SKIP the ships: no 1.0.10 in reference/');
  else for (const dev of [{ name: 'desktop', width: 1280, height: 800, scale: 1 }, { name: 'phone', width: 412, height: 915, scale: 2.6, mobile: true }]) {
    const r = await loadPage(srv.base + 'index.html?src=' + encodeURIComponent('reference/' + sit) + '#ship=154',
      'typeof SHIPS !== "undefined" && SHIPS.on && !PUMPING && PENDING.length === 0 && SHIP_FILES.length === 0 && GAME.list("shän").length > 0', 300000, { chrome, device: dev,
      then: async p => {
        const shot = async n => { if (shots) await p.shot(path.join(shots, `${dev.name}-${n}.png`)); };
        const wait = ms => new Promise(r => setTimeout(r, ms));
        const out = {};
        for (let i = 0; i < 40 && await p.evaluate("document.querySelectorAll('canvas.thumb:not(.done)').length > 0 || !document.getElementById('shipCanvas')"); i++) await wait(250);
        await wait(500);
        // Light in the ship's box, at one frame with the engines off and on.
        const lit = "(() => { const c = document.getElementById('shipCanvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0, sum = 0; for (let i = 0; i < d.length; i += 4) { const v = d[i] + d[i + 1] + d[i + 2]; if (v > 40) n++; sum += v; } return { n, sum }; })()";
        out.list = await p.evaluate("({ rows: document.querySelectorAll('.shipRow').length, drawn: document.querySelectorAll('canvas.thumb.done').length, ships: GAME.list('shïp').length, on: (document.querySelector('.shipRow.on') || { dataset: {} }).dataset.ship })");
        out.turn = await p.evaluate("(async () => { const a = SHIP_ANIM.heading; await new Promise(r => setTimeout(r, 600)); return { a, b: SHIP_ANIM.heading, spin: SHIP_ANIM.spin }; })()");
        await shot('ship');
        await p.evaluate("SHIP_ANIM.spin = false; SHIP_ANIM.heading = 16; drawShip(SHIP_ANIM, document.getElementById('shipCanvas'))");
        out.off = await p.evaluate(lit);
        await p.evaluate("document.querySelector('#shipCtl [data-c=glow]').click()");
        out.on = await p.evaluate(lit);
        out.pics = await p.evaluate("[...document.querySelectorAll('#shipPics figure')].map(f => !!f.querySelector('canvas'))");
        out.wide = await p.evaluate('document.documentElement.scrollWidth - window.innerWidth');
        out.picked = await p.evaluate("getComputedStyle(document.getElementById('shipList')).display");
        await p.evaluate("document.getElementById('shipView').scrollTop = 900");
        await shot('ship-tables');
        if (dev.mobile) {
          await p.evaluate("document.querySelector('#crumbs [data-ships=list]').click()");
          await wait(300);
          out.list2 = await p.evaluate("({ hash: location.hash, list: getComputedStyle(document.getElementById('shipList')).display, view: getComputedStyle(document.getElementById('shipView')).display })");
          await shot('ships');
          await p.evaluate("history.back()");
          await wait(500);
        }
        await p.evaluate("document.querySelector('#views [data-view=map]').click()");
        await wait(300);
        out.map = await p.evaluate("({ hash: location.hash, app: !document.getElementById('app').hidden, ships: !document.getElementById('ships').hidden })");
        await p.evaluate('history.back()');
        await wait(800);
        out.back = await p.evaluate("({ hash: location.hash, on: SHIPS.on, id: SHIPS.id, canvas: !!document.getElementById('shipCanvas') })");
        out.yard = await p.evaluate(`(async () => {
          const a = document.querySelector('#shipView [data-stellar]');
          if (!a) return null;
          const id = +a.dataset.stellar;
          a.click();
          for (let i = 0; i < 60 && MOVING; i++) await new Promise(r => setTimeout(r, 100));
          return { id, sel: VIEW.sel, mode: VIEW.mode, on: SHIPS.on, hash: location.hash };
        })()`);
        return out;
      } });
    for (const e of pageErrors(r.console)) fail(`ships, ${dev.name}: ${describe(e)}`);
    if (!r.met) { fail(`ships, ${dev.name}: the ships files did not finish opening`); continue; }
    const o = r.more;
    if (o.list.rows !== o.list.ships || o.list.drawn !== o.list.rows || o.list.on !== '154') fail(`ships, ${dev.name}: the list: ${JSON.stringify(o.list)}`);
    if (!o.turn.spin || o.turn.a === o.turn.b) fail(`ships, ${dev.name}: the Aurora Cruiser does not turn: ${JSON.stringify(o.turn)}`);
    if (o.off.n < 500) fail(`ships, ${dev.name}: the Aurora Cruiser is not drawn: ${o.off.n} lit pixels`);
    if (!(o.on.sum > o.off.sum)) fail(`ships, ${dev.name}: the engines add no light: ${o.off.sum} off, ${o.on.sum} on`);
    if (o.pics.length !== 3 || o.pics.some(x => !x)) fail(`ships, ${dev.name}: its pictures: ${JSON.stringify(o.pics)}`);
    if (o.wide > 0) fail(`ships, ${dev.name}: the page is ${o.wide} px wider than the screen`);
    if (dev.mobile && (o.picked !== 'none' || o.list2.hash !== '#ships' || o.list2.list === 'none' || o.list2.view !== 'none')) fail(`ships, phone: the list and the ship do not take turns: ${o.picked}, ${JSON.stringify(o.list2)}`);
    if (!o.map.app || o.map.ships || !/^#galaxy/.test(o.map.hash)) fail(`ships, ${dev.name}: the Map switch: ${JSON.stringify(o.map)}`);
    if (!o.back.on || o.back.id !== 154 || !o.back.canvas || o.back.hash !== '#ship=154') fail(`ships, ${dev.name}: Back from the map: ${JSON.stringify(o.back)}`);
    if (!o.yard || o.yard.on || o.yard.mode !== 'system' || !o.yard.sel || o.yard.sel.id !== o.yard.id) fail(`ships, ${dev.name}: a shipyard link: ${JSON.stringify(o.yard)}`);
    console.log(`ships, ${dev.name}: ${o.list.rows} ship classes listed and drawn; the Aurora Cruiser turns, ${o.off.n} pixels lit,` +
                ` the engines add ${Math.round((o.on.sum / o.off.sum - 1) * 100)}% light; ${o.pics.length} pictures;` +
                ` Map and Back; its first shipyard, spöb ${o.yard.id}, opens on the map at ${o.yard.hash}`);
  }

  // The Community Edition's zip of .rez files, and a plug-in chosen out of
  // a zip that holds several.
  const ce = 'reference/game/EV_Nova_Community_Edition.zip', gp = "reference/game/extras/Geek's Planets.zip";
  if (!fs.existsSync(path.join(ROOT, ce))) console.log('SKIP the Community Edition: not in reference/game');
  else {
    const r = await loadPage(srv.base + 'index.html?src=' + encodeURIComponent(ce), 'typeof U !== "undefined" && U && !PUMPING && PENDING.length === 0', 240000, { chrome,
      then: async p => {
        const out = { shown: await p.evaluate('SHOWN.size'), files: await p.evaluate('GAME.files.length') };
        if (fs.existsSync(path.join(ROOT, gp))) {
          const bytes = fs.readFileSync(path.join(ROOT, gp)).toString('base64');
          await p.evaluate(`(() => { const b = Uint8Array.from(atob(${JSON.stringify(bytes)}), c => c.charCodeAt(0)); openGameFiles([{ name: "Geek's Planets.zip", bytes: b }]); })()`);
          for (let i = 0; i < 40 && !(await p.evaluate("!document.getElementById('choose').hidden")); i++) await new Promise(r => setTimeout(r, 250));
          out.offered = await p.evaluate("document.querySelectorAll('#choose input').length");
          await p.evaluate("document.querySelector('#choose input').click(); document.querySelector('#choose [data-a=ok]').click()");
          for (let i = 0; i < 40 && (await p.evaluate('GAME.files.length')) === out.files; i++) await new Promise(r => setTimeout(r, 250));
          out.after = await p.evaluate('({ files: GAME.files.length, plugins: GAME.files.filter(f => f.plugin).map(f => f.name), shown: SHOWN.size })');
        }
        return out;
      } });
    for (const e of pageErrors(r.console)) fail(`the Community Edition: ${describe(e)}`);
    if (!r.met) fail('the Community Edition did not open');
    else {
      const o = r.more;
      if (!o.shown) fail('the Community Edition shows no systems');
      let line = `the Community Edition's zip: ${o.files} files, ${o.shown} systems shown`;
      if (o.offered !== undefined) {
        if (!(o.offered > 1) || !o.after || o.after.plugins.length !== 1) fail(`choosing a plug-in out of Geek's Planets: ${JSON.stringify(o)}`);
        else line += `; Geek's Planets offered ${o.offered} plug-ins and opened the one ticked`;
      }
      console.log(line);
    }
  }
} finally {
  srv.close();
}
process.exit(fails ? 1 : 0);
