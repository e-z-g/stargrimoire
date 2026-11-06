// The plug-ins of archive.org's EscapeVelocityPluginCollection (EVN.zip's
// Plugins and Cheats, as in Add plug-ins), each opened as the page opens it,
// for the checks that hold the site to plug-ins as well as to the releases.
//
// corpusForks(S) yields each Nova file that reads as { from, name, fork }:
// `from` the file in EVN.zip it came out of, `name` the Nova file's name, and
// `fork` its resource fork as novaOpenFork reads it. Save files are left out.
// The files are read one at a time out of a 1.1 GB zip, for about a minute.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { REF } from './load.mjs';

export const EVN = path.join(REF, 'game/collections/EscapeVelocityPluginCollection/EVN.zip');
export const haveCorpus = () => fs.existsSync(EVN);

export function* corpusForks(S) {
  const names = execFileSync('unzip', ['-Z1', EVN], { maxBuffer: 1 << 26 }).toString().split('\n')
    .filter(n => /^EVN\/(Plugins|Cheats)\//.test(n) && !n.endsWith('/') && !/\.txt$/i.test(n));
  for (const name of names) {
    const raw = new Uint8Array(execFileSync('unzip', ['-p', EVN, name], { maxBuffer: 1 << 28 }));
    const archive = S.novaArchiveIn(raw);
    let files;
    try { files = archive ? S.novaArchiveFiles(archive) : [S.novaLooseFile(name.split('/').pop(), raw)].filter(Boolean); } catch (e) { continue; }
    for (const f of files) {
      if (f.pilot) continue;
      let fork;
      try { fork = S.novaOpenFork(f.read()); } catch (e) { continue; }
      yield { from: name.slice(4), name: f.name, fork };
    }
  }
}
