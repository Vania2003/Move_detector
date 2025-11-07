import React from "react";
import {
  FiFilter, FiBell, FiCheckCircle, FiAlertCircle,
  FiDownload, FiRefreshCw, FiXCircle
} from "react-icons/fi";
import { apiGet, apiPost } from "@/lib/api";
import usePolling from "@/hooks/usePolling";
import Pagination from "@/components/Pagination.jsx";
import Drawer from "@/components/Drawer.jsx";
import Spinner from "@/components/Spinner.jsx";
import { useToast } from "@/components/Toast.jsx";
import { timeAgo } from "@/utils/health";

/* ---- options ---- */
const TYPES = ["All", "INACTIVITY", "DWELL_CRITICAL", "NO_HEARTBEAT", "TEST_ALERT"];
const STATUSES = ["All", "open", "closed"];
const AGE_FILTERS = [
  { key: "all", label: "All time", minutes: null },
  { key: "24h", label: "Last 24h", minutes: 24*60 },
  { key: "3d",  label: "Last 3 days", minutes: 3*24*60 },
  { key: "7d",  label: "Last 7 days", minutes: 7*24*60 },
  { key: "30d", label: "Last 30 days", minutes: 30*24*60 },
];

function chip(text, tone = "zinc", key) {
  const map = {
    zinc: "bg-zinc-500/10 border-zinc-600/30 text-zinc-300",
    indigo: "bg-indigo-500/10 border-indigo-500/30 text-indigo-300",
    emerald: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    red: "bg-red-500/10 border-red-500/30 text-red-300",
    amber: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    blue: "bg-blue-500/10 border-blue-500/30 text-blue-300",
    slate: "bg-slate-500/10 border-slate-500/30 text-slate-300",
  };
  return <span key={key} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${map[tone]}`}>{text}</span>;
}

const Th = ({ children, className }) => <th className={`text-left px-3 py-2 text-zinc-400 ${className||""}`}>{children}</th>;
const Td = ({ children, mono, className }) => <td className={`px-3 py-2 ${mono?"font-mono text-xs":""} ${className||""}`}>{children}</td>;

function StatusBadge({ status }) {
  if (status === "open") return <span className="pill-open"><FiAlertCircle size={14}/> Open</span>;
  return <span className="pill-closed"><FiCheckCircle size={14}/> Closed</span>;
}

/* ----------------- domain formatting ----------------- */
function fmtLocal(iso) {
  if (!iso) return { local: "—", ago: "" };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { local: iso, ago: "" };
  return { local: d.toLocaleString(), ago: timeAgo(iso) };
}

function prettyDetails(a) {
  const parts = [];

  // стабильная «соль» для ключей (на случай отсутствия id)
  const baseKey = String(a.id ?? a.ts_utc ?? a.device_id ?? Math.random().toString(36).slice(2));

  const add = (suffix, text, tone = "zinc") => {
    const map = {
      zinc: "bg-zinc-500/10 border-zinc-600/30 text-zinc-300",
      indigo: "bg-indigo-500/10 border-indigo-500/30 text-indigo-300",
      emerald: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
      red: "bg-red-500/10 border-red-500/30 text-red-300",
      amber: "bg-amber-500/10 border-amber-500/30 text-amber-300",
      blue: "bg-blue-500/10 border-blue-500/30 text-blue-300",
      slate: "bg-slate-500/10 border-slate-500/30 text-slate-300",
    };
    parts.push(
      <span
        key={`${baseKey}-${suffix}`}
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${map[tone]}`}
      >
        {text}
      </span>
    );
  };

  // универсальный парсер длительности: "12 min" или "1800s"
  const parseDurationToMin = (str) => {
    if (!str) return null;
    const m = /([\d.]+)\s*(min|s)\b/i.exec(str);
    if (!m) return null;
    const num = parseFloat(m[1]);
    if (Number.isNaN(num)) return null;
    const unit = m[2].toLowerCase();
    return unit === "s" ? Math.round(num / 60) : Math.round(num);
  };

  if (a.type === "INACTIVITY") {
    const mins = parseDurationToMin(a.details);
    add("no-mot", `no motion${mins != null ? `: ${mins}m` : ""}`, "amber");
  } else if (a.type === "DWELL_CRITICAL") {
    const mins = parseDurationToMin(a.details);
    add("dwell", `dwell${mins != null ? `: ${mins}m` : ""}`, "red");
  } else if (a.type === "NO_HEARTBEAT") {
    const mins = parseDurationToMin(a.details);
    add("hb", `no heartbeat${mins != null ? `: ${mins}m` : ""}`, "red");
  } else if (a.type === "TEST_ALERT") {
    add("test", "test", "slate");
  }

  if (a.severity) {
    const tone = a.severity === "high" ? "red" : a.severity === "medium" ? "amber" : "zinc";
    add("sev", `sev: ${a.severity}`, tone);
  }

  if (a.device_id) add("dev", a.device_id, "slate");

  if (!parts.length && a.details) {
    parts.push(
      <span key={`${baseKey}-raw`} className="text-xs text-zinc-400">
        {a.details}
      </span>
    );
  }

  return <div className="flex flex-wrap gap-1.5">{parts}</div>;
}

