import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";

@Controller("admin")
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("users")
  async listUsers() {
    if (!this.prisma.enabled) return [];
    return this.prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  }
}
