import { votingNewVote } from '@scripts';
import { CallScriptActionWithDescription, encodeCallScript, forwardVoteFromTm, forwardVoteFromTmDG, logger } from '@utils';
import { joinVotingDesc, promptCuratedModulesScriptsRoles } from './generators';
import chalk from 'chalk';

const head = chalk.blue.bold;
const bold = chalk.white.bold;

export const curatedModulesManager = async () => {
  // Roles
  logger.log(head('Roles'));
  const moduleScripts = await promptCuratedModulesScriptsRoles();
  logger.log();

  // Voting calls
  const votingCalls: CallScriptActionWithDescription[] = [...moduleScripts];

  // Voting description
  const description = joinVotingDesc(votingCalls);
  logger.log(head('Voting description:'));
  logger.log(description);
  logger.log();

  // Voting start
  if (process.env.USE_DG === '1') {
    await forwardVoteFromTmDG(votingCalls, description);
  } else {
    const voteEvmScript = encodeCallScript(votingCalls);
    const [newVoteCalldata] = votingNewVote(voteEvmScript, description);
    await forwardVoteFromTm(newVoteCalldata);
  }
};
