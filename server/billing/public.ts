import { billingGrantRepository } from './grantRepository';
import { PaidBillingClient } from './paidClient';
import { createPublicBillingRouter } from './publicRoutes';
import { billingConfig } from './runtimeConfig';
import { authenticateJWT } from '../middleware/jwtAuth';

export default createPublicBillingRouter({
  config: billingConfig,
  grantStore: billingGrantRepository,
  provider: billingConfig.enabled ? new PaidBillingClient(billingConfig) : null,
  authenticate: authenticateJWT,
});
