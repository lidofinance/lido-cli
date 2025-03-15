import { votingNewVote } from '@scripts';
import { CallScriptActionWithDescription, encodeCallScript, forwardVoteFromTm, logger } from '@utils';
import {
  encodeScriptsWQResumeIfPaused,
  promptScriptsLidoResumeIfStopped,
  joinVotingDesc,
  DEFAULT_DEVNET_CONFIG,
  promptScriptsVEBO,
  promptScriptsAO,
  promptScriptsDSM,
  promptScriptsRoles,
} from './generators';
import chalk from 'chalk';

const head = chalk.blue.bold;
const bold = chalk.white.bold;

export const devnetStart = async () => {
  // Lido
  logger.log(head('Lido'));
  const lidoResumeScripts = await promptScriptsLidoResumeIfStopped(DEFAULT_DEVNET_CONFIG.STAKING_LIMIT);
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
