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
      console.log('tx value', ethValue);

      const tx = { data: calldata, value: ethValue };
      const result = contract.interface.parseTransaction(tx);
      console.log(result);
    });

  command
    .command('parse-error')
    .description('decodes transaction revert reason with ABI')
    .argument('<data>', 'transaction revert reason')
    .action(async (errorData) => {
      const result = contract.interface.parseError(errorData);
      console.log(result);
    });
};
