import type { AsrEngineCallbacks, AsrEngineClient } from "./types";

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return (
    (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor })
      .SpeechRecognition ??
    (window as unknown as {
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    }).webkitSpeechRecognition ??
    null
  );
}

const SPEECH_FILLER_TOKENS = new Set([
  "嗯",
  "嗯嗯",
  "呃",
  "呃呃",
  "啊",
  "哦",
  "就是",
  "就是说",
  "那个",
  "这个",
  "然后",
]);

function cleanSpeechTranscript(text: string): string {
  const parts = text.split(/([。！？!?；;，,、\s]+)/);
  const filtered = parts
    .map((part) => (SPEECH_FILLER_TOKENS.has(part.trim()) ? "" : part))
    .join("");
  const collapsed = filtered.replace(/(.{2,}?)\1{2,}/g, "$1");
  return collapsed.replace(/\s{2,}/g, " ").trim();
}

// Edge/Chrome 的 Web Speech API 有时会在约 1 分钟后自动断开，
// 因此主动在 50 秒时重建识别会话，同时保留已经识别出的最终文字。
const RESTART_INTERVAL_MS = 50000;

export class WebSpeechAsr implements AsrEngineClient {
  private recognition: SpeechRecognitionInstance | null = null;
  private finalTranscript = "";
  private processedFinalIndex = 0;
  private listening = false;
  private suppressEnd = false;
  private restartTimer: number | null = null;
  private initialText = "";
  private callbacks: AsrEngineCallbacks;

  constructor(callbacks: AsrEngineCallbacks, initialText = "") {
    this.callbacks = callbacks;
    this.initialText = initialText;
  }

  static isSupported(): boolean {
    return Boolean(getSpeechRecognition());
  }

  async start(): Promise<void> {
    if (this.listening) return;
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      this.callbacks.onError({
        message: "当前浏览器不支持语音识别，已切换到文字输入。",
        fatal: true,
      });
      return;
    }

    this.finalTranscript = this.initialText;
    this.listening = true;
    this.suppressEnd = false;
    this.startRecognition();
  }

  stop(): void {
    this.listening = false;
    this.clearRestartTimer();
    try {
      this.recognition?.stop();
    } catch {
      // 已经停止时忽略。
    }
  }

  dispose(): void {
    this.stop();
    this.recognition = null;
  }

  private startRecognition(): void {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    // 新的识别会话其 results 数组从 0 开始。
    this.processedFinalIndex = 0;

    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = true;
    this.recognition = recognition;

    recognition.onresult = (event: unknown) => {
      const results = (
        event as {
          results?: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
        }
      ).results;
      if (!results) return;

      let interim = "";
      for (
        let index = this.processedFinalIndex;
        index < results.length;
        index += 1
      ) {
        const result = results[index];
        if (result.isFinal) {
          this.finalTranscript += result[0].transcript;
          this.processedFinalIndex = index + 1;
        } else {
          interim += result[0].transcript;
        }
      }

      this.callbacks.onText(
        cleanSpeechTranscript(this.finalTranscript + interim),
      );
    };

    recognition.onerror = (event) => {
      const code = event.error ?? "";
      if (code === "network" || code === "service-not-allowed") {
        this.listening = false;
        this.suppressEnd = true;
        this.clearRestartTimer();
        this.callbacks.onError({
          message: "浏览器语音服务网络中断，正在切换备用识别…",
          fatal: true,
          carryover: cleanSpeechTranscript(this.finalTranscript),
        });
      } else if (code === "not-allowed") {
        this.listening = false;
        this.suppressEnd = true;
        this.clearRestartTimer();
        this.callbacks.onError({
          message: "无法访问麦克风，请在浏览器中允许麦克风权限。",
          fatal: false,
        });
      } else if (code === "no-speech") {
        this.callbacks.onError({
          message: "没有检测到说话，请靠近麦克风再试一次。",
          fatal: false,
        });
      }
    };

    recognition.onend = () => {
      if (this.suppressEnd) {
        this.suppressEnd = false;
        this.recognition = null;
        return;
      }
      if (!this.listening) {
        this.recognition = null;
        this.callbacks.onEnd();
        return;
      }

      // 非用户主动停止：可能是约 1 分钟限制或异常断开，自动重建会话续听。
      this.startRecognition();
    };

    try {
      recognition.start();
      this.scheduleRestart();
    } catch {
      this.listening = false;
      this.callbacks.onError({
        message: "语音识别启动失败。",
        fatal: true,
      });
    }
  }

  private scheduleRestart(): void {
    this.clearRestartTimer();
    this.restartTimer = window.setTimeout(() => {
      this.restartTimer = null;
      if (!this.listening) return;
      try {
        this.recognition?.stop();
      } catch {
        // 已经停止时忽略。
      }
    }, RESTART_INTERVAL_MS);
  }

  private clearRestartTimer(): void {
    if (this.restartTimer !== null) {
      window.clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }
}
