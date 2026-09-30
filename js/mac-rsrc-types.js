/* mac-rsrc-types.js -- decoders for the resource types a classic Mac file
 * actually contains: PICT, snd, NFNT, clut, cicn, crsr, ICN#, STR#, vers,
 * DITL, MENU, cfrg, CODE and the rest.
 *
 * These were the whole of the retired resource fork browser page, a separate page that
 * opened any classic Mac resource fork. That page is gone. It was more
 * general-purpose than this repository, and everything in it that Cythera
 * needs is here instead: both of Cythera's files are stuffed with these types
 * -- "Cythera Data" has 18 of them across 113 resources, and the application
 * has 52 across 339 -- so index.html reads its own resource fork with the
 * same decoders rather than sending anyone to a second tool.
 *
 * GENERIC TIER. Nothing here knows Cythera exists; this belongs beside the
 * other mac-* modules, not beside delv-*. It is Apple's formats, and the
 * palettes near the middle are Apple's standard 4- and 8-bit tables, which are
 * NOT the same thing as Cythera's own CLUT in delv-graphics.js.
 *
 * These decoders take bytes and return a value: a string, a record, or a
 * canvas already drawn. The canvas ones are the exception to the usual rule
 * that drawing stays in the page, and they earn it -- utilities/
 * rsrc_snapshot.mjs hashes what they draw, pixel for pixel, so they are as
 * checkable as the ones that return text. What is NOT here is the page's own
 * furniture: the panes, the ids, the file input. That is index.html's job.
 *
 * TWO RENAMES on the way in, because the two pages were never loaded together
 * and each had a function the other also had. A function declaration in a
 * classic script is a global binding, so the later file would simply have won:
 *
 *   samplesToWav -> pcmToWavBlob   explorer's takes (rate, samples) and
 *                                  returns bytes; this one takes
 *                                  (samples, rate, bits, channels) and returns
 *                                  a Blob. Reversed arguments, silently.
 *   hexDump      -> rsrcHexDump    js/delv-archive.js has one with a different
 *                                  offset width and no length argument.
 *
 * CLASSIC SCRIPT -- no `type="module"`. See js/mac-bytes.js for why.
 * LOAD ORDER: after mac-bytes.js and mac-media.js, whose readers and WAV
 * writer this uses; mac-resfork.js opens the fork these decode the contents of.
 */

// ============================================================
//  Bulk export: every resource, raw and decoded, as one .zip
// ============================================================
// Store-only (method 0). Deflate would need a compressor; the point here is
// getting a whole fork out in one click, and PNG/WAV payloads barely compress.
// crc32 and buildZip are in js/mac-export.js -- the data viewer grew the same
// store-only ZIP writer, field for field.
// Remember the palette indices a canvas was drawn from, so it can be saved as
// a real indexed PNG instead of being re-photographed as truecolour. A canvas
// drawn through a 1-bit mask keeps its alpha and is left alone: PNG's tRNS can
// make one palette slot transparent, not an arbitrary shape.
function tagIndexed(canvas, W, H, indices, palette, maskBits){
  if(maskBits) return canvas;
  canvas.__indexed = {W, H, indices, palette};
  return canvas;
}

// What files can this resource become? One list, so the ZIP export and the
// preview cannot drift apart about which types are decodable.
/* The engine's light cones.

   25 `Lite` resources in the application's fork, listed and unread until
   7 September 2026. One byte of side, then side x side bytes of brightness,
   0 to 32: 32 at the middle, falling to 1 or 2 at the edge of the circle and
   0 in the corners outside it. Two families -- 128-133 at sides 10 to 22, and
   140-158 stepping 8, 14, 20, 26 up to 120 -- which is a torch, a lamp, a
   spell and the rest, by their reach in half-squares.

   Drawn here as the shape it is, so a reader can see the falloff rather than
   read that one exists. The map's lighting layer still draws its own
   gradients; joining these to it needs the rule that picks a table for a
   light, which is not read yet. */
function decodeLite(data){
  if(!data||data.length<2) return null;
  const n=data[0];
  if(!n||data.length!==1+n*n) return null;
  const c=document.createElement('canvas');
  c.width=n; c.height=n;
  const ctx=c.getContext('2d');
  if(!ctx) return null;
  const img=ctx.createImageData(n,n);
  let mx=0; for(let i=1;i<data.length;i++) if(data[i]>mx) mx=data[i];
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){
    const v=data[1+y*n+x], p=(y*n+x)*4, t=mx?v/mx:0;
    // A light, so warm rather than grey: the game's torchlight.
    img.data[p]=Math.round(255*Math.min(1,t*1.1));
    img.data[p+1]=Math.round(226*t);
    img.data[p+2]=Math.round(150*t*t);
    img.data[p+3]=255;
  }
  ctx.putImageData(img,0,0);
  const mid=n>>1;
  const row=[]; for(let x=0;x<n;x++) row.push(data[1+mid*n+x]);
  return { canvas:c, side:n, max:mx, centre:data[1+mid*n+mid],
    text:'A light cone '+n+' squares across, brightness 0 to '+mx+'.\n'+
      'Middle row: '+row.join(' ')+'\n\n'+
      Array.from({length:n},(_,y)=>Array.from({length:n},(_,x)=>{
        const v=data[1+y*n+x];
        return v===0?' ':v>=mx*0.75?'#':v>=mx*0.5?'+':v>=mx*0.25?'.':'·';
      }).join('')).join('\n') };
}

/* The one Delver graphic that lives in a Macintosh resource fork.

   `TILE` 282 in the application's fork is a Delver Compressed Graphics tile
   sheet -- the same 32x512 column of sixteen 32x32 tiles as the 160 sheets
   under subindex 141 of the archive, and the only resource of its type in
   either fork. It was listed and unread until 7 September 2026, though every
   piece needed to draw it was already here.

   Its art is not the game's. Comparing all sixteen tiles against the 2,376
   distinct tiles in the archive's sheets, only the two solid black ones match:
   the other fourteen -- banded walls, a lattice frieze, pillars, a starfield,
   grey stone, lava, foliage, panel frames and a pair of arrows -- appear
   nowhere in Cythera. It is art the executable carries and the shipped
   scenario never draws. It uses the animated palette slots (0xE8, 0xEC, 0xEE
   in the water cycle, and 0xF1, 0xF8), so whoever drew it was working to the
   engine's own conventions.

   Drawn as the 4x4 grid the tile-sheet galleries use, with index 0
   transparent, which is what `transparentIndexFor(141)` says for a sheet out
   of the archive. The delv-* tier owns the format; this reaches across to it
   rather than carrying a second copy, and feature-tests first so that the
   mac-* tier still loads on its own. */
function decodeTileSheetResource(data){
  if(typeof decompressDCG!=='function'||typeof reshapeTileSheetGrid!=='function'||
     typeof PAL_RGB==='undefined') return null;
  let strip; try { strip = decompressDCG(data, 32, 512); } catch(e){ return null; }
  if(!strip||strip.length!==32*512) return null;
  const g = reshapeTileSheetGrid(32, 512, strip);
  const c=document.createElement('canvas'); c.width=g.W; c.height=g.H;
  const ctx=c.getContext('2d'); if(!ctx) return null;
  const img=ctx.createImageData(g.W,g.H);
  for(let i=0;i<g.W*g.H;i++){
    const v=g.image[i], p=i*4;
    if(v===0){ img.data[p+3]=0; continue; }
    const col=PAL_RGB[v]||[0,0,0];
    img.data[p]=col[0]; img.data[p+1]=col[1]; img.data[p+2]=col[2]; img.data[p+3]=255;
  }
  ctx.putImageData(img,0,0);
  const used=new Set(strip); const anim=[...used].filter(v=>v>=0xE0&&v<=0xFB).sort((a,b)=>a-b);
  return { canvas:tagIndexed(c,g.W,g.H,g.image,PAL_RGB), indices:strip,
    text:'A Delver tile sheet: sixteen 32×32 tiles stored as one 32×512 column, '+
      'shown as the 4×4 grid.\n'+used.size+' colours from the game’s palette'+
      (anim.length?'; '+anim.length+' in the animated range ('+
        anim.map(v=>'0x'+v.toString(16).toUpperCase()).join(', ')+')':'')+'.' };
}

/* Text styles. Cythera's own type, in both forks: one byte of point size, one
   byte of QuickDraw face bits, then a Pascal string naming the family. The
   application's eight are the Mac faces the game falls back to (Chicago,
   Geneva, Espy Sans); the data file's twelve name ArgosANouveau, Geneva and
   Seldane, and the resource names say what each is for -- "Sys Large",
   "Labels", "Stats", "Text", "Lang0 Small".

   One is not a style at all. `TxSt` 999 in the data fork is four bytes with no
   room for the name a style needs, and the fork says why: `RMAP` 128, itself
   named "TxSt", declares that id 999 in type `TxSt` is really a `TxCl`. Its
   four bytes are palette indices, drawn here as the swatches they are. */
function decodeTxSt(data){
  if(!data||data.length<3) return null;
  const size=data[0], face=data[1], n=data[2];
  if(3+n!==data.length) return null;
  const bits=FACE_BITS.filter(([b])=>face&b).map(([,x])=>x);
  return { size, face, font:decodeMacRoman(data.slice(3,3+n)),
    text:decodeMacRoman(data.slice(3,3+n))+', '+size+' pt, '+(bits.length?bits.join('+'):'plain') };
}
function decodeTxCl(data){
  if(!data||typeof PAL_RGB==='undefined') return null;
  const c=document.createElement('canvas'); c.width=data.length*16; c.height=16;
  const ctx=c.getContext('2d'); if(!ctx) return null;
  for(let i=0;i<data.length;i++){
    const col=PAL_RGB[data[i]]||[0,0,0];
    ctx.fillStyle='rgb('+col[0]+','+col[1]+','+col[2]+')';
    ctx.fillRect(i*16,0,16,16);
  }
  return { canvas:c, text:'Colours by palette index: '+
    Array.from(data,v=>'0x'+v.toString(16).toUpperCase().padStart(2,'0')).join(', ') };
}

/* `RMAP` says that a resource of one type is to be read as another. The single
   one here, `RMAP` 128, maps `TxSt` 999 onto `TxCl`: a four-char type, a count,
   then that many { id, four-char type } entries. */
function decodeRMAP(data){
  if(!data||data.length<10) return null;
  const from=decodeMacRoman(data.slice(0,4)), n=u32be(data,4);
  if(!n||data.length<8+n*6) return null;
  const rows=[]; for(let i=0;i<n;i++){
    rows.push('  '+from+' #'+u16be(data,8+i*6)+' is really '+decodeMacRoman(data.slice(10+i*6,14+i*6)));
  }
  return 'Type remapping for '+from+':\n'+rows.join('\n');
}

/* The engine's audit categories: thirteen four-character tags end to end, no
   header. They read as the parts of the engine that can be logged --
   Wind(ows), stup, LgUI, LgAI, Scrn, LgGP, Schd, CAct, Levl, Eggs, heap, Spel,
   file -- and are listed as they are stored, without a gloss, because nothing
   read so far says what any of them switches on. */
function decodeAudt(data){
  if(!data||!data.length||data.length%4) return null;
  const tags=[]; for(let i=0;i<data.length;i+=4) tags.push(decodeMacRoman(data.slice(i,i+4)));
  if(!tags.every(t=>/^[\x20-\x7e]{4}$/.test(t))) return null;
  return tags.length+' audit categories: '+tags.join(', ');
}

/* The help pages the Delver engine carries, which Cythera never shows.

   Thirteen `Page` resources, named for their topics ("Delver Topics", "About
   Delver", "Playing", "Main Map View"...). Ten of the thirteen hold a single
   byte: the two that have prose are "About Delver" and "Playing", and the
   contents page lists the rest. The prose says what they are -- "This is a
   prerelease version of Delver, not indented [sic] for distribution" -- so
   these are the engine's own help, shipped inside the finished game.

   Bytes with the high bit set are layout markers between the runs of text.
   What each one means is not read, so they are shown as their values rather
   than interpreted, and the text between them is left exactly as stored. */
function decodePage(data){
  if(!data||!data.length) return null;
  const parts=[]; let run=[];
  const flush=()=>{ if(run.length){ parts.push(decodeMacRoman(Uint8Array.from(run))); run=[]; } };
  for(const b of data){
    if(b>=0x80){ flush(); parts.push('〈'+b.toString(16).toUpperCase()+'〉'); }
    else run.push(b);
  }
  flush();
  // The runs are shown one to a line. A marker always stands between two of
  // them, so where one line ends and the next begins is the file's division,
  // not a reading of it -- run them together and the contents page becomes one
  // word ("Delver TopicsAbout Delver...").
  const words=parts.filter(p=>p[0]!=='〈').map(p=>p.trim()).filter(Boolean);
  return (words.length?words.join('\n')+'\n\n':'This page holds no text.\n\n')+
    'As stored: '+parts.join('');
}

/* `CMNU` is deliberately NOT read, and the byte evidence is worth keeping so
   that the next attempt does not start over.

   `CMNU` 129 is ResEdit's editing form of the File menu, and `MENU` 129 in the
   same fork is the same menu, which makes the item texts and the header known
   quantities: an identical 14-byte header and title, then the same eleven
   items in the same order. What differs is the record after each item's text.
   `MENU` gives every item four bytes (icon, key, mark, style). In `CMNU` the
   nine real items take NINE bytes and the two separators take EIGHT, checked
   against the next item's Pascal-string length in every case. Read as four
   attribute bytes, one spare, then a long, every one of the nine gives a
   plausible command number (Open Game 3, Close Window 1000, Save 5, Save
   As... 6, Backup As... 106, Revert To Saved 7, Preferences... 750, Quit 10)
   and both separators give zero -- but the spare byte is then present exactly
   when the command is not zero, which is a rule fitted to eleven items in one
   resource rather than a format. There is no second `CMNU` anywhere on hand to
   test it against, so it stays a byte count. */

/* The editor's saved game states: 64 bytes each, and the resource name says
   which state it is. Three are stored -- "Base", all zero; "Plague Cured",
   which differs from Base at byte 34 alone; and "Olpheltius Murdered", which
   differs at byte 35 alone. That is a global per byte, in the order the
   scripts address them, and the two named states are what a byte means: the
   difference is the whole content of the resource, so it is shown as the
   difference. Which global each byte is beyond those two is not read -- the
   wiki's list of globals stops at 0x19. */
function decodeMSta(data){
  if(!data||!data.length) return null;
  const set=[]; for(let i=0;i<data.length;i++) if(data[i]) set.push('  byte '+i+' = '+data[i]);
  return data.length+' bytes of game state.\n'+
    (set.length?'Not zero:\n'+set.join('\n'):'Every byte is zero.');
}

/* A table of { u16 id, NUL-terminated name } records. `DATA` 260 in the data
   fork is the editor's tile palette in this shape: 75 entries, a short list
   beside the 548 the archive's own terrain table (0xF004) carries, and 69 of
   the 75 names are identical to it. The six that are not are the editor's own
   words -- tile 0xCF is "wall" where 0xF004 says "abyss", 0x43F "steel door"
   against "metal door", 0x45F "stone door" against "secret door" -- plus
   "tableleg" for 0x359, which 0xF004 does not name at all.

   Detected by shape rather than by id, because `DATA` is a generic type with
   ten resources of several shapes in this fork alone. */
function decodeIdNameTable(data){
  if(!data||data.length<12) return null;
  const rows=[]; let p=0, named=0, prev=-1;
  while(p+3<=data.length){
    const id=u16be(data,p); p+=2;
    let e=p; while(e<data.length&&data[e]!==0) e++;
    if(e>=data.length) return null;
    const nm=decodeMacRoman(data.slice(p,e)); p=e+1;
    // Ids ascend through the real table and the trailing zero padding is where
    // they stop, which is how loadTerrainNames reads 0xF004 as well. A drop
    // before there is a table to speak of is not padding, it is a resource of
    // some other shape, so it is refused rather than truncated.
    if(id<prev){ if(rows.length<8) return null; break; }
    prev=id;
    if(nm){ named++; if(!/^[\x20-\x7e]+$/.test(nm)) return null; }
    rows.push([id,nm]);
  }
  if(rows.length<8||named<rows.length/2) return null;
  return rows.length+' names by id:\n'+
    rows.map(([id,nm])=>'  0x'+id.toString(16).toUpperCase().padStart(4,'0')+'  '+(nm||'(none)')).join('\n');
}

/* LINF: three twelve-byte records, and only half a reading.

   Six big-endian shorts each. The first two look like a width and a height --
   they read 256 by 256, 64 by 64 and 64 by 64, which are sizes the archive's
   own maps come in -- but that is weaker evidence than it first appears, and
   an earlier version of this comment called them "level templates" on the
   strength of it. The archive has maps at 32x32, 48x48, 56x72, 128x128 and
   five other shapes besides, so matching two common sizes is not much of a
   test. What can be said is what the bytes are; what they are for is not read.

   One thing that would fit and is not established: DATA 258 and 265 are 8,192
   bytes each and DATA 268 is 4,096, which are exactly a 64 by 64 level's
   layers at two bytes and one byte a square. All three are entirely zero, so
   there is nothing in them to confirm it with. */
function decodeLINF(data){
  if(data.length!==12) return null;
  const s=[]; for(let i=0;i<12;i+=2) s.push(u16be(data,i));
  const sg=v=>v>0x7fff?v-0x10000:v;
  return `Six shorts: ${s.map(sg).join(', ')}.\n`+
         `The first two read as a size, ${s[0]} by ${s[1]}. What the record is for is not read.`;
}

/* The colour cycles, as the editor holds them.

   Five three-byte entries, (first index, length, flag), ending at a pair of
   zero bytes. The page animates five cycles of its own and the two agree
   entry for entry on the lengths and the order -- 8, 8, 4, 4, 4 -- with every
   starting index in this table exactly 16 below the one the game uses. The
   game's own values are the ones observed animating, so the 16 is this
   table's, presumably the editor's palette being indexed from a different
   base; that part is not read, and the text says so rather than quietly
   adding 16. */
function decodeCycleTable(data){
  if(data.length<9||data.length>64) return null;
  const rows=[];
  for(let p=0;p+3<=data.length;p+=3){
    if(!data[p]&&!data[p+1]) break;
    if(!data[p+1]||data[p+1]>64) return null;                 // not a run length
    if(rows.length&&data[p]<=rows[rows.length-1].start) return null;   // must ascend
    rows.push({start:data[p], count:data[p+1], flag:data[p+2]});
  }
  if(rows.length<2) return null;
  return rows.length+' colour cycles, as (first index, length, flag):\n'+
    rows.map(r=>`  0x${r.start.toString(16).toUpperCase().padStart(2,'0')}  ${r.count} entries  flag ${r.flag}`).join('\n')+
    '\n\nThe starting indices here run 16 below the ones the game animates; what the 16 is has not been read.';
}

