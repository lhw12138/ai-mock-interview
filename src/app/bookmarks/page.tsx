"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bookmark, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { loadBookmarks, removeBookmark } from "@/lib/storage";
import type { Question } from "@/lib/types";

export default function BookmarksPage() {
  const router = useRouter();
  const [bookmarks, setBookmarks] = React.useState<Question[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setBookmarks(loadBookmarks());
    setLoading(false);
  }, []);

  function handleRemove(id: number): void {
    removeBookmark(id);
    setBookmarks((items) => items.filter((item) => item.id !== id));
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
          <ArrowLeft className="h-4 w-4" />
          返回首页
        </Button>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Bookmark className="h-4 w-4" />
          收藏题目
        </div>
      </div>

      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          我的收藏
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">
          面试中遇到想重点复习的题目，可以收藏在这里。
        </p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400">正在读取收藏…</div>
      ) : bookmarks.length === 0 ? (
        <Card>
          <CardContent className="px-6 py-16 text-center">
            <div className="mb-3 text-slate-300">还没有收藏题目</div>
            <p className="mb-5 text-sm text-slate-500">
              面试过程中点击题目旁的收藏按钮，即可加入这里。
            </p>
            <Button onClick={() => router.push("/")}>去开始面试</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {bookmarks.map((question) => (
            <Card key={question.id}>
              <CardContent className="p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-1 text-xs text-violet-300">
                      {question.category}
                    </div>
                    <div className="font-medium leading-6 text-slate-200">
                      {question.question}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-slate-500 hover:text-red-300"
                    onClick={() => handleRemove(question.id)}
                    aria-label="取消收藏"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <details className="group rounded-xl border border-white/10 bg-slate-950/40">
                  <summary className="cursor-pointer list-none px-4 py-3 text-sm text-blue-300">
                    查看参考思路
                  </summary>
                  <p className="whitespace-pre-wrap border-t border-white/10 px-4 py-3 text-sm leading-6 text-slate-400">
                    {question.answer}
                  </p>
                </details>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
