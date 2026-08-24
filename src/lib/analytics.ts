export type AnalyticsEvent =
  | {
      type: "landing_view";
      timestamp: number;
    }
  | {
      type: "interview_start";
      role: string;
      questionCount: number;
      mode?: "practice" | "simulation";
      timestamp: number;
    }
  | {
      type: "answer_submit";
      questionIndex: number;
      inputType: "voice" | "text";
      durationMs: number;
      timestamp: number;
    }
  | {
      type: "follow_up_shown";
      questionIndex: number;
      followUpRound: number;
      timestamp: number;
    }
  | {
      type: "interview_complete";
      answeredCount: number;
      totalDurationMs: number;
      targeted?: boolean;
      timestamp: number;
    }
  | {
      type: "targeted_practice_start";
      sourceSessionId: string;
      practiceGoal: string;
      timestamp: number;
    }
  | {
      type: "report_viewed";
      score: number;
      didShare: boolean;
      timestamp: number;
    }
  | {
      type: "feedback_submit";
      category: string;
      rating: number;
      timestamp: number;
    }
  | {
      type: "service_error";
      stage: "interview_prepare" | "interview_turn" | "report" | "model_test";
      code: "network" | "timeout" | "rate_limited" | "invalid_response" | "provider";
      timestamp: number;
    };

const ANALYTICS_KEY = "ai-mock-interview:analytics";
const MAX_EVENTS = 1000;
const ANONYMOUS_ID_KEY = "ai-mock-interview:anonymous-id";
const VISIT_ID_KEY = "ai-mock-interview:visit-id";
const ATTRIBUTION_KEY = "ai-mock-interview:attribution";
const FIRST_ANSWER_KEY = "ai-mock-interview:first-answer-sent";
const LANDING_VIEW_KEY = "ai-mock-interview:landing-view-sent";

type AnalyticsInput =
  | {
      type: "landing_view";
      timestamp?: number;
    }
  | {
      type: "interview_start";
      role: string;
      questionCount: number;
      mode?: "practice" | "simulation";
      timestamp?: number;
    }
  | {
      type: "answer_submit";
      questionIndex: number;
      inputType: "voice" | "text";
      durationMs: number;
      timestamp?: number;
    }
  | {
      type: "follow_up_shown";
      questionIndex: number;
      followUpRound: number;
      timestamp?: number;
    }
  | {
      type: "interview_complete";
      answeredCount: number;
      totalDurationMs: number;
      targeted?: boolean;
      timestamp?: number;
    }
  | {
      type: "targeted_practice_start";
      sourceSessionId: string;
      practiceGoal: string;
      timestamp?: number;
    }
  | {
      type: "report_viewed";
      score: number;
      didShare: boolean;
      timestamp?: number;
    }
  | {
      type: "feedback_submit";
      category: string;
      rating: number;
      timestamp?: number;
    }
  | {
      type: "service_error";
      stage: "interview_prepare" | "interview_turn" | "report" | "model_test";
      code: "network" | "timeout" | "rate_limited" | "invalid_response" | "provider";
      timestamp?: number;
    };

