import { useEffect } from 'react';

export default function usePolling(fn, ms) {
  useEffect(() => {
    if (!fn) return;
    fn(); // первый запуск сразу
    const id = setInterval(fn, ms > 0 ? ms : 10000);
    return () => clearInterval(id);
  }, [fn, ms]);
}
