# AI 面试模拟助手

面向求职者的 AI 模拟面试工具，支持语音 / 文字作答、AI 自适应追问和按岗位配置的多维评分报告。当前覆盖 4 个岗位：AI 产品经理、产品经理、AGENT 开发工程师、大模型应用开发工程师。

## 技术栈

- Next.js 14 App Router + React + TypeScript
- Tailwind CSS + shadcn/ui 风格组件
- 语音识别：默认使用讯飞语音听写（流式版），优先保证识别稳定性
- Vercel AI SDK，默认 DeepSeek，内置智谱 GLM-4.5-Flash（免费）预设
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
| `AI_MODEL` | DeepSeek 模型标识 | `deepseek-v4-flash` |
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

## 国内服务器部署（推荐，香港轻量服务器免备案）

如果面向国内用户访问，建议使用香港轻量云服务器（阿里云 / 腾讯云均可，无需备案），通过 Docker + Caddy 一键部署，自动配置 HTTPS。

1. 准备一台香港轻量服务器（建议 2 核 2G 以上），安装 Docker 与 Docker Compose。
2. 在服务器上拉取代码：

```bash
git clone https://github.com/lhw12138/ai-mock-interview.git
cd ai-mock-interview
```

3. 准备环境变量（把 `.env.example` 复制为 `.env`，填入 DeepSeek 与讯飞密钥，`.env` 不会进入 git）：

```bash
cp .env.example .env
```

4. 配置域名：把域名解析到服务器 IP，然后在 `docker-compose.yml` 同级创建 `.env` 时额外设置 `DOMAIN=你的域名`，或直接编辑 `Caddyfile` 顶部域名。
5. 构建并启动：

```bash
docker compose up -d --build
```

6. 等待 1-2 分钟，Caddy 会自动申请 HTTPS 证书，访问 `https://你的域名` 即可。

## 当前范围

- 首页：选择岗位（4 个岗位）、题目数量（5/8/10 题），可选填写简历并按难度生成针对性提问
- 面试页：AI 逐题提问、最多 2 轮追问、语音/文字回答、语音念题、收藏题目、跳过 / 提前结束
- 报告页：按岗位配置的多维评分雷达图（产品岗五维 / 技术岗五维）、逐题点评、改进建议、分享海报与 PDF 导出
- 历史记录：本地保存最近 20 场面试，支持删除与分数趋势图
- 题库：内置题库 + 自定义题目，支持 JSON 导入、手动增删改；可选“避开最近练过的题目”后再开始面试
- 模型设置：内置 DeepSeek（站方默认）与智谱 GLM-4.5-Flash（免费）预设，也可填写自定义 API 地址、模型名称和 API Key；自定义配置可先点“测试连接”验证，切换服务商后需重新填写该服务商的 API Key

评分维度按岗位区分：产品岗为逻辑思维 / 产品 sense / 表达沟通 / AI 理解力 / 应变能力；技术岗（AGENT 开发工程师、大模型应用开发工程师）为技术深度 / 系统设计 / 工程实践 / 表达沟通 / 应变能力。总分由服务端按权重统一重算。
