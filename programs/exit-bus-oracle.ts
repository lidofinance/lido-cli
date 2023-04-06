import { program } from '@command';
import { exitBusOracleContract } from '@contracts';
import { exportToCSV, groupByModuleId } from '@utils';

import {
  addAccessControlSubCommands,
  addBaseOracleCommands,
  addLogsCommands,
  addOssifiableProxyCommands,
  addParsingCommands,
  addPauseUntilSubCommands,
} from './common';
import {
  fetchLastExitRequests,
  fetchLastExitRequestsDetailed,
  formatExitRequests,
  formatExitRequestsDetailed,
  groupRequestsByOperator
} from './exit-bus';
import { getNodeOperators, getStakingModules } from './staking-module';

const oracle = program.command('exit-bus-oracle').description('interact with validator exit bus oracle contract');
addAccessControlSubCommands(oracle, exitBusOracleContract);
addBaseOracleCommands(oracle, exitBusOracleContract);
addOssifiableProxyCommands(oracle, exitBusOracleContract);
addParsingCommands(oracle, exitBusOracleContract);
addPauseUntilSubCommands(oracle, exitBusOracleContract);
addLogsCommands(oracle, exitBusOracleContract);

oracle
  .command('exit-requests')
  .description('returns exit requests with details')
  .option('-b, --blocks <number>', 'duration in blocks', '7200')
  .action(async (options) => {
    const { blocks } = options;
    const requests = await fetchLastExitRequests(blocks);
    const groupedRequests = groupByModuleId(requests);

    Object.entries(groupedRequests).forEach(([moduleId, requests]) => {
      const formattedRequests = formatExitRequests(requests);
      console.log('module', moduleId);
      console.table(formattedRequests);
    });
  });

oracle
  .command('exit-requests-detailed')
  .description('returns exit requests with details')
  .option('-b, --blocks <number>', 'duration in blocks', '7200')
  .option('-a, --agg', 'aggregated per operator')
  .action(async (options) => {
    const { blocks, agg } = options;
    const requests = await fetchLastExitRequestsDetailed(blocks);
    const groupedRequests = groupByModuleId(requests);

    Object.entries(groupedRequests).forEach(([moduleId, requests]) => {
      const formattedRequests = formatExitRequestsDetailed(requests);

      console.log('module', moduleId);

      if (agg) {
        const aggregatedRequestsByOperator = groupRequestsByOperator(formattedRequests);
        console.table(aggregatedRequestsByOperator);
      } else {
        console.table(formattedRequests);
      }

    });
  });

oracle
  .command('exit-requests-detailed-csv')
  .description('returns exit requests with details')
  .option('-b, --blocks <number>', 'duration in blocks', '7200')
  .action(async (options) => {
    const { blocks } = options;
    const requests = await fetchLastExitRequestsDetailed(blocks);
    const groupedRequests = groupByModuleId(requests);

    await Promise.all(
      Object.entries(groupedRequests).map(async ([moduleId, requests]) => {
        const formattedRequests = formatExitRequestsDetailed(requests);
        const fileName = `exit-requests-module-${moduleId}.csv`;
        await exportToCSV(formattedRequests, fileName);
      }),
    );
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
