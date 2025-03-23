import { votingNewVote } from '@scripts';
import { CallScriptActionWithDescription, encodeCallScript, forwardVoteFromTm, logger } from '@utils';
import { joinVotingDesc, promptOraclesScriptsRoles } from './generators';
import chalk from 'chalk';

const head = chalk.blue.bold;
const bold = chalk.white.bold;

export const oraclesManager = async () => {
  // Roles
  logger.log(head('Roles'));
  const moduleScripts = await promptOraclesScriptsRoles();
  logger.log();

  // Voting calls
  const votingCalls: CallScriptActionWithDescription[] = [...moduleScripts];

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
