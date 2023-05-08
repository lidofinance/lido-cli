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

export const parseBlock = (block: string) => {
  const isNumeric = (value: string) => {
    return /^-?\d+$/.test(value);
  }

  if (isNumeric(block)) {
    return parseInt(block, 10);
  }

  return block;
};
