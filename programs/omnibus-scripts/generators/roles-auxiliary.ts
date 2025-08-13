import prompts from 'prompts';
import { isAddress } from 'ethers';
import { logger } from '@utils';
import chalk from 'chalk';
import {
  encodeFromAgentGrantRolesAccessControl,
  encodeFromAgentGrantRolesAccessControlWithConfirm,
} from './access-control';
import { encodeFromVotingGrantRolesAragon, encodeFromVotingGrantRolesAragonWithConfirm } from './aragon';
import {
  consensusForAccountingContract,
  consensusForExitBusContract,
  norContract,
  oracleConfigContract,
  sanityCheckerContract,
  stakingRouterContract,
  lidoContract,
} from '@contracts';
import { DEFAULT_DEVNET_CONFIG } from './devnet';

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
const LIDO_ROLES = ['RESUME_ROLE'];

const bold = chalk.white.bold;

export const promptScriptsRoles = async () => {
  const beneficiary = await promptRolesBeneficiary(DEFAULT_DEVNET_CONFIG.ROLES_BENEFICIARY);
  return promptScriptsRolesWithConfirm(beneficiary);
};

export const promptScriptsRolesWithConfirm = async (beneficiary: string) => {
  const lidoScripts = await encodeFromVotingGrantRolesAragonWithConfirm('Lido', LIDO_ROLES, lidoContract, beneficiary);
  const srScripts = await encodeFromAgentGrantRolesAccessControlWithConfirm(
    'SR',
    STAKING_ROUTER_ROLES,
    stakingRouterContract,
    beneficiary,
  );
  const norScripts = await encodeFromVotingGrantRolesAragonWithConfirm('NOR', NOR_ROLES, norContract, beneficiary);
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
  return [
    ...lidoScripts,
    ...srScripts,
    ...norScripts,
    ...aoScripts,
    ...veboScripts,
    ...oracleConfigScripts,
    ...sanityCheckerScripts,
  ];
};

export const encodeScriptsRoles = async (beneficiary: string) => {
  const lidoScripts = await encodeFromVotingGrantRolesAragon('Lido', LIDO_ROLES, lidoContract, beneficiary);
  const srScripts = await encodeFromAgentGrantRolesAccessControl(
    'SR',
    STAKING_ROUTER_ROLES,
    stakingRouterContract,
    beneficiary,
  );
  const norScripts = await encodeFromVotingGrantRolesAragon('NOR', NOR_ROLES, norContract, beneficiary);
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
  return [
    ...lidoScripts,
    ...srScripts,
    ...norScripts,
    ...aoScripts,
    ...veboScripts,
    ...oracleConfigScripts,
    ...sanityCheckerScripts,
  ];
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
