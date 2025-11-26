import prompts from 'prompts';
import { Contract, isAddress } from 'ethers';
import { logger } from '@utils';
import chalk from 'chalk';
import {
  encodeFromAgentGrantRolesAccessControl,
  encodeFromAgentGrantRolesAccessControlWithConfirm,
} from './access-control';
import {
  consensusForAccountingContract,
  consensusForCSMContract,
  consensusForExitBusContract,
  norContract,
  oracleConfigContract,
  sanityCheckerContract,
  stakingRouterContract,
} from '@contracts';
import { DEFAULT_DEVNET_CONFIG } from './devnet';
import { encodeFromAgentGrantRolesAragon, encodeFromAgentGrantRolesAragonWithConfirm } from './aragon';

const NOR_ROLES = [
  'STAKING_ROUTER_ROLE',
  'MANAGE_SIGNING_KEYS',
  'SET_NODE_OPERATOR_LIMIT_ROLE',
  'MANAGE_NODE_OPERATOR_ROLE',
];

const HASH_CONSENSUS_ROLES = [
  'MANAGE_MEMBERS_AND_QUORUM_ROLE',
  'MANAGE_FRAME_CONFIG_ROLE',
  'MANAGE_FAST_LANE_CONFIG_ROLE',
];

const ORACLE_CONFIG_ROLES = ['CONFIG_MANAGER_ROLE'];
const STAKING_ROUTER_ROLES = ['STAKING_MODULE_MANAGE_ROLE'];
const SANITY_CHECKER_ROLES = ['ALL_LIMITS_MANAGER_ROLE'];

const bold = chalk.white.bold;

export const promptScriptsRoles = async () => {
  const beneficiary = await promptRolesBeneficiary(DEFAULT_DEVNET_CONFIG.ROLES_BENEFICIARY);
  return promptScriptsRolesWithConfirm(beneficiary);
};

export const promptScriptsRolesWithConfirm = async (beneficiary: string) => {
  const srScripts = await encodeFromAgentGrantRolesAccessControlWithConfirm(
    'SR',
    STAKING_ROUTER_ROLES,
    stakingRouterContract,
    beneficiary,
  );
  const norScripts = await encodeFromAgentGrantRolesAragonWithConfirm('NOR', NOR_ROLES, norContract, beneficiary);
  const aoScripts = await encodeFromAgentGrantRolesAccessControlWithConfirm(
    'AO consensus',
    HASH_CONSENSUS_ROLES,
    consensusForAccountingContract,
    beneficiary,
  );
  const veboScripts = await encodeFromAgentGrantRolesAccessControlWithConfirm(
    'VEBO consensus',
    HASH_CONSENSUS_ROLES,
    consensusForExitBusContract,
    beneficiary,
  );
  const oracleConfigScripts = await encodeFromAgentGrantRolesAccessControlWithConfirm(
    'Oracle daemon config',
    ORACLE_CONFIG_ROLES,
    oracleConfigContract,
    beneficiary,
  );
  const sanityCheckerScripts = await encodeFromAgentGrantRolesAccessControlWithConfirm(
    'Sanity checker',
    SANITY_CHECKER_ROLES,
    sanityCheckerContract,
    beneficiary,
  );
  return [...srScripts, ...norScripts, ...aoScripts, ...veboScripts, ...oracleConfigScripts, ...sanityCheckerScripts];
};

export const promptCuratedModulesScriptsRoles = async () => {
  const beneficiary = await promptRolesBeneficiary(DEFAULT_DEVNET_CONFIG.ROLES_BENEFICIARY);
  const moduleIds = await promptModuleIds(DEFAULT_DEVNET_CONFIG.CURATED_MODULE_IDS);
  return promptScriptsCurateModulesRolesWithConfirm(moduleIds, beneficiary);
};

