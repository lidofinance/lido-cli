import { program } from '@command';
import {exitBusOracleContract, norContract} from '@contracts';
import {
  addAccessControlSubCommands,
  addBaseOracleCommands,
  addOssifiableProxyCommands,
  addParsingCommands,
  addPauseUntilSubCommands,
} from './common';

const oracle = program.command('exit-bus-oracle').description('interact with validator exit bus oracle contract');
addAccessControlSubCommands(oracle, exitBusOracleContract);
addBaseOracleCommands(oracle, exitBusOracleContract);
addOssifiableProxyCommands(oracle, exitBusOracleContract);
addParsingCommands(oracle, exitBusOracleContract);
addPauseUntilSubCommands(oracle, exitBusOracleContract);

oracle
  .command('exit-requests')
  .description('returns exit requests')
  .option('-b, --blocks <number>', 'duration in blocks', '7200')
  .action(async (options) => {
    const { blocks } = options;
    const { number: toBlock } = await exitBusOracleContract.runner.provider.getBlock('latest');
    const fromBlock = toBlock - Number(blocks);

    const events = await exitBusOracleContract.queryFilter('ValidatorExitRequest', fromBlock, toBlock);
    const requests = events.map((event) => {
      if ('args' in event) {
        const [stakingModuleId, nodeOperatorId, validatorIndex, validatorPubkey, timestamp] = event.args;
        return { stakingModuleId, nodeOperatorId, validatorIndex, validatorPubkey, timestamp };
      }
    });

    console.log('events', requests);
  });

oracle
    .command('exit-requests-detail')
    .description('returns exit requests with details')
    .option('-b, --blocks <number>', 'duration in blocks', '7200')
    .action(async (options) => {
        const { blocks } = options;
        const { number: toBlock } = await exitBusOracleContract.runner.provider.getBlock('latest');
        const fromBlock = toBlock - Number(blocks);

        const events = await exitBusOracleContract.queryFilter('ValidatorExitRequest', fromBlock, toBlock);
        const requests = await Promise.all(events.map(async (event) => {
        if ('args' in event) {
          const [stakingModuleId, nodeOperatorId, validatorIndex, validatorPubkey, timestamp] = event.args;

          const operatorName = stakingModuleId === 1n ? (await norContract.getNodeOperator(nodeOperatorId, true))?.name ?? 'undefined' : '';

          const timestampDatetime = new Date(Number(timestamp * 1000n)).toISOString();
          return { stakingModuleId, nodeOperatorId, operatorName, validatorIndex, validatorPubkey, timestamp, timestampDatetime };
        }
        }));

        console.log('events', requests);
    });

oracle
  .command('format-list')
  .description('returns exit requests')
  .action(async () => {
    const value = await exitBusOracleContract.DATA_FORMAT_LIST();
    console.log('value', value);
  });
