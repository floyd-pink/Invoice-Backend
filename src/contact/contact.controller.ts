import { Controller, Post } from '@nestjs/common';
import { ContactService } from './contact.service';
import { SkipBusinessContext } from 'src/common/decorators/skip-business-context.decorator';
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}
  @Post()
  @SkipBusinessContext()
  provideContact() {
    return this.contactService.provideContact();
  }
}
