import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";

export type ApiKeyRow = {
  id: string; name: string; provider: string; apiKey: string; model: string;
  persona: string; isActive: boolean;
};

@Injectable()
export class ApiKeyService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<ApiKeyRow[]> {
    if (!this.prisma.enabled) return [];
    return this.prisma.apiKey.findMany({ orderBy: { createdAt: "desc" } });
  }

  async create(data: { name: string; provider: string; apiKey: string; model: string; persona: string }) {
    if (!this.prisma.enabled) return {} as ApiKeyRow;
    return this.prisma.apiKey.create({ data: { ...data, isActive: true } });
  }

  async update(id: string, data: Partial<{ name: string; apiKey: string; model: string; persona: string; isActive: boolean }>) {
    if (!this.prisma.enabled) return {} as ApiKeyRow;
    return this.prisma.apiKey.update({ where: { id }, data });
  }

  async remove(id: string) {
    if (!this.prisma.enabled) return { deleted: true };
    await this.prisma.apiKey.delete({ where: { id } });
    return { deleted: true };
  }

  async getForPersona(persona: "writer" | "reviewer"): Promise<{ apiKey: string; model: string } | null> {
    if (!this.prisma.enabled) return null;

    const keys = await this.prisma.apiKey.findMany({
      where: { isActive: true, persona: { in: [persona, "both"] } },
      orderBy: { updatedAt: "desc" },
    });
    if (keys.length === 0) return null;
    return { apiKey: keys[0].apiKey, model: keys[0].model };
  }
}
