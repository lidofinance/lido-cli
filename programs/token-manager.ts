import { parseEther } from 'ethers';
import { wallet } from '../wallet';
import { program } from '../command';
import { tmContract } from '../contracts';
import { grantPermission, revokePermission, resumeLidoAndSetStakingLimit, votingForward } from '../scripts';

const tokenManager = program.command('token-manager');

tokenManager
  .command('start-protocol')
  .option('-l, --staking-limit <number>', 'daily staking limit', '150000')
  .action(async (options) => {
    const { stakingLimit } = options;
    const limit = parseEther(stakingLimit);
    console.log('staking limit', limit);

    const [lidoCalldata] = resumeLidoAndSetStakingLimit(limit);
    const [votingCalldata] = votingForward(lidoCalldata);

    await tmContract.forward(votingCalldata);
    console.log('vote started');
  });

tokenManager
  .command('grant-permission')
  .option('-e, --entity <string>', 'entity', wallet.address)
  .option('-a, --app <string>', 'app')
  .option('-r, --role <string>', 'role')
  .action(async (options) => {
    const { entity, app, role } = options;

    const [aclCalldata] = await grantPermission(entity, app, role);
    const [votingCalldata] = votingForward(aclCalldata);

    await tmContract.forward(votingCalldata);
    console.log('vote started');
  });

tokenManager
  .command('revoke-permission')
  .option('-e, --entity <string>', 'entity', wallet.address)
  .option('-a, --app <string>', 'app')
  .option('-r, --role <string>', 'role')
  .action(async (options) => {
    const { entity, app, role } = options;

    const [aclCalldata] = await revokePermission(entity, app, role);
    const [votingCalldata] = votingForward(aclCalldata);

    await tmContract.forward(votingCalldata);
    console.log('vote started');
  });
