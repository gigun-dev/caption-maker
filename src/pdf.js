import { generate } from '@pdfme/generator';
import { rectangle, text } from '@pdfme/schemas';
import fontkit from '@pdf-lib/fontkit';

const pt = value => value * 25.4 / 72;
const PAGE_WIDTH = 595, PAGE_HEIGHT = 842, CARD_WIDTH = 181, CARD_HEIGHT = 130, GAP = 8;

function rectangleSchema(name, x, y, width, height, color, borderColor = color, borderWidth = 0) {
  return { name, type: 'rectangle', position: { x: pt(x), y: pt(y) }, width: pt(width), height: pt(height), color, borderColor, borderWidth: pt(borderWidth) };
}

function textSchema(name, x, y, fontSize) {
  return {
    name, type: 'text', position: { x: pt(x), y: pt(y) }, width: pt(149), height: pt(20),
    alignment: 'center', verticalAlignment: 'middle', fontName: 'NotoSansJP', fontSize,
    lineHeight: 1, characterSpacing: 0, fontColor: '#000000', backgroundColor: '',
    dynamicFontSize: { min: 5, max: fontSize, fit: 'horizontal' },
  };
}

export async function makePdf(rows, fields = ['title', 'author']) {
  if (!rows.length) throw new Error('作品を1件以上入力してください。');
  const response = await fetch(`${import.meta.env?.BASE_URL ?? '/'}fonts/NotoSansJP-Regular.ttf`);
  if (!response.ok) throw new Error('フォントを読み込めませんでした。');
  const fontData = new Uint8Array(await response.arrayBuffer());
  const font = fontkit.create(fontData);
  const supported = new Set(font.characterSet);
  const schemas = [];
  const input = {};

  for (let i = 0; i < rows.length; i += 18) {
    const page = [];
    for (let n = 0; n < 18 && i + n < rows.length; n++) {
      const row = rows[i + n];
      const values = fields.map(field => field === 'none' ? '' : String(row[field] || '').trim());
      for (const [line, value] of values.entries()) {
        if (/[\r\n]/.test(value)) throw new Error(`${i+n+1}件目の${line+1}行目には改行を使えません。`);
        const unsupported = [...value].find(char => !supported.has(char.codePointAt(0)));
        if (unsupported) throw new Error(`${i+n+1}件目の${line+1}行目に表示できない文字「${unsupported}」があります。`);
        const width = font.layout(value).glyphs.reduce((sum, glyph) => sum + glyph.advanceWidth, 0) * 5 / font.unitsPerEm;
        if (width > 149) throw new Error(`${i+n+1}行目の文字が長すぎます。短くしてください。`);
      }
      const x = 18 + (n % 3) * (CARD_WIDTH + GAP);
      const top = 11 + Math.floor(n / 3) * (CARD_HEIGHT + GAP);
      const prefix = `card${i+n}`;
      page.push(
        rectangleSchema(`${prefix}-frame`, x + 0.5, top + 0.5, CARD_WIDTH - 1, CARD_HEIGHT - 1, '', '#bbbbbb', 1),
        rectangleSchema(`${prefix}-line`, x + 16, top + 64.5, 149, 1, '#000000'),
        textSchema(`${prefix}-title`, x + 16, top + 33.75, 12),
        textSchema(`${prefix}-author`, x + 16, top + 70, 8),
      );
      input[`${prefix}-frame`] = ' ';
      input[`${prefix}-line`] = ' ';
      input[`${prefix}-title`] = values[0];
      input[`${prefix}-author`] = values[1];
    }
    schemas.push(page);
  }
  return generate({
    template: { basePdf: { width: pt(PAGE_WIDTH), height: pt(PAGE_HEIGHT), padding: [0, 0, 0, 0] }, schemas },
    inputs: [input],
    plugins: { text, rectangle },
    options: { font: { NotoSansJP: { data: fontData, fallback: true, subset: false } } },
  });
}
