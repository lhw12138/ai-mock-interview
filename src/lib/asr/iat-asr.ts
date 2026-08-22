import type { AsrEngineCallbacks, AsrEngineClient } from "./types";

const TARGET_SAMPLE_RATE = 16000;

type IatAuthResponse = {
  url: string;
  appId: string;
};

function floatTo16BitPcm(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index]));
    output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
}

function int16ToBase64(input: Int16Array): string {
  const bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...Array.from(chunk));
  }
  return btoa(binary);
}

export class IatAsr implements AsrEngineClient {
  private websocket: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private recordSampleRate = TARGET_SAMPLE_RATE;
  private prefix = "";
  private segmentMap = new Map<number, string>();
  private accumulatedText = "";
  private useDynamicCorrection = false;
  private listening = false;
  private disposed = false;
  private ending = false;
  private pcmQueue: Int16Array[] = [];
  private queuedSampleCount = 0;
  private sendTimer: number | null = null;
  private firstAudioSent = false;
  private auth: IatAuthResponse | null = null;
  private latestFullText = "";
  private callbacks: AsrEngineCallbacks;

  constructor(callbacks: AsrEngineCallbacks, initialText = "") {
    this.callbacks = callbacks;
    this.prefix = initialText;
  }

  async start(): Promise<void> {
    if (this.disposed || this.listening) return;

    try {
      const authResponse = await fetch("/api/asr/auth", {
        method: "GET",
        cache: "no-store",
      });
      const authPayload = (await authResponse.json()) as
        | IatAuthResponse
        | { error?: string };

      if (!authResponse.ok || !("url" in authPayload)) {
        const message =
          "error" in authPayload && authPayload.error
            ? authPayload.error
            : "讯飞语音鉴权失败。";
        this.callbacks.onError({ message, fatal: true });
        return;
      }

      await this.startCapture();
      this.openWebSocket(authPayload);
    } catch (error) {
      this.cleanupAudio();
      const name = error instanceof DOMException ? error.name : undefined;
      const message = error instanceof Error ? error.message : String(error);

      if (name === "NotAllowedError" || /Permission|NotAllowed/i.test(message)) {
        this.callbacks.onError({
          message: "无法访问麦克风，请在浏览器中允许麦克风权限后重试。",
          fatal: false,
        });
      } else {
        this.callbacks.onError({
          message: "讯飞语音识别启动失败：" + message,
          fatal: true,
        });
      }
    }
  }

