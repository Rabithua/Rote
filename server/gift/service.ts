import { and, asc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../utils/drizzle';
import { giftCampaigns, giftCodes, users } from '../drizzle/schema';
import { isValidUUID } from '../utils/main';
import { GiftApiError } from './errors';

const MAX_IMPORT_CODES = 50_000;
const EXPIRING_SOON_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type GiftCodeImport = { code: string; expiresAt: Date; userid: string };

export type GiftImportResult = {
  campaignId: string;
  imported: number;
  duplicateCodes: number;
  skippedUserids: string[];
  totalCodes: number;
};

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

  // Codes arrive pre-paired with their recipient: every row enters the table
  // already allocated, so there is no unallocated pool state.
  const seenCodes = new Map<string, string>();
  const normalized: GiftCodeImport[] = [];
  const requestedUserids = new Set<string>();
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
    // Lowercase before any comparison: Postgres canonicalizes uuid to
    // lowercase, so an uppercase id from the caller would otherwise fail the
    // known-user check below.
    const userid = typeof item.userid === 'string' ? item.userid.trim().toLowerCase() : '';
    if (!isValidUUID(userid)) {
      throw new GiftApiError('gift_invalid_request', 400);
    }
    // Exact repeats of the same code+recipient collapse silently — they were
    // never distinct cards. The same code pointed at a different recipient is
    // a caller data conflict, not a repeat: refuse it instead of silently
    // dropping one of the listed recipients.
    const first = seenCodes.get(code);
    if (first != null) {
      if (first !== userid) {
        throw new GiftApiError('gift_invalid_request', 400);
      }
      continue;
    }
    seenCodes.set(code, userid);
    requestedUserids.add(userid);
    normalized.push({ code, expiresAt, userid });
  }

  const uniqueUserids = [...requestedUserids];
  const userRows = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, uniqueUserids));
  const knownUserids = new Set(userRows.map((row) => row.id));
  const unknownUserids = uniqueUserids.filter((id) => !knownUserids.has(id));
  if (unknownUserids.length > 0) {
    throw new GiftApiError('gift_invalid_request', 400);
  }

  return await db.transaction(async (tx) => {
    // Serialize concurrent shipments of the same campaign name (the register
    // pattern's transaction-scoped advisory lock): overlapping imports would
    // both miss the already-holding check below and double-send recipients.
    // Keyed on the caller-supplied name so it also covers first imports where
    // the campaign row does not exist yet.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`gift-import:${name}`}))`);
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
          status: 'allocated',
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

    // Recipients already holding a code from earlier imports are skipped, so
    // re-running a shipment stays idempotent. Duplicated recipients inside one
    // payload are deliberate multi-gifts and all get inserted.
    const existingRows = await tx
      .select({ userid: giftCodes.userid })
      .from(giftCodes)
      .where(and(eq(giftCodes.campaignId, campaign.id), inArray(giftCodes.userid, uniqueUserids)));
    const alreadyHolding = new Set(existingRows.map((row) => row.userid));
    const insertable = normalized.filter((item) => !alreadyHolding.has(item.userid));

    // Four bound params per row: chunk to stay far below postgres-js's
    // 65,534-parameter ceiling for a single statement.
    const importChunkSize = 4_000;
    let imported = 0;
    const now = new Date();
    for (let start = 0; start < insertable.length; start += importChunkSize) {
      const chunk = insertable.slice(start, start + importChunkSize);
      const rows = await tx
        .insert(giftCodes)
        .values(
          chunk.map((item, index) => ({
            campaignId: campaign.id,
            code: item.code,
            expiresAt: item.expiresAt,
            userid: item.userid,
            // One timestamp per payload would tie every row's allocatedAt and
            // collapse currentGiftForUser's oldest-first ordering to heap
            // order; a 1ms step per payload entry keeps payload order.
            allocatedAt: new Date(now.getTime() + (start + index)),
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
      // Codes that lost the unique-code conflict during insert (already in
      // the table from an earlier shipment).
      duplicateCodes: insertable.length - imported,
      skippedUserids: uniqueUserids.filter((id) => alreadyHolding.has(id)),
      totalCodes: totals?.count ?? 0,
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
      and(eq(giftCodes.userid, userid), isNull(giftCodes.shownAt), gt(giftCodes.expiresAt, now))
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
    .where(and(eq(giftCodes.id, codeId), eq(giftCodes.userid, userid), isNull(giftCodes.shownAt)))
    .returning({ id: giftCodes.id });
  if (rows.length > 0) return 'marked';

  // Already shown is a success for the client (idempotent retry), but only
  // when the code genuinely belongs to this user.
  const [owned] = await db
    .select({ id: giftCodes.id })
    .from(giftCodes)
    .where(and(eq(giftCodes.id, codeId), eq(giftCodes.userid, userid)))
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
    allocatedActive: number;
    shown: number;
    expired: number;
  };
  expiringSoon: Array<{ userid: string; code: string; expiresAt: Date }>;
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
      shownAt: giftCodes.shownAt,
      expiresAt: giftCodes.expiresAt,
    })
    .from(giftCodes)
    .where(eq(giftCodes.campaignId, campaignId));

  const totals = {
    total: rows.length,
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
      totals.expired += 1;
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
