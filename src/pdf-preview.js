import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

let library;
let documentHandle;
let renderTask;
let generation = 0;

async function getLibrary() {
  if (!library) {
    library = await import('pdfjs-dist/build/pdf.mjs');
    library.GlobalWorkerOptions.workerSrc = workerUrl;
  }
  return library;
}

export async function openPreview(bytes) {
  const request = ++generation;
  const pdfjs = await getLibrary();
  if (request !== generation) return false;
  const loading = pdfjs.getDocument({ data: bytes.slice() });
  const next = await loading.promise;
  if (request !== generation) { await next.destroy(); return false; }
  if (renderTask) { renderTask.cancel(); try { await renderTask.promise; } catch {} renderTask = null; }
  if (documentHandle) await documentHandle.destroy();
  documentHandle = next;
  return true;
}

export async function renderPreview(canvas, pageNumber, cssWidth) {
  const request = generation;
  if (!documentHandle) return;
  if (renderTask) { renderTask.cancel(); try { await renderTask.promise; } catch {} }
  const page = await documentHandle.getPage(pageNumber);
  if (request !== generation) return;
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: cssWidth / base.width });
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.ceil(viewport.width * pixelRatio);
  canvas.height = Math.ceil(viewport.height * pixelRatio);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  const task = page.render({ canvasContext: canvas.getContext('2d'), viewport, transform: [pixelRatio, 0, 0, pixelRatio, 0, 0] });
  renderTask = task;
  try { await task.promise; } catch (error) { if (error.name !== 'RenderingCancelledException') throw error; }
  if (renderTask === task) renderTask = null;
}
