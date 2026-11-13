import { and, asc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../utils/drizzle';
import { giftCampaigns, giftCodes, users } from '../drizzle/schema';
import { GiftApiError } from './errors';

const MAX_IMPORT_CODES = 50_000;
const MAX_ALLOCATE_USERS = 5_000;
const EXPIRING_SOON_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type GiftCodeImport = { code: string; expiresAt: Date };

export type GiftImportResult = {
  campaignId: string;
  imported: number;
  duplicates: number;
  totalCodes: number;
};

export type GiftAllocateInput = {
  campaignId: string;
  usernames?: string[];
  userids?: string[];
};

export type GiftAllocateResult = {
  campaignId: string;
  requestedUsers: number;
  resolvedUsers: number;
  unknownUsernames: string[];
  unknownUserids: string[];
  alreadyAllocated: number;
  allocated: number;
  remainingCodes: number;
};

function normalizeRecipients(input: GiftAllocateInput): {
  usernames: string[];
  userids: string[];
} {
  const usernames = (input.usernames ?? [])
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length > 0);
  const userids = (input.userids ?? [])
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length > 0);
  const hasUsernames = usernames.length > 0;
  const hasUserids = userids.length > 0;
  if (hasUsernames === hasUserids) {
    throw new GiftApiError('gift_invalid_request', 400);
  }
  if (usernames.length > MAX_ALLOCATE_USERS || userids.length > MAX_ALLOCATE_USERS) {
    throw new GiftApiError('gift_invalid_request', 400);
  }
  return { usernames, userids };
}

async function resolveRecipients(
  usernames: string[],
  userids: string[]
): Promise<{ targetIds: string[]; unknownUsernames: string[]; unknownUserids: string[] }> {
  let unknownUsernames: string[] = [];
  let unknownUserids: string[] = [];
  let ids: string[] = [];

  if (usernames.length > 0) {
    const rows = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(inArray(users.username, usernames));
    const byUsername = new Map(rows.map((row) => [row.username, row.id]));
    unknownUsernames = usernames.filter((username) => !byUsername.has(username));
    ids = [...new Set(rows.map((row) => row.id))];
  } else {
    const rows = await db.select({ id: users.id }).from(users).where(inArray(users.id, userids));
    const known = new Set(rows.map((row) => row.id));
    unknownUserids = userids.filter((id) => !known.has(id));
    ids = [...new Set(userids.filter((id) => known.has(id)))];
  }

  return { targetIds: ids, unknownUsernames, unknownUserids };
}

export async function importCodes(input: {
  name: string;
  title?: string | null;
  description?: string | null;
  createdBy?: string | null;
  codes: GiftCodeImport[];
}): Promise<GiftImportResult> {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (name.length === 0 || name.length > 120) {
    throw new GiftApiError('gift_invalid_request', 400);
  }
  if (input.codes.length === 0 || input.codes.length > MAX_IMPORT_CODES) {
    throw new GiftApiError('gift_invalid_request', 400);
  }

  const seen = new Set<string>();
  const normalized: GiftCodeImport[] = [];
  for (const item of input.codes) {
    const code = typeof item.code === 'string' ? item.code.trim() : '';
    if (code.length === 0 || code.length > 255) {
      throw new GiftApiError('gift_invalid_request', 400);
    }
    const expiresAt = item.expiresAt;
    if (
      !(expiresAt instanceof Date) ||
      Number.isNaN(expiresAt.getTime()) ||
      expiresAt.getTime() <= Date.now()
    ) {
      throw new GiftApiError('gift_invalid_request', 400);
    }
    // Repeated codes inside one payload collapse silently; they were never
    // distinct cards, so counting them as duplicates would misstate the pool.
    if (seen.has(code)) continue;
    seen.add(code);
    normalized.push({ code, expiresAt });
  }

  return await db.transaction(async (tx) => {
    let [campaign] = await tx
      .select()
      .from(giftCampaigns)
      .where(eq(giftCampaigns.name, name))
      .limit(1);
    if (!campaign) {
      [campaign] = await tx
        .insert(giftCampaigns)
        .values({
          name,
          title: input.title ?? null,
          description: input.description ?? null,
          createdBy: input.createdBy ?? null,
        })
        .returning();
    } else if (input.title != null || input.description != null) {
      [campaign] = await tx
        .update(giftCampaigns)
        .set({
          title: input.title ?? campaign.title,
          description: input.description ?? campaign.description,
          updatedAt: new Date(),
        })
        .where(eq(giftCampaigns.id, campaign.id))
        .returning();
    }

    // Three bound params per row: chunk to stay far below postgres-js's
    // 65,534-parameter ceiling for a single statement.
    const importChunkSize = 5_000;
    let imported = 0;
    for (let start = 0; start < normalized.length; start += importChunkSize) {
      const chunk = normalized.slice(start, start + importChunkSize);
      const rows = await tx
        .insert(giftCodes)
        .values(
          chunk.map((item) => ({
            campaignId: campaign.id,
            code: item.code,
            expiresAt: item.expiresAt,
          }))
        )
        .onConflictDoNothing({ target: giftCodes.code })
        .returning({ id: giftCodes.id });
      imported += rows.length;
    }

    const [totals] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(giftCodes)
      .where(eq(giftCodes.campaignId, campaign.id));

    return {
      campaignId: campaign.id,
      imported,
      duplicates: normalized.length - imported,
      totalCodes: totals?.count ?? 0,
    };
  });
}

