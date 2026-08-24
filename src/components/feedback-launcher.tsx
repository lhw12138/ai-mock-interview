"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquareText } from "lucide-react";

export function FeedbackLauncher() {
  const pathname = usePathname();

  if (pathname === "/feedback") return null;

  return (
    <Link
      href={`/feedback?from=${encodeURIComponent(pathname)}`}
      className="print-hidden fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-100 px-3.5 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_8px_24px_rgba(2,6,23,0.34)] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:right-6"
      aria-label="向开发者反馈问题或建议"
    >
      <MessageSquareText className="h-4 w-4" aria-hidden="true" />
      <span>反馈</span>
    </Link>
  );
}
