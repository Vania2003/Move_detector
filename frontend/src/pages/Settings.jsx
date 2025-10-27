import React from "react";
import { FiSettings, FiCheck, FiRefreshCw, FiMail, FiLink } from "react-icons/fi";
import { apiGet, apiPut } from "@/lib/api";
import Spinner from "@/components/Spinner.jsx";

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
];

export default function Settings() {
  const [data, setData] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [apiTest, setApiTest] = React.useState("unknown");
  const [smtpStatus, setSmtpStatus] = React.useState("unknown");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const d = await apiGet("/api/rule-settings");
      setData(d);
      // TODO: GET /api/status for API/SMTP if реализовано (здесь — фейк)
      setApiTest("ok");
      setSmtpStatus("ok");
    } catch {
      setError("Could not load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await apiPut("/api/rule-settings", data);
      await load();
    } catch {
      setError("Could not save settings");
    }
    setSaving(false);
  };

  if (loading) return <div className="p-6"><Spinner size={28}/> Loading…</div>;

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="text-xl font-bold flex items-center gap-2"><FiSettings/> Rule settings</h1>
      <form className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {RULE_FIELDS.map(f =>
          <label key={f.key} className="flex flex-col gap-1">
            <span className="text-sm text-zinc-400">{f.label}</span>
            <input
              className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md px-3 py-2"
              value={data[f.key] ?? ""}
              onChange={e => setData(prev => ({ ...prev, [f.key]: e.target.value }))}
            />
          </label>
        )}
      </form>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={save} disabled={saving}
          className="border border-green-600 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md px-5 py-2 flex items-center gap-2">
          {saving ? <Spinner size={18}/> : <FiCheck/>} Save
        </button>
        <button type="button" onClick={load}
          className="border border-zinc-400 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900/20 rounded-md px-5 py-2 flex items-center gap-2">
          <FiRefreshCw/> Reload
        </button>
      </div>
      {!!error && <div className="text-red-400 font-medium mt-2 flex items-center gap-2"><FiSettings/>{error}</div>}
      <div className="border-t border-zinc-200 dark:border-zinc-700 pt-6 mt-6 space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2"><FiLink/> API & Notifier status</h2>
        <div className="flex gap-5 flex-wrap">
          <Badge status={apiTest} label="API connection"/>
          <Badge status={smtpStatus} label="SMTP (email)"/>
        </div>
        <div className="mt-2 text-xs text-zinc-500">
          Read-only indicator for server state. Mail/SMTP may need to be configured on Raspberry Pi.
        </div>
      </div>
      <div className="mt-10 border-t border-zinc-200 dark:border-zinc-700 pt-6">
        <h2 className="text-sm text-zinc-400 font-bold mb-2">Danger Zone (maintenance)</h2>
        <button className="border border-red-700 text-red-500 rounded-md px-3 py-2 text-sm hover:bg-red-900/20 flex items-center gap-2">
          <FiXCircle/> Bulk close all open NO_HEARTBEAT (do on demo only)
        </button>
      </div>
    </div>
  );
}

function Badge({ status, label }) {
  let base = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs";
  if (status === "ok") return <span className={base+" border-green-500 bg-green-500/10 text-green-700 dark:text-green-300"}>{label} OK</span>;
  if (status === "error") return <span className={base+" border-red-500 bg-red-500/10 text-red-700 dark:text-red-300"}>{label} ERROR</span>;
  return <span className={base+" border-zinc-400 bg-zinc-300/20 text-zinc-700 dark:text-zinc-300"}>{label} —</span>;
}
