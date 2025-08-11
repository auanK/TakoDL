import { join } from 'path';
import { existsSync, readdirSync, rmSync, statSync } from 'fs';
import cfg from '../config.js';
import * as api from '../api/mangadex.js';
import * as fmt from '../names.js';
import * as files from './files.js';
import * as pack from './packer.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runInBatches(items, batchSize, worker) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(worker));
  }
}

function isNonEmptyFile(path) {
  try {
    return statSync(path).size > 0;
  } catch {
    return false;
  }
}

function dirHasAnyFile(dirPath) {
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const p = join(dirPath, entry.name);
      if (entry.isFile()) return true;
      if (entry.isDirectory() && dirHasAnyFile(p)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

const REFERER_HEADER = { Referer: 'https://mangadex.org' };

async function downloadChapterOnce(chapter, destDir) {
  const chapterNum = fmt.chapNo(chapter);

  if (chapter.attributes.externalUrl) {
    console.log(`- Pulando capítulo externo: ${chapterNum}`);
    return true;
  }

  const pageInfo = await api.getPages(chapter.id);
  const images = [...new Set(pageInfo.files)];
  if (!images.length) throw new Error('Sem imagens no capítulo');

  const failed = [];

  await runInBatches(images, cfg.pagesPerBatch, async (fileName) => {
    try {
      const url = `${pageInfo.baseUrl}/data/${pageInfo.hash}/${fileName}`;
      const outPath = join(destDir, fileName);

      if (existsSync(outPath) && isNonEmptyFile(outPath)) return;

      await files.download(url, outPath, REFERER_HEADER, cfg.requestTimeoutMs);
    } catch (err) {
      failed.push({ fileName, err });
    }
  });

  if (failed.length) {
    throw new Error(`${failed.length} páginas falharam`);
  }

  console.log(`✔️  Capítulo ${chapterNum} OK`);
  return true;
}

async function downloadChapterWithRetry(chapter, destDir) {
  let delay = cfg.retryDelayMs;
  const chapterNum = fmt.chapNo(chapter);

  for (let attempt = 0; attempt < cfg.maxRetries; attempt++) {
    try {
      return await downloadChapterOnce(chapter, destDir);
    } catch (err) {
      const isLast = attempt === cfg.maxRetries - 1;
      if (isLast) {
        console.error(
          `❌ Falha permanente no cap. ${chapterNum} após ${cfg.maxRetries} tentativas. ${err.message}`
        );
        return false;
      }
      console.warn(
        `⚠️  Erro no cap. ${chapterNum} – nova tentativa em ${Math.round(delay / 1000)}s... (${
          err.message
        })`
      );
      await sleep(delay);
      const jitter = 0.9 + Math.random() * 0.2;
      delay = Math.ceil(delay * 2 * jitter);
    }
  }
}

export async function downloadChap({ mangaName, chapter, language, outDir, format }) {
  const chapterNumber = fmt.chapNo(chapter);
  const volumeNumber = fmt.volNo(chapter);
  const scanName = await fmt.scanName(chapter, api);

  if (format === 'loose') {
    const folderName = fmt
      .chapFileName({
        mangaName,
        chapterNumber,
        volume: volumeNumber,
        language,
        scan: scanName,
        format: '',
      })
      .slice(0, -1);

    const chapterDir = join(outDir, folderName);
    files.mkdirs(chapterDir);
    await downloadChapterWithRetry(chapter, chapterDir);
    return;
  }

  const tmpDir = join(outDir, `temp-chap-${chapter.id}`);
  files.mkdirs(tmpDir);

  const ok = await downloadChapterWithRetry(chapter, tmpDir);
  if (!ok) {
    rmSync(tmpDir, { recursive: true, force: true });
    return;
  }

  const outName = fmt.chapFileName({
    mangaName,
    chapterNumber,
    volume: volumeNumber,
    language,
    scan: scanName,
    format,
  });

  try {
    if (format === 'zip') await pack.createZip(tmpDir, outDir, outName);
    else await pack.createPdf(tmpDir, outDir, outName);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

export async function downloadChaps({ mangaName, chapters, language, outDir, format }) {
  await runInBatches(chapters, cfg.chaptersPerBatch, (chapter) =>
    downloadChap({ mangaName, chapter, language, outDir, format })
  );
}

export async function downloadVol({
  mangaName,
  volume,
  scanName,
  chapters,
  language,
  outDir,
  format,
  pdfPerChapter = false,
}) {
  if (format === 'loose') {
    const volFolderName = fmt
      .volFileName({ mangaName, volume, language, scan: scanName, format: '' })
      .slice(0, -1);

    const volDir = join(outDir, volFolderName);
    files.mkdirs(volDir);

    await runInBatches(chapters, cfg.chaptersPerBatch, async (chapter) => {
      const chapDir = join(volDir, `Capitulo_${fmt.chapNo(chapter)}`);
      files.mkdirs(chapDir);
      await downloadChapterWithRetry(chapter, chapDir);
    });

    return;
  }

  const tmpDir = join(outDir, `temp-vol-${volume}-${scanName}`);
  files.mkdirs(tmpDir);

  await runInBatches(chapters, cfg.chaptersPerBatch, async (chapter) => {
    const chapDir = join(tmpDir, `Capitulo_${fmt.chapNo(chapter)}`);
    files.mkdirs(chapDir);
    await downloadChapterWithRetry(chapter, chapDir);
  });

  if (!dirHasAnyFile(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
    return;
  }

  try {
    if (format === 'pdf' && pdfPerChapter) {
      for (const chapter of chapters) {
        const chapDir = join(tmpDir, `Capitulo_${fmt.chapNo(chapter)}`);
        if (!existsSync(chapDir) || !dirHasAnyFile(chapDir)) continue;

        const chapPdfName = fmt.chapFileName({
          mangaName,
          chapterNumber: fmt.chapNo(chapter),
          volume,
          language,
          scan: scanName,
          format: 'pdf',
        });
        await pack.createPdf(chapDir, outDir, chapPdfName);
      }
    } else {
      const volOutName = fmt.volFileName({ mangaName, volume, language, scan: scanName, format });
      if (format === 'zip') await pack.createZip(tmpDir, outDir, volOutName);
      else await pack.createPdf(tmpDir, outDir, volOutName);
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

export async function downloadVols(jobs) {
  await runInBatches(jobs, cfg.volumesPerBatch, (job) => downloadVol(job));
}
