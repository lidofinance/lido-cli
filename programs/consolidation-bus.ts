import { program } from '@command';
import { consolidationBusContract } from '@contracts';
import { contractCallTxWithConfirm, logger } from '@utils';
import chalk from 'chalk';
import { addAccessControlSubCommands, addLogsCommands, addParsingCommands } from './common';

const title = chalk.white.bold.green;
const grey = chalk.white.grey;

const consolidationBus = program
  .command('consolidation-bus')
  .aliases(['cb'])
  .description('interact with consolidation bus contract');

// Add common sub-commands
addAccessControlSubCommands(consolidationBus, consolidationBusContract);
addParsingCommands(consolidationBus, consolidationBusContract);
addLogsCommands(consolidationBus, consolidationBusContract);

consolidationBus
  .command('set-execution-delay')
  .description('sets the execution delay in seconds between adding and executing a batch')
  .argument('<delay>', 'new execution delay in seconds')
  .action(async (delay) => {
    logger.log();
    logger.log(title('Set Execution Delay'));
    logger.log(grey('New delay:'), delay, 'seconds');
    logger.log();

    await contractCallTxWithConfirm(consolidationBusContract, 'setExecutionDelay', [delay]);
  });

consolidationBus
  .command('get-execution-delay')
  .description('gets the execution delay in seconds')
  .action(async () => {
    const delay = await consolidationBusContract.executionDelay();
    logger.log();
    logger.log(title('Execution Delay'));
    logger.log(grey('Current delay:'), delay.toString(), 'seconds');
    logger.log();
  });
