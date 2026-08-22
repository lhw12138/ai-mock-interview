"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BriefcaseBusiness,
  History,
  Mic,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getQuestionsForRole, ROLE_OPTIONS } from "@/lib/roles";
import { clearInterviewConfig, saveInterviewConfig } from "@/lib/storage";
import type { RoleKey } from "@/lib/types";
import { cn } from "@/lib/utils";

const QUESTION_COUNTS = [5, 8, 10] as const;

export default function HomePage() {
  const router = useRouter();
  const [role, setRole] = React.useState<RoleKey>("ai_pm");
  const [questionCount, setQuestionCount] = React.useState<number>(8);
  const [isStarting, setIsStarting] = React.useState(false);

  React.useEffect(() => {
    clearInterviewConfig();
  }, []);

  function handleStart() {
    if (isStarting) return;
    setIsStarting(true);

    const questions = getQuestionsForRole(role, questionCount);
    saveInterviewConfig({
      role,
      questionCount,
      questions,
      startedAt: new Date().toISOString(),
    });

    router.push("/interview");
  }

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-5 py-12">
      <Button
        variant="ghost"
        size="sm"
        className="absolute right-5 top-5"
        onClick={() => router.push("/history")}
      >
        <History className="h-4 w-4" />
        历史记录
      </Button>

      <div className="mb-10 text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-sm text-blue-300">
          <Sparkles className="h-4 w-4" />
          面向产品经理的 AI 面试练习
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
          AI 面试模拟助手
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-400">
          选择目标岗位和题数，即可开始一场沉浸式面试。支持语音或文字作答，结束后获得五维能力评分与逐题改进建议。
        </p>
      </div>

      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle>开始一场面试</CardTitle>
          <CardDescription>不注册、不登录，打开网页即可使用。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <section>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-300">
              <BriefcaseBusiness className="h-4 w-4 text-blue-400" />
              选择目标岗位
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {ROLE_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setRole(option.key)}
                  className={cn(
                    "rounded-xl border px-5 py-4 text-left transition-colors",
                    role === option.key
                      ? "border-blue-500 bg-blue-500/15 text-white"
                      : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
                  )}
                >
                  <div className="text-base font-semibold">{option.label}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {option.key === "ai_pm" ? "大模型应用 + 通用产品题" : "通用产品经理高频题"}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 text-sm font-medium text-slate-300">题目数量</div>
            <div className="grid grid-cols-3 gap-3">
              {QUESTION_COUNTS.map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setQuestionCount(count)}
                  className={cn(
                    "rounded-xl border px-4 py-3 text-center transition-colors",
                    questionCount === count
                      ? "border-violet-500 bg-violet-500/15 text-white"
                      : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
                  )}
                >
                  <span className="block text-xl font-semibold">{count}</span>
                  <span className="mt-1 block text-xs text-slate-400">道题</span>
                </button>
              ))}
            </div>
          </section>

          <Button size="lg" className="w-full" onClick={handleStart} disabled={isStarting}>
            {isStarting ? "正在准备题目…" : "开始面试"}
            <ArrowRight className="h-4 w-4" />
          </Button>

          <p className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <Mic className="h-3.5 w-3.5" />
            建议使用 Chrome / Edge 获得最佳语音识别体验
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
