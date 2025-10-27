import React from 'react';

const Ctx = React.createContext({ push: () => {} });

export function ToastProvider({ children }) {
  const [items, setItems] = React.useState([]);
  const push = (type, text) => {
    const id = Math.random().toString(36).slice(2);
    setItems((a) => [...a, { id, type, text }]);
    setTimeout(() => setItems((a) => a.filter((t) => t.id !== id)), 3200);
  };
  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="fixed right-4 bottom-4 space-y-2 z-50">
        {items.map(t => (
          <div key={t.id}
               className={`px-3 py-2 rounded-md text-sm border shadow
                 ${t.type === 'ok'
                   ? 'bg-emerald-900/50 border-emerald-700 text-emerald-100'
                   : 'bg-red-900/50 border-red-700 text-red-100'}`}>
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
export function useToast() { return React.useContext(Ctx); }
