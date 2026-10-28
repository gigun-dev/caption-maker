import { useMemo, useRef, useState } from 'react';
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import { Button } from '@cloudflare/kumo/components/button';
import { Dialog } from '@cloudflare/kumo/components/dialog';
import { DropdownMenu } from '@cloudflare/kumo/components/dropdown';
import { Table } from '@cloudflare/kumo/components/table';
import { CaretDownIcon, PlusIcon } from '@phosphor-icons/react';

const features = tableFeatures({});
const helper = createColumnHelper();

export const hasContent = (row, columns) => columns.some(c => String(row[c.id] || '').trim());

function RowHeader({ row, table }) {
  const { rows, onRows, confirm } = table.options.meta;
  const index = row.index;
  const update = next => onRows(next);
  const insert = at => update(rows.toSpliced(at, 0, table.options.meta.newRow()));
  const move = delta => {
    const next = [...rows];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    update(next);
  };
  const remove = () => {
    const next = rows.toSpliced(index, 1);
    update(next.length ? next : [table.options.meta.newRow()]);
  };
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger render={<Button variant="ghost" size="sm" className="w-10 justify-center tabular-nums" aria-label={`${index + 1}行目の操作`}>{index + 1}</Button>} />
      <DropdownMenu.Content>
        <DropdownMenu.Item onClick={() => insert(index)}>上に行を挿入</DropdownMenu.Item>
        <DropdownMenu.Item onClick={() => insert(index + 1)}>下に行を挿入</DropdownMenu.Item>
        <DropdownMenu.Item disabled={index === 0} onClick={() => move(-1)}>上へ移動</DropdownMenu.Item>
        <DropdownMenu.Item disabled={index === rows.length - 1} onClick={() => move(1)}>下へ移動</DropdownMenu.Item>
        <DropdownMenu.Item variant="danger" onClick={() => hasContent(row.original, table.options.meta.columns) ? confirm('この行のデータを削除しますか？', remove) : remove()}>行を削除</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

function ValueCell({ row, column, table }) {
  const { rows, onRows, columns } = table.options.meta;
  const name = columns.find(c => c.id === column.id)?.name ?? '';
  return (
    <input
      className="h-11 w-full min-w-0 bg-transparent px-3 text-base text-kumo-default outline-none placeholder:text-kumo-subtle focus:bg-kumo-tint focus:ring-2 focus:ring-kumo-focus focus:ring-inset"
      value={row.original[column.id] ?? ''}
      placeholder={name}
      aria-label={`${row.index + 1}行目 ${name}`}
      data-row={row.index}
      onChange={event => onRows(rows.map((r, i) => i === row.index ? { ...r, [column.id]: event.target.value } : r))}
    />
  );
}

function ColumnHeader({ column, table }) {
  const { columns, onColumns, onRename, confirm, rows } = table.options.meta;
  const index = columns.findIndex(c => c.id === column.id);
  const current = columns[index];
  const move = delta => {
    const next = [...columns];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onColumns(next);
  };
  const remove = () => onColumns(columns.toSpliced(index, 1), current.id);
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger render={<Button variant="ghost" size="sm" className="font-semibold" aria-label={`${current.name} 列の操作`}>{current.name}<CaretDownIcon size={12} /></Button>} />
      <DropdownMenu.Content>
        <DropdownMenu.Item onClick={() => onRename(current.id)}>列名を変更</DropdownMenu.Item>
        <DropdownMenu.Item onClick={() => table.options.meta.insertColumn(index)}>左に列を挿入</DropdownMenu.Item>
        <DropdownMenu.Item onClick={() => table.options.meta.insertColumn(index + 1)}>右に列を挿入</DropdownMenu.Item>
        <DropdownMenu.Item disabled={index === 0} onClick={() => move(-1)}>左へ移動</DropdownMenu.Item>
        <DropdownMenu.Item disabled={index === columns.length - 1} onClick={() => move(1)}>右へ移動</DropdownMenu.Item>
        <DropdownMenu.Item variant="danger" disabled={columns.length === 1} onClick={() => rows.some(r => String(r[current.id] || '').trim()) ? confirm('この列のデータを削除しますか？', remove) : remove()}>列を削除</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

function RenameInput({ column, columns, onDone }) {
  const [value, setValue] = useState(column.name);
  const finished = useRef(false);
  const finish = commit => {
    if (finished.current) return;
    finished.current = true;
    onDone(commit ? value.trim() : null);
  };
  return (
    <input
      autoFocus
      onFocus={event => event.target.select()}
      className="h-9 w-full rounded-md bg-kumo-base px-2 text-sm font-semibold ring-2 ring-kumo-focus outline-none"
      value={value}
      maxLength={60}
      aria-label={`${column.name} の列名`}
      onChange={event => setValue(event.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Enter') { event.preventDefault(); finish(true); }
        if (event.key === 'Escape') { event.preventDefault(); finish(false); }
      }}
    />
  );
}

export function WorksTable({ columns, rows, newRow, onRows, onColumns, onMessage }) {
  const [renaming, setRenaming] = useState(null);
  const [pending, setPending] = useState(null);
  const columnDefs = useMemo(() => [
    helper.display({ id: '_row', header: () => <span className="block w-10 text-center text-kumo-subtle">#</span>, cell: RowHeader }),
    ...columns.map(c => helper.accessor(row => row[c.id] ?? '', { id: c.id, header: ColumnHeader, cell: ValueCell })),
  ], [columns]);

  const insertColumn = at => {
    let n = 1;
    while (columns.some(c => c.id === `column${n}`)) n++;
    let name = '新しい列', suffix = 2;
    while (columns.some(c => c.name === name)) name = `新しい列 ${suffix++}`;
    const id = `column${n}`;
    onColumns(columns.toSpliced(at, 0, { id, name }));
    setRenaming(id);
  };
  const rename = (id, name) => {
    setRenaming(null);
    if (!name) return;
    if (columns.some(c => c.id !== id && c.name.trim().toLowerCase() === name.toLowerCase())) {
      onMessage('同じ列名は使えません。');
      return;
    }
    onColumns(columns.map(c => c.id === id ? { ...c, name } : c));
  };
  const confirm = (message, action) => setPending({ message, action });

  const table = useTable({
    features,
    columns: columnDefs,
    data: rows,
    getRowId: row => String(row._key),
    meta: { columns, rows, onRows, onColumns, newRow, insertColumn, confirm, onRename: setRenaming },
  });

  const addRow = () => {
    onRows([...rows, newRow()]);
    requestAnimationFrame(() => document.querySelector(`[data-row="${rows.length}"]`)?.focus());
  };

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-kumo-line bg-kumo-base" role="region" aria-label="作品の表" tabIndex={0}>
        <Table layout="auto" style={{ minWidth: `${Math.max(320, 56 + columns.length * 120 + 56)}px` }}>
          <Table.Header>
            {table.getHeaderGroups().map(group => (
              <Table.Row key={group.id}>
                {group.headers.map(header => (
                  <Table.Head key={header.id} className={header.id === '_row' ? 'w-14' : ''}>
                    {renaming === header.id
                      ? <RenameInput column={columns.find(c => c.id === header.id)} columns={columns} onDone={name => rename(header.id, name)} />
                      : <table.FlexRender header={header} />}
                  </Table.Head>
                ))}
                <Table.Head className="w-14">
                  <Button variant="ghost" size="sm" shape="square" icon={<PlusIcon />} aria-label="列を追加" title="列を追加" onClick={() => insertColumn(columns.length)} />
                </Table.Head>
              </Table.Row>
            ))}
          </Table.Header>
          <Table.Body>
            {table.getRowModel().rows.map(row => (
              <Table.Row key={row.id}>
                {row.getAllCells().map(cell => (
                  <Table.Cell key={cell.id} className={cell.column.id === '_row' ? 'w-14' : 'p-0'}>
                    <table.FlexRender cell={cell} />
                  </Table.Cell>
                ))}
                <Table.Cell aria-hidden="true" />
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
        <div className="border-t border-kumo-line p-2">
          <Button variant="ghost" icon={<PlusIcon />} onClick={addRow}>行を追加</Button>
        </div>
      </div>
      <Dialog.Root open={Boolean(pending)} onOpenChange={open => { if (!open) setPending(null); }}>
        <Dialog size="sm" className="p-6">
          <Dialog.Title className="mb-4 text-base font-semibold">{pending?.message}</Dialog.Title>
          <div className="flex justify-end gap-2">
            <Dialog.Close render={props => <Button {...props}>キャンセル</Button>} />
            <Button variant="destructive" onClick={() => { pending.action(); setPending(null); }}>削除</Button>
          </div>
        </Dialog>
      </Dialog.Root>
    </>
  );
}
