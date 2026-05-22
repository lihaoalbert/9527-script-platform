import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { MemoryService } from "./memory.service";
import { StudioController } from "./studio.controller";
import { StudioService } from "./studio.service";

@Module({
  imports: [AiModule],
  controllers: [StudioController],
  providers: [StudioService, MemoryService],
  exports: [StudioService],
})
export class StudioModule {}
