import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";

@Injectable()
export class CreditsService {
  constructor(private readonly prisma: PrismaService) {}

  balance(userId: string) {
    return this.prisma.creditAccount.upsert({
      where: { userId },
      update: {},
      create: { userId, balance: 0 }
    });
  }

  adjust(userId: string, amount: number, reason: string) {
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
