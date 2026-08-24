"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trackAnalytics } from "@/lib/analytics";
import { feedbackCategories } from "@/lib/feedback";

interface FeedbackFormProps {
  sourcePage: string;
}

export function FeedbackForm({ sourcePage }: FeedbackFormProps) {
  const [category, setCategory] = useState<(typeof feedbackCategories)[number]>(
    "功能问题",
  );
  const [rating, setRating] = useState(4);
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim() || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          rating,
          message,
          contact: contact.trim() || undefined,
          sourcePage,
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "反馈暂时发送失败，请稍后重试。");
      }

      trackAnalytics({ type: "feedback_submit", category, rating });
      setSubmitted(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "反馈暂时发送失败，请稍后重试。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <section
        className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] px-6 py-10 text-center sm:px-10"
        aria-live="polite"
      >
        <CheckCircle2 className="mx-auto h-11 w-11 text-emerald-300" aria-hidden="true" />
        <h2 className="mt-5 text-2xl font-semibold text-white">谢谢，反馈已收到</h2>
        <p className="mx-auto mt-3 max-w-md text-base leading-7 text-emerald-50/75">
          你的反馈已经直接发送给开发者，会用于判断下一步最值得改进的问题。
        </p>
        <Button asChild className="mt-7">
          <Link href={sourcePage === "/feedback" ? "/" : sourcePage}>返回刚才的页面</Link>
        </Button>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7" noValidate>
      <fieldset>
        <legend className="text-sm font-semibold text-slate-200">反馈类型</legend>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {feedbackCategories.map((item) => (
            <label
              key={item}
              className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-3 py-2.5 text-center text-sm font-medium transition ${
                category === item
                  ? "border-blue-400 bg-blue-500/15 text-blue-100"
                  : "border-white/10 bg-slate-950/50 text-slate-300 hover:border-white/20 hover:text-white"
              }`}
            >
              <input
                type="radio"
                name="category"
                value={item}
                checked={category === item}
                onChange={() => setCategory(item)}
                className="sr-only"
              />
              <span>{item}</span>
              {category === item && <span className="sr-only">，已选择</span>}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-slate-200">
          这次体验整体满意吗？
        </legend>
        <div className="mt-3 flex max-w-sm gap-2" role="radiogroup">
          {[1, 2, 3, 4, 5].map((score) => (
            <label
              key={score}
              className={`flex h-11 min-w-11 flex-1 cursor-pointer items-center justify-center rounded-xl border text-sm font-semibold transition ${
                rating === score
                  ? "border-blue-400 bg-blue-500/15 text-blue-100"
                  : "border-white/10 bg-slate-950/50 text-slate-300 hover:border-white/20 hover:text-white"
              }`}
            >
              <input
                type="radio"
                name="rating"
                value={score}
                checked={rating === score}
                onChange={() => setRating(score)}
                className="sr-only"
              />
              {score}
              <span className="sr-only"> 分{rating === score ? "，已选择" : ""}</span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">1 分非常不满意，5 分非常满意</p>
      </fieldset>

      <div>
        <div className="flex items-baseline justify-between gap-4">
          <label htmlFor="feedback-message" className="text-sm font-semibold text-slate-200">
            具体发生了什么？
          </label>
          <span className="text-xs tabular-nums text-slate-500">{message.length}/2000</span>
        </div>
        <Textarea
          id="feedback-message"
          value={message}
          onChange={(event) => setMessage(event.target.value.slice(0, 2000))}
          minLength={1}
          maxLength={2000}
          required
          rows={7}
          className="mt-3"
          placeholder="例如：报告说我没有提供数据，但原回答中已经提到了转化率。希望能标出评分依据。"
          aria-describedby="feedback-privacy"
        />
      </div>

      <div>
        <label htmlFor="feedback-contact" className="text-sm font-semibold text-slate-200">
          联系方式 <span className="font-normal text-slate-500">（选填）</span>
        </label>
        <input
          id="feedback-contact"
          value={contact}
          onChange={(event) => setContact(event.target.value.slice(0, 120))}
          maxLength={120}
          autoComplete="email"
          className="mt-3 h-12 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 text-base text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
          placeholder="邮箱、微信或其他方便联系的方式"
        />
      </div>

      <p
        id="feedback-privacy"
        className="rounded-xl bg-slate-950/55 px-4 py-3 text-sm leading-6 text-slate-400"
      >
        请不要填写简历原文、面试回答、API Key、手机号等敏感信息。系统只会附带来源页面和浏览器设备信息。
      </p>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-100"
        >
          {error}
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full sm:w-auto"
        disabled={submitting || !message.trim()}
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            正在发送
          </>
        ) : (
          <>
            <Send className="h-4 w-4" aria-hidden="true" />
            提交反馈
          </>
        )}
      </Button>
    </form>
  );
}
