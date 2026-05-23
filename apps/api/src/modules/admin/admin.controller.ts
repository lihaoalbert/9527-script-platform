import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { CurrentUser } from "../../common/auth.decorator";
import { ApiKeyService } from "./apikey.service";

type JwtUser = { sub: string; email: string; name: string; role: string };

@Controller("admin")
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  @Get("users")
  async listUsers() {
    if (!this.prisma.enabled) return [];
    return this.prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  }

  @Patch("users/:id/role")
  async updateUserRole(
    @Param("id") id: string,
    @Body() body: { role: string },
    @CurrentUser() admin: JwtUser,
  ) {
    if (admin.role !== "SUPER_ADMIN" && admin.role !== "ADMIN") {
      throw new Error("Only admins can change user roles");
    }
    if (!this.prisma.enabled) return { id, role: body.role };
    return this.prisma.user.update({
      where: { id },
      data: { role: body.role as any },
      select: { id: true, email: true, name: true, role: true },
    });
  }

  // ─── API Key Management ───

  @Get("apikeys")
  listApiKeys() {
    return this.apiKeyService.list();
  }

  @Post("apikeys")
  createApiKey(@Body() body: { name: string; provider: string; apiKey: string; model: string; persona: string }) {
    return this.apiKeyService.create(body);
  }

  @Patch("apikeys/:id")
  updateApiKey(@Param("id") id: string, @Body() body: any) {
    return this.apiKeyService.update(id, body);
  }

  @Delete("apikeys/:id")
  deleteApiKey(@Param("id") id: string) {
    return this.apiKeyService.remove(id);
  }
}
