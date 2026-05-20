import { Body, Controller, Post } from "@nestjs/common";
import { AiService } from "./ai.service";

@Controller("ai")
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post("outline")
  outline(@Body() body: { genre: string; premise: string }) {
    return this.aiService.createOutline(body);
  }

  @Post("score")
  score(@Body() body: { scriptId?: string; content: string }) {
    return this.aiService.scoreScript(body.content);
  }
}
