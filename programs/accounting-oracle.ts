import { program } from '@command';
import { accountingOracleContract } from '@contracts';
import {
  addAccessControlSubCommands,
  addBaseOracleCommands,
  addLogsCommands,
  addOssifiableProxyCommands,
  addParsingCommands,
} from './common';
import { logger } from '@utils';

const oracle = program.command('accounting-oracle').description('interact with accounting oracle contract');
addAccessControlSubCommands(oracle, accountingOracleContract);
addBaseOracleCommands(oracle, accountingOracleContract);
addOssifiableProxyCommands(oracle, accountingOracleContract);
addParsingCommands(oracle, accountingOracleContract);
addLogsCommands(oracle, accountingOracleContract);

oracle
  .command('extra-data-format')
  .description('returns extra data format')
  .action(async () => {
    const format = await accountingOracleContract.EXTRA_DATA_FORMAT_LIST();
    logger.log('Extra data format', format);
  });

oracle
  .command('extra-data-type-stuck')
  .description('returns extra type for stuck validators')
  .action(async () => {
    const format = await accountingOracleContract.EXTRA_DATA_TYPE_STUCK_VALIDATORS();
    logger.log('Type stuck', format);
  });

oracle
  .command('extra-data-type-exited')
  .description('returns extra type for exited validators')
  .action(async () => {
    const format = await accountingOracleContract.EXTRA_DATA_TYPE_EXITED_VALIDATORS();
    logger.log('Type exited', format);
  });
