import messages from './messages.json';

export class OAuthUnbindWouldPreventLogin extends Error {
  constructor() {
    super(messages.unbindWouldPreventLogin);
    this.name = 'OAuthUnbindWouldPreventLogin';
  }
}
