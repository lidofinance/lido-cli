import { tmContract } from '@contracts';
import { green } from 'chalk';
import { printTx } from 'utils';
import { VoteTxData } from './prompt-voting';

export const printVoteTxData = async (voteTxData: VoteTxData) => {
  const { voteEvmScript, newVoteCalldata, description } = voteTxData;
  console.log('');
  console.log(green('vote calls evmScript:'));
  console.log(voteEvmScript);

  console.log('');
  console.log(green('vote description (meta):'));
  console.log(description);

  console.log('');
  console.log(green('newVote() calldata:'));
  console.log(newVoteCalldata);

  console.log('');

  await printTx(tmContract, 'forward', [newVoteCalldata]);
};
