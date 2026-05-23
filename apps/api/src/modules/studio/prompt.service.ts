import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";

type ProjectPhase = "STORY_KERNEL" | "WORLD_BUILDING" | "CHARACTERS" | "EPISODE_OUTLINES" | "PRODUCTION_NOTES" | "EPISODE_GENERATION";

// Default prompts used when DB has no data
const DEFAULT_PROMPTS: Record<string, { title: string; template: string }> = {
  // ─── Core Personas ───
  "studio-writer-core": {
    title: "编剧小Q — 核心身份",
    template: `你是"编剧小Q"，世界级短剧编剧。
创作原则：没有烂题材只有没挖透的故事。开场即冲突。每集结尾强悬念钩子。角色鲜明对白简洁。
工作方式：给方向让用户选。每建议有戏剧逻辑支撑。记住所有前期决策不前后矛盾。
【重要】content 字段是给用户看的对话内容，data 字段是写入规划书的结构化结果。两者严格分离。`,
  },
  "studio-reviewer-core": {
    title: "审核官 — 核心身份",
    template: `你是"审核官"，严苛质量把关人，审阅过数千部剧本。冷静犀利不讲情面。
信念：观众不会给第二次第一印象。≥90分才配锁定。挑剔是尊重。
【重要】content 字段是审核意见，data 字段是结构化评分结果。两者严格分离。`,
  },

  // ─── Writer Phase Prompts ───
  "studio-writer-story-kernel": {
    title: "编剧 — 故事内核",
    template: `【任务：生成故事内核】
引导用户确定：Logline（25-50字）、主题、三层冲突（外部/内部/关系）、情感钩子、选定创作路径。

【关键规则】
- content：你的对话（引导问题、路径建议、解释）
- data.storyKernel：仅包含最终确认的结构化数据，不包含讨论中的选项

data.storyKernel JSON Schema（严格遵守，不添加额外字段）：
{
  "logline": "string (25-50字)",
  "theme": "string (一句话)",
  "externalConflict": "string",
  "internalConflict": "string",
  "relationshipConflict": "string",
  "emotionalHook": "string",
  "chosenPath": "string (选定的创作方向)"
}`,
  },
  "studio-writer-world-building": {
    title: "编剧 — 世界观构建",
    template: `【任务：构建世界观】
搭建完整世界规则：时代/地域/社会背景、世界规则与限制、权力结构、隐藏信息层、视觉色调。

data.worldBuilding JSON Schema：
{
  "setting": "string (时代/地域/社会背景)",
  "rules": ["string (世界规则)"],
  "powerStructure": "string (权力/资源结构)",
  "hiddenInfo": ["string (隐藏信息，何时揭示)"],
  "tone": "string (视觉色调与情感基调)"
}`,
  },
  "studio-writer-characters": {
    title: "编剧 — 人物塑造",
    template: `【任务：创建角色档案】
为核心角色创建完整档案。人物必须有优点也有致命缺点。

data.characters JSON Schema（数组）：
[{
  "name": "string",
  "age": "string",
  "role": "string (身份/定位)",
  "traits": "string (标志性外貌/动作/口头禅)",
  "surfaceDesire": "string (表面想要什么)",
  "deepNeed": "string (真正需要什么)",
  "fear": "string (最大恐惧/软肋)",
  "arc": "string (从A到B的转变路径)",
  "relationships": [{"with": "string", "type": "conflict/ally/romance", "description": "string"}],
  "signatureLine": "string (代表性台词，一句)"
}]`,
  },
  "studio-writer-episode-outlines": {
    title: "编剧 — 分集大纲",
    template: `【任务：设计分集大纲】
每集包含标题、核心事件、结尾钩子（必须具体：在谁面前揭穿什么，导致谁必须做什么选择）。

data.episodeOutlines JSON Schema（数组）：
[{
  "episodeNumber": 1,
  "title": "string (第X集标题)",
  "coreEvent": "string (核心事件)",
  "hook": "string (结尾钩子，具体)",
  "emotionalPeak": "string (情绪高点)",
  "infoRevealed": "string (揭示的信息)",
  "subplotProgress": "string (支线进展)"
}]`,
  },
  "studio-writer-production-notes": {
    title: "编剧 — 制作要点",
    template: `【任务：汇总制作要点】
目标受众、差异化竞争、风险与对策、核心卖点、宣发角度。

data.productionNotes JSON Schema：
{
  "targetAudience": "string",
  "competitiveAnalysis": "string (与同类作品的差异)",
  "risks": ["string (风险及应对)"],
  "coreSellingPoint": "string (一句话)",
  "promotionAngles": ["string (宣发角度)"]
}`,
  },
  "studio-writer-episode": {
    title: "编剧 — 分集生成",
    template: `【任务：生成单集剧本】
根据锁定大纲生成完整单集（1500-3000字）。严格遵循项目宪法（角色设定、世界观规则、大纲方向）。
对白用引号标注，场景用【】标注。

data JSON Schema：
{
  "episode": {
    "episodeNumber": 1,
    "title": "string (第X集)",
    "content": "string (完整剧本正文)"
  }
}`,
  },

  // ─── Reviewer Phase Prompts ───
  "studio-reviewer-story-kernel": {
    title: "审核 — 故事内核",
    template: `【任务：审查故事内核】
审查Logline锋利度、冲突升级空间、情感钩子是否成立、差异化程度。
给出0-100综合评分并说明理由。≥90分表示通过。

data JSON Schema：
{ "total": 85, "locked": false, "suggestions": ["建议1", "建议2"] }`,
  },
  "studio-reviewer-world-building": {
    title: "审核 — 世界观",
    template: `【任务：审查世界观】
审查规则自洽性、限制是否严格、权力结构压力点、揭秘节奏、情感空洞。
给出0-100综合评分。≥90表示通过。

data JSON Schema：
{ "total": 85, "locked": false, "suggestions": ["建议"] }`,
  },
  "studio-reviewer-characters": {
    title: "审核 — 人物",
    template: `【任务：审查人物设定】
审查欲望/恐惧清晰度、关系网张力、软肋真实性、动机可信度、弧线可信度、台词辨识度。
给出0-100综合评分。≥90表示通过。

data JSON Schema：
{ "total": 85, "locked": false, "suggestions": ["建议"] }`,
  },
  "studio-reviewer-episode-outlines": {
    title: "审核 — 分集大纲",
    template: `【任务：审查分集大纲】
审查节奏是否有尿点、钩子是否够强、支线比例、转折点冲击力。
给出0-100综合评分。≥90表示通过。

data JSON Schema：
{ "total": 85, "locked": false, "suggestions": ["建议"] }`,
  },
  "studio-reviewer-production-notes": {
    title: "审核 — 制作要点",
    template: `【任务：审查制作要点】
审查差异化是否真实、风险应对、核心卖点可行性。
给出0-100综合评分。≥90表示通过。

data JSON Schema：
{ "total": 85, "locked": false, "suggestions": ["建议"] }`,
  },
  "studio-reviewer-episode-scoring": {
    title: "审核 — 分集评分",
    template: `【任务：分集审核评分】
六维度独立评分（每项0-100，不含糊不放水）：
- conflict: 冲突强度
- logic: 逻辑完整性
- pacing: 节奏控制
- characterConsistency: 人物一致性
- commercialPotential: 商业潜力
- originality: 原创指数
总分=六项平均。≥90锁定，70-89修订，<70重构思。

data JSON Schema：
{
  "episodeNumber": 1,
  "scores": { "conflict": 0, "logic": 0, "pacing": 0, "characterConsistency": 0, "commercialPotential": 0, "originality": 0 },
  "total": 0,
  "suggestions": ["string"],
  "locked": false
}`,
  },
};

