import { tmContract, votingContract } from '@contracts';
import { sleep } from './sleep';
import { contractCallTx, contractCallTxWithConfirm } from './call-tx';
import { logger } from './logger';
import progress, { SingleBar } from 'cli-progress';
import { provider } from '@providers';

export const forwardVoteFromTm = async (votingCalldata: string) => {
  console.log('>>>>> vfw1');
  const tx = await contractCallTxWithConfirm(tmContract, 'forward', [votingCalldata]);
  if (tx == null) return;
  logger.success('Vote started');
  console.log('>>>>>> vfw2');
  await voteLastVoting();
};

export const voteLastVoting = async () => {
  console.log('>>>>>> v1');
  const votesLength = await votingContract.votesLength({gasLimit: 16_000_000});
  const lastVoteId = Number(votesLength) - 1;

  if (lastVoteId == -1) {
    logger.warn('No votes');
    return;
  }
  console.log('>>>>>> v2');
  const lastVote = await votingContract.getVote(lastVoteId, {gasLimit: 16_000_000});

  if (lastVote.open == false) {
    logger.warn('Vote is not open');
    return;
  }

  if (Number(lastVote.phase) !== 0) {
    logger.warn('Wrong phase');
    return;
  }
  console.log('>>>>>> v3');
  await voteFor(lastVoteId);
  console.log('>>>>>> v4');
  await waitForEnd(lastVoteId);
  console.log('>>>>>> v5');
  await executeVote(lastVoteId);
  console.log('>>>>>> v6');
};

export const voteFor = async (voteId: number) => {
  await contractCallTx(votingContract, 'vote', [voteId, true, false]);
  logger.success('Vote voted');
};

export const voteAgainst = async (voteId: number) => {
  await contractCallTx(votingContract, 'vote', [voteId, false, false]);
  logger.success('Vote voted');
};

export const executeVote = async (voteId: number) => {
  await contractCallTx(votingContract, 'executeVote', [voteId]);
  logger.success('Vote executed');
};

export const waitForEnd = async (voteId: number, progressBar?: SingleBar) => {
  const [vote, voteTime, block] = await Promise.all([
    votingContract.getVote(voteId, {gasLimit: 16_000_000}),
    votingContract.voteTime({gasLimit: 16_000_000}),
    provider.getBlock('latest'),
  ]);

  if (!block) throw new Error('Can not get latest block');

  const voteStart = Number(vote.startDate);
  const voteEnd = voteStart + Number(voteTime);
  const secondsLeft = Math.max(0, voteEnd - block.timestamp);
  const currentPosition = Math.min(block.timestamp - voteStart, Number(voteTime));

  if (!vote.open) {
    progressBar?.update(currentPosition, { secondsLeft });
    progressBar?.stop();
    logger.log('');

    return;
  }

  if (progressBar) {
    progressBar.update(currentPosition, { secondsLeft });
  } else {
    progressBar = new progress.SingleBar(
      { format: `Vote #${voteId} in progress |{bar}| {percentage}% | {secondsLeft}s left` },
      progress.Presets.shades_classic,
    );
    progressBar.start(Number(voteTime), currentPosition, { secondsLeft });
  }

  await sleep(10_000);
  await waitForEnd(voteId, progressBar);
};
