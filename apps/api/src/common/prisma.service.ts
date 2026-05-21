import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  readonly enabled = Boolean(process.env.DATABASE_URL);

  async onModuleInit() {
    if (!this.enabled) {
      return;
    }

    await this.$connect();
  }

  async onModuleDestroy() {
    if (!this.enabled) {
      return;
    }

    await this.$disconnect();
  }
}
