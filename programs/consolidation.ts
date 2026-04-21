import { program } from '@command';
import { consolidationGatewayContract } from '@contracts';
import { fetchAllLidoKeys, fetchLidoModuleKeys, fetchLidoModuleOperators, fetchValidators, wallet } from '@providers';
import { contractCallTxWithConfirm, getValidatorsMap, logger, splitHex, validatePubkey } from '@utils';
import { getStakingModules, StakingModule } from './staking-module';
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

    const lidoKeys = await fetchAllLidoKeys({
      used: true,
    });

    if (lidoKeys.length === 0) {
      logger.log(grey('No used Lido keys found for the given filters.'));
      return;
    }

    logger.log(grey(`Total Lido keys fetched: ${lidoKeys.length}`));

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
    const modulesMap: Record<string, StakingModule> = {};
    stakingModules.forEach((m) => {
      modulesMap[m.stakingModuleAddress.toLowerCase()] = m;
    });

    const filteredLidoKeys = lidoKeys;

    logger.log(grey(`      Mapping ${stakingModules.length} staking modules...`));

    // Grouping by (withdrawalCredentials)
    const groups: Record<string, typeof lidoKeys> = {};

    filteredLidoKeys.forEach((key) => {
      const clValidator = clValidatorsMap[key.key];
      if (!clValidator) {
        logger.log(grey(`      Validator not found in CL: ${key.key}`));
        return;
      }

      // Only active validators are eligible for consolidation
      if (clValidator.status !== 'active_ongoing') {
        logger.log(grey(`      Validator not active (${clValidator.status}): ${key.key}`));
        return;
      }

      const wc = clValidator.validator.withdrawal_credentials;
      // Protocol consolidation requires matching the "actual" withdrawal address part of the WC.
      // 0x01... and 0x02... credentials can be consolidated if they share the same address.
      // The address is the last 20 bytes (40 hex chars).
      const groupKey = '0x' + wc.slice(-40).toLowerCase();

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(key);
    });

    logger.log(title('Possible Consolidations:'));
    let found = false;

    const wct2Keys = lidoKeys.filter((key) => {
      const mod = modulesMap[key.moduleAddress.toLowerCase()];
      return mod && mod.withdrawalCredentialsType === 2;
    });

    if (parsedModuleId !== undefined || parsedOperatorId !== undefined) {
      const wct2Modules = stakingModules.filter((m) => m.withdrawalCredentialsType === 2);
      const wct2ModuleIds = wct2Modules.map((m) => m.id);
      logger.log(grey(`    Target modules with WCT=2: ${wct2ModuleIds.join(', ')}`));
      logger.log(grey(`    Total potential target keys (WCT=2): ${wct2Keys.length}`));
    }

    for (const groupKey in groups) {
      const keys = groups[groupKey];
      const filteredKeys = keys.filter((key) => {
        const mod = modulesMap[key.moduleAddress.toLowerCase()];
        const match =
          (parsedModuleId === undefined || mod?.id === parsedModuleId) &&
          (parsedOperatorId === undefined || key.operatorIndex === parsedOperatorId);
        return match;
      });

      const isFilteredGroup = parsedModuleId !== undefined || parsedOperatorId !== undefined ? filteredKeys.length > 0 : true;

      if (isFilteredGroup) {
        logger.log(grey(`    Processing group ${groupKey} with ${keys.length} keys`));
      }

      if (keys.length < 2) {
        if (isFilteredGroup) {
          logger.log(grey(`      Filtered sources found in group ${groupKey}: ${filteredKeys.length}`));
          for (const key of filteredKeys) {
            logger.log(grey(`      Source key ${key.key} has no potential targets in the same WC group.`));
            if (wct2Keys.length > 0) {
              const otherGroupWCT2 = wct2Keys.filter((k) => !keys.some((groupKey) => groupKey.key === k.key));
              if (otherGroupWCT2.length > 0) {
                logger.log(
                  grey(
                    `      Found ${otherGroupWCT2.length} target keys with WCT=2 in OTHER WC groups. Consolidation is only possible within the same WC group.`,
                  ),
                );
              }
            }
          }
        }
        continue;
      }

      const wc = groupKey;

      // Find pairs (source, target)
      const pairs: Array<{ source: (typeof lidoKeys)[0]; target: (typeof lidoKeys)[0] }> = [];

      for (let i = 0; i < keys.length; i++) {

        // Source must match the filter if provided
        const sourceModule = modulesMap[keys[i].moduleAddress.toLowerCase()];
        const sourceModuleIdValue = sourceModule?.id;
        const sourceOperatorIdValue = keys[i].operatorIndex;

        if (parsedModuleId !== undefined && sourceModuleIdValue !== parsedModuleId) {
          continue;
        }
        if (parsedOperatorId !== undefined && sourceOperatorIdValue !== parsedOperatorId) {
          continue;
        }

        let sourceMatched = false;
        for (let j = 0; j < keys.length; j++) {
          const sourceModuleIdValueLog = sourceModuleIdValue || 'Unknown';
          const targetModule = modulesMap[keys[j].moduleAddress.toLowerCase()];
          const targetModuleId = targetModule?.id || 'Unknown';

          if (i === j) {
            if (targetModule && targetModule.withdrawalCredentialsType === 2) {
              if (parsedModuleId !== undefined || parsedOperatorId !== undefined) {
                logger.log(
                  grey(
                    `      Target skipped: ${keys[j].key} (M:${targetModuleId}, O:${keys[j].operatorIndex}) - same as source key`,
                  ),
                );
              }
            }
            continue;
          }

          // Target module must have withdrawalCredentialsType == 2
          if (!targetModule || targetModule.withdrawalCredentialsType !== 2) {
            continue;
          }

          logger.log(
            grey(
              `      Checking pair: Source(${keys[i].key}, M:${sourceModuleIdValueLog}, O:${keys[i].operatorIndex}) -> Target(${keys[j].key}, M:${targetModuleId}, O:${keys[j].operatorIndex}, WCT:${targetModule?.withdrawalCredentialsType})`,
            ),
          );

          pairs.push({ source: keys[i], target: keys[j] });
          sourceMatched = true;
          break;
        }

        if (!sourceMatched && (parsedModuleId !== undefined || parsedOperatorId !== undefined)) {
          logger.log(grey(`      Source key ${keys[i].key} (M:${sourceModuleIdValue || 'Unknown'}, O:${keys[i].operatorIndex}) - no valid targets found in this group.`));
          const wct2InGroupCount = keys.filter((k, idx) => idx !== i && modulesMap[k.moduleAddress.toLowerCase()]?.withdrawalCredentialsType === 2).length;
          if (wct2InGroupCount === 0 && wct2Keys.length > 0) {
            logger.log(grey(`        Note: Found ${wct2Keys.length} potential target keys with WCT=2 in OTHER groups.`));
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
        const sourceModule = modulesMap[source.moduleAddress.toLowerCase()];
        const targetModule = modulesMap[target.moduleAddress.toLowerCase()];
        const sourceModuleId = sourceModule?.id || 'Unknown';
        const targetModuleId = targetModule?.id || 'Unknown';

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
