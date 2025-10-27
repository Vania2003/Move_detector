// src/pages/Dashboard.jsx
import React from 'react';
import { FiBell, FiHardDrive, FiClock } from 'react-icons/fi';
import KpiCard from '@/components/KpiCard.jsx';
import { apiGet } from '@/lib/api';
import usePolling from '@/hooks/usePolling';
import { timeAgo } from '@/utils/health';

// Отдельные ячейки
const Th = ({ children, className = '' }) => (
  <th className={`text-left px-4 py-2 text-zinc-400 ${className}`}>{children}</th>
);
const Td = ({ children, mono, className = '' }) => (
  <td className={`px-4 py-2 ${mono ? 'font-mono text-xs' : ''} ${className}`}>{children}</td>
);

export default function Dashboard() {
  const [stats, setStats] = React.useState({ alertsOpen: 0, devices: 0, lastMsg: null });
  const [messages, setMessages] = React.useState([]);

  const load = React.useCallback(async () => {
    const alerts = await apiGet('/api/alerts?status=open&limit=1000');
    const devices = await apiGet('/api/devices');
    const msgs = await apiGet('/api/messages?limit=5');
    setStats({
      alertsOpen: alerts.length,
      devices: devices.length,
      lastMsg: msgs?.[0]?.ts_utc || null,
    });
    setMessages(msgs);
  }, []);

  usePolling(load, Number(import.meta.env.VITE_POLL_MS || 10000));

  return (
    <div className="space-y-8">

      {/* KPI Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <KpiCard 
          title="Open alerts" 
          value={stats.alertsOpen} 
          icon={FiBell} 
          color="red" 
          hint={stats.alertsOpen > 0 ? "Attention required" : undefined}
        />
        <KpiCard 
          title="Devices" 
          value={stats.devices} 
          icon={FiHardDrive} 
          color="emerald" 
          hint="Registered sensors"
        />
        <KpiCard 
          title="Last message" 
          value={stats.lastMsg ? timeAgo(stats.lastMsg) : '—'}
          icon={FiClock} 
          color="sky" 
          hint="from /api/messages"
        />
      </div>

      {/* Latest Messages Section */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FiClock className="text-indigo-400" /> Latest MQTT messages
        </h2>
        <div className="border border-zinc-800 rounded-xl overflow-x-auto bg-zinc-950/60 shadow">
          <table className="min-w-[500px] w-full text-sm">
            <thead className="bg-zinc-900/60">
              <tr>
                <Th>ts_utc</Th><Th>topic</Th><Th>payload</Th>
              </tr>
            </thead>
            <tbody>
              {messages.length === 0 && (
                <tr>
                  <td className="p-4 text-zinc-400" colSpan={3}>No messages yet</td>
                </tr>
              )}
              {messages.map((m, i) => (
                <tr key={i} className="border-t border-zinc-900/80">
                  <Td mono>{m.ts_utc}</Td>
                  <Td>{m.topic}</Td>
                  <Td mono className="truncate">{m.payload}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
