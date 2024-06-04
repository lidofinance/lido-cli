import { program } from '@command';
import { exitBusOracleContract } from '@contracts';
import {
  FAR_FUTURE_EPOCH,
  fetchAllLidoKeys,
  fetchAllValidators,
  fetchBlock,
  KAPIKey,
  ValidatorContainer,
} from '@providers';
import { exportToCSV, getValidatorsMap, groupByModuleId, logger } from '@utils';

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
  groupRequestsByOperator,
} from './exit-bus';
import { getNodeOperators, getStakingModules } from './staking-module';
import { addVersionedSubCommands } from './common/versioned';

export type LidoValidator = {
  validator: ValidatorContainer;
  signingKey: KAPIKey;
};

const oracle = program
  .command('exit-bus-oracle')
  .aliases(['vebo'])
  .description('interact with validator exit bus oracle contract');
addAccessControlSubCommands(oracle, exitBusOracleContract);
addBaseOracleCommands(oracle, exitBusOracleContract);
addOssifiableProxyCommands(oracle, exitBusOracleContract);
addParsingCommands(oracle, exitBusOracleContract);
addPauseUntilSubCommands(oracle, exitBusOracleContract);
addLogsCommands(oracle, exitBusOracleContract);
addVersionedSubCommands(oracle, exitBusOracleContract);

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
      logger.log('Module', moduleId);
      logger.table(formattedRequests);
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

      logger.log('Module', moduleId);

      if (agg) {
        const aggregatedRequestsByOperator = groupRequestsByOperator(formattedRequests);
        logger.table(aggregatedRequestsByOperator);
      } else {
        logger.table(formattedRequests);
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
    logger.log('Value', value);
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

      logger.log('Module', module.id, module.stakingModuleAddress);
      logger.table(operatorsWithLastRequestedValidators);
    });
  });

oracle
  .command('unsettled-requests')
  .description('returns unsettled exit requests')
  .action(async () => {
    // fetch latest block on CL
    const block = await fetchBlock('head');
    const slot = block.message.slot;

    // fetch all Lido keys
    const lidoLeys = await fetchAllLidoKeys();

    // fetch validator from CL
    const validators = await fetchAllValidators(Number(slot));
    const validatorsMap = getValidatorsMap(validators);

    const operatorValidatorsMap = lidoLeys.reduce(
      (acc, signingKey) => {
        const { moduleAddress, operatorIndex } = signingKey;
        const pubkey = signingKey.key;
        const validator = validatorsMap[pubkey];

        if (!validator) return acc;
        if (!acc[moduleAddress]) acc[moduleAddress] = {} as Record<number, LidoValidator[]>;
        if (!acc[moduleAddress][operatorIndex]) acc[moduleAddress][operatorIndex] = [] as LidoValidator[];

        acc[moduleAddress][operatorIndex].push({ validator, signingKey });

        return acc;
      },
      {} as Record<string, Record<number, LidoValidator[]>>,
    );

    // fetch modules
    const modules = await getStakingModules();

    modules.forEach(async (module) => {
      logger.log('Module', module.id, module.stakingModuleAddress);

      const operators = await getNodeOperators(module.stakingModuleAddress);
      const operatorIds = operators.map(({ operatorId }) => operatorId);

      const lastRequestedIndexes = await exitBusOracleContract.getLastRequestedValidatorIndices(module.id, operatorIds);
      const detailedOperators = operators.map((operator, index) => {
        const { operatorId, name } = operator;
        const lastRequestedIndex = Number(lastRequestedIndexes[index]);

        if (lastRequestedIndex === -1) return { operatorId, name, lastRequestedIndex, exited: 0, unsettled: 0 };

        const operatorValidators = operatorValidatorsMap[module.stakingModuleAddress][operatorId];
        const requestedValidators = operatorValidators.filter(
          ({ validator }) => Number(validator.index) <= lastRequestedIndex,
        );
        const unsettledRequests = requestedValidators.filter(
          ({ validator }) => validator.validator.exit_epoch === FAR_FUTURE_EPOCH.toString(),
        );

        const exited = requestedValidators.length - unsettledRequests.length;
        const unsettled = unsettledRequests.length;

        if (unsettled > 0) {
          logger.log(`Operator #${operatorId} ${name} has unsettled requests`);
          logger.table(
            unsettledRequests.map(({ validator }) => {
              const {
                validator: { pubkey },
                index,
              } = validator;

              return { index, pubkey };
            }),
          );
          logger.log('');
        }

        return { operatorId, name, lastRequestedIndex, exited, unsettled };
      });

      const operatorsWithUnsettledRequests = detailedOperators.filter(({ unsettled }) => unsettled > 0);

      logger.log('Summary');
      logger.table(operatorsWithUnsettledRequests);
    });
  });
