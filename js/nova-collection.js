/* nova-collection.js -- the community's plug-ins, as on archive.org.
   =========================================================================

   The bar's Plug-ins shows the files in three archive.org items, for a
   visitor to open into the game from there: the page publishes none of
   them. EscapeVelocityPluginCollection is Ambrosia's add-on files whole:
   its EVN.zip has the Nova plug-ins and cheats, each beside a .txt of
   the add-on page's title, size and author, date, downloads and text, and
   its Extras folder the conversions, among them the ports of EV and EV
   Override that the other two items need. ev_20250301 and EVO_Ported are
   EV's and EV Override's plug-ins ported to Nova, each a .rez in a zip.

   archive.org gives a zip's contents as a page of HTML (novaCollectionZip)
   and an item's files as JSON (novaCollectionItem), and hands out any one
   file, from an item or from inside its zip, at its /cors/ address, which
   a page on another site can fetch. reference/archive-org has both
   listings as they were taken, and collection_check compares this reading of
   them with the copies in reference/game/collections.

   PURE: no DOM. LOAD ORDER: anywhere; page-collection.js uses it. */

const NOVA_COLLECTION_BASE = 'https://archive.org/cors/';
// What a plug-in is not: a readme, a picture, a program, or what archive.org made from a file.
const NOVA_COLLECTION_NOT = /\.(txt|pdf|docx?|rtf|html?|exe|rar|7z|gz|png|jpe?g|gif|mp3|ogg|afpk|xml|sqlite|torrent|DS_Store)$/i;

const NOVA_COLLECTIONS = [
  { key: 'nova', label: 'Nova plug-ins', item: 'EscapeVelocityPluginCollection', zip: 'EVN.zip', within: /^EVN\/(Plugins|Cheats)\//, strip: 'EVN/',
    note: "Ambrosia's add-on files for EV Nova, kept whole: the plug-ins and the cheats. A plug-in's description is the add-on page's, as written." },
  { key: 'extras', label: 'Conversions', item: 'EscapeVelocityPluginCollection', within: /^Extras\/(?!Plugin Converters\/)/, strip: 'Extras/', packages: true,
    note: 'The total conversions kept beside them, and the ports of EV and EV Override that the two sets of ports need.' },
  { key: 'ev', label: 'EV ports', item: 'ev_20250301', within: /^(Plugins|Cheats|Scenarios)\//,
    note: 'EV\'s plug-ins ported to Nova. The notes in their archive say each needs "a port of EV Classic for the base Nova Files folder", as EV_Classic_for_Nova under Conversions is, and that they are "not fully debugged".' },
  { key: 'evo', label: 'Override ports', item: 'EVO_Ported', within: /^EVO\/(Plugins|Cheats)\//, strip: 'EVO/',
    note: 'EV Override\'s plug-ins ported to Nova. The notes in their archive say each needs "a port of EV Override for the base Nova Files folder", as EV_Override_for_Nova under Conversions is, and that they are "not fully debugged".' },
];

const novaCollectionUrl = (...parts) => NOVA_COLLECTION_BASE + parts.join('/').split('/').map(encodeURIComponent).join('/');
const novaCollectionUnescape = s => s.replace(/&(amp|lt|gt|quot|#39|#x27);/g, (m, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", '#x27': "'" })[e]);

/* A collection's plug-ins as [{ path, name, folder, size, url, about }]:
   `folder` without the item's top folder or the one-letter folders the
   ports are sorted into, `about` the address of its description, where it
   has one. */
function novaCollectionEntries(c, files) {
  const out = [];
  for (const { path, size } of files) {
    if (!c.within.test(path) || path.endsWith('/') || NOVA_COLLECTION_NOT.test(path)) continue;
    const at = path.lastIndexOf('/');
    const folder = path.slice(c.strip ? c.strip.length : 0, at).split('/').filter(d => d.length > 1).join('/');
    out.push({ path, name: path.slice(at + 1), folder, size,
               url: c.zip ? novaCollectionUrl(c.item, c.zip, path) : novaCollectionUrl(c.item, path), about: null });
  }
  if (c.zip) {
    // the description beside a plug-in: its name, less one extension at a time, and .txt
    const txt = new Set(files.map(f => f.path).filter(p => /\.txt$/i.test(p)));
    for (const e of out) {
      for (let s = e.path; ; ) {
        if (txt.has(s + '.txt')) { e.about = novaCollectionUrl(c.item, c.zip, s + '.txt'); break; }
        const dot = s.lastIndexOf('.');
        if (dot <= s.lastIndexOf('/')) break;
        s = s.slice(0, dot);
      }
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
}

/* A set whose folders are packages (the conversions: Polycon v2's Nova
   Files is eleven parts of one game) as [{ folder, files }], by folder, a
   folder of one file a package of one. Some folders hold alternatives
   instead (EV_EVO on Nova, the Full Screen Map's sizes), so the page
   lets a package's files be ticked one by one too. */
function novaCollectionPackages(entries) {
  const by = new Map();
  for (const e of entries) { if (!by.has(e.folder)) by.set(e.folder, []); by.get(e.folder).push(e); }
  return [...by].sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base', numeric: true })).map(([folder, files]) => ({ folder, files }));
}

// archive.org's page of a zip's contents: [{ path, size }].
function novaCollectionZip(html) {
  const out = [];
  for (const m of html.matchAll(/<a href="[^"]*">([^<]+)<\/a><td><td>[^<]*<td id="size">(\d*)/g)) out.push({ path: novaCollectionUnescape(m[1]), size: +m[2] || 0 });
  return out;
}
// archive.org's JSON of an item: its files, not those it made from them ([{ path, size }]).
function novaCollectionItem(json) {
  return (json.files || []).filter(f => f.source === 'original').map(f => ({ path: f.name, size: +f.size || 0 }));
}

/* A description as the add-on page had it: the plug-in's title, its size
   and author ("1.50 MB | By Equalizer"), Created, Category and Downloads,
   a blank line, then the text. { head: [line...], text } or, where it is
   not that shape, all of it as the text. */
function novaCollectionAbout(s) {
  const lines = s.replace(/\r\n?/g, '\n').split('\n'), gap = lines.indexOf('');
  if (gap < 2 || gap > 8 || !/ \| By /.test(lines[1])) return { head: [], text: s.trim() };
  return { head: lines.slice(0, gap).filter(l => !/^Category: /.test(l)), text: lines.slice(gap + 1).join('\n').trim() };
}
