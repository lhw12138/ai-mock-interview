export type AnalyticsEvent =
  | {
      type: "interview_start";
      role: string;
      questionCount: number;
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
    };

const ANALYTICS_KEY = "ai-mock-interview:analytics";
const MAX_EVENTS = 1000;

type AnalyticsInput =
  | {
      type: "interview_start";
      role: string;
      questionCount: number;
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
    };

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
  const events = loadAnalytics();
  events.push({ ...event, timestamp: event.timestamp ?? Date.now() } as AnalyticsEvent);
  saveAnalytics(events);

  switch (event.type) {
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