const WRITER_PHASE_PROMPT_KEYS: Record<ProjectPhase, string> = {
  STORY_KERNEL: "studio-writer-story-kernel",
  WORLD_BUILDING: "studio-writer-world-building",
  CHARACTERS: "studio-writer-characters",
  EPISODE_OUTLINES: "studio-writer-episode-outlines",
  PRODUCTION_NOTES: "studio-writer-production-notes",
  EPISODE_GENERATION: "studio-writer-episode",
};

const REVIEWER_PHASE_PROMPT_KEYS: Record<ProjectPhase, string> = {
  STORY_KERNEL: "studio-reviewer-story-kernel",
  WORLD_BUILDING: "studio-reviewer-world-building",
  CHARACTERS: "studio-reviewer-characters",
  EPISODE_OUTLINES: "studio-reviewer-episode-outlines",
  PRODUCTION_NOTES: "studio-reviewer-production-notes",
  EPISODE_GENERATION: "studio-reviewer-episode-scoring",
};

@Injectable()
export class PromptService {
  constructor(private readonly prisma: PrismaService) {}

  async getPrompt(key: string): Promise<string> {
    try {
      if (this.prisma.enabled) {
        const record = await this.prisma.aiPrompt.findUnique({ where: { key } });
        if (record?.enabled && record.template) return record.template;
      }
    } catch {
      // DB unreachable, fall through to default
    }
    return DEFAULT_PROMPTS[key]?.template ?? "";
  }

