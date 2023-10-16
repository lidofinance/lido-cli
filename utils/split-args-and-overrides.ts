import { Contract, ContractTransaction } from 'ethers';

export const splitArgsAndOverrides = (contract: Contract, method: string, argsWithOverrides: unknown[]) => {
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

  return { args, overrides };
};
