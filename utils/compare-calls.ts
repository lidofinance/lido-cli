import { Contract } from 'ethers';
import { logger } from './logger';

export type ContractCalls = { method: string; args?: unknown[] };

export const compareContractCalls = async (contracts: Contract[], calls: ContractCalls[]) => {
  const result: unknown[] = [];

  for (const { method, args = [] } of calls) {
    const cols = await Promise.all(
      contracts.map(async (contract) => {
        const key = await contract.getAddress();
        try {
          const value = await contract[method](...args);
          return [key, value];
        } catch (_error) {
          return [key, 'error'];
        }
      }),
    );

    const row: Record<string, string> = { method };
    const [, firstValue] = cols[0];

    cols.forEach(([key, value]) => (row[key] = value));
    const matched = cols.every(([, value]) => value == firstValue);

    result.push({ ...row, matched });
  }

  logger.table(result);
};
