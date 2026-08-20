export type SandboxPolicy = {
  mode: 'sandbox';
  productionAccess: false;
  testDataOnly: true;
  boundedPermissions: true;
  explicitPromotionRequired: true;
  auditEvents: true;
  maxRuntimeMinutes: number;
};

/** Default safe trial posture: no production authority and explicit promotion. */
export const defaultMarketplaceSandboxPolicy: SandboxPolicy = {
  mode: 'sandbox',
  productionAccess: false,
  testDataOnly: true,
  boundedPermissions: true,
  explicitPromotionRequired: true,
  auditEvents: true,
  maxRuntimeMinutes: 30,
};
