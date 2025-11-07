const BASE  = import.meta.env.VITE_API_BASE  || 'http://localhost:5000';
const TOKEN = import.meta.env.VITE_API_TOKEN || '';

function authHeaders() {
  const h = {};
  if (TOKEN) {
    h['Authorization'] = `Bearer ${TOKEN}`;
    h['X-API-Key'] = TOKEN;
  }
  return h;
}

async function handle(res, expectJson = true) {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}${text ? ` — ${text}` : ''}`);
  }
  return expectJson ? res.json() : res.text();
}

export async function apiGet(path, { json = true } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { ...authHeaders() },
  });
  return handle(res, json);
}

export async function apiPost(path, bodyObj) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      ...(bodyObj ? { 'Content-Type': 'application/json' } : {}),
    },
    body: bodyObj ? JSON.stringify(bodyObj) : undefined,
  });
  return handle(res, true);
}

export async function apiPut(path, bodyObj) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(bodyObj ?? {}),
  });
  return handle(res, true);
}

export async function apiDelete(path) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  });
  return handle(res, true);
}

export function apiBase()  { return BASE; }
export function apiToken() { return TOKEN; }