// A resource that is entirely zero is read, not unread, and saying which it is
// costs nothing. Four of the data file's DATA resources are 512, 1,024, 4,096
// and 8,192 bytes of nothing at all.
function allZeroText(data){
  for(const b of data) if(b) return null;
  return data.length+' bytes, every one zero.';
}

function exportArtifacts(fork, type, entry, data){
  const out=[], txt=s=>out.push({ext:'txt', text:s}), cvs=(c,tag)=>out.push({ext:'png', canvas:c, tag});
  if(type==='Lite') { const l=decodeLite(data); if(l){ cvs(l.canvas,'cone'); txt(l.text); } }
  else if(type==='TILE'){ const t=decodeTileSheetResource(data); if(t){ cvs(t.canvas,'sheet'); txt(t.text); } }
  else if(type==='acur'){
    // The cursor gallery already animates these; in the fork gallery an acur
    // was a byte count. lookupCursor is the shared resolver, and it is used
    // rather than a fresh crsr lookup because a crsr and a CURS can share an
    // id in this fork. Every frame resolving is the check on the reading.
    const a=decodeAcur(data), frames=a.ids.map(id=>lookupCursor(fork,id));
    txt('An animated cursor of '+a.count+' frame'+(a.count===1?'':'s')+
        ', shown in turn.\nFrames: '+a.ids.map((id,i)=>'#'+id+(frames[i]?'':' (missing)')).join(', '));
    frames.forEach((f,i)=>{ if(f&&f.canvas) cvs(f.canvas,'frame'+(i+1)); });
  }
  else if(type==='TxSt'){
    const s=decodeTxSt(data);
    if(s) txt(s.text);
    else { const c=decodeTxCl(data); if(c){ cvs(c.canvas,'colours'); txt(c.text); } }
  }
  else if(type==='RMAP'){ const r=decodeRMAP(data); if(r) txt(r); }
  else if(type==='Audt'){ const a=decodeAudt(data); if(a) txt(a); }
  else if(type==='Page'){ const p=decodePage(data); if(p) txt(p); }
  else if(type==='MSta'){ const m=decodeMSta(data); if(m) txt(m); }
  else if(type==='Pref'&&data.length===4) txt((entry.name||'Preference')+': '+u32be(data,0));
  else if(type==='LINF'){ const l=decodeLINF(data); if(l) txt(l); }
  else if(type==='DATA'){ const t=decodeCycleTable(data)||decodeIdNameTable(data)||allZeroText(data); if(t) txt(t); }
  else if(type==='STR#') txt(decodeSTRList(data).map((s,i)=>`[${i}] ${s}`).join('\n'));
  else if(type==='STR ') txt(decodeSTR(data));
  else if(type==='TEXT') txt(decodeTEXT(data));
  else if(type==='vers') txt(decodeVers(data));
  else if(type==='cfrg') txt(decodeCfrg(data));
  else if(CODE_TYPES[type]) txt(decodeCodeResource(type, entry.id, data));
  else if(type==='DITL') txt(decodeDITL(data));
  else if(type==='MENU') txt(decodeMENU(data));
  else if(type==='WIND') txt(decodeWIND(data));
  else if(type==='ALRT') txt(decodeALRT(data));
  else if(type==='DLOG') txt(decodeDLOG(data));
  else if(type==='MBAR') txt(decodeMBAR(data));
  else if(type==='FREF') txt(decodeFREF(data));
  else if(type==='BNDL') txt(decodeBNDL(data));
  else if(type==='SIZE') txt(decodeSIZE(data));
  else if(type==='TMPL') txt(decodeTMPL(data));
  else if(type==='CNTL') txt(decodeCNTL(data));
  else if(type==='nrct') txt(decodeNrct(data));
  else if(type==='styl') txt(decodeStyl(data));
  else if(type==='FOND') txt(decodeFOND(data).text);
  else if(type==='ICN#') cvs(decode1bitIcon(data,32));
  else if(type==='ics#') cvs(decode1bitIcon(data,16));
  else if(type==='ICON') cvs(decodeICON(data));
  else if(type==='icl4') cvs(drawIndexedIcon(data,32,4,MAC_4BIT_PAL,iconMaskFor(fork, 32)(entry.id)));
  else if(type==='icl8') cvs(drawIndexedIcon(data,32,8,MAC_8BIT_PAL,iconMaskFor(fork, 32)(entry.id)));
  else if(type==='ics4') cvs(drawIndexedIcon(data,16,4,MAC_4BIT_PAL,iconMaskFor(fork, 16)(entry.id)));
  else if(type==='ics8') cvs(drawIndexedIcon(data,16,8,MAC_8BIT_PAL,iconMaskFor(fork, 16)(entry.id)));
  else if(type==='SICN') decodeSICN(data).forEach((c,i)=>cvs(c,String(i+1)));
  else if(type==='PAT ') cvs(decodePAT(data));
  else if(type==='PAT#') decodePATList(data).forEach((c,i)=>cvs(c,String(i+1)));
  else if(type==='ppat') cvs(decodePpat(data));
  else if(type==='cicn') cvs(decodeCicn(data));
  else if(type==='CURS') cvs(decodeCURS(data).canvas);
  else if(type==='crsr') cvs(decodeCrsr(data).canvas);
  else if(type==='pltt') cvs(decodePltt(data).canvas);
  else if(COLOR_TABLE_TYPES[type]) cvs(decodeClut(data).canvas);
  else if(type==='NFNT'||type==='FONT'){
    const f=decodeNFNT(data);
    // The alphabet first: it is what a reader wants to see, and it is what the
    // gallery cell picks up, since the cell takes the first canvas it finds.
    const sheet=glyphSheet(f); if(sheet) cvs(sheet,'glyphs');
    txt(f.info); cvs(f.canvas,'strike');
    f.glyphs.forEach(g=>cvs(g.canvas, g.missing?'missing':'char'+g.code));
  }
  else if(type==='sfnt') out.push({ext:'ttf', bytes:sfntToTrueType(data)});   // with the OS/2 table a browser insists on
  else if(type==='snd ') out.push({ext:'wav', blob:decodeSndToWav(data).blob});
  else if(type==='PICT'){
    const r=decodePict(data);
    if(r.kind==='embedded') out.push({ext:r.ext, blob:r.blob});
    else cvs(r.canvas);
  }
  return out;
}

const TEXT_PREVIEW_LIMIT = 4000;
const TYPE_BADGES={
  'STR#':'text','STR ':'text','TEXT':'text','vers':'version info','DITL':'dialog items',
  'MENU':'menu','WIND':'window','ALRT':'alert','DLOG':'dialog','MBAR':'menu bar',
  'CNTL':'control','FREF':'file reference','BNDL':'bundle','SIZE':'memory sizes',
  'TMPL':'template','nrct':'rectangles','styl':'text styles','snd ':'audio',
  'CURS':'cursor','crsr':'colour cursor','acur':'animated cursor control',
  'ICN#':'image','ics#':'image','icl4':'image','icl8':'image','ics4':'image','ics8':'image',
  'ICON':'image','SICN':'small icons','cicn':'colour image','PICT':'image',
  'ppat':'pattern','PAT ':'pattern','PAT#':'patterns','pltt':'palette',
  'sfnt':'font','NFNT':'bitmap font','FONT':'bitmap font','FOND':'font family',
  'cfrg':'code fragments','CODE':'68K code','CDEF':'68K code','WDEF':'68K code',
  'MDEF':'68K code','LDEF':'68K code','PACK':'68K code','INIT':'68K code',
  'DRVR':'68K code','FKEY':'68K code',
  'Lite':'light cone','TILE':'tile sheet','TxSt':'text style','Page':'help page',
  'Audt':'audit categories','Pref':'preference default',
  'RMAP':'type remapping','MSta':'game state',
  // Named, not decoded: Delv is the application's creator signature standing
  // as the fork's owner resource, one byte with nothing in it to read.
  'Delv':'owner resource'
};

// downloadBlob and dlBlob are in js/mac-export.js.

// ---- Decoders ----

function decodeSTRList(data){
  let p=0; if(data.length<2) throw new Error('STR# too short');
  const count = u16be(data,0); p=2;
  const out=[];
  for(let i=0;i<count;i++){
    if(p>=data.length) break;
    const len = data[p]; p+=1;
    if(p+len>data.length) throw new Error('STR# entry overruns resource');
    out.push(decodeMacRoman(data.slice(p,p+len)));
    p+=len;
  }
  return out;
}

function decodeSTR(data){
  if(!data.length) return '';
  const len = data[0];
  if(1+len>data.length) throw new Error('STR resource overruns length');
  return decodeMacRoman(data.slice(1,1+len));
}

function decodeTEXT(data){
  return decodeMacRoman(data);
}

// 'snd ' resource -> WAV. Handles the standard sound header (8-bit unsigned
// mono) and the extended header (encode 0xFF), which is how 16-bit and stereo
// sounds are stored; the original code rejected everything but the former.
function decodeSndToWav(data){
  let p=0;
  const format = u16be(data,p); p+=2;
  if(format===1){
    const numDataFormats = u16be(data,p); p+=2;
    p += numDataFormats*6; // skip data format list
  } else if(format===2){
    p+=2; // refCount
  } else {
    throw new Error('unsupported snd format '+format);
  }
  const numCommands = u16be(data,p); p+=2;
  let soundHeaderOff = null;
  for(let i=0;i<numCommands && p+8<=data.length;i++){
    const cmd = u16be(data,p);
    const param2 = u32be(data,p+4);
    // bufferCmd/soundCmd with the dataOffsetFlag (0x8000) set: param2 is an
    // offset from the start of the resource to the sound header.
    if(cmd===0x8051 || cmd===0x8050){ soundHeaderOff = param2; }
    p+=8;
  }
  if(soundHeaderOff===null) throw new Error('no bufferCmd/soundCmd found in this snd resource');
  if(soundHeaderOff+22 > data.length) throw new Error('sound header offset is past the end of the resource');
  let hp = soundHeaderOff;
  hp+=4;                                   // samplePtr (0 when the samples follow the header)
  const lengthOrChannels = u32be(data,hp); hp+=4;
  const rateFixed = u32be(data,hp); hp+=4;
  hp+=4; hp+=4;                            // loopStart, loopEnd
  const encode = data[hp]; hp+=1;
  hp+=1;                                   // baseFrequency
  const rate = (rateFixed>>>0)/65536;   // 16.16 Fixed

  let samples, bits=8, channels=1, frames;
  if(encode===0x00){
    channels=1; bits=8; frames=lengthOrChannels;
    samples=data.slice(hp, hp+frames);
  } else if(encode===0xFF){
    channels=Math.max(1,lengthOrChannels);
    frames=u32be(data,hp); hp+=4;
    hp+=10;                                // AIFF sample rate (80-bit extended)
    hp+=4+4+4;                             // markerChunk, instrumentChunks, AESRecording
    bits=u16be(data,hp); hp+=2;
    hp+=2+2+2+2;                           // futureUse 1..4
    if(bits!==8 && bits!==16) throw new Error(`unsupported sample size (${bits}-bit)`);
    samples=data.slice(hp, hp+frames*channels*bits/8);
  } else if(encode===0xFE){
    throw new Error('this sound is MACE/IMA compressed (encode 0xFE), which this tool cannot decompress');
  } else {
    throw new Error('unknown sound header encoding 0x'+encode.toString(16));
  }
  if(!samples.length) throw new Error('sound header declares no samples');
  const blob=pcmToWavBlob(samples, Math.round(rate), bits, channels);
  const secs=frames/(rate||1);
  return {blob, rate, bits, channels, frames,
          description:`${bits}-bit ${channels===1?'mono':'stereo'}, ${Math.round(rate).toLocaleString()} Hz, ${frames.toLocaleString()} frames (${secs.toFixed(2)} s)`};
}

// Mac 8-bit samples are unsigned and 16-bit samples are signed big-endian;
// WAV wants unsigned 8-bit and signed little-endian 16-bit.
// The WAV writer is in js/mac-media.js. This wrapper keeps the Blob the
// preview and the download expect.
function pcmToWavBlob(samples, rate, bits, channels){
  return new Blob([wavFromPcmBytes(samples, rate, bits, channels)], {type:'audio/wav'});
}

// 1-bit ICN#/ics# icon -> canvas (32x32 or 16x16), mask ignored for simplicity
function decode1bitIcon(data, size){
  const rowBytes = size/8;
  const canvas = document.createElement('canvas');
  canvas.width=size; canvas.height=size;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(size,size);
  for(let y=0;y<size;y++){
    for(let x=0;x<size;x++){
      const byteIdx = y*rowBytes + Math.floor(x/8);
      const bit = 7-(x%8);
      const val = (data[byteIdx]>>bit)&1;
      const idx=(y*size+x)*4;
      const c = val?0:255;
      imgData.data[idx]=c; imgData.data[idx+1]=c; imgData.data[idx+2]=c; imgData.data[idx+3]=255;
    }
  }
  ctx.putImageData(imgData,0,0);
  return canvas;
}



// ---- Cursor decoders ----
function drawCursorBits(imageBits, maskBits, W, H){
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext('2d'), im=ctx.createImageData(W,H);
  const rb=Math.ceil(W/8);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const bit=7-(x&7), off=(y*W+x)*4, by=y*rb+(x>>3);
    const ink=(imageBits[by]>>bit)&1, mask=maskBits?((maskBits[by]>>bit)&1):1;
    const v=ink?0:255; im.data[off]=v;im.data[off+1]=v;im.data[off+2]=v;im.data[off+3]=mask?255:0;
  }
  ctx.putImageData(im,0,0); return canvas;
}
function decodeCURS(data){
  if(data.length<68)throw new Error('CURS resource is shorter than 68 bytes');
  const hotY=u16be(data,64),hotX=u16be(data,66);
  return {canvas:drawCursorBits(data.slice(0,32),data.slice(32,64),16,16),hotX,hotY};
}
function decodeCrsr(data){
  if(data.length<96)throw new Error('crsr resource is too short');
  // CCrsr record, Inside Macintosh: Imaging With QuickDraw p.4-104. This is NOT
  // the cicn layout -- the offsets below are fixed, and the PixMap lives at the
  // offset named by crsrMap rather than at the start of the resource.
  //    0 crsrType 2 | 2 crsrMap 4 | 6 crsrData 4 | 10 crsrXData 4
  //   14 crsrXValid 2 | 16 crsrXHandle 4 | 20 crsr1Data 32 | 52 crsrMask 32
  //   84 crsrHotSpot 4 | 88 crsrXTable 4 | 92 crsrID 4 | then PixMap, pixels, clut
  const crsrType=u16be(data,0);
  if(crsrType!==0x8001&&crsrType!==0x8000) throw new Error('Not a colour cursor (crsrType 0x'+crsrType.toString(16)+')');
  const mapOff=u32be(data,2), pixOff0=u32be(data,6);
  const hotY=s16(data,84), hotX=s16(data,86);
  const mask=data.slice(52,84);
  // PixMap at mapOff: baseAddr 4, rowBytes 2, bounds 8, ... pixelSize at +32, pmTable at +42
  const rowBytes=u16be(data,mapOff+4)&0x3fff;
  const bounds=readRect(data,mapOff+6);
  const pixelSize=u16be(data,mapOff+32);
  const ctOff=u32be(data,mapOff+42);
  const W=bounds.right-bounds.left,H=bounds.bottom-bounds.top;
  if(W<=0||H<=0||rowBytes<=0||pixelSize>8)throw new Error(`Unsupported crsr PixMap (${W}×${H}, ${pixelSize}-bit)`);
  const ct=readColorTable(data,ctOff);
  const c=renderIndexedPixels(data,pixOff0,rowBytes,W,H,pixelSize,ct.palette,mask,2);
  return {canvas:c,hotX,hotY,pixelSize};
}


