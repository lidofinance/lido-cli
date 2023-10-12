import chalk from 'chalk';
import { Contract } from 'ethers';
import { stringify } from './stringify';
import { getProvider, getSignerAddress } from './contract';

const title = chalk.gray;
const chain = chalk.green.bold;
const value = chalk.blue.bold;

export const printTx = async (contract: Contract, method: string, args: unknown[] = []) => {
  const provider = getProvider(contract);
  const from = await getSignerAddress(contract);

  const network = await provider.getNetwork();
  const to = await contract.getAddress();

  const parsedArgs = args.map((arg) => stringify(arg));
  const call = `${method}(${parsedArgs})`;
  const data = contract.interface.encodeFunctionData(method, args);

  console.log(title('chain:'), chain(network.name));
  console.log(title(' from:'), value(from));
  console.log(title('   to:'), value(to));
  console.log(title(' call:'), value(call));
  console.log(title(' data:'), value(data));
};
