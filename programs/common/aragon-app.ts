import { Command } from 'commander';
import { Contract } from 'ethers';

import { aclContract } from '@contracts';
import { createPermission, grantPermission, revokePermission, votingForward } from '@scripts';
import { forwardVoteFromTm, getRoleHash } from '@utils';
import { wallet } from '@provider';

export const addAragonAppSubCommands = (command: Command, contract: Contract) => {
  command
    .command('get-role')
    .description('returns a hash of the role')
    .argument('<role>', 'role name')
    .action(async (role) => {
      const roleHash = await getRoleHash(contract, role);
      console.log('role hash', roleHash);
    });

  command
    .command('can-perform')
    .description('checks if the address can perform the role')
    .argument('<role>', 'role name or role hash')
    .option('-a, --address <string>', 'address', wallet.address)
    .action(async (role, options) => {
      const { address } = options;
      const roleHash = await getRoleHash(contract, role);
      const result = await contract.canPerform(address, roleHash, []);
      console.log('can perform', result);
    });

  command
    .command('has-permission')
    .description('checks if the address has the permission')
    .argument('<role>', 'role name or role hash')
    .argument('<app>', 'app address')
    .option('-a, --address <string>', 'address', wallet.address)
    .action(async (role, app, options) => {
      const { address } = options;
      const roleHash = await getRoleHash(contract, role);
      const result = await aclContract.hasPermission(address, app, roleHash);
      console.log('has permission', result);
    });

  command
    .command('get-permission-manager')
    .description('returns the permission manager address')
    .argument('<role>', 'role name or role hash')
    .action(async (role) => {
      const roleHash = await getRoleHash(contract, role);
      const appAddress = await contract.getAddress();

      const manager = await aclContract.getPermissionManager(appAddress, roleHash);
      console.log('manager', manager);
    });

  command
    .command('create-permission')
    .description('creates the permission')
    .argument('<role>', 'role name or role hash')
    .option('-m, --manager <string>', 'role manager address', wallet.address)
    .option('-a, --address <string>', 'address that will be able to perform the role', wallet.address)
    .action(async (role, options) => {
      const { manager, address } = options;
      const roleHash = await getRoleHash(contract, role);
      const appAddress = await contract.getAddress();

      const [aclCalldata] = await createPermission(address, appAddress, roleHash, manager);
      const [votingCalldata] = votingForward(aclCalldata);

      await forwardVoteFromTm(votingCalldata);
    });

  command
    .command('grant-permission')
    .description('grants the permission to the address')
    .argument('<role>', 'role name or role hash')
    .option('-a, --address <string>', 'address', wallet.address)
    .action(async (role, options) => {
      const { address } = options;
      const appAddress = await contract.getAddress();

      const roleHash = await getRoleHash(contract, role);
      const [aclCalldata] = await grantPermission(address, appAddress, roleHash);
      const [votingCalldata] = votingForward(aclCalldata);

      await forwardVoteFromTm(votingCalldata);
    });

  command
    .command('revoke-permission')
    .description('revokes the permission from the address')
    .argument('<role>', 'role name or role hash')
    .option('-a, --address <string>', 'address', wallet.address)
    .action(async (role, options) => {
      const { address } = options;
      const appAddress = await contract.getAddress();

      const roleHash = await getRoleHash(contract, role);
      const [aclCalldata] = await revokePermission(address, appAddress, roleHash);
      const [votingCalldata] = votingForward(aclCalldata);

      await forwardVoteFromTm(votingCalldata);
    });
};
