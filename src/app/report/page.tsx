"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Lightbulb, Printer, RotateCcw, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadarChart } from "@/components/radar-chart";
import { ReportShareButton } from "@/components/report-share-button";
import {
  clearInterviewProgress,
  getLatestValidSession,
  getSessionById,
  saveInterviewConfig,
} from "@/lib/storage";
import { getInterviewLabel, getQuestionsForRole } from "@/lib/roles";
import { getDimensionDefs } from "@/lib/score";
import type { InterviewSession } from "@/lib/types";
import {
  computePersonalStats,
  loadAnalytics,
  markReportShared,
  trackAnalytics,
  type PersonalStats,
} from "@/lib/analytics";

export default function ReportPage() {
  const router = useRouter();
  const [session, setSession] = React.useState<InterviewSession | null>(null);
  const [checking, setChecking] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");
  const [personalStats, setPersonalStats] =
    React.useState<PersonalStats | null>(null);
  const reportedRef = React.useRef(false);

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
    if (!reportedRef.current) {
      reportedRef.current = true;
      trackAnalytics({
        type: "report_viewed",
        score: target.report.totalScore,
        didShare: false,
      });
    }
    setPersonalStats(computePersonalStats(loadAnalytics()));
    setChecking(false);
  }, [router]);

  React.useEffect(() => {
    let previousOpenState: boolean[] = [];

    const openDetailsBeforePrint = () => {
      const details = Array.from(
        document.querySelectorAll<HTMLDetailsElement>("details"),
      );
      previousOpenState = details.map((element) => element.open);
      details.forEach((element) => {
        element.open = true;
      });
    };

    const restoreDetailsAfterPrint = () => {
      document
        .querySelectorAll<HTMLDetailsElement>("details")
        .forEach((element, index) => {
          element.open = previousOpenState[index] ?? false;
        });
    };

    window.addEventListener("beforeprint", openDetailsBeforePrint);
    window.addEventListener("afterprint", restoreDetailsAfterPrint);

    return () => {
      window.removeEventListener("beforeprint", openDetailsBeforePrint);
      window.removeEventListener("afterprint", restoreDetailsAfterPrint);
    };
  }, []);

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
  const activeSession = session;
  const improvements = report.improvementSuggestions ?? [];
  const perQuestion = report.perQuestion ?? [];
  const dimensionItems = getDimensionDefs(session.role).map((definition) => ({
    key: definition.key,
    label: definition.label,
    score: report.dimensionScores[definition.key]?.score ?? 0,
  }));

  const createdAt = new Date(session.createdAt).toLocaleString("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const weakestDefinition =
    getDimensionDefs(session.role).find(
      (definition) => definition.key === report.weakestDimension,
    ) ?? [...getDimensionDefs(session.role)].sort(
      (a, b) =>
        (report.dimensionScores[a.key]?.score ?? 0) -
        (report.dimensionScores[b.key]?.score ?? 0),
    )[0];

  function beginPractice(questions: InterviewSession["questions"]): void {
    const baselineAnswers = Object.fromEntries(
      perQuestion
        .filter((item) => item.userAnswer)
        .map((item) => [item.questionId, item.userAnswer ?? ""]),
    );
    trackAnalytics({
      type: "targeted_practice_start",
      sourceSessionId: activeSession.id,
      practiceGoal: weakestDefinition.label,
    });
    clearInterviewProgress();
    saveInterviewConfig({
      role: activeSession.role,
      questionCount: questions.length,
      questions,
      startedAt: new Date().toISOString(),
      mode: "practice",
      practiceGoal: weakestDefinition.label,
      sourceSessionId: activeSession.id,
      baselineAnswers,
      customInterviewTitle: activeSession.customInterviewTitle,
    });
    router.push("/interview");
  }

  function startWeaknessDrill(): void {
    const lowScoreQuestions = [...perQuestion]
      .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
      .map((review) =>
        activeSession.questions.find((question) => question.id === review.questionId),
      )
      .filter((question): question is InterviewSession["questions"][number] =>
        Boolean(question),
      );
    const fallback = activeSession.role === "custom"
      ? activeSession.questions
      : getQuestionsForRole(activeSession.role, 5, { avoidRecent: true });
    const unique = [...lowScoreQuestions, ...fallback].filter(
      (question, index, items) =>
        items.findIndex((item) => item.id === question.id) === index,
    );
    beginPractice(unique.slice(0, 5));
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-8">
      <div className="print-hidden mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
          <ArrowLeft className="h-4 w-4" />
          返回首页
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            打印 / 导出 PDF
          </Button>
          <Button size="sm" variant="secondary" onClick={() => router.push("/")}>
            <RotateCcw className="h-4 w-4" />
            再练一次
          </Button>
          <Button size="sm" onClick={startWeaknessDrill}>
            <Target className="h-4 w-4" />
            弱项再练 5 题
          </Button>
          <ReportShareButton
            session={session}
            onShared={() => markReportShared()}
          />
        </div>
      </div>

      {personalStats && (
        <Card className="mb-6 print-hidden">
          <CardHeader>
            <CardTitle>我的面试统计</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
              {[
                { label: "完成场次", value: String(personalStats.interviewCompletes) },
                {
                  label: "面试完成率",
                  value: `${Math.round(personalStats.completionRate * 100)}%`,
                },
                {
                  label: "平均面试时长",
                  value: `${personalStats.avgDurationMin.toFixed(1)} 分钟`,
                },
                {
                  label: "语音使用率",
                  value: `${Math.round(personalStats.voiceRate * 100)}%`,
                },
                {
                  label: "7天内完成场次",
                  value: String(personalStats.last7DaysCompletes),
                },
                { label: "平均得分", value: String(personalStats.avgScore) },
                {
                  label: "针对性复练",
                  value: `${personalStats.targetedCompletes}/${personalStats.targetedStarts}`,
                },
                {
                  label: "复练完成率",
                  value: `${Math.round(personalStats.targetedCompletionRate * 100)}%`,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl bg-white/5 px-4 py-3 text-center"
                >
                  <div className="text-xl font-semibold text-blue-300">
                    {item.value}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{item.label}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              统计仅保存在本机浏览器，不会上传到服务器。
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6 overflow-hidden">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-xs text-blue-300">
                <Sparkles className="h-3.5 w-3.5" />
                面试报告
              </div>
              <h1 className="text-3xl font-bold text-white">
                {getInterviewLabel(session.role, session.customInterviewTitle)} · {session.questionCount} 题
              </h1>
              <p className="mt-2 text-sm text-slate-400">{createdAt}</p>
            </div>
            <div className="text-center">
              <div className="text-6xl font-bold tracking-tight text-blue-400">
                {report.totalScore}
              </div>
              <div className="mt-1 text-sm text-slate-400">综合得分</div>
              {report.scoreBand && (
                <div className="mt-2 rounded-full bg-blue-500/10 px-3 py-1 text-xs text-blue-200">
                  {report.scoreBand}
                </div>
              )}
            </div>
          </div>

          <p className="mt-6 rounded-xl bg-white/5 px-4 py-3 text-sm leading-6 text-slate-300">
            {report.overallFeedback}
          </p>
          <div className="mt-3 flex flex-col gap-2 text-xs leading-5 text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>{report.disclaimer ?? "本报告用于模拟练习，不代表真实招聘结论。"}</span>
            <details className="shrink-0">
              <summary className="cursor-pointer text-blue-300">评分方法</summary>
              <p className="mt-2 max-w-xl rounded-lg bg-slate-950/60 p-3 text-left text-slate-400">
                rubric-v2：0–39 核心缺失，40–59 明显不足，60–74 基本合格，75–89 表现良好，90–100 表现突出。评分优先依据本场原回答；样本不足时应降低可信度。
              </p>
            </details>
          </div>
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
            const dimension = report.dimensionScores[item.key] ?? {
              score: 0,
              comment: "该维度暂无评分数据",
            };

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
                  {dimension.evidence && (
                    <p className="mt-2 rounded-lg bg-slate-950/50 px-3 py-2 text-xs leading-5 text-slate-500">
                      证据：{dimension.evidence}
                    </p>
                  )}
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
          {report.weeklyGoals && report.weeklyGoals.length > 0 && (
            <div className="mt-5 rounded-xl border border-blue-400/20 bg-blue-500/10 p-4">
              <div className="font-medium text-blue-100">本周训练目标</div>
              <ul className="mt-2 space-y-2 text-sm leading-6 text-blue-100/75">
                {report.weeklyGoals.map((goal) => (
                  <li key={goal}>• {goal}</li>
                ))}
              </ul>
            </div>
          )}
          <Button className="mt-2 w-full" size="lg" onClick={startWeaknessDrill}>
            <Target className="h-4 w-4" />
            针对“{weakestDefinition.label}”再练 5 题
          </Button>
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
                      <div className="print-hidden mt-1 text-xs text-slate-500">
                        点击展开详情
                      </div>
                    </div>
                  </div>
                  {typeof item.score === "number" && (
                    <div className="shrink-0 text-right">
                      <div className="text-lg font-semibold text-blue-300">{item.score}</div>
                      <div className="text-xs text-slate-500">本题表现</div>
                    </div>
                  )}
                </div>
              </summary>
              <div className="space-y-4 border-t border-white/10 px-5 py-4">
                {item.userAnswer && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-300">你的原回答</div>
                    <p className="whitespace-pre-wrap rounded-lg bg-slate-950/60 px-3 py-2 text-sm leading-6 text-slate-400">
                      {item.userAnswer}
                    </p>
                  </div>
                )}
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
                {item.evidence && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-blue-300">判断依据</div>
                    <p className="text-sm leading-6 text-slate-300">{item.evidence}</p>
                  </div>
                )}
                {item.improvedAnswer && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-emerald-300">不虚构经历的改写示例</div>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
                      {item.improvedAnswer}
                    </p>
                  </div>
                )}
                <div>
                  <div className="mb-1 text-xs font-medium text-violet-300">参考思路</div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-400">
                    {item.referenceAnswer}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const question = session.questions.find(
                      (candidate) => candidate.id === item.questionId,
                    );
                    if (question) beginPractice([question]);
                  }}
                >
                  立即重答这道题
                </Button>
              </div>
            </details>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
