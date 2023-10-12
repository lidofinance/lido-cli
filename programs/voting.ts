import { program } from '@command';
import { votingContract } from '@contracts';
import { executeVote, logger, voteAgainst, voteFor } from '@utils';
import { addLogsCommands, addParsingCommands } from './common';

const voting = program.command('voting').description('interact with voting contract');
addParsingCommands(voting, votingContract);
addLogsCommands(voting, votingContract);

voting
  .command('get-vote')
  .description('returns vote by id')
  .argument('<vote-id>', 'vote id')
  .action(async (voteId) => {
    const vote = await votingContract.getVote(voteId);
    logger.log('Vote', vote.toObject());
  });

voting
  .command('votes')
  .description('returns votes length')
  .action(async () => {
    const votes = await votingContract.votesLength();
    logger.log('Votes', Number(votes));
  });

voting
  .command('new-vote')
  .description('creates new vote')
  .option('-s, --script <string>', 'execution script', '')
  .option('-m, --meta <string>', 'meta data', '')
  .action(async (options) => {
    const { script, meta } = options;
    const voteId = await votingContract.newVote(script, meta);
    logger.log('Vote id', Number(voteId));
  });

voting
  .command('vote')
  .description('votes for or against vote')
  .argument('<vote-id>', 'vote id')
  .option('-s, --support <number>', 'support 1 or 0', '1')
  .action(async (voteId, options) => {
    const { support } = options;

    if (Number(support) == 1) {
      await voteFor(voteId);
    } else {
      await voteAgainst(voteId);
    }
    logger.log('Voted');
  });

voting
  .command('execute')
  .description('executes vote')
  .argument('<vote-id>', 'vote id')
  .action(async (voteId) => {
    await executeVote(voteId);
    logger.log('Executed');
  });
