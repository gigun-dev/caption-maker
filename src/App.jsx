import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@cloudflare/kumo/components/button';
import { Select } from '@cloudflare/kumo/components/select';
import { Tabs } from '@cloudflare/kumo/components/tabs';
import { DownloadSimpleIcon, FilePdfIcon, ListPlusIcon } from '@phosphor-icons/react';
import { makePdf } from './pdf.js';
import { exportCsv } from './import.js';
import { emptyRow, load, save, withKey } from './storage.js';
import { WorksTable, hasContent } from './WorksTable.jsx';
import { PreviewPane } from './PreviewPane.jsx';
import { ImportDialog } from './ImportDialog.jsx';

const initial = load();

function download(blob, name) {
  const a = document.createElement('a'), url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function App() {
  const [columns, setColumns] = useState(initial.columns);
  const [rows, setRows] = useState(initial.rows);
  const [fields, setFields] = useState(initial.fields);
  const [view, setView] = useState('works');
  const [importOpen, setImportOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!save({ columns, rows, fields })) setStatus('自動保存できませんでした。CSVを書き出してください。');
  }, [columns, rows, fields]);

  // 表示しない列を選んだまま列が消えたら、出力項目を有効な値に戻す。
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

  const changeColumns = (next, removedId) => {
    setColumns(next);
    if (removedId) setRows(rows.map(({ [removedId]: _, ...row }) => row));
  };
  const importRows = added => {
    setRows([...(rows.length === 1 && !hasContent(rows[0], columns) ? [] : rows), ...added.map(withKey)]);
    setStatus(`${added.length}件を追加しました。`);
  };
  const createPdf = async () => {
    setBusy(true);
    setStatus('PDFを作成しています…');
    try {
      download(new Blob([await getPdf(snapshot)], { type: 'application/pdf' }), 'captions.pdf');
      setStatus(`${snapshot.rows.length}作品のPDFを作成しました。`);
    } catch (error) {
      setStatus(error.message || 'PDFを作成できませんでした。');
    } finally {
      setBusy(false);
    }
  };

  const fieldItems = { ...Object.fromEntries(columns.map(c => [c.id, c.name])), none: '表示しない' };

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-4 px-4 pt-4 pb-28">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-kumo-subtle">Caption Maker</p>
          <h1 className="text-xl font-semibold">展示キャプション</h1>
        </div>
        <span className="text-sm text-kumo-subtle">{active.length}作品</span>
      </header>

      <nav className="flex flex-wrap items-center justify-between gap-2" aria-label="画面の切り替え">
        <Tabs value={view} onValueChange={setView} tabs={[{ value: 'works', label: '作品データ' }, { value: 'settings', label: '出力設定' }]} />
        {view === 'works' && <Button icon={<ListPlusIcon />} onClick={() => setImportOpen(true)}>まとめて追加</Button>}
      </nav>

      <main>
        {view === 'works'
          ? <WorksTable columns={columns} rows={rows} newRow={emptyRow} onRows={setRows} onColumns={changeColumns} onMessage={setStatus} />
          : (
            <div className="grid gap-4 md:grid-cols-[1fr_280px]">
              <PreviewPane getPdf={getPdf} snapshot={snapshot} />
              <section className="space-y-3 rounded-lg border border-kumo-line bg-kumo-base p-4">
                <h3 className="text-sm font-semibold">表示する内容と順番</h3>
                {['1行目', '2行目'].map((label, index) => (
                  <Select key={label} className="w-full" label={label} value={validFields[index]} items={fieldItems}
                    onValueChange={value => setFields(validFields.map((f, i) => i === index ? value ?? f : f))} />
                ))}
                {validFields[0] === validFields[1] && validFields[0] !== 'none' && <p className="text-sm text-kumo-warning" role="status">同じ項目を上下に表示します。</p>}
              </section>
            </div>
          )}
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-kumo-line bg-kumo-base/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-3">
          <Button variant="primary" size="lg" icon={<FilePdfIcon />} loading={busy} onClick={createPdf}>PDFを作成</Button>
          <Button variant="ghost" icon={<DownloadSimpleIcon />} onClick={() => download(new Blob([exportCsv(columns, active)], { type: 'text/csv;charset=utf-8' }), 'captions.csv')}>CSVを書き出す</Button>
          <p className="ml-auto text-sm text-kumo-subtle" aria-live="polite">{status}</p>
        </div>
      </div>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} columns={columns} onImport={importRows} />
    </div>
  );
}
