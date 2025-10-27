import React from 'react';
import { FiX } from 'react-icons/fi';

export default function Drawer({ open, onClose, title, children, width = 420 }) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/50 transition-opacity z-40 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      />
      {/* Panel */}
      <aside
        className={`fixed top-0 right-0 h-full z-50 border-l border-zinc-800 bg-zinc-950 shadow-2xl transition-transform`}
        style={{
          width,
          transform: open ? 'translateX(0)' : `translateX(${width}px)`,
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h3 className="font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 border border-zinc-700/60 rounded-md px-2 py-1 text-xs"
            aria-label="Close"
          >
            <FiX size={14} />
          </button>
        </div>
        <div className="p-4 overflow-auto h-[calc(100%-52px)]">{children}</div>
      </aside>
    </>
  );
}
