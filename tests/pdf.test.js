import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { makePdf } from '../src/pdf.js';

test('日本語の作品を複数ページに出力し、未対応文字を知らせる', async () => {
  const originalFetch = globalThis.fetch;
  const font = await readFile(new URL('../public/fonts/NotoSansJP-Regular.ttf', import.meta.url));
  globalThis.fetch = async () => new Response(font);
  try {
    const rows = Array.from({ length: 37 }, (_, i) => ({ title: `作品${i + 1}`, author: '山田 花子' }));
    const bytes = await makePdf(rows);
    const pdf = await getDocument({ data: bytes.slice() }).promise;
    assert.equal(pdf.numPages, 3);
    const lastPage = await (await pdf.getPage(3)).getTextContent();
    assert.ok(lastPage.items.some(item => item.str === '作品37'));
    assert.ok(!lastPage.items.some(item => item.str === '作品18'));
    await pdf.destroy();
    assert.ok(bytes.length > 1_000_000, '描画に必要なフォント全体が埋め込まれる');
    await assert.rejects(makePdf([{ title: '作品😀', author: '' }]), /表示できない文字/);
    await assert.rejects(makePdf([{ title: 'あ'.repeat(31), author: '' }]), /長すぎます/);
    await assert.rejects(makePdf([{ title: '作品\n名前', author: '' }]), /改行を使えません/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('英数字を含む長いタイトルがPDF上で中央に配置される', async () => {
  const originalFetch = globalThis.fetch;
  const font = await readFile(new URL('../public/fonts/NotoSansJP-Regular.ttf', import.meta.url));
  globalThis.fetch = async () => new Response(font);
  try {
    const titles = ['No Coffee No Life2', '作品タイトル ABC123'];
    const bytes = await makePdf(titles.map(title => ({ title, author: '' })));
    const pdf = await getDocument({ data: bytes }).promise;
    try {
      const content = await (await pdf.getPage(1)).getTextContent();
      for (const [index, title] of titles.entries()) {
        const item = content.items.find(item => item.str === title);
        assert.ok(item, `タイトルを抽出できる: ${title}`);
        assert.ok(Math.abs(item.transform[4] + item.width / 2 - (108.5 + index * 189)) < 0.1);
      }
    } finally {
      await pdf.destroy();
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
