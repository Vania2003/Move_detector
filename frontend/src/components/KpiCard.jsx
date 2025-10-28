import React from "react";

export default function KpiCard({ icon: Icon, label, value, color = "indigo", hint, children }) {
  const bgColor = `bg-${color}-50 dark:bg-${color}-950`;
  const borderColor = `border-${color}-200 dark:border-${color}-800`;
  const textColor = `text-${color}-800 dark:text-${color}-200`;
  return (
    <div className={`card flex flex-col gap-1 items-start justify-between min-w-[140px] w-full ${bgColor} ${borderColor} ${textColor}`}>
      <div className="flex items-center gap-2 text-xs font-semibold">
        {Icon && <Icon size={20} className={`text-${color}-400`} />}
        {label}
      </div>
      <div className="mt-1 text-3xl font-extrabold">{value}</div>
      {hint && <div className="mt-1 text-xs text-zinc-400">{hint}</div>}
      {children && <div className="w-full mt-2">{children}</div>}
    </div>
  );
}