  stop(): void {
    this.listening = false;
    this.ending = true;
    this.stopSendTimer();
    const websocket = this.websocket;

    if (websocket && websocket.readyState === WebSocket.OPEN) {
      if (!this.firstAudioSent && this.queuedSampleCount === 0) {
        this.sendAudioFrame(new Int16Array(0), true);
      }
      this.flushRemaining();
      websocket.send(
        JSON.stringify({
          data: {
            status: 2,
            audio: "",
          },
        }),
      );
    }

    this.cleanupAudio();

    window.setTimeout(() => {
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.closeWebSocket();
      }
    }, 3000);
  }

  dispose(): void {
    this.disposed = true;
    this.listening = false;
    this.stopSendTimer();
    this.pcmQueue = [];
    this.queuedSampleCount = 0;
    this.closeWebSocket();
    this.cleanupAudio();
  }

  private async startCapture(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error("当前浏览器不支持音频采集。");
    }

    this.mediaStream = stream;
    this.audioContext = new AudioCtx({ sampleRate: TARGET_SAMPLE_RATE });
    this.recordSampleRate = this.audioContext.sampleRate;
    await this.audioContext.resume();

    this.sourceNode = this.audioContext.createMediaStreamSource(stream);
    this.processor = this.audioContext.createScriptProcessor(1024, 1, 1);

    this.processor.onaudioprocess = (event) => {
      const output = event.outputBuffer.getChannelData(0);
      output.fill(0);

      if (!this.listening) return;

      const input = event.inputBuffer.getChannelData(0);
      const samples = this.downsample(input, TARGET_SAMPLE_RATE);
      const pcm = floatTo16BitPcm(samples);
      this.pcmQueue.push(pcm);
      this.queuedSampleCount += pcm.length;
    };

    this.sourceNode.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  private openWebSocket(auth: IatAuthResponse): void {
    this.ending = false;
    this.auth = auth;
    this.firstAudioSent = false;

    const websocket = new WebSocket(auth.url);
    this.websocket = websocket;

    websocket.onopen = () => {
      this.listening = true;

      if (this.ending) {
        this.listening = false;
        this.stopSendTimer();
        if (!this.firstAudioSent && this.queuedSampleCount === 0) {
          this.sendAudioFrame(new Int16Array(0), true);
        }
        this.flushRemaining();
        websocket.send(
          JSON.stringify({
            data: {
              status: 2,
              audio: "",
            },
          }),
        );
        this.cleanupAudio();
        return;
      }

      this.startSendTimer();
    };

    websocket.onmessage = (event) => {
      this.handleMessage(String(event.data));
    };

    websocket.onerror = () => {
      this.listening = false;
      this.stopSendTimer();
      this.callbacks.onError({
        message: "讯飞语音识别连接失败，请检查网络后重试。",
        fatal: true,
      });
      this.closeWebSocket();
      this.cleanupAudio();
    };

    websocket.onclose = () => {
      this.listening = false;
      this.stopSendTimer();
      this.websocket = null;
    };
  }

  private sendAudioFrame(pcm: Int16Array, first = false): void {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;

    const data = {
      status: first ? 0 : 1,
      format: "audio/L16;rate=16000",
      encoding: "raw",
      audio: int16ToBase64(pcm),
    };

    const payload = first
      ? {
          common: { app_id: this.auth?.appId ?? "" },
          business: {
            language: "zh_cn",
            domain: "iat",
            accent: "mandarin",
            vad_eos: 10000,
            dwa: "wpgs",
            ptt: 1,
          },
          data,
        }
      : { data };

    this.websocket.send(JSON.stringify(payload));
    if (first) {
      this.firstAudioSent = true;
    }
  }

  private startSendTimer(): void {
    if (this.sendTimer !== null) return;
    this.sendTimer = window.setInterval(() => {
      this.flushAudioFrame();
    }, 40);
  }

  private stopSendTimer(): void {
    if (this.sendTimer !== null) {
      window.clearInterval(this.sendTimer);
      this.sendTimer = null;
    }
  }

  private flushAudioFrame(): void {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;

    const frameSamples = 640;
    if (this.queuedSampleCount < frameSamples && !this.ending) return;
    if (this.queuedSampleCount === 0) return;

    const frame = new Int16Array(
      Math.min(frameSamples, this.queuedSampleCount),
    );
    let filled = 0;

    while (filled < frame.length && this.pcmQueue.length > 0) {
      const chunk = this.pcmQueue[0];
      const needed = frame.length - filled;
      if (chunk.length <= needed) {
        frame.set(chunk, filled);
        filled += chunk.length;
        this.pcmQueue.shift();
      } else {
        frame.set(chunk.subarray(0, needed), filled);
        this.pcmQueue[0] = chunk.subarray(needed);
        filled += needed;
      }
    }

    this.queuedSampleCount -= filled;
    const first = !this.firstAudioSent;
    this.sendAudioFrame(frame, first);
  }

  private flushRemaining(): void {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;
    if (this.queuedSampleCount === 0) return;

    const frame = new Int16Array(this.queuedSampleCount);
    let filled = 0;

    while (filled < frame.length && this.pcmQueue.length > 0) {
      const chunk = this.pcmQueue.shift();
      if (!chunk) continue;
      frame.set(chunk, filled);
      filled += chunk.length;
    }

    this.queuedSampleCount = 0;
    const first = !this.firstAudioSent;
    this.sendAudioFrame(frame, first);
  }

  private handleMessage(raw: string): void {
    let message: {
      code?: number;
      message?: string;
      data?: {
        status?: number;
        result?: {
          sn?: number;
          pgs?: string;
          rg?: [number, number];
          ws?: Array<{
            cw?: Array<{ w?: string }>;
          }>;
        };
      };
    };

    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }

    if (message.code !== undefined && message.code !== 0) {
      const detail =
        typeof message.message === "string" && message.message
          ? `（${message.message}）`
          : "";

      if (message.code === 10165 && !this.ending) {
        console.warn("讯飞 IAT 句柄失效，自动重建会话", message);
        this.stopSendTimer();
        this.closeWebSocket();
        this.callbacks.onSessionEnd?.(this.latestFullText);
        return;
      }

      if (message.code === 10165 && this.ending) {
        this.stopSendTimer();
        this.closeWebSocket();
        this.callbacks.onEnd();
        this.cleanupAudio();
        return;
      }

      this.callbacks.onError({
        message: `讯飞语音识别返回错误：${message.code}${detail}`,
        fatal: true,
      });
      console.error("讯飞 IAT 错误帧", message);
      this.closeWebSocket();
      this.cleanupAudio();
      return;
    }

    const data = message.data;
    if (!data) return;

    const result = data.result;
    if (result) {
      const text = (result.ws ?? [])
        .map((segment) =>
          (segment.cw ?? []).map((word) => word.w ?? "").join(""),
        )
        .join("");

      if (!this.useDynamicCorrection && result.pgs) {
        this.useDynamicCorrection = true;
      }

      if (this.useDynamicCorrection) {
        if (
          result.pgs === "rpl" &&
          Array.isArray(result.rg) &&
          result.rg.length >= 2
        ) {
          const [start, end] = result.rg;
          for (let key = start; key <= end; key += 1) {
            this.segmentMap.delete(key);
          }
        }

        const sn =
          typeof result.sn === "number" ? result.sn : this.segmentMap.size + 1;
        if (text) {
          this.segmentMap.delete(sn);
          this.segmentMap.set(sn, text);
        }

        const joined = Array.from(this.segmentMap.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([, value]) => value)
          .join("");

        this.latestFullText = this.prefix + joined;
        this.callbacks.onText(this.latestFullText);
      } else {
        this.accumulatedText += text;
        this.latestFullText = this.prefix + this.accumulatedText;
        this.callbacks.onText(this.latestFullText);
      }
    }

    if (data.status === 2) {
      if (this.ending) {
        this.callbacks.onEnd();
      } else {
        this.stopSendTimer();
        this.callbacks.onSessionEnd?.(this.latestFullText);
      }
      this.closeWebSocket();
    }
  }

  private closeWebSocket(): void {
    if (this.websocket) {
      try {
        this.websocket.close();
      } catch {
        // 已关闭时忽略。
      }
      this.websocket = null;
    }
  }

  private cleanupAudio(): void {
    this.stopSendTimer();
    try {
      this.processor?.disconnect();
    } catch {
      // 已断开时忽略。
    }
    try {
      this.sourceNode?.disconnect();
    } catch {
      // 已断开时忽略。
    }
    try {
      void this.audioContext?.close();
    } catch {
      // 已关闭时忽略。
    }
    try {
      this.mediaStream?.getTracks().forEach((track) => track.stop());
    } catch {
      // 已停止时忽略。
    }

    this.processor = null;
    this.sourceNode = null;
    this.audioContext = null;
    this.mediaStream = null;
  }

  private downsample(
    buffer: Float32Array,
    exportSampleRate: number,
  ): Float32Array {
    if (exportSampleRate === this.recordSampleRate) {
      return buffer;
    }

    const ratio = this.recordSampleRate / exportSampleRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;

    while (offsetResult < newLength) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
      let accum = 0;
      let count = 0;
      for (
        let index = offsetBuffer;
        index < nextOffsetBuffer && index < buffer.length;
        index += 1
      ) {
        accum += buffer[index];
        count += 1;
      }
      result[offsetResult] = count > 0 ? accum / count : 0;
      offsetResult += 1;
      offsetBuffer = nextOffsetBuffer;
    }

    return result;
  }
}