function decodeDLOG(data){
  if(data.length<18) throw new Error('DLOG too short');
  const r=readRect(data,0), procID=u16be(data,8), visible=!!data[10], goAway=!!data[12], refCon=u32be(data,14);
  let title=''; if(data.length>18){ const len=data[18]||0; if(19+len<=data.length) title=decodeMacRoman(data.slice(19,19+len)); }
  return `Dialog: "${title}"\nBounds: (${r.left},${r.top}) to (${r.right},${r.bottom})\nProc ID: ${procID}  Visible: ${visible}  Close box: ${goAway}  RefCon: ${refCon}`;
}
function decodeMBAR(data){
  if(data.length<2) throw new Error('MBAR too short');
  const count=u16be(data,0); const ids=[]; let p=2; for(let i=0;i<count && p+2<=data.length;i++,p+=2) ids.push(u16be(data,p));
  return `Menu bar with ${ids.length} menu IDs\n` + ids.map((id,i)=>`${i+1}. MENU ${id}`).join('\n');
}
function decodeFREF(data){
  if(data.length<7) throw new Error('FREF too short');
  const type=String.fromCharCode(data[0],data[1],data[2],data[3]), iconListID=u16be(data,4), flags=u16be(data,6);
  return `File reference\nType: ${type}\nIcon list ID: ${iconListID}\nFlags: 0x${flags.toString(16)}`;
}
function decodeBNDL(data){
  if(data.length<8) throw new Error('BNDL too short');
  const sig=String.fromCharCode(data[0],data[1],data[2],data[3]), version=u16be(data,4), arrayCount=u16be(data,6);
  return `Bundle\nSignature: ${sig}\nVersion: ${version}\nMapping arrays: ${arrayCount}`;
}
function decodeSIZE(data){
  if(data.length<10) throw new Error('SIZE too short');
  const flags=u16be(data,0), pref=u32be(data,2), minimum=u32be(data,6);
  return `SIZE resource\nFlags: 0x${flags.toString(16)}\nPreferred memory: ${pref} bytes\nMinimum memory: ${minimum} bytes`;
}
function decodeTMPL(data){
  let p=0, out=[];
  while(p+5<=data.length){
    const labelLen=data[p]; p+=1; if(p+labelLen+4>data.length) break;
    const label=decodeMacRoman(data.slice(p,p+labelLen)); p+=labelLen;
    const kind=String.fromCharCode(data[p],data[p+1],data[p+2],data[p+3]); p+=4;
    out.push(`${label} : ${kind}`);
  }
  return out.join('\n') || 'TMPL resource';
}
function decodePAT(data){
  if(data.length<8) throw new Error('PAT too short');
  const canvas=document.createElement('canvas'); canvas.width=8; canvas.height=8;
  const ctx=canvas.getContext('2d'), im=ctx.createImageData(8,8);
  for(let y=0;y<8;y++) for(let x=0;x<8;x++){
    const b=data[y], bit=(b>>(7-x))&1, o=(y*8+x)*4, c=bit?0:255; im.data[o]=c; im.data[o+1]=c; im.data[o+2]=c; im.data[o+3]=255;
  }
  ctx.putImageData(im,0,0); return canvas;
}
// PixPat record, Inside Macintosh: Imaging With QuickDraw p.4-104:
//   0 patType 2 | 2 patMap 4 | 6 patData 4 | 10 patXData 4 | 14 patXValid 2
//  16 patXMap 4 | 20 pat1Data 8   -> 28 bytes, then PixMap, pixels, ColorTable
// (the same field order as the CCrsr record decoded above it).
// patType 1 is a colour pattern, 2 an RGB pattern, 0 a plain 1-bit one.
// The previous version scanned for a 0x0001 word, threw the result away, and
// always drew data[0..8] -- which is the header, not pattern pixels, so every
// colour ppat rendered as noise.
function decodePpat(data){
  if(data.length===8) return decodePAT(data);        // a bare PAT stored as ppat
  if(data.length<28) throw new Error('ppat resource is shorter than a PixPat record');
  const patType=u16be(data,0), mapOff=u32be(data,2), pixOff=u32be(data,6);
  if((patType===1||patType===2) && mapOff+50<=data.length && pixOff<data.length){
    const rowBytes=u16be(data,mapOff+4)&0x3fff;
    const bounds=readRect(data,mapOff+6);
    const pixelSize=u16be(data,mapOff+32);
    const ctOff=u32be(data,mapOff+42);
    const W=bounds.right-bounds.left, H=bounds.bottom-bounds.top;
    if(W>0&&H>0&&rowBytes>0&&pixelSize>0&&pixelSize<=8&&ctOff+8<=data.length){
      const ct=readColorTable(data,ctOff);
      const c=renderIndexedPixels(data,pixOff,rowBytes,W,H,pixelSize,ct.palette);
      c.info=`${W}×${H} colour pattern, ${pixelSize}-bit, ${ct.palette.filter(Boolean).length} colours`;
      return c;
    }
  }
  // pat1Data: the 1-bit pattern every PixPat carries for black-and-white
  // screens. It is at offset 20, not 0.
  const c=decodePAT(data.slice(20,28));
  c.info = patType===0 ? '8×8 monochrome pattern (patType 0)'
                       : `patType ${patType}: colour pixels unreadable, showing the 1-bit equivalent`;
  return c;
}
// cicn, crsr and ppat all finish with the same loop: indexed pixels through a
// colour table, optionally cut out by a 1-bit mask.
function renderIndexedPixels(data,pixOff,rowBytes,W,H,pixelSize,palette,maskBits,maskRowBytes){
  const ppb=8/pixelSize, pmask=(1<<pixelSize)-1;
  const c=document.createElement('canvas'); c.width=W; c.height=H;
  const ctx=c.getContext('2d'), im=ctx.createImageData(W,H);
  const idx=new Uint8Array(W*H);
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const byte=data[pixOff + y*rowBytes + Math.floor(x/ppb)] || 0;
    const pi = pixelSize===8 ? byte : (byte >> ((ppb-1-(x%ppb))*pixelSize)) & pmask;
    const col=palette[pi]||[255,0,255], o=(y*W+x)*4;
    idx[y*W+x]=pi;
    im.data[o]=col[0]; im.data[o+1]=col[1]; im.data[o+2]=col[2];
    im.data[o+3] = maskBits ? ((((maskBits[y*maskRowBytes+(x>>3)]||0)>>(7-(x&7)))&1)?255:0) : 255;
  }
  ctx.putImageData(im,0,0);
  tagIndexed(c, W, H, idx, palette, maskBits);
  return c;
}
// ---- PICT v2 decoder: indexed PackBitsRect/Rgn AND true-color DirectBitsRect/Rgn ----
// Opcode data-length table derived from Apple's "PICT File Format Notes" (1990).
// Most opcodes carry fixed-size data we don't render (pen state, colors, text,
// shapes, etc); we walk past all of them until we reach the actual image opcode.
// QuickDraw Rect fields are SIGNED 16-bit; reading them unsigned turns any
// negative origin into ~65000 and yields nonsense widths.
function s16(b,i){const v=(b[i]<<8)|b[i+1];return v>32767?v-65536:v;}
function readRect(data,p){return {top:s16(data,p),left:s16(data,p+2),bottom:s16(data,p+4),right:s16(data,p+6)};}
// A colour table is ctSeed, ctFlags, ctSize-1, then (value, r, g, b) entries.
// With the high bit of ctFlags clear the `value` field is the pixel value the
// entry stands for; with it set the table is a device colour table, every
// `value` is written 0, and the entry's POSITION is its pixel value. Four of
// the nineteen PICTs in Cythera Data are that second kind -- 131, 512 and 513
// (8-bit, in the game's own palette) came out as one colour, since every
// entry landed on palette[0] and the other 255 pixel values fell to the
// magenta placeholder. Inside Macintosh: Imaging With QuickDraw, "Color
// Tables" (ctFlags), is the reference, and both other implementations
// already did this: systemless's src/trap/pict.rs picks the index when the
// flag is set and the value otherwise, and alchemy/port's pict.cpp the same.
function readColorTable(data,p){
  p+=4; const flags=u16be(data,p); p+=2; const count=u16be(data,p)+1;p+=2; const pal=[];
  const byPosition=(flags&0x8000)!==0;
  for(let i=0;i<count;i++){const val=byPosition?i:u16be(data,p);pal[val]=[u16be(data,p+2)>>8,u16be(data,p+4)>>8,u16be(data,p+6)>>8];p+=8;}
  return {palette:pal,p};
}
// hasBaseAddr: DirectBits opcodes (0x9A/0x9B) store a 4-byte placeholder Ptr
// before rowBytes; the indexed opcodes (0x98/0x99) omit it on disk.
function readPictPixmap(data,p,hasBaseAddr){
  if(hasBaseAddr) p+=4;
  const rowWord=u16be(data,p),rowBytes=rowWord&0x3fff; p+=2;
  const bounds=readRect(data,p);p+=8;
  p+=2; const packType=u16be(data,p);p+=2;p+=4;p+=4;p+=4; const pixelType=u16be(data,p);p+=2; const pixelSize=u16be(data,p);p+=2;const cmpCount=u16be(data,p);p+=2;const cmpSize=u16be(data,p);p+=2;p+=4;p+=4;p+=4;
  return {rowBytes,bounds,packType,pixelType,pixelSize,cmpCount,cmpSize,p};
}
function unpackBitsPict(data,p,packedLen,want){
  const src=data.slice(p,p+packedLen),out=new Uint8Array(want);let si=0,oi=0;
  while(si<src.length&&oi<want){let n=i8(src,si++);if(n>=0){let ct=n+1;while(ct--&&si<src.length&&oi<want)out[oi++]=src[si++];}else if(n!==-128){if(si>=src.length)break;let ct=1-n,v=src[si++];while(ct--&&oi<want)out[oi++]=v;}}
  return out;
}
function renderPictIndexed(pm,palette,rows){
  const W=pm.bounds.right-pm.bounds.left,H=pm.bounds.bottom-pm.bounds.top,c=document.createElement('canvas');c.width=W;c.height=H;const ctx=c.getContext('2d'),im=ctx.createImageData(W,H),ppb=8/pm.pixelSize,mask=(1<<pm.pixelSize)-1;
  for(let y=0;y<H;y++){const row=rows[y]||new Uint8Array(pm.rowBytes);for(let x=0;x<W;x++){const b=row[Math.floor(x/ppb)]||0,pi=(b>>((ppb-1-(x%ppb))*pm.pixelSize))&mask,col=palette[pi]||[255,0,255],o=(y*W+x)*4;im.data[o]=col[0];im.data[o+1]=col[1];im.data[o+2]=col[2];im.data[o+3]=255;}}
  ctx.putImageData(im,0,0);return c;
}
function renderPictDirect(pm,rows){
  const W=pm.bounds.right-pm.bounds.left,H=pm.bounds.bottom-pm.bounds.top,c=document.createElement('canvas');c.width=W;c.height=H;const ctx=c.getContext('2d'),im=ctx.createImageData(W,H);
  for(let y=0;y<H;y++){
    const row=rows[y];
    for(let x=0;x<W;x++){
      const o=(y*W+x)*4; let r=255,g=0,b=255;
      if(row){
        if(pm.packType===4 && row.planes){ r=row.planes[0][x]??0; g=row.planes[1][x]??0; b=row.planes[2][x]??0; }
        else if(pm.pixelSize===16){ const w=(row[x*2]<<8)|row[x*2+1]; const r5=(w>>10)&0x1f,g5=(w>>5)&0x1f,b5=w&0x1f; r=Math.round(r5*255/31);g=Math.round(g5*255/31);b=Math.round(b5*255/31); }
        else if(pm.pixelSize===32){ r=row[x*4+1]??0; g=row[x*4+2]??0; b=row[x*4+3]??0; }
      }
      im.data[o]=r;im.data[o+1]=g;im.data[o+2]=b;im.data[o+3]=255;
    }
  }
  ctx.putImageData(im,0,0);return c;
}
function decodeDirectBitsRows(data,p,pm){
  const H=pm.bounds.bottom-pm.bounds.top, rowBytes=pm.rowBytes, cmpCount=pm.cmpCount||3, rows=[];
  for(let y=0;y<H;y++){
    if(rowBytes<8||pm.packType===1){ rows.push(data.slice(p,p+rowBytes)); p+=rowBytes; }   // unpacked
    else if(pm.packType===2){
      // packType 2 is 24-bit direct pixels with the pad byte dropped: three
      // bytes a pixel, unpacked, and the row is width*3 bytes rather than rowBytes.
      const W=pm.bounds.right-pm.bounds.left, planes=[];
      for(let c=0;c<3;c++){ const pl=new Uint8Array(W); for(let x=0;x<W;x++) pl[x]=data[p+x*3+c]; planes.push(pl); }
      rows.push({planes}); p+=W*3;
    }
    else if(pm.packType===4){
      // packType 4 stores ONE PackBits stream per row (one length prefix),
      // which unpacks to cmpCount planes of `width` bytes each -- not one
      // stream per plane, and not rowBytes/cmpCount per plane (rowBytes is
      // width*4 for 32-bit, so that division gives the wrong plane stride).
      const W=pm.bounds.right-pm.bounds.left;
      const plen = rowBytes>250?u16be(data,p):data[p]; p += rowBytes>250?2:1;
      const flat = unpackBitsPict(data,p,plen,W*cmpCount); p+=plen;
      const planes=[];
      const base = cmpCount===4 ? W : 0; // skip alpha plane when present
      for(let c=0;c<3;c++) planes.push(flat.subarray(base+c*W, base+(c+1)*W));
      rows.push({planes});
    } else if(pm.packType===3){
      // packType 3 is PackBits over 16-bit PIXELS: a literal run is count
      // words and a repeat run repeats one word, so the byte unpacker above
      // reads every count as half what it is and the row comes out as a
      // smear. PICT 129 in Cythera Data is the one such picture there and
      // was the one that drew as noise. systemless (pict.rs,
      // unpack_bits_chunk16_data_into) and alchemy/port (pict.cpp, "Sixteen-
      // bit direct pixels repeat two bytes at a time") both unpack it this
      // way, so the layout has two references.
      const plen = rowBytes>250?u16be(data,p):data[p]; p += rowBytes>250?2:1;
      rows.push(unpackBitsPictWords(data,p,plen,rowBytes)); p+=plen;
    } else {
      const plen = rowBytes>250?u16be(data,p):data[p]; p += rowBytes>250?2:1;
      rows.push(unpackBitsPict(data,p,plen,rowBytes)); p+=plen;
    }
  }
  return {rows,p};
}
function unpackBitsPictWords(data,p,packedLen,want){
  const src=data.slice(p,p+packedLen),out=new Uint8Array(want);let si=0,oi=0;
  while(si<src.length&&oi<want){
    const n=i8(src,si++);
    if(n>=0){ let ct=(n+1)*2; while(ct--&&si<src.length&&oi<want) out[oi++]=src[si++]; }
    else if(n!==-128){ if(si+1>=src.length) break; const hi=src[si++],lo=src[si++]; let ct=1-n; while(ct--&&oi+1<want){ out[oi++]=hi; out[oi++]=lo; } }
  }
  return out;
}
const PICT_FIXED_LEN = {
  0x0002:8,0x0003:2,0x0004:2,0x0005:2,0x0006:4,0x0007:4,0x0008:2,0x0009:8,
  0x000A:8,0x000B:4,0x000C:4,0x000D:2,0x000E:4,0x000F:4,0x0010:8,
  0x0015:2,0x0016:2,0x0017:0,0x0018:0,0x0019:0,
  0x001A:6,0x001B:6,0x001C:0,0x001D:6,0x001E:0,0x001F:6,
  0x0020:8,0x0021:4,0x0022:6,0x0023:2,
  0x0030:8,0x0031:8,0x0032:8,0x0033:8,0x0034:8,0x0035:8,0x0036:8,0x0037:8,
  0x0038:0,0x0039:0,0x003A:0,0x003B:0,0x003C:0,0x003D:0,0x003E:0,0x003F:0,
  0x0040:8,0x0041:8,0x0042:8,0x0043:8,0x0044:8,0x0045:8,0x0046:8,0x0047:8,
  0x0048:0,0x0049:0,0x004A:0,0x004B:0,0x004C:0,0x004D:0,0x004E:0,0x004F:0,
  0x0050:8,0x0051:8,0x0052:8,0x0053:8,0x0054:8,0x0055:8,0x0056:8,0x0057:8,
  0x0058:0,0x0059:0,0x005A:0,0x005B:0,0x005C:0,0x005D:0,0x005E:0,0x005F:0,
  0x0060:12,0x0061:12,0x0062:12,0x0063:12,0x0064:12,0x0065:12,0x0066:12,0x0067:12,
  0x0068:4,0x0069:4,0x006A:4,0x006B:4,0x006C:4,0x006D:4,0x006E:4,0x006F:4,
  0x0078:0,0x0079:0,0x007A:0,0x007B:0,0x007C:0,0x007D:0,0x007E:0,0x007F:0,
  0x0088:0,0x0089:0,0x008A:0,0x008B:0,0x008C:0,0x008D:0,0x008E:0,0x008F:0,
  0x00A0:2, 0x8000:0
};
const PICT_LEN_PREFIXED_2 = new Set([0x0024,0x0025,0x0026,0x0027,0x002C,0x002D,0x002E,0x002F,0x0092,0x0093,0x0094,0x0095,0x0096,0x0097,0x009C,0x009D,0x009E,0x009F]);
const PICT_REGION_OPS = new Set([0x0001,0x0080,0x0081,0x0082,0x0083,0x0084,0x0085,0x0086,0x0087]);
const PICT_POLY_OPS = new Set([0x0070,0x0071,0x0072,0x0073,0x0074,0x0075,0x0076]);
const PICT_IMAGE_OPS = new Set([0x0090,0x0091,0x0098,0x0099,0x009A,0x009B]);
// Walk the opcode stream (skipping every opcode we don't render) until we
// reach a bitmap opcode. This replaces a byte-by-byte signature scan, which
// could false-match inside pixel/text data and silently mis-locate images.
function findPictImageOpcode(data){
  // Version 1 pictures use ONE-byte opcodes; version 2 uses two. The word at
  // offset 10 is 0x0011 for v2 and 0x1101 for v1, so this must be detected
  // before any opcode is read or the whole walk is misaligned.
  let p=2+8;
  const verWord=u16be(data,p);
  const v2 = (verWord===0x0011);
  if(v2){ p+=4; } else { p+=2; }   // v2: 0x0011 0x02FF | v1: 0x11 0x01
  if(v2 && u16be(data,p)===0x0C00){ p+=2+24; }
  let guard=0;
  while(p<data.length && guard++<20000){
    if(v2){ if(p%2) p+=1; if(p+2>data.length) break; }
    let op;
    if(v2){ op=u16be(data,p); p+=2; } else { op=data[p]; p+=1; }
    if(op===0x0000) continue;
    // QuickTime-compressed opcodes carry a 4-byte payload length; the JPEG or
    // PNG lives INSIDE that payload. Return it so the caller can look there
    // instead of scanning the whole resource for a signature.
    if(op===0x8200||op===0x8201){ const size=u32be(data,p); return {op,p:p+4,size,quicktime:true}; }
    if(PICT_REGION_OPS.has(op)||PICT_POLY_OPS.has(op)){ const size=u16be(data,p); p+=size; continue; }
    // The text opcodes pad to a word in version 2 only; a version 1 picture
    // is byte-aligned throughout and padding it here misaligned the walk.
    if(op===0x0028){ p+=4; const len=data[p]; p+=1+len; if(v2&&p%2)p+=1; continue; } // LongText
    if(op===0x0029||op===0x002A){ p+=1; const len=data[p]; p+=1+len; if(v2&&p%2)p+=1; continue; } // DHText/DVText
    if(op===0x002B){ p+=2; const len=data[p]; p+=1+len; if(v2&&p%2)p+=1; continue; } // DHDVText
    if(op===0x0012||op===0x0013||op===0x0014){ // Bk/Pn/FillPixPat, best effort skip
      const patType=u16be(data,p); p+=2; p+=8;
      if(patType===2){ p+=6; }
      else{
        const pm=readPictPixmap(data,p,false); p=pm.p;
        if(pm.pixelType===0){ const ct=readColorTable(data,p); p=ct.p; }
        const H=pm.bounds.bottom-pm.bounds.top;
        if(pm.rowBytes<8){ p+=pm.rowBytes*H; }
        else{ for(let y=0;y<H;y++){ const rl=pm.rowBytes>250?u16be(data,p):data[p]; p+=(pm.rowBytes>250?2:1)+rl; } }
      }
      continue;
    }
    if(PICT_IMAGE_OPS.has(op)) return {op,p};
    if(op===0x00A1){ p+=2; const size=u16be(data,p); p+=2+size; if(p%2)p+=1; continue; } // LongComment
    if(op===0x00FF) return null; // end of picture, nothing to draw
    if(op in PICT_FIXED_LEN){ p+=PICT_FIXED_LEN[op]; continue; }
    if(PICT_LEN_PREFIXED_2.has(op)){ const size=u16be(data,p); p+=2+size; continue; }
    if(op>=0x0100 && op<=0x7FFF){ p+=(op>>8)*2; continue; }
    if(op>=0x8000 && op<=0x80FF){ continue; }
    if(op>=0x8100 && op<=0xFFFF){ const size=u32be(data,p); p+=4+size; continue; }
    // Truly unknown opcode: Apple's own convention for future/reserved
    // opcodes in this range is a 2-byte length prefix, so fall back to that
    // rather than throwing away the whole picture.
    { const size=u16be(data,p); p+=2+size; }
  }
  return null;
}
function decodePictPackBits(data,pre){
  const found = (pre && !pre.quicktime) ? pre : findPictImageOpcode(data);
  if(!found||found.quicktime) throw new Error('No PackBitsRect/PackBitsRgn/DirectBitsRect/DirectBitsRgn image opcode found in this PICT.');
  const foundOp=found.op; let p=found.p;
  if(foundOp===0x0090||foundOp===0x0091){
    // BitsRect/BitsRgn: an old-style 1-bit BitMap whose rows are stored
    // UNPACKED, which is the only thing separating them from 0x98/0x99. The
    // header is identical -- rowBytes, bounds, srcRect, dstRect, mode -- and
    // there is no colour table. These were walked past for alignment and
    // never drawn, so a picture built from several CopyBits came out partial
    // in the browser and complete everywhere else; systemless renders them in
    // src/trap/pict.rs (parse_bits_rect) and alchemy/port in pict.cpp, so the
    // layout below has two references and is not inferred from the data.
    const rowBytes=u16be(data,p)&0x3fff; p+=2;
    const bounds=readRect(data,p); p+=8;
    p+=8; const dst=readRect(data,p); p+=8; const mode=u16be(data,p); p+=2;
    if(foundOp===0x0091){ const rgnSize=u16be(data,p); p+=rgnSize; }
    const W=bounds.right-bounds.left, H=bounds.bottom-bounds.top;
    if(W<=0||H<=0||rowBytes<=0) throw new Error(`Unsupported BitMap (${W}×${H})`);
    if(p+rowBytes*H>data.length) throw new Error('PICT bitmap data ends unexpectedly');
    const rows=[];
    for(let y=0;y<H;y++){ rows.push(data.slice(p,p+rowBytes)); p+=rowBytes; }
    const pm1={rowBytes,bounds,pixelSize:1};
    // QuickDraw 1-bit: set bit = black.
    const canvas=renderPictIndexed(pm1,[[255,255,255],[0,0,0]],rows);
    return {canvas,width:W,height:H,pixelSize:1,mode,opcode:foundOp,opcodeOffset:found.p-2,colorSpace:'1-bit bitmap',dst,end:p};
  }
  if(foundOp===0x0098||foundOp===0x0099){
    // PackBitsRect/Rgn may carry either a PixMap (high bit of rowBytes set) or
    // an old-style 1-bit BitMap. The BitMap header is only rowBytes+bounds and
    // has no colour table, so parsing it as a PixMap reads 36 bytes of garbage.
    if(!(u16be(data,p)&0x8000)){
      const rowBytes=u16be(data,p)&0x3fff; p+=2;
      const bounds=readRect(data,p); p+=8;
      p+=8; const dst=readRect(data,p); p+=8; const mode=u16be(data,p); p+=2;
      if(foundOp===0x0099){ const rgnSize=u16be(data,p); p+=rgnSize; }
      const W=bounds.right-bounds.left, H=bounds.bottom-bounds.top;
      if(W<=0||H<=0||rowBytes<=0) throw new Error(`Unsupported BitMap (${W}×${H})`);
      const rows=[];
      for(let y=0;y<H;y++){
        if(rowBytes<8){ rows.push(data.slice(p,p+rowBytes)); p+=rowBytes; }
        else{ const plen=rowBytes>250?u16be(data,p):data[p]; p+=rowBytes>250?2:1;
              rows.push(unpackBitsPict(data,p,plen,rowBytes)); p+=plen; }
      }
      const pm1={rowBytes,bounds,pixelSize:1};
      // QuickDraw 1-bit: set bit = black.
      const canvas=renderPictIndexed(pm1,[[255,255,255],[0,0,0]],rows);
      return {canvas,width:W,height:H,pixelSize:1,mode,opcode:foundOp,opcodeOffset:found.p-2,colorSpace:'1-bit bitmap',dst,end:p};
    }
    const pm=readPictPixmap(data,p,false); p=pm.p;
    const ct=readColorTable(data,p); p=ct.p;
    const src=readRect(data,p); p+=8; const dst=readRect(data,p); p+=8; const mode=u16be(data,p); p+=2;
    if(foundOp===0x0099){ const rgnSize=u16be(data,p); p+=rgnSize; }
    const W=pm.bounds.right-pm.bounds.left, H=pm.bounds.bottom-pm.bounds.top;
    if(W<=0||H<=0||pm.rowBytes<=0||pm.pixelSize>8) throw new Error(`Unsupported indexed PixMap (${W}×${H}, ${pm.pixelSize}-bit)`);
    const rows=[];
    for(let y=0;y<H;y++){
      let packedLen = pm.rowBytes>250 ? u16be(data,p) : data[p];
      p += pm.rowBytes>250 ? 2 : 1;
      if(p+packedLen>data.length) throw new Error('PICT row data ends unexpectedly');
      rows.push(unpackBitsPict(data,p,packedLen,pm.rowBytes)); p+=packedLen;
    }
    return {canvas:renderPictIndexed(pm,ct.palette,rows),width:W,height:H,pixelSize:pm.pixelSize,mode,opcode:foundOp,opcodeOffset:found.p-2,colorSpace:`${pm.pixelSize}-bit indexed`,dst,end:p};
  } else {
    // DirectBitsRect (0x9A) / DirectBitsRgn (0x9B): true-color pixels, no palette.
    const pm=readPictPixmap(data,p,true); p=pm.p;
    const src=readRect(data,p); p+=8; const dst=readRect(data,p); p+=8; const mode=u16be(data,p); p+=2;
    if(foundOp===0x009B){ const rgnSize=u16be(data,p); p+=rgnSize; }
    const W=pm.bounds.right-pm.bounds.left, H=pm.bounds.bottom-pm.bounds.top;
    if(W<=0||H<=0||pm.rowBytes<=0) throw new Error(`Unsupported DirectBits PixMap (${W}×${H})`);
    if(pm.pixelSize!==16 && pm.pixelSize!==32) throw new Error(`Unsupported DirectBits pixel depth (${pm.pixelSize}-bit)`);
    const {rows,end}=decodeDirectBitsRows(data,p,pm);
    return {canvas:renderPictDirect(pm,rows),width:W,height:H,pixelSize:pm.pixelSize,mode,opcode:foundOp,opcodeOffset:found.p-2,colorSpace:`${pm.pixelSize}-bit direct`,dst,end};
  }
}

