import { tmContract, votingContract } from '@contracts';
import { sleep } from './sleep';
import { contractCallTx, contractCallTxWithConfirm } from './call-tx';

export const forwardVoteFromTm = async (votingCalldata: string) => {
  const tx = await contractCallTxWithConfirm(tmContract, 'forward', [votingCalldata]);
  if (tx == null) return;
  console.log('vote started');

  await voteLastVoting();
};

export const voteLastVoting = async () => {
  const votesLength = await votingContract.votesLength();
  const lastVoteId = Number(votesLength) - 1;

  if (lastVoteId == -1) {
    console.warn('no votes');
    return;
  }

  const lastVote = await votingContract.getVote(lastVoteId);

  if (lastVote.open == false) {
    console.warn('vote is not open');
    return;
  }

  if (Number(lastVote.phase) !== 0) {
    console.warn('wrong phase');
    return;
  }

  await voteFor(lastVoteId);
  await waitForEnd(lastVoteId);
  await executeVote(lastVoteId);
};

export const voteFor = async (voteId: number) => {
  await contractCallTx(votingContract, 'vote', [voteId, true, false]);
  console.log('vote voted');
};

export const voteAgainst = async (voteId: number) => {
  await contractCallTx(votingContract, 'vote', [voteId, false, false]);
  console.log('vote voted');
};

export const executeVote = async (voteId: number) => {
  await contractCallTx(votingContract, 'executeVote', [voteId]);
  console.log('vote executed');
};

export const waitForEnd = async (voteId: number) => {
  await sleep(10_000);

  const vote = await votingContract.getVote(voteId);

  if (vote.open == true) {
    console.log('vote checked, still active');
    await waitForEnd(voteId);
  }
};
