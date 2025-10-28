import React from "react";
import {
  FiActivity,
  FiHeart,
  FiMessageSquare,
  FiDownload,
} from "react-icons/fi";
import { apiGet } from "@/lib/api";
import Spinner from "@/components/Spinner.jsx";

const TABS = [
  { key: "raw", label: "Raw MQTT", icon: FiMessageSquare, endpoint: "/api/messages?limit=1000" },
  { key: "motion", label: "Motion events", icon: FiActivity, endpoint: "/api/motion_events?limit=1000" },
  { key: "hb", label: "Heartbeats", icon: FiHeart, endpoint: "/api/heartbeats?limit=1000" },
];

/* ---------- helpers ---------- */

function parseJSON(s) {
  try { return typeof s === "string" ? JSON.parse(s) : s; } catch { return null; }
}
function parseTopic(topic = "") {
  // iot/eldercare/<room>/<motion>/<state|health>
  const parts = topic.split("/");
  const room = parts[2] || "";
  const motion = parts[3] || "";
  const subtype = parts[4] || "";
  return { room, motion, subtype };
}
function formatAgo(iso) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h) return `${h} h ${m % 60} m ago`;
  if (m) return `${m} m ago`;
  return `${s} s ago`;
}
function fmtUptime(ms) {
  if (ms == null) return null;
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}h ${m}m ${s}s`;
}

function Badge({ children, kind = "neutral", title }) {
  const clsBase =
    "inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium";
  const kinds = {
    neutral: "border-zinc-500/40 text-zinc-300",
    good: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10",
    bad: "border-rose-500/40 text-rose-300 bg-rose-500/10",
    info: "border-indigo-500/40 text-indigo-300 bg-indigo-500/10",
  };
  return (
    <span className={`${clsBase} ${kinds[kind] || kinds.neutral}`} title={title}>
      {children}
    </span>
  );
}

function DetailsCell({ row }) {
  const payloadObj = parseJSON(row.payload);
  const { subtype } = parseTopic(row.topic);

  if (subtype === "state") {
    const mv =
      payloadObj?.motion ??
      (typeof row.motion === "boolean" ? row.motion : undefined);
    return (
      <div className="flex items-center gap-2">
        <span className="text-zinc-400">motion:</span>
        <Badge kind={mv ? "good" : "bad"}>{String(mv)}</Badge>
        {payloadObj?.device && (
          <span className="text-zinc-500">• dev: <span className="text-zinc-300">{payloadObj.device}</span></span>
        )}
      </div>
    );
  }

  if (subtype === "health") {
    const uptime = fmtUptime(payloadObj?.uptime_ms);
    return (
      <div className="flex items-center gap-3">
        <span className="text-zinc-400">uptime:</span>
        <Badge kind="info">{uptime ?? "—"}</Badge>
        {payloadObj?.device && (
          <span className="text-zinc-500">• dev: <span className="text-zinc-300">{payloadObj.device}</span></span>
        )}
      </div>
    );
  }

  const text =
    (payloadObj && Object.keys(payloadObj).length
      ? Object.entries(payloadObj)
          .slice(0, 3)
          .map(([k, v]) => `${k}: ${String(v)}`)
          .join(", ")
      : "—");
  return <span className="text-zinc-300">{text}</span>;
}

/* ---------- main ---------- */

export default function History() {
  const [tab, setTab] = React.useState("raw");
  const [data, setData] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  // filters
  const [q, setQ] = React.useState("");
  const [fDevice, setFDevice] = React.useState("All");
  const [fRoom, setFRoom] = React.useState("All");
  const [fMotion, setFMotion] = React.useState("All");

  const current = TABS.find((t) => t.key === tab);

  React.useEffect(() => {
    let canceled = false;
    setLoading(true);
    apiGet(current.endpoint)
      .then((d) => {
        if (!canceled) setData(Array.isArray(d) ? d : []);
      })
      .finally(() => !canceled && setLoading(false));
    return () => {
      canceled = true;
    };
  }, [tab, current.endpoint]);

  // derive lists
  const allDevices = Array.from(
    new Set(
      data
        .map((r) => parseJSON(r.payload)?.device || "")
        .filter(Boolean)
    )
  ).sort();
  const allRooms = Array.from(
    new Set(data.map((r) => parseTopic(r.topic).room).filter(Boolean))
  ).sort();

  const filtered = data.filter((r) => {
    const payloadObj = parseJSON(r.payload) || {};
    const t = (q || "").toLowerCase().trim();
    const dev = payloadObj.device || "";
    const room = parseTopic(r.topic).room;
    const motion = (() => {
      const v =
        payloadObj.motion ??
        (typeof r.motion === "boolean" ? r.motion : undefined);
      return v === undefined ? "—" : String(v);
    })();

    if (fDevice !== "All" && dev !== fDevice) return false;
    if (fRoom !== "All" && room !== fRoom) return false;
    if (fMotion !== "All" && motion !== fMotion) return false;

    if (!t) return true;
    const hay =
      JSON.stringify(payloadObj).toLowerCase() +
      " " +
      (r.topic || "").toLowerCase() +
      " " +
      (r.ts_utc || "").toLowerCase();
    return hay.includes(t);
  });

  function downloadCSV(rows) {
    if (!rows.length) return;
    const cols = Object.keys(rows[0]);
    const esc = (v) => `"${String(v ?? "").replaceAll(`"`, `""`)}"`;
    const text = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
    const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tab}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-7">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <FiActivity className="text-indigo-400" /> History
      </h1>

      {/* tabs */}
      <div className="flex gap-2 mb-2 border-b border-zinc-200 dark:border-zinc-700">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 font-medium flex items-center gap-2 transition border-b-2
              ${
                tab === t.key
                  ? "border-indigo-500 text-indigo-700 dark:text-indigo-300"
                  : "border-transparent text-zinc-500 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-200"
              }`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="text, device, topic…"
          className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md px-3 py-2 text-sm w-[260px]"
        />
        <Select label="Device" value={fDevice} setValue={setFDevice} options={["All", ...allDevices]} />
        <Select label="Room" value={fRoom} setValue={setFRoom} options={["All", ...allRooms]} />
        <Select label="Motion" value={fMotion} setValue={setFMotion} options={["All", "true", "false", "—"]} />

        <button
          onClick={() => downloadCSV(filtered)}
          disabled={!filtered.length}
          className={`ghost-btn ${!filtered.length ? "opacity-50 cursor-not-allowed" : ""}`}
          title="Export filtered rows"
        >
          <FiDownload /> Export CSV
        </button>
        <span className="text-xs text-zinc-500">{filtered.length} of {data.length} records</span>
      </div>

      {/* table */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-x-auto bg-white dark:bg-zinc-950 shadow">
        {loading ? (
          <div className="p-8 flex justify-center">
            <Spinner size={32} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-zinc-400">Nothing here.</div>
        ) : (
          <table className="min-w-[760px] w-full text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900/60">
              <tr>
                <Th>time</Th>
                <Th>room</Th>
                <Th>device</Th>
                <Th>motion</Th>
                <Th>type</Th>
                <Th>details</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const payloadObj = parseJSON(row.payload) || {};
                const { room, subtype } = parseTopic(row.topic);
                const mv =
                  payloadObj?.motion ??
                  (typeof row.motion === "boolean" ? row.motion : undefined);
                const localTime = row.ts_utc
                  ? new Date(row.ts_utc).toLocaleString()
                  : "—";
                return (
                  <tr key={i} className="border-t border-zinc-100 dark:border-zinc-900/80">
                    <Td>
                      <div className="flex flex-col">
                        <span className="font-mono">{localTime}</span>
                        <span className="text-xs text-zinc-500">{formatAgo(row.ts_utc)}</span>
                      </div>
                    </Td>
                    <Td>
                      {room ? <Badge>{room}</Badge> : <span className="text-zinc-400">—</span>}
                    </Td>
                    <Td>
                      {payloadObj?.device ? (
                        <Badge kind="info">{payloadObj.device}</Badge>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </Td>
                    <Td>
                      {mv === undefined ? (
                        <span className="text-zinc-500">—</span>
                      ) : mv ? (
                        <Badge kind="good">true</Badge>
                      ) : (
                        <Badge kind="bad">false</Badge>
                      )}
                    </Td>
                    <Td>{subtype || row.type || "—"}</Td>
                    <Td>
                      <DetailsCell row={row} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ---------- small UI bits ---------- */

function Select({ label, value, setValue, options }) {
  return (
    <label className="text-sm text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
      <span className="text-zinc-400">{label}</span>
      <select
        className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md px-2 py-1.5 text-sm"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function Th({ children }) {
  return <th className="text-left px-3 py-2 text-zinc-400">{children}</th>;
}
function Td({ children }) {
  return <td className="px-3 py-2 align-top">{children}</td>;
}