// Search a BOUNDED slice for a JPEG/PNG signature. Scanning the whole
// resource false-matched inside PackBits pixel data: 5 of the 83 PICTs in
// Cythera/Cythera Data contain a stray FF D8 FF and were silently decoded as
// broken JPEGs instead of QuickDraw bitmaps.
function findEmbeddedImage(data,from,to){
  const lo=from||0, hi=Math.min(to===undefined?data.length:to, data.length);
  for(let i=lo;i<hi-4;i++){
    if(data[i]===0xFF && data[i+1]===0xD8 && data[i+2]===0xFF){
      return {type:'jpeg', bytes:data.slice(i,hi)};
    }
    if(data[i]===0x89 && data[i+1]===0x50 && data[i+2]===0x4E && data[i+3]===0x47){
      return {type:'png', bytes:data.slice(i,hi)};
    }
  }
  return null;
}

function decodePict(data){
  const found=findPictImageOpcode(data);
  if(found && found.quicktime){
    const embedded=findEmbeddedImage(data,found.p,found.p+found.size);
    if(embedded){const blob=new Blob([embedded.bytes],{type:embedded.type==='jpeg'?'image/jpeg':'image/png'});return {kind:'embedded',blob,ext:embedded.type==='jpeg'?'jpg':'png'};}
  }
  const parsed=decodePictPackBits(data,found);return {kind:'canvas',...parsed};
}

// ---- clut (color table) — same on-disk layout as a PICT's embedded color table ----
function decodeClut(data){
  const ct=readColorTable(data,0);
  const n=ct.palette.length, perRow=16, cell=20;
  const canvas=document.createElement('canvas');
  canvas.width=perRow*cell; canvas.height=Math.ceil(n/perRow)*cell;
  const ctx=canvas.getContext('2d');
  for(let i=0;i<n;i++){
    const col=ct.palette[i]||[0,0,0];
    ctx.fillStyle=`rgb(${col[0]},${col[1]},${col[2]})`;
    ctx.fillRect((i%perRow)*cell,Math.floor(i/perRow)*cell,cell,cell);
  }
  return {canvas,count:n};
}

// ---- sfnt (raw TrueType/OpenType font data) ----
// Code Fragment Manager resource: what PowerPC (and CFM-68K) code this file
// carries, where each fragment lives and what it is called. One `cfrg` says
// more about a fat binary than nine `CODE` resources do.
const CFRG_ARCH={'pwpc':'PowerPC','m68k':'CFM-68K'};
const CFRG_USAGE=['import library','application','drop-in addition','stub library','weak stub library'];
const CFRG_WHERE=['in this file','in a data fork','in memory','(reserved)','in a named fragment'];
function decodeCfrg(data){
  // CFragResource: 30 bytes of reserved fields, then a UInt16 member count at
  // 30, then the members. Every member is a CFragResourceMember, whose own
  // memberSize at offset 42 says where the next one starts -- the name is a
  // Pascal string at 44 and the record is padded to an even length, so walking
  // by a fixed size does not work.
  if(data.length<32) throw new Error(`cfrg needs 32 bytes of header, got ${data.length}`);
  const version=u16be(data,10), count=u16be(data,30);
  if(count>4096) throw new Error(`implausible fragment count (${count})`);
  const lines=[`${count} fragment${count===1?'':'s'}` + (version!==1?` (resource version ${version})`:'')];
  let p=32;
  for(let i=0;i<count;i++){
    if(p+43>data.length){ lines.push(`  [truncated after ${i} of ${count}]`); break; }
    const arch=fourcc(data,p);
    const updateLevel=data[p+7];
    const currentVersion=u32be(data,p+8), oldestVersion=u32be(data,p+12);
    const stackSize=u32be(data,p+16);
    const usage=data[p+22], where=data[p+23];
    const offset=u32be(data,p+24), length=u32be(data,p+28);
    // memberSize at 40 and the name at 42, which is what the bytes in a real
    // cfrg say: "Cythera" is a 7-character Pascal string ending at 50, and the
    // member size of 52 is that rounded up to an even boundary. Reading the
    // name four bytes later gave "ythera  pwpc..." -- garbage that still
    // looked like a name, which is the sort of wrong that survives review.
    const memberSize=u16be(data,p+40);
    const nameLen=data[p+42];
    const name=decodeMacRoman(data.slice(p+43,p+43+nameLen));
    const ver=v=>`${(v>>>24)&255}.${(v>>>16)&255}.${(v>>>8)&255}`;
    lines.push('');
    lines.push(`  ${name||'(unnamed)'}`);
    lines.push(`    architecture : ${CFRG_ARCH[arch]||arch}`);
    lines.push(`    kind         : ${CFRG_USAGE[usage]||('usage '+usage)}, ${CFRG_WHERE[where]||('location '+where)}`);
    lines.push(`    version      : ${ver(currentVersion)} (oldest definition ${ver(oldestVersion)}, update level ${updateLevel})`);
    lines.push(`    extent       : offset ${offset===0?'0':'0x'+offset.toString(16)}, ` +
               (length===0?'to the end of the fork':`${length.toLocaleString()} bytes`));
    if(stackSize) lines.push(`    stack        : ${stackSize.toLocaleString()} bytes`);
    if(memberSize<44||p+memberSize>data.length){ lines.push('    [member size is out of range; stopping]'); break; }
    p+=memberSize;
  }
  return lines.join('\n');
}

// 68K executable code: CODE, and the definition procedures that are the same
// thing under a different name. There is no disassembler here and there should
// not be one, but "9 resources, no decoder" told you nothing at all -- these
// have real headers, and CODE 0 in particular is the jump table that says how
// many entry points the application has.
const CODE_TYPES={'CODE':'code segment','CDEF':'control definition','WDEF':'window definition',
  'MDEF':'menu definition','LDEF':'list definition','PACK':'package','INIT':'init',
  'DRVR':'driver','FKEY':'function key'};
function decodeCodeResource(type, id, data){
  const lines=[`${CODE_TYPES[type]||'68K code'} — ${data.length.toLocaleString()} bytes of Motorola 68000 machine code`];
  if(type==='CODE' && id===0){
    // The jump table header: above/below A5 sizes, then 8 bytes per entry.
    if(data.length<16) throw new Error(`CODE 0 needs a 16-byte header, got ${data.length}`);
    const aboveA5=u32be(data,0), belowA5=u32be(data,4), tableSize=u32be(data,8), tableOffset=u32be(data,12);
    lines.length=0;
    lines.push('CODE 0 — the jump table, not code');
    lines.push('');
    lines.push(`  above A5      : ${aboveA5.toLocaleString()} bytes (application globals and the jump table)`);
    lines.push(`  below A5      : ${belowA5.toLocaleString()} bytes (QuickDraw globals and parameters)`);
    lines.push(`  jump table    : ${tableSize.toLocaleString()} bytes at offset ${tableOffset}, ` +
               `${Math.floor(tableSize/8).toLocaleString()} entries`);
    const n=Math.min(Math.floor(tableSize/8), Math.floor((data.length-16)/8));
    let unloaded=0;
    for(let i=0;i<n;i++){
      // An unloaded entry is `MOVE.W #segment,-(SP); _LoadSeg`, which is the
      // 0x3F3C / 0xA9F0 pair; a loaded one has been patched to a JMP.
      if(u16be(data,16+i*8+2)===0x3F3C && u16be(data,16+i*8+6)===0xA9F0) unloaded++;
    }
    lines.push(`  entry points  : ${n.toLocaleString()} readable, ${unloaded.toLocaleString()} in the unloaded _LoadSeg form`);
    return lines.join('\n');
  }
  if(data.length>=4){
    const first=u16be(data,0);
    // A near-model segment starts with the jump table offset and entry count;
    // a far-model one is flagged by 0xFFFF in that first word.
    if(first===0xFFFF) lines.push('  far model segment header (32-bit references)');
    else lines.push(`  jump table offset ${first}, ${u16be(data,2)} entr${u16be(data,2)===1?'y':'ies'}`);
  }
  lines.push('');
  lines.push('  This browser does not disassemble 68K. The bytes are below, and');
  lines.push('  "Save raw" writes them out for something that does.');
  return lines.join('\n');
}

// An 'sfnt' resource is a TrueType font as it sits in the file: the table
// directory and the tables, nothing else. A browser will load one from bytes
// (FontFace), but Chrome and Firefox pass every font through OTS first, and
// OTS refuses a TrueType font with no OS/2 table -- which is what a font made
// on a classic Mac usually lacks, the Mac having never read that table.
// Cythera's Argos A Nouveau is one: cmap, cvt, fpgm, glyf, head, hhea, hmtx,
// loca, maxp, name, post, prep, and no OS/2. This adds one when it is missing,
// filled from hhea, head and hmtx (the ascent and descent, the em, the mean
// advance), rebuilds the directory in tag order with fresh checksums, and
// hands back a font a browser accepts; and it gives the cmap a Unicode
// subtable when it has only a Mac Roman one (see below). A font that already
// has both is returned as it came, so this is safe to call on any sfnt.
function sfntToTrueType(data){
  const numTables=u16be(data,4);
  const tables=[];
  for(let i=0;i<numTables;i++){
    const p=12+i*16;
    const tag=String.fromCharCode(data[p],data[p+1],data[p+2],data[p+3]);
    const off=u32be(data,p+8), len=u32be(data,p+12);
    if(off+len>data.length) throw new Error('sfnt table '+tag+' runs past the end of the resource');
    tables.push({tag, bytes:data.slice(off,off+len)});
  }
  const find=t=>tables.find(x=>x.tag===t);
  const cmap=find('cmap');
  const hasUnicodeCmap=cmap&&(()=>{ const n=u16be(cmap.bytes,2); for(let i=0;i<n;i++){ const pl=u16be(cmap.bytes,4+i*8); if(pl===0||pl===3) return true; } return false; })();
  if(find('OS/2')&&hasUnicodeCmap) return data;
  const head=find('head'), hhea=find('hhea'), hmtx=find('hmtx'), maxp=find('maxp');
  if(!head||!hhea||!hmtx||!maxp) throw new Error('sfnt is missing a required table');
  // A browser looks glyphs up by Unicode, and a font made on a classic Mac
  // usually maps only Mac Roman bytes: Argos's cmap is one format 0 table
  // for platform 1. Loaded as it stood, Chrome on iOS drew ASCII and lost or
  // misdrew the rest, curly quotes and dashes first. A format 4 Unicode
  // subtable is built from the Mac Roman one -- each byte's code point from
  // MACROMAN_HIGH, one segment per code point, idDelta doing the mapping --
  // and offered twice, as (0,3) and (3,1), which is what the copy in res/
  // that did work carries. The Mac Roman table stays for the Mac.
  if(cmap&&!hasUnicodeCmap){
    const c=cmap.bytes; const n=u16be(c,2); let mac=null;
    for(let i=0;i<n;i++){ const p=4+i*8; const off=u32be(c,p+4); if(u16be(c,p)===1&&u16be(c,off)===0) mac=c.slice(off,off+262); }
    if(mac){
      const pairs=[];
      for(let b=0x20;b<256;b++){ const g=mac[6+b]; if(!g) continue; const cp=b<0x80?b:MACROMAN_HIGH[b-0x80]; if(cp!==undefined&&cp<0xFFFF) pairs.push([cp,g]); }
      // A no-break space is a space; the Mac table has no byte for it.
      if(mac[6+0x20]&&!pairs.some(p=>p[0]===0xA0)) pairs.push([0xA0,mac[6+0x20]]);
      pairs.sort((a,b)=>a[0]-b[0]);
      const segs=pairs.map(([cp,g])=>({start:cp,end:cp,delta:(g-cp)&0xFFFF})).concat([{start:0xFFFF,end:0xFFFF,delta:1}]);
      const sc=segs.length, len=16+sc*8;
      const f4=new Uint8Array(len); const dv=new DataView(f4.buffer);
      let es=1, esl=0; while(es*2<=sc){ es*=2; esl++; }
      dv.setUint16(0,4); dv.setUint16(2,len); dv.setUint16(4,0);
      dv.setUint16(6,sc*2); dv.setUint16(8,es*2); dv.setUint16(10,esl); dv.setUint16(12,sc*2-es*2);
      segs.forEach((sg,i)=>{ dv.setUint16(14+i*2,sg.end); dv.setUint16(16+sc*2+i*2,sg.start); dv.setUint16(16+sc*4+i*2,sg.delta); dv.setUint16(16+sc*6+i*2,0); });
      // Three records, platform-ordered: (0,3) and (3,1) share the new
      // subtable, (1,0) keeps the old one.
      const out=new Uint8Array(4+3*8+f4.length+mac.length); const odv=new DataView(out.buffer);
      odv.setUint16(0,0); odv.setUint16(2,3);
      const uniOff=4+24, macOff=uniOff+f4.length;
      [[0,3,uniOff],[1,0,macOff],[3,1,uniOff]].forEach(([pl,en,off],i)=>{ odv.setUint16(4+i*8,pl); odv.setUint16(6+i*8,en); odv.setUint32(8+i*8,off); });
      out.set(f4,uniOff); out.set(mac,macOff);
      cmap.bytes=out;
    }
  }
  if(find('OS/2')) return rebuildSfnt(data,tables);
  const unitsPerEm=u16be(head.bytes,18);
  const ascender=s16(hhea.bytes,4), descender=s16(hhea.bytes,6), lineGap=s16(hhea.bytes,8);
  const numHMetrics=u16be(hhea.bytes,34), numGlyphs=u16be(maxp.bytes,4);
  let sum=0, n=0;
  for(let i=0;i<numHMetrics;i++){ const w=u16be(hmtx.bytes,i*4); if(w){ sum+=w; n++; } }
  const os2=new Uint8Array(96); const dv=new DataView(os2.buffer);
  dv.setUint16(0,3);                              // version 3
  dv.setInt16(2,n?Math.round(sum/n):0);           // xAvgCharWidth
  dv.setUint16(4,400); dv.setUint16(6,5);         // usWeightClass normal, usWidthClass medium
  dv.setUint16(8,0);                              // fsType: installable
  const sub=Math.round(unitsPerEm*0.65), subOff=Math.round(unitsPerEm*0.14);
  [sub,sub,0,subOff,sub,sub,0,Math.round(unitsPerEm*0.48)].forEach((v,i)=>dv.setInt16(10+i*2,v));
  dv.setInt16(26,Math.round(unitsPerEm*0.05)); dv.setInt16(28,Math.round(unitsPerEm*0.26)); // strikeout
  // sFamilyClass 0, panose all 0, unicode ranges: Basic Latin + Latin-1
  dv.setUint32(42,0x00000003);
  os2.set([0x20,0x20,0x20,0x20],58);              // achVendID: blank
  dv.setUint16(62,0x0040);                        // fsSelection: REGULAR
  dv.setUint16(64,0x0020); dv.setUint16(66,0x00FF); // usFirstCharIndex, usLastCharIndex
  dv.setInt16(68,ascender); dv.setInt16(70,descender); dv.setInt16(72,lineGap);
  dv.setUint16(74,Math.max(0,ascender)); dv.setUint16(76,Math.max(0,-descender)); // usWinAscent/Descent
  dv.setUint32(78,0x00000001);                    // ulCodePageRange1: Latin 1
  dv.setInt16(86,Math.round(unitsPerEm*0.5)); dv.setInt16(88,Math.round(unitsPerEm*0.7)); // sxHeight, sCapHeight
  dv.setUint16(90,0); dv.setUint16(92,0x20); dv.setUint16(94,1); // usDefaultChar, usBreakChar, usMaxContext
  tables.push({tag:'OS/2', bytes:os2});
  return rebuildSfnt(data,tables);
}
/* The other direction: a TrueType font from today, made fit for the game.

   sfntToTrueType gives a browser a font the classic Mac made. This gives the
   classic Mac a font the modern world made, which is a different problem: the
   Mac addresses glyphs by MAC ROMAN BYTE through a platform-1 cmap subtable,
   and a font built this century almost always carries a Unicode cmap and
   nothing else. Loaded as it stands such a font draws nothing at all in
   Cythera -- every byte the game passes misses.

   So: read whatever Unicode subtable the font has, look up the code point
   each Mac Roman byte stands for (MACROMAN_HIGH again, the same table read
   the other way round), and write a platform-1 subtable of the results. Format
   0 is the 1984 one every Mac understands and holds a byte per glyph, so it
   can only name the first 256 glyphs; a font whose Latin-1 accents live above
   that gets format 6 instead, which is also in the 1990 specification and
   which the Font Manager reads. The Unicode subtable is kept alongside, so the
   same bytes still preview in a browser.

   Layout tables (GPOS, GSUB, GDEF) and the digital signature are dropped:
   the classic rasteriser reads none of them, and they are most of the weight
   of a modern font. The name table is left as it came, since a classic Mac
   takes the family name from the FOND resource rather than from the font. */
