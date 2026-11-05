import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { SkipBusinessContext } from './common/decorators/skip-business-context.decorator';
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @SkipBusinessContext()
  getHello(): string {
    return this.appService.getHello();
  }
}
