"use client";

import * as React from "react";
import type { InterviewSession } from "@/lib/types";

function formatShortDate(value: string): string {
  return new Date(value).toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
  });
}

export function TrendChart({ sessions }: { sessions: InterviewSession[] }) {
  const ordered = React.useMemo(
    () =>
      [...sessions]
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        )
        .slice(-8),
    [sessions],
  );

  if (ordered.length < 2) {
    return (
      <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-10 text-center text-sm text-slate-500">
        完成两次以上面试后，这里会显示你的分数趋势。
      </div>
    );
  }

  const width = 640;
  const height = 240;
  const paddingX = 40;
  const paddingTop = 24;
  const paddingBottom = 34;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingTop - paddingBottom;
  const scores = ordered.map((session) => session.report.totalScore);
  const minScore = Math.max(0, Math.min(...scores) - 8);
  const maxScore = Math.min(100, Math.max(...scores) + 8);
  const range = Math.max(1, maxScore - minScore);

  const points = ordered.map((session, index) => {
    const x = paddingX + (index / Math.max(1, ordered.length - 1)) * chartWidth;
    const y =
      paddingTop +
      chartHeight -
      ((session.report.totalScore - minScore) / range) * chartHeight;
    return { x, y, session };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${
    paddingTop + chartHeight
  } L ${points[0].x} ${paddingTop + chartHeight} Z`;

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/40 p-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="历史面试分数趋势"
        className="h-auto w-full"
      >
        <defs>
          <linearGradient id="trend-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>

        <line
          x1={paddingX}
          y1={paddingTop + chartHeight}
          x2={width - paddingX}
          y2={paddingTop + chartHeight}
          stroke="rgba(148,163,184,0.25)"
          strokeWidth="1"
        />

        <path d={areaPath} fill="url(#trend-area)" />
        <path
          d={linePath}
          fill="none"
          stroke="#60a5fa"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((point) => (
          <g key={point.session.id}>
            <circle
              cx={point.x}
              cy={point.y}
              r="5"
              fill="#0b1020"
              stroke="#60a5fa"
              strokeWidth="3"
            />
            <text
              x={point.x}
              y={point.y - 14}
              textAnchor="middle"
              fill="#cbd5e1"
              fontSize="14"
            >
              {point.session.report.totalScore}
            </text>
            <text
              x={point.x}
              y={paddingTop + chartHeight + 22}
              textAnchor="middle"
              fill="#64748b"
              fontSize="12"
            >
              {formatShortDate(point.session.createdAt)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
