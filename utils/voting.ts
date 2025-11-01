import { tmContract, votingContract } from '@contracts';
import { contractCallTx, contractCallTxWithConfirm } from './call-tx';
import { logger } from './logger';
import { provider } from '@providers';
import { waitWithProgressBar } from './progress-bar';

export const forwardVoteFromTm = async (votingCalldata: string) => {
  const tx = await contractCallTxWithConfirm(tmContract, 'forward', [votingCalldata]);
  if (tx == null) return;

  logger.success('Vote started');

  return await voteLastVoting();
};

export const voteLastVoting = async () => {
  const votesLength = await votingContract.votesLength();
  const lastVoteId = Number(votesLength) - 1;

  if (lastVoteId == -1) {
    logger.warn('No votes');
    return;
  }

  const lastVote = await votingContract.getVote(lastVoteId);

  if (lastVote.open == false) {
    logger.warn('Vote is not open');
    return;
  }

  if (Number(lastVote.phase) !== 0) {
    logger.warn('Wrong phase');
    return;
  }

  await voteFor(lastVoteId);
  await waitForEnd(lastVoteId);

  return await executeVote(lastVoteId);
};

export const voteFor = async (voteId: number) => {
  const result = await contractCallTx(votingContract, 'vote', [voteId, true, false]);
  logger.success('Vote voted');
  return result;
};

export const voteAgainst = async (voteId: number) => {
  const result = await contractCallTx(votingContract, 'vote', [voteId, false, false]);
  logger.success('Vote voted');
  return result;
};

export const executeVote = async (voteId: number) => {
  const result = await contractCallTx(votingContract, 'executeVote', [voteId]);
  logger.success('Vote executed');
  return result;
};

export const waitForEnd = async (voteId: number) => {
  const [vote, voteTimeBig] = await Promise.all([votingContract.getVote(voteId), votingContract.voteTime()]);
  const voteTime = Number(voteTimeBig);
  const voteStart = Number(vote.startDate);
  const voteEnd = voteStart + voteTime + 1;

  await waitWithProgressBar(`Vote #${voteId} in progress`, async () => {
    const latestBlock = await provider.getBlock('latest');
    const latestTimestamp = Number(latestBlock?.timestamp);

    if (!latestBlock) throw new Error('Can not get latest block');

    return {
      total: voteTime,
      currentPosition: Math.min(latestTimestamp - voteStart, voteTime),
      secondsLeft: Math.max(0, voteEnd - latestTimestamp),
    };
  });
};