export async function allocate(input: GiftAllocateInput): Promise<GiftAllocateResult> {
  const { usernames, userids } = normalizeRecipients(input);
  const { targetIds, unknownUsernames, unknownUserids } = await resolveRecipients(
    usernames,
    userids
  );
  const requestedUsers = usernames.length > 0 ? usernames.length : userids.length;

  if (targetIds.length === 0) {
    // A mistyped campaign id with an all-unknown recipient list must fail
    // loudly, not masquerade as a successful zero-allocation run.
    const [campaign] = await db
      .select({ id: giftCampaigns.id })
      .from(giftCampaigns)
      .where(eq(giftCampaigns.id, input.campaignId))
      .limit(1);
    if (!campaign) throw new GiftApiError('gift_campaign_not_found', 404);
    const [remaining] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(giftCodes)
      .where(
        and(
          eq(giftCodes.campaignId, campaign.id),
          eq(giftCodes.status, 'available'),
          gt(giftCodes.expiresAt, new Date())
        )
      );
    return {
      campaignId: input.campaignId,
      requestedUsers,
      resolvedUsers: 0,
      unknownUsernames,
      unknownUserids,
      alreadyAllocated: 0,
      allocated: 0,
      remainingCodes: remaining?.count ?? 0,
    };
  }

  return await db.transaction(async (tx) => {
    // Serialize concurrent allocations for the same campaign (registerDevice
    // pattern): transaction-scoped blocking lock, released at commit/rollback.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`gift-allocate:${input.campaignId}`}))`
    );
    const [campaign] = await tx
      .select({ id: giftCampaigns.id, status: giftCampaigns.status })
      .from(giftCampaigns)
      .where(eq(giftCampaigns.id, input.campaignId))
      .limit(1)
      .for('update');
    if (!campaign) throw new GiftApiError('gift_campaign_not_found', 404);

    const alreadyRows = await tx
      .select({ userid: giftCodes.userid })
      .from(giftCodes)
      .where(
        and(
          eq(giftCodes.campaignId, campaign.id),
          inArray(giftCodes.userid, targetIds),
          eq(giftCodes.status, 'allocated')
        )
      );
    const already = new Set(alreadyRows.map((row) => row.userid));
    const pending = targetIds.filter((id) => !already.has(id));

    let allocated = 0;
    if (pending.length > 0) {
      const codes = await tx
        .select({ id: giftCodes.id })
        .from(giftCodes)
        .where(
          and(
            eq(giftCodes.campaignId, campaign.id),
            eq(giftCodes.status, 'available'),
            gt(giftCodes.expiresAt, new Date())
          )
        )
        .orderBy(asc(giftCodes.expiresAt), asc(giftCodes.createdAt))
        .limit(pending.length)
        .for('update', { skipLocked: true });
      if (codes.length < pending.length) {
        throw new GiftApiError('gift_insufficient_codes', 409);
      }
      const now = new Date();
      for (let index = 0; index < pending.length; index += 1) {
        await tx
          .update(giftCodes)
          .set({ userid: pending[index], allocatedAt: now, status: 'allocated', updatedAt: now })
          .where(eq(giftCodes.id, codes[index].id));
      }
      allocated = pending.length;
    }

    if (allocated > 0 && campaign.status === 'draft') {
      await tx
        .update(giftCampaigns)
        .set({ status: 'allocated', updatedAt: new Date() })
        .where(eq(giftCampaigns.id, campaign.id));
    }

    const [remaining] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(giftCodes)
      .where(
        and(
          eq(giftCodes.campaignId, campaign.id),
          eq(giftCodes.status, 'available'),
          gt(giftCodes.expiresAt, new Date())
        )
      );

    return {
      campaignId: campaign.id,
      requestedUsers,
      resolvedUsers: targetIds.length,
      unknownUsernames,
      unknownUserids,
      alreadyAllocated: already.size,
      allocated,
      remainingCodes: remaining?.count ?? 0,
    };
  });
}

