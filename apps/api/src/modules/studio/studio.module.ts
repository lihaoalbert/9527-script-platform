import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AutoModeService } from "./auto-mode.service";
import { MemoryService } from "./memory.service";
import { PromptService } from "./prompt.service";
import { StudioController } from "./studio.controller";
import { StudioService } from "./studio.service";

@Module({
  imports: [AiModule],
  controllers: [StudioController],
  providers: [StudioService, MemoryService, PromptService, AutoModeService],
  exports: [StudioService, PromptService, AutoModeService],
})
export class StudioModule {}
