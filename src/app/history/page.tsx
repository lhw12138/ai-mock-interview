"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  History,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TrendChart } from "@/components/trend-chart";
import { getRoleLabel } from "@/lib/roles";
import { getValidSessions } from "@/lib/storage";
import type { InterviewSession } from "@/lib/types";

function formatDate(value: string): string {
  return new Date(value).toLocaleString("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = React.useState<InterviewSession[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setSessions(getValidSessions());
    setLoading(false);
  }, []);

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
          <ArrowLeft className="h-4 w-4" />
          返回首页
        </Button>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <History className="h-4 w-4" />
          面试历史
        </div>
      </div>

      <div className="mb-8 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-sm text-blue-300">
          <Sparkles className="h-4 w-4" />
          历史面试记录
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          查看你的成长轨迹
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">
          点击任意一次面试，可以重新查看当时的五维评分和逐题点评。
        </p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400">正在读取历史记录…</div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="px-6 py-16 text-center">
            <div className="mb-3 text-slate-300">还没有面试记录</div>
            <p className="mb-5 text-sm text-slate-500">
              完成一次模拟面试后，报告会自动保存在这里。
            </p>
            <Button onClick={() => router.push("/")}>开始第一次面试</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          <TrendChart sessions={sessions} />

          <div className="space-y-3">
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => router.push(`/report?id=${session.id}`)}
                className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-5 py-4 text-left transition-colors hover:border-blue-500/50 hover:bg-slate-900"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-200">
                      {getRoleLabel(session.role)} · {session.questionCount} 题
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDate(session.createdAt)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <div className="text-right">
                      <div className="text-2xl font-semibold text-blue-400">
                        {session.report.totalScore}
                      </div>
                      <div className="text-xs text-slate-500">综合得分</div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-600" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