export default function Alerts() {
  const [items, setItems] = React.useState([]);
  const [status, setStatus] = React.useState("All");
  const [type, setType] = React.useState("All");
  const [roomLike, setRoomLike] = React.useState("");
  const [ageKey, setAgeKey] = React.useState("7d");
  const [lastMin, setLastMin] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [live, setLive] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [selected, setSelected] = React.useState(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const toast = useToast();
  const showBulkClose = type === "NO_HEARTBEAT" && status !== "closed";

  const load = React.useCallback(async (opts = {}) => {
    setLoading(!opts.silent);
    try {
      const params = new URLSearchParams();
      if (status !== "All") params.set("status", status);
      if (type !== "All") params.set("type", type);
      if (roomLike) params.set("room", roomLike);
      if (Number(lastMin) > 0) params.set("last_minutes", lastMin);
      params.set("limit", "1000");
      const data = await apiGet(`/api/alerts?${params.toString()}`);
      setItems(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status, type, roomLike, lastMin]);

  React.useEffect(() => { load(); }, []);
  React.useEffect(() => { setPage(1); load(); }, [status, type, roomLike, lastMin, load]);
  usePolling(() => live && load({ silent: true }), 10000);

  const ack = async (id) => {
    try {
      await apiPost(`/api/alerts/${id}/ack`, { by: "web" });
      // «нормальный ACK»: после ack блокируем кнопку (признак — ack_at != null),
      // перезагружаем список молча
      load({ silent: true });
    } catch {
      toast.push("err", "Ack failed");
    }
  };
  const close = async (id) => {
    try {
      await apiPost(`/api/alerts/${id}/close`);
      load({ silent: true });
    } catch {
      toast.push("err", "Close failed");
    }
  };
  const bulkClose = async () => {
    try {
      await apiPost(`/api/alerts/close-bulk?status=open&older_than_minutes=30&type=NO_HEARTBEAT`);
      toast.push("ok", "Bulk NO_HEARTBEAT closed");
      load();
    } catch {
      toast.push("err", "Bulk close failed");
    }
  };
  const purgeNow = async () => {
    // ожидаемый серверный эндпоинт (не обязательный; если 404 — просто проигнорим)
    try {
      await apiPost(`/api/alerts/purge?older_than_days=7`);
      toast.push("ok", "Purged alerts older than 7 days");
      load({ silent: true });
    } catch {
      toast.push("err", "Purge endpoint not available");
    }
  };

  // клиентский фильтр по возрасту
  const ageMinutes = AGE_FILTERS.find(f => f.key === ageKey)?.minutes ?? null;
  const now = Date.now();
  const filtered = items.filter(a => {
    if (!ageMinutes) return true;
    if (!a.ts_utc) return true;
    const ts = new Date(a.ts_utc).getTime();
    return !isNaN(ts) ? (now - ts) <= ageMinutes * 60 * 1000 : true;
  });

  const start = (page - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);
  const showTableLoading = loading && items.length === 0;

  const summary = {
    open: filtered.filter(a => a.status === "open").length,
    INACTIVITY: filtered.filter(a => a.type === "INACTIVITY").length,
    DWELL_CRITICAL: filtered.filter(a => a.type === "DWELL_CRITICAL").length,
    NO_HEARTBEAT: filtered.filter(a => a.type === "NO_HEARTBEAT").length
  };

  function toCSV(rows){
    if(!rows?.length) return "";
    const pick = r => ({
      id: r.id,
      time: r.ts_utc,
      room: r.room,
      device: r.device_id,
      type: r.type,
      severity: r.severity,
      status: r.status,
      details: r.details,
      ack_at: r.ack_at,
      ack_by: r.ack_by
    });
    const data = rows.map(pick);
    const cols = Object.keys(data[0]);
    const esc = v => `"${String(v??"").replaceAll('"','""')}"`;
    return [cols.join(","), ...data.map(r => cols.map(c=>esc(r[c])).join(","))].join("\n");
  }
  function download(name, text){
    const blob = new Blob([text], { type:"text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=name; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* header + summary */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold flex items-center gap-2"><FiBell className="text-red-400"/> Alerts</h1>
        <div className="flex flex-wrap gap-2 text-sm text-zinc-700 dark:text-zinc-300 font-medium">
          <span>Open: <b>{summary.open}</b> / Total: <b>{filtered.length}</b></span>
          <span>INACTIVITY: <b>{summary.INACTIVITY}</b></span>
          <span>DWELL_CRITICAL: <b>{summary.DWELL_CRITICAL}</b></span>
          <span>NO_HEARTBEAT: <b>{summary.NO_HEARTBEAT}</b></span>
        </div>
      </div>

      {/* filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <Filter label="Status" value={status} setValue={setStatus} options={STATUSES} icon={FiFilter}/>
        <Filter label="Type" value={type} setValue={setType} options={TYPES} icon={FiFilter}/>
        <Input label="Room contains" value={roomLike} setValue={setRoomLike}/>
        {/* Клиентская авто-очистка из UI: просто скрываем старое */}
        <label className="text-sm text-zinc-700 dark:text-zinc-300 flex flex-col gap-1 min-w-[140px]">
          <span className="text-zinc-400">Hide older than</span>
          <select
            className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md px-3 py-2 text-neutral-900 dark:text-zinc-100"
            value={ageKey} onChange={e => { setAgeKey(e.target.value); setPage(1); }}>
            {AGE_FILTERS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </label>

        <label className="text-sm flex items-center gap-2 ml-2">
          <input type="checkbox" checked={live} onChange={e=>setLive(e.target.checked)}/>
          <span className="text-zinc-400">Live</span>
        </label>

        <button onClick={() => { setRefreshing(true); load(); }} className="ghost-btn">
          { refreshing ? <Spinner size={16}/> : <FiRefreshCw size={16}/> } Refresh
        </button>
        <button onClick={()=>download(`alerts_${Date.now()}.csv`, toCSV(filtered))} className="ghost-btn">
          <FiDownload/> Export CSV
        </button>
        {showBulkClose && (
          <button onClick={bulkClose}
            className="ghost-btn border-red-400 text-red-300 hover:bg-red-900/10">
            <FiXCircle/> Close stale NO_HEARTBEAT
          </button>
        )}
        {/* ручная серверная очистка >7d (если доступен эндпоинт) */}
        <button onClick={purgeNow} className="ghost-btn">
          <FiXCircle/> Purge closed 
        </button>
      </div>

      {/* table */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-x-auto bg-white dark:bg-zinc-950 shadow">
        <table className="min-w-[980px] w-full text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900/60">
            <tr>
              <Th>time</Th>
              <Th>room</Th>
              <Th>type</Th>
              <Th>status</Th>
              <Th>details</Th>
              <Th className="text-center">actions</Th>
            </tr>
          </thead>
          <tbody>
            {showTableLoading ? (
              <tr><td className="p-4 text-zinc-400" colSpan={6}><Spinner /> Loading…</td></tr>
            ) : pageRows.length === 0 ? (
              <tr><td className="p-4 text-zinc-400" colSpan={6}>No alerts found</td></tr>
            ) : (
              pageRows.map(a => {
                const t = fmtLocal(a.ts_utc);
                return (
                  <tr key={a.id}
                      onClick={() => setSelected(a)}
                      className="border-t border-zinc-100 dark:border-zinc-900/80 hover:bg-zinc-900/30 cursor-pointer"
                      title="Click to view details">
                    <Td>
                      <div className="flex flex-col">
                        <span className="font-mono">{t.local}</span>
                        <span className="text-xs text-zinc-500">{t.ago}</span>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        {a.room ? chip(a.room, "indigo") : <span className="text-zinc-500">—</span>}
                        {a.device_id && chip(a.device_id, "slate")}
                      </div>
                    </Td>
                    <Td>{chip(a.type, a.type === "NO_HEARTBEAT" ? "red" : a.type === "INACTIVITY" ? "amber" : "zinc")}</Td>
                    <Td><StatusBadge status={a.status}/></Td>
                    <Td>{prettyDetails(a)}</Td>
                    <Td className="text-center" onClick={e => e.stopPropagation()}>
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => ack(a.id)}
                          disabled={a.status !== "open" || !!a.ack_at}
                          className="alert-btn alert-btn-ack"
                          title={a.ack_at ? `Acked at ${a.ack_at}` : "Ack"}>
                          Ack
                        </button>
                        <button
                          onClick={() => close(a.id)}
                          disabled={a.status === "closed"}
                          className="alert-btn alert-btn-close">
                          Close
                        </button>
                      </div>
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="pt-2">
        <Pagination page={page} pageSize={pageSize} total={filtered.length} setPage={setPage}/>
      </div>

      {/* Drawer (по клику на строку) */}
      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected ? `Alert #${selected.id}` : "Alert"}>
        {selected && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <StatusBadge status={selected.status}/>
              <span className="text-xs text-zinc-400">{selected.type}</span>
            </div>

            <dl className="grid grid-cols-2 gap-2 text-sm">
              <Detail label="Time" value={`${fmtLocal(selected.ts_utc).local}  (${timeAgo(selected.ts_utc)})`}/>
              <Detail label="Room" value={selected.room}/>
              <Detail label="Device" value={selected.device_id}/>
              <Detail label="Severity" value={selected.severity}/>
              <div className="detail-card col-span-2">
                <div className="label">Details</div>
                <div className="value">{prettyDetails(selected)}</div>
              </div>
              <Detail label="Created" value={selected.created_at}/>
              <Detail label="Notified" value={selected.notified_at}/>
              <Detail label="Closed" value={selected.closed_at}/>
              <Detail label="Ack at" value={selected.ack_at}/>
              <Detail label="Ack by" value={selected.ack_by}/>
            </dl>

            <div>
              <div className="text-xs text-zinc-400 mb-1">Raw JSON</div>
              <pre className="text-xs border border-zinc-800 rounded-md p-2 overflow-auto bg-black/40">
                {JSON.stringify(selected, null, 2)}
              </pre>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={()=>ack(selected.id)} disabled={selected.status!=="open" || !!selected.ack_at}
                className="rounded-md px-3 py-2 text-sm border border-amber-400 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/20">
                Ack
              </button>
              <button onClick={()=>close(selected.id)} disabled={selected.status==="closed"}
                className="rounded-md px-3 py-2 text-sm border border-red-700 text-red-500 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/20">
                Close
              </button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

/* ----------------- small controls ----------------- */
function Filter({ label, value, setValue, options, icon: Icon }) {
  return (
    <label className="text-sm text-zinc-700 dark:text-zinc-300 flex flex-col gap-1 min-w-[100px]">
      <span className="text-zinc-400 flex items-center gap-1">{Icon && <Icon size={14}/>} {label}</span>
      <select
        className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md px-3 py-2 text-neutral-900 dark:text-zinc-100"
        value={value} onChange={e => setValue(e.target.value)}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
function Input({ label, value, setValue, ...rest }) {
  return (
    <label className="text-sm text-zinc-700 dark:text-zinc-300 flex flex-col gap-1 min-w-[120px]">
      <span className="text-zinc-400">{label}</span>
      <input
        className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md px-3 py-2 text-neutral-900 dark:text-zinc-100"
        value={value} onChange={e => setValue(e.target.value)} {...rest}/>
    </label>
  );
}
function Detail({ label, value }) {
  return (
    <div className="detail-card">
      <div className="label">{label}</div>
      <div className="value">{value ?? "—"}</div>
    </div>
  );
}
