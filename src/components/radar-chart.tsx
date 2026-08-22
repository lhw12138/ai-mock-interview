"use client";

import * as React from "react";

export interface RadarDatum {
  label: string;
  score: number;
}

interface RadarChartProps {
  data: RadarDatum[];
  size?: number;
}

function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number,
): { x: number; y: number } {
  const angle = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

export function RadarChart({ data, size = 320 }: RadarChartProps) {
  const center = size / 2;
  const radius = size * 0.31;
  const levels = [20, 40, 60, 80, 100];
  const angleStep = 360 / Math.max(data.length, 1);

  const points = data.map((datum, index) => {
    const score = Math.min(100, Math.max(0, datum.score));
    return polarToCartesian(center, center, (radius * score) / 100, index * angleStep);
  });
  const polygonPoints = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="mx-auto w-full max-w-md">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="五维评分雷达图"
        className="h-auto w-full"
      >
        {levels.map((level) => {
          const ringRadius = (radius * level) / 100;
          const ringPoints = data
            .map((_, index) => {
              const point = polarToCartesian(center, center, ringRadius, index * angleStep);
              return `${point.x},${point.y}`;
            })
            .join(" ");

          return (
            <polygon
              key={level}
              points={ringPoints}
              fill="none"
              stroke="rgba(148, 163, 184, 0.22)"
              strokeWidth="1"
            />
          );
        })}

        {data.map((datum, index) => {
          const point = polarToCartesian(center, center, radius, index * angleStep);
          return (
            <line
              key={datum.label}
              x1={center}
              y1={center}
              x2={point.x}
              y2={point.y}
              stroke="rgba(148, 163, 184, 0.22)"
              strokeWidth="1"
            />
          );
        })}

        <polygon
          points={polygonPoints}
          fill="rgba(59, 130, 246, 0.22)"
          stroke="#3b82f6"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {points.map((point, index) => (
          <circle key={data[index].label} cx={point.x} cy={point.y} r="4" fill="#8b5cf6" />
        ))}

        {data.map((datum, index) => {
          const labelPoint = polarToCartesian(center, center, radius + 30, index * angleStep);
          return (
            <text
              key={datum.label}
              x={labelPoint.x}
              y={labelPoint.y}
              fill="#cbd5e1"
              fontSize="13"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {datum.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
