import { Contract, ContractTransactionResponse } from 'ethers';
import { confirmTx } from './confirm-tx';
import { printTxToContract } from './print-tx';
import { logger } from './logger';
import { splitArgsAndOverrides } from './split-args-and-overrides';
import { throwIfCanNotForward } from './token-manager';
import { getAllAbi } from './abi';
import { formatLog } from './format-log';

export const contractCallTxWithConfirm = async (contract: Contract, method: string, args: unknown[]) => {
  await printTxToContract(contract, method, args);
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
    logger.error(`Failed to call ${method} on ${contractAddress}`);
    throwIfCanNotForward(error);
    throw error;
  }
};

export const populateGasLimit = async (contract: Contract, method: string, argsWithOverrides: unknown[]) => {
  const { args, overrides } = splitArgsAndOverrides(contract, method, argsWithOverrides);

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
    const allABi = getAllAbi();
    const ifaces = [contract.interface, ...allABi.map(({ iface }) => iface)]; // Include the called contract itself at first position to prioritize its events

    logger.log('Tx logs:');

    receipt.logs.forEach((log) => {
      for (let i = 0; i < ifaces.length; i++) {
        const parsedLog = ifaces[i].parseLog({
          data: log.data,
          topics: log.topics as string[],
        });

        if (parsedLog) {
          logger.dir(formatLog(parsedLog), { depth: null });
          return;
        }
      }

      logger.log('Unknown log:', log);
    });
  } catch (error) {
    logger.error('Failed to parse logs', error);
  }

  return [tx, receipt] as const;
};
