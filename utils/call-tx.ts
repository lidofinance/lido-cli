import { Contract, ContractTransaction, ContractTransactionResponse } from 'ethers';
import { confirmTx } from './confirm-tx';
import { printTx } from './print-tx';
import { logger } from './logger';

export const contractCallTxWithConfirm = async (contract: Contract, method: string, args: unknown[]) => {
  await printTx(contract, method, args);
  await contractStaticCallTx(contract, method, args);

  const confirmed = await confirmTx();
  if (!confirmed) return null;

  return await contractCallTx(contract, method, args);
};

export const contractStaticCallTx = async (contract: Contract, method: string, args: unknown[]) => {
  const contractAddress = await contract.getAddress();

  try {
    const result = await contract[method].staticCall(...args);
    logger.success(`Successfully called ${method} on ${contractAddress}. Result:`, result);
  } catch (error) {
    logger.error(`Failed to call ${method} on ${contractAddress}. Error:`, error);
  }
};

export const populateGasLimit = async (contract: Contract, method: string, argsWithOverrides: unknown[]) => {
  const fragment = contract.interface.getFunction(method, argsWithOverrides);

  if (!fragment) {
    throw new Error(`Method ${method} not found`);
  }

  const args = [...argsWithOverrides];

  // If an overrides was passed in, copy it
  let overrides: Omit<ContractTransaction, 'data' | 'to'> = {};
  if (fragment.inputs.length + 1 === args.length) {
    overrides = { ...(args.pop() as typeof overrides) };
  }

  if (!overrides.gasLimit) {
    const gasLimit = await contract[method].estimateGas(...args, overrides);
    overrides.gasLimit = (gasLimit * 120n) / 100n;
  }

  return [...args, overrides];
};

export const contractCallTx = async (contract: Contract, method: string, args: unknown[]) => {
  const argsWithGasLimit = await populateGasLimit(contract, method, args);
  const tx: ContractTransactionResponse = await contract[method](...argsWithGasLimit);
  logger.success('Tx sent', tx.hash);

  logger.log('Waiting for tx to be mined...');
  const receipt = await tx.wait();

  if (!receipt) {
    throw new Error('Transaction receipt is not available');
  }

  try {
    logger.log('Tx logs:');

    receipt.logs.forEach((log) => {
      const parsedLog = contract.interface.parseLog({
        data: log.data,
        topics: log.topics as string[],
      });

      logger.dir(parsedLog, { depth: null });
    });
  } catch (error) {
    logger.error('Failed to parse logs', error);
  }

  return [tx, receipt] as const;
};
