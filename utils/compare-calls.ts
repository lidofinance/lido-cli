import { Contract } from 'ethers';

export type ContractCalls = { method: string; args?: any[] };

export const compareContractCalls = async (contracts: Contract[], calls: ContractCalls[]) => {
  const result = [];

  for (const { method, args = [] } of calls) {
    const cols = await Promise.all(
      contracts.map(async (contract) => {
        const value = await contract[method](...args);
        const key = await contract.getAddress();

        return [key, value];
      }),
    );

    const row = { method };
    const [_firstKey, firstValue] = cols[0];

    cols.forEach(([key, value]) => (row[key] = value));
    const matched = cols.every(([_key, value]) => value == firstValue);

    result.push({ ...row, matched });
  }

  console.table(result);
};
