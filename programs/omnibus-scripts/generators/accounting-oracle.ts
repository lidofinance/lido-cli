import { accountingOracleContract, consensusForAccountingContract } from '@contracts';
import { encodeFromAgentGrantRole } from './access-control';
import {
  encodeScriptsOracleInitialEpochIfPassed,
  encodeScriptsOracleMembers,
  promptScriptsOracleInitialEpochIfNotSet,
  promptScriptsOracleMembersIfEmpty,
} from './oracles';
import { DEFAULT_DEVNET_CONFIG } from './devnet';

export const encodeScriptsAO = async (oracleMembers: string[], oracleQuorum: number, initialEpoch?: number) => {
  const aoMembersScripts = await encodeScriptsAOMembers(oracleMembers, oracleQuorum);
  const aoInitialEpochScripts = await encodeScriptsAOInitialEpoch(initialEpoch);
  return [...aoMembersScripts, ...aoInitialEpochScripts];
};

export const promptScriptsAO = async () => {
  const aoMembersScripts = await promptScriptsAOMembers(DEFAULT_DEVNET_CONFIG.ORACLE_MEMBERS);
  const aoInitialEpochScripts = await promptScriptsAOInitialEpoch();
  return [...aoMembersScripts, ...aoInitialEpochScripts];
};

export const encodeFromAgentAOGrantRole = async (role: string, account: string) => {
  return await encodeFromAgentGrantRole('AO', accountingOracleContract, role, account);
};

export const encodeScriptsAOMembers = async (members: string[], quorum: number) => {
  return await encodeScriptsOracleMembers('AO', consensusForAccountingContract, members, quorum);
};

export const encodeScriptsAOInitialEpoch = async (initialEpoch?: number) => {
  return await encodeScriptsOracleInitialEpochIfPassed('AO', consensusForAccountingContract, initialEpoch);
};

export const promptScriptsAOMembers = async (initialMembers: number) => {
  return await promptScriptsOracleMembersIfEmpty('AO', consensusForAccountingContract, initialMembers);
};

export const promptScriptsAOInitialEpoch = async () => {
  return await promptScriptsOracleInitialEpochIfNotSet('AO', consensusForAccountingContract);
};
