"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpenText,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  aiProductManagerQuestions,
  productManagerQuestions,
} from "@/lib/questions";
import {
  addCustomQuestion,
  deleteCustomQuestion,
  loadCustomQuestions,
  updateCustomQuestion,
} from "@/lib/storage";
import { getRoleLabel, ROLE_OPTIONS } from "@/lib/roles";
import type { CustomQuestion, Question, RoleKey } from "@/lib/types";

type DisplayQuestion = Question & {
  role: RoleKey;
  custom: boolean;
};

function buildDisplayQuestions(): DisplayQuestion[] {
  const aiPmQuestions = aiProductManagerQuestions.map((question) => ({
    ...question,
    role: "ai_pm" as RoleKey,
    custom: false,
  }));
  const pmQuestions = productManagerQuestions.map((question) => ({
    ...question,
    role: "pm" as RoleKey,
    custom: false,
  }));
  const customQuestions = loadCustomQuestions().map((question) => ({
    ...question,
    custom: true,
  }));

  return [...customQuestions, ...aiPmQuestions, ...pmQuestions];
}

function normalizeUploadedItem(
  item: unknown,
  index: number,
): CustomQuestion | null {
  if (!item || typeof item !== "object") return null;
  const candidate = item as Partial<CustomQuestion>;

  if (
    typeof candidate.question !== "string" ||
    typeof candidate.answer !== "string"
  ) {
    return null;
  }

  const role: RoleKey =
    candidate.role === "pm" || candidate.role === "ai_pm"
      ? candidate.role
      : "ai_pm";

  return {
    id: Date.now() + index,
    role,
    question: candidate.question.trim(),
    category: typeof candidate.category === "string" ? candidate.category.trim() : "自定义题目",
    answer: candidate.answer.trim(),
  };
}

