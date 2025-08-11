import { join } from 'path';
import { createWriteStream, readdirSync } from 'fs';
import archiver from 'archiver';
import PDFDocument from 'pdfkit';
import sizeOf from 'image-size';

function listImgs(dir) {
  const out = [];
  const items = readdirSync(dir, { withFileTypes: true });

  for (const it of items) {
    const p = join(dir, it.name);

    if (it.isDirectory()) out.push(...listImgs(p));
    else if (it.isFile() && /\.(jpe?g|png)$/i.test(it.name)) out.push(p);
  }
  
  return out.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function createZip(src, dst, name, level = 6) {
  return new Promise((resolve, reject) => {
    const out = createWriteStream(join(dst, name));
    const zip = archiver('zip', { zlib: { level } });

    out.on('close', resolve);
    out.on('error', reject);
    zip.on('error', reject);
    zip.on('warning', (err) => {
      if (err.code !== 'ENOENT') reject(err);
    });

    zip.pipe(out);
    zip.directory(src, false);
    zip.finalize();
  });
}

export function createPdf(src, dst, name) {
  return new Promise((resolve, reject) => {
    const imgs = listImgs(src);
    const doc = new PDFDocument({ autoFirstPage: false, margin: 0 });
    const out = createWriteStream(join(dst, name));

    out.on('finish', resolve);
    out.on('error', reject);
    doc.on('error', reject);

    doc.pipe(out);

    if (!imgs.length) {
      doc.end();
      return;
    }

    for (const img of imgs) {
      let w = 800,
        h = 1200;
      try {
        const d = sizeOf(img);
        w = Number(d.width) || w;
        h = Number(d.height) || h;
      } catch {}
      doc.addPage({ size: [w, h] });
      doc.image(img, 0, 0, { fit: [w, h], align: 'center', valign: 'center' });
    }

    doc.end();
  });
}
