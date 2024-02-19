import { Command } from 'commander';
import { Contract } from 'ethers';
import { authorizedCall, getRoleHash, logger } from '@utils';
import { wallet } from '@providers';

export const addAccessControlSubCommands = (command: Command, contract: Contract) => {
  command
    .command('get-role')
    .description('returns a hash of the role')
    .argument('<role>', 'role name')
    .action(async (role) => {
      const roleHash = await getRoleHash(contract, role);
      logger.log('Role hash', roleHash);
    });

  command
    .command('get-role-admin')
    .description('returns an admin of the role')
    .argument('<role>', 'role name or role hash')
    .action(async (role) => {
      const roleHash = await getRoleHash(contract, role);
      const roleAdmin = await contract.getRoleAdmin(roleHash);
      logger.log('Role admin', roleAdmin);
    });

  command
    .command('get-role-members')
    .description('returns a list of members of the role')
    .argument('<role>', 'role name or role hash')
    .action(async (role) => {
      const roleHash = await getRoleHash(contract, role);
      const count = await contract.getRoleMemberCount(roleHash);

      if (count == 0) {
        logger.log('No members');
        return;
      }

      for (let i = 0; i < count; i++) {
        const count = await contract.getRoleMember(roleHash, i);
        logger.log(`Role member at ${i}`, count);
      }
    });

  command
    .command('has-role')
    .description('checks if the address has the role')
    .argument('<role>', 'role name or role hash')
    .option('-a, --address <string>', 'address', wallet.address)
    .action(async (role, options) => {
      const { address } = options;
      const roleHash = await getRoleHash(contract, role);
      const result = await contract.hasRole(roleHash, address);
      logger.log('Can perform', result);
    });

  command
    .command('grant-role')
    .description('grants the role to the address')
    .argument('<role>', 'role name or role hash')
    .option('-a, --address <string>', 'address', wallet.address)
    .action(async (role, options) => {
      const { address } = options;
      const roleHash = await getRoleHash(contract, role);
      await authorizedCall(contract, 'grantRole', [roleHash, address]);
    });

  command
    .command('revoke-role')
    .description('revokes the role from the address')
    .argument('<role>', 'role name or role hash')
    .option('-a, --address <string>', 'address', wallet.address)
    .action(async (role, options) => {
      const { address } = options;
      const roleHash = await getRoleHash(contract, role);
      await authorizedCall(contract, 'revokeRole', [roleHash, address]);
    });
};
