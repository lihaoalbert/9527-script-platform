import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AiService } from "../ai/ai.service";

type CharacterProfile = Record<string, unknown>;

@Injectable()
export class CharacterAgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  async getCharacters(projectId: string): Promise<Array<{ name: string; role: string; traits: string }>> {
    if (!this.prisma.enabled) return [];
    const plan = await this.prisma.projectPlan.findUnique({ where: { projectId } });
    if (!plan) return [];
    const chars = (plan.characters as Array<Record<string, unknown>>) ?? [];
    return chars.map((c) => ({
      name: (c.name as string) ?? "?",
      role: (c.role as string) ?? "",
      traits: (c.traits as string) ?? "",
    }));
  }

  async speak(
    projectId: string,
    characterName: string,
    userMessage: string,
    phase: string,
  ): Promise<{ content: string; characterName: string }> {
    const profile = await this.loadProfile(projectId, characterName);
    if (!profile) {
      return { content: `找不到角色"${characterName}"。请先在人物塑造中创建此角色。`, characterName };
    }

    // Build timeline context: what has happened in locked episodes
    const timeline = await this.buildTimelineContext(projectId, characterName);

    const systemPrompt = this.buildCharacterPrompt(profile, characterName, phase) + "\n\n" + timeline;
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    // Load recent character-specific memory
    if (this.prisma.enabled) {
      const history = await this.prisma.conversationMessage.findMany({
        where: { projectId, agentName: characterName },
        orderBy: { createdAt: "desc" },
        take: 15,
      });
      for (const m of history.reverse()) {
        messages.push({
          role: m.role === "SYSTEM" ? "assistant" : "user",
          content: m.content,
        });
      }
    }

    messages.push({ role: "user", content: userMessage });

    const raw = await this.aiService.chatRaw(messages, 0.9, true);
    try {
      let jsonStr = raw.trim();
      const m = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (m) jsonStr = m[1].trim();
      const parsed = JSON.parse(jsonStr);
      return { content: parsed.content || parsed.response || raw, characterName };
    } catch {
      return { content: raw, characterName };
    }
  }

  async saveMemory(projectId: string, characterName: string, content: string) {
    if (!this.prisma.enabled) return;
    await this.prisma.conversationMessage.create({
      data: {
        projectId,
        role: "SYSTEM",
        content,
        agentName: characterName,
      },
    });
  }

  private async buildTimelineContext(projectId: string, characterName: string): Promise<string> {
    if (!this.prisma.enabled) return "";

    const episodes = await this.prisma.projectEpisode.findMany({
      where: { projectId, status: "LOCKED" },
      orderBy: { episodeNumber: "asc" },
      select: { episodeNumber: true, title: true, content: true },
    });

    if (episodes.length === 0) return "\n【时间线】故事尚未开始。你还不知道将发生什么。\n";

    const lines: string[] = [];
    lines.push(`\n【时间线记忆 — 以下是已经发生的剧情，你知道这些事】`);

    for (const ep of episodes) {
      // Extract scenes and events involving this specific character
      const hasCharacter = ep.content.includes(characterName);
      const summary = this.extractEpisodeSummary(ep.content, 150);
      const marker = hasCharacter ? "★ 你在场" : "  （你未出场，可能从他人处听说）";
      lines.push(`\n第${ep.episodeNumber}集《${ep.title}》${marker}\n${summary}`);
    }

    lines.push(`\n【重要规则】`);
    lines.push(`- 以上时间线中标注"你在场"的事件，你亲身经历，可以详细回忆`);
    lines.push(`- 标注"你未出场"的事件，你只能通过传闻了解，不应知道细节`);
    lines.push(`- 时间线之后的事还没有发生，你不能预知未来`);
    lines.push(`- 如果有人问你还没发生的事，你应该说"我不知道"或表现出困惑`);

    return lines.join("\n");
  }

  private extractEpisodeSummary(content: string, maxLen: number): string {
    // Remove scene markers for cleaner summary
    const clean = content.replace(/【.+?】/g, "").replace(/\n+/g, " ").trim();
    return clean.length > maxLen ? clean.slice(0, maxLen) + "..." : clean;
  }

  private async loadProfile(projectId: string, name: string): Promise<CharacterProfile | null> {
    if (!this.prisma.enabled) return null;
    const plan = await this.prisma.projectPlan.findUnique({ where: { projectId } });
    if (!plan) return null;
    const chars = (plan.characters as Array<Record<string, unknown>>) ?? [];
    return chars.find((c) => c.name === name) ?? null;
  }

  private buildCharacterPrompt(profile: CharacterProfile, name: string, phase: string): string {
    const traits = (profile.traits as string) ?? "";
    const role = (profile.role as string) ?? "";
    const desire = (profile.surfaceDesire as string) ?? "";
    const deepNeed = (profile.deepNeed as string) ?? "";
    const fear = (profile.fear as string) ?? "";
    const arc = (profile.arc as string) ?? "";
    const sigLine = (profile.signatureLine as string) ?? "";

    const relationships = (profile.relationships as Array<Record<string, string>>) ?? [];
    const relDesc = relationships.map((r) => `- 对${r.with ?? "?"}：${r.type ?? ""}，${r.description ?? ""}`).join("\n");

    return `你是"${name}"，一个剧本中的虚构人物。你必须完全以${name}的身份、性格和认知来回应。你只有${name}的记忆和视角，不知道剧本之外的世界。

【你的身份】
- 角色定位：${role}
- 性格特征：${traits}
- 表面欲望：${desire}
- 内心深处真正需要：${deepNeed}
- 最大的恐惧/软肋：${fear}
- 角色弧线：${arc}
- 标志性台词或口吻：${sigLine}

【你与其他人的关系】
${relDesc || "暂无定义的关系"}

【表演要求】
1. 你是在一场戏中表演。以第一人称回应，用对白 +【动作描述】的方式
2. 你的性格必须始终保持一致——恐惧不会突然消失，欲望驱动一切行动
3. 用你的标志性口吻，但不要刻意重复标志性台词
4. 只基于时间线中你已知的信息回应。不知道的事就表现不知道
5. 如果编剧向你提问（以第二人称"你"开头），你直接以角色身份回答
6. 你的回应可以包含情感、犹豫、内心挣扎——这些都是好表演的一部分

回应JSON格式：{"content": "【场景/动作描述】对白..."}

当前项目阶段：${phase}。你的回应格式：{"content": "【动作/场景描述】对白内容..."}`;
  }
}
