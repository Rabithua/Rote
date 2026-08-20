import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { attachments } from '../drizzle/schema';
import {
  collectOwnedAttachmentObjectKeys,
  enqueueStorageObjectCleanup,
  releaseStorageObjectReferences,
} from '../resources/service';
import { DatabaseError } from '../utils/dbMethods/common';

export type ProfileMediaUpdateInput = {
  avatar?: string | null;
  avatarAttachmentId?: string | null;
  cover?: string | null;
  coverAttachmentId?: string | null;
};

export type ProfileMediaValues = {
  avatar: string | null;
  cover: string | null;
};

type ProfileAttachment = Pick<
  typeof attachments.$inferSelect,
  'id' | 'url' | 'compressUrl' | 'details'
>;

type ResolvedProfileMediaUpdate = {
  avatar?: string | null;
  cover?: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function profileAttachmentUrl(attachment: ProfileAttachment): string {
  return attachment.compressUrl || attachment.url;
}

export function attachmentMatchesUrl(
  attachment: ProfileAttachment,
  url: string | null | undefined
): boolean {
  return Boolean(url && (attachment.url === url || attachment.compressUrl === url));
}

export function profileReferencesAttachment(
  profile: ProfileMediaValues,
  attachment: ProfileAttachment
): boolean {
  return (
    attachmentMatchesUrl(attachment, profile.avatar) ||
    attachmentMatchesUrl(attachment, profile.cover)
  );
}

export function resolveProfileAttachmentUrl(
  field: 'avatar' | 'cover',
  attachment: ProfileAttachment,
  submittedUrl: string | null | undefined
): string {
  if (submittedUrl !== undefined && !attachmentMatchesUrl(attachment, submittedUrl)) {
    throw new DatabaseError(`${field} URL does not match the supplied attachment`);
  }
  return profileAttachmentUrl(attachment);
}

async function resolveAttachmentUrl(
  transaction: any,
  userId: string,
  field: 'avatar' | 'cover',
  attachmentId: string,
  submittedUrl: string | null | undefined
): Promise<string> {
  if (!UUID_PATTERN.test(attachmentId)) {
    throw new DatabaseError(`Invalid ${field} attachment`);
  }
  const [attachment] = (await transaction
    .select({
      id: attachments.id,
      url: attachments.url,
      compressUrl: attachments.compressUrl,
      details: attachments.details,
    })
    .from(attachments)
    .where(
      and(
        eq(attachments.id, attachmentId),
        eq(attachments.userid, userId),
        isNull(attachments.roteid)
      )
    )
    .limit(1)
    .for('update')) as ProfileAttachment[];

  if (!attachment) {
    throw new DatabaseError(`Invalid ${field} attachment`);
  }
  return resolveProfileAttachmentUrl(field, attachment, submittedUrl);
}

export async function resolveProfileMediaUpdate(
  transaction: any,
  userId: string,
  input: ProfileMediaUpdateInput
): Promise<ResolvedProfileMediaUpdate> {
  const resolved: ResolvedProfileMediaUpdate = {};

  if (input.avatarAttachmentId) {
    resolved.avatar = await resolveAttachmentUrl(
      transaction,
      userId,
      'avatar',
      input.avatarAttachmentId,
      input.avatar
    );
  } else if (input.avatar !== undefined) {
    resolved.avatar = input.avatar || null;
  }

  if (input.coverAttachmentId) {
    resolved.cover = await resolveAttachmentUrl(
      transaction,
      userId,
      'cover',
      input.coverAttachmentId,
      input.cover
    );
  } else if (input.cover !== undefined) {
    resolved.cover = input.cover || null;
  }

  return resolved;
}

export async function releaseReplacedProfileAttachments(
  transaction: any,
  userId: string,
  previous: ProfileMediaValues,
  current: ProfileMediaValues
): Promise<number> {
  const replacedUrls = [previous.avatar, previous.cover].filter((url): url is string =>
    Boolean(url)
  );
  if (replacedUrls.length === 0) return 0;

  const candidates = (await transaction
    .select({
      id: attachments.id,
      url: attachments.url,
      compressUrl: attachments.compressUrl,
      details: attachments.details,
    })
    .from(attachments)
    .where(
      and(
        eq(attachments.userid, userId),
        isNull(attachments.roteid),
        or(inArray(attachments.url, replacedUrls), inArray(attachments.compressUrl, replacedUrls))
      )
    )
    .for('update')) as ProfileAttachment[];

  const removable = candidates.filter(
    (attachment) => !profileReferencesAttachment(current, attachment)
  );
  if (removable.length === 0) return 0;

  const objectKeys = removable.flatMap((attachment) =>
    collectOwnedAttachmentObjectKeys(attachment.details, userId)
  );
  const trackedKeys = new Set(
    await releaseStorageObjectReferences(userId, objectKeys, transaction)
  );
  await enqueueStorageObjectCleanup(
    transaction,
    objectKeys.filter((key) => !trackedKeys.has(key))
  );
  await transaction.delete(attachments).where(
    and(
      eq(attachments.userid, userId),
      isNull(attachments.roteid),
      inArray(
        attachments.id,
        removable.map((attachment) => attachment.id)
      )
    )
  );
  return removable.length;
}
