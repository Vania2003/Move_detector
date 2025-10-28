const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';
const TOKEN = import.meta.env.VITE_API_TOKEN || '';

const authHeaders = () => ({
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
});

export async function apiGet(path, { json = true } = {}) {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return json ? res.json() : res.text();
}

export async function apiPut(path, bodyObj) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(bodyObj ?? {}),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function apiPost(path, bodyObj) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      ...(bodyObj ? { 'Content-Type': 'application/json' } : {}),
      ...authHeaders(),
    },
    body: bodyObj ? JSON.stringify(bodyObj) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export function apiBase() { return BASE; }
export function apiToken() { return TOKEN; }
