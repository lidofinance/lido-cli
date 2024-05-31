import { Command } from 'commander';
import { Contract } from 'ethers';
import { logger } from '@utils';

export const addVersionedSubCommands = (command: Command, contract: Contract) => {
  command
    .command('get-contract-version')
    .description('returns contract version')
    .action(async () => {
      const contractVersion = await contract.getContractVersion();
      logger.log('Contract version', contractVersion);
    });
};
