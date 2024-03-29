import { authorizedCall, logger } from '@utils';
import { Command } from 'commander';
import { Contract } from 'ethers';

export const addBaseOracleCommands = (command: Command, contract: Contract) => {
  command
    .command('genesis')
    .description('returns genesis time')
    .action(async () => {
      const genesisTime = await contract.GENESIS_TIME();
      logger.log('Genesis time', genesisTime);
    });

  command
    .command('set-consensus-contract')
    .description('sets consensus contract')
    .argument('<address>', 'consensus contract address')
    .action(async (address) => {
      await authorizedCall(contract, 'setConsensusContract', [address]);
    });

  command.command('processing-state').action(async () => {
    const result = await contract.getProcessingState();
    logger.log('Result', result.toObject());
  });

  command
    .command('seconds-per-slot')
    .description('returns seconds per slot')
    .action(async () => {
      const secondsPerSlot = await contract.SECONDS_PER_SLOT();
      logger.log('Seconds per slots', secondsPerSlot);
    });

  command
    .command('consensus-version')
    .description('returns consensus version')
    .action(async () => {
      const version = await contract.getConsensusVersion();
      logger.log('Version', version);
    });

  command
    .command('set-consensus-version')
    .description('sets consensus version')
    .argument('<version>', 'consensus version')
    .action(async (version) => {
      await authorizedCall(contract, 'setConsensusVersion', [version]);
    });

  command
    .command('consensus-contract')
    .description('returns consensus contract')
    .action(async () => {
      const consensusContract = await contract.getConsensusContract();
      logger.log('Consensus contract', consensusContract);
    });

  command
    .command('consensus-report')
    .description('returns consensus report')
    .action(async () => {
      const consensusReport = await contract.getConsensusReport();
      logger.log('Consensus report', consensusReport);
    });

  command
    .command('last-processing-ref-slot')
    .description('returns last processing ref slot')
    .action(async () => {
      const refSlot = await contract.getLastProcessingRefSlot();
      logger.log('Last processing ref slot', refSlot);
    });
};
