"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Lightbulb, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadarChart } from "@/components/radar-chart";
import { getLatestValidSession, getSessionById } from "@/lib/storage";
import { getRoleLabel } from "@/lib/roles";
import type { InterviewSession } from "@/lib/types";

export default function ReportPage() {
  const router = useRouter();
  const [session, setSession] = React.useState<InterviewSession | null>(null);
  const [checking, setChecking] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const target = id ? getSessionById(id) : getLatestValidSession();

    if (!target) {
      setLoadError("未找到有效的面试报告，请返回首页重新开始一次面试。");
      setChecking(false);
      return;
    }
    setSession(target);
    setChecking(false);
  }, [router]);

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-400">
        正在读取面试报告…
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-center">
          <div className="mb-3 text-slate-200">{loadError || "未找到面试报告。"}</div>
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500"
            onClick={() => router.push("/")}
          >
            返回首页
          </button>
        </div>
      </main>
    );
  }

  const { report } = session;
  const improvements = report.improvementSuggestions ?? [];
  const perQuestion = report.perQuestion ?? [];
  const dimensionItems = [
    { key: "logic", label: "逻辑思维", score: report.dimensionScores.logic.score },
    { key: "productSense", label: "产品 sense", score: report.dimensionScores.productSense.score },
    { key: "communication", label: "表达沟通", score: report.dimensionScores.communication.score },
    { key: "aiUnderstanding", label: "AI 理解力", score: report.dimensionScores.aiUnderstanding.score },
    { key: "adaptability", label: "应变能力", score: report.dimensionScores.adaptability.score },
  ];

  const createdAt = new Date(session.createdAt).toLocaleString("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
          <ArrowLeft className="h-4 w-4" />
          返回首页
        </Button>
        <Button size="sm" variant="secondary" onClick={() => router.push("/")}>
          <RotateCcw className="h-4 w-4" />
          再练一次
        </Button>
      </div>

      <Card className="mb-6 overflow-hidden">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-xs text-blue-300">
                <Sparkles className="h-3.5 w-3.5" />
                面试报告
              </div>
              <h1 className="text-3xl font-bold text-white">
                {getRoleLabel(session.role)} · {session.questionCount} 题
              </h1>
              <p className="mt-2 text-sm text-slate-400">{createdAt}</p>
            </div>
            <div className="text-center">
              <div className="text-6xl font-bold tracking-tight text-blue-400">
                {report.totalScore}
              </div>
              <div className="mt-1 text-sm text-slate-400">综合得分</div>
            </div>
          </div>

          <p className="mt-6 rounded-xl bg-white/5 px-4 py-3 text-sm leading-6 text-slate-300">
            {report.overallFeedback}
          </p>
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>五维能力雷达</CardTitle>
          </CardHeader>
          <CardContent>
            <RadarChart data={dimensionItems} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          {dimensionItems.map((item) => {
            const dimension =
              report.dimensionScores[
                item.key as keyof typeof report.dimensionScores
              ];

            return (
              <Card key={item.key}>
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="font-medium text-slate-200">{item.label}</div>
                    <div className="text-lg font-semibold text-violet-300">
                      {item.score}
                    </div>
                  </div>
                  <p className="text-sm leading-6 text-slate-400">{dimension.comment}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-300" />
            <CardTitle>改进建议</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {improvements.map((suggestion, index) => (
            <div
              key={index}
              className="flex items-start gap-3 rounded-xl bg-white/5 px-4 py-3 text-sm leading-6 text-slate-300"
            >
              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-blue-400" />
              <span>{suggestion}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>逐题回顾</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {perQuestion.map((item, index) => (
            <details
              key={item.questionId}
              className="group rounded-xl border border-white/10 bg-slate-950/40"
            >
              <summary className="cursor-pointer list-none px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs text-slate-300">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-slate-200">{item.question}</div>
                      <div className="mt-1 text-xs text-slate-500">点击展开详情</div>
                    </div>
                  </div>
                </div>
              </summary>
              <div className="space-y-4 border-t border-white/10 px-5 py-4">
                <div>
                  <div className="mb-1 text-xs font-medium text-blue-300">回答摘要</div>
                  <p className="text-sm leading-6 text-slate-300">{item.answerSummary}</p>
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-emerald-300">亮点</div>
                  <p className="text-sm leading-6 text-slate-300">{item.strengths}</p>
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-amber-300">不足</div>
                  <p className="text-sm leading-6 text-slate-300">{item.weaknesses}</p>
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-violet-300">参考思路</div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-400">
                    {item.referenceAnswer}
                  </p>
                </div>
              </div>
            </details>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
