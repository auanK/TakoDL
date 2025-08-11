import cfg from '../config.js';

async function getJson(url, timeout = cfg.requestTimeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error('Request timeout')), timeout);

  let res;
  try {
    res = await fetch(url, { headers: cfg.headers, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) throw new Error(`Erro ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function search(query) {
  const qs = new URLSearchParams();
  if (query) qs.set('title', query);

  const res = await getJson(`${cfg.baseUrl}/manga?${qs}`);
  return res.data;
}

export async function get(id) {
  const qs = new URLSearchParams();
  qs.append('includes[]', 'author');

  const res = await getJson(`${cfg.baseUrl}/manga/${id}?${qs}`);
  return res.data;
}

export async function listLangs(mangaId) {
  const base = `${cfg.baseUrl}/manga/${mangaId}/feed`;
  const limit = cfg.defaultLimit;
  const langs = new Set();

  for (let offset = 0, total = 1; offset < total; ) {
    const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    const res = await getJson(`${base}?${qs}`);

    for (const item of res.data) {
      const code = item?.attributes?.translatedLanguage;
      if (code) langs.add(code);
    }

    offset += res.data.length;
    total = res.total;
  }

  return [...langs];
}

export async function listChaps(mangaId, lang = null) {
  const base = `${cfg.baseUrl}/manga/${mangaId}/feed`;
  const limit = cfg.defaultLimit;
  const out = [];

  for (let offset = 0, total = 1; offset < total; ) {
    const qs = new URLSearchParams();
    qs.set('limit', String(limit));
    qs.set('offset', String(offset));
    qs.set('order[chapter]', 'asc');
    qs.append('includes[]', 'scanlation_group');
    if (lang) qs.append('translatedLanguage[]', lang);

    const res = await getJson(`${base}?${qs}`);
    out.push(...res.data);

    offset += res.data.length;
    total = res.total;
  }

  return out;
}

export async function getPages(chapId) {
  const res = await getJson(`${cfg.baseUrl}/at-home/server/${chapId}`);
  return {
    baseUrl: res.baseUrl,
    hash: res.chapter.hash,
    files: res.chapter.data,
  };
}

export async function getGroup(groupId) {
  if (!groupId) return 'Sem grupo';
  try {
    const res = await getJson(`${cfg.baseUrl}/group/${groupId}`);
    return res?.data?.attributes?.name || 'Grupo desconhecido';
  } catch {
    return 'Grupo desconhecido';
  }
}

export function getTitle(attrs) {
  const titles = attrs?.title || {};
  return titles.ja || titles.en || titles.pt || Object.values(titles)[0] || 'Sem título';
}

export function getAuthors(manga) {
  const rels = manga?.relationships || [];

  const names = [];
  for (let i = 0; i < rels.length; i++) {
    const rel = rels[i];
    if (rel?.type === 'author') {
      const name = rel.attributes?.name;
      if (name) names.push(name);
    }
  }

  return names.length ? names.join(', ') : 'Autor desconhecido';
}
