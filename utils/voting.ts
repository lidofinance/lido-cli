import { tmContract, votingContract } from '@contracts';
import { sleep } from './sleep';
import { contractCallTx, contractCallTxWithConfirm } from './call-tx';
import { getSignerAddress } from './contract';
import { logger } from './logger';
import progress, { SingleBar } from 'cli-progress';
import { provider } from '@providers';

export const forwardVoteFromTm = async (votingCalldata: string) => {
  const tx = await contractCallTxWithConfirm(tmContract, 'forward', [votingCalldata]);
  if (tx == null) return;
  logger.success('Vote started');

  await voteLastVoting();
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
  await executeVote(lastVoteId);
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
    votingContract.getVote(voteId),
    votingContract.voteTime(),
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

export const checkTmCanForward = async () => {
  const signerAddress = await getSignerAddress(tmContract);
  const canForward = await tmContract.canForward(signerAddress, '0x');

  if (!canForward) {
    logger.warn('TM can not forward, check your LDO balance');
    return false;
  }

  return true;
};
