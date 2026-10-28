import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { makePdf } from '../src/pdf.js';

test('日本語の作品を複数ページに出力し、未対応文字を知らせる', async () => {
  const originalFetch = globalThis.fetch;
  const font = await readFile(new URL('../public/fonts/NotoSansJP-Regular.ttf', import.meta.url));
  globalThis.fetch = async () => new Response(font);
  try {
    const rows = Array.from({ length: 37 }, (_, i) => ({ title: `作品${i + 1}`, author: '山田 花子' }));
    const bytes = await makePdf(rows);
    const pdf = await PDFDocument.load(bytes);
    assert.equal(pdf.getPageCount(), 3);
    assert.ok(bytes.length > 1_000_000, '描画に必要なフォント全体が埋め込まれる');
    await assert.rejects(makePdf([{ title: '作品😀', author: '' }]), /表示できない文字/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
