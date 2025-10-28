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
  <div className="flex items-center justify-end gap-2 text-sm select-none">
    {/* Prev */}
    <button
      onClick={() => go(page - 1)}
      disabled={page === 1}
      className={`pagination-btn ${page === 1 ? 'disabled' : ''}`}
    >
      Prev
    </button>

    {/* Pages */}
    {seq.map((x, i) =>
      x === '…' ? (
        <span key={`gap-${i}`} className="px-1 text-zinc-400">
          …
        </span>
      ) : (
        <button
          key={x}
          onClick={() => go(x)}
          className={`pagination-btn ${x === page ? 'active' : ''}`}
        >
          {x}
        </button>
      )
    )}

    <button
      onClick={() => go(page + 1)}
      disabled={page === pages}
      className={`pagination-btn ${page === pages ? 'disabled' : ''}`}
    >
      Next
    </button>
  </div>
);

}
