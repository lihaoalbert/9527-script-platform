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
  STORY_KERNEL: "storyKernel", WORLD_BUILDING: "worldBuilding",
  CHARACTERS: "characters", EPISODE_OUTLINES: "episodeOutlines", PRODUCTION_NOTES: "productionNotes",
};

const MAX_ATTEMPTS = 5;

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

  async stopAutoMode(projectId: string) {
    const loop = runningLoops.get(projectId);
    if (loop) loop.abort = true;
    runningLoops.delete(projectId);

    if (this.prisma.enabled) {
      await this.prisma.project.update({
        where: { id: projectId }, data: { autoMode: false },
      }).catch(() => {});
      await this.saveSystemMessage(projectId, "EPISODE_GENERATION", "自动模式已手动停止。").catch(() => {});
    }
  }

  async startAutoMode(projectId: string) {
    if (!this.prisma.enabled) return;
    if (runningLoops.has(projectId)) return;

    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error("Project not found");

    await this.prisma.project.update({ where: { id: projectId }, data: { autoMode: true } });

    const state = { abort: false };
    runningLoops.set(projectId, state);

    // Fire and forget with full error recovery
    this.runLoop(projectId, state).catch(async (e) => {
      console.error(`Auto mode crashed for ${projectId}:`, e?.message ?? e);
      await this.prisma.project.update({
        where: { id: projectId }, data: { autoMode: false },
      }).catch(() => {});
      await this.saveSystemMessage(projectId, "EPISODE_GENERATION",
        `自动模式因异常停止：${e?.message ?? "未知错误"}。可重新开启。`).catch(() => {});
      runningLoops.delete(projectId);
    });
  }

  // ─── Main Loop ───

  private async runLoop(projectId: string, state: { abort: boolean }) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project || state.abort) return;

    if (project.status === "PLANNING") {
      await this.runPlanningLoop(projectId, state, project.currentPhase as ProjectPhase);
    } else if (project.status === "EPISODES") {
      await this.runEpisodeLoop(projectId, state);
    }
  }

  private async runPlanningLoop(projectId: string, state: { abort: boolean }, startPhase: ProjectPhase) {
    const phaseIndex = PLANNING_PHASES.indexOf(startPhase);

    for (let i = phaseIndex; i < PLANNING_PHASES.length; i++) {
      if (state.abort) break;

      const phase = PLANNING_PHASES[i];
      const result = await this.iterationLoop(projectId, state, phase, () =>
        this.runWriterTurn(projectId, phase),
        () => this.runReviewerTurn(projectId, phase),
        PHASE_LABELS[phase],
      );

      if (state.abort) break;
      if (result === "max_attempts") {
        await this.pauseWithReason(projectId, state,
          `自动模式暂停：${PHASE_LABELS[phase]}经过${MAX_ATTEMPTS}轮修订仍未达标。请手动介入决策。`);
        return;
      }

      // Advance
      if (i < PLANNING_PHASES.length - 1) {
        const next = PLANNING_PHASES[i + 1];
        await this.prisma.project.update({
          where: { id: projectId }, data: { currentPhase: next },
        }).catch(() => {});
        await this.saveSystemMessage(projectId, next,
          `自动模式：${PHASE_LABELS[phase]}已达标，进入${PHASE_LABELS[next]}。`);
      } else {
        await this.lockPlan(projectId).catch(() => {});
        await this.saveSystemMessage(projectId, "EPISODE_GENERATION",
          "自动模式：规划全部完成，规划书已锁定。开始分集生成。");
        await this.delay(2000);
        if (!state.abort) await this.runEpisodeLoop(projectId, state);
        return;
      }
      await this.delay(2500 + Math.random() * 1000);
    }
  }

  private async runEpisodeLoop(projectId: string, state: { abort: boolean }) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project || state.abort) return;

    const batchSize = project.episodeBatchSize;
    const lockedCount = await this.prisma.projectEpisode.count({
      where: { projectId, status: "LOCKED" },
    });
    const startEp = lockedCount + 1;

    for (let epNum = startEp; epNum < startEp + batchSize; epNum++) {
      if (state.abort) break;

      await this.saveSystemMessage(projectId, "EPISODE_GENERATION",
        `自动模式：开始生成第${epNum}集（目标${project.episodeTargetWords}字）。`);

      const result = await this.iterationLoop(projectId, state, "EPISODE_GENERATION",
        () => this.runWriterEpisodeTurn(projectId, epNum, project.episodeTargetWords),
        () => this.runReviewerEpisodeTurn(projectId, epNum),
        `第${epNum}集`,
      );

      if (state.abort) break;
      if (result === "max_attempts") {
        await this.pauseWithReason(projectId, state,
          `自动模式暂停：第${epNum}集经过${MAX_ATTEMPTS}轮修订仍未达到90分。请手动介入。`);
        return;
      }

      await this.saveSystemMessage(projectId, "EPISODE_GENERATION",
        `自动模式：第${epNum}集已达标锁定。`);
      await this.delay(2000 + Math.random() * 1000);
    }

    if (!state.abort) {
      await this.pauseWithReason(projectId, state,
        `自动模式：本批次${batchSize}集已完成。可重新开启继续生成。`);
    }
  }

  // ─── Generic Writer↔Reviewer Iteration ───

  private async iterationLoop(
    projectId: string,
    state: { abort: boolean },
    phase: ProjectPhase,
    writerFn: () => Promise<void>,
    reviewerFn: () => Promise<number>,
    label: string,
  ): Promise<"passed" | "max_attempts"> {
    let score = 0;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (state.abort) return "max_attempts";

      // Writer turn
      const writerOk = await this.safeCall(`writer-${label}`, async () => { await writerFn(); return true; }, projectId, state);
      if (writerOk === null || state.abort) return "max_attempts";
      await this.delay(2000 + Math.random() * 1000);
      if (state.abort) return "max_attempts";

      // Reviewer turn
      const reviewerResult = await this.safeCall(`reviewer-${label}`, () => reviewerFn(), projectId, state);
      if (reviewerResult === null || state.abort) return "max_attempts";
      score = reviewerResult;
      await this.delay(2000 + Math.random() * 1000);

      if (score >= 90) {
        return "passed";
      }

      if (attempt < MAX_ATTEMPTS) {
        await this.saveSystemMessage(projectId, phase,
          `自动模式：${label}当前${score}分（未达90），第${attempt + 1}轮修订...`);
      }
    }

    return score >= 90 ? "passed" : "max_attempts";
  }

  // ─── Safe Call Wrapper ───

  private async safeCall<T>(
    label: string,
    fn: () => Promise<T>,
    projectId: string,
    state: { abort: boolean },
  ): Promise<T | null> {
    for (let retry = 0; retry < 3; retry++) {
      try {
        return await fn();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`Auto mode [${label}] attempt ${retry + 1} failed:`, msg);
        if (retry < 2) {
          await this.delay(3000 * (retry + 1)); // Exponential backoff
        } else {
          await this.saveSystemMessage(projectId, "EPISODE_GENERATION",
            `自动模式：${label}连续3次调用失败（${msg}）。自动暂停，请手动重试。`);
          await this.prisma.project.update({
            where: { id: projectId }, data: { autoMode: false },
          }).catch(() => {});
          state.abort = true;
          return null;
        }
      }
    }
    return null;
  }

  // ─── Writer Turns ───

  private async runWriterTurn(projectId: string, phase: ProjectPhase) {
    const messages = await this.memoryService.assembleContext(projectId, "writer", phase);
    messages.push({
      role: "user",
      content: `【自动模式】请为【${PHASE_LABELS[phase]}】直接生成方案，输出JSON：{"content":"简介","data":{"${FIELD_MAP[phase] ?? "data"}":{...}}}`,
    });

    const raw = await this.aiService.chatRaw(messages, 0.8, true);
    const parsed = this.parseJson(raw);

    await this.prisma.conversationMessage.create({
      data: {
        projectId, role: "WRITER", content: parsed.content, phase,
        decision: { role: "writer", phase, ...parsed.data } as Prisma.InputJsonValue,
      },
    });

    if (parsed.data) {
      const fieldName = FIELD_MAP[phase];
      if (fieldName) {
        const value = parsed.data[fieldName] ?? parsed.data;
        if (value && typeof value === "object" && Object.keys(value as object).length > 0) {
          await this.prisma.projectPlan.update({
            where: { projectId },
            data: { [fieldName]: value } as Prisma.ProjectPlanUpdateInput,
          });
        }
      }
    }
  }

  private async runWriterEpisodeTurn(projectId: string, epNum: number, targetWords: number) {
    const messages = await this.memoryService.assembleContext(projectId, "writer", "EPISODE_GENERATION");
    messages.push({
      role: "user",
      content: `【自动模式】生成第${epNum}集剧本（目标${targetWords}字），严格遵循项目宪法。输出JSON：{"content":"简介","data":{"episode":{"episodeNumber":${epNum},"title":"第${epNum}集","content":"正文..."}}}`,
    });

    const raw = await this.aiService.chatRaw(messages, 0.8, true);
    const parsed = this.parseJson(raw);

    await this.prisma.conversationMessage.create({
      data: {
        projectId, role: "WRITER", content: parsed.content, phase: "EPISODE_GENERATION",
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
          status: "DRAFT", version: { increment: 1 },
        },
      });
    }
  }

  // ─── Reviewer Turns ───

  private async runReviewerTurn(projectId: string, phase: ProjectPhase): Promise<number> {
    const messages = await this.memoryService.assembleContext(projectId, "reviewer", phase);
    messages.push({
      role: "user",
      content: `【自动模式】审查${PHASE_LABELS[phase]}方案，0-100评分。输出JSON：{"content":"意见","data":{"total":85,"locked":false}}。≥90分必须locked:true。`,
    });

    const raw = await this.aiService.chatRaw(messages, 0.5, true);
    const parsed = this.parseJson(raw);

    await this.prisma.conversationMessage.create({
      data: {
        projectId, role: "REVIEWER", content: parsed.content, phase,
        decision: { role: "reviewer", phase, ...parsed.data } as Prisma.InputJsonValue,
      },
    });

    return this.extractScore(parsed.data);
  }

  private async runReviewerEpisodeTurn(projectId: string, epNum: number): Promise<number> {
    const messages = await this.memoryService.assembleContext(projectId, "reviewer", "EPISODE_GENERATION");
    messages.push({
      role: "user",
      content: `【自动模式】审核第${epNum}集，六维度评分。输出JSON：{"content":"评语","data":{"episodeNumber":${epNum},"scores":{"conflict":85,"logic":80,"pacing":88,"characterConsistency":92,"commercialPotential":90,"originality":87},"total":87,"suggestions":["建议"],"locked":false}}`,
    });

    const raw = await this.aiService.chatRaw(messages, 0.5, true);
    const parsed = this.parseJson(raw);

    await this.prisma.conversationMessage.create({
      data: {
        projectId, role: "REVIEWER", content: parsed.content, phase: "EPISODE_GENERATION",
        decision: { role: "reviewer", phase: "EPISODE_GENERATION", ...parsed.data } as Prisma.InputJsonValue,
      },
    });

    const scores = parsed.data?.scores as Record<string, number> | undefined;
    const total = this.extractScore(parsed.data);
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

    return locked ? 90 : Math.max(total, 0);
  }

  // ─── Helpers ───

  private extractScore(data?: Record<string, unknown>): number {
    if (!data) return 0;
    // Try explicit total field
    if (typeof data.total === "number" && data.total >= 0 && data.total <= 100) {
      return data.total;
    }
    // Try locked flag
    if (data.locked === true) return 90;
    // Try to compute from scores object
    const scores = data.scores as Record<string, number> | undefined;
    if (scores) {
      const values = Object.values(scores).filter((v) => typeof v === "number");
      if (values.length > 0) return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    }
    return 0;
  }

  private parseJson(raw: string): { content: string; data?: Record<string, unknown> } {
    try {
      let jsonStr = raw.trim();
      const m = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (m) jsonStr = m[1].trim();
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

  private async pauseWithReason(projectId: string, state: { abort: boolean }, reason: string) {
    state.abort = true;
    runningLoops.delete(projectId);
    if (this.prisma.enabled) {
      await this.prisma.project.update({
        where: { id: projectId }, data: { autoMode: false },
      }).catch(() => {});
      await this.saveSystemMessage(projectId, "EPISODE_GENERATION", reason);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