function sfntUnicodeLookup(c){
  const n=u16be(c,2); const subs=[];
  for(let i=0;i<n;i++){ const p=4+i*8; subs.push({pl:u16be(c,p), enc:u16be(c,p+2), off:u32be(c,p+4)}); }
  // Best first: Unicode full repertoire, then BMP, then Windows symbol.
  const rank=s=>(s.pl===3&&s.enc===10)?0:(s.pl===0)?1:(s.pl===3&&s.enc===1)?2:(s.pl===3&&s.enc===0)?3:9;
  subs.sort((a,b)=>rank(a)-rank(b));
  for(const s of subs){
    if(rank(s)===9) continue;
    const o=s.off, fmt=u16be(c,o);
    if(fmt===4){
      const segX2=u16be(c,o+6), seg=segX2/2;
      const endO=o+14, startO=endO+segX2+2, deltaO=startO+segX2, rangeO=deltaO+segX2;
      return cp=>{
        if(cp>0xFFFF) return 0;
        for(let i=0;i<seg;i++){
          if(u16be(c,endO+i*2)<cp) continue;
          const st=u16be(c,startO+i*2);
          if(st>cp) return 0;
          const ro=u16be(c,rangeO+i*2);
          if(!ro) return (cp+s16(c,deltaO+i*2))&0xFFFF;
          const gi=rangeO+i*2+ro+(cp-st)*2;
          if(gi+1>=c.length) return 0;
          const g=u16be(c,gi);
          return g?((g+s16(c,deltaO+i*2))&0xFFFF):0;
        }
        return 0;
      };
    }
    if(fmt===12){
      const groups=u32be(c,o+12);
      return cp=>{
        for(let i=0;i<groups;i++){
          const g=o+16+i*12, a=u32be(c,g), b=u32be(c,g+4);
          if(cp>=a&&cp<=b) return u32be(c,g+8)+(cp-a);
        }
        return 0;
      };
    }
    if(fmt===6){
      const first=u16be(c,o+6), count=u16be(c,o+8);
      return cp=>(cp>=first&&cp<first+count)?u16be(c,o+10+(cp-first)*2):0;
    }
    if(fmt===0) return cp=>(cp<256?c[o+6+cp]:0);
  }
  return null;
}
const SFNT_DROP_TABLES = ['GPOS','GSUB','GDEF','DSIG','FFTM','LTSH','VDMX','hdmx','gasp','BASE','JSTF','MATH'];
function trueTypeToSfnt(data){
  if(data.length<12) throw new Error('that file is too short to be a font');
  const scaler=String.fromCharCode(data[0],data[1],data[2],data[3]);
  const ver=u32be(data,0);
  if(scaler==='ttcf') throw new Error('that is a font collection (.ttc). Save one face out of it as a .ttf first.');
  if(scaler==='OTTO') throw new Error('that font draws with PostScript outlines (OpenType CFF). The classic Mac only rasterises TrueType outlines, so it needs a .ttf rather than an .otf.');
  if(ver!==0x00010000&&scaler!=='true') throw new Error('that file does not begin like a TrueType font');
  const numTables=u16be(data,4);
  const tables=[];
  for(let i=0;i<numTables;i++){
    const p=12+i*16;
    const tag=String.fromCharCode(data[p],data[p+1],data[p+2],data[p+3]);
    const off=u32be(data,p+8), len=u32be(data,p+12);
    if(off+len>data.length) throw new Error('the font’s '+tag+' table runs past the end of the file');
    if(SFNT_DROP_TABLES.indexOf(tag)>=0) continue;
    tables.push({tag, bytes:data.slice(off,off+len)});
  }
  const find=t=>tables.find(x=>x.tag===t);
  for(const need of ['head','hhea','hmtx','maxp','glyf','loca','cmap'])
    if(!find(need)) throw new Error('the font has no '+need+' table, so the Mac cannot draw with it'+(need==='glyf'?' (it is probably an .otf renamed)':''));
  const c=find('cmap').bytes;
  const look=sfntUnicodeLookup(c);
  if(!look) throw new Error('the font’s character map is in a form this page cannot read');
  // Mac Roman byte -> glyph, for every byte the game can pass.
  const gid=new Array(256).fill(0);
  let widest=0, mapped=0;
  for(let b=0x20;b<256;b++){
    const cp=b<0x80?b:MACROMAN_HIGH[b-0x80];
    if(cp===undefined) continue;
    const g=look(cp);
    if(!g) continue;
    gid[b]=g; mapped++;
    if(g>widest) widest=g;
  }
  if(mapped<32) throw new Error('the font has fewer than 32 of the characters the game uses, so it would draw mostly blanks');
  let macSub;
  if(widest<256){
    macSub=new Uint8Array(262); const dv=new DataView(macSub.buffer);
    dv.setUint16(0,0); dv.setUint16(2,262); dv.setUint16(4,0);
    for(let b=0;b<256;b++) macSub[6+b]=gid[b];
  } else {
    const first=0x20, count=0x100-first;
    macSub=new Uint8Array(10+count*2); const dv=new DataView(macSub.buffer);
    dv.setUint16(0,6); dv.setUint16(2,macSub.length); dv.setUint16(4,0);
    dv.setUint16(6,first); dv.setUint16(8,count);
    for(let i=0;i<count;i++) dv.setUint16(10+i*2,gid[first+i]);
  }
  // The best Unicode subtable, kept as it came, so a browser can still read
  // the font out of the archive afterwards.
  const n=u16be(c,2); let uni=null;
  for(let i=0;i<n;i++){ const p=4+i*8, pl=u16be(c,p), en=u16be(c,p+2), off=u32be(c,p+4);
    if((pl===3&&(en===1||en===10))||pl===0){ const fmt=u16be(c,off); const len=fmt===12?u32be(c,off+4):u16be(c,off+2);
      if(off+len<=c.length&&(!uni||fmt===4)) uni={pl:pl===0?0:3, en:pl===0?3:en, bytes:c.slice(off,off+len)}; } }
  const recs=[{pl:1,en:0,bytes:macSub}];
  if(uni) recs.push({pl:uni.pl,en:uni.en,bytes:uni.bytes});
  recs.sort((a,b)=>a.pl-b.pl||a.en-b.en);
  let need=4+recs.length*8; const offs=[];
  for(const r of recs){ offs.push(need); need+=r.bytes.length; }
  const out=new Uint8Array(need); const odv=new DataView(out.buffer);
  odv.setUint16(0,0); odv.setUint16(2,recs.length);
  recs.forEach((r,i)=>{ odv.setUint16(4+i*8,r.pl); odv.setUint16(6+i*8,r.en); odv.setUint32(8+i*8,offs[i]); out.set(r.bytes,offs[i]); });
  find('cmap').bytes=out;
  return { bytes: rebuildSfnt(data,tables), mapped, format: widest<256?0:6, dropped: numTables-tables.length };
}
// The table directory in tag order with fresh checksums, and the whole-font
// checksum adjustment in head, over whatever tables are handed in.
function rebuildSfnt(data,tables){
  const find=t=>tables.find(x=>x.tag===t);
  const head=find('head');
  tables.sort((a,b)=>a.tag<b.tag?-1:a.tag>b.tag?1:0);
  // head.checkSumAdjustment must be zero while the checksums are taken.
  const headOut=Uint8Array.from(head.bytes); headOut.fill(0,8,12); head.bytes=headOut;
  const pad4=n=>(n+3)&~3;
  const checksum=b=>{ let s=0; for(let i=0;i<b.length;i+=4) s=(s+(((b[i]||0)<<24)|((b[i+1]||0)<<16)|((b[i+2]||0)<<8)|(b[i+3]||0)))>>>0; return s>>>0; };
  const dirLen=12+tables.length*16;
  let total=dirLen; for(const t of tables) total+=pad4(t.bytes.length);
  const out=new Uint8Array(total); const odv=new DataView(out.buffer);
  out.set(data.subarray(0,4),0);                  // the scaler type, as it came
  odv.setUint16(4,tables.length);
  let es=1, esl=0; while(es*2<=tables.length){ es*=2; esl++; }
  odv.setUint16(6,es*16); odv.setUint16(8,esl); odv.setUint16(10,tables.length*16-es*16);
  let off=dirLen;
  tables.forEach((t,i)=>{
    const p=12+i*16;
    for(let k=0;k<4;k++) out[p+k]=t.tag.charCodeAt(k);
    odv.setUint32(p+4,checksum(t.bytes)); odv.setUint32(p+8,off); odv.setUint32(p+12,t.bytes.length);
    out.set(t.bytes,off); t.off=off; off+=pad4(t.bytes.length);
  });
  const headT=tables.find(t=>t.tag==='head');
  odv.setUint32(headT.off+8,(0xB1B0AFBA-checksum(out))>>>0);
  return out;
}

/* A TrueType font's glyphs as outlines, and a font with glyphs added.

   sfntGlyphOutlines(data) -> { upem, glyphs: [{ contours, adv, lsb }] }
     Every glyph as its contours, each a list of { x, y, on }, with its
     advance and left side bearing. A composite glyph comes back with
     `composite: true` and no contours: nothing here needs one decomposed
     yet (Argos A Nouveau has none), and a composite added as contours would
     be wrong without its components' transforms.
   sfntWithGlyphs(data, added, codes) -> { bytes, added, mapped }
     The font with `added` ({ contours, adv }) appended to its glyphs, and
     its Mac Roman cmap subtable (format 0, platform 1) pointing each code of
     `codes` ({ byte: index into added }) at one. glyf, loca, hmtx, maxp,
     hhea and head's bounds are written again; post goes to format 3, which
     names no glyphs, since a format 2 table would need a name for each new
     one and the Mac never reads them; the instructions of the old glyphs are
     kept and the new ones have none. Written 29 September 2026 for the
     translation's accented letters (js/delv-translate.js), which the proofs
     of 24 September built with fontTools in Python; this is the same
     arithmetic in the page, so a visitor's own copy of the font is the one
     changed. */
function sfntTablesOf(data){
  const out={}, n=u16be(data,4);
  for(let i=0;i<n;i++){ const p=12+i*16; const tag=String.fromCharCode(data[p],data[p+1],data[p+2],data[p+3]);
    out[tag]=data.subarray(u32be(data,p+8),u32be(data,p+8)+u32be(data,p+12)); }
  return out;
}
function sfntGlyphOutlines(data){
  const t=sfntTablesOf(data);
  for(const need of ['head','hhea','hmtx','maxp','glyf','loca']) if(!t[need]) throw new Error('the font has no '+need+' table');
  const s16=(b,o)=>(u16be(b,o)<<16)>>16;
  const upem=u16be(t.head,18), longLoca=s16(t.head,50)===1, n=u16be(t.maxp,4), nh=u16be(t.hhea,34);
  const loca=i=>longLoca?u32be(t.loca,i*4):u16be(t.loca,i*2)*2;
  const glyphs=[];
  for(let g=0;g<n;g++){
    const adv=u16be(t.hmtx,4*Math.min(g,nh-1)), lsb=g<nh?s16(t.hmtx,4*g+2):s16(t.hmtx,4*nh+2*(g-nh));
    const a=loca(g), z=loca(g+1);
    if(z<=a){ glyphs.push({contours:[],adv,lsb}); continue; }
    const b=t.glyf.subarray(a,z), nc=s16(b,0);
    if(nc<0){ glyphs.push({contours:[],adv,lsb,composite:true}); continue; }
    const ends=[]; for(let i=0;i<nc;i++) ends.push(u16be(b,10+2*i));
    const np=nc?ends[nc-1]+1:0;
    let p=10+2*nc; p+=2+u16be(b,p);
    const flags=[];
    while(flags.length<np){ const f=b[p++]; flags.push(f); if(f&8){ let r=b[p++]; while(r--) flags.push(f); } }
    const xs=[], ys=[];
    let v=0;
    for(const f of flags){ if(f&2){ const d=b[p++]; v+=(f&16)?d:-d; } else if(!(f&16)){ v+=s16(b,p); p+=2; } xs.push(v); }
    v=0;
    for(const f of flags){ if(f&4){ const d=b[p++]; v+=(f&32)?d:-d; } else if(!(f&32)){ v+=s16(b,p); p+=2; } ys.push(v); }
    const contours=[]; let k=0;
    for(const e of ends){ const c=[]; for(;k<=e;k++) c.push({x:xs[k],y:ys[k],on:!!(flags[k]&1)}); contours.push(c); }
    glyphs.push({contours,adv,lsb});
  }
  return {upem,glyphs};
}
function sfntEncodeGlyph(contours){
  const pts=[].concat(...contours);
  if(!pts.length) return new Uint8Array(0);
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const q of pts){ x0=Math.min(x0,q.x); y0=Math.min(y0,q.y); x1=Math.max(x1,q.x); y1=Math.max(y1,q.y); }
  const out=new Uint8Array(10+2*contours.length+2+pts.length*5), dv=new DataView(out.buffer);
  dv.setInt16(0,contours.length); dv.setInt16(2,x0); dv.setInt16(4,y0); dv.setInt16(6,x1); dv.setInt16(8,y1);
  let p=10, e=-1;
  for(const c of contours){ e+=c.length; dv.setUint16(p,e); p+=2; }
  dv.setUint16(p,0); p+=2;
  for(const q of pts) out[p++]=q.on?1:0;
  let v=0; for(const q of pts){ dv.setInt16(p,q.x-v); v=q.x; p+=2; }
  v=0; for(const q of pts){ dv.setInt16(p,q.y-v); v=q.y; p+=2; }
  return out;
}
function sfntWithGlyphs(data, added, codes, aliases){
  const t=sfntTablesOf(data);
  const {glyphs}=sfntGlyphOutlines(data);
  const s16=(b,o)=>(u16be(b,o)<<16)>>16;
  const longLoca=s16(t.head,50)===1;
  const loca=i=>longLoca?u32be(t.loca,i*4):u16be(t.loca,i*2)*2;
  const old=glyphs.length, total=old+added.length;
  if(!t.cmap) throw new Error('the font has no cmap');
  // The old glyphs' bytes as they are, instructions and all; the new ones after.
  const bodies=[];
  for(let g=0;g<old;g++) bodies.push(t.glyf.subarray(loca(g),loca(g+1)));
  let bx0=s16(t.head,36), by0=s16(t.head,38), bx1=s16(t.head,40), by1=s16(t.head,42);
  let maxPts=u16be(t.maxp,6), maxCon=u16be(t.maxp,8);
  const metrics=glyphs.map(g=>[g.adv,g.lsb]);
  for(const a of added){
    const body=sfntEncodeGlyph(a.contours);
    bodies.push(body);
    const pts=[].concat(...a.contours);
    const x0=pts.length?Math.min(...pts.map(q=>q.x)):0;
    metrics.push([a.adv,x0]);
    if(pts.length){ bx0=Math.min(bx0,x0); by0=Math.min(by0,...pts.map(q=>q.y)); bx1=Math.max(bx1,...pts.map(q=>q.x)); by1=Math.max(by1,...pts.map(q=>q.y)); }
    maxPts=Math.max(maxPts,pts.length); maxCon=Math.max(maxCon,a.contours.length);
  }
  const pad=n=>(n+3)&~3;
  let glen=0; for(const b of bodies) glen+=pad(b.length);
  const glyf=new Uint8Array(glen), locaOut=new Uint8Array((total+1)*4), ldv=new DataView(locaOut.buffer);
  let at=0;
  bodies.forEach((b,i)=>{ ldv.setUint32(i*4,at); glyf.set(b,at); at+=pad(b.length); });
  ldv.setUint32(total*4,at);
  const hmtx=new Uint8Array(total*4), hdv=new DataView(hmtx.buffer);
  metrics.forEach(([adv,lsb],i)=>{ hdv.setUint16(i*4,adv); hdv.setInt16(i*4+2,lsb); });
  const head=Uint8Array.from(t.head), headv=new DataView(head.buffer);
  headv.setInt16(36,bx0); headv.setInt16(38,by0); headv.setInt16(40,bx1); headv.setInt16(42,by1); headv.setInt16(50,1);
  const hhea=Uint8Array.from(t.hhea), hhv=new DataView(hhea.buffer);
  hhv.setUint16(34,total);
  hhv.setUint16(10,Math.max(u16be(t.hhea,10),...added.map(a=>a.adv)));
  const maxp=Uint8Array.from(t.maxp), mv=new DataView(maxp.buffer);
  mv.setUint16(4,total);
  if(maxp.length>=10){ mv.setUint16(6,maxPts); mv.setUint16(8,maxCon); }
  const post=new Uint8Array(32);
  if(t.post) post.set(t.post.subarray(0,32));
  new DataView(post.buffer).setUint32(0,0x00030000);
  // The Mac Roman subtable, format 0: a glyph index per byte, so every
  // glyph it names must be below 256.
  const cmap=Uint8Array.from(t.cmap);
  let mac=-1;
  for(let i=0;i<u16be(cmap,2);i++){ const p=4+i*8; if(u16be(cmap,p)===1&&u16be(cmap,p+2)===0) mac=u32be(cmap,p+4); }
  if(mac<0||u16be(cmap,mac)!==0) throw new Error('the font has no Mac Roman cmap of format 0 to map the new letters in');
  if(total>256) throw new Error('a format 0 cmap names glyphs below 256, and the font would have '+total);
  let mapped=0;
  for(const [code,i] of Object.entries(codes)){ cmap[mac+6+(+code)]=old+i; mapped++; }
  // A code drawn with a glyph the font has already (a no-break space as its space).
  for(const [code,g] of Object.entries(aliases||{})){ if(g>=total) throw new Error('no glyph '+g+' to map '+code+' to'); cmap[mac+6+(+code)]=g; mapped++; }
  const tables=[];
  for(const tag of Object.keys(t)){
    const bytes=tag==='glyf'?glyf:tag==='loca'?locaOut:tag==='hmtx'?hmtx:tag==='head'?head:tag==='hhea'?hhea:tag==='maxp'?maxp:tag==='post'?post:tag==='cmap'?cmap:Uint8Array.from(t[tag]);
    tables.push({tag,bytes});
  }
  return {bytes:rebuildSfnt(data,tables), added:added.length, mapped};
}

