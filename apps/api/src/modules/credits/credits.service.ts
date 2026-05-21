import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { demoStore } from "../../common/demo-store";

@Injectable()
export class CreditsService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureDemoAccount(userId: string) {
    const existing = demoStore.creditAccounts.find((account) => account.userId === userId);
    if (existing) {
      return existing;
    }

    const account = { userId, balance: 0 };
    demoStore.creditAccounts.push(account);
    return account;
  }

  balance(userId: string) {
    if (!this.prisma.enabled) {
      return this.ensureDemoAccount(userId);
    }

    return this.prisma.creditAccount.upsert({
      where: { userId },
      update: {},
      create: { userId, balance: 0 }
    });
  }

  adjust(userId: string, amount: number, reason: string) {
    if (!this.prisma.enabled) {
      const account = this.ensureDemoAccount(userId);
      account.balance += amount;
      demoStore.creditTransactions.push({
        id: demoStore.makeId(),
        userId,
        amount,
        reason,
        createdAt: new Date()
      });
      return account;
    }

    return this.prisma.$transaction(async (tx) => {
      const account = await tx.creditAccount.upsert({
        where: { userId },
        update: { balance: { increment: amount } },
        create: { userId, balance: amount }
      });

      await tx.creditTransaction.create({
        data: { userId, amount, reason }
      });

      return account;
    });
  }
}
