import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ScriptStatus } from "@prisma/client";
import { demoStore } from "../../common/demo-store";
import { PrismaService } from "../../common/prisma.service";

type ScriptListQuery = {
  q?: string;
  status?: string;
};

@Injectable()
export class ScriptsService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: ScriptListQuery) {
    const status =
      query.status && Object.values(ScriptStatus).includes(query.status as ScriptStatus)
        ? (query.status as ScriptStatus)
        : undefined;

    if (!this.prisma.enabled) {
      return demoStore.scripts
        .filter((script) => {
          if (status && script.status !== status) {
            return false;
          }

          if (!query.q) {
            return true;
          }

          return [script.title, script.genre ?? ""].some((value) =>
            value.toLowerCase().includes(query.q!.toLowerCase())
          );
        })
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .map((script) => ({
          id: script.id,
          title: script.title,
          genre: script.genre,
          status: script.status,
          wordCount: script.wordCount,
          aiScore: script.aiScore,
          createdAt: script.createdAt,
          updatedAt: script.updatedAt
        }));
    }

    return this.prisma.script.findMany({
      where: {
        status,
        OR: query.q
          ? [
              { title: { contains: query.q, mode: "insensitive" } },
              { genre: { contains: query.q, mode: "insensitive" } }
            ]
          : undefined
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        genre: true,
        status: true,
        wordCount: true,
        aiScore: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  async preview(id: string) {
    if (!this.prisma.enabled) {
      const script = demoStore.scripts.find((item) => item.id === id);

      if (!script) {
        throw new NotFoundException("剧本不存在");
      }

      const previewLength = Math.min(1000, Math.ceil(script.content.length * 0.1));
      return {
        id: script.id,
        title: script.title,
        preview: script.content.slice(0, previewLength),
        previewLength
      };
    }

    const script = await this.prisma.script.findUnique({
      where: { id },
      select: { id: true, title: true, content: true, wordCount: true }
    });

    if (!script) {
      throw new NotFoundException("剧本不存在");
    }

    const previewLength = Math.min(1000, Math.ceil(script.content.length * 0.1));
    return {
      id: script.id,
      title: script.title,
      preview: script.content.slice(0, previewLength),
      previewLength
    };
  }

  create(input: { title: string; content: string; genre?: string; authorId: string }) {
    if (!this.prisma.enabled) {
      const script = {
        id: demoStore.makeId(),
        title: input.title,
        content: input.content,
        genre: input.genre,
        authorId: input.authorId,
        wordCount: input.content.length,
        status: ScriptStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      demoStore.scripts.unshift(script);
      return script;
    }

    return this.prisma.script.create({
      data: {
        title: input.title,
        content: input.content,
        genre: input.genre,
        authorId: input.authorId,
        wordCount: input.content.length,
        status: ScriptStatus.DRAFT
      }
    });
  }

  async lockForExclusiveUse(scriptId: string, userId: string) {
    if (!this.prisma.enabled) {
      const script = demoStore.scripts.find((item) => item.id === scriptId);

      if (!script) {
        throw new NotFoundException("剧本不存在");
      }

      if (script.status === ScriptStatus.LOCKED || script.status === ScriptStatus.IN_USE) {
        throw new BadRequestException("剧本已被其他用户锁定或使用");
      }

      const account = demoStore.creditAccounts.find((item) => item.userId === userId);
      const cost = 100;

      if (!account || account.balance < cost) {
        throw new BadRequestException("积分不足");
      }

      account.balance -= cost;
      demoStore.creditTransactions.push({
        id: demoStore.makeId(),
        userId,
        amount: -cost,
        reason: "LOCK_SCRIPT",
        referenceId: scriptId,
        createdAt: new Date()
      });

      demoStore.scriptLocks.push({
        id: demoStore.makeId(),
        scriptId,
        userId,
        status: "ACTIVE",
        createdAt: new Date()
      });

      script.status = ScriptStatus.LOCKED;
      script.lockedById = userId;
      script.lockedAt = new Date();
      script.updatedAt = new Date();
      return script;
    }

    return this.prisma.$transaction(async (tx) => {
      const script = await tx.script.findUnique({ where: { id: scriptId } });

      if (!script) {
        throw new NotFoundException("剧本不存在");
      }

      if (script.status === ScriptStatus.LOCKED || script.status === ScriptStatus.IN_USE) {
        throw new BadRequestException("剧本已被其他用户锁定或使用");
      }

      const account = await tx.creditAccount.findUnique({ where: { userId } });
      const cost = 100;

      if (!account || account.balance < cost) {
        throw new BadRequestException("积分不足");
      }

      await tx.creditAccount.update({
        where: { userId },
        data: { balance: { decrement: cost } }
      });

      await tx.creditTransaction.create({
        data: {
          userId,
          amount: -cost,
          reason: "LOCK_SCRIPT",
          referenceId: scriptId
        }
      });

      await tx.scriptLock.create({
        data: {
          scriptId,
          userId,
          status: "ACTIVE"
        }
      });

      return tx.script.update({
        where: { id: scriptId },
        data: {
          status: ScriptStatus.LOCKED,
          lockedById: userId,
          lockedAt: new Date()
        }
      });
    });
  }
}
