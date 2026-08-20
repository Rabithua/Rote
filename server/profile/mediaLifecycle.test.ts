import { describe, expect, it } from 'bun:test';

process.env.POSTGRESQL_URL ||= 'postgres://test:test@localhost:5432/rote_test';
const {
  attachmentMatchesUrl,
  profileAttachmentUrl,
  profileReferencesAttachment,
  resolveProfileAttachmentUrl,
  resolveProfileMediaUpdate,
} = await import('./mediaLifecycle');

const attachment = {
  id: 'attachment-1',
  url: 'https://storage.example/original.jpg',
  compressUrl: 'https://storage.example/compressed.webp',
  details: {},
};

function transactionReturning(rows: unknown[]) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => ({
            for: async () => rows,
          }),
        }),
      }),
    }),
  };
}

describe('profile media lifecycle', () => {
  it('derives a profile URL from the compressed asset when available', () => {
    expect(profileAttachmentUrl(attachment)).toBe(attachment.compressUrl);
    expect(profileAttachmentUrl({ ...attachment, compressUrl: '' })).toBe(attachment.url);
  });

  it('accepts either stored URL and rejects a mismatched submitted URL', () => {
    expect(attachmentMatchesUrl(attachment, attachment.url)).toBe(true);
    expect(attachmentMatchesUrl(attachment, attachment.compressUrl)).toBe(true);
    expect(resolveProfileAttachmentUrl('avatar', attachment, attachment.url)).toBe(
      attachment.compressUrl
    );
    expect(() =>
      resolveProfileAttachmentUrl('avatar', attachment, 'https://storage.example/other.jpg')
    ).toThrow('avatar URL does not match the supplied attachment');
  });

  it('keeps an attachment while either resulting profile field references it', () => {
    expect(profileReferencesAttachment({ avatar: attachment.url, cover: null }, attachment)).toBe(
      true
    );
    expect(
      profileReferencesAttachment({ avatar: null, cover: attachment.compressUrl }, attachment)
    ).toBe(true);
    expect(
      profileReferencesAttachment(
        { avatar: 'https://external.example/avatar.jpg', cover: null },
        attachment
      )
    ).toBe(false);
  });

  it('keeps URL-only profile requests compatible with existing clients', async () => {
    await expect(
      resolveProfileMediaUpdate(transactionReturning([]), 'user-1', {
        avatar: 'https://external.example/avatar.jpg',
        cover: null,
      })
    ).resolves.toEqual({
      avatar: 'https://external.example/avatar.jpg',
      cover: null,
    });
  });

  it('derives both profile fields when one owned unbound attachment is shared', async () => {
    await expect(
      resolveProfileMediaUpdate(transactionReturning([attachment]), 'user-1', {
        avatarAttachmentId: 'ce77f797-8a90-4868-b24c-a3ab0f498085',
        coverAttachmentId: 'ce77f797-8a90-4868-b24c-a3ab0f498085',
      })
    ).resolves.toEqual({
      avatar: attachment.compressUrl,
      cover: attachment.compressUrl,
    });
  });

  it('rejects attachments that are not visible as owned and unbound', async () => {
    await expect(
      resolveProfileMediaUpdate(transactionReturning([]), 'user-1', {
        avatarAttachmentId: 'ce77f797-8a90-4868-b24c-a3ab0f498085',
      })
    ).rejects.toThrow('Invalid avatar attachment');
  });

  it('rejects a supplied URL that does not match the attachment record', async () => {
    await expect(
      resolveProfileMediaUpdate(transactionReturning([attachment]), 'user-1', {
        avatar: 'https://external.example/avatar.jpg',
        avatarAttachmentId: 'ce77f797-8a90-4868-b24c-a3ab0f498085',
      })
    ).rejects.toThrow('avatar URL does not match the supplied attachment');
  });
});
