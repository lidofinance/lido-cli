import { consensusForExitBusContract, exitBusOracleContract } from '@contracts';
import { encodeUnpauseIfPaused } from './pause-until';
import { promptScriptsOracleInitialEpochIfNotSet, promptScriptsOracleMembersIfEmpty } from './oracles';

export const encodeScriptsVEBOResumeIfPaused = async () => {
  return encodeUnpauseIfPaused('VEBO', exitBusOracleContract);
};

export const promptScriptsVEBOMembers = async (initialMembers: number) => {
  return await promptScriptsOracleMembersIfEmpty('VEBO', consensusForExitBusContract, initialMembers);
};

export const promptScriptsVEBOInitialEpoch = async () => {
  return await promptScriptsOracleInitialEpochIfNotSet('VEBO', consensusForExitBusContract);
};
