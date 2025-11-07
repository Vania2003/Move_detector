import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { FiHome, FiBell, FiMonitor, FiSettings, FiArchive, FiMap, FiSun, FiMoon } from 'react-icons/fi';
import Dashboard from './pages/Dashboard.jsx';
import Alerts from './pages/Alerts.jsx';
import Devices from './pages/Devices.jsx';
import Settings from './pages/Settings.jsx';
import History from './pages/History.jsx';     
import RoomsMap from './pages/RoomsMap.jsx';    
import { ToastProvider } from './components/Toast.jsx';

const NavItem = ({ to, children, icon: Icon }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      [
        "px-3 py-2 rounded-md text-sm flex items-center gap-1 transition font-medium",
        isActive
          ? "bg-indigo-900/70 text-white font-semibold"
          : [
              "text-zinc-700 hover:bg-zinc-100 hover:text-indigo-800",
              "dark:text-zinc-100 dark:hover:text-zinc-10 dark:hover:bg-zinc-800/60"
            ].join(" "),
      ].join(" ")
    }
  >
    {Icon && <Icon size={17} className="mr-1" />} {children}
  </NavLink>
);


export default function App() {
  const [dark, setDark] = React.useState(() => {
    const ls = localStorage.getItem('theme_dark');
    if (ls !== null) return ls === '1';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  React.useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme_dark', '1');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme_dark', '0');
    }
  }, [dark]);
  return (
    <ToastProvider>
      <BrowserRouter>
        <div className="min-h-screen font-inter">
          <header className={
            "border-b sticky top-0 backdrop-blur z-30 shadow-lg " +
            (dark
              ? "bg-zinc-950/80 border-zinc-800/70"
              : "bg-white/80 border-neutral-300")
          }>
            <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold tracking-wide text-indigo-300">Eldercare</span>
                <span className="hidden sm:inline text-sm text-zinc-500 ml-2 font-medium">Monitoring System</span>
              </div>
              <nav className="flex gap-1">
                <NavItem to="/" icon={FiHome}>Dashboard</NavItem>
                <NavItem to="/alerts" icon={FiBell}>Alerts</NavItem>
                <NavItem to="/devices" icon={FiMonitor}>Devices</NavItem>
                <NavItem to="/settings" icon={FiSettings}>Settings</NavItem>
                <NavItem to="/history" icon={FiArchive}>History</NavItem>
                <NavItem to="/rooms" icon={FiMap}>Rooms/Map</NavItem>
              </nav>
              <ThemeToggle dark={dark} setDark={setDark} />
            </div>
          </header>
          <main className="max-w-6xl mx-auto px-5 py-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/devices" element={<Devices />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/history" element={<History />} />
              <Route path="/rooms" element={<RoomsMap />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </ToastProvider>
  );
}

function ThemeToggle({ dark, setDark }) {
  return (
    <button onClick={() => setDark(d => !d)}>
      {dark ? <FiMoon /> : <FiSun />}
    </button>
  );
}
