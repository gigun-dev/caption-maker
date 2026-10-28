import { EditorState, RangeSet, StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, GutterMarker, gutterLineClass, lineNumbers, placeholder } from '@codemirror/view';

const setDiagnostics = StateEffect.define();
const setWhitespace = StateEffect.define();
const halfSpace = Decoration.mark({ class: 'cm-space-half', attributes: { title: '半角スペース' } });
const fullSpace = Decoration.mark({ class: 'cm-space-full', attributes: { title: '全角スペース' } });
const tab = Decoration.mark({ class: 'cm-space-tab', attributes: { title: 'タブ' } });
const badNumber = new class extends GutterMarker { constructor() { super(); this.elementClass = 'cm-problem-number'; } }();

function decorations(state, showWhitespace) {
  const ranges = [];
  for (let n = 1; n <= state.doc.lines; n++) {
    const line = state.doc.line(n);
    if (!showWhitespace) continue;
    for (const match of line.text.matchAll(/[ \u3000\t]/g)) {
      const deco = match[0] === ' ' ? halfSpace : match[0] === '　' ? fullSpace : tab;
      ranges.push(deco.range(line.from + match.index, line.from + match.index + 1));
    }
  }
  return Decoration.set(ranges, true);
}

function gutterMarkers(state, lines) {
  const markers = [...lines].filter(n => n >= 1 && n <= state.doc.lines).sort((a,b) => a-b).map(n => badNumber.range(state.doc.line(n).from));
  return RangeSet.of(markers, true);
}
const diagnosticState = StateField.define({
  create(state) { return { lines: new Set(), visible: true, decorations: decorations(state, true), gutters: gutterMarkers(state, new Set()) }; },
  update(previous, transaction) {
    if (!transaction.docChanged && !transaction.effects.some(effect => effect.is(setDiagnostics) || effect.is(setWhitespace))) return previous;
    let lines = previous.lines, visible = previous.visible;
    for (const effect of transaction.effects) {
      if (effect.is(setDiagnostics)) lines = new Set(effect.value);
      if (effect.is(setWhitespace)) visible = effect.value;
    }
    return { lines, visible, decorations: decorations(transaction.state, visible), gutters: gutterMarkers(transaction.state, lines) };
  },
  provide: field => [EditorView.decorations.from(field, value => value.decorations), gutterLineClass.from(field, value => value.gutters)],
});

export function createPasteEditor(parent, onChange) {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: '',
      extensions: [
        diagnosticState,
        lineNumbers(),
        placeholder('例：海の記憶, 山田 花子'),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ 'aria-label': '貼り付け・入力', 'aria-multiline': 'true', 'aria-describedby': 'paste-warning', role: 'textbox' }),
        EditorView.updateListener.of(update => { if (update.docChanged) queueMicrotask(onChange); }),
      ],
    }),
  });
  return {
    text: () => view.state.doc.toString(),
    replace: text => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } }),
    setProblems: lines => view.dispatch({ effects: setDiagnostics.of(lines) }),
    setWhitespace: enabled => view.dispatch({ effects: setWhitespace.of(enabled) }),
    focusRecord: line => { const target = view.state.doc.line(Math.max(1, Math.min(line, view.state.doc.lines))); view.dispatch({ selection: { anchor: target.from }, effects: EditorView.scrollIntoView(target.from, { y: 'center' }) }); view.focus(); },
    focus: () => view.focus(),
  };
}
