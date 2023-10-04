import chalk from 'chalk';
import { AbstractSigner, Contract } from 'ethers';
import { stringify } from './stringify';

const title = chalk.gray;
const value = chalk.blue.bold;

export const printTx = async (contract: Contract, method: string, args: unknown[] = []) => {
  const provider = contract.runner?.provider;

  if (!provider) {
    throw new Error('Provider is not set');
  }

  if (!(contract.runner instanceof AbstractSigner)) {
    throw new Error('Runner is not a signer');
  }

  const signer = contract.runner;
  const from = await signer.getAddress();

  const network = await provider.getNetwork();
  const to = await contract.getAddress();

  const parsedArgs = args.map((arg) => stringify(arg));
  const call = `${method}(${parsedArgs})`;
  const data = contract.interface.encodeFunctionData(method, args);

  console.log(title('chain:'), value(network.name));
  console.log(title(' from:'), value(from));
  console.log(title('   to:'), value(to));
  console.log(title(' call:'), value(call));
  console.log(title(' data:'), value(data));
};
