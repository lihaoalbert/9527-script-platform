import { Injectable } from "@nestjs/common";

@Injectable()
export class AiService {
  createOutline(input: { genre: string; premise: string }) {
    return {
      provider: process.env.AI_PROVIDER ?? "mock",
      titleOptions: [
        `${input.genre}：命运反转`,
        `她在第七集翻盘`,
        `9527号剧本`
      ],
      outline: [
        "前三集快速建立压迫关系和主角目标。",
        "中段通过误会、背叛和身份反转持续制造冲突。",
        "结尾完成情绪释放，并保留可续作的关系钩子。"
      ],
      nextSteps: ["补全人物小传", "生成分集大纲", "扩写第一集正文"]
    };
  }

  scoreScript(content: string) {
    const aiLikeSignals = ["首先", "其次", "综上", "命运的齿轮"].filter((word) =>
      content.includes(word)
    ).length;

    return {
      total: Math.max(60, 88 - aiLikeSignals * 4),
      conflict: 86,
      logic: 82,
      pacing: 84,
      commercialPotential: 89,
      aiRate: Math.min(95, 20 + aiLikeSignals * 12),
      suggestions: [
        "前三集应更快给出主角的明确目标。",
        "每集结尾增加一次信息差或关系反转。",
        "减少总结式表达，增加行动和对白推动剧情。"
      ]
    };
  }
}
