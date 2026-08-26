import type { Question } from "./types";

interface RawQuestion {
  role?: unknown;
  question?: unknown;
  category?: unknown;
  answer?: unknown;
}

export function loadBuiltInQuestionBank(
  input: unknown,
  options: { expectedRole: string; startId: number; bankName: string },
): Question[] {
  if (!Array.isArray(input)) {
    throw new Error(`${options.bankName}题库不是数组`);
  }

  const seenQuestions = new Set<string>();
  return input.map((rawValue, index) => {
    const raw = rawValue as RawQuestion;
    if (
      !raw ||
      raw.role !== options.expectedRole ||
      typeof raw.question !== "string" ||
      !raw.question.trim() ||
      raw.question.length > 2000 ||
      typeof raw.category !== "string" ||
      !raw.category.trim() ||
      raw.category.length > 200 ||
      typeof raw.answer !== "string" ||
      !raw.answer.trim() ||
      raw.answer.length > 10000
    ) {
      throw new Error(`${options.bankName}题库第 ${index + 1} 题格式不正确`);
    }

    const normalizedQuestion = raw.question.replace(/\s+/g, "").toLowerCase();
    if (seenQuestions.has(normalizedQuestion)) {
      throw new Error(`${options.bankName}题库存在重复题：${raw.question}`);
    }
    seenQuestions.add(normalizedQuestion);

    return {
      id: options.startId + index,
      question: raw.question.trim(),
      category: raw.category.trim(),
      answer: raw.answer.trim(),
    };
  });
}
