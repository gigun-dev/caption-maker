import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

export async function makePdf(rows, fields = ['title', 'author']) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const response = await fetch(`${import.meta.env?.BASE_URL ?? '/'}fonts/NotoSansJP-Regular.ttf`);
  if (!response.ok) throw new Error('フォントを読み込めませんでした。');
  // fontkit のサブセットは一部のビューアでグリフを欠落させるため、静的フォント全体を埋め込む。
  const font = await pdf.embedFont(await response.arrayBuffer(), { subset: false });
  const supported = new Set(font.getCharacterSet());
  const width = 595, height = 842, cardW = 181, cardH = 130, gap = 8;
  for (let i = 0; i < rows.length; i += 18) {
    const page = pdf.addPage([width, height]);
    for (let n = 0; n < 18 && i + n < rows.length; n++) {
      const row = rows[i + n];
      const title = fields[0] === 'none' ? '' : String(row[fields[0]] || '').trim();
      const author = fields[1] === 'none' ? '' : String(row[fields[1]] || '').trim();
      for (const [line, text] of [title, author].entries()) {
        if (/[\r\n]/.test(text)) throw new Error(`${i+n+1}件目の${line+1}行目には改行を使えません。`);
        const unsupported = [...text].find(char => !supported.has(char.codePointAt(0)));
        if (unsupported) throw new Error(`${i+n+1}件目の${line+1}行目に表示できない文字「${unsupported}」があります。`);
      }
      const x = 18 + (n % 3) * (cardW + gap);
      const top = 11 + Math.floor(n / 3) * (cardH + gap);
      const centerX = x + cardW / 2;
      const fit = (text, max, size) => { while (size > 5 && font.widthOfTextAtSize(text, size) > max) size -= .25; return size; };
      const titleSize = fit(title, 149, 12), authorSize = fit(author, 149, 8);
      if (font.widthOfTextAtSize(title, titleSize) > 149 || font.widthOfTextAtSize(author, authorSize) > 149) throw new Error(`${i+n+1}行目の文字が長すぎます。短くしてください。`);
      const y = height - top;
      page.drawRectangle({ x: x + 0.5, y: y - cardH + 0.5, width: cardW - 1, height: cardH - 1, borderWidth: 1, borderColor: rgb(187 / 255, 187 / 255, 187 / 255) });
      page.drawText(title, { x: centerX - font.widthOfTextAtSize(title, titleSize)/2, y: y - 49, size: titleSize, font, color: rgb(0,0,0) });
      page.drawLine({ start: {x:x+16,y:y-65}, end:{x:x+165,y:y-65}, thickness:1, color:rgb(0,0,0) });
      page.drawText(author, { x:centerX-font.widthOfTextAtSize(author,authorSize)/2, y:y-83, size:authorSize, font, color:rgb(0,0,0) });
    }
  }
  return pdf.save();
}
