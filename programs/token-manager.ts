import { parseEther } from 'ethers';
import { wallet } from '../wallet';
import { program } from '../command';
import { tmContract } from '../contracts';
import { grantPermission, revokePermission, resumeLidoAndSetStakingLimit, votingForward } from '../scripts';
import { addParsingCommands } from './common';
import { getRolePositionByAddress } from '../utils';

const tokenManager = program.command('token-manager');
addParsingCommands(tokenManager, tmContract);

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

    const rolePosition = await getRolePositionByAddress(app, role);
    const [aclCalldata] = await grantPermission(entity, app, rolePosition);
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

    const rolePosition = await getRolePositionByAddress(app, role);
    const [aclCalldata] = await revokePermission(entity, app, rolePosition);
    const [votingCalldata] = votingForward(aclCalldata);

    await tmContract.forward(votingCalldata);
    console.log('vote started');
  });
