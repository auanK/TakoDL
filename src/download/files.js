import { createWriteStream, mkdirSync, renameSync, rmSync } from 'fs';
import { dirname } from 'path';
import { pipeline, Readable } from 'stream';
import { promisify } from 'util';

const pipe = promisify(pipeline);

export async function download(url, outPath, headers = {}, timeoutMs = 30000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error('Request timeout')), timeoutMs);

  mkdirSync(dirname(outPath), { recursive: true });
  const tmp = `${outPath}.part`;

  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

    const writer = createWriteStream(tmp);
    const body = res.body?.getReader ? Readable.fromWeb(res.body) : res.body;
    if (!body) throw new Error('Resposta sem corpo');

    await pipe(body, writer);
    renameSync(tmp, outPath);
  } finally {
    clearTimeout(timer);
    try {
      rmSync(tmp);
    } catch {}
  }
}

export function mkdirs(dir) {
  mkdirSync(dir, { recursive: true });
}
