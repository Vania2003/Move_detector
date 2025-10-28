import React from "react";
import { FiMonitor, FiHome, FiCheckCircle, FiAlertTriangle, FiSearch } from "react-icons/fi";
import usePolling from "@/hooks/usePolling";
import { apiGet } from "@/lib/api";
import { timeAgo, isUp } from "@/utils/health";

function StatusIcon({ up }) {
  return up
    ? (<span className="pill-closed"><FiCheckCircle size={14}/> UP</span>)
    : (<span className="pill-open"><FiAlertTriangle size={14}/> DOWN</span>);
}

const Th = ({ children, className }) => <th className={`text-left px-3 py-2 text-zinc-400 ${className || ""}`}>{children}</th>;
const Td = ({ children, mono, className }) => <td className={`px-3 py-2 ${mono ? "font-mono text-xs" : ""} ${className || ""}`}>{children}</td>;

export default function Devices() {
  const [rows, setRows] = React.useState([]);
  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet("/api/devices");
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, []);
  usePolling(load, 15000);

  // Фильтрация по поиску
  const filtered = rows.filter(r =>
    r.device_id.toLowerCase().includes(search.toLowerCase()) ||
    (r.room && r.room.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <FiMonitor className="text-emerald-400"/> Devices
        </h1>
        <div className="flex gap-2 items-center">
          <FiSearch className="text-zinc-400"/>
          <input
            className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md px-3 py-2 text-neutral-900 dark:text-zinc-100 w-[170px]"
            placeholder="Search device/room..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-x-auto bg-white dark:bg-zinc-950 shadow">
        <table className="min-w-[500px] w-full text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900/60">
            <tr>
              <Th>Device ID</Th>
              <Th>Room</Th>
              <Th>Last heartbeat</Th>
              <Th className="text-right">Status</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-4 text-zinc-400" colSpan={4}>Loading…</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="p-4 text-zinc-400" colSpan={4}>No devices found</td>
              </tr>
            ) : (
              filtered.map((d) => (
                <tr key={d.device_id} className="border-t border-zinc-100 dark:border-zinc-900/80">
                  <Td mono>{d.device_id}</Td>
                  <Td>{d.room || "—"}</Td>
                  <Td mono>{d.last_hb ? `${d.last_hb} (${timeAgo(d.last_hb)})` : "—"}</Td>
                  <td className="px-4 py-2 text-right"><StatusIcon up={isUp(d.last_hb)} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="text-sm text-zinc-500 mt-2">
        Only devices with heartbeats in the last 30 min are shown as <span className="text-emerald-400 font-medium">UP</span>.
      </div>
    </div>
  );
}
