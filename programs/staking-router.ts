import { program } from '@command';
import { stakingRouterContract } from '@contracts';
import { addAccessControlSubCommands, addOssifiableProxyCommands, addParsingCommands } from './common';

const router = program.command('staking-router').description('interact with staking router contract');
addAccessControlSubCommands(router, stakingRouterContract);
addOssifiableProxyCommands(router, stakingRouterContract);
addParsingCommands(router, stakingRouterContract);

router
  .command('modules')
  .description('returns staking modules')
  .action(async () => {
    const modules = await stakingRouterContract.getStakingModules();
    const formattedModules = modules.map((module) => module.toObject());
    console.log('modules', formattedModules);
  });

router
  .command('module')
  .description('returns staking module')
  .argument('<module-id>', 'staking module id')
  .action(async (moduleId) => {
    const module = await stakingRouterContract.getStakingModule(moduleId);
    console.log('module', module);
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
    await stakingRouterContract.addStakingModule(name, address, targetShare, moduleFee, treasuryFee);
    console.log('module added');
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
    await stakingRouterContract.updateStakingModule(moduleId, targetShare, moduleFee, treasuryFee);
    console.log('module updated');
  });

router
  .command('update-refunded-validators')
  .description('updates refunded validators count')
  .argument('<module-id>', 'module id')
  .option('-o, --node-operator-id <number>', 'node operator id')
  .option('-v, --refunded-validators <number>', 'refunded validators')
  .action(async (moduleId, options) => {
    const { nodeOperatorId, refundedValidators } = options;
    await stakingRouterContract.updateRefundedValidatorsCount(moduleId, nodeOperatorId, refundedValidators);
    console.log('refunded validators updated');
  });

router
  .command('withdrawal-credentials')
  .description('returns withdrawal credentials')
  .action(async () => {
    const withdrawalCredentials = await stakingRouterContract.getWithdrawalCredentials();
    console.log('withdrawal credentials', withdrawalCredentials);
  });

router
  .command('is-paused')
  .description('returns if module is paused')
  .argument('<module-id>', 'module id')
  .action(async (moduleId) => {
    const isPaused = await stakingRouterContract.getStakingModuleIsDepositsPaused(moduleId);
    console.log('module paused', isPaused);
  });

router
  .command('last-deposit-block')
  .description('returns last deposit block for module')
  .argument('<module-id>', 'module id')
  .action(async (moduleId) => {
    const block = await stakingRouterContract.getStakingModuleLastDepositBlock(moduleId);
    console.log('last deposit block', block);
  });

router
  .command('is-active')
  .description('returns if module is active')
  .argument('<module-id>', 'module id')
  .action(async (moduleId) => {
    const block = await stakingRouterContract.getStakingModuleIsActive(moduleId);
    console.log('is module active', block);
  });

router
  .command('nonce')
  .description('returns module nonce')
  .argument('<module-id>', 'module id')
  .action(async (moduleId) => {
    const nonce = await stakingRouterContract.getStakingModuleNonce(moduleId);
    console.log('module nonce', nonce);
  });

router
  .command('max-deposits')
  .description('returns max deposits count for staking module')
  .argument('<module-id>', 'module id')
  .action(async (moduleId) => {
    const deposits = await stakingRouterContract.getStakingModuleMaxDepositsCount(moduleId);
    console.log('max deposits', deposits);
  });

router
  .command('allocation')
  .description('returns deposits allocation')
  .argument('<deposits>', 'deposits count')
  .action(async (depositsCount) => {
    const allocation = await stakingRouterContract.getDepositsAllocation(depositsCount);
    console.log('allocation', allocation);
  });

router
  .command('digests')
  .description('returns all node operators digests')
  .argument('<module-id>', 'module id')
  .action(async (moduleId) => {
    const digests = await stakingRouterContract.getAllNodeOperatorDigests(moduleId);

    const formattedDigest = digests.map((operator) => ({
      ...operator.toObject(),
      summary: operator.summary.toObject(),
    }));

    console.log('digests', formattedDigest);
  });
