import { useEffect, useRef, useState } from 'react';

const ratioKey = 'caption-maker-split';
const clamp = value => Math.min(0.8, Math.max(0.2, value));

function initialRatio() {
  try { return clamp(Number(localStorage.getItem(ratioKey)) || 0.55); } catch { return 0.55; }
}

// ソフトウェアキーボードが出ている間は、見えている領域（visualViewport）が画面より大きく縮む。
export function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      setOpen(window.innerHeight - viewport.height > 150);
      document.documentElement.style.setProperty('--visible-height', `${viewport.height}px`);
    };
    update();
    viewport.addEventListener('resize', update);
    return () => viewport.removeEventListener('resize', update);
  }, []);
  return open;
}

export function useWide() {
  const query = '(min-width: 900px)';
  const [wide, setWide] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setWide(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return wide;
}

// 上下（広い画面では左右）に並べる。どちらかが上に重なるのではなく、仕切りで配分を変える。
export function SplitView({ first, second, collapsed, wide }) {
  const container = useRef(null);
  const [ratio, setRatio] = useState(initialRatio);
  const change = value => {
    const next = clamp(value);
    setRatio(next);
    try { localStorage.setItem(ratioKey, String(next)); } catch {}
  };
  const drag = event => {
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const move = e => {
      const box = container.current.getBoundingClientRect();
      change(wide ? (e.clientX - box.left) / box.width : (e.clientY - box.top) / box.height);
    };
    const up = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  };

  return (
    <div ref={container} className={`flex min-h-0 flex-1 ${wide ? 'flex-row' : 'flex-col'}`}>
      <div className="min-h-0 min-w-0 overflow-auto" style={{ flex: collapsed ? '1 1 0' : `${ratio} 1 0` }}>{first}</div>
      {!collapsed && (
        <div
          role="separator"
          aria-orientation={wide ? 'vertical' : 'horizontal'}
          aria-label="入力と印刷イメージの境目"
          aria-valuenow={Math.round(ratio * 100)} aria-valuemin={20} aria-valuemax={80}
          tabIndex={0}
          onPointerDown={drag}
          onKeyDown={event => {
            const step = { ArrowUp: -0.05, ArrowLeft: -0.05, ArrowDown: 0.05, ArrowRight: 0.05 }[event.key];
            if (step) { event.preventDefault(); change(ratio + step); }
          }}
          className={`group flex shrink-0 touch-none items-center justify-center bg-kumo-recessed outline-none focus-visible:bg-kumo-tint ${wide ? 'w-3 cursor-col-resize border-x' : 'h-5 cursor-row-resize border-y'} border-kumo-line`}
        >
          <span className={`rounded-full bg-kumo-fill group-hover:bg-kumo-brand ${wide ? 'h-10 w-1' : 'h-1 w-10'}`} />
        </div>
      )}
      <div className={`min-h-0 min-w-0 bg-kumo-recessed ${collapsed ? 'h-24 shrink-0 border-t border-kumo-line' : ''}`} style={collapsed ? undefined : { flex: `${1 - ratio} 1 0` }}>{second}</div>
    </div>
  );
}
