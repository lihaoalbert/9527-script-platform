import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AiModule } from "./modules/ai/ai.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CreditsModule } from "./modules/credits/credits.module";
import { ScriptsModule } from "./modules/scripts/scripts.module";
import { PrismaService } from "./common/prisma.service";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    ScriptsModule,
    CreditsModule,
    AiModule
  ],
  providers: [PrismaService]
})
export class AppModule {}
