export const isUp = (lastHbIso, minutes = 30) => {
  if (!lastHbIso) return false;
  // сервер может прислать 'YYYY-MM-DD HH:MM:SS' — превращаем в ISO
  const t = new Date(String(lastHbIso).replace(' ', 'T'));
  if (isNaN(t.getTime())) return false;
  return (Date.now() - t.getTime()) <= minutes * 60 * 1000;
};

export const timeAgo = (iso) => {
  if (!iso) return '—';
  const d = new Date(String(iso).replace(' ', 'T'));
  if (isNaN(d.getTime())) return '—';
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
};
