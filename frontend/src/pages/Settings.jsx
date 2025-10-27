// src/pages/Settings.jsx
import React from 'react';
import { apiGet, apiPut } from '@/lib/api';
import { FiSettings, FiCheck, FiRefreshCw, FiAlertTriangle } from 'react-icons/fi';

const FIELDS = [
  { key: 'inactive.threshold_day_min', label: 'Inactive threshold (day, min)', icon: FiAlertTriangle },
  { key: 'inactive.threshold_night_min', label: 'Inactive threshold (night, min)', icon: FiAlertTriangle },
  { key: 'night.window', label: 'Night window', icon: FiSettings },
  { key: 'dwell.critical_rooms', label: 'Critical rooms', icon: FiSettings },
  { key: 'dwell.bathroom_min', label: 'Bathroom min dwell (min)', icon: FiSettings },
  { key: 'dwell.kitchen_min', label: 'Kitchen min dwell (min)', icon: FiSettings },
  { key: 'dwell.gap_min', label: 'Dwell gap min', icon: FiSettings },
  { key: 'pattern.window_days', label: 'Pattern window (days)', icon: FiSettings },
  { key: 'pattern.z_threshold', label: 'Pattern Z-threshold', icon: FiSettings },
];

function validate(data) {
  // простая проверка: все поля не пустые
  return FIELDS.every(f => (data?.[f.key] || '').toString().trim().length > 0);
}

export default function Settings() {
  const [data, setData] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  const load = React.useCallback(async () => {
    setError('');
    try {
      const d = await apiGet('/api/rule-settings');
      setData(d);
    } catch {
      setError('Could not load settings');
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const save = async () => {
    setError('');
    if (!validate(data)) {
      setError('Fill all fields before saving');
      return;
    }
    setSaving(true);
    try {
      await apiPut('/api/rule-settings', data);
    } catch {
      setError('Could not save settings');
    }
    setSaving(false);
    load();
  };

  if (!data) return <div className="p-6"><FiSettings className="animate-spin mr-1 inline" /> Loading…</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold flex items-center gap-2">
        <FiSettings className="text-indigo-400" /> Rule settings
      </h1>
      <form className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FIELDS.map((f) => (
          <label key={f.key} className="flex flex-col gap-1">
            <span className="text-sm text-zinc-400 flex items-center gap-1">
              {f.icon && <f.icon size={15}/>}{f.label}
            </span>
            <input
              className="bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 focus:ring focus:outline-none"
              value={data[f.key] ?? ''}
              onChange={e => setData(prev => ({ ...prev, [f.key]: e.target.value }))}
            />
          </label>
        ))}
      </form>
      <div className="flex gap-2 pt-2">
        <button 
          type="button" 
          onClick={save} 
          disabled={saving || !validate(data)}
          className="border border-emerald-700 text-emerald-300 bg-emerald-900/10 hover:bg-emerald-900/30 rounded-md px-5 py-2 flex items-center gap-2"
        >
          {saving ? <FiSettings className="animate-spin" /> : <FiCheck />} Save
        </button>
        <button 
          type="button" 
          onClick={load}
          className="border border-zinc-700 text-zinc-300 hover:bg-zinc-900/20 rounded-md px-5 py-2 flex items-center gap-2"
        >
          <FiRefreshCw /> Reload
        </button>
      </div>
      {error && <div className="text-red-400 font-medium mt-2 flex items-center gap-2">
        <FiAlertTriangle /> {error}
      </div>}
    </div>
  );
}