function decodeSfntInfo(data){
  if(data.length<12) throw new Error('sfnt resource too short');
  const numTables=u16be(data,4); const tables=[];
  let p=12;
  for(let i=0;i<numTables && p+16<=data.length;i++){
    tables.push(String.fromCharCode(data[p],data[p+1],data[p+2],data[p+3])); p+=16;
  }
  return {numTables,tables};
}


// ============================================================
//  Classic Mac system palettes + indexed icon families
// ============================================================
// Standard Mac OS 16-colour palette (icl4 / ics4).
const MAC_4BIT_PAL = [
  [255,255,255],[252,243,5],[255,100,3],[221,9,7],[242,8,132],[71,0,165],
  [0,0,211],[2,171,234],[31,183,20],[0,100,18],[86,44,5],[144,113,58],
  [192,192,192],[128,128,128],[64,64,64],[0,0,0]
];
// Standard Mac OS 256-colour system palette (icl8 / ics8). Indices 0-214 are
// the 6x6x6 colour cube with black removed, 215-254 are the pure red, green,
// blue and grey ramps, and 255 is black.
const MAC_8BIT_PAL = (function(){
  const p=[], lv=[255,204,153,102,51,0];
  for(const r of lv) for(const g of lv) for(const b of lv){
    if(r===0&&g===0&&b===0) continue;   // black is reserved for index 255
    p.push([r,g,b]);
  }
  const ramp=[238,221,187,170,136,119,85,68,34,17];
  for(const v of ramp) p.push([v,0,0]);
  for(const v of ramp) p.push([0,v,0]);
  for(const v of ramp) p.push([0,0,v]);
  for(const v of ramp) p.push([v,v,v]);
  p.push([0,0,0]);
  return p;
})();
// Kept for the older call sites that used the "approximate" name.
const MAC_8BIT_PAL_APPROX = MAC_8BIT_PAL;

// icl4/icl8/ics4/ics8 are bare pixel arrays: no header, no mask, no colour
// table. The mask lives in the matching ICN#/ics# resource, so if one is
// present in the same fork we use it for transparency.
function drawIndexedIcon(data, size, depth, palette, maskBits){
  const need = size*size*depth/8;
  if(data.length < need) throw new Error(`${size}\u00d7${size} ${depth}-bit icon needs ${need} bytes, got ${data.length}`);
  const ppb = 8/depth, mask=(1<<depth)-1, rowBytes=size*depth/8, mRow=size/8;
  const c=document.createElement('canvas'); c.width=size; c.height=size;
  const ctx=c.getContext('2d'), im=ctx.createImageData(size,size);
  const idx=new Uint8Array(size*size);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    const byte = data[y*rowBytes + Math.floor(x/ppb)] || 0;
    const pi = depth===8 ? byte : (byte >> ((ppb-1-(x%ppb))*depth)) & mask;
    const col = palette[pi] || [255,0,255];
    const o=(y*size+x)*4;
    let a=255;
    if(maskBits){ const mb=maskBits[y*mRow+(x>>3)]||0; a=((mb>>(7-(x&7)))&1)?255:0; }
    idx[y*size+x]=pi;
    im.data[o]=col[0]; im.data[o+1]=col[1]; im.data[o+2]=col[2]; im.data[o+3]=a;
  }
  ctx.putImageData(im,0,0);
  tagIndexed(c, size, size, idx, palette, maskBits);
  return c;
}
// ICN#/ics# hold a 1-bit image followed by a 1-bit mask of the same size.
function iconMaskFor(fork, size){
  const t = size===32 ? 'ICN#' : 'ics#';
  return id=>{
    const list=(fork.resourcesByType[t])||null;
    if(!list) return null;
    const e=list.find(r=>r.id===id); if(!e) return null;
    const d=fork.dataOf(t,e), half=size*size/8;
    return d.length>=half*2 ? d.slice(half, half*2) : null;
  };
}

// ============================================================
//  cicn (colour icon)
// ============================================================
// PixMap(50) | mask BitMap(14) | icon BitMap(14) | iconData handle(4) |
// mask bits | icon bits | ColorTable | pixel data
function decodeCicn(data){
  let p=0;
  p+=4;                                     // baseAddr placeholder
  const pmRowBytes=u16be(data,p)&0x3fff; p+=2;
  const pmBounds=readRect(data,p); p+=8;
  p+=2+2+4+4+4;                             // version, packType, packSize, hRes, vRes
  p+=2;                                     // pixelType
  const pixelSize=u16be(data,p); p+=2;
  p+=2+2+4+4+4;                             // cmpCount, cmpSize, planeBytes, pmTable, pmReserved
  const maskRowBytes=u16be(data,p+4)&0x3fff, maskBounds=readRect(data,p+6); p+=14;
  const iconRowBytes=u16be(data,p+4)&0x3fff, iconBounds=readRect(data,p+6); p+=14;
  p+=4;                                     // iconData handle
  const mH=maskBounds.bottom-maskBounds.top, iH=iconBounds.bottom-iconBounds.top;
  const maskBits=data.slice(p, p+maskRowBytes*mH); p+=maskRowBytes*mH;
  p+=iconRowBytes*iH;                       // 1-bit icon bits (unused when colour data exists)
  const ct=readColorTable(data,p); p=ct.p;
  const W=pmBounds.right-pmBounds.left, H=pmBounds.bottom-pmBounds.top;
  if(W<=0||H<=0||pixelSize>8) throw new Error(`Unsupported cicn (${W}\u00d7${H}, ${pixelSize}-bit)`);
  return renderIndexedPixels(data,p,pmRowBytes,W,H,pixelSize,ct.palette,maskBits,maskRowBytes);
}

// ============================================================
//  Structured text resources
// ============================================================
function pstr(data,p){ const n=data[p]||0; return {s:decodeMacRoman(data.slice(p+1,p+1+n)), p:p+1+n}; }

function decodeVers(data){
  if(data.length<6) throw new Error('vers too short');
  const maj=data[0].toString(16), min=(data[1]>>4)&0xf, bug=data[1]&0xf;
  const stageCode=data[2], nonRel=data[3], region=u16be(data,4);
  const stage={0x20:'development',0x40:'alpha',0x60:'beta',0x80:'released'}[stageCode]||('0x'+stageCode.toString(16));
  const a=pstr(data,6), b=pstr(data,a.p);
  return `Version: ${maj}.${min}${bug?'.'+bug:''}\nStage: ${stage}${stageCode!==0x80?' (build '+nonRel+')':''}\nRegion code: ${region}\nShort: ${a.s}\nLong: ${b.s}`;
}

const DITL_TYPES={0:'user item',1:'help item',4:'button',5:'check box',6:'radio button',7:'control',8:'static text',16:'edit text',32:'icon',64:'picture'};
function decodeDITL(data){
  const n=u16be(data,0)+1; let p=2, out=[`${n} item${n===1?'':'s'}`,''];
  for(let i=0;i<n && p+13<=data.length;i++){
    p+=4;
    const r=readRect(data,p); p+=8;
    const raw=data[p++], enabled=!(raw&0x80), kind=raw&0x7f;
    const len=data[p++]; let text='';
    // A control (7), an icon (32) and a picture (64) carry a resource id, not text.
    if(kind===7||kind===32||kind===64){ text='resource #'+u16be(data,p); }
    else text=decodeMacRoman(data.slice(p,p+len));
    p+=len; if(p%2)p++;
    out.push(`[${i+1}] ${DITL_TYPES[kind]||('type '+kind)}${enabled?'':' (disabled)'}`);
    out.push(`     (${r.left},${r.top})-(${r.right},${r.bottom})  ${text?'"'+text+'"':''}`);
  }
  return out.join('\n');
}

function decodeMENU(data){
  if(data.length<14) throw new Error('MENU too short');
  const id=u16be(data,0), procID=u16be(data,6), enable=u32be(data,10);
  let p=14; const t=pstr(data,p); p=t.p;
  const out=[`Menu #${id}  "${t.s}"`, `Proc ID: ${procID}   Enable flags: 0x${(enable>>>0).toString(16)}`, ''];
  let i=1;
  while(p<data.length && data[p]!==0){
    const it=pstr(data,p); p=it.p;
    if(p+4>data.length) break;
    const icon=data[p], key=data[p+1], mark=data[p+2], style=data[p+3]; p+=4;
    const bits=[]; if(style&1)bits.push('bold'); if(style&2)bits.push('italic');
    if(style&4)bits.push('underline'); if(style&8)bits.push('outline'); if(style&16)bits.push('shadow');
    let extra=[];
    if(key>0x1f) extra.push('Cmd-'+String.fromCharCode(key));
    if(mark) extra.push('mark '+String.fromCharCode(mark));
    if(icon) extra.push('icon '+(icon+256));
    if(bits.length) extra.push(bits.join('+'));
    out.push(it.s==='-' ? `[${i}] ---- separator ----`
                        : `[${i}] ${it.s}${extra.length?'   ('+extra.join(', ')+')':''}`);
    i++;
  }
  return out.join('\n');
}

// The items of a MENU and of a DITL as plain lists, item n at index n - 1,
// for a reader that wants an item's own text rather than the description
// the two decoders above print: a program that checks menu item 10 or
// dialog item 3 is named by what the resource says those items are.
function menuItemTexts(data){
  if(!data || data.length<14) return [];
  let p=pstr(data,14).p; const out=[];
  while(p<data.length && data[p]!==0){ const it=pstr(data,p); p=it.p+4; if(p>data.length) break; out.push(it.s); }
  return out;
}
function ditlItemTexts(data){
  if(!data || data.length<2) return [];
  const n=u16be(data,0)+1, out=[]; let p=2;
  for(let i=0;i<n && p+14<=data.length;i++){
    p+=12; const kind=data[p++]&0x7f, len=data[p++];
    out.push(kind===32||kind===64 ? '' : decodeMacRoman(data.slice(p,p+len)));
    p+=len; if(p%2)p++;
  }
  return out;
}

function decodeWIND(data){
  if(data.length<18) throw new Error('WIND too short');
  const r=readRect(data,0), procID=u16be(data,8), visible=!!data[10], goAway=!!data[12], refCon=u32be(data,14);
  const t=data.length>18?pstr(data,18).s:'';
  return `Window: "${t}"\nBounds: (${r.left},${r.top})-(${r.right},${r.bottom})  ${r.right-r.left}\u00d7${r.bottom-r.top}\nProc ID: ${procID}   Visible: ${visible}   Close box: ${goAway}\nRefCon: ${refCon}`;
}

function decodeALRT(data){
  if(data.length<12) throw new Error('ALRT too short');
  const r=readRect(data,0), itemsID=u16be(data,8), stages=u16be(data,10);
  return `Alert\nBounds: (${r.left},${r.top})-(${r.right},${r.bottom})  ${r.right-r.left}\u00d7${r.bottom-r.top}\nDITL resource: #${itemsID}\nStages word: 0x${stages.toString(16).padStart(4,'0')}`;
}

function decodeCNTL(data){
  if(data.length<22) throw new Error('CNTL too short');
  const r=readRect(data,0), value=s16(data,8), visible=!!data[10],
        max=s16(data,12), min=s16(data,14), procID=s16(data,16), refCon=u32be(data,18);
  const title=pstr(data,22).s;
  // procID is CDEF resource id * 16 + variant code.
  return `Control: "${title}"\nBounds: (${r.left},${r.top})-(${r.right},${r.bottom})  ${r.right-r.left}×${r.bottom-r.top}\n`+
         `Value: ${value}   Range: ${min}–${max}   Visible: ${visible}\n`+
         `Proc ID: ${procID}  (CDEF ${procID>>4}, variant ${procID&15})\nRefCon: ${refCon}`;
}

// A bare list of QuickDraw rectangles; ResEdit calls it "rectangle list".
function decodeNrct(data){
  if(data.length<2) throw new Error('nrct too short');
  const n=u16be(data,0), out=[`${n} rectangle${n===1?'':'s'}`,''];
  for(let i=0;i<n && 2+i*8+8<=data.length;i++){
    const r=readRect(data,2+i*8);
    out.push(`[${i+1}] (${r.left},${r.top})-(${r.right},${r.bottom})   ${r.right-r.left}×${r.bottom-r.top}`);
  }
  return out.join('\n');
}

// TextEdit style scrap: numRuns, then 20-byte ScrpSTElement records.
const FACE_BITS=[[1,'bold'],[2,'italic'],[4,'underline'],[8,'outline'],[16,'shadow'],[32,'condensed'],[64,'extended']];
function decodeStyl(data){
  if(data.length<2) throw new Error('styl too short');
  const n=u16be(data,0), out=[`${n} style run${n===1?'':'s'}`,''];
  for(let i=0;i<n && 2+i*20+20<=data.length;i++){
    const p=2+i*20;
    const start=u32be(data,p), height=s16(data,p+4), ascent=s16(data,p+6),
          font=u16be(data,p+8), face=data[p+10], size=u16be(data,p+12);
    const rgb=[u16be(data,p+14)>>8,u16be(data,p+16)>>8,u16be(data,p+18)>>8];
    const faces=FACE_BITS.filter(([b])=>face&b).map(([,n])=>n);
    out.push(`[${i+1}] from character ${start}: font ${font}, ${size} pt${faces.length?', '+faces.join('+'):''}`);
    out.push(`     height ${height}, ascent ${ascent}, colour rgb(${rgb.join(',')})`);
  }
  return out.join('\n');
}

// Palette resource. The header is 16 bytes (pmEntries plus seven reserved
// words), then one 16-byte ColorInfo per entry -- verified against a 4,112
// byte / 256-entry pltt, which only adds up with a 16-byte header.
const PLTT_USAGE={0x0000:'courteous',0x0001:'tolerant',0x0002:'animated',0x0004:'explicit'};
function decodePltt(data){
  if(data.length<16) throw new Error('pltt too short');
  const n=u16be(data,0);
  if(16+n*16>data.length) throw new Error(`pltt declares ${n} entries but is only ${data.length} bytes`);
  const pal=[], usage=[];
  for(let i=0;i<n;i++){
    const p=16+i*16;
    pal.push([u16be(data,p)>>8,u16be(data,p+2)>>8,u16be(data,p+4)>>8]);
    usage.push(u16be(data,p+6));
  }
  const kinds=[...new Set(usage.map(u=>PLTT_USAGE[u&7]||'0x'+u.toString(16)))];
  return {canvas:swatchGrid(pal), count:n, usage:kinds.join(', ')};
}
function swatchGrid(pal){
  const perRow=16, cell=20;
  const canvas=document.createElement('canvas');
  canvas.width=perRow*cell; canvas.height=Math.max(1,Math.ceil(pal.length/perRow))*cell;
  const ctx=canvas.getContext('2d');
  for(let i=0;i<pal.length;i++){
    const col=pal[i]||[0,0,0];
    ctx.fillStyle=`rgb(${col[0]},${col[1]},${col[2]})`;
    ctx.fillRect((i%perRow)*cell,Math.floor(i/perRow)*cell,cell,cell);
  }
  return canvas;
}

// ICON is a bare 32x32 1-bit image (no mask); SICN is a run of 16x16 ones.
function decodeICON(data){
  if(data.length<128) throw new Error(`ICON needs 128 bytes, got ${data.length}`);
  return decode1bitIcon(data,32);
}
function decodeSICN(data){
  const n=Math.floor(data.length/32);
  if(!n) throw new Error('SICN is shorter than one 16×16 icon');
  const out=[];
  for(let i=0;i<n;i++) out.push(decode1bitIcon(data.slice(i*32,(i+1)*32),16));
  return out;
}
// PAT# is a count followed by that many 8-byte patterns.
function decodePATList(data){
  if(data.length<2) throw new Error('PAT# too short');
  const n=u16be(data,0), out=[];
  for(let i=0;i<n && 2+i*8+8<=data.length;i++) out.push(decodePAT(data.slice(2+i*8,10+i*8)));
  if(!out.length) throw new Error('PAT# contains no patterns');
  return out;
}

