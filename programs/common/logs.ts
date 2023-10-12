import { getLatestBlock, getProvider, logger } from '@utils';
import { Command } from 'commander';
import { Contract, EventLog, Filter } from 'ethers';

export const addLogsCommands = (command: Command, contract: Contract) => {
  command
    .command('logs')
    .description('fetches logs')
    .option('-b, --blocks <number>', 'blocks', '7200')
    .option('-e, --event-name <string>', 'event name')
    .action(async (options) => {
      const provider = getProvider(contract);
      const { blocks, eventName } = options;

      const latestBlock = await getLatestBlock();
      const toBlock = latestBlock.number;
      const fromBlock = toBlock - Number(blocks);

      const filter: Filter = {
        address: await contract.getAddress(),
        fromBlock,
        toBlock,
      };

      if (eventName) {
        const event = contract.interface.getEvent(eventName);
        if (!event) throw new Error('Event not found');

        event.topicHash;

        filter.topics = [event.topicHash];
      }

      const logs = await provider.getLogs(filter);

      const parsedLogs = logs.map((log) => {
        try {
          const foundFragment = contract.interface.getEvent(log.topics[0]);
          if (!foundFragment) throw new Error('Event Fragment not found');

          return new EventLog(log, contract.interface, foundFragment);
        } catch (error) {
          return log;
        }
      });

      logger.dir(parsedLogs, { depth: null });
    });
};
