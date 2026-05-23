import { SetMetadata, createParamDecorator, ExecutionContext } from "@nestjs/common";
import { IS_PUBLIC_KEY } from "./jwt.guard";

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as { sub: string; email: string; name: string; role: string };
  },
);
