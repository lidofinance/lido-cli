import { wallet } from '@providers';

export const DEFAULT_DEVNET_CONFIG = {
  STAKING_LIMIT: 150_000,
  ORACLE_MEMBERS: 2,
  DSM_GUARDIANS_MEMBERS: 2,
  ROLES_BENEFICIARY: wallet.address,
  CURATED_MODULE_IDS: [1, 2],
};
