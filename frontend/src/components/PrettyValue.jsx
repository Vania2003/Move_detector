import React from "react";
import { FiExternalLink, FiClock, FiCopy } from "react-icons/fi";

function isUrl(v) {
  if (typeof v !== "string") return false;
  return /^https?:\/\/|^mailto:|^tel:/.test(v);
}
function isIsoTs(v) {
  if (typeof v !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(v);
}
function timeAgo(ts) {
  try {
    const d = new Date(ts.replace(" ", "T"));
    const diff = (Date.now() - d.getTime()) / 1000;
    if (!isFinite(diff)) return ts;
    const abs = Math.abs(diff);
    const unit = abs < 60 ? ["sec", 1] :
                 abs < 3600 ? ["min", 60] :
                 abs < 86400 ? ["h", 3600] : ["d", 86400];
    const n = Math.floor(abs / unit[1]);
    return (diff >= 0 ? `${n} ${unit[0]} ago` : `in ${n} ${unit[0]}`);
  } catch { return ts; }
}
function CopyBtn({text}) {
  const [ok,setOk] = React.useState(false);
  return (
    <button
      onClick={async (e)=>{ e.stopPropagation(); try{ await navigator.clipboard.writeText(text); setOk(true); setTimeout(()=>setOk(false),900);}catch{} }}
      className="ml-1 inline-flex items-center rounded px-1.5 py-0.5 text-[10px]
                 border border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400
                 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      title="Copy"
    >{ok ? "✓" : <FiCopy size={10}/>}</button>
  );
}

export default function PrettyValue({ value, mono=false, maxLen=120 }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-zinc-400">—</span>;
  }
  if (typeof value === "boolean") {
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border
                        ${value
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-600/40"
                          : "bg-zinc-500/10 text-zinc-300 border-zinc-600/40"}`}>
        {value ? "true" : "false"}
      </span>
    );
  }
  if (typeof value === "number") {
    return <span className="font-mono text-xs">{value}</span>;
  }
  if (isUrl(value)) {
    const label = value.length > maxLen ? value.slice(0, maxLen-1) + "…" : value;
    return (
      <a href={value} target="_blank" rel="noreferrer"
         className="inline-flex items-center gap-1 text-indigo-500 hover:underline">
        {label} <FiExternalLink/>
      </a>
    );
  }
  if (isIsoTs(value)) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="font-mono text-xs">{value}</span>
        <span className="text-zinc-400 inline-flex items-center gap-1 text-[11px]">
          <FiClock/>{timeAgo(value)}
        </span>
      </span>
    );
  }
  if (typeof value === "object") {
    let text = JSON.stringify(value, null, 2);
    const short = text.length > maxLen ? text.slice(0, maxLen-1) + "…" : text;
    return (
      <span className={`inline-flex items-start ${mono ? "font-mono text-xs":""}`}>
        <code className="text-xs whitespace-pre-wrap">{short}</code>
        <CopyBtn text={text}/>
      </span>
    );
  }
  const s = String(value);
  const out = s.length > maxLen ? s.slice(0, maxLen-1) + "…" : s;
  return <span className={mono ? "font-mono text-xs" : ""}>{out}</span>;
}
