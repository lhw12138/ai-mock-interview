"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { experimental_useObject } from "ai/react";
import {
  ArrowLeft,
  AudioLines,
  Bookmark,
  Loader2,
  Mic,
  MicOff,
  Send,
  SkipForward,
  StopCircle,
  TriangleAlert,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { interviewTurnSchema } from "@/lib/schemas";
import {
  clearInterviewConfig,
  clearInterviewProgress,
  isBookmarked,
  loadInterviewConfig,
  loadInterviewProgress,
  removeBookmark,
  saveBookmark,
  saveInterviewProgress,
  saveSession,
} from "@/lib/storage";
import type {
  AnswerAttempt,
  ChatMessage,
  InterviewConfig,
  InterviewRequest,
  InterviewSession,
  InterviewTurn,
} from "@/lib/types";
import { getInterviewLabel } from "@/lib/roles";
import { cn, createId } from "@/lib/utils";
import { useAsr } from "@/lib/asr/use-asr";
import { trackAnalytics } from "@/lib/analytics";

const DEFAULT_SITE_MODEL = {
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-v4-flash",
  apiKey: "",
};

function restoreUsableModel(config: InterviewConfig): {
  config: InterviewConfig;
  fellBackToDefault: boolean;
} {
  const modelConfig = config.modelConfig;
  if (!modelConfig || modelConfig.apiKey.trim()) {
    return { config, fellBackToDefault: false };
  }

  try {
    const hostname = new URL(modelConfig.baseUrl).hostname.toLowerCase();
    if (
      hostname === "api.deepseek.com" ||
      hostname.endsWith(".deepseek.com")
    ) {
      return { config, fellBackToDefault: false };
    }
  } catch {
    // 无效且没有 Key 的旧配置同样回退到站方默认模型。
  }

  return {
    config: { ...config, modelConfig: DEFAULT_SITE_MODEL },
    fellBackToDefault: true,
  };
}

export default function InterviewPage() {
  const router = useRouter();
  const [config, setConfig] = React.useState<InterviewConfig | null>(null);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [followUpCount, setFollowUpCount] = React.useState(0);
  const [conversation, setConversation] = React.useState<ChatMessage[]>([]);
  const [draft, setDraft] = React.useState("");
  const [inputMode, setInputMode] = React.useState<"voice" | "text">("voice");
  const [pageError, setPageError] = React.useState("");
  const [isGeneratingReport, setIsGeneratingReport] = React.useState(false);
  const [reportFailed, setReportFailed] = React.useState(false);
  const [interviewFailed, setInterviewFailed] = React.useState(false);
  const [retryPending, setRetryPending] = React.useState(false);
  const [answeredIds, setAnsweredIds] = React.useState<number[]>([]);
  const [attempts, setAttempts] = React.useState<AnswerAttempt[]>([]);
  const [restored, setRestored] = React.useState(false);
  const [modelFallbackApplied, setModelFallbackApplied] = React.useState(false);
  const [ttsEnabled, setTtsEnabled] = React.useState(false);
  const [speaking, setSpeaking] = React.useState(false);
  const [bookmarked, setBookmarked] = React.useState(false);

  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);
  const lastPayloadRef = React.useRef<InterviewRequest | null>(null);
  const retryCountRef = React.useRef(0);
  const questionShownAtRef = React.useRef<number>(Date.now());
  const completedTrackedRef = React.useRef(false);
  const draftUsedVoiceRef = React.useRef(false);
  const submissionLockedRef = React.useRef(false);
  const reportLockedRef = React.useRef(false);
  const retryTimerRef = React.useRef<number | null>(null);
  const reportControllerRef = React.useRef<AbortController | null>(null);
  const latestRef = React.useRef({
    config,
    currentIndex,
    followUpCount,
    conversation,
    answeredIds,
    attempts,
  });

  const handleAsrText = React.useCallback((text: string) => {
    draftUsedVoiceRef.current = true;
    setDraft(text);
  }, []);

  const speak = React.useCallback((text: string) => {
    if (!("speechSynthesis" in window) || !window.speechSynthesis) {
      setPageError("当前浏览器不支持语音朗读。");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  const {
    engine: asrEngine,
    listening: asrListening,
    error: asrError,
    notice: asrNotice,
    start: startListening,
    stop: stopListening,
    cancel: cancelAsr,
    retry: retryAsr,
  } = useAsr(handleAsrText);

  const handleStartListening = () => {
    startListening(draft);
  };

  const handleRetryAsr = () => {
    retryAsr(draft);
  };

  const generateReport = React.useCallback(
    async (
      currentConfig: InterviewConfig,
      currentConversation: ChatMessage[],
      currentAnsweredIds: number[],
      currentAttempts: AnswerAttempt[],
      status: "completed" | "ended_early" = "completed",
    ) => {
      if (reportLockedRef.current) return;
      reportLockedRef.current = true;
      setIsGeneratingReport(true);
      setReportFailed(false);
      setPageError("");

      const answeredQuestions = currentConfig.questions.filter((question) =>
        currentAnsweredIds.includes(question.id),
      );
      if (answeredQuestions.length === 0) {
        setPageError("至少回答一道题后才能生成报告。");
        setIsGeneratingReport(false);
        reportLockedRef.current = false;
        return;
      }

      const controller = new AbortController();
      reportControllerRef.current = controller;
      const timeout = window.setTimeout(() => controller.abort(), 90000);

      try {
        const response = await fetch("/api/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: currentConfig.role,
            modelConfig: currentConfig.modelConfig,
            questions: answeredQuestions,
            conversation: currentConversation,
            answeredCount: answeredQuestions.length,
            totalQuestions: currentConfig.questions.length,
            attempts: currentAttempts,
            baselineAnswers: currentConfig.baselineAnswers,
            mode: currentConfig.mode,
            seniority: currentConfig.seniority,
            interviewRound: currentConfig.interviewRound,
            jobDescription: currentConfig.jobDescription,
            practiceGoal: currentConfig.practiceGoal,
            customInterviewTitle: currentConfig.customInterviewTitle,
            customInterviewContext: currentConfig.customInterviewContext,
          }),
          signal: controller.signal,
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "评分报告生成失败。");
        }

        const session: InterviewSession = {
          id: createId(),
          createdAt: new Date().toISOString(),
          role: currentConfig.role,
          questionCount: answeredQuestions.length,
          questions: currentConfig.questions,
          conversation: currentConversation,
          report: payload,
          durationMs: Date.now() - new Date(currentConfig.startedAt).getTime(),
          answeredCount: answeredQuestions.length,
          status,
          attempts: currentAttempts,
          sourceSessionId: currentConfig.sourceSessionId,
          customInterviewTitle: currentConfig.customInterviewTitle,
        };

        if (!saveSession(session)) {
          throw new Error(
            "报告已生成，但本机存储空间不足。请清理旧记录后重试生成报告。",
          );
        }
        if (!completedTrackedRef.current) {
          completedTrackedRef.current = true;
          trackAnalytics({
            type: "interview_complete",
            answeredCount: answeredQuestions.length,
            totalDurationMs: session.durationMs,
            targeted: Boolean(currentConfig.sourceSessionId),
          });
        }
        clearInterviewProgress();
        clearInterviewConfig();
        router.push("/report");
      } catch (error) {
        const isTimeout =
          error instanceof DOMException && error.name === "AbortError";
        trackAnalytics({
          type: "service_error",
          stage: "report",
          code: isTimeout
            ? "timeout"
            : error instanceof TypeError
              ? "network"
              : "provider",
        });
        const message = isTimeout
          ? "生成评分报告超时，请重试。"
          : error instanceof Error
            ? error.message
            : "评分报告生成失败。";
        setPageError(message);
        setReportFailed(true);
        setIsGeneratingReport(false);
      } finally {
        window.clearTimeout(timeout);
        reportControllerRef.current = null;
        reportLockedRef.current = false;
      }
    },
    [router],
  );

  const handleTurnRef = React.useRef<(turn: InterviewTurn) => void>(() => {});
  handleTurnRef.current = (turn: InterviewTurn) => {
    const state = latestRef.current;
    if (!state.config) return;

    const isLast = state.currentIndex >= state.config.questions.length - 1;
    const action = state.followUpCount >= 2 ? "next_question" : turn.action;
    const nextQuestion = state.config.questions[state.currentIndex + 1];
    const response =
      action === "next_question" ? (nextQuestion?.question ?? "") : turn.response;
    const assistantMessage: ChatMessage = {
      role: "assistant",
      content: response,
    };
    const nextConversation = response
      ? [...state.conversation, assistantMessage]
      : state.conversation;

    if (action === "follow_up") {
      trackAnalytics({
        type: "follow_up_shown",
        questionIndex: state.currentIndex,
        followUpRound: state.followUpCount + 1,
      });
      setConversation(nextConversation);
      setFollowUpCount((count) => count + 1);
    } else if (isLast) {
      setConversation(nextConversation);
      void generateReport(
        state.config,
        nextConversation,
        state.answeredIds,
        state.attempts,
      );
    } else {
      setConversation(nextConversation);
      questionShownAtRef.current = Date.now();
      setCurrentIndex((index) => index + 1);
      setFollowUpCount(0);
    }
  };

  const { submit, isLoading: isProcessing } = experimental_useObject<
    InterviewTurn,
    InterviewRequest
  >({
    api: "/api/interview",
    schema: interviewTurnSchema,
    onError: (error) => {
      const message = error.message || "面试官暂时无法响应，请重试。";
      const isRateLimited = /429|限流|访问量过大|速率限制|rate limit|Too Many Requests/i.test(
        message,
      );
      trackAnalytics({
        type: "service_error",
        stage: "interview_turn",
        code: isRateLimited ? "rate_limited" : "provider",
      });

      if (isRateLimited && lastPayloadRef.current) {
        if (retryCountRef.current < 3) {
          retryCountRef.current += 1;
          const delay = retryCountRef.current * 6000;
          setPageError(
            `模型服务商暂时繁忙（限流），约 ${Math.round(
              delay / 1000,
            )} 秒后自动重试（第 ${retryCountRef.current} 次）…`,
          );
          setRetryPending(true);
          if (retryTimerRef.current !== null) {
            window.clearTimeout(retryTimerRef.current);
          }
          retryTimerRef.current = window.setTimeout(() => {
            retryTimerRef.current = null;
            setRetryPending(false);
            if (lastPayloadRef.current) {
              setPageError("");
              submit(lastPayloadRef.current);
            } else {
              submissionLockedRef.current = false;
            }
          }, delay);
          return;
        }
        setPageError("模型服务商持续繁忙，请稍后手动重试，或改用其他模型。");
        setInterviewFailed(true);
        setRetryPending(false);
        submissionLockedRef.current = false;
        return;
      }

      setPageError(message);
      setInterviewFailed(true);
      setRetryPending(false);
      submissionLockedRef.current = false;
    },
    onFinish: ({ object, error }) => {
      setRetryPending(false);
      if (error || !object) {
        trackAnalytics({
          type: "service_error",
          stage: "interview_turn",
          code: "invalid_response",
        });
        setPageError("面试官回复解析失败，请重试。");
        setInterviewFailed(true);
        submissionLockedRef.current = false;
        return;
      }
      setInterviewFailed(false);
      submissionLockedRef.current = false;
      lastPayloadRef.current = null;
      handleTurnRef.current(object);
    },
  });

  React.useEffect(() => {
    const savedProgress = loadInterviewProgress();
    if (savedProgress) {
      const restoredModel = restoreUsableModel(savedProgress.config);
      const restoredConfig = restoredModel.config;
      const safeIndex = Math.min(
        Math.max(0, savedProgress.currentIndex),
        restoredConfig.questions.length - 1,
      );
      setConfig(restoredConfig);
      setCurrentIndex(safeIndex);
      setFollowUpCount(savedProgress.followUpCount);
      setConversation(savedProgress.conversation);
      setDraft(savedProgress.draft);
      setInputMode(savedProgress.inputMode);
      setAnsweredIds(savedProgress.answeredIds);
      setAttempts(savedProgress.attempts);
      setRestored(true);
      setModelFallbackApplied(restoredModel.fellBackToDefault);
      questionShownAtRef.current = Date.now();
      latestRef.current = {
        config: restoredConfig,
        currentIndex: safeIndex,
        followUpCount: savedProgress.followUpCount,
        conversation: savedProgress.conversation,
        answeredIds: savedProgress.answeredIds,
        attempts: savedProgress.attempts,
      };
      return;
    }

    const loaded = loadInterviewConfig();
    if (!loaded || loaded.questions.length === 0) {
      window.location.replace("/");
      return;
    }

    const restoredModel = restoreUsableModel(loaded);
    const loadedConfig = restoredModel.config;
    const initialMessage: ChatMessage = {
      role: "assistant",
      content: loadedConfig.questions[0].question,
    };
    setConfig(loadedConfig);
    setModelFallbackApplied(restoredModel.fellBackToDefault);
    setConversation([initialMessage]);
    setAnsweredIds([]);
    setAttempts([]);
    questionShownAtRef.current = Date.now();
    latestRef.current = {
      config: loadedConfig,
      currentIndex: 0,
      followUpCount: 0,
      conversation: [initialMessage],
      answeredIds: [],
      attempts: [],
    };
  }, [router]);

  React.useEffect(() => {
    latestRef.current = {
      config,
      currentIndex,
      followUpCount,
      conversation,
      answeredIds,
      attempts,
    };
  }, [config, currentIndex, followUpCount, conversation, answeredIds, attempts]);

  React.useEffect(() => {
    if (!config || conversation.length === 0 || isGeneratingReport) return;
    const timeout = window.setTimeout(() => {
      saveInterviewProgress({
        config,
        currentIndex,
        followUpCount,
        conversation,
        draft,
        inputMode,
        answeredIds,
        attempts,
        updatedAt: new Date().toISOString(),
      });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [
    config,
    currentIndex,
    followUpCount,
    conversation,
    draft,
    inputMode,
    answeredIds,
    attempts,
    isGeneratingReport,
  ]);

  React.useEffect(() => {
    const question = config?.questions[currentIndex];
    if (question) {
      setBookmarked(isBookmarked(question.id));
    }
  }, [config, currentIndex]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation, isProcessing, isGeneratingReport]);

  React.useEffect(() => {
    if (!ttsEnabled) return;
    const lastMessage = conversation[conversation.length - 1];
    if (lastMessage?.role === "assistant" && lastMessage.content) {
      speak(lastMessage.content);
    }
  }, [conversation, ttsEnabled, speak]);

  React.useEffect(() => {
    return () => {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
      }
      reportControllerRef.current?.abort();
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function handleSubmit() {
    if (!config || submissionLockedRef.current || reportLockedRef.current) return;
    const text = draft.trim();
    if (!text) {
      setPageError("请先输入或说出你的回答。");
      return;
    }

    cancelAsr();
    setPageError("");
    setInterviewFailed(false);
    submissionLockedRef.current = true;

    const question = config.questions[currentIndex];
    const userMessage: ChatMessage = { role: "user", content: text };
    const nextConversation: ChatMessage[] = [...conversation, userMessage];
    const nextAnsweredIds = question
      ? Array.from(new Set([...answeredIds, question.id]))
      : answeredIds;
    const elapsed = Math.max(0, Date.now() - questionShownAtRef.current);
    const actualInputType: "voice" | "text" = draftUsedVoiceRef.current
      ? "voice"
      : "text";
    const nextAttempts = question
      ? [
          ...attempts.filter((attempt) => attempt.questionId !== question.id),
          (() => {
            const previous = attempts.find(
              (attempt) => attempt.questionId === question.id,
            );
            return {
              questionId: question.id,
              question: question.question,
              answers: [...(previous?.answers ?? []), text],
              inputTypes: [...(previous?.inputTypes ?? []), actualInputType],
              durationMs: (previous?.durationMs ?? 0) + elapsed,
            } satisfies AnswerAttempt;
          })(),
        ]
      : attempts;
    setConversation(nextConversation);
    setAnsweredIds(nextAnsweredIds);
    setAttempts(nextAttempts);
    setDraft("");
    draftUsedVoiceRef.current = false;

    latestRef.current = {
      config,
      currentIndex,
      followUpCount,
      conversation: nextConversation,
      answeredIds: nextAnsweredIds,
      attempts: nextAttempts,
    };

    const payload: InterviewRequest = {
      role: config.role,
      modelConfig: config.modelConfig,
      questions: config.questions,
      currentIndex,
      totalQuestions: config.questions.length,
      followUpCount,
      conversation: nextConversation,
      currentAnswer: text,
      mode: config.mode,
      seniority: config.seniority,
      interviewRound: config.interviewRound,
      jobDescription: config.jobDescription,
      resume: config.resume,
      practiceGoal: config.practiceGoal,
      customInterviewTitle: config.customInterviewTitle,
      customInterviewContext: config.customInterviewContext,
    };
    trackAnalytics({
      type: "answer_submit",
      questionIndex: currentIndex,
      inputType: actualInputType,
      durationMs: elapsed,
    });
    lastPayloadRef.current = payload;
    retryCountRef.current = 0;
    try {
      submit(payload);
    } catch {
      trackAnalytics({
        type: "service_error",
        stage: "interview_turn",
        code: "network",
      });
      submissionLockedRef.current = false;
      setInterviewFailed(true);
      setPageError("面试官请求发送失败，请重试。");
    }
  }

  function handleRetryTurn(): void {
    if (
      !lastPayloadRef.current ||
      submissionLockedRef.current ||
      reportLockedRef.current
    ) {
      return;
    }
    submissionLockedRef.current = true;
    setInterviewFailed(false);
    setPageError("");
    try {
      submit(lastPayloadRef.current);
    } catch {
      trackAnalytics({
        type: "service_error",
        stage: "interview_turn",
        code: "network",
      });
      submissionLockedRef.current = false;
      setInterviewFailed(true);
      setPageError("重试发送失败，请检查网络后再试。");
    }
  }

  function handleSkipQuestion() {
    if (
      !config ||
      isProcessing ||
      isGeneratingReport ||
      retryPending ||
      submissionLockedRef.current
    ) return;

    cancelAsr();
    setPageError("");

    const userMessage: ChatMessage = { role: "user", content: "[跳过本题]" };
    const nextConversation = [...conversation, userMessage];
    const isLast = currentIndex >= config.questions.length - 1;

    if (isLast) {
      setConversation(nextConversation);
      latestRef.current = {
        config,
        currentIndex,
        followUpCount,
        conversation: nextConversation,
        answeredIds,
        attempts,
      };
      void generateReport(
        config,
        nextConversation,
        answeredIds,
        attempts,
      );
      return;
    }

    const nextQuestion = config.questions[currentIndex + 1];
    const assistantMessage: ChatMessage = {
      role: "assistant",
      content: nextQuestion.question,
    };
    const advancedConversation = [...nextConversation, assistantMessage];

    setConversation(advancedConversation);
    setCurrentIndex((index) => index + 1);
    setFollowUpCount(0);
    latestRef.current = {
      config,
      currentIndex: currentIndex + 1,
      followUpCount: 0,
      conversation: advancedConversation,
      answeredIds,
      attempts,
    };
  }

  function handleEndEarly() {
    if (
      !config ||
      isProcessing ||
      isGeneratingReport ||
      retryPending ||
      submissionLockedRef.current
    ) return;

    cancelAsr();
    setPageError("");

    const userMessage: ChatMessage = { role: "user", content: "[提前结束面试]" };
    const nextConversation = [...conversation, userMessage];

    setConversation(nextConversation);
    latestRef.current = {
      config,
      currentIndex,
      followUpCount,
      conversation: nextConversation,
      answeredIds,
      attempts,
    };
    void generateReport(
      config,
      nextConversation,
      answeredIds,
      attempts,
      "ended_early",
    );
  }

  function handleRetryReport() {
    const state = latestRef.current;
    if (!state.config || isGeneratingReport) return;
    void generateReport(
      state.config,
      state.conversation,
      state.answeredIds,
      state.attempts,
      state.currentIndex >= state.config.questions.length - 1
        ? "completed"
        : "ended_early",
    );
  }

  function handleExit(): void {
    if (
      isProcessing ||
      isGeneratingReport ||
      retryPending ||
      submissionLockedRef.current
    ) return;
    cancelAsr();
    router.push("/");
  }

  function handleToggleBookmark() {
    const question = config?.questions[currentIndex];
    if (!question) return;

    if (bookmarked) {
      removeBookmark(question.id);
      setBookmarked(false);
    } else {
      saveBookmark(question);
      setBookmarked(true);
    }
  }

  if (!config) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        正在准备面试…
      </main>
    );
  }

  const currentQuestion = config.questions[currentIndex];
  const answeredCount = currentIndex;
  const progress = Math.round((answeredCount / config.questions.length) * 100);
  const hasBlockingError = Boolean(pageError || asrError);
  const engineLabel =
    asrEngine === "web" ? "浏览器语音识别" : "讯飞语音识别";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 py-5 sm:px-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExit}
          disabled={isProcessing || isGeneratingReport || retryPending}
        >
          <ArrowLeft className="h-4 w-4" />
          保存并退出
        </Button>
        <div className="flex w-full flex-wrap items-center justify-end gap-1 sm:w-auto sm:gap-2">
          <div className="mr-auto min-w-0 text-sm text-slate-400 sm:mr-0">
            {getInterviewLabel(config.role, config.customInterviewTitle)} · 第{" "}
            {Math.min(currentIndex + 1, config.questions.length)} /{" "}
            {config.questions.length} 题
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={
              ttsEnabled
                ? "text-blue-300 hover:bg-blue-500/10 hover:text-blue-200"
                : "text-slate-400 hover:bg-white/10 hover:text-white"
            }
            onClick={() => setTtsEnabled((enabled) => !enabled)}
          >
            {ttsEnabled ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
            {ttsEnabled && speaking
              ? "朗读中…"
              : ttsEnabled
                ? "关闭念题"
                : "语音念题"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-amber-300 hover:bg-amber-500/10 hover:text-amber-200"
            disabled={isProcessing || isGeneratingReport || retryPending}
            onClick={handleEndEarly}
          >
            <StopCircle className="h-4 w-4" />
            提前结束
          </Button>
        </div>
      </header>

      <div className="mb-5">
        <Progress value={progress} />
        {restored && (
          <p className="mt-2 text-xs text-emerald-300" role="status">
            已恢复上次保存的题号、对话和草稿。
          </p>
        )}
        {modelFallbackApplied && (
          <p className="mt-2 text-xs leading-5 text-amber-300" role="status">
            上次选择的模型没有可用 API Key，本场已自动切换为 DeepSeek（站方默认）。
          </p>
        )}
      </div>

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6">
          <div className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="mb-1 text-xs text-violet-300">
                  {currentQuestion?.category} · {config.mode === "simulation" ? "模拟模式" : "练习模式"}
                </div>
                <div className="text-sm font-medium leading-6 text-slate-100">
                  {currentQuestion?.question}
                </div>
              </div>
              <button
                type="button"
                className={
                  bookmarked
                    ? "shrink-0 text-amber-300 hover:text-amber-200"
                    : "shrink-0 text-slate-500 hover:text-amber-200"
                }
                onClick={handleToggleBookmark}
                aria-label={bookmarked ? "取消收藏" : "收藏题目"}
              >
                <Bookmark
                  className="h-5 w-5"
                  fill={bookmarked ? "currentColor" : "none"}
                />
              </button>
            </div>
            {config.mode !== "simulation" && (
              <p className="mt-3 text-xs leading-5 text-slate-500">
                建议回答 1–2 分钟：先给结论，再说明依据、具体行动和结果。遇到追问时补充边界与取舍。
              </p>
            )}
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl bg-slate-950/25 p-4">
            {conversation.slice(1).map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6",
                    message.role === "user"
                      ? "bg-blue-600/80 text-white"
                      : "border border-white/10 bg-slate-900 text-slate-200",
                  )}
                >
                  {message.role === "assistant" && (
                    <div className="mb-1 text-xs text-slate-500">面试官</div>
                  )}
                  <div className="whitespace-pre-wrap">{message.content}</div>
                </div>
              </div>
            ))}

            {(isProcessing || isGeneratingReport) && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                {isGeneratingReport ? "正在生成评分报告…" : "面试官正在记录…"}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {hasBlockingError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert" aria-live="assertive">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <div>{pageError || asrError}</div>
                {asrError && (
                  <button
                    type="button"
                    className="mt-1 text-blue-300 hover:text-blue-200"
                  onClick={handleRetryAsr}
                >
                    重试语音识别
                  </button>
                )}
                {pageError && (
                  <div className="mt-1 flex gap-3">
                    {reportFailed && (
                      <button
                        type="button"
                        className="text-blue-300 hover:text-blue-200"
                        onClick={handleRetryReport}
                      >
                        重试生成报告
                      </button>
                    )}
                    {interviewFailed && lastPayloadRef.current && (
                      <button
                        type="button"
                        className="text-blue-300 hover:text-blue-200"
                        onClick={handleRetryTurn}
                      >
                        重试面试官响应
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-blue-300 hover:text-blue-200"
                      onClick={() => setPageError("")}
                    >
                      关闭提示
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex gap-1 rounded-lg bg-white/5 p-1">
                <button
                  type="button"
                  onClick={() => setInputMode("voice")}
                  aria-pressed={inputMode === "voice"}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs transition-colors",
                    inputMode === "voice"
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-white",
                  )}
                >
                  语音回答
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode("text")}
                  aria-pressed={inputMode === "text"}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs transition-colors",
                    inputMode === "text"
                      ? "bg-violet-600 text-white"
                      : "text-slate-400 hover:text-white",
                  )}
                >
                  文字回答
                </button>
              </div>

              {inputMode === "voice" && (
                <Button
                  type="button"
                  variant={asrListening ? "destructive" : "secondary"}
                  size="sm"
                  disabled={isProcessing || isGeneratingReport || retryPending}
                  onClick={asrListening ? stopListening : handleStartListening}
                >
                  {asrListening ? (
                    <>
                      <MicOff className="h-4 w-4" />
                      停止聆听
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4" />
                      开始说话
                    </>
                  )}
                </Button>
              )}
            </div>

            {inputMode === "voice" && asrListening && (
              <div className="mb-2 flex items-center gap-2 text-xs text-red-300">
                <AudioLines className="h-4 w-4 animate-pulse" />
                正在聆听，请开始回答…
              </div>
            )}

            {inputMode === "voice" && !asrListening && (
              <p className="mb-2 text-xs leading-5 text-slate-500">
                点击“开始说话”后，音频会直接发送至讯飞用于实时转写；本站仅保存转写后的文字。
              </p>
            )}

            {inputMode === "voice" && asrNotice && (
              <div className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                {asrNotice}
              </div>
            )}

            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={8000}
              placeholder="把你的回答输入或说在这里，提交前可以编辑修正…"
            />

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-xs leading-5 text-slate-500">
                {inputMode === "voice"
                  ? `当前：${engineLabel}，提交前可检查修正。`
                  : "当前为文字输入，建议先给结论，再补充依据和结果。"}
              </div>
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSkipQuestion}
                  disabled={isProcessing || isGeneratingReport || retryPending}
                >
                  <SkipForward className="h-4 w-4" />
                  跳过本题
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!draft.trim() || isProcessing || isGeneratingReport || retryPending}
                >
                  {retryPending
                    ? "等待自动重试…"
                    : isProcessing
                      ? "等待面试官…"
                      : "提交回答"}
                  {!isProcessing && <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
