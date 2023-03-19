import { Command } from 'commander';
import { Contract, EventLog } from 'ethers';
import { Filter } from 'ethers/types/providers';

export const addLogsCommands = (command: Command, contract: Contract) => {
  command
    .command('logs')
    .description('fetches logs')
    .option('-b, --blocks <number>', 'blocks', '7200')
    .option('-e, --event-name <string>', 'event name')
    .action(async (options) => {
      const { blocks, eventName } = options;
      const { provider } = contract.runner;
      const { number: toBlock } = await provider.getBlock('latest');
      const fromBlock = toBlock - Number(blocks);

      const filter: Filter = {
        address: await contract.getAddress(),
        fromBlock,
        toBlock,
      };

      if (eventName) {
        const event = contract.interface.getEvent(eventName);
        event.topicHash;

        filter.topics = [event.topicHash];
      }

      const logs = await provider.getLogs(filter);

      const parsedLogs = logs.map((log) => {
        const foundFragment = contract.interface.getEvent(log.topics[0]);
        return new EventLog(log, contract.interface, foundFragment);
      });

      console.log(parsedLogs);
    });
};
