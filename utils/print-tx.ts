import chalk from 'chalk';
import { Contract } from 'ethers';
import { stringify } from './stringify';
import { getProvider, getSignerAddress } from './contract';
import { logger } from './logger';

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

  logger.log(title('Chain:'), chain(network.name));
  logger.log(title(' From:'), value(from));
  logger.log(title('   To:'), value(to));
  logger.log(title(' Call:'), value(call));
  logger.log(title(' Data:'), value(data));
};
