import React from "react";

// Мокаем статусы и счётчики (в продакшене брать из API)
const ROOMS = [
  { name: "Kitchen",   key: "kitchen",   color: "#c7f7be", x: 20,  y: 40, w: 90, h: 65, count: 4 },
  { name: "Bathroom",  key: "bathroom",  color: "#a8e6ff", x: 20, y: 110, w: 60, h: 37, count: 1 },
  { name: "Bedroom",   key: "bedroom",   color: "#fee6ba", x: 140, y: 40, w: 110, h: 65, count: 8 },
  { name: "Living",    key: "living",    color: "#ffd6ea", x: 140, y: 110, w: 75, h: 37, count: 2 },
  { name: "Hallway",   key: "hallway",   color: "#ebebeb", x: 80, y: 110, w: 55, h: 37, count: 0 }
];

// Можно принимать активную комнату как проп или локальный стейт
export default function RoomsMap() {
  const [active, setActive] = React.useState(null);

  return (
    <div className="space-y-6 flex flex-col md:flex-row items-center md:items-stretch">
      <svg width="280" height="170" viewBox="0 0 280 170" className="border border-zinc-300 dark:border-zinc-700 rounded-xl shadow"
        style={{ background: "#f6f6fa" }}>
        {ROOMS.map(room => (
          <g key={room.key}
            onClick={() => setActive(room.key)}
            onMouseEnter={() => setActive(room.key)}
            onMouseLeave={() => setActive(null)}
            style={{ cursor: "pointer" }}
          >
            <rect
              x={room.x} y={room.y} width={room.w} height={room.h} rx={10}
              fill={active === room.key ? "#6366f1" : room.color}
              stroke="#334155"
              strokeWidth={active === room.key ? 4 : 2}
              opacity={room.count > 0 ? 1 : 0.6}
            />
            <text
              x={room.x + room.w / 2}
              y={room.y + room.h / 2}
              alignmentBaseline="middle"
              textAnchor="middle"
              fontWeight="bold"
              fontSize="15"
              fill={active === room.key ? "#fff" : "#374151"}
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {room.name}
            </text>
            {/* Счётчик активности в углу */}
            <text
              x={room.x + room.w - 13}
              y={room.y + room.h - 10}
              fontSize="13"
              fill={room.count > 0 ? "#10b981" : "#7f8b99"}
              fontWeight={room.count > 0 ? "bold" : "normal"}>
              {room.count > 0 ? room.count : ""}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex-1 text-zinc-700 dark:text-zinc-200 pl-0 md:pl-10 pt-4 md:pt-0">
        <h2 className="font-bold text-lg mb-3">Rooms map & activity</h2>
        {active
          ? (
            <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-700 max-w-xs">
              <span className="font-bold">{ROOMS.find(r => r.key === active).name}</span><br/>
              Motions: <b>{ROOMS.find(r => r.key === active).count}</b>
              <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">Click anywhere to reset</div>
            </div>
          )
          : <div className="p-3 text-zinc-400">Hover/click room to see activity.<br/>Live data & heatmap — soon.</div>
        }
      </div>
    </div>
  );
}
