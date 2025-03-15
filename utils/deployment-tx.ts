import { provider } from '@providers';
import { logger } from './logger';
import { getCreateAddress } from 'ethers';

export const findDeploymentTransaction = async (contractAddress: string) => {
  logger.log('Finding deployment tx for contract:', contractAddress);

  let startBlock = 0;
  let endBlock = await provider.getBlockNumber();

  logger.log('Starting binary search between blocks:', startBlock, 'and', endBlock);

  let deploymentBlock = null;

  // Binary search through blocks
  while (startBlock <= endBlock) {
    const midBlock = Math.floor((startBlock + endBlock) / 2);

    logger.log('Checking block:', midBlock);

    const code = await provider.getCode(contractAddress, midBlock);
    if (code !== '0x') {
      // If code appears, this is potentially the deployment block
      deploymentBlock = midBlock;
      endBlock = midBlock - 1; // Search in the left half
    } else {
      startBlock = midBlock + 1; // Search in the right half
    }
  }

  if (deploymentBlock === null) {
    throw new Error('Deployment block not found');
  }

  logger.log('Contract code found in block:', deploymentBlock);

  // Extract transactions from the deployment block
  const block = await provider.getBlock(deploymentBlock, true);

  if (!block) {
    throw new Error('Deployment block not found');
  }

  const filteredTransactions = block.prefetchedTransactions.filter(
    (tx) => tx.to === null && getCreateAddress(tx).toLowerCase() === contractAddress.toLowerCase(),
  );

  const deploymentTx = filteredTransactions[0];

  if (!deploymentTx) {
    throw new Error('Deployment transaction not found in block');
  }

  logger.log('Deployment transaction found in block:', deploymentBlock);
  logger.log('Deployment transaction hash:', deploymentTx.hash);

  return deploymentTx;
};