// ============================================================
//  Bitmap fonts (NFNT/FONT) and font families (FOND)
// ============================================================
// FontRec: a single wide bitmap holding every glyph side by side, plus a
// location table giving each glyph's left edge in that strip.
function decodeNFNT(data){
  if(data.length<26) throw new Error('NFNT too short');
  const fontType=u16be(data,0), firstChar=u16be(data,2), lastChar=u16be(data,4),
        widMax=u16be(data,6), kernMax=s16(data,8), nDescent=s16(data,10),
        fRectWidth=u16be(data,12), fRectHeight=u16be(data,14), owTLoc=u16be(data,16),
        ascent=u16be(data,18), descent=u16be(data,20), leading=u16be(data,22), rowWords=u16be(data,24);
  if(lastChar<firstChar || lastChar>255) throw new Error(`implausible character range ${firstChar}–${lastChar}`);
  if(!rowWords || !fRectHeight) throw new Error('font has an empty bit image');
  const strikeBytes=rowWords*2*fRectHeight;
  if(26+strikeBytes>data.length) throw new Error('bit image runs past the end of the resource');
  const strike=data.slice(26,26+strikeBytes);
  const strikeW=rowWords*16;
  const canvas=drawBits(strike,strikeW,fRectHeight,rowWords*2);
  // Location table: one entry per glyph plus the missing-symbol and a final
  // sentinel, so glyph i occupies columns loc[i]..loc[i+1].
  const nGlyphs=lastChar-firstChar+2;          // includes the missing symbol
  const locOff=26+strikeBytes;
  const loc=[];
  for(let i=0;i<=nGlyphs && locOff+i*2+2<=data.length;i++) loc.push(u16be(data,locOff+i*2));
  const glyphs=[];
  for(let i=0;i<nGlyphs && i+1<loc.length;i++){
    const w=loc[i+1]-loc[i];
    if(w<=0) continue;                          // no image: this code is unmapped
    glyphs.push({code:firstChar+i, width:w, canvas:cropBits(strike,rowWords*2,fRectHeight,loc[i],w),
                 missing:i===nGlyphs-1});
  }
  return {canvas, glyphs, firstChar, lastChar, ascent, descent, leading, widMax,
          fRectWidth, fRectHeight, strikeW, kernMax, nDescent, fontType, owTLoc,
          info:`chars ${firstChar}–${lastChar} · ${glyphs.length} glyphs · ${fRectWidth}×${fRectHeight} cell · `+
               `ascent ${ascent}, descent ${descent}, leading ${leading} · strike ${strikeW}×${fRectHeight}`};
}
// 1-bit rows, set bit = black, transparent background.
function drawBits(bits,W,H,rowBytes){
  const c=document.createElement('canvas'); c.width=W; c.height=H;
  const ctx=c.getContext('2d'), im=ctx.createImageData(W,H);
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const on=((bits[y*rowBytes+(x>>3)]||0)>>(7-(x&7)))&1, o=(y*W+x)*4;
    im.data[o]=im.data[o+1]=im.data[o+2]=on?0:255;
    im.data[o+3]=on?255:0;
  }
  ctx.putImageData(im,0,0); return c;
}
function cropBits(bits,rowBytes,H,x0,W){
  const c=document.createElement('canvas'); c.width=W; c.height=H;
  const ctx=c.getContext('2d'), im=ctx.createImageData(W,H);
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const sx=x0+x, on=((bits[y*rowBytes+(sx>>3)]||0)>>(7-(sx&7)))&1, o=(y*W+x)*4;
    im.data[o]=im.data[o+1]=im.data[o+2]=on?0:255;
    im.data[o+3]=on?255:0;
  }
  ctx.putImageData(im,0,0); return c;
}
/* Every glyph, laid out so a typeface looks like one.

   The strike is one wide bit image -- 272x14 for Seldane at 12 point, 400x21
   at 18 -- and a gallery cell fits a picture to about 84 by 96, so the whole
   font was being drawn four pixels tall. It was on the Fonts tab the entire
   time and could not be seen, which is the same as not being there.

   So a font's first picture is now the alphabet: every glyph the strike
   carries, cut out at its own width and set in a grid. The proportions are
   near enough square that the cell scaler shows it at a useful size, and the
   detail view gets the same picture larger.

   Glyphs are drawn from the location table rather than from the strike
   wholesale, so a code the font has no image for takes no cell: Seldane has
   25 letters and shows 25, not 26 with a gap. */
function glyphSheet(f){
  const cells=f.glyphs.filter(g=>g.canvas&&g.width>0);
  if(!cells.length) return null;
  const cols=Math.min(cells.length, Math.max(8, Math.ceil(Math.sqrt(cells.length*1.6))));
  const rows=Math.ceil(cells.length/cols);
  const cw=Math.max(...cells.map(g=>g.width))+3, ch=f.fRectHeight+3;
  const c=document.createElement('canvas');
  c.width=cols*cw+1; c.height=rows*ch+1;
  const ctx=c.getContext('2d');
  if(!ctx) return null;
  cells.forEach((g,i)=>{
    const x=(i%cols)*cw+2, y=Math.floor(i/cols)*ch+2;
    ctx.drawImage(g.canvas, x, y);
  });
  return c;
}

/* The bitmap font, the other way.

   `decodeNFNT` reads what it needs to draw a strike and stops; writing one
   back needs the two tables it walks past, and needs them exactly, because the
   only evidence that a font format has been understood is that the shipped
   font comes back byte for byte. Both of Cythera's do -- NFNT 25740 (904
   bytes) and 25746 (1,478), the Seldane script at 12 and 18 point -- and a
   single flipped bit in the strike moves the output, which is the control that
   says the strike is being written rather than copied from the input.

   The layout, and the one field that has to be counted right: the location
   table has nGlyphs + 1 entries, the sentinel included, and the offset/width
   table has nGlyphs. Reading both as nGlyphs + 1 makes every font two bytes
   too long, which is how this was found.

   `owTLoc` is measured in words from the address of the `owTLoc` field
   itself -- byte 16 -- not from the start of the resource. */
function nfntSpec(data){
  if(data.length<26) throw new Error('NFNT too short');
  // kernMax and nDescent are signed: kernMax is the furthest a glyph may sit
  // LEFT of the pen, and it is -1 in both Seldane strikes. Read unsigned it is
  // 65535, and every left bearing computed from it is 65536 pixels out; that
  // stayed invisible for as long as nothing did arithmetic with it, because
  // writeNFNT puts the same two bytes back either way and 65536 pixels is a
  // whole number of ems, so even the TrueType writer wrapped to the right
  // answer. The check that fills the outlines back to pixels is what saw it.
  const f={fontType:u16be(data,0), firstChar:u16be(data,2), lastChar:u16be(data,4),
           widMax:u16be(data,6), kernMax:s16(data,8), nDescent:s16(data,10),
           fRectWidth:u16be(data,12), fRectHeight:u16be(data,14), owTLoc:u16be(data,16),
           ascent:u16be(data,18), descent:u16be(data,20), leading:u16be(data,22),
           rowWords:u16be(data,24)};
  f.strikeBytes=f.rowWords*2*f.fRectHeight;
  if(26+f.strikeBytes>data.length) throw new Error('bit image runs past the end of the resource');
  f.strike=data.slice(26,26+f.strikeBytes);
  f.nGlyphs=f.lastChar-f.firstChar+2;                 // the missing symbol included
  const locOff=26+f.strikeBytes;
  f.loc=[]; for(let i=0;i<=f.nGlyphs;i++) f.loc.push(u16be(data,locOff+i*2));
  f.owOff=16+f.owTLoc*2;
  f.ow=[];  for(let i=0;i<f.nGlyphs;i++)  f.ow.push(u16be(data,f.owOff+i*2));
  f.tail=data.slice(f.owOff+f.nGlyphs*2);
  return f;
}
function writeNFNT(f){
  const head=[f.fontType,f.firstChar,f.lastChar,f.widMax,f.kernMax,f.nDescent,
              f.fRectWidth,f.fRectHeight,f.owTLoc,f.ascent,f.descent,f.leading,f.rowWords];
  const locOff=26+f.strikeBytes;
  const out=new Uint8Array(f.owOff+f.nGlyphs*2+f.tail.length);
  const put=(o,v)=>{ out[o]=(v>>8)&255; out[o+1]=v&255; };
  head.forEach((v,i)=>put(i*2,v));
  out.set(f.strike,26);
  f.loc.forEach((v,i)=>put(locOff+i*2,v));
  f.ow.forEach((v,i)=>put(f.owOff+i*2,v));
  out.set(f.tail,f.owOff+f.nGlyphs*2);
  return out;
}

/* A pixel font's outlines as pixels: a glyph drawn in squares on a grid
   (FontStruct's fonts are, `unit` font units a square) comes back as the
   squares it was drawn with, [x, y] from the pen origin with y up, the row
   above the baseline being 0. A square is lit when its centre is inside
   the outline by non-zero winding, which is exact for outlines that run
   along the grid. The points are taken as a polygon; an off-curve point
   would be read as a corner, so a glyph with one is refused rather than
   guessed at. */
function sfntPixels(glyph, unit){
  const cs=glyph.contours;
  if(!cs.length) return [];
  for(const c of cs) for(const q of c) if(!q.on) throw new Error('a glyph with a curve is not a pixel glyph');
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const c of cs) for(const q of c){ x0=Math.min(x0,q.x); y0=Math.min(y0,q.y); x1=Math.max(x1,q.x); y1=Math.max(y1,q.y); }
  const out=[];
  for(let i=Math.floor(x0/unit);i<Math.ceil(x1/unit);i++) for(let j=Math.floor(y0/unit);j<Math.ceil(y1/unit);j++){
    const px=(i+0.5)*unit, py=(j+0.5)*unit;
    let wn=0;
    for(const c of cs) for(let k=0;k<c.length;k++){
      const a=c[k], b=c[(k+1)%c.length], cross=(b.x-a.x)*(py-a.y)-(px-a.x)*(b.y-a.y);
      if(a.y<=py&&py<b.y&&cross>0) wn++;
      else if(b.y<=py&&py<a.y&&cross<0) wn--;
    }
    if(wn) out.push([i,j]);
  }
  return out;
}
// A font's glyph for each Mac Roman code: from its (1, 0) cmap, format 0,
// when it has one, and otherwise from a Unicode cmap, format 4, each code
// through its code point (MACROMAN_HIGH above 0x7F). FontStruct's fonts
// carry only the Unicode ones.
function sfntMacRomanGlyphs(data){
  const cmap=sfntTablesOf(data).cmap;
  if(!cmap) throw new Error('the font has no cmap');
  const subs=[];
  for(let i=0;i<u16be(cmap,2);i++){ const p=4+i*8; subs.push({pl:u16be(cmap,p),en:u16be(cmap,p+2),at:u32be(cmap,p+4)}); }
  const mac=subs.find(t=>t.pl===1&&t.en===0&&u16be(cmap,t.at)===0);
  if(mac) return Array.from(cmap.subarray(mac.at+6,mac.at+6+256));
  const uni=subs.find(t=>(t.pl===0||(t.pl===3&&t.en===1))&&u16be(cmap,t.at)===4);
  if(!uni) throw new Error('the font has neither a Mac Roman nor a Unicode cmap');
  const at=uni.at, segX2=u16be(cmap,at+6), ends=at+14, starts=ends+segX2+2, deltas=starts+segX2, ranges=deltas+segX2;
  const lookup=cp=>{
    for(let k=0;k<segX2/2;k++){
      if(cp>u16be(cmap,ends+2*k)) continue;
      const start=u16be(cmap,starts+2*k);
      if(cp<start) return 0;
      const delta=u16be(cmap,deltas+2*k), ro=u16be(cmap,ranges+2*k);
      if(!ro) return (cp+delta)&0xFFFF;
      const g=u16be(cmap,ranges+2*k+ro+2*(cp-start));
      return g?(g+delta)&0xFFFF:0;
    }
    return 0;
  };
  const out=[];
  for(let c=0;c<256;c++) out.push(lookup(c<0x80?c:MACROMAN_HIGH[c-0x80]));
  return out;
}

/* A strike from pixels: `f` gives the frame (ascent, descent, leading) and
   `glyphs`, a code's { px: [[x, y]], adv } with x from the pen origin and y
   up from the baseline, and `missing`, the glyph drawn for a code with
   none. Every width is the caller's, so a strike can draw one font's
   letters at another's widths. Written as nfntSpec reads one: a glyph's
   image is its columns from its leftmost pixel to its rightmost, its
   offset that leftmost column less kernMax, kernMax the furthest left any
   glyph starts (never right of the pen), fRectWidth the widest reach from
   kernMax, nDescent the negated ascent as Apple's own strikes have it,
   and widMax the widest advance. A pixel outside the frame is refused. */
function nfntFromPixels(f){
  const H=f.ascent+f.descent, all=[];
  for(let c=0;c<256;c++) all.push(f.glyphs[c]||null);
  all.push(f.missing);
  let kernMax=0, widMax=0, reach=0, cols=0;
  const boxes=all.map(g=>{
    if(!g) return null;
    widMax=Math.max(widMax,g.adv);
    if(!g.px.length) return {x0:0,w:0};
    let x0=Infinity,x1=-Infinity;
    for(const [x,y] of g.px){
      if(y>=f.ascent||y<-f.descent) throw new Error('a glyph reaches outside the strike\'s frame');
      x0=Math.min(x0,x); x1=Math.max(x1,x);
    }
    kernMax=Math.min(kernMax,x0);
    return {x0,w:x1-x0+1};
  });
  const loc=[];
  boxes.forEach(b=>{ loc.push(cols); if(b){ cols+=b.w; reach=Math.max(reach,b.x0+b.w); } });
  loc.push(cols);
  const rowWords=Math.max(1,Math.ceil(cols/16)), row=rowWords*2, strike=new Uint8Array(row*H);
  all.forEach((g,i)=>{
    if(!g) return;
    for(const [x,y] of g.px){ const dx=loc[i]+x-boxes[i].x0, dy=f.ascent-1-y; strike[dy*row+(dx>>3)]|=0x80>>(dx&7); }
  });
  const n=all.length, owOff=26+strike.length+(n+1)*2;
  const ow=all.map((g,i)=>g?(((boxes[i].w?boxes[i].x0-kernMax:0)&0xFF)<<8)|(g.adv&0xFF):0xFFFF);
  return writeNFNT({fontType:0x9000, firstChar:0, lastChar:255, widMax, kernMax, nDescent:-f.ascent,
    fRectWidth:reach-kernMax, fRectHeight:H, owTLoc:(owOff-16)/2, ascent:f.ascent, descent:f.descent, leading:f.leading,
    rowWords, strikeBytes:strike.length, strike, loc, ow, owOff, nGlyphs:n, tail:new Uint8Array([0xFF,0xFF])});
}

/* A font family record for strikes of one's own, written whole: family
   `famID`, the association table `entries` ([size, style, NFNT id]), and
   the family's frame as fractions of an em in 4.12 fixed point from the
   strike given as `m` (its size, ascent, descent, leading, widMax). The
   flags are 0x7000, as Apple's Geneva has them, which say the family has
   no fractional widths and the strikes' own integer widths are the ones to
   use; there is no width table, no kerning and no style table, and every
   style's extra width is 0, which is also Geneva's. */
function fondForStrikes(famID, entries, m){
  const out=new Uint8Array(52+2+entries.length*6), dv=new DataView(out.buffer);
  const em=v=>Math.round(v/m.size*4096);
  dv.setUint16(0,0x7000); dv.setUint16(2,famID); dv.setUint16(4,0); dv.setUint16(6,255);
  dv.setInt16(8,em(m.ascent)); dv.setInt16(10,-em(m.descent)); dv.setInt16(12,em(m.leading)); dv.setInt16(14,em(m.widMax));
  dv.setUint16(50,2);
  dv.setUint16(52,entries.length-1);
  entries.forEach(([size,style,id],i)=>{ dv.setUint16(54+i*6,size); dv.setUint16(56+i*6,style); dv.setUint16(58+i*6,id); });
  return out;
}

/* The strike as a TrueType font, so it can leave here.

   `writeNFNT` puts a modern face into the game. This is the other direction
   and the one a reader asks for: the Seldane script out of the game and into
   a font a phone, a browser or a word processor can set text in. Cythera
   Guides distributes a Seldane TrueType already, traced by hand in FontForge;
   this one is derived from the strike in the reader's own file, in the
   browser, and comes out of the bytes rather than out of a drawing.

   HOW THE PIXELS BECOME OUTLINES. Every lit pixel is a square, so the glyph
   is the union of its squares, and TrueType fills by non-zero winding: any
   set of same-direction contours unions, overlaps and shared edges included.
   So no tracing is needed and none is done -- the pixels are decomposed into
   maximal rectangles (a run of lit pixels extended downward as far as the
   identical run continues) and each rectangle is one clockwise contour. The
   decomposition is only a size saving; one contour per pixel would draw the
   same glyph.

   THE GRID IS KEPT EXACT. One pixel is 64 font units and the em is the
   strike's own ascent plus descent, so the em of the 12-point strike is 896
   units and every coordinate in the font is a whole number of pixels. Set at
   14px -- the cell height -- the font draws the bitmap at its own size, and
   at any integer multiple it is the same pixels scaled. Nothing rounds.

   WHAT IS NOT INVENTED. A code the strike has no image for gets no glyph and
   no cmap entry, so the font has no space: the strike has none, the game
   draws its missing symbol for one, and the TrueType on Cythera Guides has
   none either (its cmap starts at 0x21). The missing symbol becomes glyph 0,
   .notdef, which is what a modern renderer draws in the same case. */
