import React from "react";
import { FiX } from "react-icons/fi";

export default function Drawer({ open, onClose, title, children, width = 420 }) {
  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 transition-opacity duration-300
                    bg-black/50 backdrop-blur-sm
                    ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      />

      <aside
        data-drawer=""
        className={`fixed top-0 right-0 h-full z-50 transition-transform duration-300 shadow-xl
                    border-l border-zinc-200 dark:border-zinc-800
                    bg-white dark:bg-zinc-950 dark:text-zinc-100 text-zinc-900`}
        style={{
          width,
          transform: open ? "translateX(0)" : `translateX(${width}px)`,
        }}
      >
        <div
          className="drawer-header sticky top-0 z-10 px-5 py-3 border-b
                     bg-zinc-50/95 dark:bg-zinc-900/95
                     border-zinc-200 dark:border-zinc-800 backdrop-blur"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base">{title}</h3>
            <button
              onClick={onClose}
              className="flex items-center justify-center rounded-md px-2 py-1 text-xs
                         border text-zinc-600 hover:text-zinc-900
                         border-zinc-300 hover:bg-zinc-100
                         dark:text-zinc-300 dark:hover:text-zinc-100
                         dark:border-zinc-700 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Close"
            >
              <FiX size={14} />
            </button>
          </div>
        </div>

        <div className="p-5 h-[calc(100%-56px)] overflow-auto bg-transparent">
          {children}
        </div>
      </aside>
    </>
  );
}
