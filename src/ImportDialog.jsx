import { useEffect, useRef, useState } from 'react';
import { Button } from '@cloudflare/kumo/components/button';
import { Dialog } from '@cloudflare/kumo/components/dialog';
import { Select } from '@cloudflare/kumo/components/select';
import { FileArrowUpIcon } from '@phosphor-icons/react';
import { createPasteEditor } from './paste-editor.js';
import { parseImport } from './import.js';

const delimiters = {
  auto: '自動判定', tab: 'タブ', comma: 'カンマ（,）', space: '半角スペース', fullwidthSpace: '全角スペース',
  semicolon: 'セミコロン（;）', pipe: '縦線（|）', line: '区切らない（1行1列）',
};

function PasteEditor({ initial, onReady, onChange }) {
  const host = useRef(null);
  useEffect(() => {
    const editor = createPasteEditor(host.current, () => onChange(editor.text()), initial);
    onReady(editor);
    return () => { onReady(null); editor.destroy(); };
  }, []);
  return <div ref={host} className="paste-editor overflow-hidden rounded-lg border border-kumo-line focus-within:ring-2 focus-within:ring-kumo-focus" />;
}

export function ImportDialog({ open, onOpenChange, columns, onImport }) {
  const editor = useRef(null);
  const [text, setText] = useState('');
  const [mode, setMode] = useState('auto');
  const [whitespace, setWhitespace] = useState(true);
  const [fileError, setFileError] = useState('');
  const result = text.trim() ? parseImport(text, columns, mode) : null;

  useEffect(() => { editor.current?.setProblems(result?.problems?.map(p => p.sourceLine) ?? []); }, [result?.problems?.length, text, mode]);
  useEffect(() => { editor.current?.setWhitespace(whitespace); }, [whitespace]);

  const close = () => onOpenChange(false);
  const add = () => {
    if (!result?.rows.length) return;
    onImport(result.rows);
    editor.current?.replace('');
    close();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog size="lg" className="max-h-[92dvh] overflow-auto p-6">
        <Dialog.Title className="text-lg font-semibold">作品をまとめて追加</Dialog.Title>
        <Dialog.Description className="mt-1 text-sm text-kumo-subtle">スプレッドシートのセルをコピーして貼り付けるか、1行に1作品ずつ入力します。</Dialog.Description>

        <label className="mt-4 inline-flex">
          <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-kumo-control px-3 text-sm font-medium ring-1 ring-kumo-line hover:bg-kumo-tint">
            <FileArrowUpIcon />CSVを読み込む
          </span>
          <input type="file" className="sr-only" accept=".csv,.txt,.tsv,text/csv,text/plain" onChange={async event => {
            const file = event.target.files[0];
            event.target.value = '';
            setFileError('');
            try { if (file) editor.current.replace(await file.text()); } catch { setFileError('ファイルを読み込めませんでした。'); }
          }} />
        </label>

        <div className="mt-4 mb-1.5 flex items-center justify-between gap-3">
          <span className="text-sm font-medium">貼り付け・入力</span>
          <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={whitespace} onChange={e => setWhitespace(e.target.checked)} />空白を表示</label>
        </div>
        <PasteEditor initial={text} onReady={e => { editor.current = e; e?.setWhitespace(whitespace); }} onChange={setText} />
        <p className="editor-legend mt-1.5 flex flex-wrap gap-3.5 text-xs text-kumo-subtle"><span className="legend-half">半角</span><span className="legend-full">全角</span><span className="legend-tab">タブ</span></p>

        <Select className="mt-3 w-full" label="区切り文字" value={mode} onValueChange={v => setMode(v ?? 'auto')} items={delimiters} />

        <div className="mt-3 space-y-1 text-sm" aria-live="polite">
          {fileError && <p className="text-kumo-danger">{fileError}</p>}
          {result?.error && <p className="text-kumo-danger">{result.error}</p>}
          {result?.problems && <>
            <p>赤い行番号の行で区切りを確認してください。</p>
            {result.problems.slice(0, 5).map(problem => (
              <button key={problem.sourceLine} type="button" className="block text-left text-kumo-brand underline" onClick={() => editor.current.focusRecord(problem.sourceLine)}>
                {problem.sourceLine}行目：{problem.values.length}列（{problem.expected + 1}列目以降に値あり）
              </button>
            ))}
            {result.problems.length > 5 && <p>ほか {result.problems.length - 5} 行</p>}
          </>}
          {result && !result.error && <p className="text-kumo-subtle">{result.delimiter === '改行のみ' ? '区切らない' : `${result.delimiter}区切り`} · {result.header ? '1行目は見出し' : '見出しなし'}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={close}>キャンセル</Button>
          <Button variant="primary" disabled={!result?.rows.length} onClick={add}>{result?.rows.length ? `${result.rows.length}件を追加` : '作品を追加'}</Button>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}
