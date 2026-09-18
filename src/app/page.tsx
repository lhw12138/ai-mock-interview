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
  Upload,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  getQuestionsForRole,
  ROLE_OPTIONS,
  UPCOMING_ROLE_OPTIONS,
} from "@/lib/roles";
import {
  clearAllLocalData,
  clearInterviewConfig,
  clearInterviewProgress,
  exportLocalData,
  importLocalData,
  isApiKeyRemembered,
  loadInterviewProgress,
  loadModelConfig,
  saveInterviewConfig,
  saveModelConfig,
} from "@/lib/storage";
import type { ModelConfig, RoleKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import { trackAnalytics } from "@/lib/analytics";

const QUESTION_COUNTS = [5, 8, 10] as const;
const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
const MAX_RESUME_LENGTH = 30000;
const MAX_JD_LENGTH = 12000;
const DEFAULT_MODEL_CONFIG: ModelConfig = {
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-flash",
  apiKey: "",
};
const MODEL_PRESETS = {
  deepseek: {
    label: "DeepSeek（站方默认）",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-flash",
  },
  zhipu: {
    label: "智谱 GLM-4.5-Flash（免费·稳定）",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4.5-flash",
  },
} as const;
type ModelPresetKey = keyof typeof MODEL_PRESETS | "custom";

interface HomeApiPayload {
  ok?: boolean;
  error?: string;
  text?: string;
  truncated?: boolean;
  questions?: Array<{ question: string; category?: string; answer?: string }>;
}

async function readApiJson(response: Response): Promise<HomeApiPayload> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(response.ok ? "服务器返回了空响应，请重试。" : "服务暂时没有响应，请稍后重试。");
  }
  try {
    return JSON.parse(text) as HomeApiPayload;
  } catch {
    throw new Error("服务器响应格式异常，请稍后重试。");
  }
}

function isDeepSeekService(baseUrl: string): boolean {
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    return hostname === "api.deepseek.com" || hostname.endsWith(".deepseek.com");
  } catch {
    return false;
  }
}