export type GiftCurrentOffer = {
  codeId: string;
  code: string;
  expiresAt: Date;
  title: string | null;
  description: string | null;
};

export async function currentGiftForUser(
  userid: string,
  now: Date = new Date()
): Promise<GiftCurrentOffer | null> {
  const [row] = await db
    .select({
      codeId: giftCodes.id,
      code: giftCodes.code,
      expiresAt: giftCodes.expiresAt,
      title: giftCampaigns.title,
      description: giftCampaigns.description,
    })
    .from(giftCodes)
    .innerJoin(giftCampaigns, eq(giftCodes.campaignId, giftCampaigns.id))
    .where(
      and(
        eq(giftCodes.userid, userid),
        eq(giftCodes.status, 'allocated'),
        isNull(giftCodes.shownAt),
        gt(giftCodes.expiresAt, now)
      )
    )
    .orderBy(asc(giftCodes.allocatedAt), asc(giftCodes.createdAt))
    .limit(1);
  return row ?? null;
}

export type GiftMarkShownResult = 'marked' | 'already_shown' | 'unknown';

export async function markShown(
  codeId: string,
  userid: string,
  now: Date = new Date()
): Promise<GiftMarkShownResult> {
  const rows = await db
    .update(giftCodes)
    .set({ shownAt: now, updatedAt: now })
    .where(
      and(
        eq(giftCodes.id, codeId),
        eq(giftCodes.userid, userid),
        eq(giftCodes.status, 'allocated'),
        isNull(giftCodes.shownAt)
      )
    )
    .returning({ id: giftCodes.id });
  if (rows.length > 0) return 'marked';

  // Already shown is a success for the client (idempotent retry), but only
  // when the code genuinely belongs to this user.
  const [owned] = await db
    .select({ id: giftCodes.id })
    .from(giftCodes)
    .where(
      and(eq(giftCodes.id, codeId), eq(giftCodes.userid, userid), eq(giftCodes.status, 'allocated'))
    )
    .limit(1);
  return owned ? 'already_shown' : 'unknown';
}

export type GiftCampaignStatus = {
  campaign: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    createdAt: Date;
  };
  totals: {
    total: number;
    available: number;
    allocatedActive: number;
    shown: number;
    expired: number;
  };
  expiringSoon: Array<{ userid: string | null; code: string; expiresAt: Date }>;
};

export async function campaignStatus(
  campaignId: string,
  now: Date = new Date()
): Promise<GiftCampaignStatus> {
  const [campaign] = await db
    .select()
    .from(giftCampaigns)
    .where(eq(giftCampaigns.id, campaignId))
    .limit(1);
  if (!campaign) throw new GiftApiError('gift_campaign_not_found', 404);

  const rows = await db
    .select({
      userid: giftCodes.userid,
      code: giftCodes.code,
      status: giftCodes.status,
      shownAt: giftCodes.shownAt,
      expiresAt: giftCodes.expiresAt,
    })
    .from(giftCodes)
    .where(eq(giftCodes.campaignId, campaignId));

  const totals = {
    total: rows.length,
    available: 0,
    allocatedActive: 0,
    shown: 0,
    expired: 0,
  };
  const expiringSoon: GiftCampaignStatus['expiringSoon'] = [];
  const expiringSoonDeadline = now.getTime() + EXPIRING_SOON_WINDOW_MS;
  for (const row of rows) {
    if (row.shownAt) {
      totals.shown += 1;
      continue;
    }
    if (row.expiresAt.getTime() <= now.getTime()) {
      // Expired codes are dead stock whether or not they were ever
      // allocated: neither bucket may count them as live.
      totals.expired += 1;
      continue;
    }
    if (row.status === 'available') {
      totals.available += 1;
      continue;
    }
    totals.allocatedActive += 1;
    if (row.expiresAt.getTime() <= expiringSoonDeadline) {
      expiringSoon.push({ userid: row.userid, code: row.code, expiresAt: row.expiresAt });
    }
  }

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      status: campaign.status,
      createdAt: campaign.createdAt,
    },
    totals,
    expiringSoon,
  };
}