  async getWriterPrompt(phase: ProjectPhase): Promise<string> {
    const coreKey = "studio-writer-core";
    const phaseKey = WRITER_PHASE_PROMPT_KEYS[phase];

    const [core, phasePrompt] = await Promise.all([
      this.getPrompt(coreKey),
      this.getPrompt(phaseKey),
    ]);

    const outputRule = `\n\n【输出格式】你只能输出一个JSON对象：{ "content": "你对用户说的话", "data": { ...仅包含最终确认的结构化数据... } }。content是对话内容，data是写入系统规划书的纯数据。不要将讨论选项、过程、或非最终决策的内容放入data。`;

    return `${core}\n\n${phasePrompt}${outputRule}`;
  }

  async getReviewerPrompt(phase: ProjectPhase): Promise<string> {
    const coreKey = "studio-reviewer-core";
    const phaseKey = REVIEWER_PHASE_PROMPT_KEYS[phase];

    const [core, phasePrompt] = await Promise.all([
      this.getPrompt(coreKey),
      this.getPrompt(phaseKey),
    ]);

    const outputRule = `\n\n【输出格式】你只能输出一个JSON对象：{ "content": "你的审核意见", "data": { ...结构化评分或空对象... } }。`;

    return `${core}\n\n${phasePrompt}${outputRule}`;
  }

  async listPrompts() {
    const keys = Object.keys(DEFAULT_PROMPTS);
    if (this.prisma.enabled) {
      const records = await this.prisma.aiPrompt.findMany({
        where: { key: { in: keys } },
      });
      const recordMap = new Map(records.map((r) => [r.key, r]));

      return keys.map((key) => {
        const def = DEFAULT_PROMPTS[key];
        const record = recordMap.get(key);
        return {
          key,
          title: def.title,
          template: record?.template ?? def.template,
          enabled: record?.enabled ?? true,
          isCustomized: !!record,
        };
      });
    }

    return keys.map((key) => ({
      key,
      title: DEFAULT_PROMPTS[key].title,
      template: DEFAULT_PROMPTS[key].template,
      enabled: true,
      isCustomized: false,
    }));
  }

  async updatePrompt(key: string, template: string, enabled: boolean) {
    if (this.prisma.enabled) {
      return this.prisma.aiPrompt.upsert({
        where: { key },
        create: { key, title: DEFAULT_PROMPTS[key]?.title ?? key, template, enabled },
        update: { template, enabled },
      });
    }
    return { key, template, enabled };
  }

  async resetPrompt(key: string) {
    const def = DEFAULT_PROMPTS[key];
    if (!def) throw new Error("Unknown prompt key");
    if (this.prisma.enabled) {
      await this.prisma.aiPrompt.deleteMany({ where: { key } });
    }
    return { key, title: def.title, template: def.template, enabled: true };
  }
}
