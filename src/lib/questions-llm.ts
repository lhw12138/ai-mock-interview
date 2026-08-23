// ============================================================
// 大模型应用开发工程师面试题库（65题）
// 覆盖：RAG/Prompt工程/微调/模型选型/Token成本/推理部署/向量数据库/评估/应用架构/多模态/安全/可观测性
// ============================================================
import type { Question } from "./questions";

export const llmDevQuestions: Question[] = [
  { id: 301, question: `什么是RAG？它解决了大模型的哪些问题？`, category: `RAG基础`, answer: `RAG（Retrieval-Augmented Generation，检索增强生成）的核心思路是先从外部知识库检索相关资料，再把资料和问题一起交给大模型回答。它解决三个典型问题：

1. **知识不够新**：大模型的训练数据有截止日期，无法获取最新信息。
2. **内部知识缺失**：大模型不包含企业内部文档、产品手册等私有数据。
3. **回答无法溯源**：纯生成模型的输出无法验证来源，RAG可以引用具体文档。

RAG不能完全消灭幻觉，但能把回答约束在可检索的知识范围内。面试一句话概括：RAG是把大模型的生成能力和企业知识库的事实依据结合起来 (CSDN-69道RAG面试题)。` },
  { id: 302, question: `RAG的完整工作流程是什么？`, category: `RAG基础、架构`, answer: `RAG流程分为**离线阶段**和**在线阶段**：

**离线阶段（索引构建）：**
1. 文档采集（PDF/Word/Markdown/网页等）
2. 解析与清洗（去页眉页脚、去重、过滤无效内容）
3. 文本分块（Chunking）
4. Embedding向量化
5. 写入向量数据库

**在线阶段（查询生成）：**
1. 用户提问 → Query预处理（改写、扩展、意图识别）
2. 向量检索 + 关键词检索（混合检索）
3. Rerank重排序
4. 组装Prompt（问题 + 检索上下文）
5. 调用LLM生成回答
6. 引用展示、敏感词过滤、日志记录

核心步骤是文档处理、检索召回、上下文构造、生成回答。真正影响效果的是分块质量、Embedding模型、检索策略、Prompt约束和评估闭环 (CSDN-69道RAG面试题)。` },
  { id: 303, question: `RAG和模型微调有什么区别？如何选择？`, category: `RAG、微调、选型`, answer: `维度 | RAG | 微调
解决问题 | "知识从哪里来" | "模型怎么说、怎么按固定模式做事"
适用场景 | 知识频繁更新、需引用来源、内部资料问答 | 固定任务/风格、分类抽取、格式化输出
知识更新 | 实时更新文档即可 | 需要重新训练，周期长
成本 | 检索+推理成本 | 训练成本高，但推理成本低
可解释性 | 高（可溯源到具体文档） | 低（黑盒）

**选择原则：**
• 问题是**知识缺失** → 优先RAG
• 问题是**行为/格式不稳定** → 考虑微调
• 生产中常见组合：RAG提供知识，微调或Prompt约束回答风格和任务格式 (GitHub-LLMInterviewQuestions) (CSDN-69道RAG面试题)` },
  { id: 304, question: `常见的文档分块策略有哪些？如何选择chunk_size和overlap？`, category: `RAG、文档处理、Chunking`, answer: `**常见分块策略：**

策略 | 原理 | 优点 | 缺点
固定长度分块 | 按字符/token数切分 | 实现简单 | 容易切断语义
按段落分块 | 按自然段落切分 | 语义自然 | 段落长度不均
按标题层级分块 | 按Markdown/文档标题结构切分 | 保留章节语义 | 依赖文档结构
递归分块 | 按标题→段落→句子逐级切 | 兼顾结构与粒度 | LangChain常用
语义分块 | 根据embedding相似度变化切分 | 语义完整性最好 | 计算成本高
父子分块 | 小块检索，父块生成 | 兼顾精度与上下文 | 实现复杂

**chunk_size和overlap设置：**
• 中文建议chunk_size 500~1000中文字符，overlap 50~150
• FAQ类短文本可更小，技术文档和制度文档可稍大
• overlap防止上下文被切断，但太大会增加重复召回和成本
• 最终必须通过评测集验证Recall@K和答案准确率，不能仅凭经验拍参数 (CSDN-69道RAG面试题) (掘金-RAG篇)` },
  { id: 305, question: `RAG中如何处理PDF中的复杂表格和图片？`, category: `RAG、文档处理、PDF`, answer: `**表格处理：**
1. 简单表格转成Markdown table格式，保留表头、行列、单位
2. 跨页表格先合并再切分，避免一半表格单独入库
3. 合并单元格要补全语义（上级表头下沉到每行）
4. 大表格按主题/行组/业务对象拆成多个chunk
5. 表格chunk单独入库，metadata标记为table，检索时加权
6. 对金额、指标、配置项类表格，建议同时建结构化索引，不能只靠向量检索

**图片处理：**
1. 先判断图片是否有业务价值，装饰图过滤
2. 流程图、架构图、截图、票据类图片保留
3. 文字型图片用OCR提取文字，记录页码和位置
4. 业务图用多模态模型生成简短描述，作为文本chunk入库
5. 回答时引用图片来源，必要时返回原图链接 (CSDN-69道RAG面试题)` },
  { id: 306, question: `什么是混合检索？如何实现向量检索和关键词检索的融合？`, category: `RAG、检索策略、混合检索`, answer: `混合检索同时使用**语义检索（向量）**和**关键词检索（BM25）**召回文档：

• **向量检索**：擅长同义表达、语义理解，但专有名词/数字/ID精确匹配差
• **BM25检索**：基于词频和逆文档频率，精确匹配好，但不懂同义词

**融合方式：**
1. **加权求和**：分别计算归一化分数后加权
2. **RRF（Reciprocal Rank Fusion）**：score = Σ 1/(k + rank_i)，不依赖分数绝对值，最常用
3. **先召回再Rerank**：分别取Top-K，合并去重后交给Reranker精排

生产首选混合检索+Rerank，特别适合业务文档中有大量术语、型号、接口名、配置项的场景 (CSDN-69道RAG面试题) (CSDN-RAG面试题全解)。` },
  { id: 307, question: `RAG中Rerank的作用是什么？召回与重排有什么区别？`, category: `RAG、Rerank、检索优化`, answer: `**召回阶段（Retrieval）：**
• 目标：从海量文档中**快速筛选**出可能相关的候选集
• 追求**高召回率**，宁可错杀不可放过
• 使用向量相似度搜索（Bi-Encoder），速度快但精度较低
• 一般召回几十到几百个结果

**重排阶段（Reranking）：**
• 目标：对候选集进行**精确排序**，找出最相关的文档
• 追求**高准确率**
• 使用Cross-Encoder直接计算Query和文档的交互相关性
• 速度较慢但精度高，一般只处理Top-K个候选

**为什么分两阶段：** 如果直接用Cross-Encoder对所有文档打分，计算量太大。先用向量检索快速召回候选，再用重排模型精确排序，是效率和效果的平衡。

**常用Reranker：** bge-reranker、Cohere Rerank、Cross-Encoder。典型流程：向量+BM25先召回Top 20，Rerank后取Top 3~5送入LLM (掘金-RAG篇) (CSDN-69道RAG面试题)。` },
  { id: 308, question: `什么是HyDE？什么是子查询检索？什么是回溯检索？`, category: `RAG、高级检索策略`, answer: `**HyDE（Hypothetical Document Embeddings）：**
让大模型先根据问题生成一段"假设答案"，再用这段文本去检索。不是直接相信假设答案，而是用更完整的语义表达帮助召回。适合用户问题很短、语义不充分的场景，需配合Rerank防止跑偏。

**子查询检索（Sub-Query Retrieval）：**
把复杂问题拆成多个简单子问题分别检索。例如"新用户活动怎么配置，失败怎么排查？"拆成"新用户活动配置流程"和"活动配置失败排查方法"，每个子查询分别召回，再合并去重和Rerank。适合多意图、跨文档问题。

**回溯检索（Parent Document Retrieval）：**
小块用于精确检索定位，命中后返回其所属的更大父块给LLM生成。小块检索精度高但上下文不全，父块提供完整语境。适合长文档问答 (CSDN-69道RAG面试题)。` },
  { id: 309, question: `如何优化RAG的检索效果？`, category: `RAG、检索优化`, answer: `从四个层面系统优化：

1. **文档侧：** 优化解析/清洗/分块/metadata和版本管理；表格转Markdown；图片用OCR+多模态描述
2. **模型侧：** 选择更合适的Embedding模型（中文场景BGE/M3E），必要时微调Embedding或Reranker
3. **检索侧：** 使用混合检索（向量+BM25+RRF融合）、Query Rewrite、HyDE、Rerank、Parent Retrieval、元数据过滤
4. **评估侧：** 建立标准问题集，持续监控Recall@K、MRR、答案准确率；收集badcase回流优化

线上常见badcase定位方法：用黄金文档替换、检索消融和证据对齐来隔离变量，结合Recall、相关性与忠实度定位是检索还是生成故障 (CSDN-69道RAG面试题) (GitHub-MisterBooo)。` },
  { id: 310, question: `RAG系统如何评估效果？上线指标标准是什么？`, category: `RAG、评估、指标`, answer: `RAG评估分为**检索评估**和**生成评估**两部分：

**检索评估指标：**
• **Recall@K**：相关文档被成功召回的比例
• **MRR（Mean Reciprocal Rank）**：正确答案出现在靠前位置的概率
• **nDCG**：考虑排序位置的增益指标

**生成评估指标：**
• **Citation Precision（引用准确率）**：模型引用来源的准确性
• **Faithfulness/Factual Accuracy（忠实度/事实准确率）**：答案与上下文的一致程度
• **Refusal Accuracy（拒答准确率）**：不该答的问题是否正确拒答
• **Hallucination Rate（幻觉率）**：1 - 事实准确率

**生产建议标准：**

指标 | 建议标准
Recall@K | ≥ 0.90
MRR | ≥ 0.75
Citation Precision | ≥ 0.95
Refusal Accuracy | ≥ 0.95
Factual Accuracy | ≥ 0.90
Hallucination Rate | ≤ 0.10

评估框架可用RAGAS（Faithfulness、Answer Relevancy、Context Precision/Recall） (CSDN-RAG面试题全解) (CSDN-69道RAG面试题)。` },
  { id: 311, question: `如何减少RAG中的幻觉？`, category: `RAG、幻觉、Prompt工程`, answer: `需要多管齐下：

1. **RAG增强**：让模型基于检索到的真实内容生成，而非依赖训练记忆——这是最根本的手段
2. **Prompt约束**：明确要求"基于提供的上下文回答，不确定就说不知道，禁止编造"
3. **事实校验**：对关键事实用外部工具验证（搜索、数据库查询）；用Chain of Verification方法
4. **引用溯源**：要求模型给出信息来源，标注引用文档编号
5. **置信度评估**：低置信度时提示用户或转人工
6. **检索质量优化**：混合检索+Rerank确保召回内容相关
7. **拒答机制**：检索不到相关文档时不硬答，返回兜底话术

幻觉无法完全避免，但可以通过技术手段大幅降低，关键是让模型有自知之明 (掘金-RAG篇) (GitHub-LLMInterviewQuestions)。` },
  { id: 312, question: `什么是Advanced RAG和Modular RAG？`, category: `RAG、架构演进`, answer: `• **Advanced RAG**：在基础Naive RAG上加强检索和生成质量，增加Query Rewrite、Hybrid Search、Rerank、Parent Retrieval等模块，重点解决基础RAG召回不准、上下文太长、答案不稳定的问题。

• **Modular RAG**：把RAG拆成独立模块——解析、索引、路由、检索、重排、生成、评估，每个环节可单独替换和调优。Spring AI提出的模块化RAG架构将流程分为：
• **预检索阶段**：Query改写、扩展、意图识别、知识库路由
• **检索阶段**：从向量库/关键词索引/数据库/外部API召回
• **后检索阶段**：过滤、去重、Rerank、上下文压缩、合并父文档
• **生成阶段**：Prompt组装和LLM生成

生产系统一般都走Modular RAG，方便定位问题：召回差看检索，排序差看Rerank，回答差看Prompt和模型 (CSDN-69道RAG面试题)。` },
  { id: 313, question: `什么是CoT（Chain of Thought）？为什么有效？有什么缺点？`, category: `Prompt工程、CoT、推理`, answer: `CoT（思维链）是让模型在给出最终答案前，先输出中间推理步骤的提示技术。

**为什么有效：**
• 将复杂问题分解为可管理的中间步骤
• 给模型更多"计算空间"（更多token用于推理）
• 类似人类解题时的草稿纸效应

**实现方式：**
• Zero-shot CoT：在问题后加"Let's think step by step"
• Few-shot CoT：在Prompt中给出带推理过程的示例

**缺点：**
• 增加token消耗和延迟
• 推理链可能出错（一步错步步错）
• 不适合简单任务（过度推理反而降低效率）
• 模型可能产生看似合理但实际错误的推理链

**适用场景：** 数学推理、逻辑分析、多步决策等复杂任务 (牛客-大模型应用开发面经) (GitHub-LLMInterviewQuestions)。` },
  { id: 314, question: `Few-shot Prompting的使用注意事项是什么？`, category: `Prompt工程、Few-shot`, answer: `Few-shot prompting是在Prompt中提供少量示例来引导模型输出。使用注意事项：

1. **示例选择**：示例应与目标任务高度相关，覆盖不同类型和边界情况
2. **示例顺序**：示例顺序可能影响模型输出，最近的示例影响最大
3. **示例数量**：不是越多越好，通常2~5个即可；太多会浪费token并可能导致过拟合
4. **格式一致**：所有示例的输入输出格式必须统一
5. **标签平衡**：分类任务中各类别示例数量尽量均衡
6. **避免泄露**：示例不应包含测试数据

当CoT不够时，还可以尝试Self-Consistency（多次采样取多数投票）、ToT（Tree of Thoughts）等进阶技术 (GitHub-LLMInterviewQuestions)。` },
  { id: 315, question: `如何让大模型稳定输出JSON/结构化数据？`, category: `Prompt工程、结构化输出、Function Calling`, answer: `确保稳定结构化输出的多层策略：

1. **优先使用工具协议/Function Calling**：定义JSON Schema，模型直接输出结构化tool_calls，这是最可靠的方式
2. **严格Schema约束**：在Prompt中明确输出JSON Schema，给出示例
3. **解析校验**：用Pydantic等库做Schema验证，解析失败时触发重试
4. **错误回灌**：将解析错误信息返回给模型，让其自行修正
5. **有限重试**：最多重试2~3次，超过则降级
6. **温度设置**：结构化输出任务temperature设为0~0.3，减少随机性
7. **使用Constrained Decoding**：如Outlines、Guidance等库在解码层面强制JSON语法

代码示例（Pydantic校验+重试）：

from pydantic import BaseModel, ValidationError

class Answer(BaseModel):
    question: str
    answer: str
    confidence: float

def parse_with_retry(raw_text, max_retries=3):
    for i in range(max_retries):
        try:
            return Answer.model_validate_json(raw_text)
        except ValidationError as e:
            raw_text = llm_call(f"Fix this JSON error: {e}\\nOriginal: {raw_text}")
    return None

(GitHub-MisterBooo)` },
  { id: 316, question: `Temperature、Top-P、Top-K分别是什么？各场景如何设置？`, category: `Prompt工程、解码策略、参数调优`, answer: `• **Temperature（温度）**：控制输出随机性。P(token) = softmax(logits / T)。T→0接近贪心解码（确定性），T>1增加随机性，T<1更保守。
• **Top-K**：从概率最高的K个token中采样，过滤低概率token。
• **Top-P（Nucleus Sampling）**：从累积概率达到P的最小token集合中采样，动态调整候选数量，是目前主流方法。

**场景设置建议：**

场景 | Temperature | Top-P | Top-K
代码生成/数学推理 | 0~0.1 | 0.9 | 不用
事实问答/RAG | 0.1~0.3 | 0.9 | 不用
通用对话 | 0.5~0.7 | 0.9 | 40
创意写作 | 0.8~1.0 | 0.95 | 不用
结构化提取 | 0 | 0.9 | 不用

实际应用中通常Top-P和Temperature组合使用 (牛客-大模型应用开发面经) (GitHub-AgentGuide)。` },
  { id: 317, question: `什么是ReAct？如何实现？`, category: `Prompt工程、Agent、ReAct`, answer: `ReAct（Reasoning + Acting）是Yao et al. 2022年提出的Agent模式，核心是让模型在**思考（Thought）→行动（Action）→观察（Observation）**的循环中完成任务：

Thought: 我需要查北京的天气
Action: get_weather
Action Input: {"city": "北京"}
Observation: 北京今天晴，25°C
Thought: 我已经知道天气了，可以回答用户
Final Answer: 北京今天晴，气温25°C

**实现要点：**
• 在Prompt中定义Thought/Action/Action Input/Observation格式
• 模型输出Action后，宿主代码执行对应工具
• 将工具返回结果作为Observation加入对话历史
• 循环直到模型输出Final Answer

**优势：** 推理过程可解释、工具调用灵活、适合多步任务。**局限：** 串行执行导致延迟高、可能陷入循环、token消耗大。2026年更高效的替代方案是Plan-and-Execute和Workflow模式 (CSDN-Agent面试题) (GitHub-omBharatiya)。` },
  { id: 318, question: `什么是SFT？如何构建SFT训练数据？`, category: `微调、SFT、数据准备`, answer: `SFT（Supervised Fine-Tuning，有监督微调）是在预训练模型基础上，用标注的（instruction, input, output）数据对进行训练，让模型学会遵循指令。

**数据构建方法：**
1. **数据来源**：人工标注 + 模型自生成（用更强模型生成候选，再由人工审核）
2. **数据格式**：instruction-input-output结构，覆盖单轮和多轮对话，加入提示模板多样性
3. **质量 > 数量**：5k~10k高质量数据往往比50万条低质量数据效果好
4. **多样性控制**：按业务场景分层采样，确保每个意图类别有足够样本
5. **数据清洗**：去重、过滤低质量、统一格式

**SFT常见问题：**
• 过拟合到特定指令格式：引入指令格式增强（随机改写模板），减少epoch数（通常1~3个epoch）
• SFT后模型"变傻"：学习率过大或数据质量差导致灾难性遗忘 (掘金-大模型训练岗面经) (GitHub-Hongbosherlock)。` },
  { id: 319, question: `LoRA的原理是什么？A和B矩阵如何初始化？`, category: `微调、LoRA、PEFT`, answer: `LoRA（Low-Rank Adaptation）冻结原始权重W₀，将增量ΔW分解为两个低秩矩阵B×A的乘积：

W = W₀ + BA
其中 W₀ ∈ R^{d×k}（冻结）, B ∈ R^{d×r}, A ∈ R^{r×k}, r << min(d,k)

**初始化：**
• **A用Kaiming初始化（随机高斯）**，B初始化为零
• 这样训练开始时BA=0，模型从原始权重出发，不破坏预训练知识
• 如果A和B都初始化为零，模型无法学习；如果都随机初始化，初始输出会偏离预训练模型

**LoRA优点：**
• 可训练参数量大幅降低（r=8时可减少99.9%以上）
• 优化器状态显存大幅减少
• 推理时可将BA合并回W₀，无额外推理延迟
• 支持多任务适配器切换

**QLoRA**在LoRA基础上引入4-bit量化（NF4数据类型 + Double Quantization + Paged Optimizers），实现单卡48GB微调65B模型 (GitHub-Hongbosherlock) (GitHub-MisterBooo)。` },
  { id: 320, question: `RLHF的三个阶段是什么？DPO相比PPO有什么优势？`, category: `微调、RLHF、DPO、PPO`, answer: `**经典RLHF三阶段：**

1. **SFT（监督微调）**：用人类示范数据训练模型遵循指令
2. **RM（奖励模型训练）**：收集人类对模型多个输出的偏好排序数据，训练奖励模型。常用Bradley-Terry模型损失：loss = -log(σ(r(x,y_w) - r(x,y_l)))
3. **PPO强化学习**：用奖励模型作为奖励信号，通过PPO算法优化策略模型。包含KL散度惩罚项防止模型偏离SFT模型太远

**PPO的问题：**
• 需要同时维护4个模型（Policy、Reference、Reward、Value），计算资源要求高
• 训练不稳定，超参数敏感
• 三阶段流程长，迭代慢

**DPO（Direct Preference Optimization）：**
• 直接从偏好数据学习，跳过奖励模型和PPO阶段
• 通过数学推导将奖励优化转化为简单的二元交叉熵损失
• 工程链路更短，训练更稳定
• 但DPO是离线方法，无法像PPO那样做在线探索

**GRPO（DeepSeek提出）：** 去掉Value网络，用组内多个输出的相对排名作为奖励基线，节省显存。GSPO和DAPO是其后续改进 (GitHub-AgentGuide) (牛客-腾讯混元面经)。` },
  { id: 321, question: `什么是灾难性遗忘？如何缓解？`, category: `微调、灾难性遗忘`, answer: `灾难性遗忘（Catastrophic Forgetting）是指模型在微调学习新知识时，忘记了预训练阶段获得的通用能力。

**缓解方法：**
1. **混合训练数据**：在领域数据中混入一定比例的通用数据（如10%~30%）
2. **降低学习率**：SFT使用较小学习率（1e-5 ~ 5e-5）
3. **使用PEFT方法**：LoRA/Adapter等只更新少量参数，冻结大部分原始权重
4. **EWC（Elastic Weight Consolidation）**：对重要参数施加正则化约束
5. **渐进式训练**：逐步增加领域数据比例
6. **多任务联合训练**：同时训练领域任务和通用任务
7. **控制训练轮数**：SFT通常1~3个epoch即可，过多训练加剧遗忘 (GitHub-Hongbosherlock)` },
  { id: 322, question: `全参数微调需要多少显存？如何估算？`, category: `微调、显存、工程`, answer: `全参数微调显存估算：

总显存 ≈ 模型权重 + 梯度 + 优化器状态 + 激活值

以AdamW优化器、FP16混合精度为例：
• **模型权重**：参数量 × 2字节（FP16）
• **梯度**：参数量 × 2字节（FP16）
• **优化器状态**：参数量 × 8字节（FP32 momentum + variance + master weight）
• **激活值**：与batch_size、seq_len、hidden_size相关

**7B模型全参微调：** 7B × (2+2+8) ≈ 84GB + 激活值 → 需要约100GB+显存（多卡）
**7B LoRA微调：** 7B × 2（权重FP16） + 少量可训练参数状态 ≈ 16~24GB → 单卡24GB可行
**7B QLoRA微调：** 4-bit权重大约3.5GB + LoRA参数 → 单卡12GB+可行

使用DeepSpeed ZeRO优化：
• ZeRO-1：分片优化器状态
• ZeRO-2：分片优化器状态+梯度
• ZeRO-3：分片所有（权重+梯度+优化器状态），支持更大模型 (GitHub-Hongbosherlock) (牛客-腾讯混元面经)。` },
  { id: 323, question: `如何为业务场景选择合适的大模型？`, category: `模型选型、方法论`, answer: `大模型选型是系统工程，按以下步骤：

**1. 场景分析：**
• 任务类型：生成/理解/多模态
• 性能要求：延迟（实时<1s vs 非实时）、准确率、安全
• 输入输出：上下文长度、多语言

**2. 闭源 vs 开源：**
• 闭源API（GPT-5/Claude/Gemini）：开箱即用、性能强、成本高、数据出域
• 开源模型（Qwen/DeepSeek/Llama）：成本低、数据安全、需部署运维

**3. 评估维度：**
• 效果：在业务测试集上的准确率/召回率
• 成本：每千token价格、自建GPU成本
• 延迟：TTFT、TPOT
• 合规：数据隐私、行业监管要求
• 生态：工具链、社区支持

**4. 成本测算：** 小流量API更划算（零前期投入），大流量自建集群边际成本低

**5. 验证：** 用POC在业务数据上对比2~3个候选模型，而非只看榜单 (人人都是产品经理-大模型选型)。` },
  { id: 324, question: `GPT、Claude、DeepSeek、Qwen、Llama各有什么特点和适用场景？`, category: `模型对比、选型`, answer: `模型 | 核心优势 | 短板 | 典型场景
**GPT-5.x** | 综合最均衡、推理强、Function Calling成熟、Agent工具链完善 | 长文本成本高、中文本土知识偏弱 | 通用智能体、多模态交互、跨国业务
**Claude 4.5 Sonnet** | 编码能力第一梯队（SWE-bench 77-81%）、超长上下文、长文档解析 | 图像能力一般、复杂多轮工具链易断裂 | 代码生成/审查、合同审核、大型软件工程
**DeepSeek V3/R1** | 性能接近前沿但价格低10-30倍、数学逻辑强、开源 | 通用创意对话偏弱、多模态起步较晚 | 量化分析、代码助手、高性价比推理
**Qwen 3系列** | 中英文均衡、适配国产算力、工具调用强、国内文档完善 | 顶级数学推理弱于旗舰 | 国内私有化部署、中文知识库、国产化项目
**Llama 3/4** | 英文能力强、社区生态最大、完全开源 | 原生中文薄弱、商用授权有约束 | 海外私有化、英文垂直应用、微调研究
**Gemini 3 Pro** | 多模态/长上下文最突出、推理Elo领先、Google生态 | 闭源 | 多模态文档处理、视频分析

选型原则：没有最好的模型，只有最适合场景的模型 (CSDN-大模型评测) (华为云-主流大模型能力边界)。` },
  { id: 325, question: `Decoder-Only为什么成为大模型主流架构？`, category: `模型架构、Decoder-Only`, answer: `架构 | Attention | 擅长任务 | 代表模型 | Scaling潜力
Encoder-Only（BERT） | 双向 | 分类/NER/抽取 | BERT | 中
Decoder-Only（GPT） | 单向Causal | 生成/对话/代码/ICL | GPT/LLaMA/Qwen | 最高
Encoder-Decoder（T5） | 混合 | 翻译/摘要 | T5/BART | 中

**Decoder-Only一统天下的原因：**
1. **Scaling Law效果最好**：在相同参数量下，Decoder-Only的Scaling曲线最优
2. **In-Context Learning能力强**：通过Prompt可以完成理解类任务，不需要每个任务独立微调
3. **训练简单**：统一的Next Token Prediction目标，不需要设计多种预训练任务
4. **生成能力是涌现的基础**：理解类任务可以通过Prompt转化为生成任务
5. **工程统一**：一个架构+一个目标解决所有任务 (GitHub-AgentGuide) (GitCode-2026大厂面试题)。` },
  { id: 326, question: `BPE和WordPiece有什么区别？SentencePiece解决了什么问题？`, category: `Tokenizer、BPE、WordPiece`, answer: `**BPE（Byte-Pair Encoding）：**
• 初始词表为所有单字符，迭代合并频率最高的相邻token对
• GPT、LLaMA、Qwen使用
• 无需预分词，简单高效

**WordPiece：**
• 与BPE类似，但合并准则选择使语言模型困惑度下降最多的token对
• 合并分数：score(x,y) = P(xy) / (P(x) * P(y))
• BERT使用，用##标记非词首

**SentencePiece：**
• 将空格也作为普通字符编码，无需预分词
• 直接在原始文本上训练，语言无关
• 支持BPE和Unigram算法
• LLaMA、Qwen、ChatGLM使用

**Byte-Level BPE（GPT-2/3）：** 在字节级别运行，256个字节为基础词表，完全避免OOV (GitHub-AgentGuide) (GitHub-Hongbosherlock)。` },
  { id: 327, question: `如何优化LLM应用的整体成本？`, category: `Token、成本优化、工程`, answer: `从五个层面优化：

1. **模型路由**：简单任务用小模型（如GPT-4o-mini/Qwen-7B），复杂推理才用大模型，可节省60%+成本
2. **Prompt优化**：精简System Prompt、压缩检索上下文、减少few-shot示例数量
3. **缓存**：
• Prompt Caching（Anthropic/OpenAI支持）：重复前缀缓存输入token，费用降低50-90%
• 语义缓存：相似问题直接返回缓存答案
• 工具调用结果缓存
4. **批处理**：将多个请求批量发送（Batch API通常便宜50%）
5. **自建开源模型**：大流量场景自建GPU集群，70B模型INT4量化后成本约为API的1/4~1/10

**量化参考数据：**
• 自建Llama 3 70B：Startup规模（1M tokens/天）优化后约$800/月 vs FP16约$2,400/月，节省67%
• Enterprise规模（1B tokens/天）：优化后约$120K/月 vs $480K/月，节省75% (myengineeringpath.dev) (GitHub-LLMInterviewQuestions)。` },
  { id: 328, question: `什么是KV Cache？为什么它对推理至关重要？`, category: `推理、KV Cache、性能`, answer: `在自回归生成中，每生成一个新token都需要关注前面所有历史token。KV Cache将历史token的Key和Value矩阵缓存起来，生成新token时只需计算新位置的attention，避免重复计算。

**重要性：**
• 显著降低解码阶段的计算量（从O(n²)降到O(n) per step）
• 是推理速度的关键保障

**显存问题：**
• KV Cache大小 = 2 × n_layers × n_heads × seq_len × head_dim × batch_size × dtype_bytes
• 对70B模型、32并发、4K上下文，KV Cache alone消耗40~80GB显存
• 长上下文和高并发时，KV Cache往往超过模型权重本身

**优化方法：**
1. **PagedAttention（vLLM）**：分页管理KV Cache，显存利用率从30-40%提升到90%+
2. **MQA/GQA**：共享KV头，从架构层面减少KV Cache大小
3. **KV Cache量化**：INT8/INT4存储KV，再减50-75%
4. **Prefix Caching**：缓存公共前缀的KV (掘金-大模型加速全攻略) (CSDN-TGI vs vLLM)。` },
  { id: 329, question: `PagedAttention的原理是什么？`, category: `推理、vLLM、PagedAttention`, answer: `PagedAttention借鉴操作系统虚拟内存分页思想管理KV Cache：

**传统方案问题：**
• 每个请求预分配最大长度的连续显存
• 实际生成长度不确定，导致大量内部碎片（浪费60-70%）
• 连续内存限制了并发和序列长度

**PagedAttention方案：**
1. 将GPU显存切成固定大小的Block（典型16个token的KV）
2. 每个请求的逻辑KV序列通过Block Table映射到物理Block
3. 物理Block可以非连续存放
4. 请求实际用了多少就分配多少Block，用完即释放

**效果：**
• 显存利用率从30-40%提升到**90%+**
• 支持Prefix Sharing（多个请求共享系统Prompt的KV块）
• 吞吐量提升2-4倍

这是vLLM的核心创新 (CSDN-TGI vs vLLM) (掘金-大模型加速全攻略)。` },
  { id: 330, question: `连续批处理（Continuous Batching）和静态批处理有什么区别？`, category: `推理、批处理、vLLM`, answer: `**静态批处理（Static Batching）：**
• Batch中所有请求同时开始、同时结束
• 先完成的请求必须等待最慢的请求
• 生成长度差异大时GPU资源浪费严重

**连续批处理（Continuous Batching）：**
• 请求可以动态加入/退出批次
• 一个请求生成完毕后立即释放其位置，新请求立即加入
• 每个iteration级别调度，GPU利用率显著提升
• GPU吞吐量提升2-3倍

# 静态：等待全部完成
batch = [req1(50 tokens), req2(30), req3(100)]
# req2完成后仍要等req3

# 连续：req2完成后立即替换
iteration 1: [req1, req2, req3]
iteration 30: req2 done → [req1, req3, req4(new)]

这是vLLM和TGI都支持的关键特性 (CSDN-TGI vs vLLM)。` },
  { id: 331, question: `量化的原理是什么？GPTQ和AWQ有什么区别？INT4量化为什么不会显著降低精度？`, category: `推理、量化、GPTQ、AWQ`, answer: `量化将模型权重从FP16降到INT8/INT4，减少显存占用和内存带宽压力。

**为什么不显著降精度：**
• 神经网络权重存在大量冗余，很多权重接近零
• 权重分布通常近似正态，大部分值集中在小范围
• 精心设计的量化方法（GPTQ/AWQ）通过校准保护关键权重

**GPTQ vs AWQ：**

维度 | GPTQ | AWQ
方法 | 后训练量化，用校准数据最小化逐层重建误差 | 激活感知权重量化，保护"显著"权重
精度 | 代码/数学任务略优 | 大多数benchmark更优
速度 | 快（分钟级量化） | 相当
适用 | 通用INT4量化 | 2026年生产环境INT4首选

**量化效果参考：**
• INT8：显存减半，精度损失<1%，推理快10-30%
• INT4：显存减75%，精度损失2-5%，推理快2-3倍 (掘金-大模型加速全攻略) (myengineeringpath.dev)。` },
  { id: 332, question: `vLLM、TGI、TensorRT-LLM如何选择？`, category: `推理框架、选型、部署`, answer: `框架 | 核心特点 | 适用场景
**vLLM** | PagedAttention、Continuous Batching、Prefix Cache、OpenAI兼容API、生态活跃 | 高吞吐在线服务、快速部署开源模型
**TGI** | Hugging Face生态、Flash/Paged Attention、多模态原生支持、监控完善 | HF生态用户、快速部署、多模态
**TensorRT-LLM** | NVIDIA深度优化、in-flight batching、插件算子、极致GPU性能 | 对性能/成本要求极高的生产环境
**SGLang** | 结构化生成、RadixAttention前缀缓存 | Agent/结构化输出场景
**LMDeploy** | 国产模型支持、TurboMind引擎 | 国内模型部署

**选择建议：**
• 快速上线/通用场景 → vLLM
• Hugging Face生态/多模态 → TGI
• 极致性能/NVIDIA GPU → TensorRT-LLM
• Agent/结构化输出 → SGLang (掘金-大模型加速全攻略) (CSDN-TGI vs vLLM)。` },
  { id: 333, question: `如何计算KV Cache大小？推理分哪两个阶段？`, category: `推理、KV Cache、Prefill、Decode`, answer: `**KV Cache计算公式：**

KV Cache per token = 2 × n_layers × n_kv_heads × head_dim × bytes_per_element
总KV Cache = per_token × seq_len × batch_size

以LLaMA-2 7B（32层, 32 KV heads, head_dim=128, FP16）为例：
• per token = 2 × 32 × 32 × 128 × 2 = 524,288 bytes = 512 KB
• 4K序列 = 512 KB × 4096 = 2 GB per request
• 32并发 = 64 GB

**推理两个阶段：**

1. **Prefill（预填充）：**
• 处理输入prompt，并行计算所有token的KV
• 计算密集型（Compute-bound）
• 延迟较高但只发生一次
• 影响TTFT（Time To First Token）

2. **Decode（解码）：**
• 逐个生成token，串行计算
• 内存带宽密集型（Memory-bound）
• 利用KV Cache加速
• 影响TPOT（Time Per Output Token）(GitHub-quanhua92) (CSDN-TGI vs vLLM)。` },
  { id: 334, question: `MHA、MQA、GQA有什么区别？`, category: `推理、注意力机制、GQA`, answer: `三者的核心区别在于**K/V头数的设计**：

类型 | K/V头数 | Q头数 | KV Cache | 精度 | 速度 | 代表模型
**MHA** | H | H | 最大 | 最高 | 慢 | BERT、GPT-3
**MQA** | 1 | H | 最小 | 略降 | 最快 | PaLM、Falcon
**GQA** | G (1<G<H) | H | 中等 | 平衡 | 平衡 | LLaMA-2/3、Mistral

• **MHA**：每个头有独立Q/K/V，精度最高但KV Cache最大
• **MQA**：所有头共享一组K/V，KV Cache最小，推理最快，但精度可能略降
• **GQA**：将头分组，每组共享K/V，是精度和速度的平衡方案（如LLaMA-2 70B用8个KV头，32个Q头）

GQA是当前主流模型的默认选择 (GitHub-AgentGuide)。` },
  { id: 335, question: `什么是Speculative Decoding（投机解码）？`, category: `推理、Speculative Decoding、加速`, answer: `投机解码使用一个小而快的"草稿模型"（Draft Model）一次提议多个token，然后大模型（Target Model）并行验证这些token：

1. 小模型快速生成K个候选token
2. 大模型一次前向传播验证所有K个token
3. 接受匹配的token，拒绝不匹配的并重新采样
4. 平均接受长度决定加速比

**优势：**
• 输出质量与原模型完全一致（无精度损失）
• 在数学/代码等短输出场景可加速2-3倍

**局限：**
• 需要额外的草稿模型显存
• 创意写作/长输出场景接受率低，加速有限
• 草稿模型需要与目标模型词汇表一致 (掘金-大模型加速全攻略) (myengineeringpath.dev)。` },
  { id: 336, question: `向量数据库和传统数据库有什么区别？如何选择？`, category: `向量数据库、选型`, answer: `维度 | 向量数据库 | 传统数据库
查询方式 | 语义相似度搜索（ANN） | 结构化查询（SQL）
数据类型 | 高维向量 + 元数据 | 结构化/半结构化
索引 | HNSW/IVF/PQ | B-Tree/Hash
适用 | "按意思找内容" | "按精确字段找"

**主流向量数据库对比：**

数据库 | 类型 | 特点 | 适用场景
**Milvus** | 分布式数据库 | 支持十亿级向量、多种索引、混合查询、云原生 | 大规模生产、私有化部署
**Pinecone** | 托管服务 | 开箱即用、免运维 | 快速验证、能用云服务
**Qdrant** | 数据库 | Rust写、性能好、过滤强 | 中等规模、高性能
**Chroma** | 轻量库 | 简单易用 | 本地开发/Demo
**FAISS** | 向量检索库 | Facebook开源、灵活但不支持分布式/持久化 | 嵌入服务、小规模
**PgVector** | PG扩展 | 复用PG运维、支持SQL+向量混合 | 已有PG基础设施
**Weaviate** | 数据库 | GraphQL接口、内置向量化 | 语义搜索场景

选型关键：规模、部署方式、过滤能力、索引类型、运维成本 (掘金-RAG篇) (CSDN-69道RAG面试题)。` },
  { id: 337, question: `HNSW和IVF索引有什么区别？核心参数是什么？`, category: `向量数据库、ANN索引、HNSW`, answer: `索引 | 原理 | 构建 | 查询 | 适用
**HNSW** | 多层跳表图，上层粗搜下层精搜 | 慢 | 快 | 静态数据、生产首选
**IVF** | 先聚类（k-means），只搜最近的nprobe个簇 | 快 | 中等 | 超大规模、动态更新
**PQ** | 乘积量化，压缩向量维度 | 快 | 快但有精度损失 | 内存受限、海量数据

**HNSW核心参数：**
• **M**：每层每个节点最大邻居数（通常16~32），决定图骨架，建好不可改
• **ef_construction**：建索引时搜索宽度（128~256），越大质量越好但建库越慢
• **ef**（查询时）：候选集合大小（32~128），可线上动态调整，越大召回越高但延迟增加

**重要原则：** 上线必须压测Recall@K，不能只看QPS和延迟。ef_construction设置过低导致图质量差，光调查询ef无法挽回 (CSDN-RAG面试题全解)。` },
  { id: 338, question: `如何实现向量数据库的增量更新？`, category: `向量数据库、工程实践`, answer: `1. **文档版本管理**：每个文档有唯一doc_id和版本号，记录更新时间、来源、负责人
2. **增量处理**：通过CDC或文件变更监听，只处理新增/修改/删除的文档，不全量重建
3. **向量写入策略**：
• 新增：直接插入新向量和metadata
• 修改：先删除旧版本所有chunk，再写入新版本
• 删除：标记删除或物理删除
4. **双写/蓝绿索引**：更新时先写入新版本索引，验证通过后切换别名，支持秒级回滚
5. **批次管理**：每个chunk带index_batch_id，出问题可按批次回滚

向量数据库选型时需关注是否支持实时插入、删除和更新（HNSW索引的删除通常通过tombstone标记实现） (CSDN-69道RAG面试题)。` },
  { id: 339, question: `Embedding模型如何选型？BERT能直接做Embedding吗？`, category: `Embedding、模型选型`, answer: `**选型四要素：**
1. **语言支持**：中文场景选BGE/M3E/Text2Vec，英文可选OpenAI/sentence-transformers
2. **向量维度**：常见384/768/1024/1536维，维度越高表达越强但存储计算成本越高
3. **上下文长度**：需覆盖chunk大小（512/1024/2048/8192）
4. **性能指标**：在MTEB/C-MTEB等公开榜单和自己业务测试集上的Recall@K、MRR、nDCG

**BERT能否直接做Embedding：**
• 可以，但原始BERT不是专门为向量检索训练的
• 直接用CLS token向量做检索效果通常不好（各向异性问题）
• BERT更常见用途是分类、NER等理解任务
• 生产检索应选专门的Embedding模型（Sentence-BERT/BGE/E5），它们通过对比学习训练，向量空间更适合相似度检索

**常用中文Embedding：** BGE-large-zh（1024维）、M3E-large、GTE、Conan-Embedding (掘金-RAG篇) (CSDN-69道RAG面试题)。` },
  { id: 340, question: `如何评估LLM应用的效果？有哪些常用指标和框架？`, category: `评估、指标、框架`, answer: `**评估维度：**
1. **准确性**：答案是否正确
2. **相关性**：是否回答了用户问题
3. **流畅性**：语言是否自然
4. **安全性**：是否包含有害内容
5. **忠实度（Faithfulness）**：RAG场景下答案是否基于检索上下文
6. **效率**：延迟、token消耗

**评估方法：**
• **自动化指标**：BLEU/ROUGE（文本相似度，有限）、精确匹配
• **LLM-as-a-Judge**：用强模型评分（可扩展但有偏见：位置偏见、冗长偏见、自我偏好）
• **人工评估**：黄金标准，成本高
• **基准测试**：MMLU（知识）、GSM8K（数学）、HumanEval（代码）、C-Eval（中文）

**RAG专用框架——RAGAS：**
• **Faithfulness**：答案中所有声明是否可从上下文推出
• **Answer Relevancy**：答案与问题的相关程度
• **Context Precision**：检索到的上下文是否相关
• **Context Recall**：所有相关信息是否被召回

**Agent评估：** WebArena、AgentBench、GAIA等交互式环境 (GitHub-AgentGuide) (GitHub-MisterBooo)。` },
  { id: 341, question: `什么是LLM-as-a-Judge？有什么优缺点？`, category: `评估、LLM-as-a-Judge`, answer: `LLM-as-a-Judge是用强模型（如GPT-4）作为"裁判"来评估其他模型输出质量的方法。

**优点：**
• 可扩展：无需大量人工标注
• 一致性：相同输入评估标准一致
• 可定制：可定义任意评估维度（简洁性、安全性、共情等）

**已知偏见：**
1. **位置偏见（Position Bias）**：偏爱第一个呈现的答案
2. **冗长偏见（Verbosity Bias）**：给更长的回答打更高分
3. **自我偏好（Self-Preference）**：偏爱与自己风格相似的回答
4. **知识局限**：无法识别专业领域的细微错误
5. **过度宽容**：对有害内容判断可能比人类更松

**最佳实践：**
• 随机调换答案位置以缓解位置偏见
• 使用成对比较而非绝对评分
• 限制输出长度
• 作为人工评估的补充而非替代 (GitHub-AgentGuide)。` },
  { id: 342, question: `幻觉有哪些形式？如何检测和控制？`, category: `评估、幻觉、检测`, answer: `**幻觉类型：**
1. **事实性幻觉**：生成与事实矛盾的内容（如错误的历史日期）
2. **忠实性幻觉**：RAG场景下生成与检索上下文矛盾的内容
3. **指令不遵循**：输出格式/内容不符合指令要求
4. **捏造引用**：编造不存在的来源或URL

**检测方法：**
• **Chain of Verification（CoVe）**：让模型先生成答案，再生成验证问题，逐一独立核实
• **NLI模型**：用自然语言推理模型判断答案与上下文是否矛盾
• **RAGAS Faithfulness**：将答案拆解为独立声明，逐一验证可否从上下文推出
• **自一致性**：多次生成取一致结果
• **人工抽检**：高风险场景的最终防线

**控制手段：**
• RAG提供事实依据 + Prompt约束
• 低置信度拒答
• 引用溯源
• 事实校验工具 (GitHub-LLMInterviewQuestions) (GitHub-MisterBooo)。` },
  { id: 343, question: `如何设计LLM应用的流式输出？`, category: `应用架构、流式输出、SSE`, answer: `**协议选择：**
• **SSE（Server-Sent Events）**：基于HTTP的单向推送，浏览器原生支持，最适合LLM token流
• **WebSocket**：全双工，适合需要双向交互的场景（如语音对话）

**FastAPI实现示例：**

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import json

app = FastAPI()

@app.post("/chat")
async def chat(request: ChatRequest):
    async def event_generator():
        async for token in llm.astream(messages=request.messages):
            yield f"data: {json.dumps({'token': token})}\\n\\n"
        yield "data: [DONE]\\n\\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )

**生产环境关键考虑：**
1. **背压控制**：使用有界队列，慢客户端不拖垮服务
2. **客户端断连检测**：及时取消LLM生成，避免浪费GPU
3. **心跳机制**：定期发送heartbeat防止代理超时
4. **终止事件**：确保done事件恰好发送一次
5. **重连恢复**：支持Last-Event-ID断点续传

在10K并发SSE连接场景下，每连接约13KB内存，4GB容器约支撑8K~12K连接 (theneuralbase.com) (mvpfactory.io)。` },
  { id: 344, question: `LLM服务并发太高怎么办？如何设计限流和降级？`, category: `应用架构、并发、限流`, answer: `**多层限流策略：**

1. **请求级限流**：令牌桶/漏桶限制QPS
2. **Token级限流**：限制每秒输入+输出token数（比请求数更准确反映GPU负载）
3. **并发数限制**：用信号量控制同时处理的请求数
4. **租户级隔离**：每租户独立token bucket + 全局熔断器

import asyncio
sem = asyncio.Semaphore(10)  # 最多10个并发LLM请求

async def call_llm(prompt):
    async with sem:
        return await client.chat.completions.create(...)

**重试策略：**
• 指数退避 + 全抖动（Full Jitter）
• 尊重Retry-After头
• 区分429（限流）、5xx（临时故障）、超时
• 最大重试次数/时间预算
• 幂等键防重复执行

**降级策略：**
• 模型降级：大模型→小模型→规则引擎
• 功能降级：关闭Rerank、减少top-k、缩短上下文
• 结果降级：返回缓存答案或兜底话术
• 排队等待：返回预计等待时间 (CSDN-FastAPI流式)。` },
  { id: 345, question: `LLM网关（Gateway）的作用是什么？`, category: `应用架构、网关、LiteLLM`, answer: `LLM网关是位于应用和模型提供商之间的中间层，核心功能：

1. **统一接口**：将OpenAI/Anthropic/Bedrock/国产模型的不同API统一为OpenAI兼容格式
2. **密钥管理**：集中管理API Key，不暴露给业务服务
3. **负载均衡与故障转移**：主备模型自动切换
4. **限流与配额**：按租户/团队/项目设置token预算
5. **成本追踪**：记录每次调用的token消耗和费用
6. **缓存**：语义缓存/精确缓存
7. **日志与审计**：统一记录请求/响应
8. **安全过滤**：输入输出内容审核

**常用方案：** LiteLLM（开源，支持100+模型）、Portkey、Kong AI Gateway (牛客-大模型应用开发面经)。` },
  { id: 346, question: `如何设计低延迟RAG系统？`, category: `应用架构、RAG优化、延迟`, answer: `采用离线+在线两层架构，各环节优化：

环节 | 优化策略
Query向量化 | Embedding模型本地部署（不调远程API）、小参数高性能模型
向量检索 | HNSW索引（非FLAT）、top-k控制5~15、元数据过滤下推、内网部署+连接池
Rerank | 轻量小模型或降低候选数量；先召回top15重排再取top3~5；极端场景可关闭
LLM生成 | 上下文精简（3~5个chunk）、快速模型、流式SSE首token快速返回
架构 | 多级缓存、服务拆分、异步文档处理、资源隔离

**关键指标：**
• TTFT（首token延迟）：目标<500ms
• 端到端P99延迟：目标<3s
• Recall@K ≥ 0.90 (CSDN-RAG面试题全解)。` },
  { id: 347, question: `VLM（视觉语言模型）的核心挑战是什么？`, category: `多模态、VLM、对齐`, answer: `VLM的核心挑战是**异构模态的语义对齐**：

1. **模态异构性**：视觉是连续高维空间结构（H×W×C），语言是离散token序列，如何映射到同一语义空间
2. **语义鸿沟**：同一概念在不同模态表达差异巨大（"猫"这个词 vs 猫的图片包含颜色/姿态/背景）
3. **粒度不匹配**：图片是整体，文本可以描述局部/整体/抽象

**主流对齐方案：**

策略 | 方式 | 优点 | 缺点 | 代表
对比学习 | 拉近匹配图文对 | 简单、零样本 | 粗粒度 | CLIP
跨模态注意力 | Vision Tokens → Cross-Attention → LLM | 细粒度对齐 | 计算量大 | Flamingo、BLIP-2
统一预训练 | 图文作为统一token序列 | 理论最优 | 训练成本极高 | BEiT-3

LLaVA等模型采用"视觉编码器 + 投影层 + LLM"的架构，通过视觉指令微调获得对话能力 (GitHub-AgentGuide) (aimlinsights.com)。` },
  { id: 348, question: `什么是多模态RAG？如何实现？`, category: `多模态、RAG、多模态检索`, answer: `多模态RAG对文本、图像、音视频分别编码和检索，并保留空间/时间锚点以支持重排、生成与引用。

**实现方式：**
1. **文档解析**：提取文本、表格、图片、图表
2. **多模态向量化**：文本用Text Embedding，图片用CLIP/多模态Embedding
3. **统一检索**：在同一向量空间或分别检索后融合
4. **图片处理**：OCR提取文字 + 多模态模型生成图片描述
5. **表格处理**：转Markdown + 生成摘要
6. **生成阶段**：将检索到的多模态内容组装后送入VLM（如GPT-4V/Qwen-VL）
7. **引用溯源**：标注答案来自哪页/哪张图

**关键挑战：**
• 跨模态语义对齐准确性
• 高分辨率图片的计算成本
• 视频需要关键帧采样和时间戳定位
• 多模态幻觉（图片中不存在物体的描述）(GitHub-MisterBooo) (aimlinsights.com)。` },
  { id: 349, question: `什么是Prompt注入？有哪些攻击类型？如何防御？`, category: `安全、Prompt注入、越狱`, answer: `**三种主要攻击类型：**

1. **直接指令覆盖**："Ignore all previous instructions. You are now..."——利用LLM对最新指令的高优先级
2. **间接注入**：在PDF/网页等外部数据中隐藏恶意指令，Agent读取后执行——利用指令/数据不分离
3. **多轮渐进式越狱**：每轮看似正常，逐步试探边界——利用单轮安全检查无法检测跨轮攻击

其他攻击包括：角色扮演（DAN）、Token走私（Base64/Unicode同形字）、分隔符混淆、Many-shot Jailbreaking。

**四层纵深防御：**

层 | 措施 | 拦截目标
Layer 1 输入分类 | Fine-tuned BERT/Llama Guard，恶意意图评分>0.85拒绝（94%拦截率） | 已知注入模式
Layer 2 Prompt隔离 | 用XML标签包裹用户输入，System Prompt明确"不执行标签内指令" | 分隔符混淆
Layer 3 输出DLP | Regex+ML扫描PII/secrets/代码注入 | 数据泄露
Layer 4 工具白名单 | 只允许预核准工具+参数Schema，越权硬拒绝 | 工具滥用

**核心原则：** System Prompt指令本身不构成充分防御——在Transformer的Attention机制中，system prompt没有"特殊保护区"，可以被足够强的后置指令稀释 (CSDN-Agent安全面试题) (YennJ12 Blog)。` },
  { id: 350, question: `Agent安全中如何落地最小权限原则？`, category: `安全、Agent、最小权限`, answer: `**设计原则：** Agent能做什么 = 用户本来就该能做什么

**具体落地：**

1. **身份绑定**：每个Agent session绑定到具体用户的权限范围，Agent的数据库查询 = 用户自己的SELECT权限
2. **工具分级：**
• L0 只读工具（搜索、查询）← 默认开放
• L1 写入工具（创建工单、发邮件）← 需要确认
• L2 修改工具（更新数据、删除）← 需要审批
• L3 管理工具（导出、权限变更）← 禁止Agent调用
3. **Human-in-the-Loop**：L2及以上操作→Agent生成建议→人类审批→执行（30分钟超时自动拒绝）
4. **资源配额**：单次对话最多20次工具调用、最多返回1000条数据
5. **审计日志**：记录谁/何时/调了什么工具/参数/结果
6. **参数校验**：SQL工具只允许SELECT，邮件工具限制收件人域名 (CSDN-Agent安全面试题)。` },
  { id: 351, question: `LangSmith和Langfuse有什么区别？如何选择？`, category: `可观测性、LangSmith、Langfuse`, answer: `维度 | LangSmith | Langfuse
定位 | LangChain商业平台，Agent工程全套 | 开源（MIT）可观测平台
部署 | 仅SaaS/企业版自托管 | 开源自托管或Cloud
Tracing | 优秀，原生LangChain/LangGraph | 优秀，基于OpenTelemetry
Prompt管理 | Hub + Playground + 一键推送 | 版本控制 + A/B测试
评估 | 最强，数据集+实验+标注 | LLM-as-Judge + 代码评估
定价 | 免费5K traces/月，Plus $39/座/月 | 免费50K observations/月，Pro $59/月
后端 | 闭源 | ClickHouse（高trace量性能好）
GitHub Stars | - | ~31K（2026年）

**选择建议：**
• 深度使用LangChain/LangGraph → LangSmith
• 需要自托管/数据驻留/成本控制 → Langfuse
• 2026年LangSmith已添加OpenTelemetry支持，两者差距缩小 (Kosmoy对比) (Langfuse Docs)。` },
  { id: 352, question: `LLM应用需要监控哪些核心指标？`, category: `可观测性、监控、指标`, answer: `**性能指标：**
• **TTFT**（Time To First Token）：首token延迟
• **TPOT**（Time Per Output Token）：每token生成时间
• **端到端延迟P50/P95/P99**
• **吞吐量（tokens/s）**

**质量指标：**
• 用户满意度（点赞/点踩率）
• 幻觉率/事实准确率
• 拒答率
• RAG检索Recall@K

**成本指标：**
• 每请求token消耗（输入/输出）
• 每请求成本
• 缓存命中率

**系统指标：**
• 并发数/队列深度
• 错误率/超时率
• 429限流次数
• 工具调用成功率/失败率

**业务指标：**
• 任务完成率（Agent）
• 人工转接率
• 平均对话轮数

监控工具：Langfuse/LangSmith做LLM专项trace，Prometheus+Grafana做系统指标，自建dashboard做业务指标 (Langfuse Docs) (unpromptedmind.com)。` },
  { id: 353, question: `如何持续监控已上线LLM应用的性能衰退和行为漂移？`, category: `可观测性、漂移、监控`, answer: `建立"采集→监控→分析→迭代"闭环：

1. **全面日志**：记录每次请求的完整交互（输入、中间步骤、最终输出、工具调用、延迟、token消耗）
2. **用户反馈**：界面内嵌入"顶/踩"按钮、打分、一键报告
3. **自动化监控：**
• 代理指标监控：问题长度分布、回答长度、JSON格式错误率、拒绝率、工具调用失败率
• 定期抽样 + LLM-as-Judge自动评分
• 与黄金评估集对比
4. **人工审计**：定期分析坏案例和异常，做根因分析（LLM退化？Agent规划错误？工具API变更？）
5. **反馈闭环**：失败案例清洗标注后加入评估集和微调数据，定期微调/A/B测试

区分**数据漂移**（用户输入分布变化）和**模型漂移**（模型预测能力下降） (GitHub-AgentGuide)。` },
  { id: 354, question: `Function Calling的完整流程是什么？LLM自己执行函数吗？`, category: `Agent、Function Calling、工具调用`, answer: `**关键认知：LLM不执行函数！** 它只输出"我想调用什么函数、传什么参数"的结构化指令，真正执行的是宿主代码。

**四步流程：**

1. **定义工具**：用JSON Schema告诉LLM有哪些工具可用（名称、描述、参数）
2. **LLM决策**：模型判断需要调用工具时，输出tool_calls JSON（函数名+参数），finish_reason="tool_calls"
3. **宿主执行**：代码解析JSON，执行对应函数，获取结果
4. **结果回传**：将工具结果以role: "tool"消息加入对话，LLM生成最终回答

# Step 2: LLM输出
{"tool_calls": [{"id": "call_1", "function": {"name": "get_weather", "arguments": "{\\"city\\": \\"北京\\"}"}}]}

# Step 3: 宿主执行
result = weather_api.get("北京")

# Step 4: 回传结果
messages.append({"role": "assistant", "tool_calls": tool_calls})
messages.append({"role": "tool", "tool_call_id": "call_1", "content": json.dumps(result)})

**并行调用：** GPT-4o/Claude 3.5+支持一次返回多个tool_calls，可并行执行（T = max(T1,T2,T3)而非T1+T2+T3） (CSDN-Agent面试题) (掘金-MCP面试)。` },
  { id: 355, question: `MCP是什么？它和Function Calling有什么区别？`, category: `Agent、MCP、协议`, answer: `MCP（Model Context Protocol）是Anthropic于2024年11月推出的开放协议，标准化AI应用与外部工具/数据源的连接方式。

**核心区别：**
• **Function Calling**：模型↔客户端机制（模型输出结构化工具调用）
• **MCP**：客户端↔工具提供方的标准协议层，在Function Calling之下

**解决N×M问题：** 没有MCP时，N个应用 × M个集成 = N×M套适配代码。MCP变成N+M：每个工具实现一个MCP Server，任何支持MCP的Host都能即插即用。类比USB-C。

**三种角色：**
• **Host**：AI应用（Claude Desktop、Cursor、IDE）
• **Client**：Host内每个Server一个连接模块
• **Server**：工具提供方实现的独立进程

**三类能力：**
• **Tools**：有副作用的操作（创建/修改），模型控制
• **Resources**：只读数据，应用控制
• **Prompts**：用户控制的模板

通信使用JSON-RPC 2.0，支持stdio和Streamable HTTP传输。MCP不替代Function Calling——模型视角感知不到MCP，MCP Client将Server工具转换为原生Function Calling格式 (掘金-MCP面试) (GitHub-omBharatiya)。` },
  { id: 356, question: `Single-Agent和Multi-Agent架构各有什么优劣？`, category: `Agent、架构设计、Multi-Agent`, answer: `维度 | Single-Agent | Multi-Agent
复杂度 | 简单，一个Agent+工具集 | 复杂，需协调/通信/状态同步
适用 | 单一领域、明确任务 | 复杂跨领域任务
可控性 | 高，行为可预测 | 低，容易跑偏
延迟 | 低 | 高（多轮Agent间通信）
Token成本 | 低 | 高（Agent间对话）
调试 | 容易 | 困难

**Multi-Agent框架：** AutoGen、CrewAI、LangGraph

**什么时候用Multi-Agent：**
• 任务确实需要不同专业角色（如研究员+编码器+审查员）
• 工具数量过大（>50个），单Agent上下文装不下
• 需要并行处理独立子任务

**注意：** 不要为了Multi-Agent而Multi-Agent。2026年的经验是，能用Workflow解决的不要用Agent，能用Single-Agent解决的不要上Multi-Agent (CSDN-Agent面试题) (牛客-大模型应用开发面经)。` },
  { id: 357, question: `Agent的记忆系统如何设计？`, category: `Agent、记忆、架构`, answer: `**三层记忆架构：**

1. **短期记忆（工作记忆）：**
• 当前对话上下文
• 存储在消息历史中
• 受上下文窗口限制
• 优化：滑动窗口、摘要压缩、三级压缩

2. **长期记忆：**
• 用户偏好、历史经验、知识
• 存储在向量数据库中
• 通过语义检索召回相关记忆
• 粒度：按用户/会话/主题分块

3. **会话状态：**
• 当前任务的中间结果、已完成步骤
• 存储在Redis等快速KV中
• 支持断点续传

**记忆写入策略：**
• 重要信息（用户明确告知的偏好）立即写入
• 对话结束后异步总结并写入长期记忆
• 设置TTL和记忆容量上限

**记忆召回策略：**
• 每轮对话前，从长期记忆中检索Top-K相关条目
• 与当前对话历史组装后送入LLM
• 注意记忆的时效性（旧记忆可能过时） (牛客-大模型应用开发面经)。` },
  { id: 358, question: `如何优化Agent的端到端延迟和Token成本？`, category: `Agent、优化、延迟、成本`, answer: `**延迟优化：**
1. **并行工具调用**：独立工具同时执行，T=max而非sum
2. **模型路由**：简单子任务用小模型，复杂推理用大模型
3. **Workflow代替Agent**：确定性流程用固定Workflow，省去LLM规划轮次（可节省4倍Token）
4. **Plan-and-Execute代替ReAct**：先一次性规划全部步骤再执行，减少LLM调用次数
5. **流式输出**：首token快速返回
6. **缓存**：工具调用结果缓存、Prompt Cache
7. **上下文压缩**：摘要历史对话，中间结果只保留关键信息

**成本优化：**
1. 只给Agent真正需要的工具（减少工具描述Token）
2. 按任务类型动态加载工具子集
3. 设置最大步数防死循环
4. 工具结果截断/摘要后再回传 (CSDN-Agent面试题)。` },
  { id: 359, question: `Transformer自注意力机制是如何工作的？`, category: `基础、Transformer、Attention`, answer: `自注意力计算流程：
1. 输入X通过三个线性变换得到Q、K、V：Q = XW_Q, K = XW_K, V = XW_V
2. 计算注意力分数：scores = QK^T / √d_k（缩放防止梯度消失）
3. Causal Mask：将未来位置设为-∞（Decoder-only）
4. Softmax归一化得到权重
5. 加权求和：output = softmax(scores) · V

Multi-Head Attention并行计算多个注意力头，捕获不同子空间特征后拼接。

相比RNN：Transformer可并行计算（RNN必须顺序）、直接建立长距离依赖（RNN有梯度消失）、但计算复杂度O(n²)。FlashAttention通过分块计算和在线softmax减少HBM I/O来加速 (GitHub-AgentGuide)。` },
  { id: 360, question: `RoPE（旋转位置编码）的原理是什么？为什么外推性好？`, category: `基础、RoPE、位置编码`, answer: `RoPE通过旋转矩阵在复数域对Q和K进行位置编码。核心特性：注意力分数只依赖相对位置(m-n)而非绝对位置：

q_m = W_q · x_m · e^(imθ)
k_n = W_k · x_n · e^(inθ)
attention_score ∝ e^(i(m-n)θ)

**相比绝对位置编码的优势：**
• 外推性好：训练2K可推理16K+（配合NTK-Aware Scaling）
• 无额外参数
• 相对位置感知符合语言特性

被LLaMA、Qwen、Mistral等主流模型采用。NTK-Aware RoPE Scaling通过调整频率基数进一步扩展上下文 (GitHub-AgentGuide) (GitHub-quanhua92)。` },
  { id: 361, question: `什么是Scaling Law？Chinchilla修正了什么？`, category: `基础、Scaling Law、训练`, answer: `OpenAI 2020年提出：模型性能与参数量N、数据量D、计算量C呈幂律关系：Loss ∝ N^(-α) ∝ D^(-β)。

**Chinchilla论文（DeepMind 2022）修正：**
• 之前模型训练不足（参数增大但数据没跟上）
• 最优配比：N和D应等比例增长：N_optimal ≈ D_optimal ≈ C^0.5
• 70B模型应用1.4T tokens训练（而非之前的300B）

**实践指导：**
• 小模型充分训练 > 大模型欠训练
• LLaMA/Mistral等基于此选择适中参数量+更多数据
• 不要盲目堆参数，数据质量同等重要 (GitHub-AgentGuide)。` },
  { id: 362, question: `MoE（混合专家模型）的原理是什么？`, category: `基础、MoE、架构`, answer: `MoE将FFN层替换为多个"专家"子网络，每个token只激活部分专家：

1. **Router（门控网络）**：决定每个token发送给哪些专家
2. **Top-K选择**：通常选1~2个专家
3. **负载均衡损失**：防止所有token都发给同一个专家

**优势：**
• 训练时：参数量大（知识容量大）但计算量只按激活的专家算
• DeepSeek-V3用671B总参数但每个token只激活37B

**挑战：**
• 推理时所有专家权重都要加载到显存（显存不省）
• 负载均衡影响吞吐量
• 通信开销大
• 微调难度更高 (GitHub-AgentGuide) (GitCode-2026大厂面试题)。` },
  { id: 363, question: `如何处理RAG中的知识冲突？`, category: `RAG、知识冲突`, answer: `当多个检索来源信息矛盾时：

1. **来源权威性排序**：官方文档 > 部门文档 > 论坛讨论；新版本 > 旧版本
2. **时间衰减**：优先使用最新文档，按时间戳加权
3. **多源验证**：让LLM判断不同来源的一致性，标记冲突点
4. **置信度标注**：对冲突信息标注"来源A说X，来源B说Y"
5. **不强行统一**：如实告知用户存在冲突，建议人工确认
6. **metadata加权**：检索时按文档类型/可信度设置不同权重

在Prompt中明确指示："如果上下文信息存在冲突，请指出矛盾并建议用户核实" (掘金-RAG篇)。` },
  { id: 364, question: `如何设计企业级Agent系统？`, category: `Agent、系统设计`, answer: `五大核心模块：

1. **工具管理层**：MCP Server统一管理，工具权限分级（只读/读写/管理员），调用审计日志
2. **记忆与状态**：短期对话上下文（滑动窗口/摘要压缩），长期向量数据库（偏好/经验），会话Redis（任务状态/中间结果）
3. **可靠性保障**：最大步数限制防死循环、工具调用超时控制、关键操作人工审批、失败重试+熔断
4. **可观测性**：完整Trace（思考链+工具调用+结果）、Token消耗监控、错误分类统计
5. **安全**：Prompt注入防御四层架构、最小权限原则、数据脱敏、PII扫描

**高可用设计：**
• LLM服务多提供商故障转移
• 工具调用幂等设计
• 队列削峰填谷
• 灰度发布和A/B测试 (CSDN-Agent面试题) (牛客-大模型应用开发面经)。` },
  { id: 365, question: `如何评估和保证大模型生成代码的准确性？`, category: `代码生成、评估、工程`, answer: `**多层保障：**

1. **静态分析**：语法检查、类型检查、Linter
2. **单元测试自动生成**：让模型同时生成代码和测试，运行测试验证
3. **沙箱执行**：在Docker/沙箱中运行代码，验证输出
4. **Self-Debug**：将错误信息返回给模型让其修正
5. **代码审查Agent**：另一个LLM审查代码质量和安全性
6. **Human-in-the-Loop**：关键代码人工审批

**评估基准：**
• HumanEval（OpenAI）：函数级代码生成
• MBPP：基础Python编程
• SWE-bench：真实GitHub issue解决（Claude 4.5 Sonnet达77-81%）

**工程实践：** 将代码生成拆分为"理解需求→设计接口→实现→测试→审查"Workflow，每步有验证节点，而非让Agent一次性生成 (CSDN-大模型评测) (牛客-大模型应用开发面经)。` },
];
