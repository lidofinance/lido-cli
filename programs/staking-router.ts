import { program } from '@command';
import { stakingRouterContract } from '@contracts';
import { addAccessControlSubCommands, addParsingCommands } from './common';

const router = program.command('staking-router').description('interact with staking router contract');
addAccessControlSubCommands(router, stakingRouterContract);
addParsingCommands(router, stakingRouterContract);

router.command('modules').action(async () => {
  const modules = await stakingRouterContract.getStakingModules();
  console.log('modules', modules);
});

router
  .command('add-module')
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
  .argument('<module-id>', 'module id')
  .option('-o, --node-operator-id <number>', 'node operator id')
  .option('-v, --refunded-validators <number>', 'refunded validators')
  .action(async (moduleId, options) => {
    const { nodeOperatorId, refundedValidators } = options;
    await stakingRouterContract.updateRefundedValidatorsCount(moduleId, nodeOperatorId, refundedValidators);
    console.log('refunded validators updated');
  });

router.command('withdrawal-credentials').action(async () => {
  const withdrawalCredentials = await stakingRouterContract.getWithdrawalCredentials();
  console.log('withdrawal credentials', withdrawalCredentials);
});

router
  .command('is-paused')
  .argument('<module-id>', 'module id')
  .action(async (moduleId) => {
    const isPaused = await stakingRouterContract.getStakingModuleIsDepositsPaused(moduleId);
    console.log('module paused', isPaused);
  });

router
  .command('last-deposit-block')
  .argument('<module-id>', 'module id')
  .action(async (moduleId) => {
    const block = await stakingRouterContract.getStakingModuleLastDepositBlock(moduleId);
    console.log('last deposit block', block);
  });

router
  .command('is-active')
  .argument('<module-id>', 'module id')
  .action(async (moduleId) => {
    const block = await stakingRouterContract.getStakingModuleIsActive(moduleId);
    console.log('is module active', block);
  });

router
  .command('nonce')
  .argument('<module-id>', 'module id')
  .action(async (moduleId) => {
    const nonce = await stakingRouterContract.getStakingModuleNonce(moduleId);
    console.log('module nonce', nonce);
  });

router
  .command('max-deposits')
  .argument('<module-id>', 'module id')
  .action(async (moduleId) => {
    const deposits = await stakingRouterContract.getStakingModuleMaxDepositsCount(moduleId);
    console.log('max deposits', deposits);
  });

router
  .command('allocation')
  .argument('<deposits>', 'deposits count')
  .action(async (depositsCount) => {
    const allocation = await stakingRouterContract.getDepositsAllocation(depositsCount);
    console.log('allocation', allocation);
  });
