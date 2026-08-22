"use client";

import * as React from "react";
import { WebSpeechAsr } from "./web-speech-asr";
import { IatAsr } from "./iat-asr";
import type { AsrEngine } from "./types";

export function useAsr(onText: (text: string) => void) {
  const [engine, setEngine] = React.useState<AsrEngine>("xfyun");
  const [listening, setListening] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");

  const onTextRef = React.useRef(onText);
  onTextRef.current = onText;

  const engineRef = React.useRef<AsrEngine>(engine);
  const latestTextRef = React.useRef("");
  const listeningRef = React.useRef(false);
  const iatRestartTimerRef = React.useRef<number | null>(null);
  const webRef = React.useRef<WebSpeechAsr | null>(null);
  const iatRef = React.useRef<IatAsr | null>(null);

  const clearIatRestartTimer = React.useCallback(() => {
    if (iatRestartTimerRef.current !== null) {
      window.clearTimeout(iatRestartTimerRef.current);
      iatRestartTimerRef.current = null;
    }
  }, []);

  const startIat = React.useCallback((initialText = "") => {
    iatRef.current?.dispose();
    clearIatRestartTimer();
    setError("");
    listeningRef.current = true;
    setListening(true);

    const iat = new IatAsr(
      {
        onText: (text) => {
          latestTextRef.current = text;
          onTextRef.current(text);
        },
        onError: (err) => {
          clearIatRestartTimer();
          listeningRef.current = false;
          setError(err.message);
          setListening(false);
        },
        onEnd: () => {
          clearIatRestartTimer();
          listeningRef.current = false;
          setListening(false);
        },
        onSessionEnd: (text) => {
          latestTextRef.current = text;
          if (listeningRef.current && engineRef.current === "xfyun") {
            startIat(text);
          }
        },
      },
      initialText,
    );
    iatRef.current = iat;
    void iat.start();

    iatRestartTimerRef.current = window.setTimeout(() => {
      iatRestartTimerRef.current = null;
      if (listeningRef.current && iatRef.current) {
        startIat(latestTextRef.current);
      }
    }, 55000);
  }, [clearIatRestartTimer]);

  const startWeb = React.useCallback(
    (initialText = "") => {
      webRef.current?.dispose();
      clearIatRestartTimer();
      setError("");
      listeningRef.current = true;
      setListening(true);

      const web = new WebSpeechAsr(
        {
          onText: (text) => onTextRef.current(text),
          onError: (err) => {
            if (err.fatal && engineRef.current === "web") {
              engineRef.current = "xfyun";
              setEngine("xfyun");
              setNotice(
                "浏览器语音服务不可用，已自动切换到讯飞语音识别，请继续说。",
              );
              webRef.current?.dispose();
              webRef.current = null;
              startIat(err.carryover ?? "");
            } else {
              listeningRef.current = false;
              setError(err.message);
              setListening(false);
            }
          },
          onEnd: () => {
            listeningRef.current = false;
            setListening(false);
          },
        },
        initialText,
      );
      webRef.current = web;
      void web.start();
    },
    [startIat, clearIatRestartTimer],
  );

  const start = React.useCallback(
    (seedText = "") => {
      setError("");
      setNotice("");
      if (engineRef.current === "web") {
        startWeb(seedText);
      } else {
        startIat(seedText);
      }
    },
    [startWeb, startIat],
  );

  const stop = React.useCallback(() => {
    listeningRef.current = false;
    clearIatRestartTimer();
    setListening(false);
    webRef.current?.stop();
    iatRef.current?.stop();
  }, [clearIatRestartTimer]);

  const cancel = React.useCallback(() => {
    listeningRef.current = false;
    clearIatRestartTimer();
    setListening(false);
    webRef.current?.dispose();
    iatRef.current?.dispose();
    webRef.current = null;
    iatRef.current = null;
  }, [clearIatRestartTimer]);

  const retry = React.useCallback(
    (seedText = "") => {
      start(seedText);
    },
    [start],
  );

  React.useEffect(() => {
    return () => {
      clearIatRestartTimer();
      webRef.current?.dispose();
      iatRef.current?.dispose();
      webRef.current = null;
      iatRef.current = null;
    };
  }, [clearIatRestartTimer]);

  return { engine, listening, error, notice, start, stop, cancel, retry };
}
