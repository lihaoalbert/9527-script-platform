import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";

type ScriptListQuery = {
  q?: string;
  status?: string;
};

@Injectable()
export class ScriptsService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: ScriptListQuery) {
    return this.prisma.script.findMany({
      where: {
        status: query.status,
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
    return this.prisma.script.create({
      data: {
        title: input.title,
        content: input.content,
        genre: input.genre,
        authorId: input.authorId,
        wordCount: input.content.length,
        status: "DRAFT"
      }
    });
  }

  async lockForExclusiveUse(scriptId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const script = await tx.script.findUnique({ where: { id: scriptId } });

      if (!script) {
        throw new NotFoundException("剧本不存在");
      }

      if (script.status === "LOCKED" || script.status === "IN_USE") {
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
          status: "LOCKED",
          lockedById: userId,
          lockedAt: new Date()
        }
      });
    });
  }
}
