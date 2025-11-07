import React from "react";
import { apiGet, apiPut, apiPost } from "@/lib/api";
import Spinner from "@/components/Spinner.jsx";
import { useToast } from "@/components/Toast";
import {
  FiSettings,
  FiCheck,
  FiRefreshCw,
  FiLink,
  FiXCircle,
  FiTrash2,
  FiZap,
} from "react-icons/fi";

const RULE_FIELDS = [
  { key: "inactive.threshold_day_min", label: "Inactive (day, min)" },
  { key: "inactive.threshold_night_min", label: "Inactive (night, min)" },
  { key: "night.window", label: "Night window" },
  { key: "dwell.critical_rooms", label: "Critical rooms" },
  { key: "dwell.bathroom_min", label: "Bathroom min dwell" },
  { key: "dwell.kitchen_min", label: "Kitchen min dwell" },
  { key: "dwell.gap_min", label: "Dwell gap min" },
  { key: "pattern.window_days", label: "Pattern window (days)" },
  { key: "pattern.z_threshold", label: "Pattern Z-threshold" },
  { key: "alerts.autopurge_days", label: "Auto-purge alerts older than (days)" },
];

export default function Settings() {
  const [data, setData] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [apiTest, setApiTest] = React.useState("unknown");
  const [smtpStatus, setSmtpStatus] = React.useState("unknown");
  const [purging, setPurging] = React.useState(false);
  const [roomSettings, setRoomSettings] = React.useState(null);
  const [room, setRoom] = React.useState("room1");

  const { push: showToast } = useToast();

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [rules, roomCfg] = await Promise.all([
        apiGet("/api/rule-settings"),
        apiGet(`/api/rooms/${room}/settings`),
      ]);
      setData(rules);
      setRoomSettings(roomCfg.config || {});
      setApiTest("ok");
      setSmtpStatus("ok");
    } catch {
      setError("Could not load settings");
    } finally {
      setLoading(false);
    }
  }, [room]);

  React.useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await apiPut("/api/rule-settings", data);
      await apiPost(`/api/rooms/${room}/settings`, roomSettings);
      await load();
      showToast("ok", "✅ Settings saved successfully");
    } catch {
      setError("Could not save settings");
      showToast("error", "Error saving settings");
    }
    setSaving(false);
  };

  const purge = async () => {
    setPurging(true);
    try {
      await apiPost("/api/alerts/purge?older_than_days=7");
      await load();
      showToast("ok", "Old alerts purged");
    } catch {
      showToast("error", "Purge failed");
    } finally {
      setPurging(false);
    }
  };

  const testLed = async () => {
    try {
      await apiPost(`/api/rooms/${room}/led`, { action: "blink" });
      showToast("ok", `💡 LED blinked for ${room}`);
    } catch (err) {
      console.error("LED test failed:", err);
      showToast("error", "Failed to trigger LED");
    }
  };

  if (loading) return <div className="p-6"><Spinner size={28}/> Loading…</div>;

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <FiSettings /> Rule settings
      </h1>

      <form className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {RULE_FIELDS.map((f) => (
          <label key={f.key} className="flex flex-col gap-1">
            <span className="text-sm text-zinc-400">{f.label}</span>
            <input
              className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md px-3 py-2"
              value={data[f.key] ?? ""}
              onChange={(e) =>
                setData((prev) => ({ ...prev, [f.key]: e.target.value }))
              }
            />
          </label>
        ))}
      </form>

      <div className="border-t border-zinc-300 dark:border-zinc-700 pt-6 space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <FiZap /> Room Prealert Configuration
        </h2>

        <div className="flex items-center gap-3">
          <label className="text-sm">Room:</label>
          <select
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            className="px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 
                        bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 
                        [color-scheme:dark] dark:[color-scheme:light] transition"
          >
            <option value="room1">room1</option>
            <option value="Kitchen">Kitchen</option>
            <option value="LivingRoom">LivingRoom</option>
            <option value="Bedroom">Bedroom</option>
            <option value="Bathroom">Bathroom</option>
            <option value="Hallway">Hallway</option>
          </select>
          <button
            onClick={testLed}
            className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-md border border-amber-400 text-amber-400 hover:bg-amber-400/10 transition-all"
          >
            <FiZap /> Test LED
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col">
            <span className="text-sm text-zinc-400">Inactivity (sec)</span>
            <input
              type="number"
              value={roomSettings?.inactivity_sec ?? ""}
              onChange={(e) =>
                setRoomSettings((r) => ({
                  ...r,
                  inactivity_sec: parseInt(e.target.value),
                }))
              }
              className="px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 
                        bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 
                        [color-scheme:dark] dark:[color-scheme:light] transition"
            />
          </label>

          <label className="flex flex-col">
            <span className="text-sm text-zinc-400">Prealert offset (sec)</span>
            <input
              type="number"
              value={roomSettings?.prealert_offset_sec ?? ""}
              onChange={(e) =>
                setRoomSettings((r) => ({
                  ...r,
                  prealert_offset_sec: parseInt(e.target.value),
                }))
              }
              className="px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 
                        bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 
                        [color-scheme:dark] dark:[color-scheme:light] transition"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-4 items-center pt-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={roomSettings?.enabled ?? false}
              onChange={(e) =>
                setRoomSettings((r) => ({ ...r, enabled: e.target.checked }))
              }
            />
            Enabled
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={roomSettings?.night_block ?? false}
              onChange={(e) =>
                setRoomSettings((r) => ({ ...r, night_block: e.target.checked }))
              }
            />
            Block at night
          </label>
          {roomSettings?.night_block && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <label className="flex flex-col">
                <span className="text-sm text-zinc-400">Night starts at</span>
                <input
                type="time"
                value={roomSettings?.night_window?.from || "23:00"}
                onChange={(e) =>
                  setRoomSettings((r) => ({
                    ...r,
                    night_window: { ...(r.night_window || {}), from: e.target.value },
                  }))
                }
                className="
                          px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700
                          bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100
                          [color-scheme:light] dark:[color-scheme:dark]
                          focus:outline-none focus:ring-2 focus:ring-emerald-500/40
                          transition-colors duration-150"

              />
              </label>

              <label className="flex flex-col">
                <span className="text-sm text-zinc-400">Night ends at</span>
               <input
                type="time"
                value={roomSettings?.night_window?.to || "07:00"}
                onChange={(e) =>
                  setRoomSettings((r) => ({
                    ...r,
                    night_window: { ...(r.night_window || {}), to: e.target.value },
                  }))
                }
               className="
                          px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700
                          bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100
                          [color-scheme:light] dark:[color-scheme:dark]
                          focus:outline-none focus:ring-2 focus:ring-emerald-500/40
                          transition-colors duration-150"
              />
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="border border-green-600 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md px-5 py-2 flex items-center gap-2"
        >
          {saving ? <Spinner size={18} /> : <FiCheck />} Save
        </button>

        <button
          type="button"
          onClick={load}
          className="border-2 border-blue-500 dark:border-blue-400 text-blue-700 dark:text-blue-200 font-semibold hover:bg-blue-500/10 dark:hover:bg-blue-400/10 focus:ring-2 focus:ring-blue-500 focus:outline-none rounded-md px-5 py-2 flex items-center gap-2 transition-all"
        >
          <FiRefreshCw />
          <span className="font-semibold">Reload</span>
        </button>
      </div>

      {!!error && (
        <div className="text-red-400 font-medium mt-2 flex items-center gap-2">
          <FiSettings />
          {error}
        </div>
      )}

      <div className="border-t border-zinc-200 dark:border-zinc-700 pt-6 mt-6 space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <FiLink /> API & Notifier status
        </h2>
        <div className="flex gap-5 flex-wrap">
          <Badge status={apiTest} label="API connection" />
          <Badge status={smtpStatus} label="SMTP (email)" />
        </div>
        <div className="mt-2 text-xs text-zinc-500">
          Read-only indicator for server state. Emails mirror Alerts events.
        </div>
      </div>

      <div className="mt-10 border-t border-zinc-200 dark:border-zinc-700 pt-6 space-y-3">
        <h2 className="text-sm text-zinc-400 font-bold">Maintenance</h2>

        <div className="flex flex-wrap gap-3 items-center">
          <button
            onClick={purge}
            disabled={purging}
            className="ghost-btn"
            title="Delete/Archive closed alerts older than 7 days (if backend supports)"
          >
            <FiTrash2 />
            {purging ? "Purging…" : "Purge closed >7 days"}
          </button>

          <button
            className="ghost-btn"
            onClick={async (e) => {
              e.preventDefault();
              try {
                await apiPost(
                  `/api/alerts/close-bulk?status=open&older_than_minutes=${
                    7 * 24 * 60
                  }&type=NO_HEARTBEAT`
                );
              } catch {}
            }}
          >
            <FiXCircle /> Close stale NO_HEARTBEAT
          </button>
        </div>

        <div className="text-xs text-zinc-500">
          Optional server cron can read <b>alerts.autopurge_days</b> and purge automatically.
        </div>
      </div>
    </div>
  );
}

function Badge({ status, label }) {
  let base = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs";
  if (status === "ok")
    return (
      <span
        className={
          base +
          " border-green-500 bg-green-500/10 text-green-700 dark:text-green-300"
        }
      >
        {label} OK
      </span>
    );
  if (status === "error")
    return (
      <span
        className={
          base +
          " border-red-500 bg-red-500/10 text-red-700 dark:text-red-300"
        }
      >
        {label} ERROR
      </span>
    );
  return (
    <span
      className={
        base +
        " border-zinc-400 bg-zinc-300/20 text-zinc-700 dark:text-zinc-300"
      }
    >
      {label} —
    </span>
  );
}
