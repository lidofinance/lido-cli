import { program } from '@command';
import { consolidationGatewayContract } from '@contracts';
import { fetchAllLidoKeys, fetchLidoModuleKeys, fetchLidoModuleOperators, fetchValidators, wallet } from '@providers';
import { contractCallTxWithConfirm, getValidatorsMap, logger, splitHex, validatePubkey } from '@utils';
import { getStakingModules } from './staking-module';
import chalk from 'chalk';

const title = chalk.white.bold.green;
const grey = chalk.white.grey;

const consolidation = program
  .command('consolidation')
  .aliases(['cs'])
  .description('interact with consolidation primitives');

consolidation
  .command('get-possible-consolidations')
  .aliases(['pc'])
  .description('get possible consolidations from KAPI and CL')
  .option('-m, --source-module-id <number>', 'filter by source module id')
  .option('-o, --source-operator-id <number>', 'filter by source operator id')
  .action(async (options) => {
    const { sourceModuleId, sourceOperatorId } = options;

    const parsedModuleId = sourceModuleId
      ? isNaN(Number(sourceModuleId))
        ? sourceModuleId
        : Number(sourceModuleId)
      : undefined;
    const parsedOperatorId = sourceOperatorId ? parseInt(sourceOperatorId) : undefined;

    logger.log(title('Fetching data from KAPI and CL...'));

    let lidoKeys;
    if (parsedModuleId !== undefined) {
      lidoKeys = await fetchLidoModuleKeys({
        moduleId: parsedModuleId,
        nodeOperatorId: parsedOperatorId,
        used: true,
      });
    } else {
      lidoKeys = await fetchAllLidoKeys({
        nodeOperatorId: parsedOperatorId,
        used: true,
      });
    }

    if (lidoKeys.length === 0) {
      logger.log(grey('No used Lido keys found for the given filters.'));
      return;
    }

    const pubkeys = lidoKeys.map((key) => key.key);
    const [clValidators, ...operatorsByModule] = await Promise.all([
      fetchValidators(pubkeys),
      ...Array.from(new Set(lidoKeys.map((key) => key.moduleAddress))).map((address) =>
        fetchLidoModuleOperators(address),
      ),
    ]);

    const operatorsMap: Record<string, string> = {};
    operatorsByModule.forEach((operators) => {
      operators.forEach((op) => {
        operatorsMap[`${op.moduleAddress}-${op.index}`] = op.name;
      });
    });

    const clValidatorsMap = getValidatorsMap(clValidators);

    const stakingModules = await getStakingModules();
    const modulesMap: Record<string, number> = {};
    stakingModules.forEach((m) => {
      modulesMap[m.stakingModuleAddress.toLowerCase()] = m.id;
    });

    const filteredLidoKeys = lidoKeys;

    // Grouping by (withdrawalCredentials)
    const groups: Record<string, typeof lidoKeys> = {};

    filteredLidoKeys.forEach((key) => {
      const clValidator = clValidatorsMap[key.key];
      if (!clValidator) return;

      // Only active validators are eligible for consolidation
      if (clValidator.status !== 'active_ongoing') return;

      const wc = clValidator.validator.withdrawal_credentials;
      const groupKey = wc;

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(key);
    });

    logger.log(title('Possible Consolidations:'));
    let found = false;

    for (const groupKey in groups) {
      const keys = groups[groupKey];
      if (keys.length < 2) continue;

      const wc = groupKey;

      // Find pairs (source, target) with DIFFERENT operator IDs
      const pairs: Array<{ source: (typeof lidoKeys)[0]; target: (typeof lidoKeys)[0] }> = [];
      const usedInPair = new Set<string>();

      for (let i = 0; i < keys.length; i++) {
        if (usedInPair.has(keys[i].key)) continue;
        for (let j = i + 1; j < keys.length; j++) {
          if (usedInPair.has(keys[j].key)) continue;

          if (keys[i].operatorIndex !== keys[j].operatorIndex || 1) {
            pairs.push({ source: keys[i], target: keys[j] });
            usedInPair.add(keys[i].key);
            usedInPair.add(keys[j].key);
            break;
          }
        }
      }

      if (pairs.length === 0) continue;

      found = true;
      logger.log(grey(`Withdrawal Credentials: ${wc}`));

      for (const pair of pairs) {
        const { source, target } = pair;
        const sourceOperatorName = operatorsMap[`${source.moduleAddress}-${source.operatorIndex}`] || 'Unknown';
        const targetOperatorName = operatorsMap[`${target.moduleAddress}-${target.operatorIndex}`] || 'Unknown';
        const sourceModuleId = modulesMap[source.moduleAddress.toLowerCase()] || 'Unknown';
        const targetModuleId = modulesMap[target.moduleAddress.toLowerCase()] || 'Unknown';

        logger.log(grey(`  Pair:`));
        logger.log(
          grey(
            `    Source: ${source.key} (Module ID: ${sourceModuleId}, Operator ID: ${source.operatorIndex} [${sourceOperatorName}])`,
          ),
        );
        logger.log(
          grey(
            `    Target: ${target.key} (Module ID: ${targetModuleId}, Operator ID: ${target.operatorIndex} [${targetOperatorName}])`,
          ),
        );
      }
    }

    if (!found) {
      logger.log(grey('No possible consolidations found.'));
    }
  });
