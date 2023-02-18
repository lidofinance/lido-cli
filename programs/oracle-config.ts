import { toBeHex } from 'ethers';
import { program } from '../command';
import { oracleConfigContract } from '../contracts';
import { addAccessControlSubCommands, addParsingCommands } from './common';

const config = program.command('oracle-config');
addAccessControlSubCommands(config, oracleConfigContract);
addParsingCommands(config, oracleConfigContract);

config
  .command('get')
  .argument('<string>', 'key')
  .action(async (key) => {
    const value = await oracleConfigContract.get(key);
    console.log('value', value);
  });

config
  .command('set')
  .argument('<string>', 'key')
  .argument('<string>', 'value')
  .action(async (key, value) => {
    await oracleConfigContract.set(key, toBeHex(Number(value)));
    console.log('value set');
  });

config
  .command('update')
  .argument('<string>', 'key')
  .argument('<string>', 'value')
  .action(async (key, value) => {
    await oracleConfigContract.update(key, toBeHex(Number(value)));
    console.log('value updated');
  });

config
  .command('unset')
  .argument('<string>', 'key')
  .action(async (key) => {
    await oracleConfigContract.unset(key);
    console.log('value unset');
  });

config.command('known').action(async () => {
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
  ];
  const list = await oracleConfigContract.getList(knownKeys);
  console.log('list', list);
});
