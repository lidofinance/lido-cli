import { program } from '@command';
import { stakingRouterContract } from '@contracts';
import { authorizedCall, logger } from '@utils';
import { Result, parseEther } from 'ethers';
import { addAccessControlSubCommands, addLogsCommands, addOssifiableProxyCommands, addParsingCommands } from './common';
import { formatStakingModuleObject, getNodeOperators, getStakingModules } from './staking-module';
import Table from 'cli-table3';
import chalk from 'chalk';

const ok = chalk.green.bold;
const warn = chalk.yellow.bold;
const head = chalk.white.bold;

const router = program
  .command('staking-router')
  .aliases(['sr', 'router'])
  .description('interact with staking router contract');
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
    logger.log('Module', formatStakingModuleObject(module));
  });

router
  .command('module-summary')
  .aliases(['summary'])
  .description('returns staking module summary')
  .argument('<module-id>', 'staking module id')
  .action(async (moduleId) => {
    const summary = await stakingRouterContract.getStakingModuleSummary(moduleId);
    logger.log('Summary', summary.toObject());
  });

router
  .command('add-module')
  .description('adds staking module')
  .option('-n, --name <string>', 'staking module name')
  .option('-a, --address <string>', 'staking module address')
  .option('-s, --stake-share-limit <number>', 'stake share limit in basis points: 100 = 1%, 10000 = 100%', '10000')
  .option(
    '-p, --priority-exit-share-threshold <number>',
    'priority exit share threshold in basis points: 100 = 1%, 10000 = 100%',
    '10000',
  )
  .option('-f, --module-fee <number>', 'module share in basis points: 100 = 1%, 10000 = 100%', '500')
  .option('-t, --treasury-fee <number>', 'treasury share in basis points: 100 = 1%, 10000 = 100%', '500')
  .option('-m, --max-deposits-per-block <number>', 'max deposits per block')
  .option('-d, --min-deposit-block-distance <number>', 'min deposit block distance')
  .action(async (options) => {
    const {
      name,
      address,
      stakeShareLimit,
      priorityExitShareThreshold,
      moduleFee,
      treasuryFee,
      maxDepositsPerBlock,
      minDepositBlockDistance,
    } = options;

    await authorizedCall(stakingRouterContract, 'addStakingModule', [
      name,
      address,
      stakeShareLimit,
      priorityExitShareThreshold,
      moduleFee,
      treasuryFee,
      maxDepositsPerBlock,
      minDepositBlockDistance,
    ]);
  });

router
  .command('update-module')
  .description('updates staking module parameters')
  .argument('<module-id>', 'module id')
  .option('-s, --stake-share-limit <number>', 'stake share limit in basis points: 100 = 1%, 10000 = 100%', '10000')
  .option(
    '-p, --priority-exit-share-threshold <number>',
    'priority exit share threshold in basis points: 100 = 1%, 10000 = 100%',
    '10000',
  )
  .option('-f, --module-fee <number>', 'module share in basis points: 100 = 1%, 10000 = 100%', '500')
  .option('-t, --treasury-fee <number>', 'treasury share in basis points: 100 = 1%, 10000 = 100%', '500')
  .option('-m, --max-deposits-per-block <number>', 'max deposits per block')
  .option('-d, --min-deposit-block-distance <number>', 'min deposit block distance')
  .action(async (moduleId, options) => {
    const {
      stakeShareLimit,
      priorityExitShareThreshold,
      moduleFee,
      treasuryFee,
      maxDepositsPerBlock,
      minDepositBlockDistance,
    } = options;

    await authorizedCall(stakingRouterContract, 'updateStakingModule', [
      moduleId,
      stakeShareLimit,
      priorityExitShareThreshold,
      moduleFee,
      treasuryFee,
      maxDepositsPerBlock,
      minDepositBlockDistance,
    ]);
  });

