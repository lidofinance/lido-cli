import { consensusForExitBusContract, exitBusOracleContract } from '@contracts';
import { encodeUnpauseIfPaused } from './pause-until';
import {
  encodeScriptsOracleInitialEpochIfPassed,
  encodeScriptsOracleMembers,
  promptScriptsOracleInitialEpochIfNotSet,
  promptScriptsOracleMembersIfEmpty,
} from './oracles';
import { DEFAULT_DEVNET_CONFIG } from './devnet';

export const encodeScriptsVEBO = async (oracleMembers: string[], oracleQuorum: number, initialEpoch?: number) => {
  const veboResumeScripts = await encodeScriptsVEBOResumeIfPaused();
  const veboMembersScripts = await encodeScriptsVEBOMembers(oracleMembers, oracleQuorum);
  const veboInitialEpochScripts = await encodeScriptsVEBOInitialEpoch(initialEpoch);
  return [...veboResumeScripts, ...veboMembersScripts, ...veboInitialEpochScripts];
};

export const promptScriptsVEBO = async () => {
  const veboResumeScripts = await encodeScriptsVEBOResumeIfPaused();
  const veboMembersScripts = await promptScriptsVEBOMembers(DEFAULT_DEVNET_CONFIG.ORACLE_MEMBERS);
  const veboInitialEpochScripts = await promptScriptsVEBOInitialEpoch();
  return [...veboResumeScripts, ...veboMembersScripts, ...veboInitialEpochScripts];
};

export const encodeScriptsVEBOResumeIfPaused = async () => {
  return encodeUnpauseIfPaused('VEBO', exitBusOracleContract);
};

export const encodeScriptsVEBOMembers = async (members: string[], quorum: number) => {
  return await encodeScriptsOracleMembers('VEBO', consensusForExitBusContract, members, quorum);
};

export const encodeScriptsVEBOInitialEpoch = async (initialEpoch?: number) => {
  return await encodeScriptsOracleInitialEpochIfPassed('VEBO', consensusForExitBusContract, initialEpoch);
};

export const promptScriptsVEBOMembers = async (initialMembers: number) => {
  return await promptScriptsOracleMembersIfEmpty('VEBO', consensusForExitBusContract, initialMembers);
};

export const promptScriptsVEBOInitialEpoch = async () => {
  return await promptScriptsOracleInitialEpochIfNotSet('VEBO', consensusForExitBusContract);
};
