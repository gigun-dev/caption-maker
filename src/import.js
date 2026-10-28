import Papa from 'papaparse';

export function parseImport(text, columns, delimiterMode = 'auto') {
  if (!text.trim()) return { rows: [], error: '' };
  const delimiterOptions = { tab: '\t', comma: ',', semicolon: ';', pipe: '|', space: ' ', fullwidthSpace: '　' };
  const parsed = delimiterMode === 'line'
    ? { data: text.split(/\r\n|\r|\n/).filter(line => line.trim()).map(line => [line]), errors: [], meta: { delimiter: null } }
    : Papa.parse(text, { delimiter: delimiterOptions[delimiterMode] || '', delimitersToGuess: [',', '\t', '|', ';', ' ', '　'], skipEmptyLines: 'greedy' });
  const errors = parsed.errors.filter(error => error.code !== 'UndetectableDelimiter');
  if (errors.length) return { rows: [], error: '読み取れませんでした。引用符や区切りを確認してください。' };
  let input = parsed.data;
  if (!input.length) return { rows: [], error: '作品データがありません。' };
  const normalize = value => String(value ?? '').replace(/^\ufeff/, '').trim().toLowerCase();
  const names = columns.map(column => normalize(column.name));
  const aliases = { title: ['title', '作品タイトル', '作品名', 'タイトル'], author: ['author', '作者名', '作者', '作家名'] };
  const first = input[0].map(normalize);
  const match = first.map(value => columns.findIndex((c, i) => names[i] === value || (aliases[c.id] || []).includes(value)));
  const header = first.length >= 1 && match.every(i => i >= 0) && new Set(match).size === match.length;
  if (header) input = input.slice(1);
  const maxFields = header ? first.length : columns.length;
  // Empty trailing fields cannot contribute data to the destination table.
  const problems = input.flatMap((row, index) => row.slice(maxFields).some(value => String(value).trim())
    ? [{ record: index + 1 + (header ? 1 : 0), values: row, expected: maxFields }]
    : []);
  if (problems.length) {
    const recordLines = [];
    if (delimiterMode === 'line') {
      text.split(/\r\n|\r|\n/).forEach((line, index) => { if (line.trim()) recordLines.push(index + 1); });
    } else {
      let cursor = 0, lineNumber = 1;
      Papa.parse(text, {
        delimiter: parsed.meta.delimiter || ',', skipEmptyLines: 'greedy',
        step(result) {
          const segment = text.slice(cursor, result.meta.cursor);
          const emptyLines = segment.match(/^(?:[ \t\u3000]*(?:\r\n|\r|\n))*/)?.[0] || '';
          recordLines.push(lineNumber + (emptyLines.match(/\r\n|\r|\n/g) || []).length);
          lineNumber += (segment.match(/\r\n|\r|\n/g) || []).length;
          cursor = result.meta.cursor;
        },
      });
    }
    for (const problem of problems) problem.sourceLine = recordLines[problem.record - 1] || problem.record;
    return {
    rows: [], error: `${problems.length}行で、表の列数（${maxFields}列）を超えています。`,
    problems, expected: maxFields,
    };
  }
  const rows = input.map(values => {
    const row = {};
    values.slice(0, maxFields).forEach((value, index) => { const col = columns[header ? match[index] : index]; if (col) row[col.id] = value; });
    return row;
  }).filter(row => columns.some(c => String(row[c.id] || '').trim()));
  return { rows, error: '', delimiter: delimiterMode === 'line' || parsed.errors.some(error => error.code === 'UndetectableDelimiter') ? '改行のみ' : ({ '\t': 'タブ', ',': 'カンマ', ';': 'セミコロン', '|': '縦線', ' ': '半角スペース', '　': '全角スペース' }[parsed.meta.delimiter] || '区切り'), header };
}

export function exportCsv(columns, data) {
  return '\ufeff' + Papa.unparse({ fields: columns.map(c => c.name), data: data.map(row => columns.map(c => row[c.id] || '')) });
}