router
  .command('set-stake-share-limit')
  .aliases(['set-stake-limit'])
  .description('sets stake share limit')
  .argument('<module-id>', 'module id')
  .argument('<stake-share-limit>', 'stake share limit in basis points: 100 = 1%, 10000 = 100%')
  .action(async (moduleId, stakeShareLimit) => {
    const module = await stakingRouterContract.getStakingModule(moduleId);
    const { priorityExitShareThreshold, stakingModuleFee, treasuryFee, maxDepositsPerBlock, minDepositBlockDistance } =
      module;

    await authorizedCall(stakingRouterContract, 'updateStakingModule', [
      moduleId,
      stakeShareLimit,
      priorityExitShareThreshold,
      stakingModuleFee,
      treasuryFee,
      maxDepositsPerBlock,
      minDepositBlockDistance,
    ]);
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
  .command('pause-module')
  .description('pause deposits for staking module')
  .argument('<module-id>', 'module id')
  .action(async (moduleId) => {
    await authorizedCall(stakingRouterContract, 'pauseStakingModule', [moduleId]);
  });

router
  .command('resume-module')
  .description('resume deposits for staking module')
  .argument('<module-id>', 'module id')
  .action(async (moduleId) => {
    await authorizedCall(stakingRouterContract, 'resumeStakingModule', [moduleId]);
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
  .argument('<max-deposit-value>', 'max deposits value')
  .action(async (moduleId, maxDepositsValue) => {
    const deposits = await stakingRouterContract.getStakingModuleMaxDepositsCount(
      moduleId,
      parseEther(maxDepositsValue),
    );
    logger.log('Max deposits', deposits);
  });

router
  .command('allocation')
  .description('returns deposits allocation')
  .argument('<deposits>', 'deposits count')
  .action(async (depositsCount) => {
    const [currentAllocation, newAllocation] = await Promise.all([
      stakingRouterContract.getDepositsAllocation(0),
      stakingRouterContract.getDepositsAllocation(depositsCount),
    ]);

    const [, curAllocationByModules] = currentAllocation as [bigint, bigint[]];
    const [allocated, newAllocationByModules] = newAllocation as [bigint, bigint[]];

    const allocationTable = new Table({
      head: ['Module', 'Before', 'After', 'Change'],
      colAligns: ['left', 'right', 'right', 'right'],
      style: { head: ['gray'], compact: true },
    });

    allocationTable.push(
      ...newAllocationByModules.map((newAllocationToModule, index) => {
        const curAllocationByModule = curAllocationByModules[index];
        const dif = newAllocationToModule - curAllocationByModule;
        return [
          head(index + 1),
          Number(curAllocationByModule),
          Number(newAllocationToModule),
          dif > 0 ? ok(`+${dif}`) : String(dif),
        ];
      }),
    );

    const unallocated = depositsCount - Number(allocated);

    logger.log(allocationTable.toString());
    logger.log();
    logger.log('Allocated  ', unallocated > 0 ? warn(Number(allocated)) : ok(Number(allocated)));
    logger.log('Unallocated', unallocated > 0 ? warn(unallocated) : ok(unallocated));
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

      const operatorsTable = new Table({
        head: [
          'OpId',
          'Name',
          'Status',
          'Target',
          'Active',
          'Refunded',
          'Stuck',
          'Stuck TS',
          'Depositable',
          'Exited',
          'Deposited',
        ],
        colAligns: ['right', 'left', 'left', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right'],
        style: { head: ['gray'], compact: true },
      });

      operators.map((operator, index) => {
        const { operatorId, name } = operator;
        const { isActive, summary } = digests[index].toObject();
        const {
          targetLimitMode,
          targetValidatorsCount,
          stuckValidatorsCount,
          refundedValidatorsCount,
          stuckPenaltyEndTimestamp,
          totalExitedValidators,
          depositableValidatorsCount,
          totalDepositedValidators,
        } = summary;

        const targetLimitDesc = [null, 'Soft', 'Hard'][targetLimitMode];
        const targetValidatorsText = warn(Number(targetValidatorsCount));

        operatorsTable.push([
          operatorId,
          head(name),
          isActive ? ok('Active') : warn('Disabled'),
          targetLimitMode > 0 ? `${targetValidatorsText} ${targetLimitDesc}` : null,
          Number(totalDepositedValidators - totalExitedValidators),
          Number(refundedValidatorsCount),
          stuckValidatorsCount ? warn(Number(stuckValidatorsCount)) : 0,
          stuckPenaltyEndTimestamp ? warn(Number(stuckPenaltyEndTimestamp)) : null,
          depositableValidatorsCount ? ok(Number(depositableValidatorsCount)) : 0,
          Number(totalExitedValidators),
          Number(totalDepositedValidators),
        ]);

        return {};
      });

      logger.log();
      logger.log('Module', module.id, module.stakingModuleAddress);
      logger.log(operatorsTable.toString());
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
  .option('-h, --hard-limit', 'hard limit', false)
  .action(async (moduleId, nodeOperatorId, targetLimit, options) => {
    const { hardLimit } = options;
    await authorizedCall(stakingRouterContract, 'updateTargetValidatorsLimits', [
      moduleId,
      nodeOperatorId,
      hardLimit ? 2 : 1,
      targetLimit,
    ]);
  });

router
  .command('unset-validators-limit')
  .description('unsets target validators limits')
  .argument('<module-id>', 'module id')
  .argument('<node-operator-id>', 'node operator id')
  .action(async (moduleId, nodeOperatorId) => {
    await authorizedCall(stakingRouterContract, 'updateTargetValidatorsLimits', [moduleId, nodeOperatorId, 0, 0]);
  });

router
  .command('rewards-distribution')
  .description('returns rewards distribution')
  .action(async () => {
    const distribution = await stakingRouterContract.getStakingRewardsDistribution();
    logger.log('Distribution', distribution);
  });
