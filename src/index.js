import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import * as api from './api/mangadex.js';
import * as fmt from './names.js';
import * as files from './download/files.js';
import * as cli from './cli.js';
import { downloadChaps, downloadVols } from './download/manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DOWNLOAD_DIR = join(__dirname, '..', 'downloads');

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveManga(query) {
  if (ID_RE.test(query)) return api.get(query);

  const hits = await api.search(query);
  const choices = (hits || []).map((m) => ({
    name: m.attributes.title.en || api.getTitle(m.attributes),
    value: m.id,
  }));

  const id = await cli.chooseManga(choices);
  return id ? api.get(id) : null;
}

function chapterNumSort(a, b) {
  const na = Number(fmt.chapNo(a));
  const nb = Number(fmt.chapNo(b));
  const va = Number.isFinite(na) ? na : Infinity;
  const vb = Number.isFinite(nb) ? nb : Infinity;
  return va - vb;
}

async function main() {
  try {
    const { query } = await cli.askQuery();
    const q = (query || '').trim();

    const manga = await resolveManga(q);
    if (!manga) return console.log('❌ Nenhum mangá encontrado.');

    const name = api.getTitle(manga.attributes);
    const author = api.getAuthors(manga);
    console.log(`\n📘 ${name}`);
    console.log(`✍️  ${author}\n`);

    const langs = await api.listLangs(manga.id);
    if (!langs.length) return console.log('❌ Nenhum idioma encontrado.');
    const language = await cli.chooseLanguage(langs);

    const chaps = (await api.listChaps(manga.id, language)).sort(chapterNumSort);

    const outDir = join(DOWNLOAD_DIR, name);
    files.mkdirs(outDir);

    const mode = await cli.chooseMode();
    const { format, pdfPerChapter } = await cli.chooseFormat();

    if (mode === 'chapter') {
      const chapChoices = await Promise.all(
        chaps.map(async (c) => ({
          name: `Cap ${fmt.chapNo(c)} - Vol ${fmt.volNo(c)} - [${await fmt.scanName(c, api)}]`,
          value: c.id,
        }))
      );

      const pickedIds = await cli.chooseChaptersDisplay(chapChoices);
      if (!pickedIds.length) return;

      if (!(await cli.confirmCount(pickedIds.length))) return;

      const chosen = chaps.filter((c) => pickedIds.includes(c.id));
      await downloadChaps({ mangaName: name, chapters: chosen, language, outDir, format });
    } else {
      const grouped = fmt.groupByVolScan(chaps);

      let vols = Object.keys(grouped);
      const hasNoVol = vols.includes('Sem Volume');
      vols = vols
        .filter((vol) => vol !== 'Sem Volume')
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      if (hasNoVol) vols.push('Sem Volume');

      const pickedVols = await cli.chooseVolumesDisplay(vols);
      if (!pickedVols.length) return;

      if (!(await cli.confirmCount(pickedVols.length))) return;

      const jobs = [];
      for (const vol of pickedVols) {
        if (vol === 'Sem Volume') continue;

        const byScan = grouped[vol];
        for (const sid in byScan) {
          const list = byScan[sid];
          if (!list?.length) continue;

          const scanName = await fmt.scanName(list[0], api);
          jobs.push({
            mangaName: name,
            volume: vol,
            scanName,
            chapters: list,
            language,
            outDir,
            format,
            pdfPerChapter,
          });
        }
      }

      if (jobs.length) await downloadVols(jobs);

      if (pickedVols.includes('Sem Volume') && grouped['Sem Volume']) {
        const flat = Object.values(grouped['Sem Volume']).flat();
        await downloadChaps({ mangaName: name, chapters: flat, language, outDir, format });
      }
    }

    console.log('\n✅ Todos os downloads finalizados!');
  } catch (err) {
    console.error('❌ Erro inesperado:', err.message);
    console.error(err.stack);
  }
}

main();
