import { Module, Global } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { AuthModule } from 'src/auth/auth.module';

export { JwtAuthGuard } from './jwt-auth.guard';
export { RolesGuard } from './roles.guard';

@Global()
@Module({
  imports: [AuthModule],
  providers: [JwtAuthGuard, RolesGuard],
  exports: [JwtAuthGuard, RolesGuard],
})
export class GuardsModule {}
