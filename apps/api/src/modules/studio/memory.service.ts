import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { buildWriterPrompt, buildReviewerPrompt } from "./personas";

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
  constructor(private readonly prisma: PrismaService) {}

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

  private getLayer0(personaRole: "writer" | "reviewer", phase: ProjectPhase): string {
    return personaRole === "writer"
      ? buildWriterPrompt(phase)
      : buildReviewerPrompt(phase);
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
      ? "=== 项目宪法（已锁定）===\n以下内容已三方认可，后续创作必须遵守，不得偏离。\n"
      : "=== 当前规划（未锁定）===\n以下为当前已确定的内容，后续讨论中仍可调整。\n";

    const parts: string[] = [];

    const kernel = plan.storyKernel as Record<string, unknown> | undefined;
    if (kernel && Object.keys(kernel).length > 0) {
      parts.push(`【故事内核】\n${JSON.stringify(kernel, null, 2)}`);
    }

    const world = plan.worldBuilding as Record<string, unknown> | undefined;
    if (world && Object.keys(world).length > 0) {
      parts.push(`【世界观】\n${JSON.stringify(world, null, 2)}`);
    }

    const chars = plan.characters as Array<Record<string, unknown>> | undefined;
    if (chars && chars.length > 0) {
      parts.push(`【角色】\n${JSON.stringify(chars, null, 2)}`);
    }

    const outlines = plan.episodeOutlines as Array<Record<string, unknown>> | undefined;
    if (outlines && outlines.length > 0) {
      parts.push(`【分集大纲】\n${JSON.stringify(outlines, null, 2)}`);
    }

    if (parts.length === 0) return header + "暂无内容。";

    return header + parts.join("\n\n");
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
