import { provider } from '@provider';

export const getLatestBlock = async () => {
  const block = await provider.getBlock('latest');
  if (!block) throw new Error('Cannot get the latest block');

  return block;
};
