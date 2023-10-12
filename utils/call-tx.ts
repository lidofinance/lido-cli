import chalk from 'chalk';
import { Contract, ContractTransaction, ContractTransactionResponse } from 'ethers';
import { confirmTx } from './confirm-tx';
import { printTx } from './print-tx';

export const contractCallTxWithConfirm = async (contract: Contract, method: string, args: unknown[]) => {
  await printTx(contract, method, args);
  const confirmed = await confirmTx();
  if (!confirmed) return null;

  return await contractCallTx(contract, method, args);
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
  console.log('tx sent', chalk.green(tx.hash));

  console.log('waiting for tx to be mined...');
  const receipt = await tx.wait();

  if (!receipt) {
    throw new Error('Transaction receipt is not available');
  }

  try {
    console.log('tx logs:');

    receipt.logs.forEach((log) => {
      const parsedLog = contract.interface.parseLog({
        data: log.data,
        topics: log.topics as string[],
      });
      console.dir(parsedLog, { depth: null });
    });
  } catch (error) {
    console.log('failed to parse logs');
  }

  return [tx, receipt] as const;
};