function nfntToTrueType(f, opts){
  opts = opts || {};
  const PX = 64;                                   // font units to the pixel
  const upem = PX*(f.ascent+f.descent);
  if(upem<16||upem>16384) throw new Error('the strike is too tall or too short to scale into an em');
  const rowBytes = f.rowWords*2;
  const bit = (x,y) => (f.strike[y*rowBytes+(x>>3)]>>(7-(x&7)))&1;

  // The rectangles of one glyph, in pixels, from its slice of the bit image.
  function rects(x0, w){
    const h=f.fRectHeight, taken=[];
    for(let y=0;y<h;y++) taken.push(new Uint8Array(w));
    const out=[];
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        if(taken[y][x]||!bit(x0+x,y)) continue;
        let w2=0; while(x+w2<w && bit(x0+x+w2,y) && !taken[y][x+w2]) w2++;
        let h2=1;
        while(y+h2<h){
          let ok=true;
          for(let k=0;k<w2;k++) if(!bit(x0+x+k,y+h2)||taken[y+h2][x+k]){ ok=false; break; }
          if(!ok) break;
          h2++;
        }
        for(let j=0;j<h2;j++) for(let k=0;k<w2;k++) taken[y+j][x+k]=1;
        out.push({x, y, w:w2, h:h2});
        x+=w2-1;
      }
    }
    return out;
  }

  // One glyph's `glyf` entry. Points are all on-curve and each rectangle is
  // one contour, wound clockwise, which is TrueType's direction for an outer
  // contour and the direction every contour here has to share for the union
  // to fill. y is measured up from the baseline, which sits `ascent` pixels
  // below the top of the cell.
  function glyphBytes(i){
    const ow=f.ow[i];
    if(ow===0xFFFF) return null;                   // the font does not have it
    const x0=f.loc[i], w=f.loc[i+1]-f.loc[i];
    const lsb=(f.kernMax+(ow>>8))*PX, adv=(ow&0xFF)*PX;
    if(w<=0) return {bytes:new Uint8Array(0), adv, lsb, points:0, contours:0};
    const rs=rects(x0,w);
    if(!rs.length) return {bytes:new Uint8Array(0), adv, lsb, points:0, contours:0};
    const pts=[];                                  // [x,y] in font units
    for(const r of rs){
      const ax=lsb+r.x*PX, bx=lsb+(r.x+r.w)*PX;
      const ty=(f.ascent-r.y)*PX, by=(f.ascent-r.y-r.h)*PX;
      pts.push([ax,by],[ax,ty],[bx,ty],[bx,by]);   // clockwise, y up
    }
    const n=rs.length;
    const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]);
    const xMin=Math.min(...xs), xMax=Math.max(...xs);
    const yMin=Math.min(...ys), yMax=Math.max(...ys);
    const len=10+n*2+2+pts.length*(1+2+2);
    const out=new Uint8Array(len); const dv=new DataView(out.buffer);
    dv.setInt16(0,n); dv.setInt16(2,xMin); dv.setInt16(4,yMin); dv.setInt16(6,xMax); dv.setInt16(8,yMax);
    for(let k=0;k<n;k++) dv.setUint16(10+k*2,(k+1)*4-1);
    dv.setUint16(10+n*2,0);                        // no instructions
    let p=12+n*2;
    for(let k=0;k<pts.length;k++) out[p++]=0x01;   // on curve, 16-bit deltas
    let prev=0;
    for(const [x] of pts){ dv.setInt16(p,x-prev); prev=x; p+=2; }
    prev=0;
    for(const [,y] of pts){ dv.setInt16(p,y-prev); prev=y; p+=2; }
    // hmtx carries the ink's own xMin: the outline coordinates are absolute,
    // so this moves nothing, and a left bearing that disagrees with xMin is
    // the kind of thing a validator stops on.
    return {bytes:out, adv, lsb:xMin, points:pts.length, contours:n, xMin, yMin, xMax, yMax};
  }

  // Glyph 0 is the missing symbol, which sits one past lastChar; then every
  // code the strike answers for, in order, each with the code point its Mac
  // Roman byte stands for.
  const order=[{idx:f.nGlyphs-1, code:null}];
  for(let c=f.firstChar;c<=f.lastChar;c++){
    const i=c-f.firstChar;
    if(f.ow[i]===0xFFFF) continue;
    // Codes below a space are the control characters, and both Seldane
    // strikes answer for tab and carriage return with the same box they use
    // for a missing character. Mapping those to U+0009 and U+000D would put
    // two undrawable code points in the cmap, so they are left out; what
    // they stand for is already glyph 0.
    if(c<0x20) continue;
    const cp = c<0x80 ? c : (typeof MACROMAN_HIGH!=='undefined' ? MACROMAN_HIGH[c-0x80] : undefined);
    if(cp===undefined||cp>0xFFFF) continue;
    order.push({idx:i, code:cp});
  }
  const glyphs=order.map(g=>glyphBytes(g.idx)||{bytes:new Uint8Array(0),adv:0,lsb:0,points:0,contours:0});
  const numGlyphs=glyphs.length;

  const pad4=n=>(n+3)&~3;
  let glyfLen=0; for(const g of glyphs) glyfLen+=pad4(g.bytes.length);
  const glyf=new Uint8Array(glyfLen), loca=new Uint8Array((numGlyphs+1)*4);
  const lv=new DataView(loca.buffer);
  let at=0;
  glyphs.forEach((g,i)=>{ lv.setUint32(i*4,at); glyf.set(g.bytes,at); at+=pad4(g.bytes.length); });
  lv.setUint32(numGlyphs*4,at);

  const hmtx=new Uint8Array(numGlyphs*4); const hv=new DataView(hmtx.buffer);
  glyphs.forEach((g,i)=>{ hv.setUint16(i*4,Math.max(0,g.adv)); hv.setInt16(i*4+2,g.lsb); });

  const head=new Uint8Array(54); const hd=new DataView(head.buffer);
  hd.setUint32(0,0x00010000); hd.setUint32(4,0x00010000);
  hd.setUint32(12,0x5F0F3CF5);                     // magic
  // Baseline at y=0 and integer ppem, which is what a pixel font wants; the
  // dates stay at the epoch so two exports of the same strike are the same
  // bytes, which is what the check compares.
  hd.setUint16(16,0x0009);
  hd.setUint16(18,upem);
  const withInk=glyphs.filter(g=>g.contours);
  hd.setInt16(36,withInk.length?Math.min(...withInk.map(g=>g.xMin)):0);
  hd.setInt16(38,withInk.length?Math.min(...withInk.map(g=>g.yMin)):0);
  hd.setInt16(40,withInk.length?Math.max(...withInk.map(g=>g.xMax)):0);
  hd.setInt16(42,withInk.length?Math.max(...withInk.map(g=>g.yMax)):0);
  hd.setUint16(44,0);                              // macStyle: plain
  hd.setUint16(46,f.ascent+f.descent);             // lowestRecPPEM: the cell
  hd.setInt16(48,2); hd.setInt16(50,1); hd.setInt16(52,0);   // long loca

  const maxAdv=Math.max(...glyphs.map(g=>g.adv),0);
  const hhea=new Uint8Array(36); const hh=new DataView(hhea.buffer);
  hh.setUint32(0,0x00010000);
  hh.setInt16(4,f.ascent*PX); hh.setInt16(6,-f.descent*PX); hh.setInt16(8,(f.leading||0)*PX);
  hh.setUint16(10,maxAdv);
  hh.setInt16(12,withInk.length?Math.min(...withInk.map(g=>g.lsb)):0);
  hh.setInt16(14,0); hh.setInt16(16,maxAdv);
  hh.setInt16(18,1); hh.setInt16(20,0); hh.setInt16(22,0);
  hh.setUint16(34,numGlyphs);

  const maxp=new Uint8Array(32); const mx=new DataView(maxp.buffer);
  mx.setUint32(0,0x00010000); mx.setUint16(4,numGlyphs);
  mx.setUint16(6,Math.max(...glyphs.map(g=>g.points),0));
  mx.setUint16(8,Math.max(...glyphs.map(g=>g.contours),0));
  mx.setUint16(14,2);                              // maxZones

  // cmap: one format 4 subtable, offered as (0,3) and (3,1), and a format 6
  // Mac Roman table beside it so the font also works where it came from.
  const mapped=order.filter(g=>g.code!==null).map((g,i)=>[g.code,i+1]).sort((a,b)=>a[0]-b[0]);
  const segs=mapped.map(([cp,gi])=>({start:cp,end:cp,delta:(gi-cp)&0xFFFF}))
                   .concat([{start:0xFFFF,end:0xFFFF,delta:1}]);
  const sc=segs.length, f4len=16+sc*8;
  const f4=new Uint8Array(f4len); const fv=new DataView(f4.buffer);
  let es=1, esl=0; while(es*2<=sc){ es*=2; esl++; }
  fv.setUint16(0,4); fv.setUint16(2,f4len); fv.setUint16(4,0);
  fv.setUint16(6,sc*2); fv.setUint16(8,es*2); fv.setUint16(10,esl); fv.setUint16(12,sc*2-es*2);
  segs.forEach((sg,i)=>{ fv.setUint16(14+i*2,sg.end); fv.setUint16(16+sc*2+i*2,sg.start);
                         fv.setUint16(16+sc*4+i*2,sg.delta); fv.setUint16(16+sc*6+i*2,0); });
  const macCodes=order.filter(g=>g.code!==null);
  const first=f.firstChar, count=f.lastChar-f.firstChar+1;
  const f6=new Uint8Array(10+count*2); const sv=new DataView(f6.buffer);
  sv.setUint16(0,6); sv.setUint16(2,f6.length); sv.setUint16(4,0);
  sv.setUint16(6,first); sv.setUint16(8,count);
  for(let c=f.firstChar;c<=f.lastChar;c++){
    const gi=order.findIndex(g=>g.idx===c-f.firstChar && g.code!==null);
    sv.setUint16(10+(c-first)*2, gi>0?gi:0);
  }
  const cmap=new Uint8Array(4+3*8+f4.length+f6.length); const cv=new DataView(cmap.buffer);
  cv.setUint16(0,0); cv.setUint16(2,3);
  const uniOff=4+24, macOff=uniOff+f4.length;
  [[0,3,uniOff],[1,0,macOff],[3,1,uniOff]].forEach(([pl,en,off],i)=>{
    cv.setUint16(4+i*8,pl); cv.setUint16(6+i*8,en); cv.setUint32(8+i*8,off); });
  cmap.set(f4,uniOff); cmap.set(f6,macOff);

  const os2=new Uint8Array(96); const ov=new DataView(os2.buffer);
  const advs=glyphs.map(g=>g.adv).filter(v=>v>0);
  ov.setUint16(0,3);
  ov.setInt16(2,advs.length?Math.round(advs.reduce((a,b)=>a+b,0)/advs.length):0);
  ov.setUint16(4,400); ov.setUint16(6,5); ov.setUint16(8,0);
  const sub=Math.round(upem*0.65), subOff=Math.round(upem*0.14);
  [sub,sub,0,subOff,sub,sub,0,Math.round(upem*0.48)].forEach((v,i)=>ov.setInt16(10+i*2,v));
  ov.setInt16(26,Math.round(upem*0.05)); ov.setInt16(28,Math.round(upem*0.26));
  ov.setUint32(42,0x00000003);
  os2.set([0x20,0x20,0x20,0x20],58);
  ov.setUint16(62,0x0040);
  ov.setUint16(64,mapped.length?mapped[0][0]:0x20); ov.setUint16(66,mapped.length?mapped[mapped.length-1][0]:0xFF);
  ov.setInt16(68,f.ascent*PX); ov.setInt16(70,-f.descent*PX); ov.setInt16(72,(f.leading||0)*PX);
  ov.setUint16(74,f.ascent*PX); ov.setUint16(76,f.descent*PX);
  ov.setUint32(78,0x00000001);
  ov.setInt16(86,Math.round(upem*0.5)); ov.setInt16(88,f.ascent*PX);
  ov.setUint16(90,0); ov.setUint16(92,0x20); ov.setUint16(94,1);

  const family=opts.family||'Bitmap font';
  const ps=family.replace(/[^A-Za-z0-9]/g,'');
  const strings=[[1,family],[2,'Regular'],[3,family+' from a Delver NFNT strike'],
                 [4,family],[5,'Version 1.000'],[6,ps],
                 [10,opts.note||'Traced from a classic Mac NFNT bitmap strike.']];
  const recs=[];
  for(const [id,s] of strings){
    const mac=new Uint8Array(s.length);
    for(let i=0;i<s.length;i++) mac[i]=s.charCodeAt(i)&0xFF;
    const win=new Uint8Array(s.length*2);
    for(let i=0;i<s.length;i++){ win[i*2]=s.charCodeAt(i)>>8; win[i*2+1]=s.charCodeAt(i)&0xFF; }
    recs.push({pl:1,en:0,lang:0,id,bytes:mac});
    recs.push({pl:3,en:1,lang:0x409,id,bytes:win});
  }
  recs.sort((a,b)=>a.pl-b.pl||a.en-b.en||a.lang-b.lang||a.id-b.id);
  let strLen=0; for(const r of recs){ r.off=strLen; strLen+=r.bytes.length; }
  const name=new Uint8Array(6+recs.length*12+strLen); const nv=new DataView(name.buffer);
  nv.setUint16(0,0); nv.setUint16(2,recs.length); nv.setUint16(4,6+recs.length*12);
  recs.forEach((r,i)=>{ const p=6+i*12;
    nv.setUint16(p,r.pl); nv.setUint16(p+2,r.en); nv.setUint16(p+4,r.lang); nv.setUint16(p+6,r.id);
    nv.setUint16(p+8,r.bytes.length); nv.setUint16(p+10,r.off);
    name.set(r.bytes,6+recs.length*12+r.off); });

  const post=new Uint8Array(32); const pv=new DataView(post.buffer);
  pv.setUint32(0,0x00030000); pv.setInt16(8,0); pv.setUint16(12,0);

  const tables=[{tag:'OS/2',bytes:os2},{tag:'cmap',bytes:cmap},{tag:'glyf',bytes:glyf},
                {tag:'head',bytes:head},{tag:'hhea',bytes:hhea},{tag:'hmtx',bytes:hmtx},
                {tag:'loca',bytes:loca},{tag:'maxp',bytes:maxp},{tag:'name',bytes:name},
                {tag:'post',bytes:post}];
  return rebuildSfnt(new Uint8Array([0,1,0,0]), tables);
}

// FOND: 52-byte family record, then the font association table that says
// which NFNT resource holds which size and style.
const FOND_STYLES=[[1,'bold'],[2,'italic'],[4,'underline'],[8,'outline'],[16,'shadow'],[32,'condensed'],[64,'extended']];
function decodeFOND(data){
  if(data.length<54) throw new Error('FOND too short');
  const famID=u16be(data,2), first=u16be(data,4), last=u16be(data,6);
  // ascent/descent/leading/widMax are fractions of an em in 1/4096 units.
  const em=v=>(s16(data,v)/4096).toFixed(3);
  const n=u16be(data,52)+1, entries=[];
  for(let i=0;i<n && 54+i*6+6<=data.length;i++){
    const size=u16be(data,54+i*6), style=u16be(data,56+i*6), id=u16be(data,58+i*6);
    const names=FOND_STYLES.filter(([b])=>style&b).map(([,s])=>s);
    entries.push({size,style,id,label:`${size?size+' pt':'scalable'}${names.length?' '+names.join('+'):''} → ${size?'NFNT':'sfnt'} ${id}`});
  }
  return {famID, first, last, entries,
    text:`Font family #${famID}\nCharacters ${first}–${last}\n`+
         `Ascent ${em(8)} em, descent ${em(10)} em, leading ${em(12)} em, widest ${em(14)} em\n\n`+
         `${n} font${n===1?'':'s'} in this family:\n`+entries.map(e=>'  '+e.label).join('\n')};
}

// ============================================================
//  Character interpretation for resources we can't decode
// ============================================================
// Show what the bytes spell as Mac Roman text rather than a wall of hex:
// resource forks are full of embedded names, paths and messages, and those
// are what you actually want to see when there's no decoder.
// (the table is MACROMAN_HIGH in js/mac-bytes.js, as code points)
function charDump(bytes, limit){
  const n=Math.min(bytes.length, limit);
  let s='';
  for(let i=0;i<n;i++){
    const b=bytes[i];
    if(b===9||b===10||b===13) s+=' ';
    else if(b<32||b===127) s+='\u00b7';       // control bytes -> middle dot
    else if(b<128) s+=String.fromCharCode(b);
    else s+=String.fromCodePoint(MACROMAN_HIGH[b-128]);
  }
  return s;
}
function rsrcHexDump(bytes, limit){
  const n=Math.min(bytes.length,limit); let out=[];
  for(let i=0;i<n;i+=16){
    const row=Array.from(bytes.slice(i,i+16));
    out.push(i.toString(16).padStart(6,'0')+'  '+
      row.map(b=>b.toString(16).padStart(2,'0')).join(' ').padEnd(47)+'  '+
      charDump(new Uint8Array(row),16));
  }
  return out.join('\n');
}

// dctb/actb/mctb/cctb/wctb/fctb are all plain ColorTables on disk, the same
// layout clut uses, so one decoder covers the family.
const COLOR_TABLE_TYPES={'clut':'colour table','dctb':'dialog colour table','actb':'alert colour table',
  'mctb':'menu colour table','cctb':'control colour table','wctb':'window colour table',
  'fctb':'finder icon colour table'};

// ============================================================
//  Cursor gallery: one tile per cursor, PNG 1x/4x, animated GIF
// ============================================================

// ---- acur ---------------------------------------------------
// acur is 4-byte header (count, current index) then one 4-byte entry per
// frame: cursor resource ID + a reserved word. It carries NO timing data --
// the advance rate lived in the application's event loop, so any frame
// duration here is our choice, not the resource's.
function decodeAcur(data){
  const n=u16be(data,0), ids=[];
  for(let i=0;i<n && 4+i*4+2<=data.length;i++) ids.push(u16be(data,4+i*4));
  return {count:n, ids};
}
// A crsr and a CURS can share one resource ID (Cythera has both as 138), so
// callers must be able to pin the type; otherwise the CURS tile renders the
// crsr's artwork.
function lookupCursor(fork, id, preferType){
  for(const t of (preferType?[preferType]:['crsr','CURS'])){
    const list=fork.resourcesByType[t]; if(!list) continue;
    const e=list.find(r=>r.id===id); if(!e) continue;
    const data=fork.dataOf(t,e);
    try{ return {type:t, entry:e, ...(t==='crsr'?decodeCrsr(data):decodeCURS(data))}; }catch (_) { quiet(_); }
  }
  return null;
}

function cursorGalleryItems(fork){
  const inAnim=new Set(), anims=[];
  for(const e of (fork.resourcesByType['acur']||[])){
    const a=decodeAcur(fork.dataOf('acur',e));
    // .map(lookupCursor) passed the array index as preferType, so every frame
    // after the first looked up resource type 1, found nothing, and was
    // dropped: animated cursors silently played a single frame.
    const frames=a.ids.map(id=>lookupCursor(fork, id)).filter(Boolean);
    if(frames.length){ a.ids.forEach(i=>inAnim.add(i)); anims.push({anim:true, id:e.id, ids:a.ids, frames}); }
  }
  const singles=[];
  for(const t of ['crsr','CURS']){
    for(const e of (fork.resourcesByType[t]||[])){
      if(inAnim.has(e.id)) continue;
      const c=lookupCursor(fork, e.id, t);
      if(c) singles.push({anim:false, id:e.id, type:t, cur:c});
    }
  }
  singles.sort((a,b)=>a.id-b.id);
  return [...anims, ...singles];
}
