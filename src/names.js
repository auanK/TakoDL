const scanCache = new Map();

const sanitizeName = (str) => String(str ?? '').replace(/[/:*?"<>|\\[\]]/g, '-');

export const scanId = (chapter) =>
  chapter.relationships.find((rel) => rel.type === 'scanlation_group')?.id || 'Sem Scan';

export const volNo = (chapter) => chapter.attributes.volume || 'Sem Volume';

export const chapNo = (chapter) => chapter.attributes.chapter || 'desconhecido';

export async function scanName(chapter, api) {
  const id = scanId(chapter);
  if (id === 'Sem Scan') return 'Sem Scan';
  if (!scanCache.has(id)) {
    try {
      const groupName = await api.getGroup(id);
      scanCache.set(id, groupName || 'Desconhecida');
    } catch {
      scanCache.set(id, 'Desconhecida');
    }
  }
  return scanCache.get(id);
}

export function chapFileName({ mangaName, chapterNumber, volume, language, scan, format }) {
  const ch = String(chapterNumber).padStart(2, '0');
  const volLabel = volume ?? 'Sem Volume';
  const safeScan = sanitizeName(scan);
  const base = `${mangaName} - Vol ${volLabel} - Cap ${ch} [${language}][${safeScan}]`;
  return `${base}.${format || ''}`;
}

export function volFileName({ mangaName, volume, language, scan, format }) {
  const volumePadded = String(volume).padStart(2, '0');
  const safeScan = sanitizeName(scan);
  const base = `${mangaName} - Vol ${volumePadded} [${language}][${safeScan}]`;
  return `${base}.${format || ''}`;
}

export function groupByVolScan(chapters) {
  return chapters.reduce((grouped, chapter) => {
    const volumeKey = volNo(chapter);
    const groupKey = scanId(chapter);
    if (!grouped[volumeKey]) grouped[volumeKey] = {};
    if (!grouped[volumeKey][groupKey]) grouped[volumeKey][groupKey] = [];
    grouped[volumeKey][groupKey].push(chapter);
    return grouped;
  }, {});
}
