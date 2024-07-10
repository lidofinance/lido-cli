import {
  consensusForAccountingContract,
  consensusForExitBusContract,
  norContract,
  oracleConfigContract,
  sanityCheckerContract,
  stakingRouterContract,
} from '@contracts';
import { wallet } from '@providers';
import { votingNewVote } from '@scripts';
import { CallScriptActionWithDescription, encodeCallScript, forwardVoteFromTm, logger } from '@utils';
import {
  encodeFromVotingGrantRolesAragonWithConfirm,
  encodeFromAgentGrantRolesAccessControlWithConfirmed,
  encodeScriptsVEBOResumeIfPaused,
  encodeScriptsWQResumeIfPaused,
  promptScriptsAddingGuardiansFromAgentIfEmpty,
  promptScriptsAOInitialEpoch,
  promptScriptsAOMembers,
  promptScriptsLidoResumeIfStopped,
  promptScriptsVEBOInitialEpoch,
  promptScriptsVEBOMembers,
  promptRolesBeneficiary,
} from './generators';
import chalk from 'chalk';

const DEFAULT_CONFIG = {
  STAKING_LIMIT: 150_000,
  ORACLE_MEMBERS: 2,
  DSM_GUARDIANS_MEMBERS: 2,
  ROLES_BENEFICIARY: wallet.address,
};

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

const head = chalk.blue.bold;
const bold = chalk.white.bold;

export const devnetStart = async () => {
  // Lido
  logger.log(head('Lido'));
  const lidoResumeScripts = await promptScriptsLidoResumeIfStopped(DEFAULT_CONFIG.STAKING_LIMIT);
  logger.log();

  // Withdrawal Queue
  logger.log(head('Withdrawal Queue'));
  const wqResumeScripts = await encodeScriptsWQResumeIfPaused();
  logger.log();

  // Oracles
  logger.log(head('Oracles'));

  /**/ logger.log(bold('VEBO'));
  /**/ const veboScripts = await promptScriptsVEBO();
  /**/ logger.log();

  /**/ logger.log(bold('AO'));
  /**/ const aoScripts = await promptScriptsAO();
  /**/ logger.log();

  // DSM
  logger.log(head('DSM'));
  const dsmScripts = await promptScriptsDSM();
  logger.log();

  // Roles
  logger.log(head('Roles'));
  const rolesScripts = await promptScriptsRoles();
  logger.log();

  // Voting calls
  const votingCalls: CallScriptActionWithDescription[] = [
    ...lidoResumeScripts,
    ...wqResumeScripts,
    ...veboScripts,
    ...aoScripts,
    ...dsmScripts,
    ...rolesScripts,
  ];

  // Voting description
  const description = joinVotingDesc(votingCalls);
  logger.log(head('Voting description:'));
  logger.log(description);
  logger.log();

  // Voting start
  const voteEvmScript = encodeCallScript(votingCalls);
  const [newVoteCalldata] = votingNewVote(voteEvmScript, description);
  await forwardVoteFromTm(newVoteCalldata);
};

const promptScriptsVEBO = async () => {
  const veboResumeScripts = await encodeScriptsVEBOResumeIfPaused();
  const veboMembersScripts = await promptScriptsVEBOMembers(DEFAULT_CONFIG.ORACLE_MEMBERS);
  const veboInitialEpochScripts = await promptScriptsVEBOInitialEpoch();
  return [...veboResumeScripts, ...veboMembersScripts, ...veboInitialEpochScripts];
};

const promptScriptsAO = async () => {
  const aoMembersScripts = await promptScriptsAOMembers(DEFAULT_CONFIG.ORACLE_MEMBERS);
  const aoInitialEpochScripts = await promptScriptsAOInitialEpoch();
  return [...aoMembersScripts, ...aoInitialEpochScripts];
};

const promptScriptsDSM = async () => {
  const guardiansScripts = await promptScriptsAddingGuardiansFromAgentIfEmpty(DEFAULT_CONFIG.DSM_GUARDIANS_MEMBERS);
  return [...guardiansScripts];
};

const promptScriptsRoles = async () => {
  const beneficiary = await promptRolesBeneficiary(DEFAULT_CONFIG.ROLES_BENEFICIARY);
  const srScripts = await encodeFromAgentGrantRolesAccessControlWithConfirmed(
    'SR',
    STAKING_ROUTER_ROLES,
    stakingRouterContract,
    beneficiary,
  );
  const norScripts = await encodeFromVotingGrantRolesAragonWithConfirm('NOR', NOR_ROLES, norContract, beneficiary);
  const aoScripts = await encodeFromAgentGrantRolesAccessControlWithConfirmed(
    'AO consensus',
    HASH_CONSENSUS_ROLES,
    consensusForAccountingContract,
    beneficiary,
  );
  const veboScripts = await encodeFromAgentGrantRolesAccessControlWithConfirmed(
    'VEBO consensus',
    HASH_CONSENSUS_ROLES,
    consensusForExitBusContract,
    beneficiary,
  );
  const oracleConfigScripts = await encodeFromAgentGrantRolesAccessControlWithConfirmed(
    'Oracle daemon config',
    ORACLE_CONFIG_ROLES,
    oracleConfigContract,
    beneficiary,
  );
  const sanityCheckerScripts = await encodeFromAgentGrantRolesAccessControlWithConfirmed(
    'Sanity checker',
    SANITY_CHECKER_ROLES,
    sanityCheckerContract,
    beneficiary,
  );
  return [...srScripts, ...norScripts, ...aoScripts, ...veboScripts, ...oracleConfigScripts, ...sanityCheckerScripts];
};

const joinVotingDesc = (calls: CallScriptActionWithDescription[]) => {
  return calls.map(({ desc }, index) => `${index + 1}. ${desc}`).join('\n');
};