export default function QuestionBankPage() {
  const router = useRouter();
  const [questions, setQuestions] = React.useState<DisplayQuestion[]>([]);
  const [roleFilter, setRoleFilter] = React.useState<"all" | RoleKey>("all");
  const [search, setSearch] = React.useState("");
  const [formRole, setFormRole] = React.useState<RoleKey>("ai_pm");
  const [formCategory, setFormCategory] = React.useState("");
  const [formQuestion, setFormQuestion] = React.useState("");
  const [formAnswer, setFormAnswer] = React.useState("");
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [notice, setNotice] = React.useState("");

  React.useEffect(() => {
    setQuestions(buildDisplayQuestions());
  }, []);

  function refresh(): void {
    setQuestions(buildDisplayQuestions());
  }

  function resetForm(): void {
    setEditingId(null);
    setFormRole("ai_pm");
    setFormCategory("");
    setFormQuestion("");
    setFormAnswer("");
  }

  function handleSave(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (!formQuestion.trim() || !formAnswer.trim()) {
      setNotice("请填写题目和参考答案。");
      return;
    }

    const question: CustomQuestion = {
      id: editingId ?? Date.now(),
      role: formRole,
      category: formCategory.trim() || "自定义题目",
      question: formQuestion.trim(),
      answer: formAnswer.trim(),
    };

    if (editingId === null) {
      addCustomQuestion(question);
    } else {
      updateCustomQuestion(question);
    }

    setNotice(editingId === null ? "题目已添加。" : "题目已更新。");
    resetForm();
    refresh();
  }

  function handleEdit(question: DisplayQuestion): void {
    setEditingId(question.id);
    setFormRole(question.role);
    setFormCategory(question.category);
    setFormQuestion(question.question);
    setFormAnswer(question.answer);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleDelete(question: DisplayQuestion): void {
    if (!window.confirm("确定要删除这道自定义题目吗？")) return;
    deleteCustomQuestion(question.id);
    setNotice("题目已删除。");
    refresh();
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown[];
      if (!Array.isArray(parsed)) {
        setNotice("JSON 文件格式不正确，应该是一个题目数组。");
        return;
      }

      const validQuestions = parsed
        .map(normalizeUploadedItem)
        .filter((item): item is CustomQuestion => item !== null);

      if (validQuestions.length === 0) {
        setNotice("没有解析到有效题目，请检查 JSON 格式。");
        return;
      }

      validQuestions.forEach((question) => addCustomQuestion(question));
      setNotice(`成功导入 ${validQuestions.length} 道题目。`);
      event.target.value = "";
      refresh();
    } catch {
      setNotice("文件读取或解析失败，请检查是否为合法 JSON。");
    }
  }

  const filteredQuestions = React.useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return questions.filter((question) => {
      const roleMatches = roleFilter === "all" || question.role === roleFilter;
      const textMatches =
        !keyword ||
        question.question.toLowerCase().includes(keyword) ||
        question.category.toLowerCase().includes(keyword);
      return roleMatches && textMatches;
    });
  }, [questions, roleFilter, search]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
          <ArrowLeft className="h-4 w-4" />
          返回首页
        </Button>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <BookOpenText className="h-4 w-4" />
          题库管理
        </div>
      </div>

      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white">产品经理面试题库</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          查看内置题目，也可以上传 JSON 或手动新增、修改自己的题目。自定义题目会参与后续随机抽题。
        </p>
      </div>

      <Card className="mb-6">
        <CardContent className="p-5">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1">
                <span className="mb-1 block text-xs text-slate-400">岗位</span>
                <select
                  value={formRole}
                  onChange={(event) => setFormRole(event.target.value as RoleKey)}
                  className="h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm text-slate-200"
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex-1">
                <span className="mb-1 block text-xs text-slate-400">分类</span>
                <input
                  value={formCategory}
                  onChange={(event) => setFormCategory(event.target.value)}
                  placeholder="例如：用户增长"
                  className="h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm text-slate-200 placeholder:text-slate-600"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">题目</span>
              <Textarea
                value={formQuestion}
                onChange={(event) => setFormQuestion(event.target.value)}
                placeholder="输入面试题目"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">参考答案</span>
              <Textarea
                value={formAnswer}
                onChange={(event) => setFormAnswer(event.target.value)}
                placeholder="输入参考思路或参考答案"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit">
                {editingId === null ? <Plus className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                {editingId === null ? "新增题目" : "保存修改"}
              </Button>
              {editingId !== null && (
                <Button type="button" variant="ghost" onClick={resetForm}>
                  取消编辑
                </Button>
              )}
              <label className="ml-auto inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 hover:bg-white/10">
                <Upload className="h-4 w-4" />
                上传 JSON 题库
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleUpload}
                />
              </label>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索题目或分类"
            className="h-10 w-full rounded-lg border border-white/10 bg-slate-950 pl-10 pr-3 text-sm text-slate-200 placeholder:text-slate-600"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value as "all" | RoleKey)}
          className="h-10 rounded-lg border border-white/10 bg-slate-950 px-3 text-sm text-slate-200"
        >
          <option value="all">全部岗位</option>
          {ROLE_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {notice && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {notice}
        </div>
      )}

      <div className="space-y-4">
        {filteredQuestions.map((question) => (
          <Card key={`${question.role}-${question.id}`}>
            <CardContent className="p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-violet-300">
                      {getRoleLabel(question.role)}
                    </span>
                    <span className="text-slate-500">{question.category}</span>
                    {question.custom && (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-300">
                        自定义
                      </span>
                    )}
                  </div>
                  <div className="font-medium leading-6 text-slate-200">
                    {question.question}
                  </div>
                </div>
                {question.custom && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      className="rounded-md p-2 text-slate-500 hover:bg-blue-500/10 hover:text-blue-300"
                      onClick={() => handleEdit(question)}
                      aria-label="编辑题目"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="rounded-md p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-300"
                      onClick={() => handleDelete(question)}
                      aria-label="删除题目"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              <details className="group rounded-xl border border-white/10 bg-slate-950/40">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm text-blue-300">
                  查看参考答案
                </summary>
                <p className="whitespace-pre-wrap border-t border-white/10 px-4 py-3 text-sm leading-6 text-slate-400">
                  {question.answer}
                </p>
              </details>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
