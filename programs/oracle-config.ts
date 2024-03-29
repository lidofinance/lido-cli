import { Result, toBeHex, zeroPadValue } from 'ethers';
import { program } from '@command';
import { oracleConfigContract } from '@contracts';
import { addAccessControlSubCommands, addLogsCommands, addParsingCommands } from './common';
import { logger } from '@utils';

const config = program.command('oracle-config').description('interact with oracle config contract');
addAccessControlSubCommands(config, oracleConfigContract);
addParsingCommands(config, oracleConfigContract);
addLogsCommands(config, oracleConfigContract);

config
  .command('get')
  .description('get value')
  .argument('<key>', 'key')
  .action(async (key) => {
    const value = await oracleConfigContract.get(key);
    logger.log('Value', value);
  });

config
  .command('set')
  .description('set value')
  .argument('<key>', 'key')
  .argument('<value>', 'value')
  .action(async (key, value) => {
    const hexValue = zeroPadValue(toBeHex(Number(value)), 32);
    await oracleConfigContract.set(key, hexValue);
    logger.log('Value set');
  });

config
  .command('update')
  .description('update value')
  .argument('<key>', 'key')
  .argument('<value>', 'value')
  .action(async (key, value) => {
    const hexValue = zeroPadValue(toBeHex(Number(value)), 32);
    await oracleConfigContract.update(key, hexValue);
    logger.log('Value updated');
  });

config
  .command('unset')
  .description('unset value')
  .argument('<key>', 'key')
  .action(async (key) => {
    await oracleConfigContract.unset(key);
    logger.log('Value unset');
  });

config
  .command('known')
  .description('get known values')
  .action(async () => {
    const knownKeys = [
      'NORMALIZED_CL_REWARD_PER_EPOCH',
      'NORMALIZED_CL_REWARD_MISTAKE_RATE_BP',
      'REBASE_CHECK_NEAREST_EPOCH_DISTANCE',
      'REBASE_CHECK_DISTANT_EPOCH_DISTANCE',
      'VALIDATOR_DELAYED_TIMEOUT_IN_SLOTS',
      'VALIDATOR_DELINQUENT_TIMEOUT_IN_SLOTS',
      'PREDICTION_DURATION_IN_SLOTS',
      'FINALIZATION_MAX_NEGATIVE_REBASE_EPOCH_SHIFT',
      'NODE_OPERATOR_NETWORK_PENETRATION_THRESHOLD_BP',
    ];
    const list: Result[] = await oracleConfigContract.getList(knownKeys);

    list.forEach((item, index) => {
      logger.log(knownKeys[index], Number(item));
    });
  });
