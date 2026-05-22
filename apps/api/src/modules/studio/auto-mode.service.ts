import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { AiService } from "../ai/ai.service";
import { MemoryService } from "./memory.service";

type ProjectPhase = "STORY_KERNEL" | "WORLD_BUILDING" | "CHARACTERS" | "EPISODE_OUTLINES" | "PRODUCTION_NOTES" | "EPISODE_GENERATION";

const PLANNING_PHASES: ProjectPhase[] = [
  "STORY_KERNEL", "WORLD_BUILDING", "CHARACTERS", "EPISODE_OUTLINES", "PRODUCTION_NOTES",
];

const PHASE_LABELS: Record<string, string> = {
  STORY_KERNEL: "故事内核", WORLD_BUILDING: "世界观构建", CHARACTERS: "人物塑造",
  EPISODE_OUTLINES: "分集大纲", PRODUCTION_NOTES: "制作要点", EPISODE_GENERATION: "分集生成",
};

const FIELD_MAP: Record<string, string> = {
  STORY_KERNEL: "storyKernel",
  WORLD_BUILDING: "worldBuilding",
  CHARACTERS: "characters",
  EPISODE_OUTLINES: "episodeOutlines",
  PRODUCTION_NOTES: "productionNotes",
};

// Track running auto-mode loops: projectId -> { abort: boolean }
const runningLoops = new Map<string, { abort: boolean }>();

