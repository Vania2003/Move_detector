import React from "react";
import { FiActivity, FiHeart, FiMessageSquare, FiDownload } from "react-icons/fi";
import { apiGet } from "@/lib/api";
import Spinner from "@/components/Spinner.jsx";

const TABS = [
  { key: "raw", label: "Raw MQTT", icon: FiMessageSquare, endpoint: "/api/messages?limit=1000" },
  { key: "motion", label: "Motion events", icon: FiActivity, endpoint: "/api/motion_events?limit=1000" },
  { key: "hb", label: "Heartbeats", icon: FiHeart, endpoint: "/api/heartbeats?limit=1000" }
];

export default function History() {
  const [tab, setTab] = React.useState("raw");
  const [data, setData] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  const current = TABS.find(t => t.key === tab);

  React.useEffect(() => {
    let canceled = false;
    setLoading(true);
    apiGet(current.endpoint)
      .then(d => { if (!canceled) setData(d); })
      .finally(() => { if (!canceled) setLoading(false); });
    return () => { canceled = true; };
  }, [tab, current.endpoint]);

  function downloadCSV() {
    if (!data.length) return;
    const cols = Object.keys(data[0]);
    const esc = v => `"${String(v ?? "").replaceAll('"','""')}"`;
    const text = [cols.join(","), ...data.map(r => cols.map(c => esc(r[c])).join(","))].join("\n");
    const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${tab}_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-7">
      <h1 className="text-xl font-bold flex items-center gap-2"><FiActivity className="text-indigo-400"/> History</h1>
      <div className="flex gap-2 mb-2 border-b border-zinc-200 dark:border-zinc-700">
        {TABS.map(t =>
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 font-medium flex items-center gap-2 transition border-b-2
              ${tab === t.key
                ? "border-indigo-500 text-indigo-700 dark:text-indigo-300"
                : "border-transparent text-zinc-500 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-200"}`}>
            <t.icon size={16}/> {t.label}
          </button>
        )}
      </div>
      <div className="flex gap-2 items-center">
        <button
          onClick={downloadCSV}
          disabled={!data.length}
          className={`ghost-btn ${!data.length ? 'opacity-50 cursor-not-allowed' : ''}`}>
          <FiDownload/> Export CSV
        </button>
        <span className="text-xs text-zinc-400">{data.length} records</span>
      </div>
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-x-auto bg-white dark:bg-zinc-950 shadow">
        {loading
          ? <div className="p-8 flex justify-center"><Spinner size={32}/></div>
          : data.length === 0
              ? <div className="p-8 text-zinc-400">Nothing here.</div>
              : <HistoryTable tab={tab} data={data}/>}
      </div>
    </div>
  );
}

function HistoryTable({ tab, data }) {
  // Оптимизирован для больших последовательных таблиц, колонки auto
  if (!data.length) return null;
  const cols = Object.keys(data[0]);
  return (
    <table className="min-w-[600px] w-full text-sm">
      <thead className="bg-zinc-100 dark:bg-zinc-900/60">
        <tr>{cols.map(c => <th key={c} className="px-3 py-2 text-zinc-400">{c}</th>)}</tr>
      </thead>
      <tbody>
        {data.map((row, i) =>
          <tr key={i} className="border-t border-zinc-100 dark:border-zinc-900/80">
            {cols.map(c =>
              <td key={c} className={`px-3 py-2 font-mono ${typeof row[c] === "number" ? "text-xs" : ""}`}>
                {typeof row[c] === "object" ? JSON.stringify(row[c]) : row[c]}
              </td>
            )}
          </tr>
        )}
      </tbody>
    </table>
  );
}
