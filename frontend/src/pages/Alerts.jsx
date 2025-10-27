import React from 'react';
import { FiAlertCircle, FiCheckCircle, FiFilter, FiSearch, FiFileText, FiXCircle, FiInbox, FiRefreshCw } from 'react-icons/fi';
import { apiGet, apiPost } from '@/lib/api';
import usePolling from '@/hooks/usePolling';
import { timeAgo } from '@/utils/health';
import Drawer from '@/components/Drawer.jsx';
import Spinner from '@/components/Spinner.jsx';
import Pagination from '@/components/Pagination.jsx';
import { useToast } from '@/components/Toast.jsx';

const TYPES = ['All', 'INACTIVITY', 'DWELL_CRITICAL', 'NO_HEARTBEAT', 'TEST_ALERT'];
const STATUSES = ['All', 'open', 'closed'];

function StatusPill({ status }) {
  if (status === 'open') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-red-500/15 text-red-300 border-red-500/30 text-xs">
        <FiAlertCircle className="text-red-400" size={14} /> Open
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-xs">
      <FiCheckCircle className="text-emerald-300" size={14} /> Closed
    </span>
  );
}

// --- Паттерн сохранения выбранного алерта между polling ---
function useStableSelected(items, selected) {
  // находим актуальный объект по id, даже если пришёл новый список items
  if (!selected) return null;
  const found = items.find(o => o.id === selected.id);
  return found || null;
}