@Injectable()
export class AutoModeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly memoryService: MemoryService,
  ) {}

  isRunning(projectId: string): boolean {
    return runningLoops.has(projectId);
  }

  stopAutoMode(projectId: string) {
    const loop = runningLoops.get(projectId);
    if (loop) {
      loop.abort = true;
      runningLoops.delete(projectId);
    }
  }

  async startAutoMode(projectId: string) {
    if (!this.prisma.enabled) return;
    if (runningLoops.has(projectId)) return;

    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error("Project not found");

    // Set auto mode
    await this.prisma.project.update({ where: { id: projectId }, data: { autoMode: true } });

    const state = { abort: false };
    runningLoops.set(projectId, state);

    // Run in background
    this.runLoop(projectId, state).catch((e) => {
      console.error(`Auto mode error for project ${projectId}:`, e);
      runningLoops.delete(projectId);
    });
  }

  private async runLoop(projectId: string, state: { abort: boolean }) {
    let project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return;

    const phase = project.currentPhase as ProjectPhase;
    const isPlanning = project.status === "PLANNING";

    if (isPlanning) {
      await this.runPlanningLoop(projectId, state, phase);
    } else {
      await this.runEpisodeLoop(projectId, state);
    }
  }

  private async runPlanningLoop(projectId: string, state: { abort: boolean }, startPhase: ProjectPhase) {
    const phaseIndex = PLANNING_PHASES.indexOf(startPhase);

    for (let i = phaseIndex; i < PLANNING_PHASES.length; i++) {
      if (state.abort) break;

      const phase = PLANNING_PHASES[i];
      let score = 0;
      let attempt = 0;

      // Writer → Reviewer loop until score ≥ 90 or abort
      while (score < 90 && !state.abort && attempt < 5) {
        attempt++;

        // 1. Writer generates proposal
        await this.runWriterTurn(projectId, phase, attempt);
        if (state.abort) break;
        await this.delay(2000);

        // 2. Reviewer scores
        score = await this.runReviewerTurn(projectId, phase);
        if (state.abort) break;
        await this.delay(2000);
      }

      if (state.abort) break;

      // Advance to next phase
      if (i < PLANNING_PHASES.length - 1) {
        const nextPhase = PLANNING_PHASES[i + 1];
        await this.prisma.project.update({
          where: { id: projectId },
          data: { currentPhase: nextPhase },
        });
        await this.saveSystemMessage(projectId, nextPhase,
          `自动模式：${PHASE_LABELS[phase]}已通过（${score}分），进入${PHASE_LABELS[nextPhase]}。`);
      } else {
        // Lock plan
        await this.lockPlan(projectId);
        await this.saveSystemMessage(projectId, "EPISODE_GENERATION",
          "自动模式：规划阶段全部完成，规划书已锁定。开始分集生成。");
        await this.delay(2000);
        // Start episode loop
        await this.runEpisodeLoop(projectId, state);
        return;
      }

      await this.delay(3000);
    }
  }

  private async runEpisodeLoop(projectId: string, state: { abort: boolean }) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return;

    const batchSize = project.episodeBatchSize;
    const lockedEpisodes = await this.prisma.projectEpisode.count({
      where: { projectId, status: "LOCKED" },
    });
    const nextEpNum = lockedEpisodes + 1;

    for (let epNum = nextEpNum; epNum < nextEpNum + batchSize; epNum++) {
      if (state.abort) break;

      let score = 0;
      let attempt = 0;

      while (score < 90 && !state.abort && attempt < 5) {
        attempt++;

        // Writer generates episode
        await this.runWriterEpisodeTurn(projectId, epNum, project.episodeTargetWords, attempt);
        if (state.abort) break;
        await this.delay(3000);

        // Reviewer scores
        score = await this.runReviewerEpisodeTurn(projectId, epNum);
        if (state.abort) break;
        await this.delay(2000);
      }

      if (state.abort) break;

      await this.saveSystemMessage(projectId, "EPISODE_GENERATION",
        `自动模式：第${epNum}集已通过（${score}分），已锁定。`);
      await this.delay(2000);
    }

    // Pause auto mode after batch
    if (!state.abort) {
      await this.prisma.project.update({ where: { id: projectId }, data: { autoMode: false } });
      await this.saveSystemMessage(projectId, "EPISODE_GENERATION",
        `自动模式：已完成本批次${batchSize}集，暂停。可手动继续或重新开启自动模式。`);
    }

    runningLoops.delete(projectId);
  }

  // ─── Writer Turn ───

  private async runWriterTurn(projectId: string, phase: ProjectPhase, attempt: number) {
    const messages = await this.memoryService.assembleContext(projectId, "writer", phase);
    const instruction = attempt === 1
      ? `【自动模式】请直接为【${PHASE_LABELS[phase]}】阶段生成方案，不需要提问。输出结构化JSON到data。`
      : `【自动模式-修订第${attempt}次】审核官提出了修改意见，请根据意见修改方案并重新输出。`;

    messages.push({ role: "user", content: instruction });

    const raw = await this.aiService.chatRaw(messages, 0.8, true);
    const parsed = this.parseJson(raw);

    await this.prisma.conversationMessage.create({
      data: {
        projectId, role: "WRITER", content: parsed.content,
        phase, decision: { role: "writer", phase, ...parsed.data } as Prisma.InputJsonValue,
      },
    });

    // Save plan data
    if (parsed.data) {
      const fieldName = FIELD_MAP[phase];
      const value = parsed.data[fieldName] ?? parsed.data;
      if (value && typeof value === "object" && Object.keys(value).length > 0) {
        await this.prisma.projectPlan.update({
          where: { projectId },
          data: { [fieldName]: value } as Prisma.ProjectPlanUpdateInput,
        });
      }
    }
  }

  private async runWriterEpisodeTurn(projectId: string, epNum: number, targetWords: number, attempt: number) {
    const messages = await this.memoryService.assembleContext(projectId, "writer", "EPISODE_GENERATION");
    const instruction = attempt === 1
      ? `【自动模式】请生成第${epNum}集完整剧本（目标${targetWords}字）。严格遵循项目宪法。输出JSON：{"content":"简介","data":{"episode":{"episodeNumber":${epNum},"title":"第${epNum}集","content":"正文..."}}}`
      : `【自动模式-修订第${attempt}次】审核官对第${epNum}集提出修改意见，请据此修订。`;

    messages.push({ role: "user", content: instruction });

    const raw = await this.aiService.chatRaw(messages, 0.8, true);
    const parsed = this.parseJson(raw);

    await this.prisma.conversationMessage.create({
      data: {
        projectId, role: "WRITER", content: parsed.content,
        phase: "EPISODE_GENERATION",
        decision: { role: "writer", phase: "EPISODE_GENERATION", episodeNumber: epNum, ...parsed.data } as Prisma.InputJsonValue,
      },
    });

    const ep = parsed.data?.episode as Record<string, unknown> | undefined;
    if (ep?.content) {
      await this.prisma.projectEpisode.upsert({
        where: { projectId_episodeNumber: { projectId, episodeNumber: epNum } },
        create: {
          projectId, episodeNumber: epNum,
          title: (ep.title as string) || `第${epNum}集`,
          content: ep.content as string,
          status: "DRAFT", version: 1,
        },
        update: {
          content: ep.content as string,
          status: "DRAFT",
          version: { increment: 1 },
        },
      });
    }
  }

  // ─── Reviewer Turn ───

  private async runReviewerTurn(projectId: string, phase: ProjectPhase): Promise<number> {
    const messages = await this.memoryService.assembleContext(projectId, "reviewer", phase);
    messages.push({ role: "user", content: "【自动模式】请审查当前阶段的方案，用0-100评分并给出修改意见。如果≥90分给出locked:true。" });

    const raw = await this.aiService.chatRaw(messages, 0.5, true);
    const parsed = this.parseJson(raw);

    await this.prisma.conversationMessage.create({
      data: {
        projectId, role: "REVIEWER", content: parsed.content,
        phase, decision: { role: "reviewer", phase, ...parsed.data } as Prisma.InputJsonValue,
      },
    });

    return (parsed.data?.total as number) ?? (parsed.data?.locked ? 90 : 70);
  }

  private async runReviewerEpisodeTurn(projectId: string, epNum: number): Promise<number> {
    const messages = await this.memoryService.assembleContext(projectId, "reviewer", "EPISODE_GENERATION");
    messages.push({ role: "user", content: `【自动模式】请审核第${epNum}集剧本，六维度评分。≥90锁定。输出JSON。` });

    const raw = await this.aiService.chatRaw(messages, 0.5, true);
    const parsed = this.parseJson(raw);

    await this.prisma.conversationMessage.create({
      data: {
        projectId, role: "REVIEWER", content: parsed.content,
        phase: "EPISODE_GENERATION",
        decision: { role: "reviewer", phase: "EPISODE_GENERATION", ...parsed.data } as Prisma.InputJsonValue,
      },
    });

    // Process score
    const scores = parsed.data?.scores as Record<string, number> | undefined;
    const total = (parsed.data?.total as number) ?? 0;
    const locked = parsed.data?.locked === true;

    if (scores && total > 0) {
      const episode = await this.prisma.projectEpisode.findUnique({
        where: { projectId_episodeNumber: { projectId, episodeNumber: epNum } },
      });
      if (episode) {
        const scoreRecord = await this.prisma.episodeScore.create({
          data: {
            episodeId: episode.id,
            conflict: scores.conflict ?? 0, logic: scores.logic ?? 0,
            pacing: scores.pacing ?? 0, characterConsistency: scores.characterConsistency ?? 0,
            commercialPotential: scores.commercialPotential ?? 0, originality: scores.originality ?? 0,
            total, suggestions: (parsed.data?.suggestions as string[]) ?? [],
          },
        });
        await this.prisma.projectEpisode.update({
          where: { id: episode.id },
          data: {
            scoreId: scoreRecord.id,
            status: locked ? "LOCKED" : total >= 70 ? "REVISION" : "IN_REVIEW",
            version: locked ? episode.version : { increment: 1 },
          },
        });
      }
    }

    return locked ? 90 : total;
  }

  // ─── Helpers ───

  private parseJson(raw: string): { content: string; data?: Record<string, unknown> } {
    try {
      let jsonStr = raw.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonStr = jsonMatch[1].trim();
      return JSON.parse(jsonStr);
    } catch {
      return { content: raw };
    }
  }

  private async saveSystemMessage(projectId: string, phase: ProjectPhase, content: string) {
    await this.prisma.conversationMessage.create({
      data: { projectId, role: "SYSTEM", content, phase },
    });
  }

  private async lockPlan(projectId: string) {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: projectId },
        data: { status: "EPISODES", currentPhase: "EPISODE_GENERATION", planLockedAt: now },
      });
      await tx.projectPlan.update({ where: { projectId }, data: { lockedAt: now } });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
