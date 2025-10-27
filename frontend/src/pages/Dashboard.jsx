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

export default function Dashboard() {
  const [stats, setStats] = React.useState({ alertsOpen: 0, devices: 0, lastMsg: null });
  const [messages, setMessages] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  // Пример данных для мини-графика активности (замени на реальные)
  const [activity, setActivity] = React.useState([0.15, 0.35, 0.42, 0.9, 0.7, 0.41, 0.2, 0.8, 0.3, 0.05, 0, 0.01, 0.16, 0.65, 0.5, 0.3, 0.12, 0.36, 0.65, 0.8, 0.47, 0.14, 0.31, 0.5]);

  const fetchStats = React.useCallback(async () => {
    setLoading(true);
    try {
      // /api/alerts?status=open: для счетчика алертов
      const alerts = await apiGet("/api/alerts?status=open&limit=1000");
      // /api/devices: для счетчика устройств
      const devices = await apiGet("/api/devices");
      // /api/messages?limit=10: последние сообщения
      const msgs = await apiGet("/api/messages?limit=10");
      setStats({
        alertsOpen: alerts.length,
        devices: devices.length,
        lastMsg: msgs?.[0]?.ts_utc || null,
      });
      setMessages(msgs);
      // секция "mini-chart": в реальном проекте можно подгружать историю активности
      // setActivity(твой_массив); // или обработать msgs чтобы получить граф
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchStats, 20000);

  return (
    <div className="space-y-8">
      {/* KPI секция */}
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

      {/* Heatmap — оставь место для будущего */}
      <div className="hidden md:block pt-4">
        {/* <HeatmapComponent ... /> */}
      </div>

      {/* Последние сообщения */}
      <section className="space-y-2">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <FiActivity className="text-indigo-400" /> Latest MQTT messages
        </h2>
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-x-auto bg-white dark:bg-zinc-950/60 shadow">
          <table className="min-w-[560px] w-full text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900/60">
              <tr>
                <Th>ts_utc</Th>
                <Th>topic</Th>
                <Th>payload</Th>
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
                messages.map((m, i) => (
                  <tr key={i} className="border-t border-zinc-100 dark:border-zinc-900/80">
                    <Td mono>{m.ts_utc}</Td>
                    <Td>{m.topic}</Td>
                    <Td mono className="truncate">{m.payload}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