export type GiftCampaignDetail = Awaited<ReturnType<typeof campaignDetail>>;

export async function campaignDetail(campaignId: string) {
  const [campaign] = await db
    .select()
    .from(giftCampaigns)
    .where(eq(giftCampaigns.id, campaignId))
    .limit(1);
  if (!campaign) throw new GiftApiError('gift_campaign_not_found', 404);

  const codes = await db
    .select({
      id: giftCodes.id,
      code: giftCodes.code,
      userid: giftCodes.userid,
      username: users.username,
      status: giftCodes.status,
      expiresAt: giftCodes.expiresAt,
      allocatedAt: giftCodes.allocatedAt,
      shownAt: giftCodes.shownAt,
    })
    .from(giftCodes)
    .leftJoin(users, eq(giftCodes.userid, users.id))
    .where(eq(giftCodes.campaignId, campaignId))
    .orderBy(asc(giftCodes.createdAt))
    .limit(10_000);

  // Imports allow 50k codes; the listing caps at 10k. Surface truncation
  // instead of silently hiding the tail.
  return { campaign, codes, truncated: codes.length >= 10_000 };
}

export type GiftGrantResult = {
  codeId: string;
  code: string;
  expiresAt: Date;
};

// Single username→id resolution for admin callers (MCP grant): keeps the
// unknown-recipient behavior in one place instead of an ad-hoc query in the
// tool adapter.
export async function resolveUserid(username: string): Promise<string> {
  const trimmed = typeof username === 'string' ? username.trim() : '';
  if (trimmed.length === 0) {
    throw new GiftApiError('gift_invalid_request', 400);
  }
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, trimmed))
    .limit(1);
  if (!row) {
    throw new GiftApiError('gift_invalid_request', 400);
  }
  return row.id;
}

export async function grant(input: {
  campaignId: string;
  userid: string;
}): Promise<GiftGrantResult> {
  if (input.userid.trim().length === 0) {
    throw new GiftApiError('gift_invalid_request', 400);
  }
  return await db.transaction(async (tx) => {
    // Same campaign lock as allocate: grant must never race a bulk allocation.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`gift-allocate:${input.campaignId}`}))`
    );
    const [campaign] = await tx
      .select({ id: giftCampaigns.id, status: giftCampaigns.status })
      .from(giftCampaigns)
      .where(eq(giftCampaigns.id, input.campaignId))
      .limit(1)
      .for('update');
    if (!campaign) throw new GiftApiError('gift_campaign_not_found', 404);

    // Unlike allocate, grant never skips a recipient: it adds one more code
    // even if the user already holds one from this campaign.
    const [user] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, input.userid))
      .limit(1);
    if (!user) throw new GiftApiError('gift_invalid_request', 400);

    const [code] = await tx
      .select({ id: giftCodes.id })
      .from(giftCodes)
      .where(
        and(
          eq(giftCodes.campaignId, campaign.id),
          eq(giftCodes.status, 'available'),
          gt(giftCodes.expiresAt, new Date())
        )
      )
      .orderBy(asc(giftCodes.expiresAt), asc(giftCodes.createdAt))
      .limit(1)
      .for('update', { skipLocked: true });
    if (!code) throw new GiftApiError('gift_insufficient_codes', 409);

    const now = new Date();
    const [updated] = await tx
      .update(giftCodes)
      .set({ userid: user.id, allocatedAt: now, status: 'allocated', updatedAt: now })
      .where(eq(giftCodes.id, code.id))
      .returning({
        codeId: giftCodes.id,
        code: giftCodes.code,
        expiresAt: giftCodes.expiresAt,
      });
    if (!updated) throw new GiftApiError('gift_insufficient_codes', 409);

    // Mirror allocate: a first assignment moves the campaign out of draft.
    if (campaign.status === 'draft') {
      await tx
        .update(giftCampaigns)
        .set({ status: 'allocated', updatedAt: now })
        .where(eq(giftCampaigns.id, campaign.id));
    }
    return updated;
  });
}
