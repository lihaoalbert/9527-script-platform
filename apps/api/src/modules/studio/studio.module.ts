import { Module } from "@nestjs/common";
import { ApiKeyService } from "../admin/apikey.service";
import { AiModule } from "../ai/ai.module";
import { AutoModeService } from "./auto-mode.service";
import { CharacterAgentService } from "./character-agent.service";
import { MemoryService } from "./memory.service";
import { PromptService } from "./prompt.service";
import { StudioController } from "./studio.controller";
import { StudioService } from "./studio.service";

@Module({
  imports: [AiModule],
  controllers: [StudioController],
  providers: [StudioService, MemoryService, PromptService, AutoModeService, ApiKeyService, CharacterAgentService],
  exports: [StudioService, PromptService, AutoModeService, CharacterAgentService],
})
export class StudioModule {}
