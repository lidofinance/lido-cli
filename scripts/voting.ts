import { votingAddress, votingContract } from '@contracts';
import { encodeCallScript } from '@utils';

export const votingForward = (votingData: string) => {
  const call = {
    to: votingAddress,
    data: votingContract.interface.encodeFunctionData('forward', [votingData]),
  };

  const encoded = encodeCallScript([call]);
  return [encoded, call] as const;
};
