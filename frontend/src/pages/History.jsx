import React from "react";
import { FiHeart, FiMessageSquare, FiDownload } from "react-icons/fi";
import { apiGet } from "@/lib/api";
import Spinner from "@/components/Spinner.jsx";
import { timeAgo } from "@/utils/health";

/** ——— вкладки: оставили только Raw MQTT и Heartbeats ——— */
const TABS = [
  { key: "raw", label: "Raw MQTT", icon: FiMessageSquare, endpoint: "/api/messages?limit=1000" },
  { key: "hb",  label: "Heartbeats", icon: FiHeart,        endpoint: "/api/heartbeats?limit=1000" }
];

/** ——— мелкие UI-хелперы ——— */
const Th = ({ children, className }) => (
  <th className={`text-left px-3 py-2 text-zinc-400 ${className || ""}`}>{children}</th>
);
const Td = ({ children, mono, className }) => (
  <td className={`px-3 py-2 ${mono ? "font-mono text-xs" : ""} ${className || ""}`}>{children}</td>
);
function Chip({ tone="zinc", children }) {
  const map = {
    zinc: "bg-zinc-500/10 border-zinc-600/30 text-zinc-300",
    indigo: "bg-indigo-500/10 border-indigo-500/30 text-indigo-300",
    emerald: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    red: "bg-red-500/10 border-red-500/30 text-red-300",
    slate: "bg-slate-500/10 border-slate-500/30 text-slate-300",
    amber: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    blue: "bg-blue-500/10 border-blue-500/30 text-blue-300",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${map[tone]}`}>
      {children}
    </span>
  );
}
function fmtLocal(iso) {
  if (!iso) return { local: "—", ago: "" };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { local: iso, ago: "" };
  return { local: d.toLocaleString(), ago: timeAgo(iso) };
}

/** ——— парсинг полезного из payload ——— */
function parsePayload(payload) {
  try {
    const obj = typeof payload === "string" ? JSON.parse(payload) : payload;
    if (!obj || typeof obj !== "object") return { summary: String(payload ?? ""), chips: [] };

    const chips = [];
    if (obj.motion === true) chips.push({ text: "motion: true", tone: "emerald" });
    if (obj.motion === false) chips.push({ text: "motion: false", tone: "slate" });
    if (obj.room)    chips.push({ text: obj.room, tone: "indigo" });
    if (obj.device)  chips.push({ text: obj.device, tone: "slate" });
    if (obj.uptime_ms) chips.push({ text: `up: ${Math.floor(obj.uptime_ms/1000)}s`, tone: "amber" });
    if (obj.rssi)    chips.push({ text: `rssi: ${obj.rssi}`, tone: "blue" });

    // компактная сводка: возьмём самые важные поля
    const keyVals = [];
    if ("motion" in obj) keyVals.push(`motion=${obj.motion}`);
    if (obj.room)        keyVals.push(`room=${obj.room}`);
    if (obj.device)      keyVals.push(`dev=${obj.device}`);
    const summary = keyVals.length ? keyVals.join(" · ") : JSON.stringify(obj);

    return { summary, chips };
  } catch {
    return { summary: String(payload ?? ""), chips: [] };
  }
}

/** ——— основная страница ——— */
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
      <h1 className="text-xl font-bold flex items-center gap-2"><FiMessageSquare className="text-indigo-400"/> History</h1>

      {/* табы со стилем, как раньше */}
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

      {/* «вкусная» таблица: скругления, ховеры, зебра, липкая шапка */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-950 shadow">
        {loading
          ? <div className="p-8 flex justify-center"><Spinner size={32}/></div>
          : data.length === 0
            ? <div className="p-8 text-zinc-400">Nothing here.</div>
            : (tab === "raw" ? <RawTable rows={data}/> : <HbTable rows={data}/>)
        }
      </div>
    </div>
  );
}

/** ——— RAW MQTT: time, room/device (если есть), payload компактно ——— */
function RawTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[720px] w-full text-sm">
        <thead className="bg-zinc-100 dark:bg-zinc-900/60 sticky top-0 z-10">
          <tr>
            <Th className="w-[240px]">time</Th>
            <Th className="w-[220px]">context</Th>
            <Th>payload</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const t = fmtLocal(r.ts_utc || r.ts || r.time);
            const { summary, chips } = parsePayload(r.payload);
            // из topic попытаемся вытащить room/device, если есть привычные паттерны
            let topicRoom = null, topicDev = null;
            if (r.topic) {
              const mRoom = /\/room\/([^/]+)/i.exec(r.topic);
              const mDev  = /\/device\/([^/]+)/i.exec(r.topic);
              if (mRoom) topicRoom = mRoom[1];
              if (mDev) topicDev = mDev[1];
            }
            return (
              <tr key={i} className={`border-t border-zinc-100 dark:border-zinc-900/80 ${i%2 ? "bg-zinc-50/30 dark:bg-zinc-900/20" : ""}`}>
                <Td>
                  <div className="flex flex-col">
                    <span className="font-mono">{t.local}</span>
                    <span className="text-xs text-zinc-500">{t.ago}</span>
                  </div>
                </Td>
                <Td>
                  <div className="flex gap-2 flex-wrap">
                    {topicRoom && <Chip tone="indigo">{topicRoom}</Chip>}
                    {topicDev &&  <Chip tone="slate">{topicDev}</Chip>}
                    {/* если в payload тоже есть room/device — добавим, но не дублируем */}
                    {chips
                      .filter(c => !(topicRoom && c.text === topicRoom) && !(topicDev && c.text === topicDev))
                      .map((c, idx) => <Chip key={idx} tone={c.tone}>{c.text}</Chip>)}
                  </div>
                </Td>
                <Td className="max-w-[560px]">
                  <div className="truncate" title={typeof r.payload === "string" ? r.payload : JSON.stringify(r.payload)}>
                    {summary}
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** ——— HEARTBEATS: time, device, uptime/rssi, misc ——— */
function HbTable({ rows }) {
  // попытаемся нормализовать частые поля: ts_utc, device_id, uptime_ms, rssi, voltage, fw
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[680px] w-full text-sm">
        <thead className="bg-zinc-100 dark:bg-zinc-900/60 sticky top-0 z-10">
          <tr>
            <Th className="w-[240px]">time</Th>
            <Th className="w-[220px]">device</Th>
            <Th>stats</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const t = fmtLocal(r.ts_utc || r.ts || r.time);
            const dev = r.device_id || r.device || r.dev || "—";
            const statsChips = [];
            if (r.uptime_ms) statsChips.push(<Chip key="up" tone="amber">up: {Math.floor(r.uptime_ms/1000)}s</Chip>);
            if (r.rssi)      statsChips.push(<Chip key="rssi" tone="blue">rssi: {r.rssi}</Chip>);
            if (r.voltage)   statsChips.push(<Chip key="v" tone="zinc">V: {r.voltage}V</Chip>);
            if (r.fw)        statsChips.push(<Chip key="fw" tone="slate">fw: {r.fw}</Chip>);
            return (
              <tr key={i} className={`border-t border-zinc-100 dark:border-zinc-900/80 ${i%2 ? "bg-zinc-50/30 dark:bg-zinc-900/20" : ""}`}>
                <Td>
                  <div className="flex flex-col">
                    <span className="font-mono">{t.local}</span>
                    <span className="text-xs text-zinc-500">{t.ago}</span>
                  </div>
                </Td>
                <Td mono>{dev}</Td>
                <Td>
                  <div className="flex gap-2 flex-wrap">
                    {statsChips.length ? statsChips : <span className="text-zinc-500">—</span>}
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
