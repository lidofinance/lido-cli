import { ContractTransactionResponse } from 'ethers';
import { tmContract, votingContract } from '@contracts';
import { sleep } from './sleep';

export const forwardVoteFromTm = async (votingCalldata: string) => {
  const tx: ContractTransactionResponse = await tmContract.forward(votingCalldata);
  console.log('forward tx sent', tx.hash);

  await tx.wait();
  console.log('vote started');

  await voteLastVoting();
};

export const voteLastVoting = async () => {
  const votesLength = await votingContract.votesLength();
  const lastVoteId = Number(votesLength) - 1;

  if (lastVoteId == -1) {
    console.log('no votes');
    return;
  }

  const lastVote = await votingContract.getVote(lastVoteId);

  if (lastVote.open == false) {
    console.log('vote is not open');
    return;
  }

  if (Number(lastVote.phase) !== 0) {
    console.log('wrong phase');
    return;
  }

  await voteFor(lastVoteId);
  await waitForEnd(lastVoteId);
  await executeVote(lastVoteId);
};

export const voteFor = async (voteId: number) => {
  const tx: ContractTransactionResponse = await votingContract.vote(voteId, true, false);
  console.log('vote tx sent', tx.hash);

  await tx.wait();
  console.log('vote voted');

  return tx;
};

export const voteAgainst = async (voteId: number) => {
  const tx: ContractTransactionResponse = await votingContract.vote(voteId, false, false);
  console.log('vote tx sent', tx.hash);

  await tx.wait();
  console.log('vote voted');

  return tx;
};

export const executeVote = async (voteId: number) => {
  const tx: ContractTransactionResponse = await votingContract.executeVote(voteId);
  console.log('executed tx sent', tx.hash);

  await tx.wait();
  console.log('executed');

  return tx;
};

export const waitForEnd = async (voteId: number) => {
  await sleep(10_000);

  const vote = await votingContract.getVote(voteId);

  if (vote.open == true) {
    console.log('vote checked, still active');
    await waitForEnd(voteId);
  }
};
