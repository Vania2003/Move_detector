import React from 'react';

export default function Pagination({ page, pageSize, total, setPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const go = (p) => setPage(Math.max(1, Math.min(pages, p)));

  const around = [...new Set([1, page - 1, page, page + 1, pages].filter(p => p >= 1 && p <= pages))];
  const seq = [];
  around.forEach((p, i) => {
    if (i && p - around[i - 1] > 1) seq.push('…');
    seq.push(p);
  });

  return (
    <div className="flex items-center justify-end gap-2 text-sm">
      <button onClick={() => go(page - 1)} disabled={page === 1}
        className={`px-2 py-1 rounded-md border ${page === 1 ? 'border-zinc-700/40 text-zinc-500 cursor-not-allowed' : 'border-zinc-700/60 hover:bg-zinc-900'}`}>
        Prev
      </button>
      {seq.map((x, i) =>
        x === '…' ? (
          <span key={`gap-${i}`} className="px-1 text-zinc-500">…</span>
        ) : (
          <button key={x} onClick={() => go(x)}
            className={`px-2 py-1 rounded-md border ${x === page ? 'border-zinc-600 bg-zinc-900' : 'border-zinc-700/60 hover:bg-zinc-900'}`}>
            {x}
          </button>
        )
      )}
      <button onClick={() => go(page + 1)} disabled={page === pages}
        className={`px-2 py-1 rounded-md border ${page === pages ? 'border-zinc-700/40 text-zinc-500 cursor-not-allowed' : 'border-zinc-700/60 hover:bg-zinc-900'}`}>
        Next
      </button>
    </div>
  );
}