export default function HomePage() {
  const router = useRouter();
  const [setupKind, setSetupKind] = React.useState<"preset" | "custom">("preset");
  const [role, setRole] = React.useState<RoleKey>("ai_pm");
  const [questionCount, setQuestionCount] = React.useState<number>(8);
  const [avoidRecent, setAvoidRecent] = React.useState(false);
  const [isStarting, setIsStarting] = React.useState(false);
  const [resume, setResume] = React.useState("");
  const [difficulty, setDifficulty] = React.useState<
    "basic" | "intermediate" | "advanced"
  >("intermediate");
  const [mode, setMode] = React.useState<"practice" | "simulation">("practice");
  const [seniority, setSeniority] = React.useState<"junior" | "mid" | "senior">("mid");
  const [interviewRound, setInterviewRound] = React.useState<
    "screening" | "professional" | "final"
  >("professional");
  const [jobDescription, setJobDescription] = React.useState("");
  const [customTitle, setCustomTitle] = React.useState("");
  const [customContext, setCustomContext] = React.useState("");
  const [questionBank, setQuestionBank] = React.useState("");
  const [uploadingField, setUploadingField] = React.useState<"resume" | "questionBank" | null>(null);
  const [modelConfig, setModelConfig] =
    React.useState<ModelConfig>(DEFAULT_MODEL_CONFIG);
  const [startError, setStartError] = React.useState("");
  const [rememberApiKey, setRememberApiKey] = React.useState(false);
  const [hasRecoverableInterview, setHasRecoverableInterview] =
    React.useState(false);
  const [modelTest, setModelTest] = React.useState<{
    status: "idle" | "testing" | "ok" | "fail";
    message: string;
  }>({ status: "idle", message: "" });
  const startLockedRef = React.useRef(false);
  const customTitleRef = React.useRef<HTMLInputElement>(null);
  const questionBankRef = React.useRef<HTMLTextAreaElement>(null);
  const modelTestLockedRef = React.useRef(false);
  const savedModelConfigRef = React.useRef<ModelConfig | null>(null);
  const savedKeyRememberedRef = React.useRef(false);

  async function handleDocumentUpload(
    event: React.ChangeEvent<HTMLInputElement>,
    field: "resume" | "questionBank",
  ): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadingField(field);
    setStartError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/document-text", { method: "POST", body: form });
      const payload = await readApiJson(response);
      if (!response.ok || typeof payload.text !== "string") {
        throw new Error(payload.error || "文件解析失败。");
      }
      if (field === "resume") setResume(payload.text.slice(0, MAX_RESUME_LENGTH));
      else setQuestionBank(payload.text.slice(0, 60000));
      if (payload.truncated) setStartError("文件内容较长，已保留前 6 万字。请检查后再开始。");
    } catch (error) {
      setStartError(error instanceof Error ? error.message : "文件解析失败。");
    } finally {
      setUploadingField(null);
    }
  }

  React.useEffect(() => {
    trackAnalytics({ type: "landing_view" });
    const saved = loadModelConfig();
    savedModelConfigRef.current = saved;
    savedKeyRememberedRef.current = isApiKeyRemembered();
    // 新打开首页始终使用站方 DeepSeek。历史配置只有在用户主动
    // 切换服务商时才恢复，避免无提示地用上次的智谱或自定义模型。
    setModelConfig(DEFAULT_MODEL_CONFIG);
    setRememberApiKey(false);
    setHasRecoverableInterview(Boolean(loadInterviewProgress()));
  }, []);

  function resetModelConfig(): void {
    setModelConfig(DEFAULT_MODEL_CONFIG);
    setRememberApiKey(false);
    savedModelConfigRef.current = null;
    savedKeyRememberedRef.current = false;
    saveModelConfig(DEFAULT_MODEL_CONFIG, { rememberApiKey: false });
  }

  function discardRecoverableInterview(): void {
    clearInterviewProgress();
    clearInterviewConfig();
    setHasRecoverableInterview(false);
  }

  function downloadLocalData(): void {
    const blob = new Blob([exportLocalData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ai-interview-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function clearDeviceData(): void {
    if (!window.confirm("确定清除本机的面试记录、题库、收藏和模型配置吗？此操作无法撤销。")) {
      return;
    }
    clearAllLocalData();
    setModelConfig(DEFAULT_MODEL_CONFIG);
    setRememberApiKey(false);
    setHasRecoverableInterview(false);
  }

  async function importDeviceData(
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) {
        throw new Error("备份文件过大");
      }
      const result = importLocalData(await file.text());
      window.alert(
        `导入完成：${result.sessions} 场面试、${result.bookmarks} 个收藏、${result.customQuestions} 道自定义题。`,
      );
    } catch {
      window.alert("导入失败：请选择由本产品导出的 JSON 备份文件。");
    } finally {
      event.target.value = "";
    }
  }

  function applyModelPreset(preset: ModelPresetKey): void {
    if (preset === "custom") {
      const saved = savedModelConfigRef.current;
      const savedIsCustom =
        saved &&
        !Object.values(MODEL_PRESETS).some(
          (item) =>
            item.baseUrl === saved.baseUrl && item.model === saved.model,
        );
      setModelConfig(
        savedIsCustom
          ? saved
          : { baseUrl: "", model: "", apiKey: "" },
      );
      setRememberApiKey(
        Boolean(savedIsCustom && savedKeyRememberedRef.current && saved.apiKey),
      );
      setModelTest({ status: "idle", message: "" });
      return;
    }
    const presetValue = MODEL_PRESETS[preset];
    const saved = savedModelConfigRef.current;
    const canRestoreSavedKey =
      preset === "zhipu" &&
      saved?.baseUrl === presetValue.baseUrl &&
      saved.model === presetValue.model;
    setModelConfig({
      baseUrl: presetValue.baseUrl,
      model: presetValue.model,
      apiKey: canRestoreSavedKey ? saved.apiKey : "",
    });
    setRememberApiKey(
      Boolean(canRestoreSavedKey && savedKeyRememberedRef.current && saved.apiKey),
    );
    setModelTest({ status: "idle", message: "" });
  }

  async function handleTestModel() {
    if (modelTestLockedRef.current) return;
    modelTestLockedRef.current = true;
    setModelTest({ status: "testing", message: "" });
    try {
      const response = await fetch("/api/model-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelConfig }),
      });
      const payload = await readApiJson(response);
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
      trackAnalytics({
        type: "service_error",
        stage: "model_test",
        code: "network",
      });
      setModelTest({
        status: "fail",
        message: "无法连接服务器，请稍后重试。",
      });
    } finally {
      modelTestLockedRef.current = false;
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
    if (startLockedRef.current) return;
    if (!isDeepSeekService(modelConfig.baseUrl) && !modelConfig.apiKey.trim()) {
      setStartError(
        "当前选择的服务商需要 API Key。请填写后再开始，或切回 DeepSeek（站方默认）。",
      );
      return;
    }
    if (setupKind === "custom" && customTitle.trim().length < 2) {
      setStartError("请填写至少 2 个字的自定义面试名称。");
      customTitleRef.current?.focus();
      return;
    }
    if (setupKind === "custom" && questionBank.trim().length < 10) {
      setStartError("请粘贴或上传至少 10 个字的题库内容。");
      questionBankRef.current?.focus();
      return;
    }
    if (
      hasRecoverableInterview &&
      !window.confirm("开始新面试会替换尚未完成的上一场，确定继续吗？")
    ) {
      return;
    }
    startLockedRef.current = true;
    setIsStarting(true);
    setStartError("");

    try {
      const activeRole: RoleKey = setupKind === "custom" ? "custom" : role;
      let questions = getQuestionsForRole(activeRole, questionCount, { avoidRecent });
      const trimmedResume = resume.trim();
      const trimmedJobDescription = jobDescription.trim();

      if (setupKind === "custom") {
        const response = await fetch("/api/custom-interview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: customTitle.trim(),
            context: customContext.trim(),
            resume: trimmedResume,
            questionBank: questionBank.trim(),
            questionCount,
            difficulty,
            modelConfig,
          }),
        });
        const payload = await readApiJson(response);
        if (!response.ok || !Array.isArray(payload.questions)) {
          throw new Error(payload.error || "自定义面试准备失败。");
        }
        questions = payload.questions.map(
          (item: { question: string; category?: string; answer?: string }, index: number) => ({
            id: Date.now() + index,
            question: item.question,
            category: item.category || "自定义题库",
            answer: item.answer || "",
          }),
        );
      } else if (trimmedResume || trimmedJobDescription) {
        const response = await fetch("/api/resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role,
            resume: trimmedResume,
            jobDescription: trimmedJobDescription,
            seniority,
            interviewRound,
            difficulty,
            modelConfig,
          }),
        });
        const payload = await readApiJson(response);

        if (!response.ok || !Array.isArray(payload.questions)) {
          throw new Error(payload.error || "简历针对性问题生成失败。");
        }

        const resumeQuestions = payload.questions.map(
          (item: { question: string; category?: string; answer?: string }, index: number) => ({
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

      clearInterviewProgress();
      saveInterviewConfig({
        role: activeRole,
        questionCount,
        questions,
        startedAt: new Date().toISOString(),
        resume: trimmedResume || undefined,
        jobDescription: trimmedJobDescription || undefined,
        mode,
        seniority,
        interviewRound,
        modelConfig,
        customInterviewTitle: setupKind === "custom" ? customTitle.trim() : undefined,
        customInterviewContext: setupKind === "custom" ? customContext.trim() || undefined : undefined,
      });
      saveModelConfig(modelConfig, { rememberApiKey });
      trackAnalytics({
        type: "interview_start",
        role: activeRole,
        questionCount,
        mode,
      });
      router.push("/interview");
    } catch (error) {
      trackAnalytics({
        type: "service_error",
        stage: "interview_prepare",
        code: error instanceof TypeError ? "network" : "provider",
      });
      const message =
        error instanceof Error ? error.message : "面试准备失败，请重试。";
      setStartError(message);
      setIsStarting(false);
      startLockedRef.current = false;
    }
  }

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-5 py-12">
      <div className="absolute inset-x-4 top-4 flex flex-wrap items-center justify-end gap-1 sm:left-auto sm:right-5 sm:top-5 sm:gap-2">
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
          从岗位题库开始，或上传自己的材料模拟任意面试。支持语音或文字作答，结束后获得多维评分与逐题建议。
        </p>
      </div>

      {hasRecoverableInterview && (
        <div className="mb-5 flex w-full max-w-3xl flex-col gap-3 rounded-2xl border border-blue-400/30 bg-blue-500/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-medium text-blue-100">上次面试还没有完成</div>
            <p className="mt-1 text-sm text-blue-200/70">
              题号、对话和草稿都已保存在这台设备上。
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={discardRecoverableInterview}>
              放弃本场
            </Button>
            <Button size="sm" onClick={() => router.push("/interview")}>
              继续面试
            </Button>
          </div>
        </div>
      )}

      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle>开始一场面试</CardTitle>
          <CardDescription>不注册、不登录，打开网页即可使用。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <section>
            <div className="mb-3 text-sm font-medium text-slate-300">选择面试类型</div>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ["preset", "岗位面试", "从 8 个岗位题库快速开始"],
                ["custom", "自定义面试", "题库为主，结合个人材料动态追问"],
              ] as const).map(([value, label, description]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSetupKind(value)}
                  aria-pressed={setupKind === value}
                  className={cn(
                    "rounded-xl border px-5 py-4 text-left transition-colors",
                    setupKind === value
                      ? "border-blue-500 bg-blue-500/15 text-white"
                      : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
                  )}
                >
                  <span className="block text-base font-semibold">{label}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-400">{description}</span>
                </button>
              ))}
            </div>
          </section>

          {setupKind === "preset" ? (
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
                  aria-pressed={role === option.key}
                  className={cn(
                    "rounded-xl border px-5 py-4 text-left transition-colors",
                    role === option.key
                      ? "border-blue-500 bg-blue-500/15 text-white"
                      : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
                  )}
                >
                  <div className="text-base font-semibold">{option.label}</div>
                  <div className="mt-1 text-xs text-slate-400">{option.description}</div>
                </button>
              ))}
              {UPCOMING_ROLE_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  disabled
                  aria-disabled="true"
                  className="cursor-not-allowed rounded-xl border border-dashed border-white/10 bg-white/[0.025] px-5 py-4 text-left text-slate-500"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-base font-semibold">{option.label}</span>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-500">
                      即将上线
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{option.description}</div>
                </button>
              ))}
            </div>
          </section>
          ) : (
            <section className="space-y-4 rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] p-4 sm:p-5">
              <div>
                <h2 className="text-base font-semibold text-white">定义这场面试</h2>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  适用于研究生复试、工作答辩、跨岗位面试或任何自备题库的场景。
                </p>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-300">面试名称</span>
                <input
                  ref={customTitleRef}
                  value={customTitle}
                  onChange={(event) => setCustomTitle(event.target.value)}
                  maxLength={80}
                  required
                  aria-required="true"
                  aria-invalid={Boolean(startError && customTitle.trim().length < 2)}
                  aria-describedby="custom-interview-title-help"
                  placeholder="例如：人工智能专业研究生复试"
                  className="h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm text-slate-200 placeholder:text-slate-400"
                />
                <span id="custom-interview-title-help" className="mt-1 block text-xs text-slate-400">用于面试页、报告和历史记录中识别本场练习。</span>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-300">面试要求或背景 <span className="font-normal text-slate-500">可选</span></span>
                <Textarea
                  value={customContext}
                  onChange={(event) => setCustomContext(event.target.value)}
                  maxLength={4000}
                  placeholder="例如：重点考察科研动机、项目复盘与英文表达；回答控制在 2 分钟内。"
                />
              </label>
            </section>
          )}

          <section>
            <div className="mb-3 text-sm font-medium text-slate-300">练习方式</div>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ["practice", "练习模式", "可暂停、修改回答，适合打磨表达"],
                ["simulation", "模拟模式", "连续作答，结束后统一复盘"],
              ] as const).map(([value, label, description]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  aria-pressed={mode === value}
                  className={cn(
                    "rounded-xl border px-4 py-3 text-left transition-colors",
                    mode === value
                      ? "border-emerald-500 bg-emerald-500/10 text-white"
                      : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
                  )}
                >
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-400">{description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-sm font-medium text-slate-300">目标职级</span>
              <select value={seniority} onChange={(event) => setSeniority(event.target.value as typeof seniority)} className="h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm text-slate-200">
                <option value="junior">初级 / 0–2 年</option>
                <option value="mid">中级 / 3–5 年</option>
                <option value="senior">高级 / 5 年以上</option>
              </select>
            </label>
            <label>
              <span className="mb-1 block text-sm font-medium text-slate-300">面试轮次</span>
              <select value={interviewRound} onChange={(event) => setInterviewRound(event.target.value as typeof interviewRound)} className="h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm text-slate-200">
                <option value="screening">初筛 / 基础匹配</option>
                <option value="professional">专业面 / 能力深挖</option>
                <option value="final">终面 / 综合判断</option>
              </select>
            </label>
          </section>

          <section>
            <div className="mb-3 text-sm font-medium text-slate-300">题目数量</div>
            <div className="grid grid-cols-3 gap-3">
              {QUESTION_COUNTS.map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setQuestionCount(count)}
                  aria-pressed={questionCount === count}
                  className={cn(
                    "rounded-xl border px-4 py-3 text-center transition-colors",
                    questionCount === count
                      ? "border-violet-500 bg-violet-500/15 text-white"
                      : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
                  )}
                >
                  <span className="block text-xl font-semibold">{count}</span>
                  <span className="mt-1 block text-xs text-slate-400">
                    道题 · 约 {Math.round(count * 2.5)} 分钟
                  </span>
                </button>
              ))}
            </div>
          </section>

          {setupKind === "preset" && (
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
          )}

          <section>
            <div className="mb-3 text-sm font-medium text-slate-300">
              {setupKind === "custom" ? "面试材料" : "简历针对性提问"}
              <span className="ml-2 text-xs font-normal text-slate-500">可选</span>
            </div>
            <label className="mb-3 block">
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
            </label>
            <Textarea
              value={resume}
              onChange={(event) => setResume(event.target.value)}
              maxLength={MAX_RESUME_LENGTH}
              placeholder={setupKind === "custom" ? "粘贴简历、个人陈述、答辩材料或其他背景资料。" : "粘贴简历内容或关键经历，例如：3年AI产品经验，负责过RAG知识库产品。"}
              aria-label="简历内容或关键经历"
            />
            {setupKind === "custom" && (
              <label className="mt-2 inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-slate-300 hover:bg-white/10 focus-within:ring-2 focus-within:ring-blue-500/70">
                <Upload className="h-4 w-4" />
                {uploadingField === "resume" ? "正在读取…" : "上传 PDF / DOCX"}
                <input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" disabled={uploadingField !== null} onChange={(event) => void handleDocumentUpload(event, "resume")} />
              </label>
            )}
            <p className="mt-2 text-xs leading-5 text-slate-400">
              内容会临时发送给你选择的模型服务商，用于选题和动态追问，不写入面试历史。请先删除身份证号、电话等无关敏感信息。
            </p>
            {setupKind === "preset" && <Textarea
              className="mt-3"
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              maxLength={MAX_JD_LENGTH}
              placeholder="可选：粘贴目标岗位 JD，AI 会据此调整问题重点和追问方向。"
              aria-label="目标岗位 JD"
            />}
          </section>

          {setupKind === "custom" && (
            <section>
              <div className="mb-3 text-sm font-medium text-slate-300">
                自定义题库 <span className="ml-2 text-xs font-normal text-red-300">必填</span>
              </div>
              <Textarea
                ref={questionBankRef}
                value={questionBank}
                onChange={(event) => setQuestionBank(event.target.value)}
                maxLength={60000}
                required
                aria-required="true"
                aria-invalid={Boolean(startError && questionBank.trim().length < 10)}
                aria-describedby="custom-question-bank-help"
                className="min-h-48"
                placeholder={"粘贴题目、参考答案或考察要点。\n例如：\n1. 为什么选择这个研究方向？\n2. 请介绍最有挑战的项目，以及你如何解决问题。"}
                aria-label="自定义面试题库"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-slate-300 hover:bg-white/10 focus-within:ring-2 focus-within:ring-blue-500/70">
                  <Upload className="h-4 w-4" />
                  {uploadingField === "questionBank" ? "正在读取…" : "上传 PDF / DOCX"}
                  <input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" disabled={uploadingField !== null} onChange={(event) => void handleDocumentUpload(event, "questionBank")} />
                </label>
                <span className="text-xs text-slate-400">{questionBank.length.toLocaleString()} / 60,000 字</span>
              </div>
              <p id="custom-question-bank-help" className="mt-2 text-xs leading-5 text-slate-400">
                AI 会以题库为主选出本场问题，再根据你的回答和个人材料进行最多两轮追问。
              </p>
            </section>
          )}

          <section>
            <details className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <summary className="cursor-pointer list-none text-sm font-medium text-slate-200">
                高级设置
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
                    <option value="zhipu">智谱 GLM-4.5-Flash（有免费额度）</option>
                    <option value="custom">自定义</option>
                  </select>
                  <span className="mt-1 block text-xs text-slate-500">
                    每次打开首页都默认使用 DeepSeek。智谱提供免费额度，但仍需申请并填写 API Key；只有主动切换服务商后才会使用其他模型。
                  </span>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-400">
                    API 地址
                  </span>
                  <input
                    value={modelConfig.baseUrl}
                    maxLength={2048}
                    onChange={(event) =>
                      setModelConfig((config) => ({
                        ...config,
                        baseUrl: event.target.value,
                      }))
                    }
                    placeholder="默认 https://api.deepseek.com"
                    className="h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm text-slate-200 placeholder:text-slate-400"
                  />
                </label>
                <label className="flex items-start gap-3 rounded-lg bg-white/5 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={rememberApiKey}
                    onChange={(event) => setRememberApiKey(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-blue-600"
                  />
                  <span className="text-xs leading-5 text-slate-400">
                    在这台设备上记住 API Key。默认关闭；关闭时 Key 只保留在当前浏览器会话中。
                  </span>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-400">
                    模型名称
                  </span>
                  <input
                    value={modelConfig.model}
                    maxLength={200}
                    onChange={(event) =>
                      setModelConfig((config) => ({
                        ...config,
                        model: event.target.value,
                      }))
                    }
                    list="model-options"
                    placeholder="默认 deepseek-flash"
                    className="h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm text-slate-200 placeholder:text-slate-400"
                  />
                  <datalist id="model-options">
                    <option value="deepseek-flash" />
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
                    maxLength={512}
                    onChange={(event) =>
                      setModelConfig((config) => ({
                        ...config,
                        apiKey: event.target.value,
                      }))
                    }
                    placeholder="sk-..."
                    className="h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm text-slate-200 placeholder:text-slate-400"
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
                  填写后，调用会通过服务器转发给模型服务商，服务器不主动记录 Key；建议使用专用低配额密钥。自定义服务商必须是公开的 HTTPS 地址并兼容 OpenAI chat/completions 接口。
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={resetModelConfig}>
                    恢复默认
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={downloadLocalData}>
                    导出本机数据
                  </Button>
                  <label className="inline-flex h-9 cursor-pointer items-center rounded-md px-3 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white focus-within:ring-2 focus-within:ring-blue-500/70">
                    导入备份
                    <input type="file" accept="application/json,.json" className="sr-only" onChange={importDeviceData} />
                  </label>
                  <Button type="button" variant="ghost" size="sm" className="text-red-300" onClick={clearDeviceData}>
                    清除本机数据
                  </Button>
                </div>
              </div>
            </details>
          </section>

          {startError && (
            <div role="alert" aria-live="assertive" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {startError}
            </div>
          )}

          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {uploadingField ? `正在读取${uploadingField === "resume" ? "面试材料" : "题库"}` : modelTest.message}
          </div>

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
