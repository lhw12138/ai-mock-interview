export type AsrEngine = "web" | "xfyun";

export type AsrError = {
  message: string;
  /** 致命错误表示当前引擎无法继续，需要切换兜底引擎 */
  fatal: boolean;
  /** 切换前已经识别出的最终文字，用于切换后继续拼接，避免重录 */
  carryover?: string;
};

export type AsrEngineCallbacks = {
  onText: (fullText: string) => void;
  onError: (error: AsrError) => void;
  onEnd: () => void;
  onSessionEnd?: (fullText: string) => void;
};

export interface AsrEngineClient {
  start(): Promise<void>;
  stop(): void;
  dispose(): void;
}
