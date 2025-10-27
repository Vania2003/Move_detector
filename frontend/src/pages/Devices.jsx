// src/pages/Devices.jsx
import React from 'react';
import { FiCpu, FiHome, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import { apiGet } from '@/lib/api';
import usePolling from '@/hooks/usePolling';
import { isUp, timeAgo } from '@/utils/health';

const Th = ({ children, className = '' }) =>
  <th className={`text-left px-4 py-2 text-zinc-400 ${className}`}>{children}</th>;
const Td = ({ children, mono, className = '' }) =>
  <td className={`px-4 py-2 ${mono ? 'font-mono text-xs' : ''} ${className}`}>{children}</td>;

function StatusIcon({ up }) {
  return up
    ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-emerald-700 bg-emerald-900/10 text-emerald-300 text-xs font-medium shadow">
        <FiCheckCircle size={14} className="text-emerald-400" /> UP
      </span>
    )
    : (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-red-700 bg-red-900/10 text-red-300 text-xs font-medium shadow">
        <FiAlertTriangle size={14} className="text-red-400" /> DOWN
      </span>
    );
}

export default function Devices() {
  const [rows, setRows] = React.useState([]);

  const load = React.useCallback(async () => {
    const data = await apiGet('/api/devices');
    setRows(data);
  }, []);
  usePolling(load, Number(import.meta.env.VITE_POLL_MS || 10000));

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold flex items-center gap-2">
        <FiHome className="text-indigo-400" /> Devices
      </h1>
      <div className="border border-zinc-800 rounded-xl overflow-x-auto bg-zinc-950/60 shadow">
        <table className="min-w-[600px] w-full text-sm">
          <thead className="bg-zinc-900/60">
            <tr>
              <Th><FiCpu size={14} className="inline mr-1" />Device ID</Th>
              <Th>Room</Th>
              <Th>Last heartbeat</Th>
              <Th className="text-right">Status</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="p-4 text-zinc-400" colSpan={4}>No devices</td>
              </tr>
            )}
            {rows.map((d) => (
              <tr key={d.device_id} className="border-t border-zinc-900/80">
                <Td mono>{d.device_id}</Td>
                <Td>{d.room || '—'}</Td>
                <Td mono>{d.last_hb ? `${d.last_hb} (${timeAgo(d.last_hb)})` : '—'}</Td>
                <td className="px-4 py-2 text-right">
                  <StatusIcon up={isUp(d.last_hb)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-sm text-zinc-500 mt-2">
        Only devices with heartbeats in the last 30 minutes are shown as <span className="text-emerald-400 font-medium">UP</span>.
      </div>
    </div>
  );
}
