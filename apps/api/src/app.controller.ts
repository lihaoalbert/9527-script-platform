import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  @Get()
  status() {
    return {
      name: "9527-script-platform-api",
      status: "ok",
      mode: process.env.DATABASE_URL ? "database" : "demo-memory"
    };
  }
}
