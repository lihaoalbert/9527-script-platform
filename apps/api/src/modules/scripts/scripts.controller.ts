import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ScriptsService } from "./scripts.service";

@Controller("scripts")
export class ScriptsController {
  constructor(private readonly scriptsService: ScriptsService) {}

  @Get()
  list(@Query("q") q?: string, @Query("status") status?: string) {
    return this.scriptsService.list({ q, status });
  }

  @Get(":id/preview")
  preview(@Param("id") id: string) {
    return this.scriptsService.preview(id);
  }

  @Post()
  create(@Body() body: { title: string; content: string; genre?: string; authorId: string }) {
    return this.scriptsService.create(body);
  }

  @Post(":id/lock")
  lock(@Param("id") id: string, @Body() body: { userId: string }) {
    return this.scriptsService.lockForExclusiveUse(id, body.userId);
  }
}
