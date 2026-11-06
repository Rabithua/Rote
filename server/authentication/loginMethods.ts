import { eq } from 'drizzle-orm';
import { userOAuthBindings, userPasskeys, users } from '../drizzle/schema';
import { readAuthenticationPolicy, type AuthenticationTransaction } from './policy';
import messages from './messages.json';

export type LoginMethodRemoval =
  | { type: 'password' }
  | { type: 'oauth'; provider: string }
  | { type: 'passkey'; id: string };

export interface LoginMethodState {
  hasPassword: boolean;
  oauthProviders: string[];
  passkeyIds: string[];
}

export class LastLoginMethodError extends Error {
  constructor() {
    super(messages.lastLoginMethod);
    this.name = 'LastLoginMethodError';
  }
}

export function hasRemainingLoginMethod(state: LoginMethodState, removal: LoginMethodRemoval) {
  return (
    (state.hasPassword && removal.type !== 'password') ||
    state.oauthProviders.some(
      (provider) => removal.type !== 'oauth' || provider !== removal.provider
    ) ||
    state.passkeyIds.some((id) => removal.type !== 'passkey' || id !== removal.id)
  );
}

// Every credential removal locks the same owner row before inspecting or changing credentials.
export async function lockUserLoginMethods(transaction: AuthenticationTransaction, userId: string) {
  const [user] = await transaction.select().from(users).where(eq(users.id, userId)).for('update');
  if (!user) return null;

  const bindings = await transaction
    .select({ provider: userOAuthBindings.provider })
    .from(userOAuthBindings)
    .where(eq(userOAuthBindings.userid, userId));
  const passkeys = await transaction
    .select({ id: userPasskeys.id })
    .from(userPasskeys)
    .where(eq(userPasskeys.userid, userId));
  const { security } = await readAuthenticationPolicy(transaction);

  return {
    user,
    bindings,
    passkeys,
    methods: {
      hasPassword: Boolean(user.passwordhash && user.salt),
      oauthProviders: bindings
        .filter(
          ({ provider }) =>
            security?.oauth?.enabled && security.oauth.providers?.[provider]?.enabled
        )
        .map(({ provider }) => provider),
      passkeyIds: security?.passkey?.enabled === false ? [] : passkeys.map(({ id }) => id),
    } satisfies LoginMethodState,
  };
}
