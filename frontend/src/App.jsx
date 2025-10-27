// src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { FiSun, FiMoon } from 'react-icons/fi';

import Dashboard from './pages/Dashboard.jsx';
import Alerts from './pages/Alerts.jsx';
import Devices from './pages/Devices.jsx';
import Settings from './pages/Settings.jsx';
import { ToastProvider } from './components/Toast.jsx';

// Тематическое переключение (dark/light mode)
function ThemeToggle() {
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
    <button onClick={() => setDark(d => !d)}>{dark ? <FiMoon /> : <FiSun />}</button>
  );
}

// Стилизованная навигация
const NavItem = ({ to, children, icon: Icon }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `px-3 py-2 rounded-md text-sm flex items-center gap-1 transition
        ${isActive 
          ? 'bg-indigo-900/70 text-zinc-100 font-semibold' 
          : 'text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100'}`
    }
  >
    {Icon && <Icon size={17} className="mr-1" />} {children}
  </NavLink>
);

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <div className="min-h-screen font-inter">
          {/* Шапка */}
          <header className="border-b border-zinc-800/70 sticky top-0 backdrop-blur bg-black/50 z-30 shadow-lg">
            <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold tracking-wide text-indigo-300">Eldercare</span>
                <span className="hidden sm:inline text-sm text-zinc-500 ml-2 font-medium">Monitoring System</span>
              </div>
              <nav className="flex gap-1">
                <NavItem to="/" icon={FiSun}>Dashboard</NavItem>
                <NavItem to="/alerts" icon={FiMoon}>Alerts</NavItem>
                <NavItem to="/devices" icon={FiSun}>Devices</NavItem>
                <NavItem to="/settings" icon={FiMoon}>Settings</NavItem>
              </nav>
              <ThemeToggle />
            </div>
          </header>

          {/* Контент */}
          <main className="max-w-6xl mx-auto px-5 py-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/devices" element={<Devices />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>

        </div>
      </BrowserRouter>
    </ToastProvider>
  );
}
