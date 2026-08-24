# AI 面试模拟助手

面向求职者的 AI 模拟面试工具，支持语音 / 文字作答、AI 自适应追问和按岗位配置的多维评分报告。当前覆盖 4 个岗位：AI 产品经理、产品经理、AGENT 开发工程师、大模型应用开发工程师。

[立即在线体验](https://ai-mock-interview.cyou/) · [反馈问题](https://github.com/lhw12138/ai-mock-interview/issues) · 如果它确实帮到你，欢迎 Star

无需注册：选岗位即可开始。产品围绕“模拟面试 → 可信诊断 → 弱项训练 → 再次作答 → 看见进步”设计，而不只是让 AI 随机提问。

## 核心体验

- **更接近真实面试**：支持语音与文字回答、语音念题、最多两轮上下文追问。
- **报告给出依据**：展示评分区间、量表、原回答证据、缺失点和改写示例。
- **报告之后继续练**：可立即重答弱题，或针对最弱能力开启 5 题专项训练。
- **游客也能保留进度**：进行中面试自动保存，可恢复；历史可导入、导出和一键清除。
- **默认即可使用**：站方默认 DeepSeek；自定义模型配置收纳在高级设置中。

> 训练反馈由 AI 生成，用于练习与复盘，不代表真实招聘结论。简历、回答和历史默认保存在当前浏览器；调用模型或语音识别时，必要数据会发送给对应服务商处理。

## 技术栈

- Next.js 16 App Router + React 18 + TypeScript
- Tailwind CSS + shadcn/ui 风格组件
- 语音识别：默认使用讯飞语音听写（流式版），优先保证识别稳定性
- Vercel AI SDK，默认 DeepSeek，内置智谱 GLM-4.5-Flash（免费）预设
- localStorage 保存游客历史与进行中会话，sessionStorage 默认保存自定义 API Key

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

## 阿里云函数计算（FC）按量托管（免备案、无请求不收费）

适合不想买服务器的情况：按实际使用量计费，无请求不收费，新用户每月有免费额度，默认域名国内可直接访问且无需备案。

1. 在项目根目录运行打包脚本，生成 `fc-package.zip`：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-fc-package.ps1
```

2. 登录阿里云控制台，开通「函数计算 FC」，选择靠近你用户的区域（如上海 / 杭州，速度更快；默认域名免备案）。
3. 创建函数：
   - 运行环境：**自定义运行时**（Custom Runtime）
   - 代码上传：选择本地 ZIP 包，上传 `fc-package.zip`
   - 启动命令：`node server.js`
   - 监听端口：`9000`
   - 内存建议：512 MB 及以上
   - 最小实例数：0（无请求不收费，首次访问稍慢属正常）
4. 在函数配置的环境变量中填入：
   - `DEEPSEEK_API_KEY`、`AI_MODEL=deepseek-v4-flash`、`AI_BASE_URL=https://api.deepseek.com`
   - 讯飞语音：`XF_APPID`、`XF_API_KEY`、`XF_API_SECRET`
5. 创建完成后，使用控制台提供的默认域名访问；后续要绑定自己的域名时，大陆区域需要完成 ICP 备案（可改用香港区域规避）。

## 当前范围

- 首页：选择岗位、练习/模拟模式、职级、面试轮次、题量；支持简历、JD 和上次面试恢复
- 面试页：AI 逐题提问、最多 2 轮追问、语音/文字回答、语音念题、收藏、跳过、保存退出与自动恢复
- 报告页：五维评分区间、评分量表、原回答证据、改写示例、逐题重答、最弱维度 5 题专项训练、二维码海报与 PDF 导出
- 历史记录：本地保存最近 20 场，展示总分与维度趋势；支持本地数据导入、导出和一键清除
- 题库：内置题库与“我的题目”分层浏览，支持筛选、分页、JSON 导入和手动管理
- 模型设置：默认收纳在高级设置；自定义 API Key 默认只保留在当前标签会话，用户可显式选择“记住此设备”

评分维度按岗位区分：产品岗为逻辑思维 / 产品 sense / 表达沟通 / AI 理解力 / 应变能力；技术岗（AGENT 开发工程师、大模型应用开发工程师）为技术深度 / 系统设计 / 工程实践 / 表达沟通 / 应变能力。总分由服务端按权重统一重算。

## 安全与质量

- 自定义模型地址仅允许 HTTPS，并阻断本机、私网、链路本地和云元数据地址
- 模型、报告、简历、模型测试与语音鉴权接口包含同源校验、基础限流和请求体大小限制
- 上游错误会转换为公开错误信息，不直接把服务商响应返回给浏览器
- 全站启用防嵌套、内容嗅探、来源与摄像头/麦克风权限等安全响应头
- 运行 `npm run lint`、`npm run typecheck`、`npm test` 和 `npm run build` 完成提交前验证

## 参与项目

欢迎提交 Bug、真实体验反馈或改进建议。开始贡献前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

本项目采用 [MIT License](LICENSE)。
