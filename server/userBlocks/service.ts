import { oneUser } from '../utils/dbMethods/user';
import { getUserInfoByUsername } from '../utils/dbMethods/userProfile';
import {
  createUserBlock,
  deleteUserBlock,
  getUserBlockRelationship,
  hasBlockInEitherDirection,
  hasUserBlocked,
  listUserBlocks,
} from '../utils/dbMethods/userBlock';

export async function blockUser(blockerId: string, targetUserId: string) {
  if (blockerId === targetUserId) {
    throw new Error('Invalid block target: you cannot block yourself');
  }

  const target = await oneUser(targetUserId);
  if (!target) {
    throw new Error('User not found');
  }

  await createUserBlock(blockerId, targetUserId);
  return { blocked: true, targetUserId };
}

export async function unblockUser(blockerId: string, targetUserId: string) {
  if (blockerId === targetUserId) {
    throw new Error('Invalid block target: you cannot unblock yourself');
  }

  await deleteUserBlock(blockerId, targetUserId);
  return { blocked: false, targetUserId };
}

export async function getBlockedUsers(blockerId: string) {
  return listUserBlocks(blockerId);
}

export async function getViewerAwarePublicUserProfile(username: string, viewerId?: string) {
  const profile = await getUserInfoByUsername(username);
  if (!viewerId || viewerId === profile.id) {
    return { ...profile, viewerHasBlocked: false };
  }

  const relationship = await getUserBlockRelationship(viewerId, profile.id);
  if (relationship.targetHasBlocked) {
    throw new Error('User not found');
  }

  return {
    ...profile,
    viewerHasBlocked: relationship.viewerHasBlocked,
  };
}

export async function assertUsersMayInteract(actorId: string, contentOwnerId: string) {
  if (actorId !== contentOwnerId && (await hasBlockInEitherDirection(actorId, contentOwnerId))) {
    throw new Error('Rote not found');
  }
}

export { getUserBlockRelationship, hasBlockInEitherDirection, hasUserBlocked };
