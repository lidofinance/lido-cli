import { logger } from '@utils';
import { Command } from 'commander';
import { Contract, parseEther } from 'ethers';

export const addParsingCommands = (command: Command, contract: Contract) => {
  command
    .command('parse-tx')
    .description('decodes transaction calldata with ABI')
    .argument('<calldata>', 'transaction calldata')
    .option('-v, --value <string>', 'transaction value', '0')
    .action(async (calldata, options) => {
      const { value } = options;

      const ethValue = parseEther(value);
      logger.log('Tx value', ethValue);

      const tx = { data: calldata, value: ethValue };
      const result = contract.interface.parseTransaction(tx);
      logger.log(result);
    });

  command
    .command('parse-error')
    .description('decodes transaction revert reason with ABI')
    .argument('<reason>', 'transaction revert reason')
    .action(async (errorData) => {
      const result = contract.interface.parseError(errorData);
      logger.log(result);
    });

  command
    .command('parse-method')
    .description('get method by hash')
    .argument('<method-hash>', 'method hash')
    .action(async (method) => {
      const result = contract.interface.getFunction(method);
      logger.log(result);
    });
};
