import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FeedbackForm } from "./feedback-form";

interface FeedbackPageProps {
  searchParams: Promise<{ from?: string | string[] }>;
}

function normalizeSourcePage(value?: string | string[]): string {
  const source = Array.isArray(value) ? value[0] : value;
  if (!source || !source.startsWith("/") || source.startsWith("//")) return "/";
  return source.slice(0, 200);
}

export default async function FeedbackPage({ searchParams }: FeedbackPageProps) {
  const params = await searchParams;
  const sourcePage = normalizeSourcePage(params.from);

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href={sourcePage}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-300 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          返回刚才的页面
        </Link>

        <div className="mt-8">
          <h1 className="max-w-xl text-balance text-3xl font-semibold tracking-[-0.025em] text-white sm:text-4xl">
            你的真实反馈，会直接决定下一步改什么
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
            无论是评分不可信、流程卡住，还是希望增加一个功能，都可以直接告诉开发者。通常 1 分钟内即可完成。
          </p>
        </div>

        <section className="mt-9 rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-[0_12px_36px_rgba(2,6,23,0.28)] sm:p-8">
          <FeedbackForm sourcePage={sourcePage} />
        </section>
      </div>
    </main>
  );
}
