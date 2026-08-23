"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bookmark,
  BookOpenText,
  BriefcaseBusiness,
  History,
  Mic,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { getQuestionsForRole, ROLE_OPTIONS } from "@/lib/roles";
import {
  clearInterviewConfig,
  loadModelConfig,
  saveInterviewConfig,
  saveModelConfig,
} from "@/lib/storage";
import type { ModelConfig, RoleKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import { trackAnalytics } from "@/lib/analytics";

const QUESTION_COUNTS = [5, 8, 10] as const;
const DEFAULT_MODEL_CONFIG: ModelConfig = {
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-v4-flash",
  apiKey: "",
};
const MODEL_PRESETS = {
  deepseek: {
    label: "DeepSeek（站方默认）",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-v4-flash",
  },
  zhipu: {
    label: "智谱 GLM-4.5-Flash（免费·稳定）",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4.5-flash",
  },
} as const;
type ModelPresetKey = keyof typeof MODEL_PRESETS | "custom";

export default function HomePage() {
  const router = useRouter();
  const [role, setRole] = React.useState<RoleKey>("ai_pm");
  const [questionCount, setQuestionCount] = React.useState<number>(8);
  const [avoidRecent, setAvoidRecent] = React.useState(false);
  const [isStarting, setIsStarting] = React.useState(false);
  const [resume, setResume] = React.useState("");
  const [difficulty, setDifficulty] = React.useState<
    "basic" | "intermediate" | "advanced"
  >("intermediate");
  const [modelConfig, setModelConfig] =
    React.useState<ModelConfig>(DEFAULT_MODEL_CONFIG);
  const [startError, setStartError] = React.useState("");
  const [modelTest, setModelTest] = React.useState<{
    status: "idle" | "testing" | "ok" | "fail";
    message: string;
  }>({ status: "idle", message: "" });

  React.useEffect(() => {
    clearInterviewConfig();
  }, []);

  React.useEffect(() => {
    const saved = loadModelConfig();
    if (saved) {
      setModelConfig({
        ...DEFAULT_MODEL_CONFIG,
        ...saved,
      });
    }
  }, []);

  function resetModelConfig(): void {
    setModelConfig(DEFAULT_MODEL_CONFIG);
    saveModelConfig(DEFAULT_MODEL_CONFIG);
  }

  function applyModelPreset(preset: ModelPresetKey): void {
    if (preset === "custom") return;
    const presetValue = MODEL_PRESETS[preset];
    setModelConfig((config) => {
      const isSamePreset =
        config.baseUrl === presetValue.baseUrl &&
        config.model === presetValue.model;
      return {
        ...config,
        baseUrl: presetValue.baseUrl,
        model: presetValue.model,
        // 切换服务商时清空旧 Key，避免把 A 家的密钥错发给 B 家
        apiKey: isSamePreset ? config.apiKey : "",
      };
    });
    setModelTest({ status: "idle", message: "" });
  }

  async function handleTestModel() {
    if (modelTest.status === "testing") return;
    setModelTest({ status: "testing", message: "" });
    try {
      const response = await fetch("/api/model-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelConfig }),
      });
      const payload = await response.json();
      if (payload.ok) {
        setModelTest({
          status: "ok",
          message: "连接成功，该配置可以正常使用。",
        });
      } else {
        setModelTest({
          status: "fail",
          message: payload.error || "连接失败，请检查配置。",
        });
      }
    } catch {
      setModelTest({
        status: "fail",
        message: "无法连接服务器，请稍后重试。",
      });
    }
  }

  const currentPreset: ModelPresetKey = (
    Object.keys(MODEL_PRESETS) as ModelPresetKey[]
  ).find(
    (key) =>
      key !== "custom" &&
      MODEL_PRESETS[key as keyof typeof MODEL_PRESETS].baseUrl ===
        modelConfig.baseUrl &&
      MODEL_PRESETS[key as keyof typeof MODEL_PRESETS].model ===
        modelConfig.model,
  ) ?? "custom";

  async function handleStart() {
    if (isStarting) return;
    setIsStarting(true);
    setStartError("");

    try {
      let questions = getQuestionsForRole(role, questionCount, {
        avoidRecent,
      });
      const trimmedResume = resume.trim();

      if (trimmedResume) {
        const response = await fetch("/api/resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role,
            resume: trimmedResume,
            difficulty,
            modelConfig,
          }),
        });
        const payload = await response.json();

        if (!response.ok || !Array.isArray(payload.questions)) {
          throw new Error(payload.error || "简历针对性问题生成失败。");
        }

        const resumeQuestions = payload.questions.map(
          (item: { question: string; category: string; answer: string }, index: number) => ({
            id: Date.now() + index,
            question: item.question,
            category: item.category ?? "简历针对性",
            answer: item.answer ?? "",
          }),
        );
        questions = [
          ...questions.slice(
            0,
            Math.max(0, questionCount - resumeQuestions.length),
          ),
          ...resumeQuestions,
        ];
      }

      saveInterviewConfig({
        role,
        questionCount,
        questions,
        startedAt: new Date().toISOString(),
        resume: trimmedResume || undefined,
        modelConfig,
      });
      saveModelConfig(modelConfig);
      trackAnalytics({
        type: "interview_start",
        role,
        questionCount,
      });
      router.push("/interview");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "面试准备失败，请重试。";
      setStartError(message);
      setIsStarting(false);
    }
  }

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-5 py-12">
      <div className="absolute right-5 top-5 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/question-bank")}
        >
          <BookOpenText className="h-4 w-4" />
          题库
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/bookmarks")}
        >
          <Bookmark className="h-4 w-4" />
          收藏题目
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/history")}
        >
          <History className="h-4 w-4" />
          历史记录
        </Button>
      </div>

      <div className="mb-10 text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-sm text-blue-300">
          <Sparkles className="h-4 w-4" />
          面向求职者的 AI 面试练习
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
          AI 面试模拟助手
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-400">
          选择目标岗位和题数，即可开始一场沉浸式面试。支持语音或文字作答，结束后获得多维能力评分与逐题改进建议。
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
                    {option.key === "ai_pm"
                      ? "大模型应用 + 通用产品题"
                      : option.key === "agent_dev"
                        ? "Agent 架构、工具调用与多 Agent 系统"
                        : option.key === "llm_dev"
                          ? "RAG、Prompt、微调与推理部署"
                          : "通用产品经理高频题"}
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

          <section>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <input
                type="checkbox"
                checked={avoidRecent}
                onChange={(event) => setAvoidRecent(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-blue-600"
              />
              <span>
                <span className="block text-sm text-slate-200">
                  避开最近练过的题目
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  勾选后，同一岗位最近 3 场练过的内置题不会再次出现；不勾选则完全随机。
                </span>
              </span>
            </label>
          </section>

          <section>
            <div className="mb-3 text-sm font-medium text-slate-300">
              简历针对性提问
              <span className="ml-2 text-xs font-normal text-slate-500">可选</span>
            </div>
            <div className="mb-3">
              <span className="mb-1 block text-xs text-slate-400">提问难度</span>
              <select
                value={difficulty}
                onChange={(event) =>
                  setDifficulty(
                    event.target.value as "basic" | "intermediate" | "advanced",
                  )
                }
                className="h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm text-slate-200"
              >
                <option value="basic">基础</option>
                <option value="intermediate">进阶</option>
                <option value="advanced">困难</option>
              </select>
            </div>
            <Textarea
              value={resume}
              onChange={(event) => setResume(event.target.value)}
              placeholder="粘贴简历内容或关键经历，例如：3年AI产品经验，负责过RAG知识库产品。开始面试后会根据难度生成 3 道针对性问题，替换题库末尾 3 道，总题数保持不变。"
            />
          </section>

          <section>
            <details className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <summary className="cursor-pointer list-none text-sm font-medium text-slate-200">
                模型设置
                <span className="ml-2 text-xs font-normal text-slate-500">
                  可选 · 留空则使用站方默认模型
                </span>
              </summary>
              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-400">
                    服务商
                  </span>
                  <select
                    value={currentPreset}
                    onChange={(event) =>
                      applyModelPreset(event.target.value as ModelPresetKey)
                    }
                    className="h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm text-slate-200"
                  >
                    <option value="deepseek">DeepSeek（站方默认）</option>
                    <option value="zhipu">智谱 GLM-4.5-Flash（免费·稳定）</option>
                    <option value="custom">自定义</option>
                  </select>
                  <span className="mt-1 block text-xs text-slate-500">
                    智谱 GLM-4.5-Flash 官方免费、无需绑卡；GLM-4.7-Flash
                    更智能但高峰期限流严重，可在模型名称里手动切换。
                  </span>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-400">
                    API 地址
                  </span>
                  <input
                    value={modelConfig.baseUrl}
                    onChange={(event) =>
                      setModelConfig((config) => ({
                        ...config,
                        baseUrl: event.target.value,
                      }))
                    }
                    placeholder="默认 https://api.deepseek.com"
                    className="h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm text-slate-200 placeholder:text-slate-600"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-400">
                    模型名称
                  </span>
                  <input
                    value={modelConfig.model}
                    onChange={(event) =>
                      setModelConfig((config) => ({
                        ...config,
                        model: event.target.value,
                      }))
                    }
                    list="model-options"
                    placeholder="默认 deepseek-v4-flash"
                    className="h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm text-slate-200 placeholder:text-slate-600"
                  />
                  <datalist id="model-options">
                    <option value="deepseek-v4-flash" />
                    <option value="deepseek-v4-pro" />
                    <option value="deepseek-chat" />
                    <option value="deepseek-reasoner" />
                    <option value="glm-4.5-flash" />
                    <option value="glm-4.7-flash" />
                    <option value="glm-4-flash" />
                  </datalist>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-400">
                    API Key（DeepSeek 可留空用站方密钥；其他服务商必填）
                  </span>
                  <input
                    type="password"
                    value={modelConfig.apiKey}
                    onChange={(event) =>
                      setModelConfig((config) => ({
                        ...config,
                        apiKey: event.target.value,
                      }))
                    }
                    placeholder="sk-..."
                    className="h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm text-slate-200 placeholder:text-slate-600"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTestModel}
                    disabled={modelTest.status === "testing"}
                  >
                    {modelTest.status === "testing" ? "测试中…" : "测试连接"}
                  </Button>
                  {modelTest.status === "ok" && (
                    <span className="text-xs text-emerald-400">
                      {modelTest.message}
                    </span>
                  )}
                  {modelTest.status === "fail" && (
                    <span className="text-xs text-red-400">
                      {modelTest.message}
                    </span>
                  )}
                </div>
                <p className="text-xs leading-5 text-slate-500">
                  填写后，调用时会通过服务器转发给模型服务商，仅用于本次会话，不会写入日志；建议使用专用低配额密钥。自定义服务商需兼容 OpenAI 的 chat/completions 接口，建议先点“测试连接”再开始面试；切换服务商后需重新填写该服务商的 API Key。
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetModelConfig}
                >
                  恢复默认
                </Button>
              </div>
            </details>
          </section>

          {startError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {startError}
            </div>
          )}

          <Button size="lg" className="w-full" onClick={handleStart} disabled={isStarting}>
            {isStarting ? "正在准备面试…" : "开始面试"}
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
