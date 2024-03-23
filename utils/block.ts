import { provider } from '@providers';
import { BlockTag } from 'ethers';

export const getLatestBlock = async () => {
  const block = await provider.getBlock('latest');
  if (!block) throw new Error('Cannot get the latest block');

  return block;
};

export const getBlock = async (blockTag: BlockTag) => {
  const block = await provider.getBlock(blockTag);
  if (!block) throw new Error('Cannot fetch a block by blockTag');

  return block;
};

export const getLatestBlockRange = async (limit: number): Promise<[number, number]> => {
  const latestBlock = await getLatestBlock();
  const toBlock = latestBlock.number;
  const fromBlock = Math.max(toBlock - Number(limit), 0);

  return [fromBlock, toBlock];
};
