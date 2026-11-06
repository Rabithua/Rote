import { and, count, eq } from 'drizzle-orm';
import { userPasskeys } from '../../drizzle/schema';
import {
  hasRemainingLoginMethod,
  LastLoginMethodError,
  lockUserLoginMethods,
} from '../../authentication/loginMethods';
import db from '../drizzle';
import { DatabaseError } from './common';

export async function createUserPasskey(data: {
  userid: string;
  credentialId: string;
  publicKey: Buffer;
  counter: number;
  transports?: string[];
  deviceName?: string;
}) {
  try {
    const [passkey] = await db
      .insert(userPasskeys)
      .values({
        userid: data.userid,
        credentialId: data.credentialId,
        publicKey: data.publicKey,
        counter: data.counter,
        transports: data.transports || [],
        deviceName: data.deviceName || '',
      })
      .returning();
    return passkey;
  } catch (error: any) {
    throw new DatabaseError(`Failed to create passkey: ${error.message}`, error);
  }
}

export async function getUserPasskeys(userId: string) {
  try {
    return await db
      .select({
        id: userPasskeys.id,
        deviceName: userPasskeys.deviceName,
        credentialId: userPasskeys.credentialId,
        transports: userPasskeys.transports,
        createdAt: userPasskeys.createdAt,
        updatedAt: userPasskeys.updatedAt,
      })
      .from(userPasskeys)
      .where(eq(userPasskeys.userid, userId));
  } catch (error: any) {
    throw new DatabaseError(`Failed to get passkeys for user: ${userId}`, error);
  }
}

export async function getPasskeyByCredentialId(credentialId: string) {
  try {
    const [passkey] = await db
      .select()
      .from(userPasskeys)
      .where(eq(userPasskeys.credentialId, credentialId))
      .limit(1);
    return passkey || null;
  } catch (error: any) {
    throw new DatabaseError(`Failed to get passkey by credential ID`, error);
  }
}

export async function updatePasskeyCounter(credentialId: string, newCounter: number) {
  try {
    await db
      .update(userPasskeys)
      .set({ counter: newCounter, updatedAt: new Date() })
      .where(eq(userPasskeys.credentialId, credentialId));
  } catch (error: any) {
    throw new DatabaseError(`Failed to update passkey counter`, error);
  }
}

export async function deleteUserPasskey(id: string, userId: string) {
  try {
    return await db.transaction(async (transaction) => {
      const state = await lockUserLoginMethods(transaction, userId);
      if (!state || !state.passkeys.some((passkey) => passkey.id === id)) {
        throw new DatabaseError('Passkey not found or access denied');
      }
      if (!hasRemainingLoginMethod(state.methods, { type: 'passkey', id })) {
        throw new LastLoginMethodError();
      }
      const [removed] = await transaction
        .delete(userPasskeys)
        .where(and(eq(userPasskeys.id, id), eq(userPasskeys.userid, userId)))
        .returning();
      return removed;
    });
  } catch (error) {
    if (error instanceof DatabaseError || error instanceof LastLoginMethodError) throw error;
    throw new DatabaseError('Failed to delete passkey', error);
  }
}

export async function getUserPasskeyCount(userId: string): Promise<number> {
  try {
    const [result] = await db
      .select({ count: count() })
      .from(userPasskeys)
      .where(eq(userPasskeys.userid, userId));
    return result?.count || 0;
  } catch (error: any) {
    throw new DatabaseError(`Failed to count passkeys for user: ${userId}`, error);
  }
}
