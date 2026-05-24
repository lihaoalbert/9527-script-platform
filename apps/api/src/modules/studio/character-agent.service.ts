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

    const systemPrompt = this.buildCharacterPrompt(profile, characterName, phase);
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    // Load recent character-specific memory
    if (this.prisma.enabled) {
      const history = await this.prisma.conversationMessage.findMany({
        where: { projectId, agentName: characterName },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      for (const m of history.reverse()) {
        messages.splice(1, 0, {
          role: m.role === "SYSTEM" ? "user" : "user",
          content: m.content,
        });
      }
    }

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
1. 以第一人称回应，就像你在场景中说台词或做动作
2. 保持你的人物性格一致性——你的恐惧不能突然消失，你的欲望驱动你的行动
3. 用你的标志性口吻说话，但不要刻意重复标志性台词
4. 如果问题涉及你不知道的信息（超出你的角色认知），如实表现困惑或不知情
5. 场景描述用【】标注，对白正常书写即可

当前项目阶段：${phase}。你的回应格式：{"content": "【动作/场景描述】对白内容..."}`;
  }
}
