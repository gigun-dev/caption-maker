const key = 'caption-maker-table-v2', oldKey = 'caption-maker-rows-v1';
export const defaultColumns = [{ id: 'title', name: '作品タイトル' }, { id: 'author', name: '作者名' }];

let nextKey = 1;
// 行の並べ替えや挿入で React が入力欄を取り違えないよう、保存しない識別子を付ける。
export const withKey = row => ({ ...row, _key: nextKey++ });
export const emptyRow = () => withKey({});

function read(name) {
  try { return JSON.parse(localStorage.getItem(name)); } catch { return null; }
}

function valid(saved) {
  return saved && Array.isArray(saved.columns) && saved.columns.length && Array.isArray(saved.rows)
    && !saved.columns.some(c => !c || typeof c.id !== 'string' || !c.id || c.id === 'none' || c.id === '_key' || typeof c.name !== 'string')
    && new Set(saved.columns.map(c => c.id)).size === saved.columns.length
    && !saved.rows.some(r => !r || typeof r !== 'object' || Array.isArray(r));
}

export function load() {
  let saved = read(key);
  if (!valid(saved)) {
    const legacy = read(oldKey);
    saved = {
      columns: defaultColumns,
      rows: Array.isArray(legacy) ? legacy.filter(r => r && typeof r === 'object').map(r => ({ title: String(r.title || ''), author: String(r.author || '') })) : [],
      fields: ['title', 'author'],
    };
  }
  const fields = Array.isArray(saved.fields) && saved.fields.length === 2 ? saved.fields : ['title', 'author'];
  return { columns: saved.columns, rows: saved.rows.length ? saved.rows.map(withKey) : [emptyRow()], fields };
}

export function save({ columns, rows, fields }) {
  try {
    localStorage.setItem(key, JSON.stringify({ columns, rows: rows.map(({ _key, ...row }) => row), fields }));
    return true;
  } catch {
    return false;
  }
}
