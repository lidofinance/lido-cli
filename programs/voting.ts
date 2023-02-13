import { formatEther } from 'ethers';
import { program } from '../command';
import { votingContract } from '../contracts';
import { addParsingCommands } from './common';

const voting = program.command('voting');
addParsingCommands(voting, votingContract);

voting
  .command('get-vote')
  .argument('<number>', 'vote id')
  .action(async (voteId) => {
    const vote = await votingContract.getVote(voteId);

    const { open, executed, startDate, snapshotBlock, supportRequired } = vote;
    const { minAcceptQuorum, yea, nay, script, phase } = vote;

    console.log('vote', {
      open,
      executed,
      phase,
      startDate,
      snapshotBlock,
      supportRequired: formatEther(supportRequired),
      minAcceptQuorum: formatEther(minAcceptQuorum),
      yea: formatEther(yea),
      nay: formatEther(nay),
      script,
    });
  });

voting.command('votes').action(async () => {
  const votes = await votingContract.votesLength();
  console.log('votes', Number(votes));
});

voting
  .command('new-vote')
  .option('-s, --script <string>', 'execution script', '')
  .option('-m, --meta <string>', 'meta data', '')
  .action(async (options) => {
    const { script, meta } = options;
    const voteId = await votingContract.newVote(script, meta);
    console.log('vote id', Number(voteId));
  });

voting
  .command('vote')
  .argument('<number>', 'vote id')
  .option('-s, --support <number>', 'support 1 or 0', '1')
  .action(async (voteId, options) => {
    const { support } = options;
    await votingContract.vote(Number(voteId), !!Number(support), false);
  });

voting
  .command('execute')
  .argument('<number>', 'vote id')
  .action(async (voteId) => {
    await votingContract.executeVote(Number(voteId));
  });
