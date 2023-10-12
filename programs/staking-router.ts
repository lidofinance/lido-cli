import { program } from '@command';
import { stakingRouterContract } from '@contracts';
import { authorizedCall, logger } from '@utils';
import { Result } from 'ethers';
import { addAccessControlSubCommands, addLogsCommands, addOssifiableProxyCommands, addParsingCommands } from './common';
import { getNodeOperators, getStakingModules } from './staking-module';

const router = program.command('staking-router').description('interact with staking router contract');
addAccessControlSubCommands(router, stakingRouterContract);
addOssifiableProxyCommands(router, stakingRouterContract);
addParsingCommands(router, stakingRouterContract);
addLogsCommands(router, stakingRouterContract);

router
  .command('modules')
  .description('returns staking modules')
  .action(async () => {
    const modules = await getStakingModules();
    logger.log('Modules', modules);
  });

router
  .command('module')
  .description('returns staking module')
  .argument('<module-id>', 'staking module id')
  .action(async (moduleId) => {
    const module = await stakingRouterContract.getStakingModule(moduleId);
    logger.log('Module', module);
  });

router
  .command('add-module')
  .description('adds staking module')
  .option('-n, --name <string>', 'staking module name')
  .option('-a, --address <string>', 'staking module address')
  .option('-s, --target-share <number>', 'target share in basis points: 100 = 1%, 10000 = 100%', '10000')
  .option('-f, --module-fee <number>', 'module share in basis points: 100 = 1%, 10000 = 100%', '500')
  .option('-t, --treasury-fee <number>', 'treasury share in basis points: 100 = 1%, 10000 = 100%', '500')
  .action(async (options) => {
    const { name, address, targetShare, moduleFee, treasuryFee } = options;
    await authorizedCall(stakingRouterContract, 'addStakingModule', [
      name,
      address,
      targetShare,
      moduleFee,
      treasuryFee,
    ]);
  });

router
  .command('update-module')
  .description('updates staking module parameters')
  .argument('<module-id>', 'module id')
  .option('-s, --target-share <number>', 'target share in basis points: 100 = 1%, 10000 = 100%', '10000')
  .option('-f, --module-fee <number>', 'module share in basis points: 100 = 1%, 10000 = 100%', '500')
  .option('-t, --treasury-fee <number>', 'treasury share in basis points: 100 = 1%, 10000 = 100%', '500')
  .action(async (moduleId, options) => {
    const { targetShare, moduleFee, treasuryFee } = options;
    await authorizedCall(stakingRouterContract, 'updateStakingModule', [moduleId, targetShare, moduleFee, treasuryFee]);
  });

router
  .command('update-refunded-validators')
  .description('updates refunded validators count')
  .argument('<module-id>', 'module id')
  .option('-o, --node-operator-id <number>', 'node operator id')
  .option('-v, --refunded-validators <number>', 'refunded validators')
  .action(async (moduleId, options) => {
    const { nodeOperatorId, refundedValidators } = options;
    await authorizedCall(stakingRouterContract, 'updateRefundedValidatorsCount', [
      moduleId,
      nodeOperatorId,
      refundedValidators,
    ]);
  });

router
  .command('withdrawal-credentials')
  .description('returns withdrawal credentials')
  .action(async () => {
    const withdrawalCredentials = await stakingRouterContract.getWithdrawalCredentials();
    logger.log('Withdrawal credentials', withdrawalCredentials);
  });

router
  .command('is-paused')
  .description('returns if module is paused')
  .argument('<module-id>', 'module id')
  .action(async (moduleId) => {
    const isPaused = await stakingRouterContract.getStakingModuleIsDepositsPaused(moduleId);
    logger.log('Module paused', isPaused);
  });

router
  .command('last-deposit-block')
  .description('returns last deposit block for module')
  .argument('<module-id>', 'module id')
  .action(async (moduleId) => {
    const block = await stakingRouterContract.getStakingModuleLastDepositBlock(moduleId);
    logger.log('Last deposit block', block);
  });

router
  .command('is-active')
  .description('returns if module is active')
  .argument('<module-id>', 'module id')
  .action(async (moduleId) => {
    const block = await stakingRouterContract.getStakingModuleIsActive(moduleId);
    logger.log('Is module active', block);
  });

