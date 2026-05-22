import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { AutoModeService } from "./auto-mode.service";
import { PromptService } from "./prompt.service";
import { StudioService } from "./studio.service";

@Controller("studio")
export class StudioController {
  constructor(
    private readonly studioService: StudioService,
    private readonly promptService: PromptService,
    private readonly autoModeService: AutoModeService,
  ) {}

  @Post("projects")
  createProject(@Body() body: { name: string; genre?: string; ownerId: string }) {
    return this.studioService.createProject(body);
  }

  @Get("projects")
  listProjects(@Query("ownerId") ownerId?: string, @Query("status") status?: string) {
    return this.studioService.listProjects(ownerId, status);
  }

  @Get("projects/:id")
  getProject(@Param("id") id: string) {
    return this.studioService.getProject(id);
  }

  @Patch("projects/:id")
  updateProject(@Param("id") id: string, @Body() body: { name?: string; genre?: string }) {
    return this.studioService.updateProject(id, body);
  }

  @Delete("projects/:id")
  archiveProject(@Param("id") id: string) {
    return this.studioService.archiveProject(id);
  }

  @Post("projects/:id/chat")
  sendMessage(
    @Param("id") id: string,
    @Body() body: { content: string; targetPersona: "writer" | "reviewer" }
  ) {
    return this.studioService.sendMessage(id, body);
  }

  @Get("projects/:id/messages")
  getMessages(
    @Param("id") id: string,
    @Query("limit") limit?: string,
    @Query("before") before?: string
  ) {
    return this.studioService.getMessages(id, limit ? Number(limit) : 50, before);
  }

  @Post("projects/:id/advance")
  advanceStep(@Param("id") id: string) {
    return this.studioService.advanceStep(id);
  }

  @Post("projects/:id/lock-plan")
  lockPlan(@Param("id") id: string) {
    return this.studioService.lockPlan(id);
  }

  @Patch("projects/:id/plan")
  updatePlan(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.studioService.updatePlan(id, body);
  }

  @Get("projects/:id/episodes")
  getEpisodes(@Param("id") id: string) {
    return this.studioService.getEpisodes(id);
  }

  @Get("projects/:id/episodes/:epNum")
  getEpisode(@Param("id") id: string, @Param("epNum") epNum: string) {
    return this.studioService.getEpisode(id, Number(epNum));
  }

  @Post("projects/:id/episodes/:epNum/force-lock")
  forceLock(@Param("id") id: string, @Param("epNum") epNum: string) {
    return this.studioService.forceLock(id, Number(epNum));
  }

  @Get("prompts")
  listPrompts() {
    return this.promptService.listPrompts();
  }

  @Patch("prompts/:key")
  updatePrompt(
    @Param("key") key: string,
    @Body() body: { template: string; enabled: boolean }
  ) {
    return this.promptService.updatePrompt(key, body.template, body.enabled);
  }

  @Delete("prompts/:key")
  resetPrompt(@Param("key") key: string) {
    return this.promptService.resetPrompt(key);
  }

  @Post("projects/:id/auto-mode/start")
  startAutoMode(@Param("id") id: string) {
    void this.autoModeService.startAutoMode(id);
    return { started: true, projectId: id };
  }

  @Post("projects/:id/auto-mode/stop")
  stopAutoMode(@Param("id") id: string) {
    this.autoModeService.stopAutoMode(id);
    return { stopped: true, projectId: id };
  }

  @Get("projects/:id/auto-mode/status")
  autoModeStatus(@Param("id") id: string) {
    return { running: this.autoModeService.isRunning(id), projectId: id };
  }
}
