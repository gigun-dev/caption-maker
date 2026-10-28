import test from 'node:test';
import assert from 'node:assert/strict';
import { parseImport, exportCsv } from '../src/import.js';

const columns = [{ id: 'author', name: '作者名' }, { id: 'title', name: '作品タイトル' }, { id: 'year', name: '年' }];

test('quoted values and reordered custom columns survive a CSV round trip', () => {
  const data = [{ title: '海,空', author: '山田', year: '2024' }];
  assert.deepEqual(parseImport(exportCsv(columns, data), columns).rows, data);
});

test('recognizes legacy headers independently of current column order', () => {
  assert.deepEqual(parseImport('title\tauthor\n海\t山田', columns).rows, [{ title: '海', author: '山田' }]);
});

test('single-column CSV does not import its own header as a work', () => {
  const single = [{ id: 'title', name: '作品タイトル' }];
  const rows = [{ title: '海' }, { title: '森' }];
  assert.deepEqual(parseImport(exportCsv(single, rows), single).rows, rows);
});

test('one-column text is accepted, excessive columns and malformed quotes are rejected', () => {
  assert.deepEqual(parseImport('海\n森', columns).rows, [{ author: '海' }, { author: '森' }]);
  assert.ok(parseImport('a,b,c,d', columns).error);
  assert.ok(parseImport('"unclosed', columns).error);
});

test('half-width and full-width spaces can be selected or detected', () => {
  const two = [{ id: 'title', name: '作品タイトル' }, { id: 'author', name: '作者名' }];
  for (const [input, mode, label] of [['海 山田\n森 佐藤','space','半角スペース'], ['海　山田\n森　佐藤','fullwidthSpace','全角スペース']]) {
    for (const selected of [mode, 'auto']) {
      const result = parseImport(input, two, selected);
      assert.deepEqual(result.rows, [{title:'海',author:'山田'},{title:'森',author:'佐藤'}]);
      assert.equal(result.delimiter, label);
    }
  }
});

test('explicit separator or no separator prevents unwanted automatic splitting', () => {
  const two = [{ id: 'title', name: '作品タイトル' }, { id: 'author', name: '作者名' }];
  assert.deepEqual(parseImport('海の 記憶,山田 花子', two, 'comma').rows, [{title:'海の 記憶',author:'山田 花子'}]);
  assert.deepEqual(parseImport('海の 記憶\n森の ひかり', two, 'line').rows, [{title:'海の 記憶'},{title:'森の ひかり'}]);
});

test('reports all excess records and preserves parsed cells for diagnosis', () => {
  const two = [{ id:'title', name:'作品タイトル' },{ id:'author', name:'作者名' }];
  const result = parseImport('作品タイトル,作者名\n海,山田,余分\n森,佐藤\n空,,予備', two, 'comma');
  assert.equal(result.expected, 2);
  assert.deepEqual(result.problems, [
    {record:2, sourceLine:2, values:['海','山田','余分'], expected:2},
    {record:4, sourceLine:4, values:['空','','予備'], expected:2},
  ]);
  assert.deepEqual(result.rows, []);
});


test('extra trailing empty fields do not block the import, but populated fields do', () => {
  const two = [{id:'title',name:'作品タイトル'},{id:'author',name:'作者名'}];
  assert.deepEqual(parseImport('海\t山田\t\n森\t佐藤\t　', two, 'tab').rows, [{title:'海',author:'山田'},{title:'森',author:'佐藤'}]);
  assert.ok(parseImport('海\t山田\t余分',two,'tab').error);
});

test('error positions point to physical lines after blank and quoted multiline records', () => {
  const two = [{id:'title',name:'作品タイトル'},{id:'author',name:'作者名'}];
  const result = parseImport('作品タイトル,作者名\n\n"海\n空",山田\n森,佐藤,超過', two, 'comma');
  assert.equal(result.problems[0].sourceLine,5);
});
