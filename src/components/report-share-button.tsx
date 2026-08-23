"use client";

import * as React from "react";
import { Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRoleLabel } from "@/lib/roles";
import { getDimensionDefs } from "@/lib/score";
import type { InterviewSession } from "@/lib/types";

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function ReportShareButton({ session }: { session: InterviewSession }) {
  const [sharing, setSharing] = React.useState(false);

  async function renderPoster(): Promise<Blob | null> {
    const canvas = document.createElement("canvas");
    const width = 1080;
    const height = 1440;
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return null;

    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#0b1020");
    gradient.addColorStop(0.55, "#111433");
    gradient.addColorStop(1, "#1e1b4b");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    context.fillStyle = "rgba(59, 130, 246, 0.18)";
    context.beginPath();
    context.arc(900, 210, 280, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "rgba(139, 92, 246, 0.15)";
    context.beginPath();
    context.arc(180, 1120, 260, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#93c5fd";
    context.font = "600 34px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    context.fillText("AI 面试模拟报告", 80, 120);

    context.fillStyle = "#e2e8f0";
    context.font = "500 28px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    context.fillText(
      `${getRoleLabel(session.role)} · ${session.questionCount} 题`,
      80,
      170,
    );

    context.fillStyle = "#94a3b8";
    context.font = "400 24px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    context.fillText(formatDate(session.createdAt), 80, 218);

    context.textAlign = "center";
    context.fillStyle = "#60a5fa";
    context.font = "700 150px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    context.fillText(String(session.report.totalScore), width / 2, 430);

    context.fillStyle = "#cbd5e1";
    context.font = "500 28px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    context.fillText("综合得分", width / 2, 490);
    context.textAlign = "left";

    let y = 600;
    getDimensionDefs(session.role).forEach((dimension) => {
      const score = session.report.dimensionScores[dimension.key]?.score ?? 0;
      const clamped = Math.max(0, Math.min(100, score));

      context.fillStyle = "#e2e8f0";
      context.font = "500 28px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      context.fillText(dimension.label, 90, y + 34);

      context.textAlign = "right";
      context.fillStyle = "#a78bfa";
      context.font = "700 28px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      context.fillText(String(score), width - 90, y + 34);
      context.textAlign = "left";

      const barX = 90;
      const barY = y + 58;
      const barWidth = width - 180;
      const barHeight = 18;

      context.fillStyle = "rgba(255, 255, 255, 0.08)";
      roundRect(context, barX, barY, barWidth, barHeight, 9);
      context.fill();

      const fillWidth = (barWidth * clamped) / 100;
      const barGradient = context.createLinearGradient(barX, 0, barX + barWidth, 0);
      barGradient.addColorStop(0, "#3b82f6");
      barGradient.addColorStop(1, "#8b5cf6");
      context.fillStyle = barGradient;
      roundRect(context, barX, barY, Math.max(fillWidth, 12), barHeight, 9);
      context.fill();

      y += 112;
    });

    context.fillStyle = "#64748b";
    context.font = "400 24px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    context.fillText("来自 AI 面试模拟助手", 80, 1320);
    context.fillText("ai-mock-interview-nu-flax.vercel.app", 80, 1360);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  }

  async function handleShare(): Promise<void> {
    if (sharing) return;
    setSharing(true);

    try {
      const blob = await renderPoster();
      if (!blob) throw new Error("海报生成失败");

      const file = new File([blob], "ai-interview-report.png", {
        type: "image/png",
      });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "AI 面试模拟报告",
          text: `我在 AI 面试模拟助手获得 ${session.report.totalScore} 分`,
          files: [file],
        });
        return;
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "ai-interview-report.png";
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setSharing(false);
    }
  }

  return (
    <Button onClick={handleShare} disabled={sharing}>
      {sharing ? (
        <>
          <Download className="h-4 w-4 animate-pulse" />
          正在生成…
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" />
          生成分享海报
        </>
      )}
    </Button>
  );
}
