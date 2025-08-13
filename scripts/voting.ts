import { votingAddress, votingContract } from '@contracts';
import { encodeCallScript } from '@utils';

export const votingForward = (votingData: string) => {
  const call = {
    gasLimit: 16_000_000,
    to: votingAddress,
    data: votingContract.interface.encodeFunctionData('forward', [votingData]),
  };

  const encoded = encodeCallScript([call]);
  return [encoded, call] as const;
};

export const votingNewVote = (votingData: string, votingDesc: string = '') => {
  const call = {
    to: votingAddress,
    data: votingContract.interface.encodeFunctionData('newVote(bytes, string)', [votingData, votingDesc]),
    gasLimit: 16_000_000,
  };
 console.log('>>>>>> voting1');
  const encoded = encodeCallScript([call]);
  return [encoded, call] as const;
};
