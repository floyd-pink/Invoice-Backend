import { Controller, Post } from '@nestjs/common';
import { ContactService } from './contact.service';
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}
  @Post()
  provideContact() {
    return this.contactService.provideContact();
  }
}
