// The record code over every Nova plug-in in archive.org's
// EscapeVelocityPluginCollection (utilities/corpus.mjs), as plugin_check and
// fields_check hold it over the releases:
//
// 1. Written back: every record of every type with a table, written back
//    from its fields, is byte for byte the record as read; a copy with a byte
//    bent compares as different bytes. RECORDS counts
//    them: 145,027 in 1,277 Nova files on 5 November 2026, when two kinds were
//    found that were not written back, a dësc of no bytes and a Movie of all
//    32 characters with no 0 after it.
// 2. Read: every field's reading (novaFieldRead) of every record, in a game
//    with no other records, gives text and does not throw.
//
// Without EVN.zip it skips. It runs for about four minutes, nearly all of it
// spent opening the files.
import { site } from './load.mjs';
import { corpusForks, haveCorpus } from './corpus.mjs';

const RECORDS = 145027, FILES = 1277;
if (!haveCorpus()) { console.log('SKIP: no EVN.zip in reference/game/collections'); process.exit(0); }
const S = site();
let fails = 0;
const fail = m => { console.log('FAIL ' + m); fails++; };
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const NOGAME = { get: () => null, list: () => [], all: () => [] };

let files = 0, records = 0, back = 0, reads = 0, bentSeen = false;
const notBack = [], thrown = [];
for (const { from, name, fork } of corpusForks(S)) {
  files++;
  for (const t of fork.typeList) {
    const type = S.novaTypeName(t.type);
    if (!S.NOVA_RECORDS[type]) continue;
    for (const e of fork.resourcesByType[t.type]) {
      const b = fork.dataOf(t.type, e), where = `${from}, ${name} ${type} ${e.id}`;
      records++;
      let rec;
      try {
        rec = S.novaRecord(type, b);
        if (same(S.novaRecordBytes(type, rec, b), b)) back++; else notBack.push(where);
      } catch (err) { notBack.push(`${where} (${err.message})`); continue; }
      // the comparison can fail: the first record long enough, a byte bent
      if (!bentSeen && b.length > 2) {
        const bent = Uint8Array.from(b); bent[1] ^= 0xFF;
        if (same(bent, b)) fail(`${where}, a copy with a byte bent compares as the same bytes`);
        bentSeen = true;
      }
      for (const f of Object.keys(rec)) {
        try { if (typeof S.novaFieldRead(NOGAME, type, f, rec) !== 'string' && S.NOVA_FIELD_READS[type] && S.NOVA_FIELD_READS[type][f]) thrown.push(`${where} ${f} (no text)`); reads++; }
        catch (err) { thrown.push(`${where} ${f} = ${JSON.stringify(rec[f])} (${err.message})`); }
      }
    }
  }
}
if (files < FILES || records !== RECORDS) fail(`${records} records in ${files} Nova files, where there were ${RECORDS} in ${FILES}`);
if (notBack.length) fail(`${notBack.length} records not written back as read, among them ${notBack.slice(0, 6).join('; ')}`);
if (thrown.length) fail(`${thrown.length} readings failed, among them ${thrown.slice(0, 6).join('; ')}`);
console.log(`written back: ${back} of ${records} records in ${files} Nova files as read`);
console.log(`read: ${reads} fields of them, each reading text`);
if (fails) { console.log(`${fails} failed`); process.exit(1); }
