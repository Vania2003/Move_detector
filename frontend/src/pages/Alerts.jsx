// src/pages/Alerts.jsx
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

const TYPES = ["All", "INACTIVITY", "DWELL_CRITICAL", "NO_HEARTBEAT", "TEST_ALERT"];
const STATUSES = ["All", "open", "closed"];

/* ----------------- small UI helpers ----------------- */
function chip(text, tone = "zinc") {
  const map =
    {
      zinc: "bg-zinc-500/10 border-zinc-600/30 text-zinc-300",
      indigo: "bg-indigo-500/10 border-indigo-500/30 text-indigo-300",
      emerald: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
      red: "bg-red-500/10 border-red-500/30 text-red-300",
      amber: "bg-amber-500/10 border-amber-500/30 text-amber-300",
      blue: "bg-blue-500/10 border-blue-500/30 text-blue-300",
      slate: "bg-slate-500/10 border-slate-500/30 text-slate-300",
    };
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${map[tone]}`}>{text}</span>;
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
  // a: alert row (id, type, details, severity, room, device_id, ...)
  const parts = [];

  if (a.type === "INACTIVITY") {
    // ожидаем строку типа "No motion for 327.3 min"
    const m = /No motion for ([\d.]+)\s*min/i.exec(a.details || "");
    if (m) {
      parts.push(chip(`no motion: ${Math.round(parseFloat(m[1]))}m`, "amber"));
    } else {
      parts.push(chip("no motion", "amber"));
    }
  } else if (a.type === "DWELL_CRITICAL") {
    // возможный текст: "Dwell in <room> for X min"
    const m = /(\d+(\.\d+)?)\s*min/i.exec(a.details || "");
    if (m) parts.push(chip(`dwell: ${Math.round(parseFloat(m[1]))}m`, "red"));
    else parts.push(chip("dwell", "red"));
  } else if (a.type === "NO_HEARTBEAT") {
    const m = /(\d+(\.\d+)?)\s*min/i.exec(a.details || "");
    if (m) parts.push(chip(`no heartbeat: ${Math.round(parseFloat(m[1]))}m`, "red"));
    else parts.push(chip("no heartbeat", "red"));
  } else if (a.type === "TEST_ALERT") {
    parts.push(chip("test", "slate"));
  }

  if (a.severity) {
    const tone = a.severity === "high" ? "red" : a.severity === "medium" ? "amber" : "zinc";
    parts.push(chip(`sev: ${a.severity}`, tone));
  }

  // device и любые короткие остатки
  if (a.device_id) parts.push(chip(a.device_id, "slate"));

  // если ничего не получилось распарсить — покажем сырую строку, но мягко
  if (!parts.length && a.details) parts.push(
    <span key="raw" className="text-xs text-zinc-400">{a.details}</span>
  );

  return <div className="flex flex-wrap gap-1.5">{parts}</div>;
}

/* ===================================================== */
export default function Alerts() {
  const [items, setItems] = React.useState([]);
  const [status, setStatus] = React.useState("All");
  const [type, setType] = React.useState("All");
  const [roomLike, setRoomLike] = React.useState("");
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

  const start = (page - 1) * pageSize;
  const pageRows = items.slice(start, start + pageSize);
  const showTableLoading = loading && items.length === 0;

  const summary = {
    open: items.filter(a => a.status === "open").length,
    INACTIVITY: items.filter(a => a.type === "INACTIVITY").length,
    DWELL_CRITICAL: items.filter(a => a.type === "DWELL_CRITICAL").length,
    NO_HEARTBEAT: items.filter(a => a.type === "NO_HEARTBEAT").length
  };

  function toCSV(rows){
    if(!rows?.length) return "";
    // экспортируем только полезные колонки
    const pick = r => ({
      id: r.id,
      time: r.ts_utc,
      room: r.room,
      device: r.device_id,
      type: r.type,
      severity: r.severity,
      status: r.status,
      details: r.details,
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
          <span>Open: <b>{summary.open}</b> / Total: <b>{items.length}</b></span>
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
        <Input label="Last minutes" type="number" value={lastMin} setValue={setLastMin} min={0}/>
        <label className="text-sm flex items-center gap-2 ml-2">
          <input type="checkbox" checked={live} onChange={e=>setLive(e.target.checked)}/>
          <span className="text-zinc-400">Live</span>
        </label>
        <button onClick={() => { setRefreshing(true); load(); }} className="ghost-btn">
          { refreshing ? <Spinner size={16}/> : <FiRefreshCw size={16}/> } Refresh
        </button>
        <button onClick={()=>download(`alerts_${Date.now()}.csv`, toCSV(items))} className="ghost-btn">
          <FiDownload/> Export CSV
        </button>
        {showBulkClose && (
          <button onClick={bulkClose}
            className="ghost-btn border-red-400 text-red-300 hover:bg-red-900/10">
            <FiXCircle/> Close stale NO_HEARTBEAT
          </button>
        )}
      </div>

      {/* table */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-x-auto bg-white dark:bg-zinc-950 shadow">
        <table className="min-w-[980px] w-full text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900/60">
            <tr>
              {/* убрали ID и отдельную колонку Ago — время показываем красиво в одной ячейке */}
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
                      <div className="inline-flex gap-2 justify-center">
                        <button onClick={() => ack(a.id)} disabled={a.status !== "open"} className="alert-btn alert-btn-ack">Ack</button>
                        <button onClick={() => close(a.id)} disabled={a.status === "closed"} className="alert-btn alert-btn-close">Close</button>
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
        <Pagination page={page} pageSize={pageSize} total={items.length} setPage={setPage}/>
      </div>

      {/* Drawer */}
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
              <button onClick={()=>ack(selected.id)} disabled={selected.status!=="open"}
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
