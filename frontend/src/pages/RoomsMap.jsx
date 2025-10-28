import React from "react";
import { FiActivity, FiMapPin, FiHome, FiClock } from "react-icons/fi";

// Если придут реальные данные — прокидывай rooms и events через пропсы.
// Пока здесь аккуратный мок, чтобы выглядело «как живое».
const MOCK_ROOMS = [
  { key: "kitchen",  name: "Kitchen",  x: 16,  y: 22,  w: 120, h: 82,  color: "#CFF7C8", motionsToday: 4,  active: true  },
  { key: "bedroom",  name: "Bedroom",  x: 162, y: 22,  w: 140, h: 82,  color: "#FFE9B8", motionsToday: 8,  active: true  },
  { key: "bath",     name: "Bathroom", x: 16,  y: 120, w: 78,  h: 44,  color: "#CFEAFF", motionsToday: 1,  active: true  },
  { key: "hallway",  name: "Hallway",  x: 100, y: 120, w: 76,  h: 44,  color: "#ECECEC", motionsToday: 0,  active: false },
  { key: "living",   name: "Living",   x: 184, y: 120, w: 118, h: 44,  color: "#FFD9EA", motionsToday: 2,  active: true  },
];

// Эвенты для правой панели (могут прийти из /api/motion_events?room=...)
const MOCK_EVENTS = {
  bedroom: [
    { ts: "22:31:41", text: "Motion" },
    { ts: "21:54:03", text: "Motion" },
    { ts: "20:12:18", text: "Motion" },
  ],
  kitchen: [
    { ts: "19:43:10", text: "Motion" },
  ],
};

function LegendItem({ colorClass, label }) {
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
      <span className={`inline-block w-3 h-3 rounded ${colorClass}`} />
      {label}
    </div>
  );
}

export default function RoomsMap({
  rooms = MOCK_ROOMS,
  eventsByRoom = MOCK_EVENTS,
  onSelect, // optional callback(roomKey)
  title = "Rooms activity",
}) {
  const [active, setActive] = React.useState(null);

  const activeRoom = rooms.find(r => r.key === active);

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Карта */}
      <div className="card relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.12] dark:opacity-20 pointer-events-none"
             style={{
               backgroundImage:
                 "radial-gradient(circle at 1px 1px, rgba(99,102,241,.65) 1px, transparent 0)",
               backgroundSize: "22px 22px"
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
            {/* Градиенты и тени */}
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
              return (
                <g
                  key={r.key}
                  onMouseEnter={() => setActive(r.key)}
                  onMouseLeave={() => setActive(null)}
                  onClick={() => {
                    setActive(r.key);
                    onSelect?.(r.key);
                  }}
                  style={{ cursor: "pointer", transition: "all .2s ease" }}
                >
                  {/* Подсветка при hover/active */}
                  <rect
                    x={r.x - 3}
                    y={r.y - 3}
                    width={r.w + 6}
                    height={r.h + 6}
                    rx={12}
                    fill={isActive ? "url(#activeStroke)" : "transparent"}
                    opacity={isActive ? 0.15 : 0}
                  />
                  {/* Корпус комнаты */}
                  <rect
                    x={r.x}
                    y={r.y}
                    width={r.w}
                    height={r.h}
                    rx={12}
                    fill={r.color}
                    filter="url(#softShadow)"
                    stroke={isActive ? "url(#activeStroke)" : (r.active ? "#334155" : "#3f3f46")}
                    strokeWidth={isActive ? 3.2 : 2}
                    opacity={r.active ? 1 : 0.65}
                  />
                  {/* Название */}
                  <text
                    x={r.x + r.w / 2}
                    y={r.y + r.h / 2 - 4}
                    alignmentBaseline="middle"
                    textAnchor="middle"
                    fontWeight="700"
                    fontSize="15"
                    fill="#1f2937"
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {r.name}
                  </text>
                  {/* Счётчик */}
                  <g transform={`translate(${r.x + r.w - 16}, ${r.y + r.h - 16})`}>
                    <circle r="10" fill="#10B981" opacity="0.15" />
                    <text
                      fontSize="11"
                      fontWeight="700"
                      textAnchor="middle"
                      alignmentBaseline="middle"
                      fill="#10B981"
                    >
                      {r.motionsToday}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>

          {/* Легенда */}
          <div className="mt-3 flex items-center gap-4">
            <LegendItem colorClass="bg-indigo-500" label="Active (hover/click)" />
            <LegendItem colorClass="bg-emerald-500" label="Motions count" />
          </div>
        </div>
      </div>

      {/* Правая панель с деталями */}
      <div className="space-y-3">
        {/* Карточка выбранной комнаты */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/60 backdrop-blur p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            <FiMapPin className="text-indigo-400" />
            {activeRoom ? activeRoom.name : "Select a room"}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="detail-card">
              <div className="label">Motions today</div>
              <div className="value">{activeRoom ? activeRoom.motionsToday : "—"}</div>
            </div>
            <div className="detail-card">
              <div className="label">Status</div>
              <div className="value">
                {activeRoom
                  ? (activeRoom.active ? "Active" : "Idle")
                  : "—"}
              </div>
            </div>
          </div>

          {!activeRoom && (
            <div className="mt-2 text-xs text-zinc-500">
              Hover or click a room on the map to see details.
            </div>
          )}
        </div>

        {/* Мини-heatline (заглушка под будущий heatmap) */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-950/50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            <FiClock className="text-indigo-400" />
            Last 24h (prototype)
          </div>
          <div className="mt-3 h-16 w-full rounded-md bg-gradient-to-r from-indigo-200/40 to-indigo-400/25 dark:from-indigo-300/10 dark:to-indigo-500/10" />
        </div>

        {/* Недавние события */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-950/50 p-4">
          <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-2">
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
