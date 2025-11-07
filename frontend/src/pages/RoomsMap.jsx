// src/pages/RoomsMap.jsx
import React from "react";
import { FiActivity, FiMapPin } from "react-icons/fi";

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
    // Загружаем комнаты
    fetch("http://192.168.0.48:5000/api/rooms", {
      headers: { "X-API-Key": "iotkey" },
    })
      .then((res) => res.json())
      .then((data) => {
        const mapped = data
          .filter((r) => r.room)
          .map((r, i) => ({
            key: r.room.toLowerCase().replace(/\s/g, "_"),
            name: r.room,
            motionsToday: 0,
            x: 40 + (i % 2) * 150,
            y: 40 + Math.floor(i / 2) * 100,
            w: 120,
            h: 70,
          }));
        setRooms(mapped);
      })
      .catch((err) => console.error("Failed to fetch rooms:", err));

    // Загружаем события
    fetch("http://192.168.0.48:5000/api/events/recent", {
      headers: { "X-API-Key": "iotkey" },
    })
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
          className="absolute inset-0 opacity-[0.08] dark:opacity-15 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(99,102,241,.5) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          <FiActivity className="text-indigo-400" />
          {title}
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/50 backdrop-blur p-3">
          <svg
            viewBox={`0 0 400 ${Math.ceil(rooms.length / 2) * 100 + 60}`}
            className="w-full h-auto min-h-[280px]"
            aria-label="Rooms scheme"
          >
            {rooms.map((r, i) => {
              const isActive = active === r.key;
              const motionCount = eventsByRoom[r.key]?.length || r.motionsToday || 0;

              // рассчитываем координаты динамически
              const x = 40 + (i % 2) * 160;
              const y = 20 + Math.floor(i / 2) * 90;

              return (
                <g
                  key={r.key}
                  onMouseEnter={() => setActive(r.key)}
                  onMouseLeave={() => setActive(null)}
                  onClick={() => {
                    setActive(r.key);
                    onSelect?.(r.key);
                  }}
                  style={{
                    cursor: "pointer",
                    transition: "all .25s ease",
                  }}
                >
                  {/* фон плитки */}
                  <rect
                    x={x}
                    y={y}
                    width={r.w}
                    height={r.h}
                    rx={16}
                    fill={isActive ? "url(#gradActive)" : "url(#gradNeutral)"}
                    stroke={
                      isActive
                        ? "url(#strokeActive)"
                        : "rgba(255,255,255,0.08)"
                    }
                    strokeWidth={isActive ? 3 : 1.2}
                    style={{
                      filter: isActive
                        ? "drop-shadow(0 0 8px rgba(99,102,241,0.45))"
                        : "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
                    }}
                  />

                  {/* название комнаты */}
                  <text
                    x={x + r.w / 2}
                    y={y + r.h / 2 + 4}
                    alignmentBaseline="middle"
                    textAnchor="middle"
                    fontWeight="700"
                    fontSize="15"
                    fill="#e5e7eb"
                    style={{
                      pointerEvents: "none",
                      userSelect: "none",
                    }}
                  >
                    {r.name}
                  </text>

                  {/* кружок с цифрой */}
                  <g transform={`translate(${x + r.w - 12}, ${y + 14})`}>
                    <circle r="10" fill="#3b82f6" opacity="0.25" />
                    <text
                      fontSize="11"
                      fontWeight="700"
                      textAnchor="middle"
                      alignmentBaseline="middle"
                      fill="#60a5fa"
                    >
                      {motionCount}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Градиенты */}
            <defs>
              <linearGradient id="gradNeutral" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="#27272a" />
                <stop offset="100%" stopColor="#18181b" />
              </linearGradient>
              <linearGradient id="gradActive" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="#4f46e5" />
                <stop offset="100%" stopColor="#0ea5e9" />
              </linearGradient>
              <linearGradient id="strokeActive" x1="0" x2="1">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
          </svg>


          <div className="mt-3 flex items-center gap-4 text-xs text-zinc-400">
            <LegendItem colorClass="bg-blue-500/30" label="Motions today" />
            <LegendItem colorClass="bg-indigo-500/40" label="Selected room" />
          </div>
        </div>
      </div>

      {/* Панель справа */}
      <div className="space-y-3">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/50 backdrop-blur p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            <FiMapPin className="text-indigo-400" />
            {activeRoom ? activeRoom.name : "Select a room"}
          </div>

          <div className="mt-2 grid grid-cols-1 gap-2">
            <div className="detail-card">
              <div className="label">Motions today</div>
              <div className="value">
                {activeRoom ? activeRoom.motionsToday : "—"}
              </div>
            </div>
          </div>

          {!activeRoom && (
            <div className="mt-2 text-xs text-zinc-500">
              Hover or click a room on the map to see details.
            </div>
          )}
        </div>

        {/* События */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/50 backdrop-blur p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            Recent events
          </div>
          {activeRoom ? (
            <ul className="list-disc ml-5 text-sm text-zinc-700 dark:text-zinc-300">
            {(eventsByRoom[activeRoom.key] || []).map((e, i) => {
              const formattedTs = e.ts?.replace("T", " ") || e.ts; // убираем "T"
              return (
                <li key={i}>
                  <span className="font-medium">{e.text}</span> at {formattedTs}
                </li>
              );
            })}
          </ul>
          ) : (
            <div className="text-xs text-zinc-500">
              Pick a room to see the feed.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
