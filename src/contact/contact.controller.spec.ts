import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';

describe('ContactController', () => {
  it('returns the contact service response', () => {
    const response = { message: 'Contact information' };
    const provideContact = jest.fn().mockReturnValue(response);
    const controller = new ContactController({
      provideContact,
    } as unknown as ContactService);
    expect(controller.provideContact()).toEqual(response);
    expect(provideContact).toHaveBeenCalledTimes(1);
  });
});
