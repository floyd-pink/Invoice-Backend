import { JwtService } from '@nestjs/jwt';
import { Injectable } from '@nestjs/common';
import {
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly JwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Session Expired or Invalid Token,Please login Again ',
      );
    }
    const token = authHeader.split(' ')[1];
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const payload = await this.JwtService.verifyAsync(token, {
        secret: 'Hahsh-jaewuhjhda[jdas', // 🔒 FORCE THE EXACT SAME STRING
      });

      (request as any).user = payload;
      return true;
    } catch (error) {
      console.log('--- ACTUAL CRYPTOGRAPHIC ERROR BELOW ---');
      console.error(error);
      console.log('----------------------------------------');

      throw new UnauthorizedException('Invalid Token'); // 👈 This keeps TypeScript happy!
    }
  }
}
