import { Command } from 'commander';
import { Contract } from 'ethers';
import { getRolePosition } from '../../utils';
import { wallet } from '../../wallet';

export const addAccessControlSubCommands = (command: Command, contract: Contract) => {
  command
    .command('get-role')
    .argument('<string>', 'role name')
    .action(async (method) => {
      const result = await contract[method]();
      console.log('role', result);
    });

  command
    .command('has-role')
    .option('-r, --role <string>', 'role')
    .option('-a, --address <string>', 'address', wallet.address)
    .action(async (options) => {
      const { address, role } = options;
      const rolePosition = await getRolePosition(contract, role);
      const result = await contract.hasRole(rolePosition, address);
      console.log('can perform', result);
    });

  command
    .command('grant-role')
    .option('-r, --role <string>', 'role')
    .option('-a, --address <string>', 'address', wallet.address)
    .action(async (options) => {
      const { role, address } = options;
      const rolePosition = await getRolePosition(contract, role);
      await contract.grantRole(rolePosition, address);
    });

  command
    .command('revoke-role')
    .option('-r, --role <string>', 'role')
    .option('-a, --address <string>', 'address', wallet.address)
    .action(async (options) => {
      const { role, address } = options;
      const rolePosition = await getRolePosition(contract, role);
      await contract.revokeRole(rolePosition, address);
    });
};
