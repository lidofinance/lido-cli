import { provider } from '@providers';
import { Contract, FunctionFragment } from 'ethers';
import stringArgv from 'string-argv';

export type ParsedMethodCall = {
  address: string;
  method: string;
  methodName: string;
  args: string[];
  contract: Contract;
};

export const parseMethodCall = (methodCall: string) => {
  const [address, method, ...args] = stringArgv(methodCall);

  return { address, method, args };
};

export const parseMethodCallToContract = (methodCall: string): ParsedMethodCall => {
  const [address, method, ...rawArgs] = stringArgv(methodCall.trim());

  const args = rawArgs.map((arg) => {
    if (arg.startsWith('[') && arg.endsWith(']')) {
      return JSON.parse(arg);
    }

    return arg;
  });

  console.log(args);

  if (!method) {
    throw new Error(`Method name is empty`);
  }

  const abi = [`function ${method}`];
  const contract = new Contract(address, abi, provider);
  const fragment = contract.interface.fragments[0] as FunctionFragment;

  if (!fragment?.name) {
    throw new Error(`Could not parse function signature`);
  }

  const methodName = fragment.name;

  return { address, method, methodName, args, contract };
};
