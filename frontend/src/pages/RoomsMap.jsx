import React from "react";
import { FiActivity, FiMapPin } from "react-icons/fi";

const MOCK_EVENTS = {
  bedroom: [
    { ts: "22:31:41", text: "Motion" },
    { ts: "21:54:03", text: "Motion" },
    { ts: "20:12:18", text: "Motion" },
  ],
  kitchen: [{ ts: "19:43:10", text: "Motion" }],
};

function LegendItem({ colorClass, label }) {
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
      <span className={`inline-block w-3 h-3 rounded ${colorClass}`} />
      {label}
    </div>
  );
}

export default function RoomsMap({ onSelect, title = "Rooms activity" }) {
  const [rooms, setRooms] = React.useState([]);
  const [eventsByRoom, setEventsByRoom] = React.useState({});
  const [active, setActive] = React.useState(null);

  React.useEffect(() => {
    // Загрузка списка комнат
    fetch("/api/rooms")
      .then((res) => res.json())
      .then((data) => setRooms(data))
      .catch((err) => console.error("Failed to fetch rooms:", err));

    // Загрузка событий
    fetch("/api/events/recent")
      .then((res) => res.json())
      .then((data) => setEventsByRoom(data))
      .catch(() => {});
  }, []);

  const activeRoom = rooms.find((r) => r.key === active);

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Карта */}
      <div className="card relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.12] dark:opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(99,102,241,.65) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          <FiActivity className="text-indigo-400" />
          {title}
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/60 backdrop-blur p-3">
          <svg
            viewBox="0 0 320 190"
            className="w-full h-[260px] sm:h-[300px]"
            aria-label="Rooms scheme"
          >
            <defs>
              <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.25" />
              </filter>
              <linearGradient id="activeStroke" x1="0" x2="1">
                <stop offset="0%" stopColor="#818CF8" />
                <stop offset="100%" stopColor="#22D3EE" />
              </linearGradient>
            </defs>

            {rooms.map((r) => {
              const isActive = active === r.key;
              const motionColor =
                r.motionsToday > 5
                  ? "#22c55e"
                  : r.motionsToday > 0
                  ? "#84cc16"
                  : "#9ca3af";

              return (
                <g
                  key={r.key}
                  onMouseEnter={() => setActive(r.key)}
                  onMouseLeave={() => setActive(null)}
                  onClick={() => {
                    setActive(r.key);
                    onSelect?.(r.key);
                  }}
                  style={{ cursor: "pointer", transition: "all .25s ease" }}
                >
                  {isActive && (
                    <rect
                      x={r.x - 5}
                      y={r.y - 5}
                      width={r.w + 10}
                      height={r.h + 10}
                      rx={16}
                      fill="url(#activeStroke)"
                      opacity="0.15"
                    />
                  )}
                  <rect
                    x={r.x}
                    y={r.y}
                    width={r.w}
                    height={r.h}
                    rx={14}
                    fill={`url(#grad-${r.key})`}
                    stroke={isActive ? "url(#activeStroke)" : "rgba(82,82,91,0.7)"}
                    strokeWidth={isActive ? 2.5 : 1.2}
                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.35))"
                    style={{ transition: "all .3s ease" }}
                  />
                  <defs>
                    <linearGradient id={`grad-${r.key}`} x1="0" x2="1" y1="0" y2="1">
                      <stop offset="0%" stopColor={r.color} />
                      <stop offset="100%" stopColor="#ffffff15" />
                    </linearGradient>
                  </defs>

                  <text
                    x={r.x + r.w / 2}
                    y={r.y + r.h / 2 - 2}
                    alignmentBaseline="middle"
                    textAnchor="middle"
                    fontWeight="700"
                    fontSize="15"
                    fill="#111"
                    style={{
                      pointerEvents: "none",
                      userSelect: "none",
                      filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.3))",
                    }}
                  >
                    {r.name}
                  </text>

                  <g transform={`translate(${r.x + r.w - 12}, ${r.y + 14})`}>
                    <circle r="10" fill={motionColor} opacity="0.15" />
                    <text
                      fontSize="11"
                      fontWeight="700"
                      textAnchor="middle"
                      alignmentBaseline="middle"
                      fill={motionColor}
                    >
                      {r.motionsToday}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>

          <div className="mt-3 flex items-center gap-4">
            <LegendItem colorClass="bg-indigo-500" label="Selected room" />
            <LegendItem colorClass="bg-emerald-500" label="Motions count" />
          </div>
        </div>
      </div>

      {/* Правая панель с деталями */}
      <div className="space-y-3">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/60 backdrop-blur p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            <FiMapPin className="text-indigo-400" />
            {activeRoom ? activeRoom.name : "Select a room"}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="detail-card">
              <div className="label">Motions today</div>
              <div className="value">
                {activeRoom ? activeRoom.motionsToday : "—"}
              </div>
            </div>
            <div className="detail-card">
              <div className="label">Status</div>
              <div className="value">
                {activeRoom ? (activeRoom.active ? "Active" : "Idle") : "—"}
              </div>
            </div>
          </div>

          {!activeRoom && (
            <div className="mt-2 text-xs text-zinc-500">
              Hover or click a room on the map to see details.
            </div>
          )}
        </div>

        {/* Недавние события */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 recent-events">
          <div className="text-sm font-semibold text-zinc-300 mb-2">
            Recent events
          </div>
          {activeRoom ? (
            <ul className="list-disc ml-5 text-sm text-zinc-700 dark:text-zinc-300">
              {(eventsByRoom[activeRoom.key] || []).map((e, i) => (
                <li key={i}>
                  <span className="font-medium">{e.text}</span> at {e.ts}
                </li>
              ))}
              {!(eventsByRoom[activeRoom.key] || []).length && (
                <li className="text-zinc-500">No recent events.</li>
              )}
            </ul>
          ) : (
            <div className="text-xs text-zinc-500">Pick a room to see the feed.</div>
          )}
        </div>
      </div>
    </section>
  );
}
