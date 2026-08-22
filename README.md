# AI 面试模拟助手

面向中国产品经理求职者的 AI 模拟面试工具，支持语音 / 文字作答、AI 自适应追问和五维评分报告。

## 技术栈

- Next.js 14 App Router + React + TypeScript
- Tailwind CSS + shadcn/ui 风格组件
- 语音识别：默认使用讯飞语音听写（流式版），优先保证识别稳定性
- Vercel AI SDK + DeepSeek API
- localStorage 保存面试记录

## 本地运行

1. 安装依赖：

```bash
npm install
```

2. 配置环境变量：

```bash
cp .env.example .env.local
```

在 `.env.local` 中填入 `DEEPSEEK_API_KEY`，以及讯飞语音识别的 `XF_APPID`、`XF_API_KEY`、`XF_API_SECRET`。

3. 启动开发服务器：

```bash
npm run dev
```

浏览器打开 `http://localhost:3000`。语音功能需要在 `localhost` 或 HTTPS 下运行，建议使用 Chrome / Edge。

## 语音识别策略

为了优先保证识别稳定性，当前默认使用讯飞语音听写（流式版）。讯飞单次识别上限为 60 秒；达到限制前会自动续接，并保留此前已经识别出来的文字，无需重新录入。

讯飞密钥只放在服务端，浏览器通过 `/api/asr/auth` 获取带签名的临时 WebSocket 地址，密钥不会暴露给前端。文字输入始终保留，识别结果提交前可以手动检查修正。

## 环境变量

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | DeepSeek API Key，必填 | 无 |
| `AI_MODEL` | DeepSeek 模型标识 | `deepseek-chat` |
| `AI_BASE_URL` | OpenAI 兼容接口地址 | `https://api.deepseek.com` |
| `XF_APPID` | 讯飞开放平台应用 AppID | 无 |
| `XF_API_KEY` | 讯飞应用 APIKey | 无 |
| `XF_API_SECRET` | 讯飞应用 APISecret | 无 |

## 部署到 Vercel

1. 将项目推送到 GitHub。
2. 在 Vercel 新建项目并导入仓库。
3. 在 Project Settings 中添加 `DEEPSEEK_API_KEY`、`AI_MODEL`、`AI_BASE_URL` 以及讯飞相关的三个环境变量。
4. 点击 Deploy。

讯飞语音识别的 WebSocket 由浏览器直连，Vercel 只需承担一个轻量的鉴权接口，适合 Serverless 部署。

## 当前范围

- 首页：选择岗位和题目数量
- 面试页：AI 逐题提问、语音/文字回答、最多 2 轮追问
- 报告页：五维评分雷达图、逐题点评、改进建议
- 题库：复用本地题库文件，AI 负责追问和评分，不随机生成题目
