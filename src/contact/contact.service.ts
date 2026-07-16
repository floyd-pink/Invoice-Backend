import { Injectable } from '@nestjs/common';

@Injectable()
export class ContactService {
  constructor() {}

  provideContact() {
    return { message: 'This data is coming safely from the Service!' };
  }
}
