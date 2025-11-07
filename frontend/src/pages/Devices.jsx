// src/pages/Devices.jsx
import React from "react";
import {
  FiMonitor, FiSearch, FiPlusCircle, FiTrash2, FiCheckCircle, FiAlertTriangle
} from "react-icons/fi";
import usePolling from "@/hooks/usePolling";
import { apiGet, apiPost } from "@/lib/api";
import Drawer from "@/components/Drawer.jsx";
import Spinner from "@/components/Spinner.jsx";
import { timeAgo, isUp } from "@/utils/health";
import { useToast } from "@/components/Toast.jsx";

function StatusIcon({ up }) {
  return up
    ? (<span className="pill-closed"><FiCheckCircle size={14}/> UP</span>)
    : (<span className="pill-open"><FiAlertTriangle size={14}/> DOWN</span>);
}

const Th = ({ children, className }) =>
  <th className={`text-left px-3 py-2 text-zinc-400 ${className || ""}`}>{children}</th>;
const Td = ({ children, mono, className }) =>
  <td className={`px-3 py-2 ${mono ? "font-mono text-xs" : ""} ${className || ""}`}>{children}</td>;

export default function Devices() {
  const toast = useToast();

  const [rows, setRows] = React.useState([]);
  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  // registration form
  const [regId, setRegId] = React.useState("");
  const [regRoom, setRegRoom] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  // remove confirm
  const [toRemove, setToRemove] = React.useState(null);
  const [removing, setRemoving] = React.useState(false);

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

  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    return r.device_id.toLowerCase().includes(q) || (r.room && r.room.toLowerCase().includes(q));
  });

  async function registerDevice(e) {
    e?.preventDefault?.();
    const id = regId.trim();
    if (!id) return;
    setSubmitting(true);
    try {
      await apiPost("/api/devices/register", { device_id: id, room: regRoom || null });
      setRegId(""); setRegRoom("");
      toast.push("ok", `Device ${id} registered`);
      load();
    } catch {
      toast.push("err", "Failed to register device");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeDevice() {
    if (!toRemove) return;
    setRemoving(true);
    try {
      // backend route: adjust if needed
      await apiPost(`/api/devices/${encodeURIComponent(toRemove.device_id)}/unregister`, {});
      toast.push("ok", `Device ${toRemove.device_id} removed`);
      setToRemove(null);
      load();
    } catch {
      toast.push("err", "Failed to remove device");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <FiMonitor className="text-emerald-400" /> Devices
        </h1>
        <div className="flex gap-2 items-center">
          <FiSearch className="text-zinc-400" />
          <input
            className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md px-3 py-2 text-neutral-900 dark:text-zinc-100 w-[210px]"
            placeholder="Search device/room..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Register block */}
      <form
        onSubmit={registerDevice}
        className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 bg-white/5 dark:bg-zinc-950/60 flex items-end gap-3 flex-wrap"
      >
        <label className="text-sm flex-1 min-w-[220px]">
          <div className="text-zinc-400 mb-1">Device ID</div>
          <input
            value={regId}
            onChange={(e) => setRegId(e.target.value)}
            placeholder="esp8266-xxx"
            className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md px-3 py-2"
          />
        </label>
        <label className="text-sm flex-1 min-w-[220px]">
          <div className="text-zinc-400 mb-1">Room</div>
          <input
            value={regRoom}
            onChange={(e) => setRegRoom(e.target.value)}
            placeholder="Kitchen / Bedroom …"
            className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={!regId || submitting}
          className="ghost-btn"
        >
          {submitting ? <Spinner size={16} /> : <FiPlusCircle size={16} />}
          Register device
        </button>
      </form>

      {/* Table */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-x-auto bg-white dark:bg-zinc-950 shadow">
        <table className="min-w-[760px] w-full text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900/60">
            <tr>
              <Th>Device ID</Th>
              <Th>Room</Th>
              <Th>Last heartbeat</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-4 text-zinc-400" colSpan={5}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td className="p-4 text-zinc-400" colSpan={5}>No devices found</td></tr>
            ) : (
              filtered.map((d) => {
                const up = isUp(d.last_hb);
                return (
                  <tr key={d.device_id} className="border-t border-zinc-100 dark:border-zinc-900/80">
                    <Td mono>{d.device_id}</Td>
                    <Td>{d.room || "—"}</Td>
                    <Td mono>{d.last_hb ? `${new Date(d.last_hb).toLocaleString()} (${timeAgo(d.last_hb)})` : "—"}</Td>
                    <Td><StatusIcon up={up} /></Td>
                    <Td className="text-right">
                      <button
                        onClick={() => setToRemove(d)}
                        className="ghost-btn border-red-400 text-red-300 hover:bg-red-900/10"
                        title="Remove device"
                      >
                        <FiTrash2 /> Remove
                      </button>
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="text-sm text-zinc-500 mt-2">
        Device must send heartbeats in the last 30 min to appear as <span className="text-emerald-400 font-medium">UP</span>.
      </div>

      {/* Confirm remove drawer */}
      <Drawer
        open={!!toRemove}
        onClose={() => setToRemove(null)}
        title={toRemove ? `Remove device ${toRemove.device_id}?` : "Remove device"}
      >
        {toRemove && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-300">
              This will unregister the device from the system.
              {toRemove.room ? <> It is currently assigned to <b>{toRemove.room}</b>.</> : null}
            </p>
            <div className="detail-card">
              <div className="label">Device ID</div>
              <div className="value">{toRemove.device_id}</div>
            </div>
            <div className="detail-card">
              <div className="label">Last heartbeat</div>
              <div className="value">{toRemove.last_hb ? `${new Date(toRemove.last_hb).toLocaleString()} (${timeAgo(toRemove.last_hb)})` : "—"}</div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setToRemove(null)}
                className="rounded-md px-3 py-2 text-sm border border-zinc-600 text-zinc-200 hover:bg-zinc-800/40"
              >
                Cancel
              </button>
              <button
                onClick={removeDevice}
                disabled={removing}
                className="rounded-md px-3 py-2 text-sm border border-red-600 text-red-400 hover:bg-red-900/20"
              >
                {removing ? <Spinner size={16}/> : <FiTrash2 />} Remove
              </button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
