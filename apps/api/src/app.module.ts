import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { CommonModule } from "./common/common.module";
import { JwtAuthGuard } from "./common/jwt.guard";
import { AiModule } from "./modules/ai/ai.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CreditsModule } from "./modules/credits/credits.module";
import { AdminController } from "./modules/admin/admin.controller";
import { ApiKeyService } from "./modules/admin/apikey.service";
import { ScriptsModule } from "./modules/scripts/scripts.module";
import { StudioModule } from "./modules/studio/studio.module";

@Module({
  controllers: [AppController, AdminController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    AuthModule,
    ScriptsModule,
    CreditsModule,
    AiModule,
    StudioModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    ApiKeyService,
  ],
})
export class AppModule {}
