import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { FiAlertCircle, FiHome, FiBell, FiSettings, FiMap, FiClock, FiDatabase, FiMonitor } from 'react-icons/fi';

export default function Toolbar({ alertsOpen, apiStatus, onThemeToggle, dark }) {
  const location = useLocation();
  const nav = [
    { label: 'Dashboard', path: '/', icon: FiHome },
    { label: 'Alerts', path: '/alerts', icon: FiBell },
    { label: 'Devices', path: '/devices', icon: FiMonitor },
    { label: 'Settings', path: '/settings', icon: FiSettings },
    // Future: { label: 'History', path: '/history', icon: FiDatabase },
    // Future: { label: 'Rooms/Map', path: '/rooms', icon: FiMap },
  ];
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-700 sticky top-0 bg-white dark:bg-black/60 backdrop-blur shadow z-20">
      <div className="max-w-7xl mx-auto px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-indigo-600 dark:text-indigo-300 tracking-wide">Eldercare</span>
          <span className="hidden sm:inline text-sm text-zinc-600 dark:text-zinc-400 ml-2 font-medium">Monitoring</span>
        </div>
        <nav className="flex gap-1">
          {nav.map((item) =>
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `px-3 py-2 rounded-md text-sm flex items-center gap-1 transition font-medium
                  ${isActive || location.pathname === item.path
                    ? 'bg-indigo-200 dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-indigo-700 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-indigo-100'}`
              }>
              <item.icon size={17} className="inline mr-1" /> {item.label}
              {item.label === "Alerts" && alertsOpen > 0 &&
                <span className="ml-2 px-2 py-0.5 rounded-full bg-red-500/20 text-red-600 dark:text-red-300 text-xs border border-red-400/30">{alertsOpen}</span>
              }
            </NavLink>
          )}
        </nav>
        <div className="flex items-center gap-2">
          {/* API Status Indicator */}
          <ApiStatusIndicator status={apiStatus} />
          {/* Theme Switcher */}
          <button
            className="ml-2 p-2 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 text-sm transition"
            onClick={onThemeToggle}
            aria-label="Toggle theme mode"
            title={dark ? "Light mode" : "Dark mode"}
          >
            {dark
              ? <FiClock size={17} />
              : <FiMoon size={17} />}
          </button>
        </div>
      </div>
    </header>
  );
}

function ApiStatusIndicator({ status }) {
  let badge = null;
  if (status === "ok") badge = <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs border border-emerald-700/20"><FiDatabase size={14} /> API Online</span>;
  if (status === "error") badge = <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-700 dark:text-red-300 text-xs border border-red-700/20"><FiDatabase size={14} /> API Error</span>;
  if (status === "loading") badge = <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 text-xs border border-blue-700/20 animate-pulse"><FiDatabase size={14} /> API...</span>;
  return badge || null;
}
