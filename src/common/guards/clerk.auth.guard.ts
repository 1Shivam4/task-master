import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyToken } from '@clerk/backend';

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('No token provided');
    }

    const token = authHeader.replace('Bearer ', '');

    try {
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });

      request.user = payload; // attach user info
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private role: string) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    return request.user?.publicMetadata?.role === this.role;
  }
}
