import { useEffect, useRef, useState } from 'react';
import { Button } from '@cloudflare/kumo/components/button';
import { Dialog } from '@cloudflare/kumo/components/dialog';
import { ArrowsOutIcon, CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';

let previewModule;
const loadPreview = async () => previewModule ??= await import('./pdf-preview.js');

// pdf.js の配置と同じ単位（pt）。A4 に 3列×6行で並ぶ。
const PAGE = { w: 595, h: 842 }, CARD = { w: 181, h: 130, gap: 8, left: 18, top: 11 };
export const PER_PAGE = 18;

function PreviewCanvas({ getPdf, snapshot, total, page, highlight, maxWidth = Infinity }) {
  const stage = useRef(null), canvas = useRef(null);
  const [message, setMessage] = useState('');
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [drawn, setDrawn] = useState(0);
  const opened = useRef(null);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setSize({ w: Math.floor(entry.contentRect.width), h: Math.floor(entry.contentRect.height) }));
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);

  // 枠の大きさに収まる幅。高さが決まらないとき（拡大表示）は幅に合わせる。
  const width = Math.floor(Math.min(size.w, maxWidth, size.h ? size.h * PAGE.w / PAGE.h : Infinity));

  useEffect(() => {
    if (!total) { setMessage('作品を入力すると、ここに印刷イメージが出ます。'); return; }
    if (width < 40) return;
    let cancelled = false;
    setMessage(current => current || 'PDFを準備しています…');
    const timer = setTimeout(async () => {
      try {
        const bytes = await getPdf(snapshot);
        const preview = await loadPreview();
        if (cancelled) return;
        if (opened.current !== snapshot) {
          if (!await preview.openPreview(bytes) || cancelled) return;
          opened.current = snapshot;
        }
        await preview.renderPreview(canvas.current, Math.min(page, total), width);
        if (!cancelled) { setMessage(''); setDrawn(width); }
      } catch (error) {
        if (!cancelled) setMessage(error.message || 'プレビューを表示できませんでした。');
      }
    }, 180);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [snapshot, total, page, width, getPdf]);

  const scale = drawn / PAGE.w;
  const slot = highlight - (page - 1) * PER_PAGE;
  const showHighlight = !message && slot >= 0 && slot < PER_PAGE;
  return (
    <div ref={stage} className="flex h-full min-h-0 items-start justify-center">
      <div className="relative" hidden={Boolean(message)}>
        <canvas ref={canvas} className="block bg-white shadow-md ring-1 ring-kumo-line" aria-label={`PDFの${page}ページ目`} />
        {showHighlight && (
          <div aria-hidden="true" className="pointer-events-none absolute rounded-sm ring-2 ring-kumo-brand" style={{
            left: (CARD.left + (slot % 3) * (CARD.w + CARD.gap)) * scale,
            top: (CARD.top + Math.floor(slot / 3) * (CARD.h + CARD.gap)) * scale,
            width: CARD.w * scale, height: CARD.h * scale,
          }} />
        )}
      </div>
      {message && <p role="status" className="self-center px-4 text-center text-sm text-kumo-subtle">{message}</p>}
    </div>
  );
}

export function PreviewPane({ getPdf, snapshot, page, onPage, highlight }) {
  const total = Math.ceil(snapshot.rows.length / PER_PAGE);
  const [zoom, setZoom] = useState(false);
  const current = Math.min(page, Math.max(total, 1));
  const controls = (
    <div className="flex items-center gap-1">
      <Button variant="ghost" shape="square" icon={<CaretLeftIcon />} aria-label="前のページ" disabled={!total || current <= 1} onClick={() => onPage(current - 1)} />
      <span className="min-w-14 text-center text-sm tabular-nums" aria-live="polite">{total ? `${current} / ${total}` : '— / —'}</span>
      <Button variant="ghost" shape="square" icon={<CaretRightIcon />} aria-label="次のページ" disabled={!total || current >= total} onClick={() => onPage(current + 1)} />
    </div>
  );
  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="印刷イメージ">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5">
        <h2 className="text-sm font-semibold">印刷イメージ</h2>
        <div className="flex items-center gap-1">
          {controls}
          <Button variant="ghost" shape="square" icon={<ArrowsOutIcon />} aria-label="大きく表示" disabled={!total} onClick={() => setZoom(true)} />
        </div>
      </div>
      <div className="min-h-0 flex-1 px-3 pb-3">
        {!zoom && <PreviewCanvas getPdf={getPdf} snapshot={snapshot} total={total} page={current} highlight={highlight} />}
      </div>
      <Dialog.Root open={zoom} onOpenChange={setZoom}>
        <Dialog size="xl" className="max-h-[92dvh] overflow-auto p-4">
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold">印刷イメージ</Dialog.Title>
            <Dialog.Close render={props => <Button {...props}>閉じる</Button>} />
          </div>
          <div className="h-[75dvh]">
            <PreviewCanvas getPdf={getPdf} snapshot={snapshot} total={total} page={current} highlight={highlight} maxWidth={840} />
          </div>
          <div className="mt-3 flex justify-center">{controls}</div>
        </Dialog>
      </Dialog.Root>
    </section>
  );
}

// キーボード表示中に、編集しているキャプション1枚だけを PDF と同じ比率で見せる帯。
export function CaptionStrip({ title, author, label }) {
  const height = 84, scale = height / CARD.h;
  // pdf.js と同じく、ベースライン位置（カード上端から 49pt・83pt）に文字を置く。
  const text = (value, size, baseline) => (
    <span className="absolute inset-x-0 truncate text-center whitespace-pre" style={{ fontSize: size * scale, lineHeight: 1, top: (baseline - size * 0.88) * scale, paddingInline: 16 * scale }}>{value}</span>
  );
  return (
    <div className="flex h-full items-center gap-3 px-3" aria-label="編集中のキャプション">
      <span className="w-16 shrink-0 text-xs text-kumo-subtle">{label}</span>
      <div className="caption-face relative shrink-0 bg-white text-black shadow-md ring-1 ring-kumo-line" style={{ width: CARD.w * scale, height }}>
        {text(title, 12, 49)}
        <span className="absolute bg-black" style={{ left: 16 * scale, width: 149 * scale, height: 1, top: 65 * scale }} />
        {text(author, 8, 83)}
      </div>
    </div>
  );
}
