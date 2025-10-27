import React from "react";
import { FiFilter, FiBell, FiCheckCircle, FiAlertCircle, FiDownload, FiRefreshCw, FiXCircle } from "react-icons/fi";
import { apiGet, apiPost } from "@/lib/api";
import usePolling from "@/hooks/usePolling";
import Pagination from "@/components/Pagination.jsx";
import Drawer from "@/components/Drawer.jsx";
import Spinner from "@/components/Spinner.jsx";
import { useToast } from "@/components/Toast.jsx";

const TYPES = ["All", "INACTIVITY", "DWELL_CRITICAL", "NO_HEARTBEAT", "TEST_ALERT"];
const STATUSES = ["All", "open", "closed"];

function StatusBadge({ status }) {
  if (status === "open")
    return <span className="pill-open"><FiAlertCircle size={14}/> Open</span>;
  return <span className="pill-closed"><FiCheckCircle size={14}/> Closed</span>;
}

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
      toast.push("ok", "Alert acked");
      load({ silent: true });
    } catch {
      toast.push("err", "Ack failed");
    }
  };
  const close = async (id) => {
    try {
      await apiPost(`/api/alerts/${id}/close`);
      toast.push("ok", "Alert closed");
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

  // Сводка по типам
  const summary = {
    open: items.filter(a => a.status === "open").length,
    INACTIVITY: items.filter(a => a.type === "INACTIVITY").length,
    DWELL_CRITICAL: items.filter(a => a.type === "DWELL_CRITICAL").length,
    NO_HEARTBEAT: items.filter(a => a.type === "NO_HEARTBEAT").length
  };

  // --- CSV экспорт
  function toCSV(rows){
    if(!rows?.length) return "";
    const cols = Object.keys(rows[0]);
    const esc = v => `"${String(v??"").replaceAll('"','""')}"`;
    return [cols.join(","), ...rows.map(r => cols.map(c=>esc(r[c])).join(","))].join("\n");
  }
  function download(name, text){
    const blob = new Blob([text], { type:"text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=name; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Заголовок + сводка */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold flex items-center gap-2"><FiBell className="text-red-400"/> Alerts</h1>
        <div className="flex flex-wrap gap-2 text-sm text-zinc-700 dark:text-zinc-300 font-medium">
          <span>Open: <b>{summary.open}</b> / Total: <b>{items.length}</b></span>
          <span>INACTIVITY: <b>{summary.INACTIVITY}</b></span>
          <span>DWELL_CRITICAL: <b>{summary.DWELL_CRITICAL}</b></span>
          <span>NO_HEARTBEAT: <b>{summary.NO_HEARTBEAT}</b></span>
        </div>
      </div>
      {/* Фильтры */}
      <div className="flex flex-wrap gap-2 items-end">
        <Filter label="Status" value={status} setValue={setStatus} options={STATUSES} icon={FiFilter}/>
        <Filter label="Type" value={type} setValue={setType} options={TYPES} icon={FiFilter}/>
        <Input label="Room contains" value={roomLike} setValue={setRoomLike}/>
        <Input label="Last minutes" type="number" value={lastMin} setValue={setLastMin} min={0}/>
        <label className="text-sm flex items-center gap-2 ml-2"><input type="checkbox" checked={live} onChange={e=>setLive(e.target.checked)}/><span className="text-zinc-400">Live</span></label>
        <button onClick={() => { setRefreshing(true); load(); }} className="border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900 flex items-center gap-2">
          {refreshing ? <Spinner size={16}/> : <FiRefreshCw size={16}/> } Refresh
        </button>
        <button onClick={()=>download(`alerts_${Date.now()}.csv`, toCSV(items))} className="border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900 flex items-center gap-2"><FiDownload/> Export CSV</button>
        <button onClick={bulkClose} className="border border-red-700 text-red-500 dark:text-red-300 rounded-md px-3 py-2 text-sm hover:bg-red-900/20 flex items-center gap-2"><FiXCircle/> Close stale NO_HEARTBEAT</button>
      </div>
      {/* Таблица */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-x-auto bg-white dark:bg-zinc-950/60 shadow">
        <table className="min-w-[1000px] w-full text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900/60">
            <tr>
              <Th>ID</Th><Th>Time</Th><Th>Ago</Th><Th>Room</Th>
              <Th>Device</Th><Th>Type</Th>
              <Th>Status</Th><Th>Actions</Th><Th>Details</Th>
            </tr>
          </thead>
          <tbody>
            {showTableLoading ? (
              <tr><td className="p-4 text-zinc-400" colSpan={9}><Spinner /> Loading…</td></tr>
            ) : pageRows.length === 0 ? (
              <tr><td className="p-4 text-zinc-400" colSpan={9}>No alerts found</td></tr>
            ) : (
              pageRows.map(a => (
                <tr key={a.id} onClick={() => setSelected(a)} className="border-t border-zinc-100 dark:border-zinc-900/80 hover:bg-zinc-900/30 cursor-pointer" title="Click to view details">
                  <Td mono>{a.id}</Td>
                  <Td mono>{a.ts_utc || "—"}</Td>
                  <Td title={a.ts_utc || ""}>{a.ts_utc ? a.ts_utc : "—"}</Td>
                  <Td>{a.room || "—"}</Td>
                  <Td>{a.device_id || "—"}</Td>
                  <Td>{a.type}</Td>
                  <Td><StatusBadge status={a.status}/></Td>
                  <Td onClick={e=>e.stopPropagation()}>
                    <div className="flex gap-2">
                      <button onClick={() => ack(a.id)} disabled={a.status !== "open"} className="rounded-md px-2 py-1 text-xs border border-amber-400 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/20">Ack</button>
                      <button onClick={() => close(a.id)} disabled={a.status === "closed"} className="rounded-md px-2 py-1 text-xs border border-red-700 text-red-500 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/20">Close</button>
                    </div>
                  </Td>
                  <Td className="max-w-[380px] truncate" title={a.details || ""}>{a.details || "—"}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="pt-2">
         <Pagination page={page} pageSize={pageSize} total={items.length} setPage={setPage}/>
      </div>
      {/* Drawer для подробностей алерта */}
      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected ? `Alert #${selected.id}` : "Alert"}>
        {selected && (
          <div className="space-y-3">
            <div className="flex items-center gap-2"><StatusBadge status={selected.status}/><span className="text-xs text-zinc-400">{selected.type}</span></div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <Detail label="Time" value={selected.ts_utc}/>
              <Detail label="Room" value={selected.room}/>
              <Detail label="Device" value={selected.device_id}/>
              <Detail label="Severity" value={selected.severity}/>
              <Detail label="Details" value={selected.details}/>
              <Detail label="Created" value={selected.created_at}/>
              <Detail label="Notified" value={selected.notified_at}/>
              <Detail label="Closed" value={selected.closed_at}/>
              <Detail label="Ack at" value={selected.ack_at}/>
              <Detail label="Ack by" value={selected.ack_by}/>
            </dl>
            <div>
              <div className="text-xs text-zinc-400 mb-1">Raw JSON</div>
              <pre className="text-xs border border-zinc-800 rounded-md p-2 overflow-auto bg-black/40">{JSON.stringify(selected, null, 2)}</pre>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={()=>ack(selected.id)} disabled={selected.status!=="open"} className="rounded-md px-3 py-2 text-sm border border-amber-400 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/20">Ack</button>
              <button onClick={()=>close(selected.id)} disabled={selected.status==="closed"} className="rounded-md px-3 py-2 text-sm border border-red-700 text-red-500 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/20">Close</button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

function Filter({ label, value, setValue, options, icon: Icon }) {
  return (
    <label className="text-sm text-zinc-700 dark:text-zinc-300 flex flex-col gap-1 min-w-[100px]">
      <span className="text-zinc-400 flex items-center gap-1">{Icon && <Icon size={14}/>} {label}</span>
      <select className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md px-3 py-2 text-neutral-900 dark:text-zinc-100"
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
      <input className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md px-3 py-2 text-neutral-900 dark:text-zinc-100"
        value={value} onChange={e => setValue(e.target.value)} {...rest}/>
    </label>
  );
}
function Th({ children }) { return <th className="text-left px-3 py-2 text-zinc-400">{children}</th>; }
function Td({ children, mono, className }) { return <td className={`px-3 py-2 ${mono ? "font-mono text-xs" : ""} ${className || ""}`}>{children}</td>; }
function Detail({ label, value }) {
  return (
    <div className="border border-zinc-800 rounded-md p-2 bg-zinc-950/40">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="text-sm">{value ?? "—"}</div>
    </div>
  );
}
