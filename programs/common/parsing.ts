import { Command } from 'commander';
import { Contract } from 'ethers';

export const addParsingCommands = (command: Command, contract: Contract) => {
  command
    .command('decode-calldata')
    .argument('<calldata>')
    .action(async (calldata) => {
      const result = contract.interface.decodeFunctionData(calldata.slice(0, 10), calldata);
      console.log(result);
    });

  command
    .command('parse-error')
    .argument('<data>')
    .action(async (errorData) => {
      const result = contract.interface.parseError(errorData);
      console.log(result);
    });
};
