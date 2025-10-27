import React from 'react';

// универсальная KPI карточка с поддержкой иконок и hint
export default function KpiCard({ title, value, icon: Icon, hint, color = 'indigo' }) {
  return (
    <div className={`rounded-2xl border border-${color}-800 p-5 flex flex-col gap-1 bg-${color}-950/50 shadow-lg`}>
      <div className={`flex items-center gap-2 text-xs text-${color}-300 font-medium`}>
        {Icon && <Icon size={22} className={`text-${color}-400`} />} {title}
      </div>
      <div className="mt-2 text-3xl font-bold tracking-tight text-zinc-100">{value}</div>
      {hint && <div className="text-xs text-zinc-400 mt-1">{hint}</div>}
    </div>
  );
}