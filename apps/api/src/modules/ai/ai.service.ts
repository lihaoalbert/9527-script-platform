import { Injectable } from "@nestjs/common";

@Injectable()
export class AiService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl = "https://api.deepseek.com/v1/chat/completions";

  constructor() {
    this.apiKey = process.env.AI_API_KEY ?? "";
    this.model = process.env.AI_MODEL ?? "deepseek-v4-pro";
  }

  async chatRaw(messages: Array<{ role: string; content: string }>, temperature = 0.7, jsonMode = false): Promise<string> {
    if (!this.apiKey) {
      throw new Error("AI_API_KEY is not configured");
    }

    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature,
    };
    if (jsonMode) {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Deepseek API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as { choices?: Array<{ message: { content: string } }> };
    return data.choices?.[0]?.message?.content ?? "";
  }

  async createOutline(input: { genre: string; premise: string }) {
    const provider = this.apiKey ? "deepseek" : "mock";

    if (!this.apiKey) {
      return {
        provider: "mock",
        titleOptions: [`${input.genre}：命运反转`, `她在第七集翻盘`, `9527号剧本`],
        outline: [
          "前三集快速建立压迫关系和主角目标。",
          "中段通过误会、背叛和身份反转持续制造冲突。",
          "结尾完成情绪释放，并保留可续作的关系钩子。"
        ],
        nextSteps: ["补全人物小传", "生成分集大纲", "扩写第一集正文"]
      };
    }

    const systemPrompt = `你是一个专业的短剧剧本策划助手。用户会提供题材和核心设定，你需要生成3个标题方向建议和3-5个情节骨架要点，以及下一步建议。回复使用JSON格式：
{
  "titleOptions": ["标题1", "标题2", "标题3"],
  "outline": ["要点1", "要点2", ...],
  "nextSteps": ["建议1", "建议2", ...]
}`;

    const content = await this.chatRaw([
      { role: "system", content: systemPrompt },
      { role: "user", content: `题材：${input.genre}\n核心设定：${input.premise}` }
    ], 0.8);

    try {
      let jsonStr = content.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      const parsed = JSON.parse(jsonStr);
      return { provider, ...parsed };
    } catch {
      return {
        provider,
        titleOptions: [`${input.genre}：命运反转`, `她在第七集翻盘`, `9527号剧本`],
        outline: content.split("\n").filter(Boolean).slice(0, 5),
        nextSteps: ["补全人物小传", "生成分集大纲", "扩写第一集正文"]
      };
    }
  }

  async generateScript(input: {
    genre: string;
    premise: string;
    targetWords?: number;
    episodes?: number;
    tone?: string;
    protagonist?: string;
  }) {
    const episodes = input.episodes ?? 12;
    const targetWords = input.targetWords ?? 18000;
    const protagonist = input.protagonist?.trim() || "女主";
    const tone = input.tone?.trim() || "强冲突、快节奏";
    const provider = this.apiKey ? "deepseek" : "mock";

    if (!this.apiKey) {
      const title = `${input.genre}《${protagonist}反转计划》`;
      const episodeBeats = Array.from({ length: episodes }, (_, index) => ({
        episode: index + 1,
        title: `第${index + 1}集`,
        hook: index === episodes - 1 ? `${protagonist}在终局揭开真正底牌，为续作留下新危机。` : `${protagonist}在第${index + 1}集中遭遇新的关系反噬与身份压力。`,
        beat: index === 0 ? `用高压开场建立${protagonist}的处境与目标，让观众在三分钟内进入主冲突。` : `推进主线冲突，同时强化情感关系和信息差，为下一集结尾抛出新的悬念。`
      }));

      const characters = [
        `${protagonist}：表面被动，实则极擅长观察人性与布局反击。`,
        "男主：初期冷感克制，后期在利益与情感之间被迫站队。",
        "反派：掌控资源与舆论，持续给主角制造结构性压迫。",
        "盟友：看似摇摆，关键时刻为主角提供致命线索。"
      ];

      const summary = `这是一个${tone}的${input.genre}短剧方案，围绕"${input.premise}"展开。故事以高压局面开场，让${protagonist}在被低估的环境里逐步夺回主动权，并通过连续反转驱动追更。`;

      const sampleContent = [
        `【项目定位】`, `题材：${input.genre}`, `目标字数：约${targetWords}字`, `建议集数：${episodes}集`, "",
        `【一句话梗概】`, `${summary}`, "", `【主要人物】`, ...characters.map((item) => `- ${item}`), "",
        `【分集节奏示例】`, ...episodeBeats.slice(0, 6).map((item) => `第${item.episode}集：${item.beat} 结尾钩子：${item.hook}`), "",
        `【正文试写】`,
        `夜里十点，${protagonist}站在灯火最亮的大厅门口，明知道这一步跨进去就再也没有退路，却还是抬手推开了门。所有目光瞬间落在她身上，那些人等着她出丑，等着她低头，等着她承认自己只是个被推上牌桌的替代品。`,
        `可她只是平静地把包放下，抬眼看向坐在主位的人："你们要的是一个听话的人，可惜我不是。既然今晚一定要分输赢，那从这一刻开始，规则由我来改。"`,
        `空气像被针尖挑破，安静里带着肉眼可见的敌意。男主指尖敲了敲桌面，没有替她解围，也没有赶她出去，只淡淡说了一句："你确定你知道自己在做什么？"`,
        `${protagonist}笑了笑："我当然知道。真正不知道的人，是你们。"`
      ].join("\n");

      return { provider, title, summary, targetWords, episodes, tone, protagonist, characters, episodeBeats, content: sampleContent };
    }

    const systemPrompt = `你是一个专业的短剧剧本策划助手。用户在提供题材、主角、核心设定等信息后，你需要生成完整的短剧剧本方案，包括：
1. 标题
2. 一句话梗概
3. 主要人物（4-6个，含人设说明）
4. 分集钩子（每集一个结尾悬念）
5. 正文试写（1500-3000字的开头部分）

回复使用JSON格式：
{
  "title": "标题",
  "summary": "一句话梗概",
  "characters": ["人物1", "人物2", ...],
  "episodeBeats": [{"episode": 1, "title": "第1集", "hook": "钩子"}, ...],
  "content": "正文试写内容"
}`;

    const content = await this.chatRaw([
      { role: "system", content: systemPrompt },
      { role: "user", content: `题材：${input.genre}\n主角：${protagonist}\n风格：${tone}\n核心设定：${input.premise}\n目标集数：${episodes}集\n目标字数：约${targetWords}字` }
    ], 0.75);

    try {
      let jsonStr = content.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      const parsed = JSON.parse(jsonStr);
      return { provider, ...parsed, targetWords, episodes, tone, protagonist };
    } catch {
      throw new Error("Failed to parse AI response as JSON");
    }
  }

  async scoreScript(content: string) {
    if (!this.apiKey) {
      const aiLikeSignals = ["首先", "其次", "综上", "命运的齿轮"].filter((word) => content.includes(word)).length;
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

    const systemPrompt = `你是一个专业的短剧剧本评分专家。请对以下剧本内容进行评分，评估维度包括：
1. 冲突强度 (0-100)：剧情冲突是否激烈、引人入胜
2. 逻辑完整性 (0-100)：剧情逻辑是否自洽、人物行为是否合理
3. 节奏控制 (0-100)：节奏是否紧凑、是否有拖沓
4. 商业潜力 (0-100)：是否具有市场吸引力、传播潜力
5. AI率估算 (0-100%)：估算内容由AI生成的可能性

回复使用JSON格式：
{
  "conflict": 85,
  "logic": 80,
  "pacing": 88,
  "commercialPotential": 90,
  "aiRate": 25,
  "total": 85,
  "suggestions": ["建议1", "建议2", "建议3"]
}`;

    const result = await this.chatRaw([
      { role: "system", content: systemPrompt },
      { role: "user", content: `请评分以下剧本：\n\n${content.slice(0, 5000)}` }
    ], 0.3);

    try {
      let jsonStr = result.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      return JSON.parse(jsonStr);
    } catch {
      const aiLikeSignals = ["首先", "其次", "综上", "命运的齿轮"].filter((word) => content.includes(word)).length;
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

  async reviewScript(content: string, question?: string) {
    const provider = this.apiKey ? "deepseek" : "mock";

    if (!this.apiKey) {
      return {
        provider,
        review: `【审核意见】

🔴 逻辑问题：
- 女主在第三集的行为动机不清晰，为什么要帮男主挡酒？
- 男主突然爱上女主的时间节点太突兀

🟡 节奏问题：
- 第一集前半段铺垫过长，建议压缩
- 第五集到第八集节奏偏慢

🟢 亮点：
- 开场的冲突设计很抓人
- 对白简洁有力，符合角色性格

💡 建议：
- 给女主增加一个更强的个人目标
- 考虑在第六集增加一个意外的盟友`,
      };
    }

    const reviewPrompt = question
      ? `你是一个资深剧本审核官。用户提出了一个关于剧本的问题，请用犀利的中文回答。\n\n剧本内容：\n${content.slice(0, 3000)}\n\n用户问题：${question}`
      : `你是一个资深剧本审核官。请对以下剧本内容进行严格审核，用犀利的中文直接指出问题。\n\n剧本内容：\n${content.slice(0, 3000)}`;

    const result = await this.chatRaw([
      { role: "system", content: reviewPrompt },
      { role: "user", content: "请审核这个剧本" }
    ], 0.5);

    return {
      provider,
      review: result,
    };
  }
}