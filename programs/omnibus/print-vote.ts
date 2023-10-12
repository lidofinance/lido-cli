import { VoteTxData } from './prompt-voting';
import { logger } from '@utils';

export const printVoteTxData = async (voteTxData: VoteTxData) => {
  const { voteEvmScript, newVoteCalldata, description } = voteTxData;
  logger.success('\nVote calls evmScript:');
  logger.log(voteEvmScript);

  logger.success('\nVote description (meta):');
  logger.log(description);

  logger.success('\nnewVote() calldata:');
  logger.log(newVoteCalldata);

  logger.log('');
};
