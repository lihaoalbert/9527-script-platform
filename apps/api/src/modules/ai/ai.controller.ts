import { Body, Controller, Post } from "@nestjs/common";
import { AiService } from "./ai.service";

@Controller("ai")
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post("outline")
  outline(@Body() body: { genre: string; premise: string }) {
    return this.aiService.createOutline(body);
  }

  @Post("generate-script")
  generateScript(
    @Body()
    body: {
      genre: string;
      premise: string;
      targetWords?: number;
      episodes?: number;
      tone?: string;
      protagonist?: string;
    }
  ) {
    return this.aiService.generateScript(body);
  }

  @Post("score")
  score(@Body() body: { scriptId?: string; content: string }) {
    return this.aiService.scoreScript(body.content);
  }

  @Post("review")
  review(@Body() body: { content: string; question?: string }) {
    return this.aiService.reviewScript(body.content, body.question);
  }
}