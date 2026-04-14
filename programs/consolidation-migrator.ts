import { program } from '@command';
import { consolidationMigratorContract } from '@contracts';
import { wallet } from '@providers';
import { contractCallTxWithConfirm, logger } from '@utils';
import chalk from 'chalk';
import { addAccessControlSubCommands, addLogsCommands, addParsingCommands, addPauseUntilSubCommands } from './common';

const title = chalk.white.bold.green;
const grey = chalk.white.grey;

const consolidationMigrator = program
  .command('consolidation-migrator')
  .aliases(['cm'])
  .description('interact with consolidation migrator contract');

// Add common sub-commands
addAccessControlSubCommands(consolidationMigrator, consolidationMigratorContract);
addParsingCommands(consolidationMigrator, consolidationMigratorContract);
addPauseUntilSubCommands(consolidationMigrator, consolidationMigratorContract);
addLogsCommands(consolidationMigrator, consolidationMigratorContract);

consolidationMigrator
  .command('allow-pair')
  .aliases([])
  .description('allow pair to consolidate')
  .argument('<source-operator-id>', 'ID of the source operator')
  .argument('<target-operator-id>', 'ID of the target operator')
  .argument('[submitter]', 'address authorized to submit consolidation batches', wallet.address)
  .action(async (sourceOperatorId, targetOperatorId, submitter) => {
    logger.log();
    logger.log(title('Allow Consolidation Pair'));
    logger.log(grey('Source Operator ID:'), sourceOperatorId);
    logger.log(grey('Target Operator ID:'), targetOperatorId);
    logger.log(grey('Submitter:'), submitter);
    logger.log();

    await contractCallTxWithConfirm(consolidationMigratorContract, 'allowPair', [
      sourceOperatorId,
      targetOperatorId,
      submitter,
    ]);
  });