export default function Alerts() {
  const [items, setItems] = React.useState([]);
  const [status, setStatus] = React.useState('All');
  const [type, setType] = React.useState('All');
  const [roomLike, setRoomLike] = React.useState('');
  const [lastMin, setLastMin] = React.useState(0);
  const inflight = React.useRef(false);
  const [loading, setLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [live, setLive] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [selected, setSelected] = React.useState(null); // {id, ...} объект!
  const toast = useToast();

  const load = React.useCallback(
    async (opts = { silent: false }) => {
      if (inflight.current) return;
      inflight.current = true;
      const { silent = false } = opts;
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams();
        if (status !== 'All') params.set('status', status);
        if (type !== 'All') params.set('type', type);
        if (roomLike) params.set('room', roomLike);
        if (Number(lastMin) > 0) params.set('last_minutes', String(lastMin));
        params.set('limit', '1000');
        const data = await apiGet(`/api/alerts?${params.toString()}`);
        setItems(data);
      } finally {
        inflight.current = false;
        if (!silent) setLoading(false);
        setRefreshing(false);
      }
    },
    [status, type, roomLike, lastMin]
  );

  React.useEffect(() => { load({ silent: false }); }, []);
  React.useEffect(() => { setPage(1); load({ silent: false }); }, [status, type, roomLike, lastMin, load]);
  usePolling(() => live && load({ silent:true }), Number(import.meta.env.VITE_POLL_MS || 10000));

  // Стабильно сохраняем выбранный алерт даже при обновлении rows/items
  const stableSelected = useStableSelected(items, selected);

  // Actions
  const ack = async (id) => {
    try {
      await apiPost(`/api/alerts/${id}/ack`, { by: 'web' });
      toast.push('ok', 'Acked');
      load({ silent: true });
    } catch {
      toast.push('err', 'Ack failed');
    }
  };
  const close = async (id) => {
    try {
      await apiPost(`/api/alerts/${id}/close`);
      toast.push('ok', 'Closed');
      load({ silent: true });
    } catch {
      toast.push('err', 'Close failed');
    }
  };
  const bulkClose = async () => {
    try {
      await apiPost(`/api/alerts/close-bulk?status=open&older_than_minutes=30&type=NO_HEARTBEAT`);
      toast.push('ok', 'Stale NO_HEARTBEAT closed');
      load({ silent: false });
    } catch {
      toast.push('err', 'Bulk close failed');
    }
  };

  // Pagination
  const opened = items.filter(a => a.status === 'open').length;
  const counts = {
    INACTIVITY: items.filter(a => a.type === 'INACTIVITY').length,
    DWELL_CRITICAL: items.filter(a => a.type === 'DWELL_CRITICAL').length,
    NO_HEARTBEAT: items.filter(a => a.type === 'NO_HEARTBEAT').length,
  };
  const start = (page - 1) * pageSize;
  const pageRows = items.slice(start, start + pageSize);
  const showTableLoading = loading && items.length === 0;

  return (
    <div className="space-y-5">
      {/* Заголовок и фильтры */}
      {/* ... осталось как было ... */}
      <div className="border border-zinc-800 rounded-xl overflow-x-auto bg-zinc-950/60 shadow">
        <table className="min-w-[1000px] w-full text-sm">
          <thead className="bg-zinc-900/60">
            <tr>
              <Th>ID</Th><Th>Time</Th><Th>Ago</Th><Th>Room</Th>
              <Th>Device</Th><Th>Type</Th>
              <Th>Status</Th><Th>Actions</Th><Th>Details</Th>
            </tr>
          </thead>
          <tbody>
            {showTableLoading && (
              <tr>
                <td className="p-4 text-zinc-400" colSpan={9}><Spinner /> Loading…</td>
              </tr>
            )}
            {!showTableLoading && pageRows.length === 0 && (
              <tr>
                <td className="p-4 text-zinc-500" colSpan={9}>Nothing here</td>
              </tr>
            )}
            {!showTableLoading && pageRows.map(a => (
              <tr
                key={a.id}
                onClick={() => setSelected(a)}
                className="border-t border-zinc-900/80 hover:bg-zinc-900/30 cursor-pointer"
                title="Click to view details"
              >
                <Td mono>{a.id}</Td>
                <Td mono>{a.ts_utc || '—'}</Td>
                <Td title={a.ts_utc || ''}>{a.ts_utc ? timeAgo(a.ts_utc) : '—'}</Td>
                <Td>{a.room || '—'}</Td>
                <Td>{a.device_id || '—'}</Td>
                <Td>{a.type}</Td>
                <Td><StatusPill status={a.status} /></Td>
                <Td onClick={e => e.stopPropagation()}>
                  <div className="flex gap-2">
                    <button
                      onClick={() => ack(a.id)} disabled={a.status !== 'open'}
                      className={`rounded-md px-2 py-1 text-xs border
                        ${a.status === 'open'
                          ? 'border-amber-600/60 text-amber-300 hover:bg-amber-900/20'
                          : 'border-zinc-700/40 text-zinc-500 cursor-not-allowed'}`}>
                      Ack
                    </button>
                    <button
                      onClick={() => close(a.id)} disabled={a.status === 'closed'}
                      className={`rounded-md px-2 py-1 text-xs border
                        ${a.status !== 'closed'
                          ? 'border-red-700/60 text-red-300 hover:bg-red-900/20'
                          : 'border-zinc-700/40 text-zinc-500 cursor-not-allowed'}`}>
                      Close
                    </button>
                  </div>
                </Td>
                <Td className="max-w-[380px] truncate" title={a.details || ''}>{a.details || '—'}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pt-2">
        <Pagination page={page} pageSize={pageSize} total={items.length} setPage={setPage} />
      </div>
      <Drawer
        open={!!stableSelected}
        onClose={() => setSelected(null)}
        title={stableSelected ? `Alert #${stableSelected.id}` : 'Alert'}
      >
        {stableSelected && (
          <div className="space-y-3">
            {/* ... тело Drawer ... */}
          </div>
        )}
      </Drawer>
    </div>
  );
}

const Th = ({ children }) => <th className="text-left px-4 py-2 text-zinc-400">{children}</th>;
const Td = ({ children, mono, className = '' }) =>
  <td className={`px-4 py-2 ${mono ? 'font-mono text-xs' : ''} ${className}`}>{children}</td>;

const Term = ({ t, v }) => (
  <div className="border border-zinc-800 rounded-md p-2 bg-zinc-950/40">
    <div className="text-xs text-zinc-400">{t}</div>
    <div className="text-sm">{v}</div>
  </div>
);

const Select = ({ label, value, setValue, options, icon: Icon }) => (
  <label className="text-sm text-zinc-300 flex flex-col gap-1 min-w-[120px]">
    <span className="text-zinc-400 flex items-center gap-1">{Icon && <Icon size={14}/>} {label}</span>
    <select className="bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2"
      value={value} onChange={e => setValue(e.target.value)}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </label>
);

const Input = ({ label, value, setValue, icon: Icon, ...rest }) => (
  <label className="text-sm text-zinc-300 flex flex-col gap-1 min-w-[120px]">
    <span className="text-zinc-400 flex items-center gap-1">{Icon && <Icon size={14}/>} {label}</span>
    <input className="bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2"
      value={value} onChange={e => setValue(e.target.value)} {...rest}/>
  </label>
);
