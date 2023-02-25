import { hexlify, toBeHex, zeroPadValue } from 'ethers';
import { program } from '@command';
import { oracleConfigContract } from '@contracts';
import { addAccessControlSubCommands, addParsingCommands } from './common';

const config = program.command('oracle-config').description('interact with oracle config contract');
addAccessControlSubCommands(config, oracleConfigContract);
addParsingCommands(config, oracleConfigContract);

config
  .command('get')
  .description('get value')
  .argument('<key>', 'key')
  .action(async (key) => {
    const value = await oracleConfigContract.get(key);
    console.log('value', value);
  });

config
  .command('set')
  .description('set value')
  .argument('<key>', 'key')
  .argument('<value>', 'value')
  .action(async (key, value) => {
    const hexValue = zeroPadValue(toBeHex(Number(value)), 32);
    await oracleConfigContract.set(key, hexValue);
    console.log('value set');
  });

config
  .command('update')
  .description('update value')
  .argument('<key>', 'key')
  .argument('<value>', 'value')
  .action(async (key, value) => {
    const hexValue = zeroPadValue(toBeHex(Number(value)), 32);
    await oracleConfigContract.update(key, hexValue);
    console.log('value updated');
  });

config
  .command('unset')
  .description('unset value')
  .argument('<key>', 'key')
  .action(async (key) => {
    await oracleConfigContract.unset(key);
    console.log('value unset');
  });

config
  .command('known')
  .description('get known values')
  .action(async () => {
    const knownKeys = [
      'NORMALIZED_CL_PER_EPOCH',
      'NORMALIZED_CL_MISTAKE_BP',
      'REBASE_CHECK_NEAREST_EPOCH_DISTANCE',
      'REBASE_CHECK_FAR_EPOCH_DISTANCE',
      'VALIDATOR_DELAYED_TIMEOUT_IN_SLOTS',
      'VALIDATOR_DELINQUENT_TIMEOUT_IN_SLOTS',
      'PREDICTION_DURATION_IN_SLOTS',
      'PREDICTION_PERCENTILE_EL_REWARDS_BP',
      'PREDICTION_PERCENTILE_CL_REWARDS_BP',
      'FINALIZATION_DEFAULT_SHIFT',
      'FINALIZATION_MAX_NEGATIVE_REBASE_SHIFT',
    ];
    const list = await oracleConfigContract.getList(knownKeys);

    list.forEach((item, index) => {
      console.log(knownKeys[index], Number(item));
    });
  });
