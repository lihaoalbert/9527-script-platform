import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { AiService } from "../ai/ai.service";
import { MemoryService } from "./memory.service";

type ProjectPhase = "STORY_KERNEL" | "WORLD_BUILDING" | "CHARACTERS" | "EPISODE_OUTLINES" | "PRODUCTION_NOTES" | "EPISODE_GENERATION";

const PHASE_ORDER: ProjectPhase[] = [
  "STORY_KERNEL", "WORLD_BUILDING", "CHARACTERS", "EPISODE_OUTLINES", "PRODUCTION_NOTES",
];

type CreateProjectInput = { name: string; genre?: string; ownerId: string };
type SendMessageInput = { content: string; targetPersona: "writer" | "reviewer" };
type UpdatePlanInput = {
  storyKernel?: Record<string, unknown>;
  worldBuilding?: Record<string, unknown>;
  characters?: Record<string, unknown>[];
  episodeOutlines?: Record<string, unknown>[];
  productionNotes?: Record<string, unknown>;
};

@Injectable()
export class StudioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly memoryService: MemoryService
  ) {}

  // ─── Project CRUD ───

  async createProject(input: CreateProjectInput) {
    const data = {
      name: input.name,
      genre: input.genre ?? null,
      ownerId: input.ownerId,
      status: "PLANNING" as const,
      currentPhase: "STORY_KERNEL" as const,
    };

    if (this.prisma.enabled) {
      const project = await this.prisma.project.create({ data });
      await this.prisma.projectPlan.create({
        data: { projectId: project.id },
      });
      // Seed a welcome message
      await this.prisma.conversationMessage.create({
        data: {
          projectId: project.id,
          role: "SYSTEM",
          phase: "STORY_KERNEL",
          content: `欢迎来到项目"${input.name}"！我是编剧小Q，旁边是我的搭档审核官。我们一起把这个故事做好。\n\n第一步：我们来聊聊故事内核。你想写一个什么样的故事？题材、风格、或者一句话的想法都可以。`,
        },
      });
      return project;
    }

    return { id: "demo-project", ...data, planLockedAt: null, createdAt: new Date(), updatedAt: new Date() };
  }

  async listProjects(ownerId?: string, status?: string) {
    if (this.prisma.enabled) {
      const where: Record<string, unknown> = {};
      if (ownerId) where.ownerId = ownerId;
      if (status) where.status = status;

      const projects = await this.prisma.project.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        include: { episodes: { select: { id: true } } },
      });

      return projects.map((p) => ({
        id: p.id,
        name: p.name,
        genre: p.genre,
        status: p.status,
        currentPhase: p.currentPhase,
        planLockedAt: p.planLockedAt,
        episodeCount: p.episodes.length,
        updatedAt: p.updatedAt,
      }));
    }

    return [];
  }

  async getProject(id: string) {
    if (this.prisma.enabled) {
      const project = await this.prisma.project.findUnique({
        where: { id },
        include: {
          plan: true,
          episodes: {
            orderBy: { episodeNumber: "asc" },
            include: { score: true },
          },
        },
      });
      if (!project) throw new NotFoundException("Project not found");

      const messageCount = await this.prisma.conversationMessage.count({ where: { projectId: id } });

      return { ...project, messageCount };
    }

    throw new NotFoundException("Project not found");
  }

  async updateProject(id: string, input: Partial<CreateProjectInput>) {
    if (this.prisma.enabled) {
      return this.prisma.project.update({ where: { id }, data: input });
    }
    throw new NotFoundException("Project not found");
  }

  async archiveProject(id: string) {
    if (this.prisma.enabled) {
      return this.prisma.project.update({ where: { id }, data: { status: "ARCHIVED" } });
    }
    throw new NotFoundException("Project not found");
  }

  // ─── Chat / Message Handling ───

  async sendMessage(projectId: string, input: SendMessageInput) {
    // 1. Save user message
    const userMessage = {
      id: `user-${Date.now()}`,
      projectId,
      role: "USER" as const,
      content: input.content,
      phase: undefined as ProjectPhase | undefined,
      step: undefined as number | undefined,
      decision: undefined as Record<string, unknown> | undefined,
      createdAt: new Date(),
    };

    if (this.prisma.enabled) {
      const project = await this.prisma.project.findUnique({ where: { id: projectId } });
      if (!project) throw new NotFoundException("Project not found");

      userMessage.phase = project.currentPhase;
      await this.prisma.conversationMessage.create({
        data: {
          projectId,
          role: "USER",
          content: input.content,
          phase: project.currentPhase,
        },
      });
    }

    // 2. Assemble context and call AI
    let aiResponse: { content: string; data?: Record<string, unknown> };
    try {
      const project = this.prisma.enabled
        ? await this.prisma.project.findUnique({ where: { id: projectId } })
        : null;
      const currentPhase = (project?.currentPhase ?? "STORY_KERNEL") as ProjectPhase;

      // Detect what phase the user is actually asking about (for reviewer in manual mode)
      const detectedPhase = input.targetPersona === "reviewer"
        ? this.detectPhaseFromMessage(input.content, currentPhase)
        : currentPhase;

      const messages = await this.memoryService.assembleContext(
        projectId,
        input.targetPersona,
        detectedPhase
      );

      // Add the user's new message
      messages.push({ role: "user", content: input.content });

      const raw = await this.aiService.chatRaw(messages, input.targetPersona === "writer" ? 0.8 : 0.5, true);

      // Parse JSON response
      let parsed: { content: string; data?: Record<string, unknown> };
      try {
        let jsonStr = raw.trim();
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) jsonStr = jsonMatch[1].trim();
        parsed = JSON.parse(jsonStr);
      } catch {
        parsed = { content: raw };
      }

      aiResponse = parsed;
    } catch (e) {
      aiResponse = {
        content: `处理时出现问题：${e}。请重试或检查 API 配置。`,
      };
    }

    // 3. Save AI response
    const aiMessage = {
      id: `${input.targetPersona}-${Date.now()}`,
      projectId,
      role: (input.targetPersona === "writer" ? "WRITER" : "REVIEWER") as "WRITER" | "REVIEWER",
      content: aiResponse.content,
      phase: undefined as ProjectPhase | undefined,
      decision: undefined as Record<string, unknown> | undefined,
      createdAt: new Date(),
    };

    if (this.prisma.enabled) {
      const project = await this.prisma.project.findUnique({ where: { id: projectId } });
      aiMessage.phase = project?.currentPhase ?? undefined;

      // Determine if this response contains a decision
      if (aiResponse.data && project) {
        aiMessage.decision = { role: input.targetPersona, phase: project.currentPhase, ...aiResponse.data };
      }

      await this.prisma.conversationMessage.create({
        data: {
          projectId,
          role: input.targetPersona === "writer" ? "WRITER" : "REVIEWER",
          content: aiResponse.content,
          phase: aiMessage.phase,
          decision: (aiMessage.decision ?? undefined) as Prisma.InputJsonValue,
        },
      });

      // 4. Process data updates based on phase and role
      if (aiResponse.data) {
        await this.processAiData(projectId, input.targetPersona, project!.currentPhase as ProjectPhase, aiResponse.data);
      }
    }

    return { userMessage, aiMessage };
  }

  private detectPhaseFromMessage(content: string, defaultPhase: ProjectPhase): ProjectPhase {
    const lower = content.toLowerCase();
    if (lower.includes("故事内核") || lower.includes("logline") || lower.includes("梗概")) return "STORY_KERNEL";
    if (lower.includes("世界观") || lower.includes("世界规则") || lower.includes("设定")) return "WORLD_BUILDING";
    if (lower.includes("人物") || lower.includes("角色") || lower.includes("人设") || lower.includes("主角")) return "CHARACTERS";
    if (lower.includes("大纲") || lower.includes("分集") || lower.includes("集数")) return "EPISODE_OUTLINES";
    if (lower.includes("制作要点") || lower.includes("受众") || lower.includes("卖点")) return "PRODUCTION_NOTES";
    if (lower.includes("分集生成") || lower.includes("剧本正文") || lower.includes("第") && lower.includes("集")) return "EPISODE_GENERATION";
    return defaultPhase;
  }

  private async processAiData(
    projectId: string,
    persona: "writer" | "reviewer",
    phase: ProjectPhase,
    data: Record<string, unknown>
  ) {
    if (persona === "writer" && phase !== "EPISODE_GENERATION") {
      // Writer can update plan fields based on phase
      const fieldMap: Record<string, string> = {
        STORY_KERNEL: "storyKernel",
        WORLD_BUILDING: "worldBuilding",
        CHARACTERS: "characters",
        EPISODE_OUTLINES: "episodeOutlines",
        PRODUCTION_NOTES: "productionNotes",
      };

      const fieldName = fieldMap[phase];
      if (!fieldName) return;

      // Check for the expected key, or use entire data object as fallback
      let value = data[fieldName];
      if (!value || (typeof value === "object" && Object.keys(value as object).length === 0)) {
        // Fallback: exclude content-like keys and use the rest
        const clean = { ...data };
        delete clean.content;
        if (Object.keys(clean).length > 0) {
          value = clean;
        }
      }

      if (value && (typeof value !== "object" || Object.keys(value as object).length > 0)) {
        await this.prisma.projectPlan.update({
          where: { projectId },
          data: { [fieldName]: value } as Prisma.ProjectPlanUpdateInput,
        });

        const phaseLabels: Record<string, string> = {
          STORY_KERNEL: "故事内核", WORLD_BUILDING: "世界观构建", CHARACTERS: "人物塑造",
          EPISODE_OUTLINES: "分集大纲", PRODUCTION_NOTES: "制作要点",
        };
        await this.prisma.conversationMessage.create({
          data: {
            projectId,
            role: "SYSTEM",
            content: `规划书已更新：【${phaseLabels[phase] ?? phase}】已写入。可在右侧面板查看。`,
            phase,
          },
        });
      }

      return;
    }

    if (persona === "writer" && phase === "EPISODE_GENERATION") {
      // Extract episode data from either data.episode or data directly
      const ep = (data.episode as Record<string, unknown>) ?? data;
      const epNum = ep.episodeNumber as number | undefined;
      const epContent = ep.content as string | undefined;
      if (epNum && epContent) {
        await this.prisma.projectEpisode.upsert({
          where: { projectId_episodeNumber: { projectId, episodeNumber: epNum } },
          create: {
            projectId,
            episodeNumber: epNum,
            title: (ep.title as string) || `第${epNum}集`,
            content: epContent,
            status: "DRAFT",
            version: 1,
          },
          update: {
            content: epContent,
            status: "DRAFT",
            version: { increment: 1 },
          },
        });
      }
      return;
    }

    if (persona === "reviewer" && phase === "EPISODE_GENERATION") {
      // Reviewer provides scores
      const scores = data.scores as Record<string, number> | undefined;
      const total = data.total as number | undefined;
      const suggestions = data.suggestions as string[] | undefined;
      const locked = data.locked as boolean | undefined;
      const episodeNumber = data.episodeNumber as number | undefined;

      if (scores && total !== undefined && episodeNumber) {
        const episode = await this.prisma.projectEpisode.findUnique({
          where: { projectId_episodeNumber: { projectId, episodeNumber } },
        });
        if (!episode) return;

        const scoreData = {
          episodeId: episode.id,
          conflict: scores.conflict ?? 0,
          logic: scores.logic ?? 0,
          pacing: scores.pacing ?? 0,
          characterConsistency: scores.characterConsistency ?? 0,
          commercialPotential: scores.commercialPotential ?? 0,
          originality: scores.originality ?? 0,
          total,
          suggestions: suggestions ?? [],
        };
        const score = await this.prisma.episodeScore.upsert({
          where: { episodeId: episode.id },
          create: scoreData,
          update: scoreData,
        });

        const newStatus = locked ? "LOCKED" : total >= 70 ? "REVISION" : "IN_REVIEW";

        await this.prisma.projectEpisode.update({
          where: { id: episode.id },
          data: {
            scoreId: score.id,
            status: newStatus,
            version: locked ? episode.version : { increment: 1 },
          },
        });
      }
    }
  }

  async getMessages(projectId: string, limit = 50, before?: string) {
    if (this.prisma.enabled) {
      const where: Record<string, unknown> = { projectId };
      if (before) {
        where.createdAt = { lt: new Date(before) };
      }
      return this.prisma.conversationMessage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      });
    }
    return [];
  }

  // ─── Phase Management ───

  async advanceStep(projectId: string) {
    if (!this.prisma.enabled) {
      return { phase: "WORLD_BUILDING", message: "Demo: advanced to next step" };
    }

    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException("Project not found");

    const currentIndex = PHASE_ORDER.indexOf(project.currentPhase as ProjectPhase);
    if (currentIndex < 0 || currentIndex >= PHASE_ORDER.length - 1) {
      throw new Error("Already at the last planning step");
    }

    const nextPhase = PHASE_ORDER[currentIndex + 1];

    await this.prisma.project.update({
      where: { id: projectId },
      data: { currentPhase: nextPhase },
    });

    const phaseLabels: Record<string, string> = {
      STORY_KERNEL: "故事内核",
      WORLD_BUILDING: "世界观构建",
      CHARACTERS: "人物塑造",
      EPISODE_OUTLINES: "分集大纲",
      PRODUCTION_NOTES: "制作要点",
    };

    await this.prisma.conversationMessage.create({
      data: {
        projectId,
        role: "SYSTEM",
        content: `当前阶段已完成，进入【${phaseLabels[nextPhase]}】阶段。`,
        phase: nextPhase,
        decision: { action: "advance", from: project.currentPhase, to: nextPhase },
      },
    });

    return { phase: nextPhase };
  }

  async lockPlan(projectId: string) {
    if (!this.prisma.enabled) {
      return { locked: true, message: "Demo: plan locked" };
    }

    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException("Project not found");

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: projectId },
        data: {
          status: "EPISODES",
          currentPhase: "EPISODE_GENERATION",
          planLockedAt: now,
        },
      });
      await tx.projectPlan.update({
        where: { projectId },
        data: { lockedAt: now },
      });
      await tx.conversationMessage.create({
        data: {
          projectId,
          role: "SYSTEM",
          content: "规划阶段全部完成，项目宪法已锁定。现在进入分集生成阶段。编剧小Q将按照锁定的大纲逐集创作，审核官负责确保每集达到90分标准。",
          phase: "EPISODE_GENERATION",
          decision: { action: "lock_plan", lockedAt: now.toISOString() },
        },
      });
    });

    return { locked: true };
  }

  async unlockPlan(projectId: string) {
    if (!this.prisma.enabled) return { unlocked: true };

    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException("Project not found");

    await this.prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: projectId },
        data: {
          status: "PLANNING",
          currentPhase: "CHARACTERS",
          planLockedAt: null,
        },
      });
      await tx.projectPlan.update({
        where: { projectId },
        data: { lockedAt: null },
      });
      await tx.conversationMessage.create({
        data: {
          projectId,
          role: "SYSTEM",
          content: "规划书已解锁，可以回到前面的阶段修改。当前停在人物塑造阶段，使用推进按钮继续。",
          phase: "CHARACTERS",
          decision: { action: "unlock_plan" },
        },
      });
    });

    return { unlocked: true };
  }

  async goToPhase(projectId: string, phase: string) {
    if (!this.prisma.enabled) return { phase };

    const validPhases = ["STORY_KERNEL", "WORLD_BUILDING", "CHARACTERS", "EPISODE_OUTLINES", "PRODUCTION_NOTES", "EPISODE_GENERATION"];
    if (!validPhases.includes(phase)) throw new Error("Invalid phase");

    await this.prisma.project.update({
      where: { id: projectId },
      data: { currentPhase: phase as any },
    });

    const phaseLabels: Record<string, string> = {
      STORY_KERNEL: "故事内核", WORLD_BUILDING: "世界观构建", CHARACTERS: "人物塑造",
      EPISODE_OUTLINES: "分集大纲", PRODUCTION_NOTES: "制作要点",
    };

    await this.prisma.conversationMessage.create({
      data: {
        projectId,
        role: "SYSTEM",
        content: `已跳转至【${phaseLabels[phase] ?? phase}】阶段。`,
        phase: phase as any,
        decision: { action: "go_phase", phase },
      },
    });

    return { phase };
  }

  async updatePlan(projectId: string, input: UpdatePlanInput) {
    if (this.prisma.enabled) {
      return this.prisma.projectPlan.update({
        where: { projectId },
        data: input as Prisma.ProjectPlanUpdateInput,
      });
    }
    return input;
  }

  // ─── Episode Management ───

  async getEpisodes(projectId: string) {
    if (this.prisma.enabled) {
      return this.prisma.projectEpisode.findMany({
        where: { projectId },
        orderBy: { episodeNumber: "asc" },
        include: { score: true },
      });
    }
    return [];
  }

  async getEpisode(projectId: string, episodeNumber: number) {
    if (this.prisma.enabled) {
      return this.prisma.projectEpisode.findUnique({
        where: { projectId_episodeNumber: { projectId, episodeNumber } },
        include: { score: true },
      });
    }
    throw new NotFoundException("Episode not found");
  }

  async forceLock(projectId: string, episodeNumber: number) {
    if (!this.prisma.enabled) {
      return { locked: true, message: "Demo: force locked" };
    }

    const episode = await this.prisma.projectEpisode.findUnique({
      where: { projectId_episodeNumber: { projectId, episodeNumber } },
    });
    if (!episode) throw new NotFoundException("Episode not found");

    await this.prisma.$transaction(async (tx) => {
      await tx.projectEpisode.update({
        where: { id: episode.id },
        data: { status: "LOCKED" },
      });
      await tx.conversationMessage.create({
        data: {
          projectId,
          role: "SYSTEM",
          content: `用户手动强制锁定第${episodeNumber}集。`,
          phase: "EPISODE_GENERATION",
          decision: { action: "force_lock", episodeNumber },
        },
      });
    });

    return { locked: true };
  }

  async unlockEpisode(projectId: string, episodeNumber: number) {
    if (!this.prisma.enabled) return { unlocked: true };

    const episode = await this.prisma.projectEpisode.findUnique({
      where: { projectId_episodeNumber: { projectId, episodeNumber } },
    });
    if (!episode) throw new NotFoundException("Episode not found");

    await this.prisma.$transaction(async (tx) => {
      await tx.projectEpisode.update({
        where: { id: episode.id },
        data: { status: "REVISION" },
      });
      await tx.conversationMessage.create({
        data: {
          projectId,
          role: "SYSTEM",
          content: `第${episodeNumber}集已解锁，可重新审查修改。`,
          phase: "EPISODE_GENERATION",
          decision: { action: "unlock_episode", episodeNumber },
        },
      });
    });

    return { unlocked: true };
  }

  // ─── Download & Submit ───

  async generateMarkdown(projectId: string): Promise<{ filename: string; markdown: string }> {
    const project = await this.getProject(projectId);
    const plan = project.plan;
    const episodes = project.episodes ?? [];
    const lockedEpisodes = episodes.filter((e) => e.status === "LOCKED");

    const lines: string[] = [];

    lines.push(`# ${project.name}`);
    if (project.genre) lines.push(`\n**题材**：${project.genre}`);
    lines.push(`\n**状态**：${project.status === "COMPLETED" ? "已完成" : "创作中"}`);
    lines.push(`**分集**：${lockedEpisodes.length} 集已锁定\n`);
    lines.push("---\n");

    // Plan section
    if (plan) {
      const storyKernel = plan.storyKernel as Record<string, unknown> | undefined;
      const worldBuilding = plan.worldBuilding as Record<string, unknown> | undefined;
      const characters = plan.characters as Array<Record<string, unknown>> | undefined;
      const outlines = plan.episodeOutlines as Array<Record<string, unknown>> | undefined;
      const notes = plan.productionNotes as Record<string, unknown> | undefined;

      if (storyKernel && Object.keys(storyKernel).length > 0) {
        lines.push("## 故事内核\n");
        if (storyKernel.logline) lines.push(`**Logline**：${storyKernel.logline}\n`);
        if (storyKernel.theme) lines.push(`**主题**：${storyKernel.theme}\n`);
        if (storyKernel.chosenPath) lines.push(`**创作路径**：${storyKernel.chosenPath}\n`);
        if (storyKernel.externalConflict) lines.push(`**外部冲突**：${storyKernel.externalConflict}`);
        if (storyKernel.internalConflict) lines.push(`**内部冲突**：${storyKernel.internalConflict}`);
        if (storyKernel.relationshipConflict) lines.push(`**关系冲突**：${storyKernel.relationshipConflict}`);
        if (storyKernel.emotionalHook) lines.push(`**情感钩子**：${storyKernel.emotionalHook}\n`);
        lines.push("---\n");
      }

      if (characters && characters.length > 0) {
        lines.push("## 人物\n");
        for (const c of characters) {
          lines.push(`### ${c.name ?? ""} — ${c.role ?? ""}\n`);
          if (c.traits) lines.push(`**特征**：${c.traits}`);
          if (c.surfaceDesire) lines.push(`**表面欲望**：${c.surfaceDesire}`);
          if (c.deepNeed) lines.push(`**真正需求**：${c.deepNeed}`);
          if (c.fear) lines.push(`**软肋/恐惧**：${c.fear}`);
          if (c.arc) lines.push(`**角色弧线**：${c.arc}`);
          if (c.signatureLine) lines.push(`> ${c.signatureLine}\n`);
        }
        lines.push("---\n");
      }

      if (outlines && outlines.length > 0) {
        lines.push("## 分集大纲\n");
        for (const o of outlines) {
          lines.push(`### 第${o.episodeNumber ?? "?"}集：${o.title ?? ""}\n`);
          if (o.coreEvent) lines.push(`**核心事件**：${o.coreEvent}`);
          if (o.hook) lines.push(`**结尾钩子**：${o.hook}\n`);
        }
        lines.push("---\n");
      }
    }

    // Episodes
    if (lockedEpisodes.length > 0) {
      lines.push("## 剧本正文\n");
      for (const ep of lockedEpisodes) {
        lines.push(`### ${ep.title}\n`);
        lines.push(ep.content);
        if (ep.score) {
          lines.push(`\n> 评分：${ep.score.total} | 冲突${ep.score.conflict} 逻辑${ep.score.logic} 节奏${ep.score.pacing} 人物${ep.score.characterConsistency} 商业${ep.score.commercialPotential} 原创${ep.score.originality}\n`);
        }
        lines.push("\n---\n");
      }
    }

    const filename = `${project.name.replace(/[\\/:*?"<>|]/g, "_")}.md`;
    return { filename, markdown: lines.join("\n") };
  }

  async submitToLibrary(projectId: string, authorId: string) {
    const { markdown } = await this.generateMarkdown(projectId);

    if (this.prisma.enabled) {
      const project = await this.prisma.project.findUnique({ where: { id: projectId } });
      if (!project) throw new NotFoundException("Project not found");

      const script = await this.prisma.script.create({
        data: {
          title: project.name,
          genre: project.genre ?? undefined,
          content: markdown,
          wordCount: markdown.length,
          status: "PUBLISHED",
          authorId,
        },
      });

      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: "COMPLETED" },
      });

      await this.prisma.conversationMessage.create({
        data: {
          projectId,
          role: "SYSTEM",
          content: `剧本已提交到剧本库（ID: ${script.id}），项目标记为已完成。`,
          phase: "EPISODE_GENERATION",
          decision: { action: "submit_to_library", scriptId: script.id },
        },
      });

      return { scriptId: script.id, title: script.title };
    }

    return { scriptId: "demo", title: projectId };
  }

  async permanentDelete(projectId: string) {
    if (this.prisma.enabled) {
      await this.prisma.project.delete({ where: { id: projectId } });
    }
    return { deleted: true };
  }
}
