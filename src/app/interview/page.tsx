"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { experimental_useObject } from "ai/react";
import {
  ArrowLeft,
  AudioLines,
  Loader2,
  Mic,
  MicOff,
  Send,
  SkipForward,
  StopCircle,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { interviewTurnSchema } from "@/lib/schemas";
import {
  clearInterviewConfig,
  loadInterviewConfig,
  saveSession,
} from "@/lib/storage";
import type {
  ChatMessage,
  InterviewConfig,
  InterviewRequest,
  InterviewSession,
  InterviewTurn,
} from "@/lib/types";
import { getRoleLabel } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { useAsr } from "@/lib/asr/use-asr";

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

  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);
  const latestRef = React.useRef({
    config,
    currentIndex,
    followUpCount,
    conversation,
  });

  const handleAsrText = React.useCallback((text: string) => {
    setDraft(text);
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
    ) => {
      setIsGeneratingReport(true);
      setPageError("");

      try {
        const response = await fetch("/api/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: currentConfig.role,
            questions: currentConfig.questions,
            conversation: currentConversation,
            answeredCount: currentConfig.questions.length,
            totalQuestions: currentConfig.questions.length,
          }),
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "评分报告生成失败。");
        }

        const session: InterviewSession = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          role: currentConfig.role,
          questionCount: currentConfig.questions.length,
          questions: currentConfig.questions,
          conversation: currentConversation,
          report: payload,
          durationMs: Date.now() - new Date(currentConfig.startedAt).getTime(),
        };

        saveSession(session);
        clearInterviewConfig();
        router.push("/report");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "评分报告生成失败。";
        setPageError(message);
        setIsGeneratingReport(false);
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
      setConversation(nextConversation);
      setFollowUpCount((count) => count + 1);
    } else if (isLast) {
      setConversation(nextConversation);
      void generateReport(state.config, nextConversation);
    } else {
      setConversation(nextConversation);
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
      setPageError(error.message || "面试官暂时无法响应，请重试。");
    },
    onFinish: ({ object, error }) => {
      if (error || !object) {
        setPageError("面试官回复解析失败，请重试。");
        return;
      }
      handleTurnRef.current(object);
    },
  });

  React.useEffect(() => {
    const loaded = loadInterviewConfig();
    if (!loaded || loaded.questions.length === 0) {
      window.location.replace("/");
      return;
    }

    const initialMessage: ChatMessage = {
      role: "assistant",
      content: loaded.questions[0].question,
    };
    setConfig(loaded);
    setConversation([initialMessage]);
    latestRef.current = {
      config: loaded,
      currentIndex: 0,
      followUpCount: 0,
      conversation: [initialMessage],
    };
  }, [router]);

  React.useEffect(() => {
    latestRef.current = {
      config,
      currentIndex,
      followUpCount,
      conversation,
    };
  }, [config, currentIndex, followUpCount, conversation]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation, isProcessing, isGeneratingReport]);

  function handleSubmit() {
    if (!config) return;
    const text = draft.trim();
    if (!text) {
      setPageError("请先输入或说出你的回答。");
      return;
    }

    cancelAsr();
    setPageError("");

    const userMessage: ChatMessage = { role: "user", content: text };
    const nextConversation: ChatMessage[] = [...conversation, userMessage];
    setConversation(nextConversation);
    setDraft("");

    latestRef.current = {
      config,
      currentIndex,
      followUpCount,
      conversation: nextConversation,
    };

    submit({
      role: config.role,
      questions: config.questions,
      currentIndex,
      totalQuestions: config.questions.length,
      followUpCount,
      conversation: nextConversation,
      currentAnswer: text,
    });
  }

  function handleSkipQuestion() {
    if (!config || isProcessing || isGeneratingReport) return;

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
      };
      void generateReport(config, nextConversation);
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
    };
  }

  function handleEndEarly() {
    if (!config || isProcessing || isGeneratingReport) return;

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
    };
    void generateReport(config, nextConversation);
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
      <header className="mb-4 flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
          <ArrowLeft className="h-4 w-4" />
          退出
        </Button>
        <div className="flex items-center gap-2">
          <div className="text-sm text-slate-400">
            {getRoleLabel(config.role)} · 第{" "}
            {Math.min(currentIndex + 1, config.questions.length)} /{" "}
            {config.questions.length} 题
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-amber-300 hover:bg-amber-500/10 hover:text-amber-200"
            disabled={isProcessing || isGeneratingReport}
            onClick={handleEndEarly}
          >
            <StopCircle className="h-4 w-4" />
            提前结束
          </Button>
        </div>
      </header>

      <div className="mb-5">
        <Progress value={progress} />
      </div>

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6">
          <div className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3">
            <div className="mb-1 text-xs text-violet-300">
              {currentQuestion?.category}
            </div>
            <div className="text-sm font-medium leading-6 text-slate-100">
              {currentQuestion?.question}
            </div>
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
            <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
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
                  <button
                    type="button"
                    className="mt-1 text-blue-300 hover:text-blue-200"
                    onClick={() => setPageError("")}
                  >
                    关闭提示
                  </button>
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
                  disabled={isProcessing || isGeneratingReport}
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

            {inputMode === "voice" && asrNotice && (
              <div className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                {asrNotice}
              </div>
            )}

            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="把你的回答输入或说在这里，提交前可以编辑修正…"
            />

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                {inputMode === "voice"
                  ? `当前：${engineLabel}，提交前可检查修正。`
                  : "识别结果可能存在误差，建议提交前检查一遍。"}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSkipQuestion}
                  disabled={isProcessing || isGeneratingReport}
                >
                  <SkipForward className="h-4 w-4" />
                  跳过本题
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!draft.trim() || isProcessing || isGeneratingReport}
                >
                  {isProcessing ? "等待面试官…" : "提交回答"}
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
