import { useEffect, useRef, useState } from 'react';
import { Button } from '@cloudflare/kumo/components/button';
import { Dialog } from '@cloudflare/kumo/components/dialog';
import { ArrowsOutIcon, CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';

let previewModule;
const loadPreview = async () => previewModule ??= await import('./pdf-preview.js');

function PreviewCanvas({ getPdf, snapshot, total, page, maxWidth }) {
  const stage = useRef(null), canvas = useRef(null);
  const [message, setMessage] = useState('');
  const [width, setWidth] = useState(0);
  const opened = useRef(null);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!total) { setMessage('作品を入力するとプレビューを表示します。'); return; }
    if (!width) return;
    let cancelled = false;
    setMessage('PDFを準備しています…');
    const timer = setTimeout(async () => {
      try {
        const bytes = await getPdf(snapshot);
        const preview = await loadPreview();
        if (cancelled) return;
        if (opened.current !== snapshot) {
          if (!await preview.openPreview(bytes) || cancelled) return;
          opened.current = snapshot;
        }
        await preview.renderPreview(canvas.current, Math.min(page, total), Math.min(width, maxWidth));
        if (!cancelled) setMessage('');
      } catch (error) {
        if (!cancelled) setMessage(error.message || 'プレビューを表示できませんでした。');
      }
    }, 180);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [snapshot, total, page, width, maxWidth, getPdf]);

  return (
    <div ref={stage} className="relative flex min-h-64 justify-center">
      <canvas ref={canvas} hidden={Boolean(message)} className="bg-white shadow-md ring-1 ring-kumo-line" aria-label="PDFページのプレビュー" />
      {message && <p role="status" className="self-center text-sm text-kumo-subtle">{message}</p>}
    </div>
  );
}

export function PreviewPane({ getPdf, snapshot }) {
  const total = Math.ceil(snapshot.rows.length / 18);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(false);
  const current = Math.min(page, Math.max(total, 1));
  const controls = (
    <div className="flex items-center justify-center gap-2">
      <Button shape="square" icon={<CaretLeftIcon />} aria-label="前のページ" disabled={!total || current <= 1} onClick={() => setPage(current - 1)} />
      <span className="min-w-16 text-center text-sm tabular-nums" aria-live="polite">{total ? `${current} / ${total}` : '— / —'}</span>
      <Button shape="square" icon={<CaretRightIcon />} aria-label="次のページ" disabled={!total || current >= total} onClick={() => setPage(current + 1)} />
    </div>
  );
  return (
    <section className="rounded-lg border border-kumo-line bg-kumo-elevated p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">PDFプレビュー</h3>
        <span className="text-sm text-kumo-subtle" aria-live="polite">{total ? `${total}ページ` : ''}</span>
      </div>
      {!zoom && <PreviewCanvas getPdf={getPdf} snapshot={snapshot} total={total} page={current} maxWidth={420} />}
      <div className="mt-3 flex items-center justify-center gap-3">
        {controls}
        <Button icon={<ArrowsOutIcon />} disabled={!total} onClick={() => setZoom(true)}>拡大</Button>
      </div>
      <Dialog.Root open={zoom} onOpenChange={setZoom}>
        <Dialog size="xl" className="max-h-[92dvh] overflow-auto p-4">
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold">PDFプレビュー</Dialog.Title>
            <Dialog.Close render={props => <Button {...props}>閉じる</Button>} />
          </div>
          <PreviewCanvas getPdf={getPdf} snapshot={snapshot} total={total} page={current} maxWidth={840} />
          <div className="mt-3">{controls}</div>
        </Dialog>
      </Dialog.Root>
    </section>
  );
}