function createIdentifier(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replaceAll("-", "")
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${random}`;
}

function getOrCreateId(storage: Storage, key: string, prefix: string): string {
  try {
    const existing = storage.getItem(key);
    if (existing) return existing;
    const created = createIdentifier(prefix);
    storage.setItem(key, created);
    return created;
  } catch {
    return createIdentifier(prefix);
  }
}

function getAttribution(): Record<string, string> | undefined {
  try {
    const stored = window.sessionStorage.getItem(ATTRIBUTION_KEY);
    if (stored) return JSON.parse(stored) as Record<string, string>;

    const params = new URLSearchParams(window.location.search);
    const values: Record<string, string> = {};
    const keys = ["source", "medium", "campaign", "content", "term"] as const;
    for (const key of keys) {
      const value = params.get(`utm_${key}`)?.trim().slice(0, 120);
      if (value) values[key] = value;
    }
    if (document.referrer) {
      try {
        const host = new URL(document.referrer).hostname.slice(0, 253);
        if (host && host !== window.location.hostname) values.referrerHost = host;
      } catch {
        // 无效来源地址不参与统计。
      }
    }
    window.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(values));
    return Object.keys(values).length ? values : undefined;
  } catch {
    return undefined;
  }
}

function firstPartyEventName(event: AnalyticsInput): string {
  if (event.type === "answer_submit") {
    try {
      if (!window.sessionStorage.getItem(FIRST_ANSWER_KEY)) {
        window.sessionStorage.setItem(FIRST_ANSWER_KEY, "1");
        return "first_answer";
      }
    } catch {
      // sessionStorage 不可用时退化为普通回答事件。
    }
  }
  if (event.type === "interview_complete") {
    return event.targeted ? "practice_finish" : "interview_finish";
  }
  const names: Record<AnalyticsInput["type"], string> = {
    landing_view: "landing_view",
    interview_start: "interview_start",
    answer_submit: "answer_submit",
    follow_up_shown: "follow_up_shown",
    interview_complete: "interview_finish",
    targeted_practice_start: "practice_start",
    report_viewed: "report_success",
    feedback_submit: "feedback_submit",
    service_error: "service_error",
  };
  return names[event.type];
}

function firstPartyProperties(event: AnalyticsInput): Record<string, unknown> {
  switch (event.type) {
    case "landing_view":
      return {};
    case "interview_start":
      return {
        role: event.role,
        questionCount: event.questionCount,
        mode: event.mode,
      };
    case "answer_submit":
      return {
        questionIndex: event.questionIndex,
        inputType: event.inputType,
        durationMs: event.durationMs,
      };
    case "follow_up_shown":
      return {
        questionIndex: event.questionIndex,
        followUpRound: event.followUpRound,
      };
    case "interview_complete":
      return {
        answeredCount: event.answeredCount,
        durationMs: event.totalDurationMs,
        targeted: Boolean(event.targeted),
      };
    case "targeted_practice_start":
      return { practiceGoal: event.practiceGoal };
    case "report_viewed":
      return { score: event.score, didShare: event.didShare };
    case "feedback_submit":
      return { category: event.category, rating: event.rating };
    case "service_error":
      return { errorStage: event.stage, errorCode: event.code };
  }
}

function sendFirstPartyEvent(event: AnalyticsInput, timestamp: number): void {
  if (typeof window === "undefined") return;
  const body = JSON.stringify({
    eventId: createIdentifier("evt"),
    eventName: firstPartyEventName(event),
    anonymousId: getOrCreateId(window.localStorage, ANONYMOUS_ID_KEY, "anon"),
    visitId: getOrCreateId(window.sessionStorage, VISIT_ID_KEY, "visit"),
    path: window.location.pathname,
    occurredAt: timestamp,
    attribution: getAttribution(),
    properties: firstPartyProperties(event),
  });

  try {
    if (navigator.sendBeacon) {
      const queued = navigator.sendBeacon(
        "/api/analytics/events",
        new Blob([body], { type: "application/json" }),
      );
      if (queued) return;
    }
    void fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      cache: "no-store",
    }).catch(() => undefined);
  } catch {
    // 统计失败不能影响面试主流程。
  }
}

export function loadAnalytics(): AnalyticsEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ANALYTICS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AnalyticsEvent[]) : [];
  } catch {
    return [];
  }
}

function saveAnalytics(events: AnalyticsEvent[]): void {
  try {
    window.localStorage.setItem(
      ANALYTICS_KEY,
      JSON.stringify(events.slice(-MAX_EVENTS)),
    );
  } catch {
    // localStorage 不可用或已满时静默忽略
  }
}

function pushToBaidu(
  category: string,
  action: string,
  label?: string,
  value?: number,
): void {
  if (typeof window === "undefined") return;
  const tracker = (window as unknown as { _hmt?: unknown[] })._hmt;
  if (!Array.isArray(tracker)) return;
  tracker.push(["_trackEvent", category, action, label, value]);
}

export function trackAnalytics(event: AnalyticsInput): void {
  if (typeof window === "undefined") return;
  if (event.type === "landing_view") {
    try {
      if (window.sessionStorage.getItem(LANDING_VIEW_KEY)) return;
      window.sessionStorage.setItem(LANDING_VIEW_KEY, "1");
    } catch {
      // 仍允许本次事件继续发送。
    }
  }
  if (event.type === "interview_start") {
    try {
      window.sessionStorage.removeItem(FIRST_ANSWER_KEY);
    } catch {
      // 无需阻断开始面试。
    }
  }
  const timestamp = event.timestamp ?? Date.now();
  const events = loadAnalytics();
  events.push({ ...event, timestamp } as AnalyticsEvent);
  saveAnalytics(events);
  sendFirstPartyEvent(event, timestamp);

  switch (event.type) {
    case "landing_view":
      pushToBaidu("访问", "进入首页");
      break;
    case "interview_start":
      pushToBaidu("面试", "开始面试", event.role, event.questionCount);
      break;
    case "answer_submit":
      pushToBaidu(
        "面试",
        "提交回答",
        event.inputType === "voice" ? "语音" : "文字",
        event.durationMs,
      );
      break;
    case "follow_up_shown":
      pushToBaidu("面试", "AI追问", `第${event.followUpRound}轮`, event.questionIndex);
      break;
    case "interview_complete":
      pushToBaidu(
        "面试",
        event.targeted ? "完成针对性复练" : "完成面试",
        String(event.answeredCount),
        event.totalDurationMs,
      );
      break;
    case "targeted_practice_start":
      pushToBaidu("复练", "启动弱项训练", event.practiceGoal);
      break;
    case "report_viewed":
      pushToBaidu("报告", "查看报告", event.didShare ? "已分享" : "未分享", event.score);
      break;
    case "feedback_submit":
      pushToBaidu("反馈", "提交成功", event.category, event.rating);
      break;
    case "service_error":
      pushToBaidu("错误", event.stage, event.code);
      break;
  }
}

export function markReportShared(): void {
  const events = loadAnalytics();
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event.type === "report_viewed") {
      events[i] = { ...event, didShare: true };
      break;
    }
  }
  saveAnalytics(events);
}

export interface PersonalStats {
  interviewStarts: number;
  interviewCompletes: number;
  completionRate: number;
  avgDurationMin: number;
  answerCount: number;
  voiceRate: number;
  last7DaysStarts: number;
  last7DaysCompletes: number;
  avgScore: number;
  targetedStarts: number;
  targetedCompletes: number;
  targetedCompletionRate: number;
}

export function computePersonalStats(events: AnalyticsEvent[]): PersonalStats {
  const starts = events.filter((event) => event.type === "interview_start");
  const completes = events.filter((event) => event.type === "interview_complete");
  const answers = events.filter((event) => event.type === "answer_submit");
  const reports = events.filter((event) => event.type === "report_viewed");
  const targetedStarts = events.filter(
    (event) => event.type === "targeted_practice_start",
  );
  const targetedCompletes = completes.filter((event) => event.targeted);
  const voiceAnswers = answers.filter((event) => event.inputType === "voice");
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const avgDurationMin =
    completes.length > 0
      ? completes.reduce((sum, event) => sum + event.totalDurationMs, 0) /
        completes.length /
        60000
      : 0;

  return {
    interviewStarts: starts.length,
    interviewCompletes: completes.length,
    completionRate: starts.length ? completes.length / starts.length : 0,
    avgDurationMin,
    answerCount: answers.length,
    voiceRate: answers.length ? voiceAnswers.length / answers.length : 0,
    last7DaysStarts: starts.filter(
      (event) => now - event.timestamp <= sevenDays,
    ).length,
    last7DaysCompletes: completes.filter(
      (event) => now - event.timestamp <= sevenDays,
    ).length,
    avgScore:
      reports.length > 0
        ? Math.round(reports.reduce((sum, event) => sum + event.score, 0) /
            reports.length)
        : 0,
    targetedStarts: targetedStarts.length,
    targetedCompletes: targetedCompletes.length,
    targetedCompletionRate: targetedStarts.length
      ? targetedCompletes.length / targetedStarts.length
      : 0,
  };
}
