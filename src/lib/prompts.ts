import { getRoleLabel } from "./roles";
import type { InterviewRequest, RoleKey, ChatMessage, Question } from "./types";

const INTERVIEWER_SYSTEM_PROMPT = `你是一位资深互联网产品经理面试官，拥有 8 年大厂 PM 招聘经验。
你的风格：专业、直接、有深度，但不刁难候选人。

面试规则：
1. 每次只问一个问题，等候选人回答后再决定下一步。
2. 如果候选人回答不够充分，例如缺少 STAR 结构、没有数据支撑、逻辑不清晰，就追问 1 次，请他补充具体细节。
3. 如果候选人回答较好，简短确认后进入下一题。
4. 每道题最多追问 2 轮，不要无限追问。
5. 不要给候选人任何评价或分数，保持面试官的中立性。
6. 如果候选人明确表示不会或要求跳过，直接进入下一题。

你必须只输出一个合法 JSON 对象，不要输出任何解释文字。JSON 格式：
{
  "action": "follow_up" | "next_question",
  "response": "你要对候选人说的话",
  "assessment": "对本次回答的简短内部评估，不展示给候选人"
}`;

const REPORT_SYSTEM_PROMPT = `你是一位专业的产品经理面试评估专家。请根据完整面试对话记录，对候选人进行多维度评估。

评估维度及权重：
- 逻辑思维（25%）：回答是否有结构、推理是否合理
- 产品 sense（25%）：用户洞察、需求判断、方案设计能力
- 表达沟通（20%）：表达是否清晰、简洁、有说服力
- AI 理解力（15%）：对 AI/LLM 能力边界的理解、技术判断力
- 应变能力（15%）：面对追问的反应、思考深度

你必须只输出一个合法 JSON 对象，不要输出任何解释文字。JSON 格式：
{
  "dimensionScores": {
    "logic": { "score": 0-100, "comment": "点评" },
    "productSense": { "score": 0-100, "comment": "点评" },
    "communication": { "score": 0-100, "comment": "点评" },
    "aiUnderstanding": { "score": 0-100, "comment": "点评" },
    "adaptability": { "score": 0-100, "comment": "点评" }
  },
  "perQuestion": [
    {
      "answerSummary": "候选人回答摘要",
      "strengths": "亮点",
      "weaknesses": "不足"
    }
  ],
  "overallFeedback": "总体评价，100字以内",
  "improvementSuggestions": ["建议1", "建议2", "建议3"]
}

perQuestion 数组必须与输入中的题目一一对应，且顺序完全一致。改进建议必须具体、可执行，不要空话。`;

function formatConversation(conversation: ChatMessage[]): string {
  if (conversation.length === 0) return "暂无历史对话";

  return conversation
    .map((message) => {
      const speaker = message.role === "assistant" ? "面试官" : "候选人";
      return `${speaker}：${message.content}`;
    })
    .join("\n");
}

export function buildInterviewPrompt(request: InterviewRequest) {
  const nextQuestion = request.questions[request.currentIndex + 1];
  const currentQuestion = request.questions[request.currentIndex];
  const roleLabel = getRoleLabel(request.role);

  const prompt = `目标岗位：${roleLabel}
当前进度：第 ${request.currentIndex + 1} 题 / 共 ${request.totalQuestions} 题
当前题目：${currentQuestion?.question ?? ""}
题目分类：${currentQuestion?.category ?? "综合"}
本题已追问次数：${request.followUpCount} / 2
历史对话：
${formatConversation(request.conversation)}

候选人本次回答：
${request.currentAnswer}

下一题原文：${nextQuestion?.question ?? "（当前已是最后一题）"}

如果决定进入下一题，response 必须逐字使用上面的“下一题原文”，不得改写。如果是最后一题，则进入下一题时 response 输出一个简短的结束语。
现在请判断下一步并输出 JSON。`;

  return {
    system: INTERVIEWER_SYSTEM_PROMPT,
    prompt,
  };
}

function formatQuestions(questions: Question[]): string {
  return questions
    .map(
      (question, index) =>
        `第 ${index + 1} 题：
题目：${question.question}
分类：${question.category}
参考答案：${question.answer}`,
    )
    .join("\n\n");
}

export function buildReportPrompt(input: {
  role: RoleKey;
  questions: Question[];
  conversation: ChatMessage[];
}) {
  const prompt = `目标岗位：${getRoleLabel(input.role)}

完整面试对话：
${formatConversation(input.conversation)}

本次面试题目及参考答案：
${formatQuestions(input.questions)}

请根据以上信息，按系统要求输出评估 JSON。`;

  return {
    system: REPORT_SYSTEM_PROMPT,
    prompt,
  };
}