router
  .command('nonce')
  .description('returns module nonce')
  .argument('<module-id>', 'module id')
  .action(async (moduleId) => {
    const nonce = await stakingRouterContract.getStakingModuleNonce(moduleId);
    logger.log('Module nonce', nonce);
  });

router
  .command('max-deposits')
  .description('returns max deposits count for staking module')
  .argument('<module-id>', 'module id')
  .action(async (moduleId) => {
    const deposits = await stakingRouterContract.getStakingModuleMaxDepositsCount(moduleId);
    logger.log('Max deposits', deposits);
  });

router
  .command('allocation')
  .description('returns deposits allocation')
  .argument('<deposits>', 'deposits count')
  .action(async (depositsCount) => {
    const allocation = await stakingRouterContract.getDepositsAllocation(depositsCount);
    logger.log('Allocation', allocation);
  });

router
  .command('digests')
  .description('returns modules digests')
  .action(async () => {
    const modules = await getStakingModules();

    for (const module of modules) {
      const operators = await getNodeOperators(module.stakingModuleAddress);
      const operatorIds = operators.map(({ operatorId }) => operatorId);

      const digests = await stakingRouterContract.getNodeOperatorDigests(module.id, operatorIds);
      const operatorsDigests = operators.map((operator, index) => {
        const { operatorId, name } = operator;
        const { isActive, summary } = digests[index].toObject();
        const {
          isTargetLimitActive,
          targetValidatorsCount,
          stuckValidatorsCount,
          refundedValidatorsCount,
          stuckPenaltyEndTimestamp,
          totalExitedValidators,
          depositableValidatorsCount,
          totalDepositedValidators,
        } = summary;

        return {
          operatorId,
          name,
          isActive: isActive,
          target: isTargetLimitActive ? targetValidatorsCount : null,
          active: Number(totalDepositedValidators - totalExitedValidators),
          refunded: Number(refundedValidatorsCount),
          stuck: Number(stuckValidatorsCount),
          stuckTS: stuckPenaltyEndTimestamp ? Number(stuckPenaltyEndTimestamp) : null,
          depositable: Number(depositableValidatorsCount),
          exited: Number(totalExitedValidators),
          deposited: Number(totalDepositedValidators),
        };
      });

      logger.log('Module', module.id, module.stakingModuleAddress);
      logger.table(operatorsDigests);
    }
  });

router
  .command('active-keys')
  .description('returns all node operators digests')
  .argument('<module-id>', 'module id')
  .action(async (moduleId) => {
    const digests: Result[] = await stakingRouterContract.getAllNodeOperatorDigests(moduleId);

    const activeKeys = digests.map((operator) => {
      const { totalDepositedValidators, totalExitedValidators } = operator.summary.toObject();

      return {
        operatorId: Number(operator.id),
        activeKeys: Number(totalDepositedValidators - totalExitedValidators),
      };
    });

    const sortedKeys = activeKeys.sort((a, b) => a.activeKeys - b.activeKeys);
    logger.table(sortedKeys);
  });

router
  .command('set-validators-limit')
  .description('sets target validators limits')
  .argument('<module-id>', 'module id')
  .argument('<node-operator-id>', 'node operator id')
  .argument('<target-limit>', 'target limit')
  .action(async (moduleId, nodeOperatorId, targetLimit) => {
    await authorizedCall(stakingRouterContract, 'updateTargetValidatorsLimits', [
      moduleId,
      nodeOperatorId,
      true,
      targetLimit,
    ]);
  });

router
  .command('unset-validators-limit')
  .description('unsets target validators limits')
  .argument('<module-id>', 'module id')
  .argument('<node-operator-id>', 'node operator id')
  .action(async (moduleId, nodeOperatorId) => {
    await authorizedCall(stakingRouterContract, 'updateTargetValidatorsLimits', [moduleId, nodeOperatorId, false, 0]);
  });

router
  .command('rewards-distribution')
  .description('returns rewards distribution')
  .action(async () => {
    const distribution = await stakingRouterContract.getStakingRewardsDistribution();
    logger.log('Distribution', distribution);
  });
