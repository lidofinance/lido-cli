import { program } from '../command';
import { stakingRouterContract } from '../contracts';
import { addAccessControlSubCommands, addParsingCommands } from './common';

const router = program.command('staking-router');
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
  .option('-t, --target-share <number>', 'target share in basis points: 100 = 1%, 10000 = 100%', '10000')
  .option('-f, --module-fee <number>', 'module share in basis points: 100 = 1%, 10000 = 100%', '500')
  .option('-t, --treasury-fee <number>', 'treasury share in basis points: 100 = 1%, 10000 = 100%', '500')
  .action(async (options) => {
    const { name, address, targetShare, moduleFee, treasuryFee } = options;
    await stakingRouterContract.addStakingModule(name, address, targetShare, moduleFee, treasuryFee);
    console.log('module added');
  });

router
  .command('update-module')
  .argument('<number>', 'module id')
  .option('-t, --target-share <number>', 'target share in basis points: 100 = 1%, 10000 = 100%', '10000')
  .option('-f, --module-fee <number>', 'module share in basis points: 100 = 1%, 10000 = 100%', '500')
  .option('-t, --treasury-fee <number>', 'treasury share in basis points: 100 = 1%, 10000 = 100%', '500')
  .action(async (moduleId, options) => {
    const { targetShare, moduleFee, treasuryFee } = options;
    await stakingRouterContract.updateStakingModule(moduleId, targetShare, moduleFee, treasuryFee);
    console.log('module updated');
  });

router
  .command('update-refunded-validators')
  .argument('<number>', 'module id')
  .option('-o, --node-operator-id <number>', 'node operator id')
  .option('-v, --refunded-validators <number>', 'refunded validators')
  .action(async (moduleId, options) => {
    const { nodeOperatorId, refundedValidators } = options;
    await stakingRouterContract.updateRefundedValidatorsCount(moduleId, nodeOperatorId, refundedValidators);
    console.log('refunded validators updated');
  });
