import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../../common/prisma.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async login(email: string, password: string) {
    if (!this.prisma.enabled) return this.devLogin(email);

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException("用户不存在");

    // Plain text comparison for MVP — hash properly in production
    if (user.passwordHash !== password) throw new UnauthorizedException("密码错误");

    return this.signToken(user.id, user.email, user.name, user.role);
  }

  async register(email: string, password: string, name: string) {
    if (!this.prisma.enabled) {
      return this.signToken("demo-user-1", email, name, "CREATOR");
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new UnauthorizedException("邮箱已被注册");

    const user = await this.prisma.user.create({
      data: { email, passwordHash: password, name, role: "CREATOR" },
    });

    return this.signToken(user.id, user.email, user.name, user.role);
  }

  private signToken(userId: string, email: string, name: string, role: string) {
    const payload = { sub: userId, email, name, role };
    return {
      accessToken: this.jwt.sign(payload),
      user: { id: userId, email, name, role },
    };
  }

  private devLogin(email: string) {
    return this.signToken("demo-user-1", email, "演示用户", "CREATOR");
  }
}
