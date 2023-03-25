import { program } from '@command';
import { exitBusOracleContract, norContract } from '@contracts';
import { getLatestBlock } from '@utils';
import {
  addAccessControlSubCommands,
  addBaseOracleCommands,
  addLogsCommands,
  addOssifiableProxyCommands,
  addParsingCommands,
  addPauseUntilSubCommands,
} from './common';
import { getNodeOperators, getNodeOperatorsMapByModule, getStakingModules } from './staking-module';

const oracle = program.command('exit-bus-oracle').description('interact with validator exit bus oracle contract');
addAccessControlSubCommands(oracle, exitBusOracleContract);
addBaseOracleCommands(oracle, exitBusOracleContract);
addOssifiableProxyCommands(oracle, exitBusOracleContract);
addParsingCommands(oracle, exitBusOracleContract);
addPauseUntilSubCommands(oracle, exitBusOracleContract);
addLogsCommands(oracle, exitBusOracleContract);

oracle
  .command('exit-requests')
  .description('returns exit requests')
  .option('-b, --blocks <number>', 'duration in blocks', '7200')
  .action(async (options) => {
    const { blocks } = options;

    const latestBlock = await getLatestBlock();
    const toBlock = latestBlock.number;
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

    const latestBlock = await getLatestBlock();
    const toBlock = latestBlock.number;
    const fromBlock = toBlock - Number(blocks);

    const events = await exitBusOracleContract.queryFilter('ValidatorExitRequest', fromBlock, toBlock);
    const operatorsMap = await getNodeOperatorsMapByModule();

    const requests = await Promise.all(
      events.map(async (event) => {
        if ('args' in event) {
          const stakingModuleId = Number(event.args.stakingModuleId);
          const nodeOperatorId = Number(event.args.nodeOperatorId);
          const validatorIndex = Number(event.args.validatorIndex);
          const timestamp = Number(event.args.timestamp);
          const validatorPubkey = event.args.validatorPubkey;

          const operatorName = operatorsMap[stakingModuleId][nodeOperatorId].name;
          const timestampDatetime = new Date(timestamp * 1000).toISOString();

          return {
            stakingModuleId,
            nodeOperatorId,
            operatorName,
            validatorIndex,
            validatorPubkey,
            timestamp,
            timestampDatetime,
          };
        }
      }),
    );

    console.log(requests);
  });

oracle
  .command('format-list')
  .description('returns exit requests')
  .action(async () => {
    const value = await exitBusOracleContract.DATA_FORMAT_LIST();
    console.log('value', value);
  });

oracle
  .command('last-requested-validator-indices')
  .description('returns last requested validator indices')
  .action(async () => {
    const modules = await getStakingModules();

    modules.forEach(async (module) => {
      const operators = await getNodeOperators(module.stakingModuleAddress);
      const operatorIds = operators.map(({ operatorId }) => operatorId);

      const lastRequestedIndexes = await exitBusOracleContract.getLastRequestedValidatorIndices(module.id, operatorIds);
      const operatorsWithLastRequestedValidators = operators.map((operator, index) => {
        const { operatorId, name } = operator;
        const lastRequestedIndex = Number(lastRequestedIndexes[index]);

        return { operatorId, name, lastRequestedIndex };
      });

      console.log('module', module.id, module.stakingModuleAddress);
      console.table(operatorsWithLastRequestedValidators);
    });
  });
