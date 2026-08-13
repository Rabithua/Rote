import { eq } from 'drizzle-orm';
import { billingGrants } from '../drizzle/schema';
import { hashBillingGrantSnapshot } from '../billing/grantSnapshot';
import db from '../utils/drizzle';

if (process.env.CONFIRM_GRANT_CONTRACT_RESET !== 'grant_contract_reset') {
  throw new Error(
    'Set CONFIRM_GRANT_CONTRACT_RESET=grant_contract_reset to run this maintenance tool'
  );
}

async function main() {
  await db.transaction(async (transaction) => {
    const grants = await transaction.select().from(billingGrants).for('update');
    for (const grant of grants) {
      const snapshot = {
        issuer: grant.issuer as 'rote-paid-server',
        instanceId: grant.instanceId,
        revision: grant.revision,
        planId: 'rote_pro' as const,
        status: 'none' as const,
        productId: null,
        entitlementExpiresAt: null,
        leaseExpiresAt: null,
        capabilities: [],
        benefits: null,
      };
      await transaction
        .update(billingGrants)
        .set({
          planId: snapshot.planId,
          status: snapshot.status,
          productId: null,
          entitlementExpiresAt: null,
          leaseExpiresAt: null,
          capabilities: [],
          benefits: null,
          snapshotHash: hashBillingGrantSnapshot(snapshot),
          updatedAt: new Date(),
        })
        .where(eq(billingGrants.userId, grant.userId));
    }
  });
  console.log('grant_contract_reset_complete');
}

void main();
