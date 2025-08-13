'use client';
import { useEffect, useState } from 'react';

export default function Sidebar({ open, onToggle, onSelect }) {
  const [items, setItems] = useState([]);

  function refresh() {
    try {
      const all = JSON.parse(localStorage.getItem('astrotalk:history') || '[]');
      setItems(all);
    } catch {
      setItems([]);
    }
  }
  useEffect(() => {
    refresh();
  }, [open]);

  function clearAll() {
    if (!confirm('Delete all saved sessions?')) return;
    localStorage.removeItem('astrotalk:history');
    refresh();
  }

  function exportJSON() {
    const data = localStorage.getItem('astrotalk:history') || '[]';
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'astrotalk-history.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className={
        'fixed z-40 top-16 left-0 h-[80vh] w-80 transition-transform ' +
        (open ? 'translate-x-0' : '-translate-x-[calc(100%+12px)]')
      }
    >
      <div className="card h-full p-3 flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <div className="font-semibold">History</div>
          <button className="pill ml-auto" onClick={refresh}>↻ Refresh</button>
          <button className="pill" onClick={exportJSON}>⬇ Export</button>
          <button className="pill" onClick={clearAll}>🗑 Clear</button>
          <button className="pill" onClick={onToggle}>✕</button>
        </div>
        <div className="flex-1 overflow-auto space-y-2">
          {items.length === 0 && <div className="text-sm text-gray-500">No sessions yet.</div>}
          {items.map((it) => (
            <button
              key={it.id || `${it.start}-${Math.random().toString(36).slice(2)}`}
              onClick={() => onSelect?.(it)}
              className="w-full text-left p-2 rounded-xl border border-[color:var(--line)] hover:bg-gray-50"
            >
              <div className="text-sm font-medium">{new Date(it.start || Date.now()).toLocaleString()}</div>
              <div className="text-xs text-gray-500">
                {it.reason} • mode: {it.modeLast} • msgs: {it.messages?.length || 0}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
