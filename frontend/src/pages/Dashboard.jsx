import React from "react";
import { FiBell, FiMonitor, FiClock, FiActivity } from "react-icons/fi";
import usePolling from "@/hooks/usePolling";
import { apiGet } from "@/lib/api";
import { timeAgo } from "@/utils/health";
import KpiCard from "@/components/KpiCard.jsx";
import MiniChart from "@/components/MiniChart.jsx";

const Th = ({ children, className }) => (
  <th className={`text-left px-3 py-2 text-zinc-400 ${className || ""}`}>{children}</th>
);
const Td = ({ children, mono, className }) => (
  <td className={`px-3 py-2 ${mono ? "font-mono text-xs" : ""} ${className || ""}`}>{children}</td>
);

function parseJSONSafe(text) {
  if (!text || typeof text !== "string") return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
function fmtLocal(iso) {
  if (!iso) return { local: "—", ago: "" };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { local: iso, ago: "" };
  return { local: d.toLocaleString(), ago: timeAgo(iso) };
}
function msToHMS(ms) {
  if (typeof ms !== "number") return null;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m || h) parts.push(`${m}m`);
  parts.push(`${sec}s`);
  return parts.join(" ");
}
function chip(text, tone = "zinc") {
  const map = {
    zinc: "bg-zinc-500/10 border-zinc-600/30 text-zinc-300",
    indigo: "bg-indigo-500/10 border-indigo-500/30 text-indigo-300",
    emerald: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    red: "bg-red-500/10 border-red-500/30 text-red-300",
    amber: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    slate: "bg-slate-500/10 border-slate-500/30 text-slate-300",
    blue: "bg-blue-500/10 border-blue-500/30 text-blue-300",
    violet: "bg-violet-500/10 border-violet-500/30 text-violet-300",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${map[tone] || map.zinc}`}>
      {text}
    </span>
  );
}

function PayloadPretty({ payload }) {
  if (!payload) return <span className="text-zinc-500">—</span>;

  const motion =
    typeof payload.motion === "boolean"
      ? chip(`motion: ${payload.motion ? "true" : "false"}`, payload.motion ? "emerald" : "red")
      : null;

  const uptime = typeof payload.uptime_ms === "number" ? chip(`uptime: ${msToHMS(payload.uptime_ms)}`, "blue") : null;

  const dev = payload.device ? chip(payload.device, "slate") : null;

  const extras = Object.entries(payload)
    .filter(([k]) => !["motion", "uptime_ms", "device"].includes(k))
    .slice(0, 4)
    .map(([k, v]) => chip(`${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`, "violet"));

  return (
    <div className="flex flex-wrap gap-1.5">
      {motion}
      {uptime}
      {dev}
      {extras}
    </div>
  );
}

function TopicParts({ topic }) {
  const parts = typeof topic === "string" ? topic.split("/") : [];
  const room = parts[2] || null;
  const cat = parts[3] || null;
  const type = parts[4] || null;

  return (
    <div className="flex items-center gap-2">
      {room && chip(room, "indigo")}
      {cat && chip(cat, "amber")}
      {type && chip(type, "zinc")}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = React.useState({ alertsOpen: 0, devices: 0, lastMsg: null });
  const [messages, setMessages] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  const [activity] = React.useState([0.15, 0.35, 0.42, 0.9, 0.7, 0.41, 0.2, 0.8, 0.3, 0.05, 0, 0.01, 0.16, 0.65, 0.5, 0.3, 0.12, 0.36, 0.65, 0.8, 0.47, 0.14, 0.31, 0.5]);

  const fetchStats = React.useCallback(async () => {
    setLoading(true);
    try {
      const alerts = await apiGet("/api/alerts?status=open&limit=1000");
      const devices = await apiGet("/api/devices");
      const msgs = await apiGet("/api/messages?limit=10");
      setStats({
        alertsOpen: alerts.length,
        devices: devices.length,
        lastMsg: msgs?.[0]?.ts_utc || null,
      });
      setMessages(msgs);
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchStats, 20000);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <KpiCard icon={FiBell} label="Open alerts" value={loading ? "…" : stats.alertsOpen} color="red" hint="Needs attention" />
        <KpiCard icon={FiMonitor} label="Devices" value={loading ? "…" : stats.devices} color="emerald" hint="Connected" />
        <KpiCard
          icon={FiClock}
          label="Last message"
          value={loading ? "…" : (stats.lastMsg ? timeAgo(stats.lastMsg) : "—")}
          color="blue"
          hint="Latest MQTT event"
        >
          <MiniChart values={activity} color="blue" />
        </KpiCard>
      </div>

      <div className="hidden md:block pt-4" />

      <section className="space-y-2">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <FiActivity className="text-indigo-400" /> Latest MQTT messages
        </h2>

        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-x-auto bg-white dark:bg-zinc-950 shadow">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900/60">
              <tr>
                <Th>time</Th>
                <Th>room / type</Th>
                <Th>device / details</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="p-4 text-zinc-400" colSpan={3}>Loading…</td>
                </tr>
              ) : messages.length === 0 ? (
                <tr>
                  <td className="p-4 text-zinc-400" colSpan={3}>No messages yet</td>
                </tr>
              ) : (
                messages.map((m, i) => {
                  const { local, ago } = fmtLocal(m.ts_utc);
                  const parsed = parseJSONSafe(m.payload);
                  return (
                    <tr key={i} className="border-t border-zinc-100 dark:border-zinc-900/80">
                      <Td>
                        <div className="flex flex-col" title={m.ts_utc || ""}>
                          <span className="font-mono">{local}</span>
                          <span className="text-xs text-zinc-500">{ago}</span>
                        </div>
                      </Td>

                      <Td>
                        <TopicParts topic={m.topic} />
                      </Td>

                      <Td>
                        <PayloadPretty payload={parsed} />
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
