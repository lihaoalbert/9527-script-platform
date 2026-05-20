import { Injectable } from "@nestjs/common";

@Injectable()
export class AuthService {
  issueDevelopmentToken(userId: string) {
    return {
      accessToken: `dev-token-${userId}`,
      tokenType: "Bearer"
    };
  }
}
