import { Command } from 'commander';
import { Contract } from 'ethers';
import { aclContract } from '../../contracts';
import { createPermission, grantPermission, revokePermission, votingForward } from '../../scripts';
import { forwardVoteFromTm, getRolePosition, getRolePositionByAddress } from '../../utils';
import { wallet } from '../../wallet';

export const addAragonAppSubCommands = (command: Command, contract: Contract) => {
  command
    .command('get-role')
    .argument('<string>', 'role name')
    .action(async (method) => {
      const result = await contract[method]();
      console.log('role', result);
    });

  command
    .command('can-perform')
    .option('-r, --role <string>', 'role')
    .option('-a, --address <string>', 'address', wallet.address)
    .action(async (options) => {
      const { address, role } = options;
      const rolePosition = await getRolePosition(contract, role);
      const result = await contract.canPerform(address, rolePosition, []);
      console.log('can perform', result);
    });

  command
    .command('get-permission-manager')
    .option('-r, --role <string>', 'role')
    .action(async (options) => {
      const { role } = options;
      const rolePosition = await getRolePosition(contract, role);
      const norAddress = await contract.getAddress();

      const manager = await aclContract.getPermissionManager(norAddress, rolePosition);
      console.log('manager', manager);
    });

  command
    .command('create-permission')
    .option('-r, --role <string>', 'role')
    .option('-m, --manager <string>', 'role manager address', wallet.address)
    .option('-a, --address <string>', 'address that will be able to perform the role', wallet.address)
    .action(async (options) => {
      const { manager, address, role } = options;
      const rolePosition = await getRolePosition(contract, role);
      const app = await contract.getAddress();

      const [aclCalldata] = await createPermission(address, app, rolePosition, manager);
      const [votingCalldata] = votingForward(aclCalldata);

      await forwardVoteFromTm(votingCalldata);
    });

  command
    .command('has-permission')
    .option('-a, --address <string>', 'address', wallet.address)
    .option('-r, --role <string>', 'role')
    .action(async (options) => {
      const { address, role } = options;
      const rolePosition = await getRolePosition(contract, role);
      const app = await contract.getAddress();

      const permission = await aclContract.hasPermission(address, app, rolePosition);
      console.log('permission', permission);
    });

  command
    .command('grant-permission')
    .option('-a, --address <string>', 'address', wallet.address)
    .option('-r, --role <string>', 'role')
    .action(async (options) => {
      const { address, role } = options;
      const app = await contract.getAddress();

      const rolePosition = await getRolePosition(contract, role);
      const [aclCalldata] = await grantPermission(address, app, rolePosition);
      const [votingCalldata] = votingForward(aclCalldata);

      await forwardVoteFromTm(votingCalldata);
    });

  command
    .command('revoke-permission')
    .option('-a, --address <string>', 'address', wallet.address)
    .option('-r, --role <string>', 'role')
    .action(async (options) => {
      const { address, role } = options;
      const app = await contract.getAddress();

      const rolePosition = await getRolePosition(contract, role);
      const [aclCalldata] = await revokePermission(address, app, rolePosition);
      const [votingCalldata] = votingForward(aclCalldata);

      await forwardVoteFromTm(votingCalldata);
    });
};
