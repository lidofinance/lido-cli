import { accountingOracleContract, consensusForAccountingContract } from '@contracts';
import { encodeFromAgentGrantRole } from './access-control';
import { promptScriptsOracleInitialEpochIfNotSet, promptScriptsOracleMembersIfEmpty } from './oracles';

export const encodeFromAgentAOGrantRole = async (role: string, account: string) => {
  return await encodeFromAgentGrantRole('AO', accountingOracleContract, role, account);
};

export const promptScriptsAOMembers = async (initialMembers: number) => {
  return await promptScriptsOracleMembersIfEmpty('AO', consensusForAccountingContract, initialMembers);
};

export const promptScriptsAOInitialEpoch = async () => {
  return await promptScriptsOracleInitialEpochIfNotSet('AO', consensusForAccountingContract);
};
