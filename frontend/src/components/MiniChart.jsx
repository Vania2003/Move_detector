import React from "react";

// values — массив от 0 до 1, интерпретируется как интенсивность
export default function MiniChart({ values = [], height = 32, color = "indigo" }) {
  return (
    <svg width={values.length * 6} height={height}>
      {values.map((v, i) => (
        <rect
          key={i}
          x={i * 6}
          y={height - v * height}
          width={5}
          height={v * height}
          rx={2}
          fill={`var(--tw-color-${color}-400, #6366f1)`}
        />
      ))}
    </svg>
  );
}
