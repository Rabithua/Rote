import { createInternalBillingRouter } from './internalRoutes';
import { billingGrantRepository } from './grantRepository';
import { billingConfig } from './runtimeConfig';

export default createInternalBillingRouter({
  config: billingConfig,
  grantStore: billingGrantRepository,
});
