import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@cloudflare/kumo/components/button';
import { Dialog } from '@cloudflare/kumo/components/dialog';
import { Select } from '@cloudflare/kumo/components/select';
import { ClipboardTextIcon, DownloadSimpleIcon, FilePdfIcon, GearSixIcon, TableIcon } from '@phosphor-icons/react';
import { makePdf } from './pdf.js';
import { exportCsv } from './import.js';
import { emptyRow, load, save, withKey } from './storage.js';
import { WorksTable, hasContent } from './WorksTable.jsx';
import { CaptionStrip, PER_PAGE, PreviewPane } from './PreviewPane.jsx';
import { ImportPanel } from './ImportPanel.jsx';
import { SplitView, useKeyboardOpen, useWide } from './SplitView.jsx';

const initial = load();

function download(blob, name) {
  const a = document.createElement('a'), url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

const methods = {
  table: { icon: TableIcon, label: '1件ずつ入力', short: '表に入力', description: 'Excelのような表に、作品名と作者名を入れていきます。' },
  paste: { icon: ClipboardTextIcon, label: 'まとめて貼り付け', short: '貼り付け', description: 'LINEやメモ、Excelで集めた一覧をそのまま貼り付けます。' },
};

function MethodChoice({ onChoose }) {
  return (
    <div className="flex h-full flex-col justify-center gap-3 p-4">
      <p className="text-center text-sm text-kumo-subtle">作品の入れ方を選んでください</p>
      {Object.entries(methods).map(([id, { icon: Icon, label, description }]) => (
        <button key={id} type="button" onClick={() => onChoose(id)}
          className="flex items-center gap-4 rounded-xl border border-kumo-line bg-kumo-base p-4 text-left shadow-sm transition hover:border-kumo-brand hover:bg-kumo-tint focus-visible:ring-2 focus-visible:ring-kumo-focus focus-visible:outline-none">
          <Icon size={32} className="shrink-0 text-kumo-brand" />
          <span>
            <span className="block text-base font-semibold">{label}</span>
            <span className="mt-0.5 block text-sm text-kumo-subtle">{description}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function MethodSwitch({ method, onChoose }) {
  return (
    <div className="flex gap-1 rounded-lg bg-kumo-recessed p-1" role="group" aria-label="入れ方">
      {Object.entries(methods).map(([id, { icon: Icon, short }]) => (
        <button key={id} type="button" aria-pressed={method === id} onClick={() => onChoose(id)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition ${method === id ? 'bg-kumo-base font-semibold shadow-sm ring-1 ring-kumo-line' : 'text-kumo-subtle hover:text-kumo-default'}`}>
          <Icon size={16} />{short}
        </button>
      ))}
    </div>
  );
}

export function App() {
  const [columns, setColumns] = useState(initial.columns);
  const [rows, setRows] = useState(initial.rows);
  const [fields, setFields] = useState(initial.fields);
  const [method, setMethod] = useState(() => initial.rows.some(row => hasContent(row, initial.columns)) ? 'table' : null);
  const [pasteText, setPasteText] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [focusedRow, setFocusedRow] = useState(-1);
  const [page, setPage] = useState(1);
  const keyboard = useKeyboardOpen();
  const wide = useWide();

  useEffect(() => {
    if (!save({ columns, rows, fields })) setStatus('自動保存できませんでした。');
  }, [columns, rows, fields]);

  // 出力に使う列が消えたら、有効な値に戻す。
  const validFields = fields.map((field, index) => columns.some(c => c.id === field) || field === 'none' ? field : (index === 0 ? columns[0].id : 'none'));
  const active = useMemo(() => rows.filter(row => hasContent(row, columns)), [rows, columns]);
  const snapshot = useMemo(() => ({ rows: active, fields: validFields }), [active, validFields.join()]);

  const cache = useRef(new WeakMap());
  const getPdf = useCallback(snap => {
    if (!snap.rows.length) return Promise.reject(new Error('作品を1件以上入力してください。'));
    if (snap.fields.every(field => field === 'none')) return Promise.reject(new Error('出力する項目を1つ以上選んでください。'));
    if (!cache.current.has(snap)) cache.current.set(snap, makePdf(snap.rows, snap.fields));
    return cache.current.get(snap);
  }, []);

  // 編集中の行が PDF の何枚目に載るか。空行は PDF に出ないので数えない。
  const focused = rows[focusedRow];
  const position = focused ? rows.slice(0, focusedRow).filter(row => hasContent(row, columns)).length : -1;
  useEffect(() => {
    if (position >= 0) setPage(Math.floor(position / PER_PAGE) + 1);
  }, [position]);

  const changeColumns = (next, removedId) => {
    setColumns(next);
    if (removedId) setRows(rows.map(({ [removedId]: _, ...row }) => row));
  };
  const importRows = added => {
    const kept = rows.length === 1 && !hasContent(rows[0], columns) ? [] : rows;
    setRows([...kept, ...added.map(withKey)]);
    setPasteText('');
    setMethod('table');
    setStatus(`${added.length}件を追加しました。`);
    requestAnimationFrame(() => document.querySelector(`[data-row="${kept.length}"]`)?.scrollIntoView({ block: 'center' }));
  };
  const createPdf = async () => {
    setBusy(true);
    setStatus('PDFを作成しています…');
    try {
      download(new Blob([await getPdf(snapshot)], { type: 'application/pdf' }), 'captions.pdf');
      setStatus(`${snapshot.rows.length}作品のPDFを保存しました。`);
    } catch (error) {
      setStatus(error.message || 'PDFを作成できませんでした。');
    } finally {
      setBusy(false);
    }
  };

  const fieldItems = { ...Object.fromEntries(columns.map(c => [c.id, c.name])), none: '表示しない' };
  const caption = index => focused && validFields[index] !== 'none' ? String(focused[validFields[index]] || '') : '';
  const collapsed = keyboard && !wide;

  const input = method === null ? <MethodChoice onChoose={setMethod} /> : (
    <div className="space-y-3 px-3 pb-3">
      <div className="sticky top-0 z-10 -mx-3 bg-kumo-canvas/95 px-3 pt-3 pb-1 backdrop-blur"><MethodSwitch method={method} onChoose={setMethod} /></div>
      {method === 'table'
        ? <WorksTable columns={columns} rows={rows} newRow={emptyRow} onRows={setRows} onColumns={changeColumns} onMessage={setStatus} onFocusRow={setFocusedRow} />
        : <ImportPanel text={pasteText} onText={setPasteText} columns={columns} onImport={importRows} />}
    </div>
  );
  const preview = collapsed
    ? <CaptionStrip title={caption(0)} author={caption(1)} label={focused ? `${focusedRow + 1}行目` : ''} />
    : <PreviewPane getPdf={getPdf} snapshot={snapshot} page={page} onPage={setPage} highlight={focused && hasContent(focused, columns) ? position : -1} />;

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: 'var(--visible-height, 100dvh)' }}>
      <header className="flex shrink-0 items-center gap-2 border-b border-kumo-line bg-kumo-base px-3 py-2">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold">展示キャプション</h1>
          <p className="truncate text-xs text-kumo-subtle" aria-live="polite">{status || `${active.length}作品・A4 ${Math.max(1, Math.ceil(active.length / PER_PAGE))}枚`}</p>
        </div>
        <Button variant="ghost" shape="square" icon={<GearSixIcon />} aria-label="設定" onClick={() => setSettingsOpen(true)} />
        <Button variant="primary" icon={<FilePdfIcon />} loading={busy} disabled={!active.length} onClick={createPdf}>PDFを保存</Button>
      </header>

      <SplitView first={input} second={preview} collapsed={collapsed} wide={wide} />

      <Dialog.Root open={settingsOpen} onOpenChange={setSettingsOpen}>
        <Dialog className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold">設定</Dialog.Title>
            <Dialog.Close render={props => <Button {...props}>閉じる</Button>} />
          </div>
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">キャプションに出す内容</h3>
            {['1行目（大きい文字）', '2行目（小さい文字）'].map((label, index) => (
              <Select key={label} className="w-full" label={label} value={validFields[index]} items={fieldItems}
                onValueChange={value => setFields(validFields.map((f, i) => i === index ? value ?? f : f))} />
            ))}
            {validFields[0] === validFields[1] && validFields[0] !== 'none' && <p className="text-sm text-kumo-warning" role="status">同じ項目を上下に表示します。</p>}
          </section>
          <section className="space-y-2 border-t border-kumo-line pt-4">
            <h3 className="text-sm font-semibold">データの書き出し</h3>
            <Button icon={<DownloadSimpleIcon />} disabled={!active.length} onClick={() => download(new Blob([exportCsv(columns, active)], { type: 'text/csv;charset=utf-8' }), 'captions.csv')}>CSVを書き出す</Button>
          </section>
        </Dialog>
      </Dialog.Root>
    </div>
  );
}