export const promptScriptsCurateModulesRolesWithConfirm = async (moduleIds: number[], beneficiary: string) => {
  const result = [];

  for (const moduleId of moduleIds) {
    const { stakingModuleAddress } = await stakingRouterContract.getStakingModule(moduleId);
    const moduleContract = norContract.attach(stakingModuleAddress) as Contract;
    const moduleScripts = await encodeFromAgentGrantRolesAragonWithConfirm(
      `Module ${moduleId}`,
      NOR_ROLES,
      moduleContract,
      beneficiary,
    );

    result.push(...moduleScripts);
  }

  return result;
};

export const promptOraclesScriptsRoles = async () => {
  const beneficiary = await promptRolesBeneficiary(DEFAULT_DEVNET_CONFIG.ROLES_BENEFICIARY);
  return promptScriptsOraclesRolesWithConfirm(beneficiary);
};

export const promptScriptsOraclesRolesWithConfirm = async (beneficiary: string) => {
  const aoScripts = await encodeFromAgentGrantRolesAccessControlWithConfirm(
    'AO consensus',
    HASH_CONSENSUS_ROLES,
    consensusForAccountingContract,
    beneficiary,
  );
  const veboScripts = await encodeFromAgentGrantRolesAccessControlWithConfirm(
    'VEBO consensus',
    HASH_CONSENSUS_ROLES,
    consensusForExitBusContract,
    beneficiary,
  );
  const csmScripts = await encodeFromAgentGrantRolesAccessControlWithConfirm(
    'CS consensus',
    HASH_CONSENSUS_ROLES,
    consensusForCSMContract,
    beneficiary,
  );

  return [...aoScripts, ...veboScripts, ...csmScripts];
};

export const encodeScriptsRoles = async (beneficiary: string) => {
  const srScripts = await encodeFromAgentGrantRolesAccessControl(
    'SR',
    STAKING_ROUTER_ROLES,
    stakingRouterContract,
    beneficiary,
  );
  const norScripts = await encodeFromAgentGrantRolesAragon('NOR', NOR_ROLES, norContract, beneficiary);
  const aoScripts = await encodeFromAgentGrantRolesAccessControl(
    'AO consensus',
    HASH_CONSENSUS_ROLES,
    consensusForAccountingContract,
    beneficiary,
  );
  const veboScripts = await encodeFromAgentGrantRolesAccessControl(
    'VEBO consensus',
    HASH_CONSENSUS_ROLES,
    consensusForExitBusContract,
    beneficiary,
  );
  const oracleConfigScripts = await encodeFromAgentGrantRolesAccessControl(
    'Oracle daemon config',
    ORACLE_CONFIG_ROLES,
    oracleConfigContract,
    beneficiary,
  );
  const sanityCheckerScripts = await encodeFromAgentGrantRolesAccessControl(
    'Sanity checker',
    SANITY_CHECKER_ROLES,
    sanityCheckerContract,
    beneficiary,
  );
  return [...srScripts, ...norScripts, ...aoScripts, ...veboScripts, ...oracleConfigScripts, ...sanityCheckerScripts];
};

export const promptRolesBeneficiary = async (initialAddress: string) => {
  const { address } = await prompts({
    type: 'text',
    name: 'address',
    validate: (value) => isAddress(value),
    initial: initialAddress,
    message: 'Enter roles beneficiary address',
  });

  return address;
};

export const promptModuleIds = async (initialIds: number[]) => {
  const { ids } = await prompts({
    type: 'text',
    name: 'ids',
    validate: (value) => {
      const ids: number[] = value.split(',').map((id: string) => parseInt(id, 10));
      return ids.every((id) => !isNaN(id) && id >= 0);
    },
    initial: initialIds.join(','),
    message: 'Enter module ids separated by comma',
  });

  return ids.split(',').map((id: string) => parseInt(id.trim(), 10)) as number[];
};

export const confirmRoleGranting = async () => {
  const { confirm } = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: 'Grant roles?',
    initial: true,
  });

  return confirm;
};

export const printRoles = async (contractName: string, roles: string[]) => {
  logger.log(bold(`${contractName} roles`));
  roles.map((role) => logger.log(`- ${role}`));
};
