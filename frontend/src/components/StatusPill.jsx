import React from 'react';
import { FiAlertCircle, FiCheckCircle } from 'react-icons/fi';

export default function StatusPill({ status }) {
  if (status === 'open') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-red-500/15 text-red-300 border-red-500/30 text-xs">
        <FiAlertCircle className="text-red-400" size={14} /> Open
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-xs">
      <FiCheckCircle className="text-emerald-300" size={14} /> Closed
    </span>
  );
}
