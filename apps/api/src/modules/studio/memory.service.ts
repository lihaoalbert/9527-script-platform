import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { PromptService } from "./prompt.service";

type ProjectPhase = "STORY_KERNEL" | "WORLD_BUILDING" | "CHARACTERS" | "EPISODE_OUTLINES" | "PRODUCTION_NOTES" | "EPISODE_GENERATION";

type ContextMessage = { role: string; content: string };

const PHASE_LABELS: Record<ProjectPhase, string> = {
  STORY_KERNEL: "故事内核",
  WORLD_BUILDING: "世界观构建",
  CHARACTERS: "人物塑造",
  EPISODE_OUTLINES: "分集大纲",
  PRODUCTION_NOTES: "制作要点",
  EPISODE_GENERATION: "分集生成",
};

@Injectable()
export class MemoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promptService: PromptService,
  ) {}

  async assembleContext(
    projectId: string,
    personaRole: "writer" | "reviewer",
    phase: ProjectPhase
  ): Promise<ContextMessage[]> {
    const [layer0, layer1, layer2, layer3, layer4] = await Promise.all([
      this.getLayer0(personaRole, phase),
      this.getLayer1(projectId),
      this.getLayer2(projectId, phase),
      this.getLayer3(projectId),
      this.getLayer4(projectId, phase),
    ]);

    // Combine layers into messages array
    const systemContent = [layer0, layer1, layer2, layer4].filter(Boolean).join("\n\n---\n\n");

    const messages: ContextMessage[] = [
      { role: "system", content: systemContent },
    ];

    // Layer 3: recent conversation history (already in role/content format)
    if (layer3.length > 0) {
      messages.push(...layer3);
    }

    return messages;
  }

  async summarizePhase(
    projectId: string,
    phase: ProjectPhase,
    startMessageId: string,
    endMessageId: string
  ): Promise<string> {
    // In production, this would call AI to generate a summary. For now, use a lightweight approach.
    const summary = `[Phase: ${PHASE_LABELS[phase]}] Messages from ${startMessageId} to ${endMessageId} completed.`;

    if (this.prisma.enabled) {
      await this.prisma.conversationSummary.create({
        data: { projectId, phase, summary, startMessageId, endMessageId },
      });
    }

    return summary;
  }

  private async getLayer0(personaRole: "writer" | "reviewer", phase: ProjectPhase): Promise<string> {
    return personaRole === "writer"
      ? this.promptService.getWriterPrompt(phase)
      : this.promptService.getReviewerPrompt(phase);
  }

  private async getLayer1(projectId: string): Promise<string> {
    let plan: Record<string, unknown> | null = null;
    let locked = false;

    if (this.prisma.enabled) {
      const record = await this.prisma.projectPlan.findUnique({ where: { projectId } });
      if (record) {
        plan = { storyKernel: record.storyKernel, worldBuilding: record.worldBuilding, characters: record.characters, episodeOutlines: record.episodeOutlines };
        locked = record.lockedAt !== null;
      }
    }

    if (!plan) {
      return "项目尚未有规划内容，请在对话中逐步完善。";
    }

    const header = locked
      ? "=== 项目宪法（已锁定，不可违背）===\n"
      : "=== 当前规划（未锁定）===\n";

    const parts: string[] = [];

    const kernel = plan.storyKernel as Record<string, unknown> | undefined;
    if (kernel && Object.keys(kernel).length > 0) {
      parts.push(`【故事内核】\nLogline: ${kernel.logline ?? "无"}\n主题: ${kernel.theme ?? "无"}\n情感钩子: ${kernel.emotionalHook ?? "无"}\n创作路径: ${kernel.chosenPath ?? "无"}`);
    }

    const world = plan.worldBuilding as Record<string, unknown> | undefined;
    if (world && Object.keys(world).length > 0) {
      const rules = Array.isArray(world.rules) ? world.rules.join("；") : "无";
      const hidden = Array.isArray(world.hiddenInfo) ? world.hiddenInfo.join("；") : "无";
      parts.push(`【世界观】\n设定: ${world.setting ?? "无"}\n硬规则: ${rules}\n隐藏信息: ${hidden}\n权力结构: ${world.powerStructure ?? "无"}`);
    }

    const chars = plan.characters as Array<Record<string, unknown>> | undefined;
    if (chars && chars.length > 0) {
      const charList = chars.map((c: Record<string, unknown>) =>
        `- ${c.name ?? "?"}（${c.role ?? "?"}）：${c.traits ?? ""}，欲望：${c.surfaceDesire ?? ""}，软肋：${c.fear ?? ""}，弧线：${c.arc ?? ""}`
      ).join("\n");
      parts.push(`【角色清单（${chars.length}人，剧本中出现的所有角色必须在下列清单中）】\n${charList}`);
    } else {
      parts.push("【角色清单】⚠️ 尚未定义任何角色！请先完成人物塑造。");
    }

    const outlines = plan.episodeOutlines as Array<Record<string, unknown>> | undefined;
    if (outlines && outlines.length > 0) {
      const olList = outlines.map((o: Record<string, unknown>) =>
        `第${o.episodeNumber ?? "?"}集《${o.title ?? ""}》：${o.coreEvent ?? ""} | 钩子: ${o.hook ?? ""}`
      ).join("\n");
      parts.push(`【分集大纲（${outlines.length}集）每集必须按此大纲创作】\n${olList}`);
    } else {
      parts.push("【分集大纲】⚠️ 尚未定义！请先完成分集大纲。");
    }

    // Collect scenes from locked episodes
    const scenes = await this.collectScenes(projectId);
    if (scenes.length > 0) {
      parts.push(`【场景清单（${scenes.length}个，新场景出现时应保持名称一致）】\n${scenes.join("、")}`);
    }

    if (parts.length === 0) return header + "暂无内容。";

    return header + "⚠️ 以下内容必须严格遵守。跨集逻辑、角色名称/身份/场景名称、世界规则不得自相矛盾。\n\n" + parts.join("\n\n");
  }

  private async collectScenes(projectId: string): Promise<string[]> {
    if (!this.prisma.enabled) return [];
    const episodes = await this.prisma.projectEpisode.findMany({
      where: { projectId, status: "LOCKED" },
      orderBy: { episodeNumber: "asc" },
      select: { content: true },
    });
    const sceneSet = new Set<string>();
    for (const ep of episodes) {
      const matches = ep.content.match(/【(.+?)】/g);
      if (matches) {
        for (const m of matches) {
          const scene = m.replace(/【|】/g, "").trim();
          if (scene.length >= 2 && scene.length <= 20) sceneSet.add(scene);
        }
      }
    }
    return Array.from(sceneSet);
  }

  private async getLayer2(projectId: string, phase: ProjectPhase): Promise<string> {
    const lines: string[] = [];
    lines.push(`=== 当前状态 ===`);
    lines.push(`当前阶段：${PHASE_LABELS[phase]}`);
    lines.push(`当前时间：${new Date().toISOString()}`);

    if (this.prisma.enabled) {
      const project = await this.prisma.project.findUnique({ where: { id: projectId } });
      if (project) {
        lines.push(`项目名：${project.name}`);
        lines.push(`项目状态：${project.status}`);
      }

      // Check for locked episodes
      const lockedEpisodes = await this.prisma.projectEpisode.findMany({
        where: { projectId, status: "LOCKED" },
        orderBy: { episodeNumber: "asc" },
      });
      if (lockedEpisodes.length > 0) {
        lines.push(`已锁定分集：${lockedEpisodes.map((e) => `第${e.episodeNumber}集`).join("、")}`);
      }

      // Get recent decisions
      const recentDecisions = await this.prisma.conversationMessage.findMany({
        where: { projectId, decision: { not: Prisma.JsonNullValueFilter.JsonNull } },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
      if (recentDecisions.length > 0) {
        lines.push("最近决策：");
        for (const msg of recentDecisions.reverse()) {
          lines.push(`- ${JSON.stringify(msg.decision)}`);
        }
      }
    }

    return lines.join("\n");
  }

  private async getLayer3(projectId: string): Promise<ContextMessage[]> {
    if (!this.prisma.enabled) return [];

    const messages = await this.prisma.conversationMessage.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      take: 30,
    });

    return messages.map((m) => {
      let role = "user";
      if (m.role === "WRITER" || m.role === "REVIEWER") role = "assistant";
      else if (m.role === "SYSTEM") role = "system";
      else if (m.role === "USER") role = "user";
      return { role, content: m.content };
    });
  }

  private async getLayer4(projectId: string, currentPhase: ProjectPhase): Promise<string> {
    if (!this.prisma.enabled) return "";

    const summaries = await this.prisma.conversationSummary.findMany({
      where: { projectId, phase: { not: currentPhase } },
      orderBy: { createdAt: "asc" },
    });

    if (summaries.length === 0) return "";

    return "=== 历史阶段摘要 ===\n" + summaries.map((s) => `[${PHASE_LABELS[s.phase]}] ${s.summary}`).join("\n");
  }
}
